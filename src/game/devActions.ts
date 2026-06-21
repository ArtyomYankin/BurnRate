// Dev-only mutations on game state. Imported ONLY from DevPanel, which is
// itself gated behind __DEV__ in App.tsx — so release bundles tree-shake this
// file away. Every action prefix is `__dev` so a grep before ship can confirm
// nothing in the player path calls into it.
//
// These bypass GDD rules on purpose: time-skip ignores the offline cap, jump-
// to-round skips threshold checks, "unlock all" doesn't pay Equity. The point
// is to compress hours of grind into seconds for QA / balance tuning.

import { D } from "../core/decimal";
import { effectiveRoundThreshold, freshRunState, tickRun } from "../core/math";
import { aggregateResearchEffects, RESEARCH_NODES } from "../core/research";
import { freshSave } from "../core/save";
import { VIGNETTES } from "../core/vignettes";
import { wipeSave } from "./persistence";
import { useGame } from "./store";

// ─── Time ────────────────────────────────────────────────────────────────
/**
 * Fast-forward the simulation by `seconds` of real-time-equivalent ticks.
 * Bypasses `clampOfflineDt` — that's the whole point. The underlying tick
 * still applies allocation / debt accrual / training-effect expiry, so the
 * jump is faithful to a long offline period.
 */
export function __devSkipTime(seconds: number) {
  const s = useGame.getState();
  const now = Date.now();
  const effects = aggregateResearchEffects(s.persistent.unlockedResearch);
  const r = tickRun(s.run, s.persistent, seconds, effects, now);
  useGame.setState({
    run: r.run,
    persistent: r.persistent,
    lastTickAt: now,
    pendingDebtEvents:
      r.firedThresholds.length === 0
        ? s.pendingDebtEvents
        : [...s.pendingDebtEvents, ...r.firedThresholds],
  });
}

// ─── Currencies ──────────────────────────────────────────────────────────
export function __devAddTokens(amountLog10: number) {
  const s = useGame.getState();
  const next = D(s.run.tokens).add(D(10).pow(amountLog10));
  useGame.setState({ run: { ...s.run, tokens: next.toString() } });
}

export function __devAddCapital(amountLog10: number) {
  const s = useGame.getState();
  const next = D(s.run.capital).add(D(10).pow(amountLog10));
  useGame.setState({ run: { ...s.run, capital: next.toString() } });
}

export function __devAddEquity(n: number) {
  const s = useGame.getState();
  const next = D(s.persistent.equity).add(n);
  useGame.setState({
    persistent: { ...s.persistent, equity: next.toString() },
  });
}

/**
 * Set tokens to just above the current round's effective threshold so the
 * CLOSE ROUND button lights up immediately. Honors Hype-derived discount, so
 * if the player has been spending on Marketing the cheat respects it.
 */
export function __devFillRoundThreshold() {
  const s = useGame.getState();
  const eff = effectiveRoundThreshold(s.run.fundingRoundIdx, s.run.hype);
  // Bump 0.1% above the threshold so floating-point comparisons never reject
  // the value as "not quite there." Cheap insurance, invisible to the player.
  const target = eff.mul(1.001);
  useGame.setState({
    run: { ...s.run, tokens: target.toString() },
  });
}

// ─── Rounds ──────────────────────────────────────────────────────────────
/**
 * Skip to a specific funding round. Resets the run (producers, tokens,
 * capital, allocation) — basically a prestige without earning Equity. Use
 * this to test late-game UX without grinding intermediate rounds.
 */
export function __devJumpToRound(roundIdx: number) {
  const s = useGame.getState();
  const fresh = freshRunState();
  useGame.setState({
    run: {
      ...fresh,
      fundingRoundIdx: roundIdx,
      // Keep the player's allocation preference so the new round feels live.
      allocation: s.run.allocation,
    },
  });
}

// ─── Vignettes ───────────────────────────────────────────────────────────
export function __devUnlockAllVignettes() {
  const s = useGame.getState();
  const allIds = VIGNETTES.map((v) => v.id);
  // Mark as unlocked + unread so the inbox lights up. Don't touch resolved —
  // that's a separate concern (player still gets to pick replies).
  useGame.setState({
    persistent: {
      ...s.persistent,
      unlockedVignettes: allIds,
      unreadVignettes: allIds.filter(
        (id) => !(id in s.persistent.resolvedVignettes),
      ),
    },
  });
}

export function __devResetVignetteResolutions() {
  const s = useGame.getState();
  useGame.setState({
    persistent: { ...s.persistent, resolvedVignettes: {} },
  });
}

// ─── Research ────────────────────────────────────────────────────────────
export function __devUnlockAllResearch() {
  const s = useGame.getState();
  useGame.setState({
    persistent: {
      ...s.persistent,
      unlockedResearch: RESEARCH_NODES.map((n) => n.id),
    },
  });
}

// ─── Notifications ──────────────────────────────────────────────────────
/**
 * Fire a personalized re-engagement notification 5 seconds from now. Used
 * to QA the wording (uses the same `buildReengagementBody` the production
 * 22h-delay scheduler uses, so what you see in dev is what the player will
 * see). Requests permission first if not already granted — silent no-op
 * if the user declines.
 */
export async function __devSendTestPush() {
  const { requestPushPermission, buildReengagementBody } = await import("./notifications");
  const granted = await requestPushPermission();
  if (!granted) {
    // eslint-disable-next-line no-console
    console.warn("[dev] push permission denied — can't show test notification");
    return;
  }
  const state = useGame.getState();
  const { title, body } = buildReengagementBody(state);
  try {
    const N = require("expo-notifications") as typeof import("expo-notifications");
    // Install foreground handler so we see the notification even if the app
    // is in the foreground (iOS swallows otherwise — this is the most
    // common silent failure in dev testing).
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      } as never),
    });
    // SDK 54 requires the explicit `type: 'timeInterval'` discriminant on
    // the trigger — the old { seconds, repeats } shape silently no-ops.
    await N.scheduleNotificationAsync({
      content: { title, body, sound: false },
      trigger: { type: "timeInterval", seconds: 5, repeats: false } as never,
    });
    // eslint-disable-next-line no-console
    console.log(`[dev] push scheduled — fires in 5s with: ${title}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[dev] failed to schedule:", e);
  }
}

// ─── Onboarding ──────────────────────────────────────────────────────────
/**
 * Replay the first-launch flow: IntroModal + the 3 tooltips. Useful for
 * tweaking copy without wiping the whole save.
 */
export function __devReplayIntro() {
  const s = useGame.getState();
  useGame.setState({
    account: { ...s.account, onboardingStep: 0 },
  });
}

// ─── Save ────────────────────────────────────────────────────────────────
/**
 * Nuclear option — clear local save and rehydrate a fresh one. Used for
 * "what does the first-run experience look like" testing. Synchronous from
 * the UI's perspective; the wipe-from-disk happens in the background.
 */
export async function __devWipeSave() {
  await wipeSave().catch(() => { /* best effort */ });
  const fresh = freshSave();
  useGame.getState().hydrate(fresh);
}
