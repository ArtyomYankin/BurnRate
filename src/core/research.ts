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

// Steeper than GDD §8's 5×3^tier — that curve trivialized the whole tree by
// round 3 (player closed everything in 2-3 prestiges). Bumped to 8×5^tier so
// tier 4-5 nodes (≈5K and ≈25K equity) are actual long-term goals.
//   tier 1 = 40, tier 2 = 200, tier 3 = 1000, tier 4 = 5000, tier 5 = 25000.
export function nodeCost(tier: ResearchNode["tier"]): number {
  return 8 * Math.pow(5, tier);
}

export const RESEARCH_NODES: ResearchNode[] = [
  // ─── R&D — global token multipliers (geometric ~×1.5 per node) ───
  { id: "rd_kernel",      branch: "rd",      name: "Better LLM kernel",      tier: 1, description: "Tokens ×1.5",   effects: [{ type: "tokens_mult", value: 1.5 }] },
  { id: "rd_specdecode",  branch: "rd",      name: "Speculative decoding",   tier: 1, description: "Tokens ×1.5",   effects: [{ type: "tokens_mult", value: 1.5 }] },
  { id: "rd_moe",         branch: "rd",      name: "Mixture-of-experts",     tier: 2, description: "Tokens ×2",     effects: [{ type: "tokens_mult", value: 2 }] },
  { id: "rd_distill",     branch: "rd",      name: "Model distillation",     tier: 3, description: "Tokens ×3",     effects: [{ type: "tokens_mult", value: 3 }] },
  { id: "rd_scaling",     branch: "rd",      name: "Scaling-law mastery",    tier: 4, description: "Tokens ×5",     effects: [{ type: "tokens_mult", value: 5 }] },
  { id: "rd_emergent",    branch: "rd",      name: "Emergent capabilities",  tier: 5, description: "Tokens ×10",    effects: [{ type: "tokens_mult", value: 10 }] },

  // ─── Compute — GPU supply boost ───
  { id: "compute_fp8",    branch: "compute", name: "FP8 training",           tier: 1, description: "GPU ×1.5",      effects: [{ type: "chain_supply_mult", chain: "gpu", value: 1.5 }] },
  { id: "compute_nvlink", branch: "compute", name: "NVLink mesh",            tier: 2, description: "GPU ×2",        effects: [{ type: "chain_supply_mult", chain: "gpu", value: 2 }] },
  { id: "compute_optical",branch: "compute", name: "Optical interconnect",   tier: 3, description: "GPU ×3",        effects: [{ type: "chain_supply_mult", chain: "gpu", value: 3 }] },
  { id: "compute_quantum",branch: "compute", name: "Quantum co-processor",   tier: 4, description: "GPU ×5",        effects: [{ type: "chain_supply_mult", chain: "gpu", value: 5 }] },

  // ─── Data — Data supply boost ───
  { id: "data_synth",     branch: "data",    name: "Synthetic pipeline",     tier: 1, description: "Data ×1.5",     effects: [{ type: "chain_supply_mult", chain: "data", value: 1.5 }] },
  { id: "data_curate",    branch: "data",    name: "Curated corpora",        tier: 2, description: "Data ×2",       effects: [{ type: "chain_supply_mult", chain: "data", value: 2 }] },
  { id: "data_self",      branch: "data",    name: "Self-generated data",    tier: 3, description: "Data ×3",       effects: [{ type: "chain_supply_mult", chain: "data", value: 3 }] },
  { id: "data_ambient",   branch: "data",    name: "Ambient telemetry",      tier: 4, description: "Data ×5",       effects: [{ type: "chain_supply_mult", chain: "data", value: 5 }] },

  // ─── Energy — Energy supply boost ───
  { id: "energy_heat",    branch: "energy",  name: "Heat recovery",          tier: 1, description: "Energy ×1.5",   effects: [{ type: "chain_supply_mult", chain: "energy", value: 1.5 }] },
  { id: "energy_grid",    branch: "energy",  name: "Grid-scale storage",     tier: 2, description: "Energy ×2",     effects: [{ type: "chain_supply_mult", chain: "energy", value: 2 }] },
  { id: "energy_orbital", branch: "energy",  name: "Orbital solar arrays",   tier: 3, description: "Energy ×3",     effects: [{ type: "chain_supply_mult", chain: "energy", value: 3 }] },
  { id: "energy_fusion",  branch: "energy",  name: "Net-positive fusion",    tier: 4, description: "Energy ×5",     effects: [{ type: "chain_supply_mult", chain: "energy", value: 5 }] },

  // ─── Safety — debt accrual reduction (debt economy from GDD §9) ───
  { id: "safety_const",   branch: "safety",  name: "Constitutional methods", tier: 1, description: "Debt accrual ×0.75",  effects: [{ type: "debt_accrual_mult", value: 0.75 }] },
  { id: "safety_redteam", branch: "safety",  name: "Red team budget",        tier: 2, description: "Debt accrual ×0.50",  effects: [{ type: "debt_accrual_mult", value: 0.50 }] },
  { id: "safety_interp",  branch: "safety",  name: "Mech interpretability",  tier: 3, description: "Debt accrual ×0.25",  effects: [{ type: "debt_accrual_mult", value: 0.25 }] },

  // ─── Capital — modest flow buffs only (heavy buffs overpowered the loop:
  // money raced ahead of producer costs, removing the spend-vs-earn tension).
  { id: "cap_booking",    branch: "capital", name: "Aggressive booking",     tier: 1, description: "Capital ×1.20", effects: [{ type: "capital_mult", value: 1.20 }] },
  { id: "cap_nrr",        branch: "capital", name: "NRR > 130%",             tier: 2, description: "Capital ×1.50", effects: [{ type: "capital_mult", value: 1.50 }] },
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
