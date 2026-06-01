import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { create } from "zustand";
import {
  CUE_SOURCES,
  CueId,
  MUSIC_SOURCES,
  MusicTrack,
  musicTrackForRound,
} from "./registry";

/**
 * Audio singleton. Per GDD §14:
 *   - Sound is a feedback layer, never a gate.
 *   - Game must be playable + satisfying with sound off (default OFF for
 *     music; SFX defaults ON because it's the feedback layer).
 *   - Respect iOS hardware mute switch.
 *
 * Imperative API so non-React callers (store actions) can fire cues:
 *   audio.play("producer_buy")
 *   audio.setMusicTrack("garage")
 *
 * React-friendly mute toggles live in a separate Zustand slice
 * (`useAudioStore`) so the toggle button can subscribe like any other UI
 * state — no global event bus.
 */

interface AudioState {
  sfxMuted: boolean;
  musicEnabled: boolean;
  setSfxMuted(muted: boolean): void;
  toggleSfx(): void;
  setMusicEnabled(enabled: boolean): void;
  toggleMusic(): void;
}

export const useAudioStore = create<AudioState>((set) => ({
  // SFX defaults ON (it's the feedback layer). Music defaults OFF per the
  // GDD line about playing in public spaces.
  sfxMuted: false,
  musicEnabled: false,
  setSfxMuted: (muted) => set({ sfxMuted: muted }),
  toggleSfx: () => set((s) => ({ sfxMuted: !s.sfxMuted })),
  setMusicEnabled: (enabled) => {
    set({ musicEnabled: enabled });
    if (!enabled) stopMusic();
  },
  toggleMusic: () =>
    set((s) => {
      const next = !s.musicEnabled;
      if (!next) stopMusic();
      return { musicEnabled: next };
    }),
}));

// ─── Internal player pool ────────────────────────────────────────────────

const sfxPlayers: Partial<Record<CueId, AudioPlayer>> = {};
const musicPlayers: Partial<Record<MusicTrack, AudioPlayer>> = {};
let currentMusic: MusicTrack | null = null;
let initialized = false;

/**
 * Idempotent. Called automatically on the first `play()` so callers don't
 * have to thread an init step through the app start.
 *
 * Why fire-and-forget on setAudioModeAsync: we want `playsInSilentMode: false`
 * (respect iOS hardware mute), but if it never resolves we'd still rather
 * silently play through the default mode than block startup.
 */
function ensureInit() {
  if (initialized) return;
  initialized = true;
  // GDD §14: respect iOS hardware mute switch.
  setAudioModeAsync({ playsInSilentMode: false }).catch(() => {
    /* best effort — leave the SDK on its default mode */
  });
  for (const [cue, source] of Object.entries(CUE_SOURCES)) {
    if (!source) continue;
    try {
      sfxPlayers[cue as CueId] = createAudioPlayer(source);
    } catch {
      // Skip a single bad asset; the rest of the registry still wires up.
    }
  }
  for (const [track, source] of Object.entries(MUSIC_SOURCES)) {
    if (!source) continue;
    try {
      const p = createAudioPlayer(source);
      p.loop = true;
      p.volume = 0.6; // music sits below SFX, never overpowering
      musicPlayers[track as MusicTrack] = p;
    } catch {
      /* skip bad track */
    }
  }
}

// ─── SFX ─────────────────────────────────────────────────────────────────

/**
 * Fire a one-shot cue. Cheap to call — silently no-ops when:
 *   - SFX are muted by the player, OR
 *   - the cue has no source registered (file not dropped yet).
 *
 * Restarts the cue from 0 on every call so rapid repeats (e.g. spamming
 * the BUY button) don't fall behind the player's clicks.
 */
export function play(cue: CueId) {
  if (useAudioStore.getState().sfxMuted) return;
  ensureInit();
  const p = sfxPlayers[cue];
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {
    /* swallow — playback errors shouldn't crash gameplay */
  }
}

// ─── Music ───────────────────────────────────────────────────────────────

/**
 * Switch the background music to the track for `roundIdx` (or stop music if
 * the round is out of range / music is disabled by the player). Idempotent
 * — calling with the already-playing track is a no-op.
 */
export function setMusicForRound(roundIdx: number) {
  const wanted = useAudioStore.getState().musicEnabled
    ? musicTrackForRound(roundIdx)
    : null;
  if (wanted === currentMusic) return;
  ensureInit();
  stopMusic();
  if (!wanted) return;
  const p = musicPlayers[wanted];
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
    currentMusic = wanted;
  } catch {
    /* swallow */
  }
}

function stopMusic() {
  if (!currentMusic) return;
  const p = musicPlayers[currentMusic];
  try {
    p?.pause();
  } catch {
    /* swallow */
  }
  currentMusic = null;
}
