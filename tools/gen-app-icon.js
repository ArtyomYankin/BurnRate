// App-icon generator — pure Node port of the design bundle's icon-draw.js.
// Writes:
//   assets/icon.png           1024² · iOS production · opaque square (OS masks corners)
//   assets/adaptive-icon.png  1024² · Android adaptive · full-bleed, no brackets
//   assets/favicon.png          64² · web · rounded, brackets visible
//   assets/splash-icon.png    1024² · splash · bleed
//
// Run:  node tools/gen-app-icon.js
//
// Uses pngjs (already in node_modules as a transitive expo dep). No native deps.

"use strict";
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

// ─── Palette (identical to design's icon-draw.js PAL) ────────────────────
const PAL = {
  bgTop:    rgb("#2A2218"),
  bgBot:    rgb("#140F09"),
  frame:    rgb("#D4A24C"),
  coinHi:   rgb("#EBBE6E"),
  coinSh:   rgb("#B68838"),
  coinRim:  rgb("#2A2A2A"),
  coinFace: rgb("#E8C878"),
  fOuter:   rgb("#8B5639"),
  fMid:     rgb("#C97B5B"),
  fGold:    rgb("#D4A24C"),
  fHot:     rgb("#EBBE6E"),
  fCore:    rgb("#FBF7EC"),
};

const GRID = 24;

// ─── Canvas (raw RGBA buffer + source-over compositing) ──────────────────
function makeCanvas(W, H) {
  const buf = Buffer.alloc(W * H * 4);
  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    if (a >= 255 && buf[i + 3] === 0) {
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
      return;
    }
    const sa = a / 255;
    const da = buf[i + 3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) return;
    buf[i]     = Math.round((r * sa + buf[i]     * da * (1 - sa)) / outA);
    buf[i + 1] = Math.round((g * sa + buf[i + 1] * da * (1 - sa)) / outA);
    buf[i + 2] = Math.round((b * sa + buf[i + 2] * da * (1 - sa)) / outA);
    buf[i + 3] = Math.round(outA * 255);
  }
  function fillRect(x, y, w, h, rgba, alphaMul = 1) {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(W, Math.ceil(x + w));
    const y1 = Math.min(H, Math.ceil(y + h));
    const a = Math.round((rgba[3] ?? 255) * alphaMul);
    for (let py = y0; py < y1; py++) {
      for (let pxx = x0; pxx < x1; pxx++) {
        setPixel(pxx, py, rgba[0], rgba[1], rgba[2], a);
      }
    }
  }
  return { W, H, buf, setPixel, fillRect };
}

// ─── Drawing ─────────────────────────────────────────────────────────────
function drawIcon(cv, S, opts = {}) {
  // shape: 'rounded' (preview / favicon) - radius corners + brackets
  //        'square'  (iOS production)    - opaque rect + brackets
  //        'maskable'(Android / splash)  - full bleed, no brackets
  const shape = opts.shape || (opts.bleed ? "maskable" : "rounded");
  const cell = S / GRID;
  const px = (gx, gy, w, h, rgba, alphaMul) =>
    cv.fillRect(gx * cell, gy * cell, w * cell, h * cell, rgba, alphaMul);

  // ── Background — vertical gradient ──
  for (let y = 0; y < S; y++) {
    const t = y / (S - 1);
    const r = Math.round(PAL.bgTop[0] + (PAL.bgBot[0] - PAL.bgTop[0]) * t);
    const g = Math.round(PAL.bgTop[1] + (PAL.bgBot[1] - PAL.bgTop[1]) * t);
    const b = Math.round(PAL.bgTop[2] + (PAL.bgBot[2] - PAL.bgTop[2]) * t);
    for (let x = 0; x < S; x++) cv.setPixel(x, y, r, g, b, 255);
  }

  // ── Warm radial glow behind the flame (approximated 2-stop) ──
  const gcx = S * 0.5, gcy = S * 0.44;
  const innerR = S * 0.04, outerR = S * 0.5;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x - gcx, dy = y - gcy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let t = (d - innerR) / (outerR - innerR);
      if (t < 0) t = 0;
      if (t > 1) continue;
      // Stops: 0 → rgba(214,140,60,0.6), 0.5 → rgba(140,86,57,0.2), 1 → 0
      let r, g, b, a;
      if (t < 0.5) {
        const k = t / 0.5;
        r = 214 + (140 - 214) * k;
        g = 140 + (86 - 140) * k;
        b = 60 + (57 - 60) * k;
        a = 0.6 + (0.2 - 0.6) * k;
      } else {
        const k = (t - 0.5) / 0.5;
        r = 140; g = 86; b = 57;
        a = 0.2 + (0 - 0.2) * k;
      }
      cv.setPixel(x, y, Math.round(r), Math.round(g), Math.round(b), Math.round(a * 255));
    }
  }

  // ── Faint scanline texture ──
  for (let gy = 0; gy < GRID; gy += 2) {
    const yy = Math.round(gy * cell);
    const hh = Math.max(1, Math.floor(cell * 0.5));
    for (let yyy = yy; yyy < yy + hh && yyy < S; yyy++) {
      for (let x = 0; x < S; x++) cv.setPixel(x, yyy, 0, 0, 0, Math.round(0.04 * 255));
    }
  }

  // ── Subtle gold corner brackets (skip on maskable) ──
  if (shape !== "maskable") {
    const fi = 2.6, len = 2.0, th = 0.42, am = 0.85;
    px(fi, fi, len, th, PAL.frame, am); px(fi, fi, th, len, PAL.frame, am);
    px(GRID - fi - len, fi, len, th, PAL.frame, am);
    px(GRID - fi - th, fi, th, len, PAL.frame, am);
    px(fi, GRID - fi - th, len, th, PAL.frame, am);
    px(fi, GRID - fi - len, th, len, PAL.frame, am);
    px(GRID - fi - len, GRID - fi - th, len, th, PAL.frame, am);
    px(GRID - fi - th, GRID - fi - len, th, len, PAL.frame, am);
  }

  // ── FLAME behind the coin ──
  drawFlame(px, 12, 1.2, 16.5);

  // ── COIN ──
  const cx = 12, cy = 14.2, R = 6.4;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const dx = gx + 0.5 - cx, dy = gy + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy * 1.02);
      if (d <= R) {
        let col;
        if (d > R - 0.9) col = PAL.coinRim;
        else if (d > R - 1.7) col = PAL.coinSh;
        else if (dx + dy < -2.8) col = PAL.coinHi;
        else if (dx + dy > 3.2) col = PAL.coinSh;
        else col = PAL.coinFace;
        px(gx, gy, 1, 1, col);
      }
    }
  }
  // Tick marks around inner bevel
  for (let a = 0; a < 360; a += 30) {
    const rad = (a * Math.PI) / 180;
    const tx = cx + Math.cos(rad) * (R - 1.3) - 0.5;
    const ty = cy + Math.sin(rad) * (R - 1.3) - 0.5;
    px(tx, ty, 0.6, 0.6, PAL.coinSh, 0.5);
  }

  // ── "$" glyph ──
  drawDollar(px, cx, cy, PAL.coinRim);

  // ── Flame flecks licking over the coin's top rim ──
  px(11.5, 8.0, 1, 1, PAL.fHot, 0.95);
  px(12.6, 8.6, 0.8, 0.8, PAL.fGold, 0.95);
  px(10.6, 8.8, 0.8, 0.8, PAL.fMid, 0.95);

  // ── If rounded, post-clip the corners (transparent) ──
  if (shape === "rounded") {
    const radius = S * 0.225;
    clipRoundedCorners(cv, S, S, radius);
  }
}

// 7×9 pixel "$" glyph — verbatim from design.
function drawDollar(px, cx, cy, ink) {
  const map = [
    "...1...",
    ".11111.",
    "11.1..1",
    "11.1...",
    ".11111.",
    "...1.11",
    "1..1.11",
    ".11111.",
    "...1...",
  ];
  const w = 7, h = 9;
  const ox = cx - w / 2, oy = cy - h / 2;
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (map[r][c] === "1") px(ox + c, oy + r, 1, 1, ink);
    }
  }
}

// Procedural teardrop flame — exact port of design's drawFlame.
function drawFlame(px, centerCol, topRow, baseRow) {
  const maxHW = 3.6;
  for (let r = Math.floor(topRow); r <= Math.ceil(baseRow); r++) {
    const t = (r - topRow) / (baseRow - topRow);
    if (t < 0 || t > 1.05) continue;
    let hw = maxHW * Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.74);
    hw += Math.sin(r * 1.7) * 0.28;
    hw = Math.max(0.5, hw);
    const lean = Math.sin((1 - t) * 2.2) * 0.5;
    for (let c = -Math.ceil(hw); c <= Math.ceil(hw); c++) {
      const d = Math.abs(c - lean) / hw;
      if (d > 1.02) continue;
      let col;
      if (d > 0.82)      col = t > 0.7  ? PAL.fOuter : PAL.fMid;
      else if (d > 0.5)  col = t > 0.55 ? PAL.fMid   : PAL.fGold;
      else if (d > 0.24) col = t > 0.4  ? PAL.fGold  : PAL.fHot;
      else               col = t > 0.62 ? PAL.fHot   : PAL.fCore;
      if (t < 0.16)      col = d > 0.55 ? PAL.fGold  : PAL.fCore;
      px(centerCol + c, r, 1, 1, col);
    }
  }
  px(centerCol + 2, topRow - 0.8, 0.7, 0.7, PAL.fHot);
  px(centerCol - 1.6, topRow - 1.4, 0.6, 0.6, PAL.fGold);
}

// Zero out alpha outside the rounded-rect mask.
function clipRoundedCorners(cv, W, H, r) {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let outside = false;
      // Each of 4 corners: if pixel is inside the corner square AND outside
      // the corner circle, mask it out.
      const corners = [
        [r, r],          // top-left center
        [W - r, r],      // top-right
        [r, H - r],      // bottom-left
        [W - r, H - r],  // bottom-right
      ];
      const inCornerBox = [
        x < r && y < r,
        x >= W - r && y < r,
        x < r && y >= H - r,
        x >= W - r && y >= H - r,
      ];
      for (let k = 0; k < 4; k++) {
        if (!inCornerBox[k]) continue;
        const dx = x + 0.5 - corners[k][0], dy = y + 0.5 - corners[k][1];
        if (dx * dx + dy * dy > r * r) outside = true;
      }
      if (outside) {
        const i = (y * W + x) * 4;
        cv.buf[i] = cv.buf[i + 1] = cv.buf[i + 2] = cv.buf[i + 3] = 0;
      }
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────
function rgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255];
}

function save(name, S, opts) {
  const cv = makeCanvas(S, S);
  drawIcon(cv, S, opts);
  // Apple App Store strictly rejects 1024² icons with an alpha channel —
  // even one where every alpha byte is 255 still trips iTunes Connect's
  // ITMS-90717 check. For shape="square" we strip alpha by encoding the
  // PNG as RGB (colorType 2, 3 bytes per pixel). Other shapes keep RGBA.
  const png = new PNG({ width: S, height: S });
  cv.buf.copy(png.data);
  // pngjs' `PNG.sync.write(png, options)` accepts `colorType: 2` + `inputHasAlpha: true`
  // to drop the alpha channel during encoding. This is what actually flips
  // the file's IHDR colorType byte; setting it on the PNG constructor alone
  // does nothing for sync.write.
  const writeOpts = opts.shape === "square"
    ? { colorType: 2, inputHasAlpha: true, bitDepth: 8 }
    : undefined;
  const outPath = path.join(__dirname, "..", "assets", name);
  fs.writeFileSync(outPath, PNG.sync.write(png, writeOpts));
  console.log(`✓ ${name} (${S}×${S}, shape=${opts.shape}${opts.shape === "square" ? ", RGB no-alpha" : ""})`);
}

// ─── Entry ───────────────────────────────────────────────────────────────
save("icon.png",          1024, { shape: "square"   }); // iOS — opaque, OS masks corners
save("adaptive-icon.png", 1024, { shape: "maskable" }); // Android adaptive — full bleed
save("favicon.png",         64, { shape: "rounded"  }); // Web — rounded, brackets visible
save("splash-icon.png",   1024, { shape: "maskable" }); // Splash — bleed
