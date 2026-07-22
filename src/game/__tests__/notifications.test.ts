import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeRespectfulSchedule } from "../notificationSchedule";

const BASE_SLOTS = [5 * 3600, 10 * 3600, 15 * 3600, 20 * 3600];
const MIN_GAP = 4 * 3600;

function atLocalHour(h: number): number {
  const d = new Date();
  d.setHours(h, 0, 0, 0);
  return d.getTime();
}

function firesAtHour(delaySec: number, nowMs: number): number {
  return new Date(nowMs + delaySec * 1000).getHours();
}

describe("computeRespectfulSchedule", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps all slots outside 22:00-08:00 quiet window", () => {
    // Iterate every background hour of the day — no slot may fire in quiet hours.
    for (let bgHour = 0; bgHour < 24; bgHour++) {
      const now = atLocalHour(bgHour);
      vi.setSystemTime(now);
      const delays = computeRespectfulSchedule(BASE_SLOTS);
      for (const d of delays) {
        const h = firesAtHour(d, now);
        expect(h, `bgHour=${bgHour} slotFireHour=${h}`).toBeGreaterThanOrEqual(8);
        expect(h, `bgHour=${bgHour} slotFireHour=${h}`).toBeLessThan(22);
      }
    }
  });

  it("never collapses two slots to the same fire time", () => {
    // The original bug: backgrounding at 20:00 pushed slot-0 (01:00) and
    // slot-1 (06:00) both into 09:00 → three pings arrived simultaneously.
    for (let bgHour = 0; bgHour < 24; bgHour++) {
      const now = atLocalHour(bgHour);
      vi.setSystemTime(now);
      const delays = computeRespectfulSchedule(BASE_SLOTS);
      for (let i = 1; i < delays.length; i++) {
        expect(
          delays[i] - delays[i - 1],
          `bgHour=${bgHour} slot${i - 1}→${i} gap=${delays[i] - delays[i - 1]}`,
        ).toBeGreaterThanOrEqual(MIN_GAP);
      }
    }
  });

  it("preserves original schedule when no slots hit quiet hours", () => {
    // Background at 09:00 → slots at 14/19/24/29 — only slot-2 (00:00) and
    // slot-3 (05:00) hit quiet. First two stay on their base delays.
    vi.setSystemTime(atLocalHour(9));
    const delays = computeRespectfulSchedule(BASE_SLOTS);
    expect(delays[0]).toBe(BASE_SLOTS[0]);
    expect(delays[1]).toBe(BASE_SLOTS[1]);
  });
});
