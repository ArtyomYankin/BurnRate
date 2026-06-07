import { describe, expect, it } from "vitest";
import { D } from "../decimal";
import {
  agiArcDebtMultiplier,
  allChainSupplies,
  autonomousAgentMult,
  bottleneckChain,
  buyProducer,
  canPrestige,
  chainSupply,
  debtRatePerSec,
  DEFAULT_ALLOCATION,
  effectiveRoundThreshold,
  engineerMultiplier,
  ENGINEER_SCALING_EXPONENT,
  equityFromPrestige,
  freshRunState,
  hypeThresholdDiscount,
  nextProducerCost,
  normalizeAllocation,
  producerBatchCost,
  tickRun,
  tokensPerSec,
  upgradeMultiplier,
  upgradeTier,
} from "../math";
import { AUTONOMOUS_AGENT, PRODUCER_BY_ID } from "../producers";
import { NO_RESEARCH_EFFECTS } from "../research";
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
    sprintUpgradesUnlocked: [],
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
  unlockedVignettes: [],
  unreadVignettes: [],
  resolvedVignettes: {},
  unlockedAchievements: [],
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

  it("balanced lowest-tier: engineer multiplier is FLOORED at 1.0 below eng_supply 1.0", () => {
    // 1 of each tier-0 → eng_supply 0.10 → raw 0.10^0.8 = 0.158, but the
    // floor lifts it to 1.0. Liebig was softened to 80% min + 20% avg, so:
    //   gpu=0.30, data=0.20, energy=0.15 → min=0.15, avg=0.2167
    //   effectiveFlow = 0.8*0.15 + 0.2*0.2167 = 0.12 + 0.04333 = 0.16333
    const s = balanced1();
    expect(tokensPerSec(s).toNumber()).toBeCloseTo(0.16333, 4);
  });

  it("doubling all four chains while still under the engineer floor scales by min only", () => {
    // balanced1 eng_supply 0.10 (floored→1.0); ×2 → eng_supply 0.20 (still
    // floored→1.0). Engineer part is flat 1.0 in both, so the ratio is just
    // the 2× from the min(flow) side.
    const s1 = balanced1();
    const s2 = withOwned({ intern: 2, single_h100: 2, common_crawl: 2, office_grid: 2 });
    const ratio = tokensPerSec(s2).div(tokensPerSec(s1)).toNumber();
    expect(ratio).toBeCloseTo(2, 6);
  });

  it("above the engineer floor, doubling scales by 2 × 2^ENG_EXPONENT (power curve intact)", () => {
    // Use 20 of each so eng_supply (2.0) is well past the 1.0 floor, where the
    // pure power curve governs. Doubling to 40 each keeps both sides above floor.
    const s1 = withOwned({ intern: 20, single_h100: 20, common_crawl: 20, office_grid: 20 });
    const s2 = withOwned({ intern: 40, single_h100: 40, common_crawl: 40, office_grid: 40 });
    const ratio = tokensPerSec(s2).div(tokensPerSec(s1)).toNumber();
    expect(ratio).toBeCloseTo(2 * Math.pow(2, ENGINEER_SCALING_EXPONENT), 6);
  });

  it("Fig 7.1 — bottleneck on Data still dominates after 80/20 Liebig softening", () => {
    // 100 of every chain EXCEPT data (only 1). At 100 owned the x64 upgrade
    // multiplier kicks in for the other three; Data has < 10 so x1.
    //   eng = 100 * 0.10 * 64 = 640
    //   gpu = 100 * 0.30 * 64 = 1920
    //   data = 1 * 0.20 * 1 = 0.20  <-- bottleneck
    //   energy = 100 * 0.15 * 64 = 960
    // Softened Liebig: effective = 0.8*0.20 + 0.2*((1920+0.20+960)/3) = 0.16 + 192.01 = 192.17
    const s = withOwned({
      intern: 100,
      single_h100: 100,
      common_crawl: 1,
      office_grid: 100,
    });
    const avg = (1920 + 0.2 + 960) / 3;
    const effectiveFlow = 0.8 * 0.2 + 0.2 * avg;
    const expected = effectiveFlow * engineerMultiplier(D(640)).toNumber();
    expect(tokensPerSec(s).toNumber()).toBeCloseTo(expected, 2);
  });

  it("engineerMultiplier follows ENGINEER_SCALING_EXPONENT above the 1.0 floor", () => {
    expect(engineerMultiplier(D(0)).toNumber()).toBe(0); // no engineers ⇒ no tokens
    expect(engineerMultiplier(D(1)).toNumber()).toBeCloseTo(1, 9);
    expect(engineerMultiplier(D(10)).toNumber()).toBeCloseTo(
      Math.pow(10, ENGINEER_SCALING_EXPONENT),
      6
    );
  });

  it("engineerMultiplier floors at 1.0 for positive supply below 1.0", () => {
    // Raw 0.10^0.8 = 0.158 and 0.50^0.8 = 0.574 — both lifted to 1.0.
    expect(engineerMultiplier(D(0.1)).toNumber()).toBe(1);
    expect(engineerMultiplier(D(0.5)).toNumber()).toBe(1);
    // At exactly 1.0 the floor and the curve agree.
    expect(engineerMultiplier(D(1)).toNumber()).toBeCloseTo(1, 9);
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
    // Default allocation: product = 0.60; CAPITAL_PER_TOKEN = 0.5 (halved).
    expect(D(r.run.capital).toNumber()).toBeCloseTo(
      D(r.run.tokens).toNumber() * 0.60 * 0.5,
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

describe("Autonomous Agent (GDD §6 AGI arc)", () => {
  it("no agents ⇒ ×1 multiplier (no-op for the whole pre-AGI game)", () => {
    expect(autonomousAgentMult(balanced1()).toNumber()).toBe(1);
  });

  it("agent multiplier stacks as multPerUnit^owned", () => {
    const s = withOwned({ ...balanced1().producersOwned, [AUTONOMOUS_AGENT.id]: 3 });
    const expected = Math.pow(AUTONOMOUS_AGENT.multPerUnit, 3);
    close(autonomousAgentMult(s), expected, 1e-9);
  });

  it("tokensPerSec scales by the agent multiplier", () => {
    const base = tokensPerSec(balanced1());
    const withAgents = tokensPerSec(
      withOwned({ ...balanced1().producersOwned, [AUTONOMOUS_AGENT.id]: 5 })
    );
    const ratio = withAgents.div(base).toNumber();
    expect(ratio).toBeCloseTo(Math.pow(AUTONOMOUS_AGENT.multPerUnit, 5), 6);
  });

  it("the agent never feeds the chain pipeline (supplies unchanged)", () => {
    const without = allChainSupplies(balanced1());
    const withAgents = allChainSupplies(
      withOwned({ ...balanced1().producersOwned, [AUTONOMOUS_AGENT.id]: 9 })
    );
    expect(withAgents.gpu.toNumber()).toBe(without.gpu.toNumber());
    expect(withAgents.engineers.toNumber()).toBe(without.engineers.toNumber());
  });

  it("buyProducer can purchase the agent via the shared cost path", () => {
    const s0 = { ...freshRunState(), capital: D(AUTONOMOUS_AGENT.baseCostCapital).toString() };
    const r = buyProducer(s0, AUTONOMOUS_AGENT.id, 1);
    expect(r.bought).toBe(1);
    expect(r.run.producersOwned[AUTONOMOUS_AGENT.id]).toBe(1);
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
    // CAPITAL_PER_TOKEN=0.5, HYPE_PER_TOKEN=0.05, RP_PER_TOKEN=0.01
    expect(D(r.run.capital).toNumber()).toBeCloseTo(tokens * 0.60 * 0.5, 6);
    expect(D(r.run.hype).toNumber()).toBeCloseTo(tokens * 0.15 * 0.05, 6);
    expect(D(r.run.researchPoints).toNumber()).toBeCloseTo(tokens * 0.10 * 0.01, 6);
  });

  it("100% Product allocation puts everything into Capital, nothing into Hype/RP", () => {
    const s0 = withOwned(
      { intern: 5, single_h100: 5, common_crawl: 5, office_grid: 5 },
      { rd: 0, product: 1, marketing: 0, safety: 0 }
    );
    const r = tickRun(s0, freshPersistent(), 60);
    // CAPITAL_PER_TOKEN=0.5, so 100% Product → half of tokens.
    expect(D(r.run.capital).toNumber()).toBeCloseTo(D(r.run.tokens).toNumber() * 0.5, 6);
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

describe("AGI-arc debt escalation (GDD §5)", () => {
  it("pre-arc rounds (0-6) have no escalation: ×1", () => {
    expect(agiArcDebtMultiplier(0)).toBe(1);
    expect(agiArcDebtMultiplier(6)).toBe(1);
  });

  it("escalates +0.5/round from Acquisition (7) onward", () => {
    expect(agiArcDebtMultiplier(7)).toBeCloseTo(1.5, 9);
    expect(agiArcDebtMultiplier(8)).toBeCloseTo(2.0, 9);
    expect(agiArcDebtMultiplier(11)).toBeCloseTo(3.5, 9);
  });

  it("debtRatePerSec accrual scales by the arc multiplier", () => {
    const preArc = debtRatePerSec(0, NO_RESEARCH_EFFECTS, 0);
    const inArc = debtRatePerSec(0, NO_RESEARCH_EFFECTS, 7);
    expect(inArc).toBeCloseTo(preArc * 1.5, 12);
  });

  it("pay-down (Safety surplus) is NOT escalated by the arc", () => {
    const preArc = debtRatePerSec(0.5, NO_RESEARCH_EFFECTS, 0);
    const inArc = debtRatePerSec(0.5, NO_RESEARCH_EFFECTS, 11);
    expect(inArc).toBe(preArc);
  });

  it("tickRun in the AGI arc accrues debt faster than pre-arc", () => {
    const alloc = { rd: 0, product: 0, marketing: 0, safety: 0 }; // max neglect
    const preArc = withOwned({}, alloc);
    const inArc = { ...withOwned({}, alloc), fundingRoundIdx: 11 };
    const rPre = tickRun(preArc, freshPersistent(0), 100);
    const rArc = tickRun(inArc, freshPersistent(0), 100);
    expect(D(rArc.persistent.alignmentDebt).toNumber()).toBeCloseTo(
      D(rPre.persistent.alignmentDebt).toNumber() * 3.5,
      6
    );
  });
});

describe("Hype → prestige discount (GDD §4 Beat 2 + §7)", () => {
  it("no hype ⇒ no discount, effective threshold == base", () => {
    expect(hypeThresholdDiscount(0, 0)).toBe(0);
    const base = D(10).pow(3); // Seed = 1e3
    expect(effectiveRoundThreshold(0, 0).toNumber()).toBe(base.toNumber());
  });

  it("hype gives diminishing-returns discount up to a 50% cap", () => {
    // Seed threshold = 1e3, pivot = 5% = 50.
    // hype = 50 → discount = 50 / (50 + 50) = 0.5 → at the cap.
    expect(hypeThresholdDiscount(0, 50)).toBeCloseTo(0.5, 6);
    // hype = 1e9 → raw = ~1.0, capped to 0.5.
    expect(hypeThresholdDiscount(0, 1e9)).toBe(0.5);
    // hype = 10 (well below pivot) → discount = 10/60 ≈ 0.167.
    expect(hypeThresholdDiscount(0, 10)).toBeCloseTo(10 / 60, 6);
  });

  it("canPrestige uses the EFFECTIVE threshold (hype shortens the round)", () => {
    // Seed: base=1e3, hype=50 → effective=500. Tokens=600 should prestige.
    const r: RunState = { ...freshRunState(), tokens: "600", hype: "50" };
    expect(canPrestige(r)).toBe(true);
    // Without hype, 600 tokens isn't enough for 1e3 threshold.
    const r2: RunState = { ...freshRunState(), tokens: "600", hype: "0" };
    expect(canPrestige(r2)).toBe(false);
  });

  it("equityFromPrestige uses the effective threshold (full base equity at the discounted bar)", () => {
    // At hype=50 (discount=0.5), effective threshold=500.
    // Prestiging at tokens=500 gives ratio=1 → equity = floor(150 × 1 × mult).
    const r: RunState = { ...freshRunState(), tokens: "500", hype: "50" };
    const equity = equityFromPrestige(r).toNumber();
    expect(equity).toBe(150); // round 0 mult = 1.00
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

  it("starting tokens/sec is non-zero and playable (engineer floor lifts the opening rate)", () => {
    const s = freshRunState();
    // supplies: {eng: 0.10, gpu: 0.90, data: 0.60, energy: 0.45}
    // engMult(0.10) is floored to 1.0. Liebig softened: 0.8*0.45 + 0.2*(0.90+0.60+0.45)/3 = 0.36+0.13 = 0.49
    expect(tokensPerSec(s).toNumber()).toBeCloseTo(0.49, 6);
  });

  it("at the start a flow buy (Office Grid) beats an engineer buy (engineers sit under the floor)", () => {
    const s = freshRunState();
    const baseRate = tokensPerSec(s).toNumber();
    // +1 Intern: eng_supply 0.10 → 0.20, both floored to 1.0 → no rate gain.
    const withExtraIntern = tokensPerSec({
      ...s,
      producersOwned: { ...s.producersOwned, intern: 2 },
    }).toNumber();
    // +1 Office Grid: lifts the energy bottleneck 0.45 → 0.60 → real gain.
    const withExtraOffice = tokensPerSec({
      ...s,
      producersOwned: { ...s.producersOwned, office_grid: 4 },
    }).toNumber();
    expect(withExtraIntern - baseRate).toBeCloseTo(0, 9); // engineer buy is flat under the floor
    expect(withExtraOffice - baseRate).toBeGreaterThan(0.1); // flow buy moves the needle
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
