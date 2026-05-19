import { ChainId } from "./types";

// GDD §5 + §8: Research tree is the Equity sink. Nodes are bought with Equity
// (which persists across prestige), grant permanent multipliers, and are not
// refundable. M+1 ships ~10 of the ~30 nodes planned for v1.0, across 5
// branches. Engineering branch is deferred — producer-cost discount math is
// fiddly with the geometric series, and the tier-0 starter buff is its
// stand-in for now.

export type ResearchBranch = "rd" | "compute" | "data" | "energy" | "safety" | "capital";

export type ResearchEffect =
  | { type: "tokens_mult"; value: number }
  | { type: "chain_supply_mult"; chain: ChainId; value: number }
  | { type: "debt_accrual_mult"; value: number }
  | { type: "capital_mult"; value: number }
  | { type: "hype_mult"; value: number }
  | { type: "rp_mult"; value: number };

export interface ResearchNode {
  id: string;
  branch: ResearchBranch;
  name: string;
  tier: 1 | 2 | 3 | 4 | 5;
  description: string;
  effects: ResearchEffect[];
}

// GDD §8: node_cost(tier) = 5 × 3^tier.
//   tier 1 = 15, tier 2 = 45, tier 3 = 135, tier 4 = 405, tier 5 = 1215.
export function nodeCost(tier: ResearchNode["tier"]): number {
  return 5 * Math.pow(3, tier);
}

export const RESEARCH_NODES: ResearchNode[] = [
  // R&D — global token multipliers
  { id: "rd_kernel",      branch: "rd",      name: "Better LLM kernel",      tier: 1, description: "+25% Tokens",         effects: [{ type: "tokens_mult", value: 1.25 }] },
  { id: "rd_specdecode",  branch: "rd",      name: "Speculative decoding",   tier: 1, description: "+20% Tokens",         effects: [{ type: "tokens_mult", value: 1.20 }] },
  { id: "rd_moe",         branch: "rd",      name: "Mixture-of-experts",     tier: 2, description: "+50% Tokens",         effects: [{ type: "tokens_mult", value: 1.50 }] },

  // Compute — GPU supply boost
  { id: "compute_fp8",    branch: "compute", name: "FP8 training",           tier: 1, description: "GPU supply ×1.25",    effects: [{ type: "chain_supply_mult", chain: "gpu", value: 1.25 }] },
  { id: "compute_nvlink", branch: "compute", name: "NVLink mesh",            tier: 2, description: "GPU supply ×1.50",    effects: [{ type: "chain_supply_mult", chain: "gpu", value: 1.50 }] },

  // Data — Data supply boost
  { id: "data_synth",     branch: "data",    name: "Synthetic pipeline",     tier: 1, description: "Data supply ×1.30",   effects: [{ type: "chain_supply_mult", chain: "data", value: 1.30 }] },

  // Energy — Energy supply boost
  { id: "energy_heat",    branch: "energy",  name: "Heat recovery",          tier: 1, description: "Energy supply ×1.30", effects: [{ type: "chain_supply_mult", chain: "energy", value: 1.30 }] },

  // Safety — debt accrual reduction (debt economy from GDD §9)
  { id: "safety_const",   branch: "safety",  name: "Constitutional methods", tier: 1, description: "Debt accrual ×0.75",  effects: [{ type: "debt_accrual_mult", value: 0.75 }] },
  { id: "safety_redteam", branch: "safety",  name: "Red team budget",        tier: 2, description: "Debt accrual ×0.50",  effects: [{ type: "debt_accrual_mult", value: 0.50 }] },

  // Capital — flow rate boost
  { id: "cap_booking",    branch: "capital", name: "Aggressive booking",     tier: 3, description: "Capital flow ×1.20",  effects: [{ type: "capital_mult", value: 1.20 }] },
];

export const RESEARCH_BY_ID: Record<string, ResearchNode> = Object.fromEntries(
  RESEARCH_NODES.map((n) => [n.id, n])
);

/**
 * Combined effects from a set of purchased nodes. Multiplier-type effects
 * STACK MULTIPLICATIVELY per GDD §7. Sub-1 multipliers (e.g. debt-accrual
 * reduction) compound downward correctly: 0.75 × 0.50 = 0.375.
 */
export interface ResearchEffects {
  tokensMult: number;
  chainSupplyMult: Record<ChainId, number>;
  debtAccrualMult: number;
  capitalMult: number;
  hypeMult: number;
  rpMult: number;
}

const IDENTITY: ResearchEffects = {
  tokensMult: 1,
  chainSupplyMult: { engineers: 1, gpu: 1, data: 1, energy: 1 },
  debtAccrualMult: 1,
  capitalMult: 1,
  hypeMult: 1,
  rpMult: 1,
};

export function aggregateResearchEffects(unlockedIds: ReadonlyArray<string>): ResearchEffects {
  const acc: ResearchEffects = {
    ...IDENTITY,
    chainSupplyMult: { ...IDENTITY.chainSupplyMult },
  };
  for (const id of unlockedIds) {
    const node = RESEARCH_BY_ID[id];
    if (!node) continue;
    for (const eff of node.effects) {
      switch (eff.type) {
        case "tokens_mult":        acc.tokensMult *= eff.value; break;
        case "chain_supply_mult":  acc.chainSupplyMult[eff.chain] *= eff.value; break;
        case "debt_accrual_mult":  acc.debtAccrualMult *= eff.value; break;
        case "capital_mult":       acc.capitalMult *= eff.value; break;
        case "hype_mult":          acc.hypeMult *= eff.value; break;
        case "rp_mult":            acc.rpMult *= eff.value; break;
      }
    }
  }
  return acc;
}

export const NO_RESEARCH_EFFECTS: ResearchEffects = IDENTITY;
