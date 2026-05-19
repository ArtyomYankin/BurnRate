import { describe, expect, it } from "vitest";
import { D } from "../decimal";
import {
  allChainSupplies,
  bottleneckChain,
  buyProducer,
  canPrestige,
  chainSupply,
  debtRatePerSec,
  DEFAULT_ALLOCATION,
  engineerMultiplier,
  ENGINEER_SCALING_EXPONENT,
  equityFromPrestige,
  freshRunState,
  nextProducerCost,
  normalizeAllocation,
  producerBatchCost,
  tickRun,
  tokensPerSec,
  upgradeMultiplier,
  upgradeTier,
} from "../math";
import { PRODUCER_BY_ID } from "../producers";
import { Allocation, PersistentState, RunState } from "../types";

const close = (actual: ReturnType<typeof D>, expected: number, eps = 1e-6) => {
  const diff = actual.sub(expected).abs().toNumber();
  expect(diff).toBeLessThan(eps * Math.max(1, Math.abs(expected)));
};

// Test fixtures
function withOwned(
  owned: Record<string, number>,
  allocation: Allocation = DEFAULT_ALLOCATION
): RunState {
  return {
    fundingRoundIdx: 0,
    tokens: D(0).toString(),
    capital: D(0).toString(),
    hype: D(0).toString(),
    researchPoints: D(0).toString(),
    allocation,
    producersOwned: owned,
    activeEffects: [],
    trainingPity: 0,
  };
}
const balanced1 = (): RunState =>
  withOwned({ intern: 1, single_h100: 1, common_crawl: 1, office_grid: 1 });

const freshPersistent = (debt = 0): PersistentState => ({
  equity: D(0).toString(),
  totalPrestiges: 0,
  alignmentDebt: D(debt).toString(),
  unlockedResearch: [],
  firedDebtThresholds: [],
});

describe("producer cost math", () => {
  it("next cost matches base when 0 owned", () => {
    expect(nextProducerCost(PRODUCER_BY_ID["intern"], 0).toNumber()).toBe(15);
  });

  it("next cost scales by mult^owned", () => {
    const intern = PRODUCER_BY_ID["intern"]; // base 15, mult 1.07
    close(nextProducerCost(intern, 10), 15 * Math.pow(1.07, 10));
  });

  it("batch cost is a geometric series — buying 5 from 0", () => {
    const intern = PRODUCER_BY_ID["intern"]; // 15, 1.07
    let expected = 0;
    for (let k = 0; k < 5; k++) expected += 15 * Math.pow(1.07, k);
    close(producerBatchCost(intern, 0, 5), expected);
  });

  it("batch cost equals sum of nextCost calls — buying 7 from 12", () => {
    const def = PRODUCER_BY_ID["new_grad"]; // 100, 1.07
    let expected = 0;
    for (let k = 0; k < 7; k++) expected += 100 * Math.pow(1.07, 12 + k);
    close(producerBatchCost(def, 12, 7), expected, 1e-5);
  });
});

describe("chain supply", () => {
  it("zero producers in a chain => zero supply", () => {
    const s = withOwned({});
    expect(chainSupply("engineers", s).toNumber()).toBe(0);
    expect(chainSupply("gpu", s).toNumber()).toBe(0);
  });

  it("supply sums tier output * owned (sub-threshold, no upgrade)", () => {
    // 5 Interns @ 0.10 + 2 New Grads @ 1.00 = 0.5 + 2.0 = 2.5; both < 10 owned
    const s = withOwned({ intern: 5, new_grad: 2 });
    expect(chainSupply("engineers", s).toNumber()).toBeCloseTo(2.5, 9);
  });

  it("allChainSupplies returns all four chains", () => {
    const sup = allChainSupplies(balanced1());
    expect(sup.engineers.toNumber()).toBeCloseTo(0.10, 9);
    expect(sup.gpu.toNumber()).toBeCloseTo(0.30, 9);
    expect(sup.data.toNumber()).toBeCloseTo(0.20, 9);
    expect(sup.energy.toNumber()).toBeCloseTo(0.15, 9);
  });
});

describe("upgrade tiers (GDD §6)", () => {
  it("multiplier ladder is x1 / x2 / x8 / x64", () => {
    expect(upgradeMultiplier(0)).toBe(1);
    expect(upgradeMultiplier(9)).toBe(1);
    expect(upgradeMultiplier(10)).toBe(2);
    expect(upgradeMultiplier(49)).toBe(2);
    expect(upgradeMultiplier(50)).toBe(8);  // x2 * x4
    expect(upgradeMultiplier(99)).toBe(8);
    expect(upgradeMultiplier(100)).toBe(64); // x2 * x4 * x8
    expect(upgradeMultiplier(1000)).toBe(64);
  });

  it("tier index is 0/1/2/3", () => {
    expect(upgradeTier(0)).toBe(0);
    expect(upgradeTier(10)).toBe(1);
    expect(upgradeTier(50)).toBe(2);
    expect(upgradeTier(100)).toBe(3);
  });

  it("chainSupply applies the multiplier — 10 Interns => 0.10 * 10 * 2 = 2.0", () => {
    const s = withOwned({ intern: 10 });
    expect(chainSupply("engineers", s).toNumber()).toBeCloseTo(2.0, 9);
  });

  it("chainSupply applies x64 at 100 owned — 100 Interns => 640", () => {
    const s = withOwned({ intern: 100 });
    expect(chainSupply("engineers", s).toNumber()).toBeCloseTo(640, 6);
  });

  it("multipliers stack per-tier independently — 10 Interns + 10 New Grads", () => {
    // 10 Interns * x2 * 0.10 = 2.0; 10 New Grads * x2 * 1.00 = 20.0; total 22.0
    const s = withOwned({ intern: 10, new_grad: 10 });
    expect(chainSupply("engineers", s).toNumber()).toBeCloseTo(22, 6);
  });
});

describe("Liebig pipeline (GDD §7)", () => {
  it("zero engineers => zero tokens (engineers are a required multiplier)", () => {
    const s = withOwned({ single_h100: 10, common_crawl: 10, office_grid: 10 });
    expect(tokensPerSec(s).toNumber()).toBe(0);
  });

  it("any of gpu/data/energy at zero => zero tokens (min bottleneck)", () => {
    // missing data
    const s = withOwned({ intern: 10, single_h100: 10, office_grid: 10 });
    expect(tokensPerSec(s).toNumber()).toBe(0);
  });

  it("balanced lowest-tier yields min × engineerMultiplier(eng_supply)", () => {
    const s = balanced1();
    // engineer side uses ^ENGINEER_SCALING_EXPONENT, not sqrt
    const expected = 0.15 * Math.pow(0.10, ENGINEER_SCALING_EXPONENT);
    expect(tokensPerSec(s).toNumber()).toBeCloseTo(expected, 9);
  });

  it("doubling all four chains scales tokens by 2 × 2^ENG_EXPONENT", () => {
    // min scales linearly (2x); engineers scale via pow(2, ENGINEER_SCALING_EXPONENT).
    const s1 = balanced1();
    const s2 = withOwned({ intern: 2, single_h100: 2, common_crawl: 2, office_grid: 2 });
    const ratio = tokensPerSec(s2).div(tokensPerSec(s1)).toNumber();
    expect(ratio).toBeCloseTo(2 * Math.pow(2, ENGINEER_SCALING_EXPONENT), 6);
  });

  it("Fig 7.1 — bottleneck on Data caps tokens at Data × engineerMultiplier(eng)", () => {
    // 100 of every chain EXCEPT data (only 1). At 100 owned the x64 upgrade
    // multiplier kicks in for the other three; Data has < 10 so x1.
    //   eng = 100 * 0.10 * 64 = 640
    //   gpu = 100 * 0.30 * 64 = 1920
    //   data = 1 * 0.20 * 1 = 0.20  <-- bottleneck
    //   energy = 100 * 0.15 * 64 = 960
    const s = withOwned({
      intern: 100,
      single_h100: 100,
      common_crawl: 1,
      office_grid: 100,
    });
    const expected = 0.2 * engineerMultiplier(D(640)).toNumber();
    expect(tokensPerSec(s).toNumber()).toBeCloseTo(expected, 4);
  });

  it("engineerMultiplier follows ENGINEER_SCALING_EXPONENT", () => {
    expect(engineerMultiplier(D(0)).toNumber()).toBe(0);
    expect(engineerMultiplier(D(1)).toNumber()).toBeCloseTo(1, 9);
    expect(engineerMultiplier(D(10)).toNumber()).toBeCloseTo(
      Math.pow(10, ENGINEER_SCALING_EXPONENT),
      6
    );
  });

  it("research tokensMult scales tokens linearly", () => {
    const s = balanced1();
    const base = tokensPerSec(s).toNumber();
    const boosted = tokensPerSec(s, {
      tokensMult: 2.5,
      chainSupplyMult: { engineers: 1, gpu: 1, data: 1, energy: 1 },
      debtAccrualMult: 1,
      capitalMult: 1,
      hypeMult: 1,
      rpMult: 1,
    }).toNumber();
    expect(boosted).toBeCloseTo(base * 2.5, 9);
  });
});

describe("bottleneckChain", () => {
  it("returns the chain with the smallest supply among gpu/data/energy", () => {
    const s = withOwned({ intern: 5, single_h100: 5, common_crawl: 1, office_grid: 5 });
    expect(bottleneckChain(s)).toBe("data");
  });

  it("returns 'engineers' when engineers are zero (stalls all production)", () => {
    const s = withOwned({ single_h100: 5, common_crawl: 5, office_grid: 5 });
    expect(bottleneckChain(s)).toBe("engineers");
  });
});

describe("tickRun production", () => {
  it("tick accumulates tokens at Liebig rate * dt", () => {
    const s0 = balanced1();
    const rate = tokensPerSec(s0).toNumber();
    const r = tickRun(s0, freshPersistent(), 60);
    expect(D(r.run.tokens).toNumber()).toBeCloseTo(rate * 60, 6);
  });

  it("Capital tracks Product allocation share of produced tokens", () => {
    const s0 = balanced1();
    const r = tickRun(s0, freshPersistent(), 60);
    // Default allocation: product = 0.60; CAPITAL_PER_TOKEN = 1.0.
    expect(D(r.run.capital).toNumber()).toBeCloseTo(
      D(r.run.tokens).toNumber() * 0.60,
      6
    );
  });

  it("zero-rate state stays still — token/capital/hype/RP unchanged", () => {
    const s0 = withOwned({ intern: 1 }); // no gpu/data/energy
    const r = tickRun(s0, freshPersistent(), 600);
    expect(D(r.run.tokens).toNumber()).toBe(0);
    expect(D(r.run.capital).toNumber()).toBe(0);
    expect(D(r.run.hype).toNumber()).toBe(0);
    expect(D(r.run.researchPoints).toNumber()).toBe(0);
  });
});

describe("buyProducer", () => {
  it("refuses when capital is insufficient", () => {
    const s0 = freshRunState();
    const r = buyProducer(s0, "new_grad", 1); // costs 100, have 0
    expect(r.bought).toBe(0);
    expect(r.run).toBe(s0);
  });

  it("buys when capital covers cost and deducts exactly", () => {
    const s0 = { ...freshRunState(), capital: D(500).toString() };
    const r = buyProducer(s0, "new_grad", 1);
    expect(r.bought).toBe(1);
    expect(r.run.producersOwned["new_grad"]).toBe(1);
    expect(D(r.run.capital).toNumber()).toBeCloseTo(400, 9);
  });

  it("batch buy deducts geometric-series total", () => {
    const s0 = { ...freshRunState(), capital: D(1e9).toString() };
    const r = buyProducer(s0, "new_grad", 10);
    expect(r.bought).toBe(10);
    let expectedCost = 0;
    for (let k = 0; k < 10; k++) expectedCost += 100 * Math.pow(1.07, k);
    expect(r.spent.toNumber()).toBeCloseTo(expectedCost, 4);
  });
});

describe("Allocate beat (GDD §4 Beat 2 + §9)", () => {
  it("default allocation sums to 1.0", () => {
    const a = DEFAULT_ALLOCATION;
    expect(a.rd + a.product + a.marketing + a.safety).toBeCloseTo(1.0, 9);
  });

  it("normalizeAllocation renormalizes a malformed input", () => {
    const n = normalizeAllocation({ rd: 1, product: 1, marketing: 1, safety: 1 });
    expect(n.rd).toBeCloseTo(0.25, 9);
    expect(n.rd + n.product + n.marketing + n.safety).toBeCloseTo(1.0, 9);
  });

  it("derivative currencies scale with allocation share", () => {
    const s0 = withOwned(
      { intern: 5, single_h100: 5, common_crawl: 5, office_grid: 5 },
      { rd: 0.10, product: 0.60, marketing: 0.15, safety: 0.15 }
    );
    const r = tickRun(s0, freshPersistent(), 60);
    const tokens = D(r.run.tokens).toNumber();
    // CAPITAL_PER_TOKEN=1.0, HYPE_PER_TOKEN=0.05, RP_PER_TOKEN=0.01
    expect(D(r.run.capital).toNumber()).toBeCloseTo(tokens * 0.60, 6);
    expect(D(r.run.hype).toNumber()).toBeCloseTo(tokens * 0.15 * 0.05, 6);
    expect(D(r.run.researchPoints).toNumber()).toBeCloseTo(tokens * 0.10 * 0.01, 6);
  });

  it("100% Product allocation puts everything into Capital, nothing into Hype/RP", () => {
    const s0 = withOwned(
      { intern: 5, single_h100: 5, common_crawl: 5, office_grid: 5 },
      { rd: 0, product: 1, marketing: 0, safety: 0 }
    );
    const r = tickRun(s0, freshPersistent(), 60);
    expect(D(r.run.capital).toNumber()).toBeCloseTo(D(r.run.tokens).toNumber(), 6);
    expect(D(r.run.hype).toNumber()).toBe(0);
    expect(D(r.run.researchPoints).toNumber()).toBe(0);
  });
});

describe("Alignment Debt economy (GDD §9)", () => {
  it("debtRatePerSec is zero at the 10% safety floor", () => {
    expect(debtRatePerSec(0.10)).toBeCloseTo(0, 12);
  });

  it("debtRatePerSec matches GDD formula at 0% safety: 0.10 * 25 / 3600 per sec", () => {
    expect(debtRatePerSec(0)).toBeCloseTo((0.10 * 25) / 3600, 12);
  });

  it("debtRatePerSec is negative above 10% safety (pay-down)", () => {
    expect(debtRatePerSec(0.25)).toBeLessThan(0);
  });

  it("debt accumulates linearly when Safety=0", () => {
    const s0 = withOwned(
      { intern: 1, single_h100: 1, common_crawl: 1, office_grid: 1 },
      { rd: 0.50, product: 0.50, marketing: 0, safety: 0 }
    );
    const r = tickRun(s0, freshPersistent(), 3600); // 1 hour
    // 0.10 * 25 = 2.5 debt/hour at safety=0
    expect(D(r.persistent.alignmentDebt).toNumber()).toBeCloseTo(2.5, 4);
  });

  it("debt pays down when Safety > 10%, floored at zero", () => {
    const s0 = withOwned(
      { intern: 1, single_h100: 1, common_crawl: 1, office_grid: 1 },
      { rd: 0, product: 0, marketing: 0, safety: 1.0 } // all-Safety
    );
    // Start with 10 units of debt, run for 10 hours — should drive to zero.
    const r = tickRun(s0, freshPersistent(10), 10 * 3600);
    expect(D(r.persistent.alignmentDebt).toNumber()).toBe(0);
  });

  it("debt cannot go negative even with sustained over-Safety", () => {
    const s0 = withOwned({}, { rd: 0, product: 0, marketing: 0, safety: 1.0 });
    const r = tickRun(s0, freshPersistent(0), 10000);
    expect(D(r.persistent.alignmentDebt).toNumber()).toBe(0);
  });
});

describe("freshRunState", () => {
  it("starts with asymmetric tier-0 counts: 1 Engineer, 3 of each flow chain", () => {
    const s = freshRunState();
    expect(s.producersOwned["intern"]).toBe(1);
    expect(s.producersOwned["single_h100"]).toBe(3);
    expect(s.producersOwned["common_crawl"]).toBe(3);
    expect(s.producersOwned["office_grid"]).toBe(3);
  });

  it("starting tokens/sec is non-zero and playable", () => {
    const s = freshRunState();
    // supplies: {eng: 0.10, gpu: 0.90, data: 0.60, energy: 0.45}
    // min(0.90, 0.60, 0.45) × engMult(0.10) = 0.45 × 0.10^0.8 ≈ 0.0714
    const expected = 0.45 * Math.pow(0.10, ENGINEER_SCALING_EXPONENT);
    expect(tokensPerSec(s).toNumber()).toBeCloseTo(expected, 6);
  });

  it("buying 1 more Intern outperforms buying 1 more Office Grid at start (Engineer ROI window)", () => {
    const s = freshRunState();
    const baseRate = tokensPerSec(s).toNumber();
    const withExtraIntern = tokensPerSec({
      ...s,
      producersOwned: { ...s.producersOwned, intern: 2 },
    }).toNumber();
    const withExtraOffice = tokensPerSec({
      ...s,
      producersOwned: { ...s.producersOwned, office_grid: 4 },
    }).toNumber();
    // The starter is tuned so the first Engineer purchase is the highest-ROI
    // move. Once eng_supply grows past ~0.44 × min, Office Grid takes over.
    expect(withExtraIntern - baseRate).toBeGreaterThan(withExtraOffice - baseRate);
  });
});

describe("prestige math", () => {
  it("Seed threshold is 1e3 tokens", () => {
    const s0 = { ...freshRunState(), tokens: D(999).toString() };
    expect(canPrestige(s0)).toBe(false);
    const s1 = { ...s0, tokens: D(1000).toString() };
    expect(canPrestige(s1)).toBe(true);
  });

  it("Equity at exactly Seed threshold (x1.0 mult) is 150", () => {
    const s = { ...freshRunState(), tokens: D(1000).toString() };
    expect(equityFromPrestige(s).toNumber()).toBe(150);
  });

  it("Equity scales as sqrt(tokens/threshold)", () => {
    const s = { ...freshRunState(), tokens: D(4000).toString() };
    expect(equityFromPrestige(s).toNumber()).toBe(300);
  });

  it("Series A multiplier kicks in (x1.5)", () => {
    const s = {
      ...freshRunState(),
      fundingRoundIdx: 1,
      tokens: D(1e6).toString(),
    };
    expect(equityFromPrestige(s).toNumber()).toBe(225);
  });
});
