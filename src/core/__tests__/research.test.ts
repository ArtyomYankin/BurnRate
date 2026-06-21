import { describe, expect, it } from "vitest";
import { D } from "../decimal";
import {
  allChainSupplies,
  debtRatePerSec,
  freshRunState,
  tickRun,
  tokensPerSec,
} from "../math";
import {
  aggregateResearchEffects,
  nodeCost,
  RESEARCH_BY_ID,
} from "../research";
import { PersistentState, RunState } from "../types";

const balanced1 = (): RunState => ({
  ...freshRunState(),
  producersOwned: { intern: 1, single_h100: 1, common_crawl: 1, office_grid: 1 },
});

const freshPersistent = (overrides: Partial<PersistentState> = {}): PersistentState => ({
  equity: D(0).toString(),
  totalPrestiges: 0,
  alignmentDebt: D(0).toString(),
  unlockedResearch: [],
  firedDebtThresholds: [],
  unlockedVignettes: [],
  unreadVignettes: [],
  resolvedVignettes: {},
  unlockedAchievements: [],
  endgameSeenAt: 0,
  ...overrides,
});

describe("node cost formula (GDD §8)", () => {
  it("5 × 3^tier", () => {
    // Steepened from 5×3^tier to 8×5^tier — tier 5 now ≈ 25K equity (was 1215),
    // so the late tree stays a real long-term goal instead of "all bought by R3".
    expect(nodeCost(1)).toBe(40);
    expect(nodeCost(2)).toBe(200);
    expect(nodeCost(3)).toBe(1000);
    expect(nodeCost(4)).toBe(5000);
    expect(nodeCost(5)).toBe(25000);
  });
});

describe("aggregateResearchEffects", () => {
  it("empty list ⇒ identity (×1 everywhere)", () => {
    const e = aggregateResearchEffects([]);
    expect(e.tokensMult).toBe(1);
    expect(e.chainSupplyMult.gpu).toBe(1);
    expect(e.chainSupplyMult.data).toBe(1);
    expect(e.chainSupplyMult.engineers).toBe(1);
    expect(e.chainSupplyMult.energy).toBe(1);
    expect(e.debtAccrualMult).toBe(1);
    expect(e.capitalMult).toBe(1);
  });

  it("Better LLM kernel applies ×1.5 tokens (toned-down rebalance)", () => {
    const e = aggregateResearchEffects(["rd_kernel"]);
    expect(e.tokensMult).toBeCloseTo(1.5, 9);
  });

  it("two R&D nodes stack multiplicatively (1.5 × 1.5 = 2.25)", () => {
    const e = aggregateResearchEffects(["rd_kernel", "rd_specdecode"]);
    expect(e.tokensMult).toBeCloseTo(2.25, 9);
  });

  it("FP8 + NVLink stack on GPU chain (1.5 × 2 = 3)", () => {
    const e = aggregateResearchEffects(["compute_fp8", "compute_nvlink"]);
    expect(e.chainSupplyMult.gpu).toBeCloseTo(3, 9);
    expect(e.chainSupplyMult.data).toBe(1);
  });

  it("two safety nodes stack downward for debt accrual (0.75 × 0.50)", () => {
    const e = aggregateResearchEffects(["safety_const", "safety_redteam"]);
    expect(e.debtAccrualMult).toBeCloseTo(0.375, 9);
  });

  it("unknown node IDs are ignored", () => {
    const e = aggregateResearchEffects(["bogus_id", "rd_kernel"]);
    expect(e.tokensMult).toBeCloseTo(1.5, 9);
  });
});

describe("research effects applied at the math layer", () => {
  it("tokensPerSec scales by the aggregated tokensMult", () => {
    const s = balanced1();
    const base = tokensPerSec(s).toNumber();
    const boosted = tokensPerSec(s, aggregateResearchEffects(["rd_kernel"])).toNumber();
    expect(boosted).toBeCloseTo(base * 1.5, 9);
  });

  it("chainSupply for GPU includes the chain_supply_mult", () => {
    const s = { ...balanced1(), producersOwned: { single_h100: 1 } };
    const effects = aggregateResearchEffects(["compute_fp8"]);
    const supplies = allChainSupplies(s, effects);
    // Base GPU = 0.30, ×1.5 = 0.45
    expect(supplies.gpu.toNumber()).toBeCloseTo(0.45, 9);
  });

  it("debtRatePerSec reduces accrual by safety research multiplier", () => {
    const baseRate = debtRatePerSec(0); // max accrual
    const effects = aggregateResearchEffects(["safety_const"]);
    const reducedRate = debtRatePerSec(0, effects);
    expect(reducedRate).toBeCloseTo(baseRate * 0.75, 9);
  });

  it("debtRatePerSec leaves pay-down unaffected by safety research", () => {
    const baseRate = debtRatePerSec(1.0); // surplus, pay-down
    const effects = aggregateResearchEffects(["safety_const", "safety_redteam"]);
    const withResearch = debtRatePerSec(1.0, effects);
    expect(withResearch).toBeCloseTo(baseRate, 9);
  });

  it("tickRun multiplies Capital by capitalMult", () => {
    // Zero out the starter capital so we compare *earned* capital cleanly —
    // freshRunState now seeds STARTER_CAPITAL, which would otherwise offset
    // both runs equally and break the 1.20× ratio.
    const s = { ...balanced1(), capital: "0" };
    const r1 = tickRun(s, freshPersistent(), 60);
    const r2 = tickRun(s, freshPersistent(), 60, aggregateResearchEffects(["cap_booking"]));
    // Capital should be 1.20× higher with cap_booking owned (reverted from overcorrected ×1.5).
    expect(D(r2.run.capital).toNumber()).toBeCloseTo(D(r1.run.capital).toNumber() * 1.20, 6);
  });
});

describe("node data sanity", () => {
  it("every node has at least one effect", () => {
    for (const node of Object.values(RESEARCH_BY_ID)) {
      expect(node.effects.length).toBeGreaterThan(0);
    }
  });
  it("every node's tier is 1-5", () => {
    for (const node of Object.values(RESEARCH_BY_ID)) {
      expect(node.tier).toBeGreaterThanOrEqual(1);
      expect(node.tier).toBeLessThanOrEqual(5);
    }
  });
});
