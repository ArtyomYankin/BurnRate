// Placeholder SFX generator. One-shot Node script — writes 13 short .wav
// files into assets/sfx/ so the game has audible feedback before real
// Fiverr-commissioned cues land. Each cue is a tiny sine-wave blip with
// distinct pitch/shape per GDD §14 so events sound different from each other.
//
// Run:  node tools/gen-placeholder-sfx.js
//
// Then uncomment the matching lines in src/audio/registry.ts.
//
// Format: PCM 16-bit, 44.1 kHz, mono (smallest payload that plays on iOS+web).

const fs = require("fs");
const path = require("path");

const SR = 44100;

function writeWav(filename, samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);       // fmt chunk size
  buf.writeUInt16LE(1, 20);        // PCM
  buf.writeUInt16LE(1, 22);        // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);   // byte rate
  buf.writeUInt16LE(2, 32);        // block align
  buf.writeUInt16LE(16, 34);       // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) {
    const clipped = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(clipped * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filename, buf);
}

// Linear attack/release envelope so the blip doesn't click on start/end.
function envAt(i, total, attackSamples, releaseSamples) {
  const a = Math.max(0, Math.min(1, i / attackSamples));
  const r = Math.max(0, Math.min(1, (total - i) / releaseSamples));
  return Math.min(a, r);
}

function makeTone({ durationMs, freq, amp = 0.5, sweepTo = null, harmonic = 0 }) {
  const total = Math.round((SR * durationMs) / 1000);
  const attack = Math.min(Math.round(SR * 0.005), Math.floor(total / 4));
  const release = Math.min(Math.round(SR * 0.05), Math.floor(total / 2));
  const out = new Array(total);
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    const f =
      sweepTo == null
        ? freq
        : freq + (sweepTo - freq) * (i / total);
    let s = Math.sin(2 * Math.PI * f * t);
    if (harmonic) s += harmonic * Math.sin(2 * Math.PI * f * 2 * t);
    out[i] = amp * s * envAt(i, total, attack, release);
  }
  return out;
}

function concat(parts) {
  let out = [];
  for (const p of parts) out = out.concat(makeTone(p));
  return out;
}

const OUT = path.join(__dirname, "..", "assets", "sfx");
fs.mkdirSync(OUT, { recursive: true });

// Each cue: keep it audibly distinct and roughly match the GDD §14 mood brief.
const cues = {
  ui_tap: makeTone({ durationMs: 80, freq: 1400, amp: 0.35 }),
  token_tick: makeTone({ durationMs: 30, freq: 880, amp: 0.12 }),
  producer_buy: makeTone({
    durationMs: 200, freq: 600, sweepTo: 950, amp: 0.45,
  }),
  producer_upgrade: concat([
    { durationMs: 180, freq: 700, amp: 0.5 },
    { durationMs: 220, freq: 1050, amp: 0.5, harmonic: 0.3 },
  ]),
  fund_round_close: concat([
    { durationMs: 220, freq: 523, amp: 0.5 },          // C5
    { durationMs: 220, freq: 659, amp: 0.5 },          // E5
    { durationMs: 260, freq: 784, amp: 0.55 },         // G5
    { durationMs: 800, freq: 1047, amp: 0.6, harmonic: 0.3 }, // C6 hold
  ]),
  tr_failed: makeTone({
    durationMs: 600, freq: 520, sweepTo: 180, amp: 0.4,
  }),
  tr_marginal: makeTone({ durationMs: 500, freq: 600, amp: 0.3 }),
  tr_solid: concat([
    { durationMs: 280, freq: 600, amp: 0.45 },
    { durationMs: 320, freq: 800, amp: 0.5 },
  ]),
  tr_sota: concat([
    { durationMs: 200, freq: 700, amp: 0.45 },
    { durationMs: 200, freq: 900, amp: 0.5 },
    { durationMs: 400, freq: 1200, amp: 0.55, harmonic: 0.3 },
  ]),
  tr_breakthrough: concat([
    { durationMs: 200, freq: 523, amp: 0.5 },
    { durationMs: 200, freq: 659, amp: 0.55 },
    { durationMs: 200, freq: 784, amp: 0.6 },
    { durationMs: 600, freq: 1318, amp: 0.7, harmonic: 0.4 }, // E6 hold
  ]),
  vignette_pop: concat([
    { durationMs: 100, freq: 1200, amp: 0.4 },
    { durationMs: 150, freq: 1500, amp: 0.35 },
  ]),
  debt_warn: makeTone({
    durationMs: 500, freq: 200, amp: 0.5, harmonic: 0.5,
  }),
  agi_event: concat([
    { durationMs: 500, freq: 300, amp: 0.45, sweepTo: 220 },
    { durationMs: 500, freq: 440, amp: 0.45, harmonic: 0.7 },
  ]),
};

for (const [name, samples] of Object.entries(cues)) {
  const file = path.join(OUT, `${name}.wav`);
  writeWav(file, samples);
  console.log(`wrote ${name}.wav (${samples.length} samples, ${(samples.length / SR).toFixed(2)}s)`);
}

console.log(`\nDone. ${Object.keys(cues).length} files in ${OUT}`);
console.log("Now uncomment the matching lines in src/audio/registry.ts (and switch .ogg → .wav).");
