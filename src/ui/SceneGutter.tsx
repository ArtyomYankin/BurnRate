import React from "react";
import Svg, {
  Circle, ClipPath, Defs, Ellipse, G, Line, LinearGradient, Path,
  RadialGradient, Rect, Stop,
} from "react-native-svg";
import type { SceneId } from "./PixelScene";
import { useTick } from "./PixelScene";

/**
 * Per-scene animated backdrop that fills the side gutters on tablets
 * (where the phone-shaped scene is centered with leftover width on both
 * sides). Ported from Claude Design v13 tablet layout — each era gets a
 * themed motif so the gutter reads as "the room continues past the
 * artboard" instead of a solid dead band.
 *
 * On phones (holeW === width), the phone fills the full width and the
 * motifs are clipped to zero-width regions — the SVG just renders the
 * base gradient which is invisible under the opaque scene.
 *
 * Rendered as `position:absolute; inset:0` in HomeScreen, with the
 * PixelScene stacked ON TOP centered by its own layout.
 */
interface Props {
  scene: SceneId;
  width: number;
  height: number;
  /** X position of the phone (left edge of PixelScene). */
  holeX: number;
  /** Width of the phone. */
  holeW: number;
}

interface GutterTheme {
  top: string;
  bot: string;
  floor: string;
  floorTop: string;
  motif: MotifKind;
  accent: string;
  ink: string;
}

type MotifKind =
  | "garage" | "cowork" | "office" | "corp"
  | "campus" | "datacenter" | "planetary" | "agi";

const GUTTER: Record<SceneId, GutterTheme> = {
  seed:       { top: "#EADFC6", bot: "#D8C39A", floor: "#B99668", floorTop: "#CBA878", motif: "garage",     accent: "#C97B5B", ink: "#5C4A34" },
  coworking:  { top: "#EFE7D4", bot: "#D9E0CC", floor: "#B79A6E", floorTop: "#CBB184", motif: "cowork",     accent: "#7E9A85", ink: "#5C5240" },
  office:     { top: "#E9D8C4", bot: "#C99A82", floor: "#9A6E52", floorTop: "#B48562", motif: "office",     accent: "#B4553C", ink: "#5A3826" },
  megacorp:   { top: "#D8DDE4", bot: "#AEB7C2", floor: "#7C8794", floorTop: "#98A2AE", motif: "corp",       accent: "#5C7CA8", ink: "#3A444F" },
  campus:     { top: "#EDE4D2", bot: "#CFD7C4", floor: "#A9855C", floorTop: "#C29C6E", motif: "campus",     accent: "#7E9A85", ink: "#5A4A34" },
  datacenter: { top: "#1A2028", bot: "#0C1016", floor: "#0A0E14", floorTop: "#16202A", motif: "datacenter", accent: "#16C4E0", ink: "#0E1A22" },
  planetary:  { top: "#0C1A33", bot: "#050A18", floor: "#04060E", floorTop: "#0A1426", motif: "planetary",  accent: "#D4A24C", ink: "#0A1830" },
  agi:        { top: "#160E22", bot: "#05030A", floor: "#04020A", floorTop: "#0E0A18", motif: "agi",        accent: "#FF9A3A", ink: "#1A0E22" },
};

export function SceneGutter({ scene, width, height, holeX, holeW }: Props) {
  const t = useTick(200);
  if (width <= 0 || height <= 0) return null;
  const g = GUTTER[scene];
  const floorY = Math.round(height * 0.72);
  const leftW = Math.max(0, holeX);
  const rightX = holeX + holeW;
  const rightW = Math.max(0, width - rightX);
  const gradId = `gutterWall-${scene}`;
  const vigId = `gutterVig-${scene}`;
  const clipLeftId = `gutterClipL-${scene}`;
  const clipRightId = `gutterClipR-${scene}`;
  const shadeLeftId = `gutterShadeL-${scene}`;
  const shadeRightId = `gutterShadeR-${scene}`;

  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2={height}>
          <Stop offset="0" stopColor={g.top} />
          <Stop offset="1" stopColor={g.bot} />
        </LinearGradient>
        <RadialGradient id={vigId}
          cx={width / 2} cy={height / 2}
          rx={Math.max(width, height) * 0.7} ry={Math.max(width, height) * 0.7}
          fx={width / 2} fy={height / 2} gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.22} />
        </RadialGradient>
        {leftW > 0 && (
          <LinearGradient id={shadeLeftId} x1={holeX - 26} y1="0" x2={holeX} y2="0" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#000" stopOpacity={0} />
            <Stop offset="1" stopColor="#000" stopOpacity={0.28} />
          </LinearGradient>
        )}
        {rightW > 0 && (
          <LinearGradient id={shadeRightId} x1={rightX} y1="0" x2={rightX + 26} y2="0" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#000" stopOpacity={0.28} />
            <Stop offset="1" stopColor="#000" stopOpacity={0} />
          </LinearGradient>
        )}
        <ClipPath id={clipLeftId}>
          <Rect x={0} y={0} width={leftW} height={height} />
        </ClipPath>
        <ClipPath id={clipRightId}>
          <Rect x={rightX} y={0} width={rightW} height={height} />
        </ClipPath>
      </Defs>

      {/* Base wall gradient */}
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${gradId})`} />
      {/* Soft radial vignette */}
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${vigId})`} />
      {/* Floor band */}
      <Rect x={0} y={floorY} width={width} height={height - floorY} fill={g.floor} />
      <Rect x={0} y={floorY} width={width} height={3} fill={g.floorTop} />

      {/* Left + right motif regions */}
      {leftW > 0 && (
        <G clipPath={`url(#${clipLeftId})`}>
          <Motif g={g} kind={g.motif} t={t} ox={0} rw={leftW} h={height} floorY={floorY} mirror={false} />
        </G>
      )}
      {rightW > 0 && (
        <G clipPath={`url(#${clipRightId})`}>
          <Motif g={g} kind={g.motif} t={t} ox={rightX} rw={rightW} h={height} floorY={floorY} mirror={true} />
        </G>
      )}

      {/* Contact shadows hugging the phone edges */}
      {leftW > 0 && (
        <Rect x={holeX - 26} y={0} width={26} height={height} fill={`url(#${shadeLeftId})`} />
      )}
      {rightW > 0 && (
        <Rect x={rightX} y={0} width={26} height={height} fill={`url(#${shadeRightId})`} />
      )}
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Motif dispatcher — one component per era. `ox` is region-left, `rw` is
// region-width, `mirror` flips composition so both sides frame the phone.
// `near(d)` maps "d px in from the phone" to the correct x depending on
// which side we're on — same helper the design uses.
interface MotifProps {
  g: GutterTheme;
  kind: MotifKind;
  t: number;
  ox: number;
  rw: number;
  h: number;
  floorY: number;
  mirror: boolean;
}
function Motif(props: MotifProps) {
  switch (props.kind) {
    case "garage":     return <Garage {...props} />;
    case "cowork":     return <Cowork {...props} />;
    case "office":     return <Office {...props} />;
    case "corp":       return <Corp {...props} />;
    case "campus":     return <Campus {...props} />;
    case "datacenter": return <Datacenter {...props} />;
    case "planetary":  return <Planetary {...props} />;
    case "agi":        return <Agi {...props} />;
  }
}

function nearFn(ox: number, rw: number, mirror: boolean) {
  return (d: number) => mirror ? ox + d : ox + rw - d;
}

// ═══ SEED · garage: pegboard, tools, cardboard boxes, hanging lamp ═══
function Garage({ t, ox, rw, floorY, mirror }: MotifProps) {
  const near = nearFn(ox, rw, mirror);
  const pbW = Math.min(150, rw - 40);
  const pbH = 150;
  const pbY = 70;
  const pbX = mirror ? ox + 30 : ox + rw - 30 - pbW;
  const bx = mirror ? ox + 24 : ox + rw - 24 - 96;
  const cc = near(60);
  const sway = Math.sin(t / 40) * 6;
  const lx = mirror ? ox + rw - 40 + sway : ox + 40 + sway;
  const pegDots: React.ReactNode[] = [];
  for (let y = pbY + 10; y < pbY + pbH - 6; y += 14) {
    for (let x = pbX + 10; x < pbX + pbW - 6; x += 14) {
      pegDots.push(<Rect key={`pd${x}-${y}`} x={x} y={y} width={1} height={1} fill="#A6845A" />);
    }
  }
  return (
    <G>
      {/* Pegboard panel */}
      <Rect x={pbX} y={pbY} width={pbW} height={pbH} fill="#C9A876" />
      <Rect x={pbX} y={pbY} width={pbW} height={3} fill="#DDBE8A" />
      {pegDots}
      {/* Tools: hammer + wrench + screwdriver */}
      <Rect x={pbX + 22} y={pbY + 16} width={4}  height={34} fill="#7C5030" />
      <Rect x={pbX + 16} y={pbY + 12} width={16} height={8}  fill="#5A5E66" />
      <Rect x={pbX + 52} y={pbY + 14} width={5}  height={40} fill="#9AA0A8" />
      <Rect x={pbX + 48} y={pbY + 12} width={13} height={8}  fill="#9AA0A8" />
      <Rect x={pbX + 84} y={pbY + 16} width={3}  height={32} fill="#C97B5B" />
      <Rect x={pbX + 82} y={pbY + 12} width={7}  height={8}  fill="#8B5639" />
      {/* Stacked cardboard boxes */}
      <Rect x={bx}      y={floorY - 60} width={96} height={60} fill="#B78B54" />
      <Rect x={bx}      y={floorY - 60} width={96} height={3}  fill="#C99A66" />
      <Rect x={bx + 34} y={floorY - 60} width={3}  height={60} fill="#8B6A3E" />
      <Rect x={bx + 12} y={floorY - 96} width={66} height={36} fill="#C1955C" />
      <Rect x={bx + 12} y={floorY - 96} width={66} height={3}  fill="#D2A76C" />
      <Rect x={bx + 30} y={floorY - 96} width={20} height={4}  fill="#E4D2A8" />
      {/* Coiled extension cord — 3 concentric rings */}
      {[24, 16, 8].map((r) => (
        <Circle key={`cc${r}`} cx={cc} cy={floorY - 150} r={r} stroke="#3A3A3A" strokeWidth={3} fill="none" />
      ))}
      {/* Hanging work lamp with warm glow */}
      <Line x1={lx - sway} y1={0} x2={lx} y2={54} stroke="#2A2A2A" strokeWidth={2} />
      <Circle cx={lx} cy={62} r={26} fill="#F4D07A" opacity={0.5} />
      <Rect x={lx - 8} y={54} width={16} height={10} fill="#3A3A3A" />
      <Rect x={lx} y={60} width={1} height={1} fill="#FFF3C8" />
    </G>
  );
}

// ═══ COWORKING · edison bulbs, kanban stickies, monstera plant ═══
function Cowork({ t, ox, rw, floorY, mirror }: MotifProps) {
  const near = nearFn(ox, rw, mirror);
  const bulbXs: number[] = [];
  for (let x = ox + 24; x < ox + rw - 10; x += 54) bulbXs.push(x);
  const stringPath = `M ${ox} 20 Q ${ox + rw / 2} 34 ${ox + rw} 20`;
  const kbW = Math.min(140, rw - 50);
  const kbH = 96;
  const kbY = 90;
  const kbX = mirror ? ox + 30 : ox + rw - 30 - kbW;
  const sticky = ["#F4CE6E", "#7E9A85", "#C97B5B", "#8FB0C4"];
  const stickyNodes: React.ReactNode[] = [];
  for (let c = 0; c < 3; c++) {
    for (let rrow = 0; rrow < 3; rrow++) {
      if ((c + rrow) % 4 === 3) continue;
      const sx = kbX + 10 + c * (kbW / 3);
      const sy = kbY + 10 + rrow * 26;
      stickyNodes.push(
        <G key={`s${c}-${rrow}`}>
          <Rect x={sx} y={sy} width={22} height={20} fill={sticky[(c + rrow) % 4]} />
          <Rect x={sx + 3} y={sy + 5} width={16} height={2} fill="#000" opacity={0.18} />
          <Rect x={sx + 3} y={sy + 10} width={12} height={2} fill="#000" opacity={0.12} />
        </G>
      );
    }
  }
  return (
    <G>
      {/* String of Edison bulbs — sagging path + glowing bulbs */}
      <Path d={stringPath} stroke="#3A3226" strokeWidth={2} fill="none" />
      {bulbXs.map((x) => {
        const glow = (t + x) % 24 > 2;
        const y = 26;
        return (
          <G key={`b${x}`}>
            <Circle cx={x} cy={y + 6} r={12} fill="#F4CE6E" opacity={glow ? 0.5 : 0.2} />
            <Rect x={x - 3} y={y} width={6} height={8} fill="#E9B84E" />
            <Rect x={x - 2} y={y - 3} width={4} height={3} fill="#8B7A4A" />
          </G>
        );
      })}
      {/* Kanban board with columns + stickies */}
      <Rect x={kbX - 3} y={kbY - 3} width={kbW + 6} height={kbH + 6} fill="#EDE7D6" />
      <Rect x={kbX} y={kbY} width={kbW} height={kbH} fill="#F6F1E4" />
      {[0, 1, 2].map((c) => (
        <Rect key={`kc${c}`} x={kbX + 6 + c * (kbW / 3)} y={kbY + 4} width={1} height={kbH - 8} fill="#D8D0BC" />
      ))}
      {stickyNodes}
      <PlantSprite cx={near(70)}  baseY={floorY} s={1.4} t={t} />
      <PlantSprite cx={near(150)} baseY={floorY} s={0.8} t={t + 20} />
    </G>
  );
}

/** Reusable monstera-in-terracotta-pot sprite. */
function PlantSprite({ cx, baseY, s, t }: { cx: number; baseY: number; s: number; t: number }) {
  const sway = Math.sin(t / 50) * 3;
  const leaves: [number, number, number][] = [
    [-20, -60, -0.5], [20, -64, 0.5], [0, -78, 0], [-30, -40, -0.9], [30, -44, 0.9],
  ];
  return (
    <G>
      {/* Pot */}
      <Rect x={cx - 16 * s} y={baseY - 20 * s} width={32 * s} height={20 * s} fill="#B4553C" />
      <Rect x={cx - 16 * s} y={baseY - 20 * s} width={32 * s} height={3 * s}  fill="#C86E52" />
      <Rect x={cx - 18 * s} y={baseY - 22 * s} width={36 * s} height={4 * s}  fill="#9A472F" />
      {/* Leaves */}
      {leaves.map(([dx, dy, ang], i) => {
        const rot = ang * 0.4 * (180 / Math.PI);
        const lx = cx + dx * s + sway;
        const ly = baseY + dy * s;
        return (
          <G key={`lf${i}`} transform={`rotate(${rot} ${lx} ${ly})`}>
            <Ellipse cx={lx}         cy={ly}         rx={16 * s} ry={26 * s} fill="#5C7560" />
            <Ellipse cx={lx - 2 * s} cy={ly - 2 * s} rx={10 * s} ry={18 * s} fill="#7E9A85" />
          </G>
        );
      })}
    </G>
  );
}

// ═══ OFFICE · exposed brick + framed posters ═══
function Office({ t, ox, rw, floorY, mirror, g }: MotifProps) {
  const near = nearFn(ox, rw, mirror);
  const bricks: React.ReactNode[] = [];
  const bh = 18, bw = 46;
  let row = 0;
  for (let y = 0; y < floorY; y += bh, row++) {
    const off = (row % 2) * (bw / 2);
    for (let x = ox - bw; x < ox + rw + bw; x += bw) {
      const brickX = x + off;
      bricks.push(<Rect key={`br${row}-${brickX}`} x={brickX + 1} y={y + 1} width={bw - 2} height={bh - 2} fill="#B4553C" />);
      bricks.push(<Rect key={`bh${row}-${brickX}`} x={brickX + 1} y={y + 1} width={bw - 2} height={2}      fill="#C66C50" />);
    }
  }
  const posters: [string, string][] = [["MOVE FAST", "#F4CE6E"], ["SHIP IT", "#7E9A85"], ["$", "#E8DCC0"]];
  const pW = 84, pH = 104;
  const p = posters[mirror ? 0 : 1];
  const pX = mirror ? ox + 34 : ox + rw - 34 - pW;
  const lx = near(64);
  return (
    <G>
      {bricks}
      {/* Dim overlay tints the whole wall darker */}
      <Rect x={ox} y={0} width={rw} height={floorY} fill="#2A1810" opacity={0.12} />
      {/* Framed poster */}
      <Rect x={pX - 4} y={74} width={pW + 8} height={pH + 8} fill="#2A2018" />
      <Rect x={pX}     y={78} width={pW}     height={pH}     fill="#EDE4D0" />
      <Rect x={pX}     y={78} width={pW}     height={20}     fill={p[1]} />
      <Rect x={pX + 10} y={108} width={pW - 20} height={6} fill={g.ink} />
      <Rect x={pX + 10} y={122} width={pW - 30} height={4} fill="#9A6E52" />
      <Rect x={pX + 14} y={pH + 40} width={pW - 28} height={pH - 60} fill={p[1]} />
      {/* Pendant lamp */}
      <Line x1={lx} y1={0} x2={lx} y2={40} stroke="#2A2018" strokeWidth={2} />
      <Rect x={lx - 12} y={40} width={24} height={14} fill="#2A2018" />
      <Circle cx={lx} cy={58} r={20} fill="#F4CE6E" opacity={0.4} />
      <PlantSprite cx={near(64)} baseY={floorY} s={1.1} t={t} />
    </G>
  );
}

// ═══ MEGACORP · glass curtain wall, mullion grid, drifting aircraft ═══
function Corp({ t, ox, rw, h, floorY }: MotifProps) {
  const mullionsV: React.ReactNode[] = [];
  for (let x = ox - 40; x < ox + rw + 40; x += 68) mullionsV.push(<Rect key={`mv${x}`} x={x} y={0} width={3} height={floorY} fill="#8A97A6" />);
  const mullionsH: React.ReactNode[] = [];
  for (let y = 40; y < floorY; y += 90) mullionsH.push(<Rect key={`mh${y}`} x={ox} y={y} width={rw} height={3} fill="#8A97A6" />);
  const skyline: React.ReactNode[] = [];
  const hs = [30, 60, 44, 80, 52, 96, 40];
  for (let x = ox; x < ox + rw; x += 5) {
    const hh = hs[Math.floor(x) % 7];
    skyline.push(<Rect key={`sk${x}`} x={x} y={floorY - hh} width={4} height={hh} fill="#5C6C7C" opacity={0.18} />);
  }
  const planeX = ox + ((t * 0.5) % (rw + 60)) - 30;
  const contrail: React.ReactNode[] = [];
  for (let i = 1; i < 12; i++) {
    contrail.push(<Rect key={`ct${i}`} x={planeX - i * 3} y={60} width={3} height={1} fill="#EEF2F6" opacity={0.5 - i * 0.03} />);
  }
  const carpet: React.ReactNode[] = [];
  for (let x = ox - 40; x < ox + rw + 40; x += 40) {
    for (let y = floorY; y < h; y += 40) {
      if ((((x + y) / 40) | 0) % 2 === 0) {
        carpet.push(<Rect key={`ct${x}-${y}`} x={x} y={y} width={40} height={40} fill="#6C7784" opacity={0.5} />);
      }
    }
  }
  return (
    <G>
      <Rect x={ox} y={0} width={rw} height={floorY} fill="#C6D0DC" />
      {mullionsV}
      {mullionsH}
      {/* Sky wash in panes */}
      <Rect x={ox} y={0} width={rw} height={floorY} fill="#B4CDE6" opacity={0.3} />
      {skyline}
      {contrail}
      <Rect x={planeX}     y={59} width={7} height={2} fill="#E8EEF4" />
      <Rect x={planeX + 7} y={59} width={2} height={1} fill="#B8C2CE" />
      {carpet}
      <PlantSprite cx={nearFn(ox, rw, false)(70)} baseY={floorY} s={1.0} t={t} />
    </G>
  );
}

// ═══ CAMPUS · oak slat walls + glass door with courtyard trees ═══
function Campus({ t, ox, rw, floorY, mirror }: MotifProps) {
  const near = nearFn(ox, rw, mirror);
  const slats: React.ReactNode[] = [];
  for (let x = ox - 20; x < ox + rw + 20; x += 16) {
    slats.push(<Rect key={`sl${x}a`} x={x}      y={0} width={13} height={floorY} fill="#B78B54" />);
    slats.push(<Rect key={`sl${x}b`} x={x}      y={0} width={3}  height={floorY} fill="#C99A66" />);
    slats.push(<Rect key={`sl${x}c`} x={x + 12} y={0} width={1}  height={floorY} fill="#8B6A3E" />);
  }
  const dW = Math.min(150, rw - 40);
  const dY = 40;
  const dH = floorY - dY;
  const dX = mirror ? ox + 28 : ox + rw - 28 - dW;
  const trees: React.ReactNode[] = [];
  for (let i = 0; i < 4; i++) {
    const gx = dX + 16 + i * (dW / 4);
    trees.push(<Rect key={`tr${i}a`} x={gx} y={floorY - 60} width={4} height={60} fill="#5C7560" opacity={0.5} />);
    trees.push(<Circle key={`tr${i}b`} cx={gx + 2} cy={floorY - 66} r={16} fill="#7E9A85" opacity={0.5} />);
  }
  return (
    <G>
      {slats}
      <Rect x={ox} y={0} width={rw} height={floorY} fill="#2A1E10" opacity={0.10} />
      {/* Glass door */}
      <Rect x={dX} y={dY} width={dW}       height={dH} fill="#CFE0D8" opacity={0.85} />
      <Rect x={dX} y={dY} width={dW}       height={3}  fill="#EAF2ED" />
      <Rect x={dX + dW / 2} y={dY} width={2} height={dH} fill="#9AB0A6" />
      <Rect x={dX}          y={dY} width={2} height={dH} fill="#9AB0A6" />
      <Rect x={dX + dW - 2} y={dY} width={2} height={dH} fill="#9AB0A6" />
      {trees}
      <PlantSprite cx={near(66)} baseY={floorY} s={1.5} t={t} />
    </G>
  );
}

// ═══ DATACENTER · dark racks + bicolor LED rows + cable trays ═══
function Datacenter({ t, ox, rw, h, floorY }: MotifProps) {
  const rackW = 44, gap = 20;
  const parts: React.ReactNode[] = [];
  for (let x = ox + 10; x < ox + rw - 20; x += rackW + gap) {
    parts.push(<Rect key={`rk${x}a`} x={x} y={60} width={rackW} height={floorY - 60} fill="#141A22" />);
    parts.push(<Rect key={`rk${x}b`} x={x} y={60} width={rackW} height={2}           fill="#26303C" />);
    for (let ly = 74; ly < floorY - 10; ly += 8) {
      const on = (t + x + ly) % 24 < 14;
      const cyan = ((x + ly) % 3 === 0);
      const col = on ? (cyan ? "#16C4E0" : "#7EE0A0") : "#0E2A30";
      parts.push(<Rect key={`ld${x}-${ly}L`} x={x + 6}          y={ly} width={4} height={3} fill={col} />);
      parts.push(<Rect key={`ld${x}-${ly}R`} x={x + rackW - 12} y={ly} width={4} height={3} fill={on ? "#E8B24C" : "#3A2A10"} />);
    }
  }
  const trays: React.ReactNode[] = [];
  for (let x = ox; x < ox + rw; x += 10) {
    trays.push(<Rect key={`tr${x}`} x={x} y={32} width={6} height={4} fill="#2A3A44" />);
  }
  const floorGrid: React.ReactNode[] = [];
  for (let x = ox; x < ox + rw; x += 30) {
    floorGrid.push(<Rect key={`fg${x}`} x={x} y={floorY} width={2} height={h - floorY} fill="#16202A" />);
  }
  return (
    <G>
      <Rect x={ox} y={0} width={rw} height={h} fill="#0C1016" />
      {parts}
      <Rect x={ox} y={30} width={rw} height={8} fill="#1C2630" />
      {trays}
      {floorGrid}
      <Rect x={ox} y={floorY} width={rw} height={2} fill="#1E2A34" />
      <Rect x={ox} y={floorY - 40} width={rw} height={40} fill="#16C4E0" opacity={0.08} />
    </G>
  );
}

// ═══ PLANETARY · starfield + nebula + city-light network ═══
function Planetary({ t, ox, rw, h }: MotifProps) {
  const stars: React.ReactNode[] = [];
  for (let i = 0; i < 90; i++) {
    const sx = ox + ((i * 71 + (i * i) % 17) % rw);
    const sy = (i * 43) % h;
    const tw = (t + i * 5) % 40;
    const c = i % 5 === 0 ? (tw < 20 ? "#FFFFFF" : "#9AA8C0") : (tw < 26 ? "#C8D4E6" : "#4C5A72");
    stars.push(<Rect key={`st${i}`} x={sx} y={sy} width={1} height={1} fill={c} />);
  }
  const nebulae: React.ReactNode[] = [];
  const nb: [number, number, string][] = [[0.3, 0.25, "#2A1840"], [0.7, 0.6, "#142A4A"]];
  nb.forEach(([nx, ny, col], j) => {
    for (let ggr = 6; ggr > 0; ggr--) {
      nebulae.push(
        <Ellipse key={`nb${j}-${ggr}`}
          cx={ox + rw * nx} cy={h * ny}
          rx={ggr * 12} ry={ggr * 9}
          fill={col} opacity={0.12} />
      );
    }
  });
  const nodes: [number, number][] = [[0.35, 0.4], [0.6, 0.7], [0.5, 0.2]];
  const network: React.ReactNode[] = [];
  let prev: [number, number] | null = null;
  nodes.forEach(([nx, ny], idx) => {
    const cx = ox + rw * nx;
    const cy = h * ny;
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39996;
      const rr = Math.sqrt(i / 26) * 20;
      const flick = (t + i * 7) % 30 < 24;
      const col = flick ? (i % 4 === 0 ? "#FBE6A8" : "#D4A24C") : "#6B481E";
      network.push(<Rect key={`nn${idx}-${i}`} x={Math.round(cx + Math.cos(a) * rr)} y={Math.round(cy + Math.sin(a) * rr)} width={1} height={1} fill={col} />);
    }
    network.push(<Rect key={`nh${idx}`} x={cx - 1} y={cy - 1} width={2} height={2} fill="#FFF8E0" />);
    if (prev) {
      network.push(<Line key={`nl${idx}`} x1={prev[0]} y1={prev[1]} x2={cx} y2={cy} stroke="#D4A24C" strokeWidth={1} opacity={0.2} />);
    }
    prev = [cx, cy];
  });
  return (
    <G>
      {nebulae}
      {stars}
      {network}
    </G>
  );
}

// ═══ AGI · cosmic void + accretion glow + spiral galaxy ═══
function Agi({ t, ox, rw, h, mirror }: MotifProps) {
  const stars: React.ReactNode[] = [];
  for (let i = 0; i < 100; i++) {
    const sx = ox + ((i * 67 + (i * i) % 19) % rw);
    const sy = (i * 51) % h;
    const tw = (t + i * 4) % 40;
    const c = i % 6 === 0 ? (tw < 18 ? "#FFFFFF" : "#9AA8C0") : (tw < 24 ? "#C8B0E0" : "#443055");
    stars.push(<Rect key={`st${i}`} x={sx} y={sy} width={1} height={1} fill={c} />);
  }
  const gx = mirror ? ox : ox + rw;
  const washId = `agiWash-${mirror ? "r" : "l"}`;
  const cx = ox + rw * (mirror ? 0.7 : 0.3);
  const cy = h * 0.3;
  const galaxy: React.ReactNode[] = [];
  for (let arm = 0; arm < 2; arm++) {
    for (let i = 0; i < 40; i++) {
      const a = i * 0.2 + arm * Math.PI + t / 200;
      const rr = (i / 40) * 34;
      if ((t + i * 3) % 34 < 24) {
        const px = Math.round(cx + Math.cos(a) * rr);
        const py = Math.round(cy + Math.sin(a) * rr * 0.6);
        galaxy.push(<Rect key={`gx${arm}-${i}`} x={px} y={py} width={1} height={1} fill={i < 10 ? "#C9A0E0" : "#7A5AA8"} />);
      }
    }
  }
  return (
    <G>
      <Defs>
        <RadialGradient id={washId}
          cx={gx} cy={h * 0.5} rx={rw * 1.2} ry={rw * 1.2}
          fx={gx} fy={h * 0.5} gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0"   stopColor="#FF8C32" stopOpacity={0.22} />
          <Stop offset="0.4" stopColor="#78285A" stopOpacity={0.12} />
          <Stop offset="1"   stopColor="#000000" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {stars}
      <Rect x={ox} y={0} width={rw} height={h} fill={`url(#${washId})`} />
      {galaxy}
      <Rect x={cx - 1} y={cy - 1} width={2} height={2} fill="#FFF8E8" />
    </G>
  );
}
