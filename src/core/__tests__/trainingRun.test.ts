import { describe, expect, it } from "vitest";
import { D } from "../decimal";
import { aggregateActiveEffects, pruneExpired } from "../effects";
import {
  effectForTier,
  PITY_THRESHOLD,
  resolveTrainingRun,
  rollTier,
  TIER_PROBS,
  trainingRunCost,
} from "../trainingRun";
import { ActiveEffectSerialized } from "../types";

describe("trainingRunCost", () => {
  it("is one-tenth of the round threshold", () => {
    expect(trainingRunCost(D(1000)).toNumber()).toBe(100);
    expect(trainingRunCost(D(1e6)).toNumber()).toBe(1e5);
  });
});

describe("rollTier", () => {
  it("returns Failed when rng=0 (start of Failed bucket)", () => {
    expect(rollTier(() => 0)).toBe("Failed");
  });
  it("returns Breakthrough when rng=0.999", () => {
    expect(rollTier(() => 0.999)).toBe("Breakthrough");
  });
  it("buckets line up with weights", () => {
    const w = TIER_PROBS.reduce((a, t) => a + t.weight, 0);
    expect(w).toBeCloseTo(1.0, 9);
  });
});

describe("resolveTrainingRun pity", () => {
  it("pity at threshold guarantees Breakthrough", () => {
    const r = resolveTrainingRun(PITY_THRESHOLD, () => 0); // rng would say Failed
    expect(r.tier).toBe("Breakthrough");
    expect(r.pityFired).toBe(true);
    expect(r.nextPity).toBe(0);
  });

  it("pity 0 with rng=0.99 yields Breakthrough naturally", () => {
    const r = resolveTrainingRun(0, () => 0.99);
    expect(r.tier).toBe("Breakthrough");
    expect(r.pityFired).toBe(false);
    expect(r.nextPity).toBe(0);
  });

  it("non-Breakthrough increments pity by 1", () => {
    const r = resolveTrainingRun(7, () => 0); // Failed
    expect(r.tier).toBe("Failed");
    expect(r.nextPity).toBe(8);
  });

  it("Monte Carlo: mean pity-streak before forced Breakthrough is ≤ 50", () => {
    // Deterministic-ish stream
    let seed = 1;
    const rng = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    let pity = 0;
    let runs = 0;
    let totalToBreakthrough = 0;
    let bursts = 0;
    while (bursts < 200) {
      const r = resolveTrainingRun(pity, rng);
      pity = r.nextPity;
      runs++;
      if (r.tier === "Breakthrough") {
        totalToBreakthrough += runs;
        runs = 0;
        bursts++;
      }
    }
    const mean = totalToBreakthrough / bursts;
    expect(mean).toBeLessThanOrEqual(PITY_THRESHOLD);
    // Per GDD §9: ~32 mean with the 2% base rate + pity at 50.
    expect(mean).toBeGreaterThan(15);
  });
});

describe("effectForTier", () => {
  it("Failed yields no effect", () => {
    expect(effectForTier("Failed", 0, "x")).toBe(null);
  });
  it("Breakthrough has the strongest tokens_mult", () => {
    const e = effectForTier("Breakthrough", 0, "x");
    expect(e).not.toBeNull();
    expect(e!.effect).toEqual({ type: "tokens_mult", value: 1.50 });
  });
  it("SOTA effect lasts longer than Marginal", () => {
    const m = effectForTier("Marginal", 0, "x")!;
    const s = effectForTier("SOTA", 0, "x")!;
    expect(s.expiresAt).toBeGreaterThan(m.expiresAt);
  });
});

describe("active-effects aggregator + prune", () => {
  const tokenMult: ActiveEffectSerialized = {
    id: "a", source: "training_run", label: "x",
    appliedAt: 0, expiresAt: 1000,
    effect: { type: "tokens_mult", value: 1.5 },
  };
  const capMult: ActiveEffectSerialized = {
    id: "b", source: "training_run", label: "y",
    appliedAt: 0, expiresAt: 1000,
    effect: { type: "capital_mult", value: 1.2 },
  };
  const expired: ActiveEffectSerialized = {
    id: "c", source: "training_run", label: "z",
    appliedAt: 0, expiresAt: 100,
    effect: { type: "tokens_mult", value: 2.0 },
  };

  it("aggregates live multipliers", () => {
    const e = aggregateActiveEffects([tokenMult, capMult], 500);
    expect(e.tokensMult).toBeCloseTo(1.5, 9);
    expect(e.capitalMult).toBeCloseTo(1.2, 9);
  });

  it("ignores expired effects when aggregating", () => {
    const e = aggregateActiveEffects([tokenMult, expired], 500);
    expect(e.tokensMult).toBeCloseTo(1.5, 9); // expired (2.0) skipped
  });

  it("two same-type effects stack multiplicatively", () => {
    const e = aggregateActiveEffects(
      [tokenMult, { ...tokenMult, id: "a2", effect: { type: "tokens_mult", value: 1.2 } }],
      500
    );
    expect(e.tokensMult).toBeCloseTo(1.5 * 1.2, 9);
  });

  it("pruneExpired drops past-expiry effects", () => {
    const out = pruneExpired([tokenMult, expired, capMult], 500);
    expect(out.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });
});
