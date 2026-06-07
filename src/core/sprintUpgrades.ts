// GDD §4 Beat 2 + §7/§9: R&D allocation accumulates Research Points (RP), and
// RP is spent on "Active-run research nodes (lost on prestige)". These are
// SEPARATE from the persistent Equity-tree (research.ts) — they're per-run
// boosts the player ships during a sprint to push through this round faster.
//
// Each upgrade is one-shot per run: buy once, effect applies for the rest of
// the round, gone after prestige (because RunState.sprintUpgradesUnlocked is
// reset in freshRunState, which prestige uses).
//
// Kept deliberately small (5 upgrades) so the player can see all of them at a
// glance and recover their RP from R&D allocation within one round.

export interface SprintUpgradeDef {
  id: string;
  name: string;
  costRP: number;
  effect:
    | { type: "tokens_mult"; value: number }
    | { type: "capital_mult"; value: number }
    | { type: "hype_mult"; value: number }
    | { type: "rp_mult"; value: number };
  flavor: string;
}

export const SPRINT_UPGRADES: SprintUpgradeDef[] = [
  {
    id: "code_review",
    name: "Code Review Pass",
    costRP: 5,
    effect: { type: "tokens_mult", value: 1.10 },
    flavor: "Catch the obvious stuff before it ships.",
  },
  {
    id: "growth_hack",
    name: "Growth Hack",
    costRP: 10,
    effect: { type: "hype_mult", value: 1.25 },
    flavor: "It's just one tweet. It's never just one tweet.",
  },
  {
    id: "pricing_revamp",
    name: "Pricing Revamp",
    costRP: 15,
    effect: { type: "capital_mult", value: 1.20 },
    flavor: "Add a third tier. Nobody picks the middle one.",
  },
  {
    id: "pair_programming",
    name: "Pair Programming",
    costRP: 30,
    effect: { type: "tokens_mult", value: 1.15 },
    flavor: "Two engineers, one chair, twice the velocity.",
  },
  {
    id: "internal_tooling",
    name: "Internal Tooling Sprint",
    costRP: 60,
    effect: { type: "rp_mult", value: 1.30 },
    flavor: "Stop and sharpen the saw. The saw is a JIRA workflow.",
  },
];

export const SPRINT_UPGRADE_BY_ID: Record<string, SprintUpgradeDef> =
  Object.fromEntries(SPRINT_UPGRADES.map((u) => [u.id, u]));

/**
 * Effective RP cost for a sprint upgrade at the player's current funding
 * round. The base cost (5/10/15/30/60) is tuned for round 0; by round 3 RP
 * production scales 4-5 orders of magnitude higher, so flat costs are
 * meaningless mid-game. We scale ×8^roundIdx — slightly under the typical
 * round-to-round tokens/sec growth so RP stays a real sink without becoming
 * unreachable.
 *
 *   round 0 → base (5/10/15/30/60)
 *   round 3 → ×512  (≈ 2.5K / 5K / 7.7K / 15K / 30K RP)
 *   round 6 → ×260K
 *   round 11 → ×8.6e9
 */
export function sprintUpgradeCost(def: SprintUpgradeDef, roundIdx: number): number {
  return def.costRP * Math.pow(8, Math.max(0, roundIdx));
}

/**
 * Effect bundle from this run's owned sprint upgrades, shaped the same as
 * ResearchEffects so it composes 1:1 with the research aggregator.
 *
 * Only the four currency multipliers actually used by sprint upgrades — the
 * other ResearchEffects fields (chainSupplyMult, debtAccrualMult) are filled
 * with identity values so callers can merge without branching.
 */
export interface SprintEffects {
  tokensMult: number;
  capitalMult: number;
  hypeMult: number;
  rpMult: number;
}

export const NO_SPRINT_EFFECTS: SprintEffects = {
  tokensMult: 1,
  capitalMult: 1,
  hypeMult: 1,
  rpMult: 1,
};

export function aggregateSprintEffects(unlockedIds: string[]): SprintEffects {
  const acc: SprintEffects = { ...NO_SPRINT_EFFECTS };
  for (const id of unlockedIds) {
    const def = SPRINT_UPGRADE_BY_ID[id];
    if (!def) continue;
    const e = def.effect;
    switch (e.type) {
      case "tokens_mult":  acc.tokensMult  *= e.value; break;
      case "capital_mult": acc.capitalMult *= e.value; break;
      case "hype_mult":    acc.hypeMult    *= e.value; break;
      case "rp_mult":      acc.rpMult      *= e.value; break;
    }
  }
  return acc;
}
