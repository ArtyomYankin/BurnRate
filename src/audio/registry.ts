// SFX cue → asset registry. Single source of truth for which sound plays for
// which game event. GDD §14 + Appendix F lock the cue list; we just plug in
// files as they get sourced (Fiverr / royalty-free libraries — see §14 for
// the search-query table).
//
// **The file map starts empty on purpose.** Each cue has a `require(...)`
// line commented out below; to enable a sound, drop the .ogg file into
// `assets/sfx/` with the matching filename and uncomment the line. Metro
// resolves require() statically — bad paths fail the bundle, so we don't
// `require()` a file that doesn't exist yet.
//
// All cues default to silence (the audio module no-ops on missing cues), so
// the game runs identically whether 0 or all 13 cues are wired.

export type CueId =
  | "ui_tap"            // Soft, low, tactile (~80-120ms)
  | "token_tick"        // Almost subliminal (~30ms, ~1Hz when foregrounded)
  | "producer_buy"      // Satisfying confirm (~200ms, slight pitch rise)
  | "producer_upgrade"  // Bigger confirm + sparkle (~400ms, once per tier)
  | "fund_round_close"  // Climactic, brass-adjacent (~1500ms — major moment)
  | "tr_failed"         // Deflating descending (~600ms)
  | "tr_marginal"       // Neutral plinky (~500ms)
  | "tr_solid"          // Upbeat confirm (~600ms)
  | "tr_sota"           // Excited rise + sparkle (~800ms)
  | "tr_breakthrough"   // Massive climactic (~1200ms — Tier 5, rare)
  | "vignette_pop"      // Soft chime (~250ms) — distinct from OS notif
  | "debt_warn"         // Concerning deeper (~500ms) — pairs with red flash
  | "agi_event";        // Discordant, larger than life (~1000ms, round 7+)

// Source map. Currently pointing at synthesized .wav placeholders
// (tools/gen-placeholder-sfx.js); swap each line for the real .ogg as it
// lands. Filenames stay the same — only the extension changes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CUE_SOURCES: Partial<Record<CueId, any>> = {
  ui_tap:           require("../../assets/sfx/ui_tap.wav"),
  token_tick:       require("../../assets/sfx/token_tick.wav"),
  producer_buy:     require("../../assets/sfx/producer_buy.wav"),
  producer_upgrade: require("../../assets/sfx/producer_upgrade.wav"),
  fund_round_close: require("../../assets/sfx/fund_round_close.wav"),
  tr_failed:        require("../../assets/sfx/tr_failed.wav"),
  tr_marginal:      require("../../assets/sfx/tr_marginal.wav"),
  tr_solid:         require("../../assets/sfx/tr_solid.wav"),
  tr_sota:          require("../../assets/sfx/tr_sota.wav"),
  tr_breakthrough:  require("../../assets/sfx/tr_breakthrough.wav"),
  vignette_pop:     require("../../assets/sfx/vignette_pop.wav"),
  debt_warn:        require("../../assets/sfx/debt_warn.wav"),
  agi_event:        require("../../assets/sfx/agi_event.wav"),
};

// Background music tracks (GDD §14 — three eras, off by default).
export type MusicTrack = "garage" | "tower" | "singularity";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MUSIC_SOURCES: Partial<Record<MusicTrack, any>> = {
  // garage:      require("../../assets/music/music_garage.m4a"),
  // tower:       require("../../assets/music/music_tower.m4a"),
  // singularity: require("../../assets/music/music_singularity.m4a"),
};

/**
 * Funding-round → background music mapping. We still only have 3 tracks per
 * GDD §14 (Garage / Tower / Singularity) — the 5 visual scenes share them:
 *   garage:      rounds 0-3 (seed + coworking)   — warm/optimistic
 *   tower:       rounds 4-8 (office + megacorp)  — driven, corporate
 *   singularity: rounds 9-11 (agi)               — sparse, ambient
 */
export function musicTrackForRound(roundIdx: number): MusicTrack | null {
  if (roundIdx <= 3) return "garage";
  if (roundIdx <= 8) return "tower";
  if (roundIdx <= 11) return "singularity";
  return null;
}
