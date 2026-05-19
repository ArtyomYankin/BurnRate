import { D, Decimal } from "./decimal";
import { ActiveEffect } from "./effects";
import { ResearchEffect } from "./research";

// GDD §4 Beat 3 + §9: Training Run is a probabilistic Breakthrough roll the
// player initiates between sessions. Costs tokens, returns one of five tiers
// each granting a different temporary global multiplier. Pity counter
// guarantees a Breakthrough after 50 consecutive non-Breakthrough rolls — so
// the worst-case wait is bounded, not statistical.

export type TrainingTier = "Failed" | "Marginal" | "Solid" | "SOTA" | "Breakthrough";

/** GDD §9 Fig 9.2 — designed probabilities, sum to 1.0. */
export const TIER_PROBS: ReadonlyArray<{ tier: TrainingTier; weight: number }> = [
  { tier: "Failed",       weight: 0.40 },
  { tier: "Marginal",     weight: 0.32 },
  { tier: "Solid",        weight: 0.18 },
  { tier: "SOTA",         weight: 0.08 },
  { tier: "Breakthrough", weight: 0.02 },
];

/** Pity threshold from GDD §9: guaranteed Breakthrough after 50 non-Breakthrough rolls. */
export const PITY_THRESHOLD = 50;

/** Duration of the resulting active effect, in ms. */
const TIER_DURATION_MS: Record<TrainingTier, number> = {
  Failed:       0,                // no effect
  Marginal:     15 * 60 * 1000,   // 15 min
  Solid:        30 * 60 * 1000,   // 30 min
  SOTA:         60 * 60 * 1000,   // 1 hour
  Breakthrough: 60 * 60 * 1000,   // 1 hour, larger magnitude
};

/** Multiplier applied to all tokens production while the effect is active. */
const TIER_TOKEN_MULT: Record<TrainingTier, number> = {
  Failed:       1.0,
  Marginal:     1.05,
  Solid:        1.10,
  SOTA:         1.20,
  Breakthrough: 1.50,
};

/**
 * Cost of one training run, scaled to the current funding round. The intent is
 * "you should be able to afford a couple of rolls per session at any round."
 * Cost grows with round threshold so it's always a meaningful spend.
 *
 *   Seed     (1e3 threshold) →   100 tokens (~10% of round)
 *   Series A (1e6)           →   1e5     tokens
 *   Series B (1e10)          →   1e9
 *   Series C (1e16)          →   1e15
 *
 * Formula: cost = threshold / 10.
 */
export function trainingRunCost(roundThreshold: Decimal): Decimal {
  return roundThreshold.div(10);
}

/**
 * Weighted random tier draw, ignoring pity. Returns one of the five tiers.
 * `rng` defaults to Math.random; tests inject deterministic streams.
 */
export function rollTier(rng: () => number = Math.random): TrainingTier {
  const r = rng();
  let acc = 0;
  for (const { tier, weight } of TIER_PROBS) {
    acc += weight;
    if (r < acc) return tier;
  }
  return "Breakthrough"; // floating-point tail
}

/**
 * Resolve a training run with pity. Returns the tier rolled, the new pity
 * counter (resets to 0 on Breakthrough, otherwise increments), and whether
 * pity activated.
 */
export function resolveTrainingRun(
  pityStreak: number,
  rng: () => number = Math.random
): { tier: TrainingTier; nextPity: number; pityFired: boolean } {
  if (pityStreak >= PITY_THRESHOLD) {
    return { tier: "Breakthrough", nextPity: 0, pityFired: true };
  }
  const tier = rollTier(rng);
  if (tier === "Breakthrough") return { tier, nextPity: 0, pityFired: false };
  return { tier, nextPity: pityStreak + 1, pityFired: false };
}

/**
 * Convert a roll result into an ActiveEffect (or null if Failed). The effect's
 * appliedAt/expiresAt are anchored to `now` so the timer starts from when the
 * roll resolved.
 */
export function effectForTier(
  tier: TrainingTier,
  now: number,
  uniqueSuffix: string
): ActiveEffect | null {
  if (tier === "Failed") return null;
  const duration = TIER_DURATION_MS[tier];
  const tokenMult = TIER_TOKEN_MULT[tier];
  const effect: ResearchEffect = { type: "tokens_mult", value: tokenMult };
  return {
    id: `training_run-${now}-${uniqueSuffix}`,
    source: "training_run",
    label: `${tier} run · +${Math.round((tokenMult - 1) * 100)}% Tokens`,
    appliedAt: now,
    expiresAt: now + duration,
    effect,
  };
}

export { D };
