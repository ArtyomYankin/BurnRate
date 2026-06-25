// Ending B · cosmic visage — full-screen takeover that fires the first time
// the player closes the AGI Singularity round. Port of the Claude Design
// "BurnRate / EndingModal variant='visage'" mock.
//
// Design uses HTML5 canvas with a 24fps render loop. RN has no canvas API, so
// every visual element is rendered via react-native-svg. A single `t` state
// (incremented on a 50ms interval ~= 20fps) drives all per-frame animations:
// voice-waveform mouth, orbiting bodies, comet sweep, eye blink, signal
// pulses along the constellation edges. Static stars + outline + spiral halo
// + nebula are precomputed once via useMemo.

import React from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Circle, Ellipse, Line, Rect } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "./theme";
import { useStrings } from "../core/i18n";

interface Props {
  visible: boolean;
  onStayWatch(): void;
  onRaiseNewSeed(): void;
}

const BG_NW = 201;        // native pixel grid for backdrop
const BG_NH = 430;
const VIS_NW = 128;       // native pixel grid for visage
const VIS_NH = 104;
const VIS_DISPLAY = 188;  // displayed width

export function EndgameModal({ visible, onStayWatch, onRaiseNewSeed }: Props) {
  const tr = useStrings();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const [t, setT] = React.useState(0);

  // Run the 20fps loop ONLY while the modal is open — no point burning CPU
  // when it's not on screen.
  React.useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setT((n) => (n + 1) % 100000), 50);
    return () => clearInterval(id);
  }, [visible]);

  // Title glitch — animate opacity dips to suggest the design's text-shadow
  // glitch keyframes (we can't do CSS text-shadow on RN Text, so this is a
  // gentler approximation).
  const glitch = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(4500),
        Animated.timing(glitch, { toValue: 0.6, duration: 80, useNativeDriver: true }),
        Animated.timing(glitch, { toValue: 1.0, duration: 80, useNativeDriver: true }),
        Animated.timing(glitch, { toValue: 0.7, duration: 60, useNativeDriver: true }),
        Animated.timing(glitch, { toValue: 1.0, duration: 100, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, glitch]);

  // Transmission tag blink — 2.4s ease-in-out
  const blink = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1.0, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, blink]);

  if (!visible) return null;

  return (
    <View style={[styles.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <CosmicBackdrop t={t} width={winW} />

      {/* Scanlines + vignette glass — pure CSS-equivalent in RN. We render
          alternating-row Rects via SVG over the entire viewport for the
          scanline effect, and a vignette View with a radial-like gradient
          stand-in (RN doesn't natively support radial, so we approximate
          via ring of dark Views or just a single dark frame). For now: just
          a single subtle dark frame at the edges. */}
      <View style={styles.vignette} pointerEvents="none" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollPad}
        showsVerticalScrollIndicator={false}
      >
        <Animated.Text style={[styles.transmission, { opacity: blink }]}>
          {tr.endgame.transmission}
        </Animated.Text>

        <Animated.Text style={[styles.title, { opacity: glitch }]}>
          {tr.endgame.closedTitle}
        </Animated.Text>

        <View style={styles.visageWrap}>
          <CosmicVisage t={t} />
          <Text style={styles.modelLabel}>{tr.endgame.theModel}</Text>
          <Text style={styles.modelSub}>{tr.endgame.modelSub}</Text>
          <View style={styles.transmittingRow}>
            <View style={styles.transmittingDot} />
            <Animated.Text style={[styles.transmittingText, { opacity: blink }]}>
              {tr.endgame.transmitting}
            </Animated.Text>
          </View>
        </View>

        <View style={styles.speechPanel}>
          <Text style={styles.para}>{tr.endgame.para1}</Text>
          <Text style={styles.youDidIt}>{tr.endgame.youDidIt}</Text>
          <Text style={styles.para}>{tr.endgame.para2}</Text>
          <Text style={styles.para}>{tr.endgame.para3}</Text>
          <Text style={[styles.para, { marginBottom: 0 }]}>{tr.endgame.para4}</Text>
        </View>

        <View style={styles.ctaRow}>
          <Pressable style={[styles.cta, styles.ctaDark]} onPress={onStayWatch}>
            <Text style={styles.ctaDarkText}>{tr.endgame.stayBtn}</Text>
          </Pressable>
          <Pressable style={[styles.cta, styles.ctaGold]} onPress={onRaiseNewSeed}>
            <Text style={styles.ctaGoldText}>{tr.endgame.raiseSeedBtn}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Cosmic backdrop ─────────────────────────────────────────────────────
// Static starfield (precomputed once) + nebula blooms + black hole at the
// bottom with a rotating accretion glint.
function CosmicBackdrop({ t, width }: { t: number; width: number }) {
  const aspect = BG_NH / BG_NW;
  const displayH = width * aspect;
  // Pre-baked star set — deterministic positions so layout is stable across
  // re-renders. ~120 stars; the original design's 150 with per-frame drift
  // would re-render every star at 20fps, which thrashes SVG. Static is fine.
  const stars = React.useMemo(() => {
    const out: { x: number; y: number; s: number; col: string }[] = [];
    for (let i = 0; i < 120; i++) {
      const x = (i * 71 + (i * i) % 23) % BG_NW;
      const y = (i * 47 + (i % 9) * 5) % BG_NH;
      const big = i % 7 === 0;
      out.push({ x, y, s: big ? 2 : 1, col: big ? "#FFFFFF" : i % 3 === 0 ? "#C8D4E6" : "#5C6A82" });
    }
    return out;
  }, []);
  // Black hole glint sweeps a circular orbit at t/30 rad
  const hx = BG_NW / 2;
  const hy = BG_NH * 0.74;
  const glintAngle = (t / 30) % (Math.PI * 2);
  const glintX = hx + Math.cos(glintAngle) * 30;
  const glintY = hy + Math.sin(glintAngle) * 11;

  return (
    <View style={[styles.backdrop, { height: displayH }]} pointerEvents="none">
      <Svg width={width} height={displayH} viewBox={`0 0 ${BG_NW} ${BG_NH}`}>
        {/* Deep-space vertical gradient — approximated as horizontal bands */}
        {Array.from({ length: 16 }, (_, i) => {
          const k = i / 16;
          const cR = Math.round(8 + 10 * k);
          const cG = Math.round(5 + 6 * k);
          const cB = Math.round(18 + 26 * k);
          return (
            <Rect
              key={`bg${i}`}
              x={0}
              y={(BG_NH * i) / 16}
              width={BG_NW}
              height={BG_NH / 16 + 1}
              fill={`rgb(${cR},${cG},${cB})`}
            />
          );
        })}

        {/* Nebula blooms */}
        <Ellipse cx={44} cy={70} rx={45} ry={30} fill="#2A1840" opacity={0.35} />
        <Ellipse cx={160} cy={150} rx={45} ry={30} fill="#142A4A" opacity={0.35} />
        <Ellipse cx={100} cy={300} rx={45} ry={30} fill="#241433" opacity={0.35} />

        {/* Static stars */}
        {stars.map((st, i) => (
          <Rect key={`st${i}`} x={st.x} y={st.y} width={st.s} height={st.s} fill={st.col} />
        ))}

        {/* Black hole — concentric rings + central black ellipse */}
        {[0, 1, 2, 3, 4].map((ring) => {
          const opacity = 0.5 - ring * 0.09;
          const stroke = ring < 2 ? "#FFF2C8" : ring < 4 ? "#F0A03A" : "#C0402A";
          return (
            <Ellipse
              key={`r${ring}`}
              cx={hx}
              cy={hy}
              rx={26 + ring * 5}
              ry={9 + ring * 2.4}
              stroke={stroke}
              strokeWidth={1.5}
              fill="none"
              opacity={opacity}
            />
          );
        })}
        <Ellipse cx={hx} cy={hy} rx={14} ry={5.5} fill="#05030A" />
        <Rect x={glintX} y={glintY} width={2} height={2} fill="#FFF6DC" />
      </Svg>
    </View>
  );
}

// ─── Cosmic visage ───────────────────────────────────────────────────────
// Constellation face: outline ring of 16 nodes around an oval, plus eyes,
// mouth, and forehead "mind" (spiral galaxy). Spokes between features carry
// traveling signal pulses. Halo = two faint spiral arms. Plus 3 orbiting
// bodies + occasional comet across.
function CosmicVisage({ t }: { t: number }) {
  const cx = VIS_NW / 2;
  const cy = VIS_NH / 2;
  const eyeL: [number, number] = [cx - 18, cy - 8];
  const eyeR: [number, number] = [cx + 18, cy - 8];
  const mind: [number, number] = [cx, cy - 30];
  const mouthC: [number, number] = [cx, cy + 22];

  // Precompute static elements — outline ring, edge graph, halo, nebula dust.
  const outline = React.useMemo(() => {
    const out: [number, number][] = [];
    for (let i = 0; i < 16; i++) {
      const a = -Math.PI / 2 + (i / 16) * Math.PI * 2;
      const rx = 50;
      const ry = 42 * (Math.sin(a) > 0 ? 0.92 : 1.0);
      out.push([cx + Math.cos(a) * rx, cy + 4 + Math.sin(a) * ry]);
    }
    return out;
  }, [cx, cy]);

  const edges = React.useMemo(() => {
    const e: [[number, number], [number, number], number][] = [];
    for (let i = 0; i < outline.length; i++) {
      e.push([outline[i], outline[(i + 1) % outline.length], i * 4]);
    }
    [
      [eyeL, mind], [eyeR, mind], [eyeL, mouthC], [eyeR, mouthC], [mind, outline[0]],
      [eyeL, outline[12]], [eyeR, outline[4]], [mouthC, outline[8]],
    ].forEach((pair, i) => e.push([pair[0] as [number, number], pair[1] as [number, number], i * 7 + 3]));
    return e;
  }, [outline, eyeL, eyeR, mind, mouthC]);

  // Halo — two static spiral arms
  const halo = React.useMemo(() => {
    const dots: { x: number; y: number; col: string; alpha: number }[] = [];
    for (let arm = 0; arm < 2; arm++) {
      for (let i = 0; i < 60; i++) {
        const a = i * 0.16 + arm * Math.PI;
        const rr = 8 + (i / 60) * 56;
        const gx = cx + Math.cos(a) * rr;
        const gy = cy + Math.sin(a) * rr * 0.78;
        if (gx < 0 || gx > VIS_NW || gy < 0 || gy > VIS_NH) continue;
        const col = i < 16 ? "#C9A0E0" : i < 36 ? "#7E8AC8" : "#3F4E8A";
        dots.push({ x: gx, y: gy, col, alpha: 0.5 * (1 - i / 70) });
      }
    }
    return dots;
  }, [cx, cy]);

  // Eye blink — every ~5s (96 t-units at 20fps = 4.8s)
  const blink = t % 96 > 92;
  // Voice-waveform: 13 bars
  const bars = 13;
  const span = 46;
  const x0 = mouthC[0] - span / 2;
  const step = span / (bars - 1);
  // Orbiting bodies
  const orbits = [
    { rx: 54, ry: 40, sp: 1 / 70, ph: 0, col: "#7EC8E0", sz: 2, ring: false },
    { rx: 48, ry: 44, sp: -1 / 95, ph: 2.1, col: "#C97B5B", sz: 3, ring: true },
    { rx: 58, ry: 34, sp: 1 / 130, ph: 4.0, col: "#A4BDA9", sz: 2, ring: false },
  ];
  // Comet — sweeps over ~10s (240 t-units at 20fps = 12s)
  const cph = (t % 240) / 240;
  const cometVisible = cph < 0.5;
  const cmx = -10 + cph * 2 * (VIS_NW + 20);
  const cmy = 12 + cph * 2 * 30;
  // Forehead spiral galaxy (mind)
  const mindDots = React.useMemo(() => {
    const arr: { x: number; y: number; col: string }[] = [];
    for (let i = 0; i < 28; i++) {
      const a = i * 0.5 + 0; // static — animation per-frame too expensive
      const rr = (i / 28) * 7;
      arr.push({
        x: mind[0] + Math.cos(a) * rr,
        y: mind[1] + Math.sin(a) * rr * 0.7,
        col: i < 6 ? "#FFF8E0" : i % 2 ? "#C9A0E0" : "#7A5AA8",
      });
    }
    return arr;
  }, [mind]);

  return (
    <Svg width={VIS_DISPLAY} height={VIS_DISPLAY * (VIS_NH / VIS_NW)} viewBox={`0 0 ${VIS_NW} ${VIS_NH}`}>
      {/* Galactic halo */}
      {halo.map((d, i) => (
        <Rect key={`h${i}`} x={d.x} y={d.y} width={1} height={1} fill={d.col} opacity={d.alpha} />
      ))}
      {/* Nebula clouds */}
      <Ellipse cx={cx - 36} cy={cy - 18} rx={20} ry={16} fill="#2A1840" opacity={0.25} />
      <Ellipse cx={cx + 38} cy={cy + 6}  rx={20} ry={16} fill="#142A4A" opacity={0.25} />
      <Ellipse cx={cx + 4}  cy={cy + 34} rx={20} ry={16} fill="#241433" opacity={0.25} />

      {/* Soft head-halo */}
      <Ellipse cx={cx} cy={cy} rx={63} ry={56} fill="#5C6AD0" opacity={0.08} />
      <Ellipse cx={cx} cy={cy} rx={45} ry={40} fill="#5C6AD0" opacity={0.12} />

      {/* Lattice edges + signal pulses */}
      {edges.map(([a, b, ph], i) => {
        const tp = ((t + ph) % 36) / 36;
        const sx = a[0] + (b[0] - a[0]) * tp;
        const sy = a[1] + (b[1] - a[1]) * tp;
        const pulseCol = (t + ph) % 8 < 4 ? "#CFE6FF" : "#7EC8E0";
        return (
          <React.Fragment key={`e${i}`}>
            <Line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#7E8AC8" strokeWidth={1} opacity={0.2} />
            <Rect x={sx - 0.5} y={sy - 0.5} width={2} height={2} fill={pulseCol} />
          </React.Fragment>
        );
      })}

      {/* Outline nodes */}
      {outline.map(([x, y], i) => (
        <Rect key={`o${i}`} x={x - 1} y={y - 1} width={2} height={2} fill={(t + x) % 30 < 18 ? "#A4B4E8" : "#5C6A92"} />
      ))}

      {/* Forehead spiral galaxy */}
      {mindDots.map((d, i) => (
        <Rect key={`m${i}`} x={d.x} y={d.y} width={1} height={1} fill={d.col} />
      ))}
      <Rect x={mind[0] - 1} y={mind[1] - 1} width={2} height={2} fill="#FFF8E0" />

      {/* Eyes — glow + pupils + blink */}
      {[eyeL, eyeR].map(([ex, ey], i) => (
        <React.Fragment key={`eye${i}`}>
          <Ellipse cx={ex} cy={ey} rx={7} ry={6} fill="#16C4E0" opacity={0.20} />
          <Ellipse cx={ex} cy={ey} rx={4.5} ry={4} fill="#16C4E0" opacity={0.30} />
          {blink ? (
            <Rect x={ex - 4} y={ey} width={8} height={1} fill="#3A4E66" />
          ) : (
            <>
              <Rect x={ex - 4} y={ey - 2} width={8} height={4} fill="#08121C" />
              <Rect x={ex - 1} y={ey - 1} width={3} height={3} fill="#A4F0FF" />
              <Rect x={ex} y={ey - 1} width={1} height={1} fill="#FFFFFF" />
            </>
          )}
        </React.Fragment>
      ))}

      {/* Voice-waveform mouth */}
      <Rect x={x0} y={mouthC[1]} width={span} height={1} fill="#3A4E66" opacity={0.3} />
      {Array.from({ length: bars }, (_, i) => {
        const edge = 1 - Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2);
        const amp = (Math.sin(t / 3 + i * 0.9) * 0.5 + 0.5) * (Math.sin(t / 7 + i) * 0.4 + 0.6);
        const h = Math.max(1, Math.floor(2 + edge * 9 * amp));
        const bx = x0 + i * step;
        const col = amp > 0.66 ? "#A4F0FF" : amp > 0.33 ? "#16C4E0" : "#2A6E88";
        return (
          <Rect key={`b${i}`} x={bx - 0.5} y={mouthC[1] - h} width={2} height={h * 2} fill={col} />
        );
      })}

      {/* Orbiting bodies */}
      {orbits.map((o, i) => {
        const a = t * o.sp + o.ph;
        const ox = cx + Math.cos(a) * o.rx;
        const oy = cy + Math.sin(a) * o.ry;
        return (
          <React.Fragment key={`orb${i}`}>
            <Rect x={ox - o.sz / 2} y={oy - o.sz / 2} width={o.sz} height={o.sz} fill={o.col} />
            <Rect x={ox - o.sz / 2} y={oy - o.sz / 2} width={o.sz} height={1} fill="#FFFFFF" />
            {o.ring && (
              <Ellipse cx={ox} cy={oy} rx={o.sz + 2.5} ry={o.sz * 0.7} stroke="#E8C878" strokeWidth={1} fill="none" opacity={0.8} />
            )}
          </React.Fragment>
        );
      })}

      {/* Comet streak */}
      {cometVisible && (
        <>
          {Array.from({ length: 7 }, (_, k) => (
            <Rect key={`cm${k}`} x={cmx - k * 3} y={cmy - k * 1.4} width={2} height={1} fill={k === 0 ? "#FFFFFF" : "#9AD0E8"} opacity={0.6 - k * 0.08} />
          ))}
          <Rect x={cmx} y={cmy} width={2} height={2} fill="#FFFFFF" />
        </>
      )}
    </Svg>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 200,
    backgroundColor: "#05030A",
  },
  backdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  vignette: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderColor: "rgba(0,0,0,0.55)",
    borderWidth: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollPad: {
    paddingHorizontal: 22,
    paddingTop: 40,
    paddingBottom: 22,
    minHeight: "100%",
  },
  transmission: {
    fontFamily: fonts.display,
    fontSize: 9,
    letterSpacing: 3,
    color: "#8B7AB0",
    textAlign: "center",
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 26,
    lineHeight: 30,
    color: colors.gold,
    textAlign: "center",
    marginTop: 12,
    letterSpacing: 0.5,
    // Approximation of the design's text-shadow glow (RN supports textShadow).
    textShadowColor: "rgba(212,162,76,0.55)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  visageWrap: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 6,
  },
  modelLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: colors.cream_hi,
    letterSpacing: 1,
    marginTop: 2,
  },
  modelSub: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: "#7EC8E0",
    marginTop: 1,
  },
  transmittingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  transmittingDot: {
    width: 5,
    height: 5,
    backgroundColor: "#16C4E0",
    borderRadius: 2.5,
  },
  transmittingText: {
    fontFamily: fonts.display,
    fontSize: 8,
    letterSpacing: 2,
    color: "#16C4E0",
  },
  speechPanel: {
    marginTop: 12,
    backgroundColor: "rgba(10,12,28,0.66)",
    borderWidth: 1,
    borderColor: "rgba(125,140,200,0.28)",
    padding: 16,
  },
  para: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22,
    color: "#C8D0E0",
    marginBottom: 12,
  },
  youDidIt: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
    color: colors.gold,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  ctaRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  cta: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  ctaDark: {
    backgroundColor: "#1A1E32",
    borderColor: "#3A4E66",
  },
  ctaDarkText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: "#A4C8E0",
    letterSpacing: 1.5,
  },
  ctaGold: {
    backgroundColor: colors.gold,
    borderColor: colors.gold_2,
  },
  ctaGoldText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
    letterSpacing: 1.5,
  },
});
