# SFX assets

Drop the 13 sound effect files into this directory with the exact filenames
below, then **uncomment the matching line** in
[`src/audio/registry.ts`](../../src/audio/registry.ts). The audio module
auto-picks up anything in the registry; nothing else needs to change.

## File list

| Cue                | Filename                | Mood brief                                          | Length    |
| ------------------ | ----------------------- | --------------------------------------------------- | --------- |
| `ui_tap`           | `ui_tap.ogg`            | Soft, low, tactile — not melodic                    | 80-120 ms |
| `token_tick`       | `token_tick.ogg`        | Almost subliminal, very low volume                  | 30 ms     |
| `producer_buy`     | `producer_buy.ogg`      | Satisfying confirm, slight pitch rise               | 200 ms    |
| `producer_upgrade` | `producer_upgrade.ogg`  | Bigger confirm + sparkle                            | 400 ms    |
| `fund_round_close` | `fund_round_close.ogg`  | Climactic, brass-adjacent (the big moment)          | 1500 ms   |
| `tr_failed`        | `tr_failed.ogg`         | Deflating descending — gentle disappointment        | 600 ms    |
| `tr_marginal`      | `tr_marginal.ogg`       | Neutral plinky                                      | 500 ms    |
| `tr_solid`         | `tr_solid.ogg`          | Upbeat confirm                                      | 600 ms    |
| `tr_sota`          | `tr_sota.ogg`           | Excited rise + sparkle                              | 800 ms    |
| `tr_breakthrough`  | `tr_breakthrough.ogg`   | Massive climactic — exciting at any volume          | 1200 ms   |
| `vignette_pop`     | `vignette_pop.ogg`      | Soft chime — distinct from system notification      | 250 ms    |
| `debt_warn`        | `debt_warn.ogg`         | Concerning, deeper — pairs with the red UI flash    | 500 ms    |
| `agi_event`        | `agi_event.ogg`         | Discordant, larger than life (round 7+ only)        | 1000 ms   |

## Format (GDD §14)

- `.ogg`, 44.1 kHz, mono
- Normalize to **-16 LUFS**, master cap **-1 dBTP**
- Hardware mute respected via `playsInSilentMode: false`

## Sourcing (royalty-free starting points)

| Cue                | Library search query                                |
| ------------------ | --------------------------------------------------- |
| `ui_tap`           | `ui click soft tactile minimal mobile`              |
| `token_tick`       | `coin tick subtle minimal short`                    |
| `fund_round_close` | `achievement unlock brass orchestral short`         |
| `tr_breakthrough`  | `rare reward fanfare orchestral celebratory`        |
| `debt_warn`        | `low alarm ambient warning subtle`                  |
| `agi_event`        | `glitch dissonant ambient cinematic short`          |

Music files (3 background tracks) go in `../music/` with filenames
`music_garage.m4a`, `music_tower.m4a`, `music_singularity.m4a` — same
uncomment-to-enable pattern in `MUSIC_SOURCES` of the same registry.
