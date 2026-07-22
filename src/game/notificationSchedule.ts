// Pure scheduling math for the re-engagement notification queue. Kept in
// its own module so vitest can exercise it without pulling in react-native
// (whose Flow-syntax entry point rolldown refuses to parse).

export const QUIET_START_HOUR = 22; // 10pm local
export const QUIET_END_HOUR = 8;    //  8am local
// Minimum gap between consecutive slots after quiet-hour shifts. The
// original bug: two slots whose base times both landed inside quiet hours
// each got shifted to 09:00, delivering as one thump.
export const MIN_GAP_SEC = 4 * 3600;

/**
 * Compute the fire-delay for every slot in one pass so quiet-hour shifts
 * don't collapse multiple slots into the same 09:00 wake-up. Two invariants:
 *   1. No slot fires inside 22:00-08:00 local (shifted to 09:00 that morning).
 *   2. Consecutive slots stay at least MIN_GAP_SEC apart — if quiet-shifting
 *      would land a slot on top of (or earlier than) its predecessor, we
 *      push it forward by MIN_GAP_SEC.
 * Preserves monotonic ordering so the queue still reads as a story.
 */
export function computeRespectfulSchedule(baseDelaysSec: number[]): number[] {
  const now = Date.now();
  const out: number[] = [];
  for (let i = 0; i < baseDelaysSec.length; i++) {
    let delay = shiftPastQuietHours(baseDelaysSec[i], now);
    const prev = i > 0 ? out[i - 1] : -Infinity;
    if (delay - prev < MIN_GAP_SEC) {
      delay = shiftPastQuietHours(prev + MIN_GAP_SEC, now);
      if (delay - prev < MIN_GAP_SEC) delay = prev + MIN_GAP_SEC;
    }
    out.push(delay);
  }
  return out;
}

export function shiftPastQuietHours(delaySec: number, now: number): number {
  const fireTime = new Date(now + delaySec * 1000);
  const h = fireTime.getHours();
  if (h >= QUIET_START_HOUR || h < QUIET_END_HOUR) {
    const target = new Date(fireTime);
    if (h >= QUIET_START_HOUR) target.setDate(target.getDate() + 1);
    target.setHours(9, 0, 0, 0);
    return Math.max(60, Math.floor((target.getTime() - now) / 1000));
  }
  return delaySec;
}
