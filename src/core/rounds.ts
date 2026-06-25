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
// v12 (M+2 → M+3 polish): dropped Series C and Series D from the round
// ladder so each early "small office" scene shows for exactly one round
// (coworking = Series B only, office = IPO only). Total dropped from 12 → 10.
// Tier gate `tier N = round N` carries over unchanged, so e.g. Hyperscale
// Region (tier 5) now unlocks at Acquisition (round 5 in megacorp scene) —
// matches the narrative beat far better than the old IPO timing.
//
// Threshold curve: 3, 6, 10, 14, 17, 20, 23, 26, 29, 32 — strictly +3 OOM
// per round from round 3 onward (early rounds keep their +3..+4 spread
// because doubling producer count is cheap and the player needs a few
// quick wins). The previous curve had +4 OOM gaps in the mid/late game
// (4→5 was 20→24), which made round 5+ effectively unreachable: 200 of
// each producer × all multipliers tops out around 1e14-1e15 tokens/sec,
// but 10^24 / 10^15 = 10^9 seconds = ~30 years to close one round. With
// +3 the player's actual production growth (~1-2 OOM per new tier
// purchased + prestige bonus) keeps pace with the threshold.
// Round names follow the SCENE the player sees, not financial-VC jargon
// (was Seed / Series A / B / IPO / Secondary / Acquisition / Sovereign /
// Bailout / Civilizational / AGI). Scene-themed names give the player a
// concrete sense of where they are in the world; financial labels were
// thematically interesting but read as flavor noise after round 3 or so.
// IDs stay stable so saves keep migrating cleanly.
//
// Localized names come from i18n.roundNames; the `name` field here is the
// EN fallback used when no translation exists for an id.
export const FUNDING_ROUNDS: FundingRoundDef[] = [
  { id: "seed",               idx: 0, name: "Garage",          tokenThresholdLog10: 3,   equityMult:  1.00, offlineCapHours:  2 },
  { id: "series_a",           idx: 1, name: "Bootstrap",       tokenThresholdLog10: 6,   equityMult:  1.50, offlineCapHours:  4 },
  { id: "series_b",           idx: 2, name: "Coworking",       tokenThresholdLog10: 10,  equityMult:  2.25, offlineCapHours:  6 },
  { id: "ipo",                idx: 3, name: "Startup Office",  tokenThresholdLog10: 14,  equityMult:  4.50, offlineCapHours:  8 },
  { id: "secondary",          idx: 4, name: "Megacorp",        tokenThresholdLog10: 17,  equityMult:  8.50, offlineCapHours: 10 },
  { id: "acquisition",        idx: 5, name: "Big Tech",        tokenThresholdLog10: 20,  equityMult: 14.00, offlineCapHours: 12 },
  { id: "sovereign_wealth",   idx: 6, name: "Campus",          tokenThresholdLog10: 23,  equityMult: 22.00, offlineCapHours: 12 },
  { id: "government_bailout", idx: 7, name: "Datacenter",      tokenThresholdLog10: 26,  equityMult: 34.00, offlineCapHours: 12 },
  { id: "civilizational",     idx: 8, name: "Planetary",       tokenThresholdLog10: 29,  equityMult: 52.00, offlineCapHours: 12 },
  { id: "agi_singularity",    idx: 9, name: "AGI Singularity", tokenThresholdLog10: 32,  equityMult: 80.00, offlineCapHours: 12 },
];

// M+2 opens the full AGI arc: all 12 rounds through the AGI Singularity are
// playable. Closing the final round loops you back into it (soft endgame).
export const LAST_ROUND_IDX = FUNDING_ROUNDS.length - 1;

export function getRound(idx: number): FundingRoundDef {
  const r = FUNDING_ROUNDS[Math.max(0, Math.min(idx, FUNDING_ROUNDS.length - 1))];
  return r;
}
