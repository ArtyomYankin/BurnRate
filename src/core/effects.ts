import { ActiveEffectSerialized, ChainId } from "./types";
import { ResearchEffects } from "./research";

// Temporary effects from events (Training Run results, future Slack DMs, Board
// memos, alignment-debt threshold consequences). Same effect SHAPES as research
// nodes so they can be combined into a single multiplier bundle for the tick,
// but each instance carries an expiry timestamp and a unique id. The type
// lives in types.ts so it's part of the save schema's single source of truth.

export type ActiveEffect = ActiveEffectSerialized;

/** Drop any effect whose expiry has passed. Pure: returns a new array. */
export function pruneExpired(effects: ActiveEffect[], now: number): ActiveEffect[] {
  return effects.filter((e) => e.expiresAt > now);
}

/**
 * Aggregate temp effects into a ResearchEffects-shaped bundle. Multiplier-type
 * effects stack multiplicatively (per GDD §7), matching research-tree behavior.
 * Expired effects are filtered out before aggregation.
 */
export function aggregateActiveEffects(
  effects: ActiveEffect[],
  now: number
): ResearchEffects {
  const acc: ResearchEffects = {
    tokensMult: 1,
    chainSupplyMult: { engineers: 1, gpu: 1, data: 1, energy: 1 },
    debtAccrualMult: 1,
    capitalMult: 1,
    hypeMult: 1,
    rpMult: 1,
  };
  for (const ae of effects) {
    if (ae.expiresAt <= now) continue;
    const e = ae.effect;
    switch (e.type) {
      case "tokens_mult":       acc.tokensMult *= e.value; break;
      case "chain_supply_mult": acc.chainSupplyMult[e.chain] *= e.value; break;
      case "debt_accrual_mult": acc.debtAccrualMult *= e.value; break;
      case "capital_mult":      acc.capitalMult *= e.value; break;
      case "hype_mult":         acc.hypeMult *= e.value; break;
      case "rp_mult":           acc.rpMult *= e.value; break;
    }
  }
  return acc;
}

/**
 * Merge two effect bundles (research + active) into one. Multipliers compose
 * multiplicatively across both layers — GDD §7 stacking rules.
 */
export function mergeEffects(a: ResearchEffects, b: ResearchEffects): ResearchEffects {
  const chains: ChainId[] = ["engineers", "gpu", "data", "energy"];
  const chainSupplyMult: Record<ChainId, number> = {} as Record<ChainId, number>;
  for (const c of chains) chainSupplyMult[c] = a.chainSupplyMult[c] * b.chainSupplyMult[c];
  return {
    tokensMult:      a.tokensMult     * b.tokensMult,
    chainSupplyMult,
    debtAccrualMult: a.debtAccrualMult * b.debtAccrualMult,
    capitalMult:     a.capitalMult     * b.capitalMult,
    hypeMult:        a.hypeMult        * b.hypeMult,
    rpMult:          a.rpMult          * b.rpMult,
  };
}
