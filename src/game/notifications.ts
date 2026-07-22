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
import { computeRespectfulSchedule } from "./notificationSchedule";

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
// Re-engagement queue: 4 nudges every ~5 hours after backgrounding. Was a
// single 22h delay which only landed if the player didn't reopen the app
// for a full day — which is almost never. Now the queue seeds four slots
// at 5h / 10h / 15h / 20h so a player who checks in every few hours
// still gets an actual ping. Each has a distinct id so the foreground
// cancel + re-schedule flow can target them individually (and iOS won't
// dedupe them as "same notification"). Quiet hours still respected per
// slot — if a slot's fire time would fall inside 22:00-08:00 it shifts
// to 09:00.
const RE_ENGAGEMENT_SLOTS_SEC = [
  5 * 3600,   // 5h — first check-in, "the cluster's still humming"
  10 * 3600,  // 10h — half-day, "capital's pooling"
  15 * 3600,  // 15h — evening / next morning, personality beat
  20 * 3600,  // 20h — day boundary fallback
];

// Stable identifiers so we can cancel ONE specific notification instead of
// nuking the whole queue. Earlier code used cancelAllScheduledNotificationsAsync
// which murdered the "Test push (5s)" notification any time the player
// backgrounded the app — and the player obviously DOES background the app
// while waiting for the test to fire, so it never landed.
const NOTIF_ID_REENGAGEMENT_PREFIX = "burnrate.reengagement";
const reengagementId = (slot: number) => `${NOTIF_ID_REENGAGEMENT_PREFIX}.${slot}`;
const NOTIF_ID_TEST = "burnrate.test";

// Distinct copy per slot so the 4-nudge queue reads as a story unfolding,
// not "the same nag four times." Slot 0 also gets a state-personalized
// body from buildReengagementBody as first-touch (freshest signal about
// what's actually pooled). Slots 1-3 rotate through prewritten flavor.
const SLOT_TITLES = [
  "the cluster is still humming.",
  "capital's pooling. buy something.",
  "the model wrote itself a raise.",
  "a day without you. the AI is fine.",
];
const SLOT_BODIES = [
  "come back and buy something. one thing.",
  "tokens accrued. the pipeline is patient.",
  "come read what it did while you were gone.",
  "the loss curve keeps improving. join it.",
];

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

/** Lightweight permission probe used by Settings UI — no prompt, just reads
 *  whatever iOS currently reports. "undetermined" = never asked yet. */
export type NotifPermStatus = "granted" | "denied" | "undetermined" | "unavailable";
export async function getNotificationPermissionStatus(): Promise<NotifPermStatus> {
  const N = getNotif();
  if (!N) return "unavailable";
  try {
    const r = (await N.getPermissionsAsync()) as unknown as { status?: string; granted?: boolean };
    if (r.granted || r.status === "granted") return "granted";
    if (r.status === "denied") return "denied";
    return "undetermined";
  } catch {
    return "unavailable";
  }
}

/** Result envelope for the Settings test button — distinguishes the failure
 *  modes so the UI can show actionable guidance instead of a generic "didn't
 *  work" toast. */
export type TestNotifResult =
  | { ok: true; scheduledId: string }
  | { ok: false; reason: "no_native"; detail: string }
  | { ok: false; reason: "denied"; detail: string }
  | { ok: false; reason: "schedule_failed"; detail: string };

/** Fire a re-engagement push 5 seconds from now. Returns a structured result
 *  so Settings can show the exact failure mode (denied / native missing /
 *  schedule threw). Sets the foreground handler before scheduling so the
 *  banner appears even if the app stays foreground for the 5s wait. */
export async function sendTestNotification(): Promise<TestNotifResult> {
  const N = getNotif();
  if (!N) return { ok: false, reason: "no_native", detail: "expo-notifications module not loaded" };
  try {
    const existing = (await N.getPermissionsAsync()) as unknown as { status?: string; granted?: boolean };
    let granted = existing.granted === true || existing.status === "granted";
    if (!granted) {
      const r = (await N.requestPermissionsAsync()) as unknown as { status?: string; granted?: boolean };
      granted = r.granted === true || r.status === "granted";
    }
    if (!granted) {
      return { ok: false, reason: "denied", detail: `iOS permission status: ${existing.status ?? "unknown"}` };
    }
  } catch (e) {
    return { ok: false, reason: "denied", detail: String(e) };
  }
  try {
    // Install foreground handler BEFORE scheduling — without it iOS silently
    // swallows the banner if the app is frontmost when the trigger fires.
    await N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      } as never),
    });
    // Identifier lets us cancel/replace just this one (and prevents accidental
    // wipe by the re-engagement scheduler now that it only cancels its own id).
    const id = await N.scheduleNotificationAsync({
      identifier: NOTIF_ID_TEST,
      content: {
        title: "your model misses you.",
        body: "the cluster is humming. you should be here.",
        sound: false,
      },
      trigger: { type: "timeInterval", seconds: 5, repeats: false } as never,
    });
    return { ok: true, scheduledId: String(id) };
  } catch (e) {
    return { ok: false, reason: "schedule_failed", detail: String(e) };
  }
}

/**
 * Cancel any scheduled re-engagement nudges. Called on app foreground so the
 * player never gets pinged about an app they're already in. Iterates over
 * every slot id so all 4 queued nudges get killed. Test notifications the
 * player triggered from Settings are NOT cancelled — they have their own id.
 */
export async function cancelScheduledReturn(): Promise<void> {
  const N = getNotif();
  if (!N) return;
  for (let i = 0; i < RE_ENGAGEMENT_SLOTS_SEC.length; i++) {
    try {
      await N.cancelScheduledNotificationAsync(reengagementId(i));
    } catch {
      /* noop — id may not be scheduled, that's fine */
    }
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
 * Schedule the 4-nudge re-engagement queue. Each slot fires at
 * RE_ENGAGEMENT_SLOTS_SEC[i] seconds after backgrounding (5h/10h/15h/20h),
 * quiet-hours-shifted to 09:00 local if the natural fire time would land
 * in 22:00-08:00. Cancels any prior queue first so we never double up.
 *
 * Slot 0 gets a state-personalized body (freshest signal). Slots 1-3
 * rotate through prewritten flavor so the queue reads as a story.
 */
export async function scheduleReengagement(state: GameState): Promise<void> {
  const N = getNotif();
  if (!N) return;
  if (!state.account?.pushOptedIn) return;
  try {
    await ensureForegroundHandler(N);
    // Wipe any prior queue slots so we don't double up. Only touches OUR
    // reengagement ids — test notifications and system pushes are safe.
    for (let i = 0; i < RE_ENGAGEMENT_SLOTS_SEC.length; i++) {
      await N.cancelScheduledNotificationAsync(reengagementId(i)).catch(() => {});
    }
    // Slot 0 body = personalized (freshest EQ/RP/capital signal).
    const personalized = buildReengagementBody(state);
    const delays = computeRespectfulSchedule(RE_ENGAGEMENT_SLOTS_SEC);
    for (let i = 0; i < RE_ENGAGEMENT_SLOTS_SEC.length; i++) {
      const title = SLOT_TITLES[i];
      const body = i === 0 ? personalized.body : SLOT_BODIES[i];
      await N.scheduleNotificationAsync({
        identifier: reengagementId(i),
        content: { title, body, sound: false },
        trigger: { type: "timeInterval", seconds: delays[i], repeats: false } as never,
      });
    }
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

