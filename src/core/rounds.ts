import { FundingRoundDef } from "./types";

// GDD §5.2 / Appendix C. M0 ships rounds 0-1 (Seed -> Series A); the rest are
// encoded now so the meta loop can extend without schema churn.
export const FUNDING_ROUNDS: FundingRoundDef[] = [
  { id: "seed",               idx: 0,  name: "Seed",                  tokenThresholdLog10: 3,   equityMult:  1.00, offlineCapHours:  3 },
  { id: "series_a",           idx: 1,  name: "Series A",              tokenThresholdLog10: 6,   equityMult:  1.50, offlineCapHours:  6.5 },
  { id: "series_b",           idx: 2,  name: "Series B",              tokenThresholdLog10: 10,  equityMult:  2.25, offlineCapHours:  9 },
  { id: "series_c",           idx: 3,  name: "Series C",              tokenThresholdLog10: 16,  equityMult:  3.40, offlineCapHours: 13.5 },
  { id: "series_d",           idx: 4,  name: "Series D",              tokenThresholdLog10: 24,  equityMult:  5.10, offlineCapHours: 18 },
  { id: "ipo",                idx: 5,  name: "IPO",                   tokenThresholdLog10: 34,  equityMult:  7.60, offlineCapHours: 24 },
  { id: "secondary",          idx: 6,  name: "Secondary",             tokenThresholdLog10: 46,  equityMult: 11.40, offlineCapHours: 24 },
  { id: "acquisition",        idx: 7,  name: "Acquisition",           tokenThresholdLog10: 60,  equityMult: 17.10, offlineCapHours: 24 },
  { id: "sovereign_wealth",   idx: 8,  name: "Sovereign Wealth Round",tokenThresholdLog10: 76,  equityMult: 25.70, offlineCapHours: 24 },
  { id: "government_bailout", idx: 9,  name: "Government Bailout",    tokenThresholdLog10: 94,  equityMult: 38.50, offlineCapHours: 24 },
  { id: "civilizational",     idx: 10, name: "Civilizational Round",  tokenThresholdLog10: 115, equityMult: 57.80, offlineCapHours: 24 },
  { id: "agi_singularity",    idx: 11, name: "AGI Singularity Round", tokenThresholdLog10: 140, equityMult: 86.70, offlineCapHours: 24 },
];

// M+2 opens the full AGI arc: all 12 rounds through the AGI Singularity are
// playable. Closing the final round loops you back into it (soft endgame).
export const LAST_ROUND_IDX = FUNDING_ROUNDS.length - 1;

export function getRound(idx: number): FundingRoundDef {
  const r = FUNDING_ROUNDS[Math.max(0, Math.min(idx, FUNDING_ROUNDS.length - 1))];
  return r;
}
