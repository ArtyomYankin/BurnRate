// Placeholder background-music generator. Three short loop tracks per GDD §14:
//
//   garage:      lo-fi piano + pad, ~85 BPM, hopeful
//   tower:       synthwave bass + perc, ~110 BPM, driven
//   singularity: sparse ambient drone, tempo-free, cosmic
//
// Each track is a 30-second loop (smaller than the 90/120/180s the GDD calls
// for, but tractable as a placeholder — Metro happily loops them via
// `audioPlayer.loop = true`). Drop in real .m4a's when sourced; the registry
// only needs the filename to change.
//
// Format: PCM 16-bit, 44.1 kHz, mono (small payload that plays everywhere).
//
// Run:  node tools/gen-placeholder-music.js
// Then uncomment the matching lines in src/audio/registry.ts.

const fs = require("fs");
const path = require("path");

const SR = 44100;
const LOOP_SEC = 30;

function writeWav(filename, samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);        // PCM
  buf.writeUInt16LE(1, 22);        // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clipped * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filename, buf);
}

// Linear attack/release so loop edges don't click.
function loopEdgeEnv(i, total) {
  const fade = SR * 0.5; // 500ms fade in/out at loop edges
  const a = Math.min(1, i / fade);
  const r = Math.min(1, (total - i) / fade);
  return Math.min(a, r);
}

// ─── Track 1: GARAGE — lo-fi piano arpeggio + warm pad ─────────────
function makeGarage() {
  const total = SR * LOOP_SEC;
  const out = new Array(total);
  // C minor arpeggio: C4, Eb4, G4, C5 → cyclic, 85 BPM = 0.706s per beat
  const beatSec = 60 / 85;
  const notes = [261.63, 311.13, 392.0, 523.25];
  // Pad: warm sine + slight sub at ~A2.
  const padFreq = 110.0;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    // Arpeggio note picker (one note per half-beat).
    const beatIdx = Math.floor((t / (beatSec / 2)) % notes.length);
    const note = notes[beatIdx];
    // Note envelope: pluck attack + decay over the half-beat.
    const noteT = (t / (beatSec / 2)) % 1;
    const noteEnv = Math.pow(1 - noteT, 1.5);
    const pluck = Math.sin(2 * Math.PI * note * t) * noteEnv * 0.18;
    // Warm pad sine + slow detune.
    const pad = Math.sin(2 * Math.PI * padFreq * t) * 0.10
              + Math.sin(2 * Math.PI * (padFreq * 1.005) * t) * 0.08;
    // Soft hi-hat tick on the off-beat.
    const tickT = (t / (beatSec / 4)) % 1;
    const tick = tickT < 0.04 ? (Math.random() * 2 - 1) * 0.04 : 0;
    out[i] = (pluck + pad + tick) * loopEdgeEnv(i, total);
  }
  return out;
}

// ─── Track 2: TOWER — synthwave bass + 4-on-the-floor kick ─────────
function makeTower() {
  const total = SR * LOOP_SEC;
  const out = new Array(total);
  // 110 BPM. Bass line: A2 → A2 → F2 → G2 over 1 bar (4 beats).
  const beatSec = 60 / 110;
  const barSec = beatSec * 4;
  const bassNotes = [110.0, 110.0, 87.31, 98.0]; // A2, A2, F2, G2
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const barT = (t % barSec) / barSec;
    const noteIdx = Math.floor(barT * 4);
    const bassFreq = bassNotes[noteIdx];
    // Sawtooth-ish via summed sines (fundamental + 2 octaves of harmonic).
    const noteT = (barT * 4) % 1;
    const noteEnv = Math.pow(1 - noteT * 0.7, 1.2);
    const bass =
      (Math.sin(2 * Math.PI * bassFreq * t) * 0.18
        + Math.sin(2 * Math.PI * bassFreq * 2 * t) * 0.06
        + Math.sin(2 * Math.PI * bassFreq * 3 * t) * 0.03) * noteEnv;
    // 4-on-floor kick: punchy sub-blip every beat.
    const kickT = (t % beatSec) / beatSec;
    const kickEnv = Math.pow(1 - kickT, 6);
    const kick = Math.sin(2 * Math.PI * 60 * t) * kickEnv * 0.25;
    // Lead chord pulses every 2 beats.
    const chordT = (t % (beatSec * 2)) / (beatSec * 2);
    const chordEnv = Math.pow(1 - chordT, 1.4);
    const chord = (Math.sin(2 * Math.PI * 440 * t) * 0.04
                 + Math.sin(2 * Math.PI * 523.25 * t) * 0.04) * chordEnv;
    out[i] = (bass + kick + chord) * loopEdgeEnv(i, total);
  }
  return out;
}

// ─── Track 3: SINGULARITY — sparse glitchy drone ───────────────────
function makeSingularity() {
  const total = SR * LOOP_SEC;
  const out = new Array(total);
  // Deep drone (Bb1 ≈ 58Hz) with slow detune + occasional glitch bursts.
  const droneFreq = 58.27;
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    // Drone: 3 detuned sines, very slow LFO on phase.
    const lfo = Math.sin(2 * Math.PI * 0.03 * t) * 0.5;
    const drone =
      Math.sin(2 * Math.PI * droneFreq * t + lfo) * 0.12
      + Math.sin(2 * Math.PI * droneFreq * 1.5 * t) * 0.08
      + Math.sin(2 * Math.PI * droneFreq * 2.01 * t) * 0.05;
    // Occasional shimmer — high sine that fades in/out over ~6s.
    const shimmerT = (t % 6) / 6;
    const shimmerEnv = Math.sin(Math.PI * shimmerT) * 0.5;
    const shimmer = Math.sin(2 * Math.PI * 880 * t) * shimmerEnv * 0.03;
    // Glitch bursts every 4-7s.
    const glitchPeriod = 5.3;
    const glitchT = (t % glitchPeriod) / glitchPeriod;
    let glitch = 0;
    if (glitchT < 0.05) {
      glitch = (Math.random() * 2 - 1) * 0.04 * (1 - glitchT / 0.05);
    }
    out[i] = (drone + shimmer + glitch) * loopEdgeEnv(i, total);
  }
  return out;
}

function main() {
  const outDir = path.resolve(__dirname, "..", "assets", "music");
  fs.mkdirSync(outDir, { recursive: true });
  const tracks = [
    ["music_garage.wav", makeGarage()],
    ["music_tower.wav", makeTower()],
    ["music_singularity.wav", makeSingularity()],
  ];
  for (const [name, samples] of tracks) {
    const fp = path.join(outDir, name);
    writeWav(fp, samples);
    console.log(`wrote ${fp} (${(samples.length / SR).toFixed(1)}s)`);
  }
  console.log("\nNext: uncomment the require() lines for the 3 music tracks");
  console.log("in src/audio/registry.ts (extension .wav, not .m4a).\n");
}

main();
