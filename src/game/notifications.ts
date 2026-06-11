// Push notification scheduler — GDD §12 spec.
//
// Behavior rules (so we don't violate Pillar 1 "respect the player's time"):
//   1. Never ask for permission on first launch. Wait until the player has
//      opened the app at least 3 times (GDD §12 "session 3+").
//   2. Hard cap: 1 notification per 24h. We schedule a single local
//      notification when the app goes to background; on next foreground
//      we cancel pending and re-schedule.
//   3. Quiet hours: never fire between 22:00 and 08:00 local time.
//   4. Personalized text — based on what's pooled in the player's state,
//      pick the most "ready to spend" line so the nudge feels useful, not
//      generic.
//   5. Web/SSR safe: every call defers to runtime checks so the module can
//      be imported on the web bundle (Expo router) without crashing.

import { Platform } from "react-native";
import type { GameState } from "./store";
import { D } from "../core/decimal";

// expo-notifications is a native module; on web it throws on import in some
// SDK versions. We require() it lazily inside each function so the web
// bundle stays clean.
type NotifModule = typeof import("expo-notifications");
let _Notifications: NotifModule | null = null;
function getNotif(): NotifModule | null {
  if (Platform.OS === "web") return null;
  if (_Notifications) return _Notifications;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _Notifications = require("expo-notifications") as NotifModule;
    return _Notifications;
  } catch {
    return null;
  }
}

const SESSION_THRESHOLD = 3; // GDD §12 — defer opt-in to session 3+
const QUIET_START_HOUR = 22; // 10pm local
const QUIET_END_HOUR = 8;    //  8am local
// Re-engagement nudges fire ~22h after the player closes the app — late
// enough that they're not annoyed, early enough that they don't lose a day.
const RE_ENGAGEMENT_DELAY_SEC = 22 * 3600;

/** Returns true if the player is eligible to be ASKED for permission. */
export function isEligibleForPushPrompt(account: { sessionsStarted?: number; pushOptedIn?: boolean; pushPromptedAt?: number }): boolean {
  if (account.pushOptedIn) return false; // already opted in
  if (account.pushPromptedAt && Date.now() - account.pushPromptedAt < 7 * 24 * 3600 * 1000) {
    return false; // cooldown a week after a "Not now"
  }
  return (account.sessionsStarted ?? 0) >= SESSION_THRESHOLD;
}

/** Requests notification permission. Returns true if granted. */
export async function requestPushPermission(): Promise<boolean> {
  const N = getNotif();
  if (!N) return false;
  try {
    // expo-notifications type narrows weirdly across iOS variants —
    // the `status` / `granted` props are present at runtime but the
    // typed union confuses tsc, so we read through `unknown`.
    const existing = (await N.getPermissionsAsync()) as unknown as { status?: string; granted?: boolean };
    if (existing.granted || existing.status === "granted") return true;
    const res = (await N.requestPermissionsAsync()) as unknown as { status?: string; granted?: boolean };
    return res.granted === true || res.status === "granted";
  } catch {
    return false;
  }
}

/**
 * Cancel any scheduled return-nudge. Called on app foreground so the
 * player never gets pinged about an app they're already in.
 */
export async function cancelScheduledReturn(): Promise<void> {
  const N = getNotif();
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
  } catch {
    /* noop */
  }
}

/**
 * Build a personalized "come back" message from current state. The most
 * "ready to spend" currency wins — feels useful, not generic.
 */
export function buildReengagementBody(s: GameState): { title: string; body: string } {
  const equity = D(s.persistent.equity).toNumber();
  const rp = D(s.run.researchPoints).toNumber();
  const capital = D(s.run.capital).toNumber();
  const tokens = D(s.run.tokens).toNumber();
  // Order by priority — first match wins.
  if (s.run.tokens && equity >= 200 && s.persistent.unlockedResearch.length < 20) {
    return {
      title: "EQ pooled — research is waiting.",
      body: `${formatShort(equity)} Equity ready. The tree won't unlock itself.`,
    };
  }
  if (rp >= 1000) {
    return {
      title: "Sprint upgrades waiting.",
      body: `${formatShort(rp)} RP — buy some boosts and push the round.`,
    };
  }
  if (capital >= 1e6) {
    return {
      title: "Capital is stacking.",
      body: `$${formatShort(capital)} ready. Buy the next tier.`,
    };
  }
  if (tokens > 0) {
    return {
      title: "Tokens are pooling.",
      body: "Your producers ran all night. Come collect.",
    };
  }
  return {
    title: "your model misses you.",
    body: "the cluster is humming. you should be here.",
  };
}

function formatShort(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9)  return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3)  return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

/**
 * Schedule a personalized re-engagement notification ~22h from now. Skips
 * if Quiet Hours would fall on the trigger time — bumps to 9am local
 * instead so the player doesn't get pinged at 4am.
 */
export async function scheduleReengagement(state: GameState): Promise<void> {
  const N = getNotif();
  if (!N) return;
  if (!state.account?.pushOptedIn) return;
  try {
    await ensureForegroundHandler(N);
    await N.cancelAllScheduledNotificationsAsync();
    const { title, body } = buildReengagementBody(state);
    const delaySec = computeRespectfulDelay(RE_ENGAGEMENT_DELAY_SEC);
    await N.scheduleNotificationAsync({
      content: { title, body, sound: false },
      trigger: { type: "timeInterval", seconds: delaySec, repeats: false } as never,
    });
  } catch {
    /* noop */
  }
}

/**
 * One-time install of a foreground notification handler. Without this,
 * iOS / Android silently swallow incoming notifications while the app is
 * frontmost. Idempotent — sets a single global flag and only installs once.
 */
let _handlerInstalled = false;
async function ensureForegroundHandler(N: NotifModule): Promise<void> {
  if (_handlerInstalled) return;
  _handlerInstalled = true;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        // Modern API (SDK 53+) — banner + list visibility, plus the legacy
        // shouldShowAlert key so older runtimes don't throw.
        shouldShowBanner: true,
        shouldShowList: true,
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      } as never),
    });
  } catch {
    /* noop */
  }
}

/** Shift the trigger out of the 22:00-08:00 quiet hours window. */
function computeRespectfulDelay(baseDelaySec: number): number {
  const fireTime = new Date(Date.now() + baseDelaySec * 1000);
  const h = fireTime.getHours();
  if (h >= QUIET_START_HOUR || h < QUIET_END_HOUR) {
    // Push to 09:00 the same morning (or next morning if late evening).
    const target = new Date(fireTime);
    if (h >= QUIET_START_HOUR) target.setDate(target.getDate() + 1);
    target.setHours(9, 0, 0, 0);
    return Math.max(60, Math.floor((target.getTime() - Date.now()) / 1000));
  }
  return baseDelaySec;
}
