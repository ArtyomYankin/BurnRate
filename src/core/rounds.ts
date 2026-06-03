import { FundingRoundDef } from "./types";

// GDD §5.2 / Appendix C — with rebalanced thresholds for rounds 4+.
//
// The original GDD curve (24 → 34 → 46 → 60 → 76 → 94 → 115 → 140) assumed
// stronger compounding multipliers than the actual research / agent stack
// delivers. Empirically, the top-tier Continent-Scale build caps around
// ~3e11 tokens/sec (bottleneck × engineer^0.8) before the AGI agent flywheel,
// and ~10^14 with a stack of agents. Original 1e60+ targets would take
// geologic time; we drop the late curve to ~+3 OOM per round so closing each
// round takes minutes of active play instead of years.
//
// Early rounds (0-2) are untouched — they pace well with the tier-0..2
// producers and the M+1 alpha onboarding flow.
export const FUNDING_ROUNDS: FundingRoundDef[] = [
  { id: "seed",               idx: 0,  name: "Seed",                  tokenThresholdLog10: 3,   equityMult:  1.00, offlineCapHours:  3 },
  { id: "series_a",           idx: 1,  name: "Series A",              tokenThresholdLog10: 6,   equityMult:  1.50, offlineCapHours:  6.5 },
  { id: "series_b",           idx: 2,  name: "Series B",              tokenThresholdLog10: 10,  equityMult:  2.25, offlineCapHours:  9 },
  { id: "series_c",           idx: 3,  name: "Series C",              tokenThresholdLog10: 13,  equityMult:  3.40, offlineCapHours: 13.5 },
  { id: "series_d",           idx: 4,  name: "Series D",              tokenThresholdLog10: 17,  equityMult:  5.10, offlineCapHours: 18 },
  { id: "ipo",                idx: 5,  name: "IPO",                   tokenThresholdLog10: 19,  equityMult:  7.60, offlineCapHours: 24 },
  { id: "secondary",          idx: 6,  name: "Secondary",             tokenThresholdLog10: 25,  equityMult: 11.40, offlineCapHours: 24 },
  { id: "acquisition",        idx: 7,  name: "Acquisition",           tokenThresholdLog10: 30,  equityMult: 17.10, offlineCapHours: 24 },
  { id: "sovereign_wealth",   idx: 8,  name: "Sovereign Wealth Round",tokenThresholdLog10: 35,  equityMult: 25.70, offlineCapHours: 24 },
  { id: "government_bailout", idx: 9,  name: "Government Bailout",    tokenThresholdLog10: 41,  equityMult: 38.50, offlineCapHours: 24 },
  { id: "civilizational",     idx: 10, name: "Civilizational Round",  tokenThresholdLog10: 48,  equityMult: 57.80, offlineCapHours: 24 },
  { id: "agi_singularity",    idx: 11, name: "AGI Singularity Round", tokenThresholdLog10: 56,  equityMult: 86.70, offlineCapHours: 24 },
];

// M+2 opens the full AGI arc: all 12 rounds through the AGI Singularity are
// playable. Closing the final round loops you back into it (soft endgame).
export const LAST_ROUND_IDX = FUNDING_ROUNDS.length - 1;

export function getRound(idx: number): FundingRoundDef {
  const r = FUNDING_ROUNDS[Math.max(0, Math.min(idx, FUNDING_ROUNDS.length - 1))];
  return r;
}
