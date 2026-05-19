import { describe, expect, it } from "vitest";
import { D } from "../decimal";
import {
  activeEffectForDebtEvent,
  DEBT_EVENTS,
  detectThresholdsCrossed,
  getDebtEvent,
} from "../debtEvents";
import { freshRunState, tickRun } from "../math";
import { Allocation, PersistentState, RunState } from "../types";

const persistent = (overrides: Partial<PersistentState> = {}): PersistentState => ({
  equity: D(0).toString(),
  totalPrestiges: 0,
  alignmentDebt: D(0).toString(),
  unlockedResearch: [],
  firedDebtThresholds: [],
  ...overrides,
});

describe("detectThresholdsCrossed", () => {
  it("returns nothing on debt going down", () => {
    expect(detectThresholdsCrossed(100, 50, [])).toEqual([]);
  });

  it("crossing 10 upward fires threshold 10", () => {
    expect(detectThresholdsCrossed(5, 12, [])).toEqual([10]);
  });

  it("jumping past multiple thresholds in one step fires all of them", () => {
    expect(detectThresholdsCrossed(5, 75, [])).toEqual([10, 25, 50]);
  });

  it("already-fired thresholds are skipped", () => {
    expect(detectThresholdsCrossed(5, 60, [10, 25])).toEqual([50]);
  });

  it("crossing exact threshold value counts (>=)", () => {
    expect(detectThresholdsCrossed(9.99, 10, [])).toEqual([10]);
  });

  it("re-crossing after pay-down does NOT re-fire (bell can't be unrung)", () => {
    // First crossing fires 10
    expect(detectThresholdsCrossed(5, 15, [])).toEqual([10]);
    // After pay-down to 8 and re-accrual to 15, with 10 already in firedThresholds:
    expect(detectThresholdsCrossed(8, 15, [10])).toEqual([]);
  });
});

describe("debt events data integrity", () => {
  it("thresholds are sorted ascending", () => {
    for (let i = 1; i < DEBT_EVENTS.length; i++) {
      expect(DEBT_EVENTS[i].threshold).toBeGreaterThan(DEBT_EVENTS[i - 1].threshold);
    }
  });

  it("getDebtEvent returns the matching event", () => {
    expect(getDebtEvent(10)!.title).toBe("PR Crisis");
    expect(getDebtEvent(400)!.title).toBe("Existential Event");
    expect(getDebtEvent(999)).toBeUndefined();
  });

  it("every event has either a tokensMult or capitalMult", () => {
    for (const e of DEBT_EVENTS) {
      expect(e.tokensMult !== undefined || e.capitalMult !== undefined).toBe(true);
    }
  });

  it("Mass User Departure (100) halts Capital chain", () => {
    expect(getDebtEvent(100)!.capitalMult).toBe(0);
  });
});

describe("activeEffectForDebtEvent", () => {
  it("PR Crisis builds a tokens_mult active effect", () => {
    const ev = getDebtEvent(10)!;
    const eff = activeEffectForDebtEvent(ev, 1000);
    expect(eff!.source).toBe("alignment_debt");
    expect(eff!.effect).toEqual({ type: "tokens_mult", value: 0.85 });
    expect(eff!.expiresAt).toBe(1000 + 6 * 3600 * 1000);
  });

  it("Mass User Departure builds a capital_mult active effect", () => {
    const ev = getDebtEvent(100)!;
    const eff = activeEffectForDebtEvent(ev, 0);
    expect(eff!.effect).toEqual({ type: "capital_mult", value: 0 });
  });
});

describe("tickRun threshold integration", () => {
  // Heavy Safety neglect: 0% Safety so debt accrues at max rate.
  const NEGLECTFUL: Allocation = { rd: 0, product: 1, marketing: 0, safety: 0 };
  const baseRun = (): RunState => ({
    ...freshRunState(),
    allocation: NEGLECTFUL,
  });

  it("first threshold (10) fires when debt crosses 10 from below", () => {
    // 4 hours @ debt accrual 2.5/h ⇒ 10 exactly.
    const r = tickRun(baseRun(), persistent(), 4 * 3600);
    expect(r.firedThresholds).toEqual([10]);
    expect(r.persistent.firedDebtThresholds).toEqual([10]);
    // Active effect should now be in the run.
    expect(r.run.activeEffects.length).toBe(1);
    expect(r.run.activeEffects[0]?.effect).toEqual({ type: "tokens_mult", value: 0.85 });
  });

  it("threshold doesn't fire twice across two consecutive ticks", () => {
    const r1 = tickRun(baseRun(), persistent(), 4 * 3600);
    // Next tick — debt keeps climbing but no new threshold yet (25 is next).
    const r2 = tickRun(r1.run, r1.persistent, 1 * 3600);
    expect(r2.firedThresholds).toEqual([]);
    expect(r2.persistent.firedDebtThresholds).toEqual([10]);
  });

  it("paying debt back below 10 then re-crossing does NOT re-fire", () => {
    // First, cross 10.
    const r1 = tickRun(baseRun(), persistent(), 4 * 3600);
    expect(r1.firedThresholds).toEqual([10]);
    // Now switch to all-Safety to pay debt down.
    const payRun: RunState = { ...r1.run, allocation: { rd: 0, product: 0, marketing: 0, safety: 1 } };
    // 5h of pay-down at -22.5/h would overshoot zero, capped at 0.
    const r2 = tickRun(payRun, r1.persistent, 5 * 3600);
    expect(D(r2.persistent.alignmentDebt).toNumber()).toBe(0);
    // Now re-accrue back past 10.
    const r3 = tickRun({ ...r2.run, allocation: NEGLECTFUL }, r2.persistent, 5 * 3600);
    expect(r3.firedThresholds).toEqual([]); // bell can't be re-rung
  });

  it("debt that explodes from 0 → 60 in one tick fires three thresholds at once", () => {
    // Build a fake jump by hand: prev debt 0, then directly set new debt to 60.
    // Easiest path: long dt at high accrual. 24h × 2.5/h = 60.
    const r = tickRun(baseRun(), persistent(), 24 * 3600);
    expect(r.firedThresholds).toEqual([10, 25, 50]);
    // All three active effects should now be on the run.
    expect(r.run.activeEffects.length).toBe(3);
  });
});
