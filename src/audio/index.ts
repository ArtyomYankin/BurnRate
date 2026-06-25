import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { create } from "zustand";
import {
  CUE_SOURCES,
  CueId,
  MUSIC_SOURCES,
  MusicTrack,
  musicTrackForRound,
  transitionCueForRound,
} from "./registry";
export { transitionCueForRound };

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
  /** Round the music engine should follow. Set by `setMusicForRound` so a
   *  toggle-on can immediately resolve the correct scene track without the
   *  caller threading the round through. */
  currentRoundIdx: number;
  setSfxMuted(muted: boolean): void;
  toggleSfx(): void;
  setMusicEnabled(enabled: boolean): void;
  toggleMusic(): void;
}

export const useAudioStore = create<AudioState>((set, get) => ({
  // SFX defaults ON (it's the feedback layer). Music defaults OFF per the
  // GDD line about playing in public spaces. These are the IN-MEMORY mirror
  // of `account.sfxMuted` / `account.musicEnabled` — sync on app boot in
  // App.tsx and on every toggle below so a restart preserves the player's
  // pick.
  sfxMuted: false,
  musicEnabled: false,
  currentRoundIdx: 0,
  setSfxMuted: (muted) => {
    set({ sfxMuted: muted });
    persistAudioSetting("sfxMuted", muted);
  },
  toggleSfx: () => {
    const next = !get().sfxMuted;
    set({ sfxMuted: next });
    persistAudioSetting("sfxMuted", next);
  },
  setMusicEnabled: (enabled) => {
    set({ musicEnabled: enabled });
    persistAudioSetting("musicEnabled", enabled);
    if (enabled) {
      // Pre-warmed players exist after ensureInit, so kicking the scene
      // track here starts playback within one frame instead of waiting for
      // the next setMusicForRound call (which only fires on round change).
      ensureInit();
      startMusicNow();
    } else {
      stopMusic();
    }
  },
  toggleMusic: () => {
    const next = !get().musicEnabled;
    set({ musicEnabled: next });
    persistAudioSetting("musicEnabled", next);
    if (next) {
      ensureInit();
      startMusicNow();
    } else {
      stopMusic();
    }
  },
}));

/** Persist an audio preference into the game-store AccountState. Lazy import
 *  to avoid a circular module-load with src/game/store (which itself imports
 *  this audio module transitively). */
function persistAudioSetting(key: "sfxMuted" | "musicEnabled", value: boolean) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useGame } = require("../game/store");
  const state = useGame.getState();
  // Only write if the game store has finished hydrating from disk; otherwise
  // the audio toggle could overwrite a fresh `freshSave()` blob.
  if (!state.hydrated) return;
  useGame.setState({ account: { ...state.account, [key]: value } });
}

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
  // Background music must play even when the device is in silent mode —
  // iPads don't have a hardware ringer switch but DO have a Control Center
  // "Mute" toggle that's often left on by default. With playsInSilentMode
  // false, players who enable music in our Settings would still hear
  // nothing on tablet. The player's explicit Settings choice is authority
  // for BGM; OS silent mode shouldn't silently second-guess it.
  setAudioModeAsync({ playsInSilentMode: true }).catch(() => {
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
  // Remember the round so a music-on toggle later can pick the right track
  // without the caller threading it through.
  useAudioStore.setState({ currentRoundIdx: roundIdx });
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

/** Kick off the right scene track for the current round. Used by the
 *  music-enable toggle so toggling on starts playback immediately instead
 *  of waiting for the next setMusicForRound from a round change. */
function startMusicNow() {
  const { currentRoundIdx, musicEnabled } = useAudioStore.getState();
  if (!musicEnabled) return;
  const wanted = musicTrackForRound(currentRoundIdx);
  if (!wanted || wanted === currentMusic) return;
  stopMusic();
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

/** Eagerly preload sfx + music players. Call from app boot so the first
 *  music-enable toggle starts playback instantly instead of being gated on
 *  expo-audio's async file load. Idempotent — safe to call multiple times. */
export function preloadAll() {
  ensureInit();
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
