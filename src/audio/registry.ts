// SFX + music cue registry. Single source of truth for which sound plays for
// which game event. GDD §14 + Appendix F lock the cue list; we just plug in
// files as they get sourced.
//
// All cues default to silence (audio module no-ops on missing cues), so the
// game runs identically whether 0 or all cues are wired.

export type CueId =
  | "ui_tap"            // Soft, low, tactile (~80-120ms)
  | "token_tick"        // Almost subliminal (~30ms, ~1Hz when foregrounded)
  | "producer_buy"      // Satisfying confirm (~200ms, slight pitch rise)
  | "producer_upgrade"  // Bigger confirm + sparkle (~400ms, once per tier)
  | "fund_round_close"  // Climactic, brass-adjacent (~1500ms — major moment)
  | "tr_spin"           // Roulette spin under the rolling phase (~500ms loopable)
  | "tr_button"         // ROLL button press in the Training Run modal
  | "tr_failed"         // Deflating descending (~600ms)
  | "tr_marginal"       // Neutral plinky (~500ms)
  | "tr_solid"          // Upbeat confirm (~600ms)
  | "tr_sota"           // Excited rise + sparkle (~800ms)
  | "tr_breakthrough"   // Massive climactic (~1200ms — Tier 5, rare)
  | "vignette_pop"      // Slack-style notification (~250ms) — distinct from OS notif
  | "debt_warn"         // Concerning deeper (~500ms) — pairs with red flash
  | "agi_event"         // Discordant, larger than life (~1000ms, round 7+)
  | "transition_early"  // Stinger when closing rounds 0-3 (prestige flow)
  | "transition_mid"    // Stinger when closing rounds 4-7
  | "transition_late";  // Stinger when closing rounds 8-9 (cosmic peak)

// Source map. `.mp3` are real sourced tracks; `.wav` are still synthesized
// placeholders from tools/gen-placeholder-sfx.js — replace as the real
// files land.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CUE_SOURCES: Partial<Record<CueId, any>> = {
  ui_tap:            require("../../assets/sfx/ui_tap.wav"),
  token_tick:        require("../../assets/sfx/token_tick.wav"),
  producer_buy:      require("../../assets/sfx/producer_buy.mp3"),
  producer_upgrade:  require("../../assets/sfx/producer_upgrade.mp3"),
  fund_round_close:  require("../../assets/sfx/fund_round_close.wav"),
  tr_spin:           require("../../assets/sfx/tr_spin.mp3"),
  tr_button:         require("../../assets/sfx/tr_button.mp3"),
  tr_failed:         require("../../assets/sfx/tr_failed.mp3"),
  tr_marginal:       require("../../assets/sfx/tr_marginal.mp3"),
  tr_solid:          require("../../assets/sfx/tr_solid.mp3"),
  tr_sota:           require("../../assets/sfx/tr_sota.mp3"),
  tr_breakthrough:   require("../../assets/sfx/tr_breakthrough.mp3"),
  vignette_pop:      require("../../assets/sfx/vignette_pop.mp3"),
  debt_warn:         require("../../assets/sfx/debt_warn.wav"),
  agi_event:         require("../../assets/sfx/agi_event.wav"),
  transition_early:  require("../../assets/music/transition_early.mp3"),
  transition_mid:    require("../../assets/music/transition_mid.mp3"),
  transition_late:   require("../../assets/music/transition_late.mp3"),
};

// ─── Background music (per-scene tracks) ────────────────────────────────
// Was era-based (3 tracks); now scene-based (8 tracks) so each round bucket
// gets its own atmosphere. Mapping mirrors PixelScene.sceneForRound:
//   seed       → rounds 0-1   (Seed, Series A)
//   coworking  → round 2      (Series B)
//   office     → round 3      (IPO)
//   megacorp   → rounds 4-5   (Secondary, Acquisition)
//   campus     → round 6      (Sovereign Wealth)
//   datacenter → round 7      (Government Bailout)
//   planetary  → round 8      (Civilizational)
//   agi        → round 9      (AGI Singularity)
export type MusicTrack =
  | "seed"
  | "coworking"
  | "office"
  | "megacorp"
  | "campus"
  | "datacenter"
  | "planetary"
  | "agi";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const MUSIC_SOURCES: Partial<Record<MusicTrack, any>> = {
  seed:       require("../../assets/music/seed.mp3"),
  coworking:  require("../../assets/music/coworking.mp3"),
  office:     require("../../assets/music/office.mp3"),
  megacorp:   require("../../assets/music/megacorp.mp3"),
  campus:     require("../../assets/music/campus.mp3"),
  datacenter: require("../../assets/music/datacenter.mp3"),
  planetary:  require("../../assets/music/planetary.mp3"),
  agi:        require("../../assets/music/agi.mp3"),
};

/** Funding-round → background music mapping. Matches PixelScene.sceneForRound. */
export function musicTrackForRound(roundIdx: number): MusicTrack | null {
  if (roundIdx <= 1) return "seed";
  if (roundIdx === 2) return "coworking";
  if (roundIdx === 3) return "office";
  if (roundIdx <= 5) return "megacorp";
  if (roundIdx === 6) return "campus";
  if (roundIdx === 7) return "datacenter";
  if (roundIdx === 8) return "planetary";
  if (roundIdx === 9) return "agi";
  return null;
}

/** Transition stinger to play when closing a round, sized to which bucket
 *  the player is moving into. Returns null if no stinger is configured. */
export function transitionCueForRound(closingRoundIdx: number): CueId | null {
  if (closingRoundIdx <= 3) return "transition_early";
  if (closingRoundIdx <= 7) return "transition_mid";
  if (closingRoundIdx <= 9) return "transition_late";
  return null;
}
