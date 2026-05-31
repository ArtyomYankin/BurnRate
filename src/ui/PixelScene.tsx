import React from "react";
import { Pressable, View } from "react-native";
import Svg, {
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { colors } from "./theme";

// ─── Scene constants ────────────────────────────────────────────────────
// Native scene coords match the Claude Design `pixel-art.jsx` system so
// every sprite ports with the same x/y/w/h numbers. SVG viewBox scales
// the 240×360 canvas to whatever container the parent docks us into.
const W = 240;
const H = 360;
const FLOOR_Y = 222;

// ─── Palette alias ──────────────────────────────────────────────────────
// Match the design's `P` shorthand so port lines read the same way.
const P = {
  cream:        colors.cream,
  cream_hi:     colors.cream_hi,
  cream_2:      colors.cream_2,
  cream_3:      colors.cream_3,
  cream_4:      colors.cream_4,
  sage:         colors.sage,
  sage_hi:      colors.sage_hi,
  sage_2:       colors.sage_2,
  sage_3:       colors.sage_3,
  terracotta:   colors.terracotta,
  terracotta_hi:colors.terracotta_hi,
  terracotta_2: colors.terracotta_2,
  terracotta_3: colors.terracotta_3,
  ink:          colors.ink,
  ink_2:        colors.ink_2,
  ink_hi:       colors.ink_hi,
  tension:      colors.tensionRed,
  tension_2:    colors.tension_2,
  tension_hi:   colors.tension_hi,
  gold:         colors.gold,
  gold_hi:      colors.gold_hi,
  gold_2:       colors.gold_2,
  muted:        colors.muted,
  muted_2:      colors.muted_2,
  sky:          colors.sky,
  sky_2:        colors.sky_2,
  sky_3:        colors.sky_3,
  cloud:        colors.cloud,
};

// ─── Hit zones ──────────────────────────────────────────────────────────
export type HitId =
  | "engineer"
  | "monitor"
  | "gpu"
  | "books"
  | "energy"
  | "research"
  | "plant"
  | "mug"
  | "pizza"
  | "clock"
  | "window"
  | "roomba";

export interface HitZone {
  id: HitId;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
}

export type SceneId = "seed" | "megacorp" | "agi";

// Per-scene hit zones. Coords align with each scene's sprite positions below —
// keep them in sync if you move anything. HomeScreen reads the resulting HitId
// (the action is the same across scenes — buy a chain, train, research), so the
// popup/flavor logic needs no scene awareness; only the touch geometry changes.

// SEED GARAGE — every interaction has a diegetic prop (the original layout).
const SEED_ZONES: HitZone[] = [
  { id: "window",   x:  18, y:  96, w: 54, h: 40, label: "Time Skip" },
  { id: "clock",    x:  84, y: 100, w: 14, h: 14, label: "Clock" },
  { id: "research", x: 110, y: 100, w: 36, h: 26, label: "Research" },
  { id: "energy",   x: 180, y: 210, w: 32, h: 10, label: "Buy Energy" },
  { id: "monitor",  x:  56, y: 232, w: 26, h: 24, label: "Training Run" },
  { id: "engineer", x:  60, y: 254, w: 22, h: 28, label: "Hire Intern" },
  { id: "mug",      x:  34, y: 247, w:  9, h: 8,  label: "Coffee +10%" },
  { id: "pizza",    x: 112, y: 250, w: 14, h:  6, label: "Slack DM" },
  { id: "gpu",      x:  90, y: 260, w: 18, h: 32, label: "Buy GPU" },
  { id: "books",    x:   8, y: 294, w: 16, h: 14, label: "Buy Data" },
  { id: "plant",    x: 210, y: 274, w: 18, h: 26, label: "Cosmetic" },
  { id: "roomba",   x: 152, y: 302, w: 14, h: 8,  label: "Autonomous Agent" },
];

// MEGACORP OFFICE — zones map to what each object IS, so the action is always
// logical: every engineer figure hires Engineers, every monitor launches a
// Training Run, the in-glass GPU rack is Compute, the kanban whiteboard is
// Research, the floor storage boxes are Data, and the wall HVAC unit is Energy.
// Ids repeat across the 3 desks on purpose (all engineers = Hire, all monitors
// = Training); the overlay keys them by index and the ring highlights every
// matching object. Matches the drawn positions in MegacorpScene (desks at
// x=12/92/172, deskY=256; glass rack 130,100; kanban 158,80; boxes ~20,320;
// AC ~208,148).
const MEGACORP_ZONES: HitZone[] = [
  // desk 1 / 2 / 3 — monitor (Training) above, engineer (Hire) below
  { id: "monitor",  x:  26, y: 230, w: 34, h: 26, label: "Training Run" },
  { id: "engineer", x:  28, y: 260, w: 34, h: 38, label: "Hire Engineers" },
  { id: "monitor",  x: 106, y: 230, w: 34, h: 26, label: "Training Run" },
  { id: "engineer", x: 108, y: 260, w: 34, h: 38, label: "Hire Engineers" },
  { id: "monitor",  x: 186, y: 230, w: 34, h: 26, label: "Training Run" },
  { id: "engineer", x: 188, y: 260, w: 34, h: 38, label: "Hire Engineers" },
  { id: "gpu",      x: 130, y: 100, w: 18, h: 60, label: "Buy GPU (rack)" },
  { id: "research", x: 158, y:  80, w: 80, h: 34, label: "Research (kanban)" },
  { id: "books",    x:  16, y: 310, w: 26, h: 22, label: "Buy Data (boxes)" },
  { id: "energy",   x: 204, y: 144, w: 28, h: 18, label: "Buy Energy (HVAC)" },
];

// AGI SINGULARITY — no diegetic producer props exist in deep space, so zones
// map to the scene's landmarks abstractly: Earth = the human workforce, the
// megastructure = Compute, the singularity flare = Training, and three sky
// quadrants cover Data / Energy / Research. The popup names each on tap.
const AGI_ZONES: HitZone[] = [
  { id: "engineer", x:   8, y: 292, w: 92, h: 60, label: "Hire (Earth)" },
  { id: "gpu",      x: 118, y: 121, w: 60, h: 60, label: "Buy GPU (core)" },
  { id: "monitor",  x:  40, y: 308, w: 24, h: 24, label: "Training (flare)" },
  { id: "books",    x:   8, y:  28, w: 70, h: 34, label: "Buy Data" },
  { id: "energy",   x: 168, y:  36, w: 64, h: 44, label: "Buy Energy" },
  { id: "research", x: 186, y: 150, w: 48, h: 44, label: "Research" },
];

export const HIT_ZONES_BY_SCENE: Record<SceneId, HitZone[]> = {
  seed: SEED_ZONES,
  megacorp: MEGACORP_ZONES,
  agi: AGI_ZONES,
};

/**
 * Funding-round → scene mapping. The Claude Design bundle ships three pixel
 * environments; we bucket the 12 rounds across them (per the user's split):
 *   seed     → rounds 0-3  (Seed … Series C)
 *   megacorp → rounds 4-8  (Series D … Sovereign Wealth)
 *   agi      → rounds 9-11 (Government Bailout … AGI Singularity)
 */
export function sceneForRound(roundIdx: number): SceneId {
  if (roundIdx <= 3) return "seed";
  if (roundIdx <= 8) return "megacorp";
  return "agi";
}

interface Props {
  width: number;
  height: number;
  onHit?(id: HitId): void;
  activeHit?: HitId | null;
  scene?: SceneId;
}

/**
 * Seed-garage pixel scene. Structural port of Claude Design
 * `pixel-art.jsx::composeSeedScene` using react-native-svg primitives
 * instead of the HTML canvas API.
 *
 * Every sprite is its own function returning a <G> of <Rect>s; all live
 * pieces (LEDs, monitor code, floating tokens, plant sway, clock hands,
 * roomba LED chase, coffee steam) react to the shared `tick` counter.
 *
 * Tick rate: 200ms (5fps). Pixel art doesn't need 60fps — the visible
 * jitter actually reads more "8-bit" than smooth motion would.
 */
export function PixelScene({ width, height, onHit, activeHit, scene = "seed" }: Props) {
  const t = useTick(200);
  const zones = HIT_ZONES_BY_SCENE[scene];
  // Which specific zone is highlighted. Tracked by index (not HitId) because a
  // scene can have several zones sharing an id (e.g. 3 office monitors) — we
  // want to ring only the one tapped, exactly like the garage does. Cleared
  // when the parent drops `activeHit` (popup closed).
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!activeHit) setActiveIdx(null);
  }, [activeHit]);

  return (
    <View style={{ width, height }}>
      <Svg
        width={width}
        height={height}
        viewBox={`0 0 ${W} ${H}`}
        // @ts-expect-error — shape-rendering exists on web/native, missing type
        shapeRendering="crispEdges"
      >
        {scene === "megacorp" ? (
          <MegacorpScene t={t} />
        ) : scene === "agi" ? (
          <AGIScene t={t} />
        ) : (
          <SeedScene t={t} />
        )}
        {/* Selection ring — wraps only the tapped object, like the garage */}
        {activeHit && activeIdx != null && zones[activeIdx] && (
          <HitOutline zone={zones[activeIdx]} />
        )}
      </Svg>

      {/* Invisible touch overlay — one Pressable per hit zone. */}
      {onHit && (
        <View
          style={{ position: "absolute", left: 0, top: 0, width, height }}
          pointerEvents="box-none"
        >
          {zones.map((z, i) => {
            const sx = width / W;
            const sy = height / H;
            return (
              <Pressable
                key={`${z.id}-${i}`}
                onPress={() => {
                  setActiveIdx(i);
                  onHit(z.id);
                }}
                style={{
                  position: "absolute",
                  left: z.x * sx,
                  top: z.y * sy,
                  width: z.w * sx,
                  height: z.h * sy,
                }}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SEED GARAGE SCENE — port of pixel-art.jsx::composeSeedScene
// ═══════════════════════════════════════════════════════════════════════
function SeedScene({ t }: { t: number }) {
  return (
    <G>
      {/* Background plates */}
      <CeilingWall />
      {/* Wall items */}
      <Window x={18} y={96} t={t} />
      <Clock x={84} y={100} t={t} />
      <Whiteboard x={110} y={100} />
      <Hoodie x={156} y={100} />
      <Calendar x={200} y={42} />
      <StickyMoveFast x={206} y={156} />
      <Wainscoting />
      <PowerStrip x={180} y={210} t={t} />
      {/* Power-strip cable up to desk */}
      {Array.from({ length: 12 }, (_, i) => (
        <PixelRect key={`pwr-${i}`} x={181} y={188 + i * 2} w={1} h={1} c={P.ink} />
      ))}
      {/* Floor */}
      <Floor />
      {/* Workstation */}
      <DeskV2 x={30} y={254} w={110} />
      <Monitor x={56} y={232} t={t} />
      <Keyboard x={50} y={252} t={t} />
      <MousePad x={92} y={253} />
      <Mouse x={98} y={252} t={t} />
      <Mug x={34} y={247} t={t} />
      <Pizza x={112} y={250} />
      <Succulent x={44} y={246} />
      <EngineerOnChair x={60} y={254} t={t} />
      {/* Cable monitor → GPU */}
      <Cable x1={70} y1={252} x2={108} y2={260} color={P.ink} />
      {/* Floor items */}
      <GPU x={90} y={260} t={t} />
      <Books x={8} y={294} />
      <Plant x={210} y={274} t={t} />
      <Cans x={54} y={296} />
      <Roomba x={152} y={302} t={t} />
      {/* Particles */}
      <FloatingTokens spawnX={70} spawnY={236} t={t} />
    </G>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SERIES C / MEGACORP SCENE — port of pixel-art.jsx::composeMegacorpScene
// Cool slate-blue corporate office: dropped-tile ceiling, glass partition
// into another office, kanban whiteboard, a bank of 3 desks with engineers,
// a server cluster, and a sleek corporate plant.
// ═══════════════════════════════════════════════════════════════════════
const CORP = {
  wall:    "#C9CFD4",
  wallHi:  "#E0E4E8",
  wallSh:  "#9CA4AB",
  floor:   "#5C5C5C",
  floorHi: "#7C7C7C",
  floorSh: "#3A3A3A",
  glass:   "#D8E0E4",
  dark:    "#3A3A3A",
  darker:  "#1A1A1A",
  mid:     "#5C5C5C",
  white:   "#FFFFFF",
  bulb:    "#FFFFEE",
};

function MegacorpScene({ t }: { t: number }) {
  const FLOOR_Y = 222;
  const els: React.ReactNode[] = [];
  let k = 0;
  const key = () => `mc${k++}`;
  const R = (x: number, y: number, w: number, h: number, c: string) =>
    els.push(<PixelRect key={key()} x={x} y={y} w={w} h={h} c={c} />);
  const PX = (x: number, y: number, c: string) =>
    els.push(<Px key={key()} x={x} y={y} c={c} />);

  // Ceiling (dropped tile ceiling)
  R(0, 0, W, 6, CORP.floorHi);
  R(0, 6, W, 1, CORP.wallSh);
  for (let i = 0; i < W; i += 16) R(i, 0, 1, 6, CORP.floor);
  // Fluorescent light panels
  for (let i = 8; i < W; i += 32) {
    R(i, 2, 12, 2, CORP.wallHi);
    PX(i + 5, 1, CORP.bulb);
  }
  // Wall + subtle gradient
  R(0, 7, W, FLOOR_Y - 7, CORP.wall);
  for (let y = 9; y < FLOOR_Y; y += 8) R(0, y, W, 1, CORP.wallHi);
  R(0, FLOOR_Y - 2, W, 1, CORP.wallSh);
  R(0, FLOOR_Y - 1, W, 1, CORP.floorHi);

  // Glass partition wall (window into another office)
  R(12, 70, 100, 90, CORP.glass);
  R(12, 70, 100, 1, CORP.dark);
  R(12, 159, 100, 1, CORP.dark);
  R(12, 70, 1, 90, CORP.dark);
  R(111, 70, 1, 90, CORP.dark);
  R(61, 70, 2, 90, CORP.dark); // mullion
  // Distant city skyline through glass
  const sky = [10,18,8,22,14,28,11,20,8,16,25,18,12,22,10,20,8,18,14,25,16,10,20,18,12,22,10,16,25,12];
  for (let i = 0; i < 100; i++) {
    const h = sky[i % 30];
    R(13 + i, 158 - h, 1, h, CORP.wallSh);
  }
  for (let i = 0; i < 20; i++) PX(16 + i * 5, 154 - (i % 4) * 3, CORP.bulb);
  for (let i = 0; i < 5; i++) R(20 + i * 18, 75 + i * 4, 4, 1, CORP.white);

  // GPU rack visible inside glass (blinking)
  R(130, 100, 18, 60, CORP.darker);
  R(131, 102, 16, 56, CORP.dark);
  for (let i = 0; i < 12; i++) {
    R(132, 104 + i * 4, 14, 2, CORP.mid);
    PX(134, 105 + i * 4, (t + i) % 4 < 2 ? colors.sage : CORP.dark);
    PX(138, 105 + i * 4, colors.gold);
  }
  // Kanban whiteboard — big, gridded
  R(158, 80, 80, 60, colors.cream_hi);
  R(158, 80, 80, 2, CORP.mid);
  const colAccents = [colors.sage, colors.gold, colors.terracotta, colors.tensionRed];
  for (let col = 0; col < 4; col++) {
    R(158 + col * 20, 80, 1, 60, CORP.wallSh);
    R(162 + col * 20, 84, 14, 4, colAccents[col]);
  }
  const postit = ["#FCF066", "#FF9A8B", "#A5C8FF", "#B6F2C7"];
  for (let i = 0; i < 10; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    R(162 + col * 20, 92 + row * 12, 12, 8, postit[i % 4]);
  }

  // Floor — gray polished concrete
  R(0, FLOOR_Y, W, H - FLOOR_Y, CORP.floor);
  R(0, FLOOR_Y, W, 1, CORP.floorHi);
  R(0, FLOOR_Y + 1, W, 1, "#6C6C6C");
  for (let i = 0; i < W; i += 28) R(i, FLOOR_Y, 1, H - FLOOR_Y, CORP.floorSh);
  for (let i = 0; i < H - FLOOR_Y; i += 28) R(0, FLOOR_Y + i, W, 1, CORP.floorSh);
  R(0, H - 4, W, 1, CORP.floorHi);

  return (
    <G>
      {els}
      {/* Front bank of 3 desks with engineers (sprites layer on top) */}
      {[0, 1, 2].map((i) => {
        const dx = 12 + i * 80;
        const deskY = 256;
        return (
          <G key={`desk${i}`}>
            <PixelRect x={dx} y={deskY} w={68} h={4} c={CORP.dark} />
            <PixelRect x={dx} y={deskY} w={68} h={1} c={CORP.mid} />
            <PixelRect x={dx + 4} y={deskY + 4} w={2} h={30} c={CORP.dark} />
            <PixelRect x={dx + 62} y={deskY + 4} w={2} h={30} c={CORP.dark} />
            <Monitor x={dx + 18} y={deskY - 22} t={t + i * 7} />
            <EngineerOnChair x={dx + 22} y={deskY + 12} t={t + i * 11} />
            <Keyboard x={dx + 14} y={deskY - 2} t={t + i * 5} />
            <Mug x={dx + 3} y={deskY - 7} t={t + i * 13} />
          </G>
        );
      })}
      {/* DATA — stack of storage boxes on the floor (Buy Data target) */}
      <G>
        <PixelRect x={20} y={320} w={16} h={8} c={P.cream_4} />
        <PixelRect x={20} y={320} w={16} h={1} c={P.cream_3} />
        <PixelRect x={20} y={327} w={16} h={1} c={P.terracotta_3} />
        <PixelRect x={27} y={321} w={1} h={6} c={P.terracotta_2} />
        <PixelRect x={22} y={323} w={12} h={1} c={P.cream_3} />
        <PixelRect x={23} y={314} w={10} h={6} c={P.cream_3} />
        <PixelRect x={23} y={314} w={10} h={1} c={P.cream_2} />
        <PixelRect x={23} y={319} w={10} h={1} c={P.terracotta_3} />
        <PixelRect x={27} y={315} w={1} h={4} c={P.terracotta_2} />
        <PixelRect x={25} y={316} w={6} h={1} c={P.ink} />
        <PixelRect x={25} y={317} w={4} h={1} c={P.ink} />
        <PixelRect x={19} y={328} w={18} h={1} c={P.terracotta_3} />
      </G>
      {/* ENERGY — wall HVAC / power unit (Buy Energy target) */}
      <G>
        <PixelRect x={208} y={148} w={20} h={7} c={P.cream_4} />
        <PixelRect x={208} y={148} w={20} h={1} c={P.muted_2} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <PixelRect key={`ac${i}`} x={211 + i * 2} y={149} w={1} h={4} c={P.ink_hi} />
        ))}
        <PixelRect x={208} y={154} w={20} h={1} c={P.cream_3} />
      </G>
      {/* Corporate plant — sleek black pot */}
      <PixelRect x={4} y={FLOOR_Y + 60} w={14} h={18} c={CORP.dark} />
      <PixelRect x={4} y={FLOOR_Y + 60} w={14} h={1} c={CORP.mid} />
      <Plant x={0} y={FLOOR_Y + 40} t={t} />
      <FloatingTokens spawnX={110} spawnY={236} t={t} />
    </G>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// AGI SINGULARITY SCENE — port of pixel-art.jsx::composeAGIScene
// Deep-space backdrop, parallax stars, nebula bloom, a huge Earth in the
// lower-left, a crystalline megastructure with orbital rings + satellites,
// data-flow beams, distant server nodes, and drifting debris.
//
// The heavy static layers (gradient, Earth, nebula) are memoized so they
// render once; only the animated layer redraws each tick.
// ═══════════════════════════════════════════════════════════════════════
const SPACE = {
  bgTop:   "#08060F",
  bgBot:   "#140E28",
  star:    "#FBF7EC",
  starR:   "#D45A68",
  starG:   "#A4BDA9",
  gold:    "#EBBE6E",
  goldHi:  "#FFFFEE",
  white:   "#FFFFFF",
  neb0:    "#1F0F2C",
  neb1:    "#3A1A40",
  neb2:    "#5C2050",
  neb3:    "#7A1F2A",
  red:     "#B23A48",
  redHi:   "#D45A68",
  ocean:   "#1A3050",
  oceanHi: "#3F5A78",
  land:    "#3F5142",
  landHi:  "#7E9A85",
  haloIn:  "#4A6FA5",
  haloOut: "#5C7A9A",
  deep:    "#1A0F28",
};

const AGIBackdrop = React.memo(function AGIBackdrop() {
  const els: React.ReactNode[] = [];
  let k = 0;
  const key = () => `bg${k++}`;
  const R = (x: number, y: number, w: number, h: number, c: string) =>
    els.push(<PixelRect key={key()} x={x} y={y} w={w} h={h} c={c} />);
  const PX = (x: number, y: number, c: string) =>
    els.push(<Px key={key()} x={x} y={y} c={c} />);

  // Nebula bloom across the top (column step 2 to keep node count sane)
  const NEB_Y = 20;
  for (let i = 0; i < W; i += 2) {
    const dist = Math.abs(i - W / 2);
    const intensity = Math.max(0, 1 - dist / (W * 0.6));
    if (intensity < 0.05) continue;
    const h = (28 + intensity * 40) | 0;
    const baseY = NEB_Y + ((Math.sin(i / 24) * 6) | 0);
    for (let layer = 0; layer < 4; layer++) {
      const hh = h - layer * 8;
      if (hh <= 0) break;
      const color = layer === 0 ? SPACE.neb0 : layer === 1 ? SPACE.neb1 : layer === 2 ? SPACE.neb2 : SPACE.neb3;
      R(i, baseY + layer * 2, 2, hh, color);
    }
  }
  // Embedded bright stars in nebula
  for (let i = 0; i < 8; i++) {
    const sx = 20 + i * 28;
    const sy = NEB_Y + 14 + ((i * 7) % 18);
    PX(sx, sy, SPACE.star);
    PX(sx - 1, sy, SPACE.gold);
    PX(sx + 1, sy, SPACE.gold);
    PX(sx, sy - 1, SPACE.gold);
    PX(sx, sy + 1, SPACE.gold);
  }

  // EARTH — big, lower-left foreground
  const eCx = -10, eCy = H + 30, eR = 110;
  for (let y = -eR; y <= eR; y += 1) {
    const py = eCy + y;
    if (py < 0 || py >= H) continue;
    const xspan = Math.sqrt(eR * eR - y * y) | 0;
    const xL = Math.max(0, eCx - xspan);
    const xR = Math.min(W, eCx + xspan);
    if (xR <= xL) continue;
    const fromEdge = Math.min(Math.abs(y), eR - Math.abs(y));
    if (fromEdge < 3) R(xL, py, xR - xL, 1, SPACE.haloOut);
    else if (fromEdge < 6) R(xL, py, xR - xL, 1, SPACE.haloIn);
    else {
      R(xL, py, xR - xL, 1, SPACE.ocean);
      if (y > -eR + 20 && y < 0) R(xL, py, 6, 1, SPACE.oceanHi);
      if (Math.abs(y) % 5 < 3) {
        for (let cx = xL; cx < xR; cx += 2) {
          const noise = (cx * 13 + y * 7) % 13;
          if (noise < 5) {
            R(cx, py, 2, 1, noise < 2 ? SPACE.landHi : SPACE.land);
          }
        }
      }
      if (y > -eR + 12 && y < eR - 12) {
        for (let li = 0; li < 6; li++) {
          if ((li + y) % 4 === 0) {
            const lx = xR - 6 - li * 3;
            if (lx > xL) PX(lx, py, SPACE.gold);
          }
        }
      }
    }
  }

  return <G>{els}</G>;
});

function AGIScene({ t }: { t: number }) {
  const els: React.ReactNode[] = [];
  let k = 0;
  const key = () => `ag${k++}`;
  const R = (x: number, y: number, w: number, h: number, c: string, o?: number) =>
    els.push(<Rect key={key()} x={x} y={y} width={w} height={h} fill={c} opacity={o} />);
  const PX = (x: number, y: number, c: string) =>
    els.push(<Px key={key()} x={x} y={y} c={c} />);

  // Stars — twinkling small layer
  for (let i = 0; i < 60; i++) {
    const sx = (i * 41 + (i % 9) * 7) % W;
    const sy = (i * 67 + (i % 5) * 13) % H;
    if ((t + i * 11) % 32 < 24) {
      const col = i % 7 === 0 ? SPACE.starR : i % 5 === 0 ? SPACE.starG : SPACE.star;
      PX(sx, sy, col);
    }
  }
  // Bright foreground stars (2×2)
  for (let i = 0; i < 14; i++) {
    const sx = (i * 71 + 11) % W;
    const sy = (i * 53 + 19) % H;
    if ((t + i * 9) % 40 < 32) {
      R(sx, sy, 2, 2, SPACE.star);
      PX(sx, sy - 1, SPACE.star);
      PX(sx + 1, sy + 2, SPACE.star);
    }
  }

  const eCx = -10, eCy = H + 30;
  // Earth clouds (drifting)
  for (let cb = 0; cb < 3; cb++) {
    const cby = eCy - 60 + cb * 32;
    const cbo = (t / 100 + cb * 0.7) % 1;
    for (let i = 0; i < 40; i++) {
      const cx = 4 + (((i * 3 + cbo * 80) | 0) % 90);
      if (cx + eCx > 0 && cx + eCx < 110 && cby > 0 && cby < H && (i + cb) % 3 === 0) {
        PX(eCx + cx, cby, SPACE.star);
      }
    }
  }

  // Singularity point near Earth
  const sgx = eCx + 60, sgy = eCy - 70;
  R(sgx - 14, sgy - 14, 28, 28, SPACE.goldHi, 0.3);
  R(sgx - 10, sgy - 10, 20, 20, SPACE.gold, 0.5);
  R(sgx - 6, sgy, 12, 1, SPACE.goldHi);
  R(sgx, sgy - 6, 1, 12, SPACE.goldHi);
  R(sgx - 3, sgy - 1, 6, 3, SPACE.gold);
  R(sgx - 1, sgy - 1, 2, 3, SPACE.white);
  R(sgx - 4, sgy, 8, 1, SPACE.white);

  // Megastructure
  const megaCx = (W * 0.62) | 0, megaCy = (H * 0.42) | 0;
  // Energy beam Earth → megastructure
  for (let beamY = sgy; beamY > megaCy + 50; beamY -= 1) {
    const tx = ((sgx * (beamY - megaCy) + megaCx * (sgy - beamY)) / (sgy - megaCy)) | 0;
    const wobble = (beamY + t) % 6 < 3 ? 0 : 1;
    if ((t + beamY) % 3 < 2) {
      PX(tx, beamY, SPACE.gold);
      PX(tx + wobble, beamY, SPACE.white);
    }
  }
  // Outer halos
  R(megaCx - 60, megaCy - 60, 120, 120, SPACE.neb2, 0.25);
  R(megaCx - 44, megaCy - 44, 88, 88, SPACE.neb3, 0.4);
  // Orbital rings
  for (let a = 0; a < Math.PI * 2; a += 0.07) {
    const rx = (megaCx + Math.cos(a + t / 100) * 110) | 0;
    const ry = (megaCy + Math.sin(a + t / 100) * 38) | 0;
    if (rx > 0 && rx < W && ry > 0 && ry < H) {
      R(rx, ry, 2, 1, ((a * 7) | 0) % 4 === 0 ? SPACE.redHi : SPACE.neb2);
    }
  }
  for (let a = 0; a < Math.PI * 2; a += 0.09) {
    const rx = (megaCx + Math.cos(a - t / 80) * 80) | 0;
    const ry = (megaCy + Math.sin(a - t / 80) * 26) | 0;
    if (rx > 0 && rx < W && ry > 0 && ry < H) {
      PX(rx, ry, SPACE.red);
      PX(rx + 1, ry, SPACE.neb3);
    }
  }
  for (let a = 0; a < Math.PI * 2; a += 0.12) {
    const rx = (megaCx + Math.cos(a + t / 50) * 56) | 0;
    const ry = (megaCy + Math.sin(a + t / 50) * 18) | 0;
    if (rx > 0 && rx < W && ry > 0 && ry < H) PX(rx, ry, SPACE.redHi);
  }
  // Megastructure core — diamond
  const mr = 30;
  for (let i = 0; i < mr * 2; i++) {
    const w = mr - Math.abs(i - mr);
    const col = i < mr - 6 ? SPACE.neb2 : i < mr ? SPACE.neb3 : i < mr + 6 ? SPACE.red : SPACE.neb1;
    R(megaCx - w, megaCy - mr + i, w * 2, 1, col);
  }
  for (let f = 0; f < 5; f++) {
    const facetW = mr - 4 - f * 4;
    R(megaCx - facetW, megaCy - mr + 4 + f * 5, facetW * 2, 1, SPACE.red);
  }
  for (let i = 0; i < mr; i++) {
    PX(megaCx - (mr - i), megaCy - i, SPACE.redHi);
    PX(megaCx + (mr - i), megaCy - i, SPACE.neb2);
  }
  R(megaCx - 1, megaCy - mr - 4, 2, 4, SPACE.gold);
  PX(megaCx, megaCy - mr - 5, SPACE.white);
  const pulse = t % 16 < 8 ? SPACE.goldHi : SPACE.gold;
  R(megaCx - 6, megaCy - 4, 12, 8, pulse);
  R(megaCx - 4, megaCy - 6, 8, 12, pulse);
  R(megaCx - 2, megaCy - 2, 4, 4, SPACE.white);
  for (let v = 0; v < 4; v++) {
    const va = v * (Math.PI / 2) + Math.PI / 4;
    const vx = (megaCx + Math.cos(va) * (mr - 6)) | 0;
    const vy = (megaCy + Math.sin(va) * (mr - 6)) | 0;
    R(vx - 2, vy - 2, 4, 4, SPACE.redHi);
    PX(vx, vy, SPACE.goldHi);
  }
  // Orbiting satellites
  for (let s = 0; s < 4; s++) {
    const sa = t / 30 + s * (Math.PI / 2);
    const sx = (megaCx + Math.cos(sa) * 56) | 0;
    const sy = (megaCy + Math.sin(sa) * 20) | 0;
    R(sx - 3, sy - 1, 7, 3, SPACE.red);
    R(sx - 3, sy - 1, 7, 1, SPACE.redHi);
    R(sx - 3, sy + 1, 7, 1, SPACE.neb3);
    R(sx - 6, sy, 3, 1, SPACE.neb2);
    R(sx + 4, sy, 3, 1, SPACE.neb2);
    PX(sx - 7, sy, SPACE.neb1);
    PX(sx + 6, sy, SPACE.neb1);
    PX(sx + 4, sy + 1, (t + s * 3) % 4 < 2 ? SPACE.gold : SPACE.white);
  }
  // Data flow Earth → megastructure
  for (let i = 0; i < 18; i++) {
    const t2 = (t * 2 + i * 18) % 200;
    if (t2 > 100) continue;
    const fx = (sgx + ((megaCx - sgx) * t2) / 100) | 0;
    const fy = (sgy + ((megaCy - sgy) * t2) / 100) | 0;
    R(fx, fy, 2, 1, i % 3 === 0 ? SPACE.white : i % 2 === 0 ? SPACE.gold : SPACE.redHi);
  }
  // Distant orbital data nodes
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3 + t / 200;
    const sx = (megaCx + Math.cos(a) * 160) | 0;
    const sy = (megaCy + Math.sin(a) * 72) | 0;
    if (sx > 8 && sx < W - 8 && sy > 8 && sy < H - 12) {
      R(sx - 4, sy - 6, 8, 12, SPACE.deep);
      R(sx - 4, sy - 6, 8, 1, SPACE.neb2);
      R(sx - 4, sy + 5, 8, 1, SPACE.neb1);
      for (let row = 0; row < 5; row++) {
        R(sx - 3, sy - 4 + row * 2, 6, 1, SPACE.neb1);
        PX(sx - 2, sy - 4 + row * 2, (t + i * 3 + row) % 6 < 3 ? SPACE.redHi : SPACE.neb3);
        PX(sx + 1, sy - 4 + row * 2, SPACE.gold);
      }
      R(sx, sy - 9, 1, 3, SPACE.neb3);
      PX(sx, sy - 10, SPACE.redHi);
    }
  }
  // Asteroid debris
  for (let i = 0; i < 12; i++) {
    const ax = ((i * 51 + (t >> 3)) % (W + 20)) - 10;
    const ay = 60 + ((i * 41) % (H - 120));
    R(ax, ay, 2, 1, SPACE.neb1);
    PX(ax + 1, ay - 1, SPACE.neb2);
    PX(ax, ay + 1, SPACE.deep);
  }
  // Reality-tear glitch (rare)
  if ((t >> 1) % 47 < 2) {
    const gy = (t * 7) % H;
    R(0, gy, W, 1, SPACE.redHi);
    R(0, gy + 1, W, 1, SPACE.goldHi);
  }
  // Round badge
  R(4, H - 22, 88, 18, SPACE.deep);
  R(4, H - 22, 88, 1, SPACE.neb2);
  R(4, H - 5, 88, 1, SPACE.neb2);
  R(8, H - 19, 4, 12, SPACE.redHi);
  R(14, H - 19, 4, 12, SPACE.redHi);
  R(20, H - 13, 4, 6, SPACE.redHi);
  R(30, H - 17, 60, 1, SPACE.gold);
  R(30, H - 13, 50, 1, SPACE.star);
  R(30, H - 9, 40, 1, SPACE.redHi);

  return (
    <G>
      {/* Deep-space gradient via SVG LinearGradient (1 rect) */}
      <Defs>
        <SvgLinearGradient id="agiSpace" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={SPACE.bgTop} />
          <Stop offset="1" stopColor={SPACE.bgBot} />
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={0} width={W} height={H} fill="url(#agiSpace)" />
      <AGIBackdrop />
      {els}
      <FloatingTokens spawnX={megaCx} spawnY={megaCy} t={t} />
    </G>
  );
}

// ─── Tick hook ──────────────────────────────────────────────────────────
function useTick(periodMs: number): number {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setT((n) => (n + 1) % 100_000), periodMs);
    return () => clearInterval(id);
  }, [periodMs]);
  return t;
}

// ─── Rect helper ────────────────────────────────────────────────────────
// Compact wrapper so sprite functions look like the design's `r(ctx, ...)`
// calls — shrinks JSX cost per pixel from ~80 chars to ~40.
const PixelRect = React.memo(function PixelRect({
  x, y, w = 1, h = 1, c,
}: { x: number; y: number; w?: number; h?: number; c: string }) {
  return <Rect x={x} y={y} width={w} height={h} fill={c} />;
});
const Px = ({ x, y, c }: { x: number; y: number; c: string }) => (
  <Rect x={x} y={y} width={1} height={1} fill={c} />
);

// ═══════════════════════════════════════════════════════════════════════
// SPRITES — each is a near-1:1 port of the design's `draw*` function.
// Coords inside follow the design exactly so future tweaks can copy-paste
// from `pixel-art.jsx`.
// ═══════════════════════════════════════════════════════════════════════

function CeilingWall() {
  const stripes = [];
  for (let y = 18; y < FLOOR_Y; y += 12) {
    stripes.push(<PixelRect key={`s${y}`} x={0} y={y} w={W} h={1} c={P.cream_hi} />);
  }
  return (
    <G>
      <PixelRect x={0} y={0} w={W} h={8} c={P.cream_3} />
      <PixelRect x={0} y={0} w={W} h={1} c={P.cream_4} />
      <PixelRect x={0} y={8} w={W} h={1} c={P.cream_4} />
      <PixelRect x={0} y={9} w={W} h={3} c={P.cream_2} />
      <PixelRect x={0} y={9} w={W} h={1} c={P.cream_hi} />
      <PixelRect x={0} y={12} w={W} h={FLOOR_Y - 12} c={P.cream} />
      {stripes}
      <PixelRect x={0} y={FLOOR_Y - 2} w={W} h={1} c={P.cream_3} />
      <PixelRect x={0} y={FLOOR_Y - 1} w={W} h={1} c={P.cream_4} />
    </G>
  );
}

function Floor() {
  // Vertical plank seams running from floor edge to bottom.
  const seams = [];
  for (let i = 0; i < 14; i++) {
    const x = i * 16 + ((i * 7) % 5);
    if (x < W) seams.push(<PixelRect key={`p${i}`} x={x} y={FLOOR_Y} w={1} h={H - FLOOR_Y} c={P.terracotta_3} />);
  }
  return (
    <G>
      <PixelRect x={0} y={FLOOR_Y} w={W} h={H - FLOOR_Y} c={P.terracotta_2} />
      {seams}
      <PixelRect x={0} y={FLOOR_Y} w={W} h={1} c={P.terracotta_hi} />
      <PixelRect x={0} y={FLOOR_Y + 1} w={W} h={1} c={P.terracotta} />
      <PixelRect x={0} y={FLOOR_Y} w={W} h={2} c={P.terracotta} />
      <PixelRect x={0} y={H - 3} w={W} h={3} c={P.terracotta_3} />
    </G>
  );
}

function Wainscoting() {
  const studs = [];
  for (let bx = 24; bx < W; bx += 24) {
    studs.push(<PixelRect key={`b${bx}`} x={bx} y={198} w={1} h={7} c={P.cream_4} />);
  }
  return (
    <G>
      <PixelRect x={0} y={196} w={W} h={1} c={P.cream_4} />
      <PixelRect x={0} y={197} w={W} h={8} c={P.cream_2} />
      <PixelRect x={0} y={205} w={W} h={1} c={P.cream_3} />
      {studs}
    </G>
  );
}

function Window({ x, y, t }: { x: number; y: number; t: number }) {
  const cloudT = (t * 2) % 52;
  const sky = [4,7,3,9,5,11,4,8,3,6,10,7,5,9,4,8,3,7,5,10,6,4,8,7,5,9,4,6,10,5,3,8,5,7,9,4,8,3,6,5,7,4,9,5,3,8,4,6,9,3];
  const skyline = [];
  for (let i = 0; i < 50; i++) {
    const h = sky[i % sky.length];
    skyline.push(<PixelRect key={`sk${i}`} x={x + 1 + i} y={y + 26 - h} w={1} h={h + 4} c={P.sage_2} />);
  }
  const lit = [];
  for (let i = 0; i < 8; i++) lit.push(<Px key={`l${i}`} x={x + 5 + i * 6} y={y + 24 - (i % 3)} c={P.gold_hi} />);
  const cx = x + 2 + (cloudT % 52);
  return (
    <G>
      {/* Frame */}
      <PixelRect x={x - 1} y={y - 1} w={54} h={40} c={P.cream_4} />
      <PixelRect x={x} y={y} w={52} h={38} c={P.ink_hi} />
      <PixelRect x={x + 1} y={y + 1} w={50} h={36} c={P.sky} />
      {/* Sky gradient */}
      <PixelRect x={x + 1} y={y + 1} w={50} h={5} c={P.sky_3} />
      <PixelRect x={x + 1} y={y + 6} w={50} h={6} c={P.sky} />
      <PixelRect x={x + 1} y={y + 12} w={50} h={8} c={P.sky_2} />
      {/* Skyline */}
      {skyline}
      {lit}
      {/* Sun */}
      <PixelRect x={x + 40} y={y + 5} w={4} h={4} c={P.gold_hi} />
      <PixelRect x={x + 41} y={y + 4} w={2} h={1} c={P.gold_hi} />
      <PixelRect x={x + 41} y={y + 9} w={2} h={1} c={P.gold_hi} />
      <PixelRect x={x + 39} y={y + 6} w={1} h={2} c={P.gold} />
      <PixelRect x={x + 44} y={y + 6} w={1} h={2} c={P.gold} />
      {/* Cloud (drifting) */}
      {cx > x && cx + 8 < x + 50 && (
        <G>
          <PixelRect x={cx} y={y + 8} w={8} h={2} c={P.cloud} />
          <PixelRect x={cx + 1} y={y + 7} w={6} h={1} c={P.cloud} />
          <PixelRect x={cx + 2} y={y + 10} w={5} h={1} c={P.cloud} />
        </G>
      )}
      {/* Mullion */}
      <PixelRect x={x + 25} y={y + 1} w={2} h={36} c={P.cream_4} />
      <PixelRect x={x + 1} y={y + 18} w={50} h={2} c={P.cream_4} />
      {/* Sill */}
      <PixelRect x={x - 2} y={y + 38} w={56} h={2} c={P.cream_4} />
      <PixelRect x={x - 2} y={y + 38} w={56} h={1} c={P.cream_3} />
    </G>
  );
}

function Clock({ x, y, t }: { x: number; y: number; t: number }) {
  const sec = (t / 4) % 60;
  const minAngle = (sec / 60) * Math.PI * 2;
  const hourAngle = (((t >> 7) % 12) / 12) * Math.PI * 2 + Math.PI;
  const cx = x + 7, cy = y + 7;
  const hourHand = [1, 2].map((i) => (
    <Px key={`h${i}`} x={cx + Math.round(Math.sin(hourAngle) * i)} y={cy - Math.round(Math.cos(hourAngle) * i)} c={P.ink} />
  ));
  const minHand = [1, 2, 3].map((i) => (
    <Px key={`m${i}`} x={cx + Math.round(Math.sin(minAngle) * i)} y={cy - Math.round(Math.cos(minAngle) * i)} c={P.terracotta_2} />
  ));
  return (
    <G>
      <PixelRect x={x + 2} y={y} w={10} h={1} c={P.ink} />
      <PixelRect x={x} y={y + 1} w={14} h={12} c={P.ink} />
      <PixelRect x={x + 2} y={y + 13} w={10} h={1} c={P.ink} />
      <PixelRect x={x + 1} y={y + 2} w={12} h={10} c={P.cream_hi} />
      <PixelRect x={x + 1} y={y + 2} w={12} h={1} c={P.cream_3} />
      {/* Tick marks at 12 / 3 / 6 / 9 */}
      <Px x={x + 7} y={y + 3} c={P.ink} />
      <Px x={x + 11} y={y + 7} c={P.ink} />
      <Px x={x + 7} y={y + 11} c={P.ink} />
      <Px x={x + 3} y={y + 7} c={P.ink} />
      {hourHand}
      {minHand}
      <Px x={cx} y={cy} c={P.gold} />
    </G>
  );
}

function Whiteboard({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <PixelRect x={x - 1} y={y - 1} w={36} h={26} c={P.ink_hi} />
      <PixelRect x={x} y={y} w={34} h={24} c={P.cream_hi} />
      <PixelRect x={x} y={y} w={34} h={1} c={P.cream_3} />
      {/* Q4 OKRs header in terracotta */}
      <PixelRect x={x + 2} y={y + 2} w={14} h={1} c={P.terracotta} />
      <PixelRect x={x + 2} y={y + 3} w={10} h={1} c={P.terracotta} />
      {/* Scribbled bullets */}
      <PixelRect x={x + 2} y={y + 6} w={8} h={1} c={P.ink} />
      <PixelRect x={x + 2} y={y + 8} w={14} h={1} c={P.ink} />
      <PixelRect x={x + 2} y={y + 10} w={6} h={1} c={P.ink} />
      <PixelRect x={x + 2} y={y + 12} w={12} h={1} c={P.ink} />
      <PixelRect x={x + 2} y={y + 14} w={9} h={1} c={P.ink} />
      <PixelRect x={x + 2} y={y + 16} w={11} h={1} c={P.ink} />
      <PixelRect x={x + 2} y={y + 18} w={7} h={1} c={P.ink} />
      {/* Sticky notes */}
      <PixelRect x={x + 22} y={y + 3} w={5} h={5} c={P.gold} />
      <PixelRect x={x + 23} y={y + 4} w={3} h={1} c={P.gold_2} />
      <PixelRect x={x + 28} y={y + 4} w={5} h={5} c={P.sage_hi} />
      <PixelRect x={x + 29} y={y + 5} w={3} h={1} c={P.sage} />
      <PixelRect x={x + 22} y={y + 10} w={5} h={5} c={P.tension_hi} />
      <PixelRect x={x + 23} y={y + 11} w={3} h={1} c={P.tension} />
      <PixelRect x={x + 28} y={y + 11} w={5} h={5} c={P.gold} />
      <PixelRect x={x + 29} y={y + 12} w={3} h={1} c={P.gold_2} />
      <PixelRect x={x + 22} y={y + 17} w={5} h={5} c={P.sage_hi} />
      {/* Tray + markers */}
      <PixelRect x={x} y={y + 23} w={34} h={2} c={P.ink} />
      <PixelRect x={x + 4} y={y + 24} w={5} h={1} c={P.terracotta} />
      <PixelRect x={x + 12} y={y + 24} w={5} h={1} c={P.sage_2} />
    </G>
  );
}

function Hoodie({ x, y }: { x: number; y: number }) {
  return (
    <G>
      {/* Hook */}
      <Px x={x + 7} y={y - 2} c={P.ink} />
      <PixelRect x={x + 6} y={y - 1} w={3} h={1} c={P.ink} />
      {/* Hood */}
      <PixelRect x={x + 3} y={y} w={9} h={4} c={P.sage_2} />
      <PixelRect x={x + 4} y={y} w={7} h={1} c={P.sage} />
      <PixelRect x={x + 4} y={y + 4} w={7} h={1} c={P.sage_3} />
      {/* Body */}
      <PixelRect x={x + 1} y={y + 5} w={13} h={14} c={P.sage_2} />
      <PixelRect x={x + 1} y={y + 5} w={13} h={1} c={P.sage} />
      {/* Pocket seam */}
      <PixelRect x={x + 4} y={y + 12} w={7} h={1} c={P.sage_3} />
      <PixelRect x={x + 4} y={y + 13} w={2} h={3} c={P.sage_3} />
      <PixelRect x={x + 9} y={y + 13} w={2} h={3} c={P.sage_3} />
      {/* Sleeves */}
      <PixelRect x={x - 1} y={y + 7} w={3} h={8} c={P.sage_2} />
      <PixelRect x={x + 13} y={y + 7} w={3} h={8} c={P.sage_2} />
      {/* Drawstrings */}
      <Px x={x + 6} y={y + 5} c={P.cream_hi} />
      <Px x={x + 9} y={y + 5} c={P.cream_hi} />
      <Px x={x + 6} y={y + 7} c={P.cream_hi} />
      <Px x={x + 9} y={y + 7} c={P.cream_hi} />
    </G>
  );
}

function Calendar({ x, y }: { x: number; y: number }) {
  const cells = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 5; col++) {
      if (row * 5 + col < 18) {
        cells.push(<Px key={`c${row}-${col}`} x={x + 2 + col * 2} y={y + 5 + row * 2} c={P.ink} />);
      }
    }
  }
  return (
    <G>
      <Px x={x + 5} y={y - 1} c={P.ink} />
      <PixelRect x={x} y={y} w={12} h={14} c={P.cream_4} />
      <PixelRect x={x + 1} y={y + 1} w={10} h={12} c={P.cream_hi} />
      <PixelRect x={x + 1} y={y + 1} w={10} h={3} c={P.tension} />
      {cells}
      <Px x={x + 6} y={y + 9} c={P.tension} />
    </G>
  );
}

function StickyMoveFast({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <PixelRect x={x} y={y} w={14} h={10} c={P.gold} />
      <PixelRect x={x} y={y} w={14} h={1} c={P.gold_hi} />
      <PixelRect x={x} y={y + 9} w={14} h={1} c={P.gold_2} />
      <PixelRect x={x + 2} y={y + 2} w={8} h={1} c={P.ink} />
      <PixelRect x={x + 2} y={y + 4} w={10} h={1} c={P.ink} />
      <PixelRect x={x + 2} y={y + 6} w={6} h={1} c={P.ink} />
      <Px x={x + 12} y={y + 8} c={P.gold_2} />
      <Px x={x + 13} y={y + 7} c={P.gold_2} />
    </G>
  );
}

function PowerStrip({ x, y, t }: { x: number; y: number; t: number }) {
  return (
    <G>
      <PixelRect x={x} y={y} w={32} h={10} c={P.ink} />
      <PixelRect x={x} y={y} w={32} h={1} c={P.ink_hi} />
      {[2, 12, 22].map((dx) => (
        <PixelRect key={dx} x={x + dx} y={y + 3} w={6} h={4} c={P.ink_2} />
      ))}
      <PixelRect
        x={x + 28} y={y + 3} w={2} h={2}
        c={(t >> 1) % 4 < 2 ? P.tension_hi : P.tension_2}
      />
      <PixelRect
        x={x + 28} y={y + 6} w={2} h={2}
        c={(t + 1) % 3 < 2 ? P.sage_hi : P.sage_3}
      />
    </G>
  );
}

function DeskV2({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <G>
      <PixelRect x={x} y={y} w={w} h={1} c={P.terracotta_hi} />
      <PixelRect x={x} y={y + 1} w={w} h={4} c={P.terracotta} />
      <PixelRect x={x} y={y + 5} w={w} h={1} c={P.terracotta_2} />
      <PixelRect x={x + 2} y={y + 6} w={w - 4} h={6} c={P.terracotta_2} />
      <PixelRect x={x + 2} y={y + 6} w={w - 4} h={1} c={P.terracotta_3} />
      <PixelRect x={x + 1} y={y + 6} w={3} h={30} c={P.terracotta_2} />
      <PixelRect x={x + w - 4} y={y + 6} w={3} h={30} c={P.terracotta_2} />
      <PixelRect x={x + 1} y={y + 6} w={1} h={30} c={P.terracotta_3} />
      <PixelRect x={x + w - 4} y={y + 6} w={1} h={30} c={P.terracotta_3} />
      <PixelRect x={x + 8} y={y + 7} w={22} h={4} c={P.terracotta} />
      <PixelRect x={x + 8} y={y + 7} w={22} h={1} c={P.terracotta_hi} />
      <PixelRect x={x + 18} y={y + 9} w={2} h={1} c={P.gold} />
      <PixelRect x={x + w - 30} y={y + 7} w={22} h={4} c={P.terracotta} />
      <PixelRect x={x + w - 30} y={y + 7} w={22} h={1} c={P.terracotta_hi} />
      <PixelRect x={x + w - 20} y={y + 9} w={2} h={1} c={P.gold} />
    </G>
  );
}

function Monitor({ x, y, t }: { x: number; y: number; t: number }) {
  const offset = (t >> 1) % 16;
  const lines = [5, 11, 7, 13, 4, 8, 12, 6, 9, 14, 5, 7, 11, 3, 13, 8];
  const code = [];
  for (let i = 0; i < 8; i++) {
    const lineIdx = (i + offset) % lines.length;
    const wd = lines[lineIdx];
    const ly = y + 3 + i * 2;
    code.push(<Px key={`a${i}`} x={x + 3} y={ly} c={P.gold_hi} />);
    code.push(<Px key={`b${i}`} x={x + 4} y={ly} c={P.gold_hi} />);
    code.push(<PixelRect key={`l${i}`} x={x + 6} y={ly} w={wd} h={1} c={lineIdx % 3 === 0 ? P.sage_hi : P.gold} />);
  }
  return (
    <G>
      {/* Stand */}
      <PixelRect x={x + 8} y={y + 22} w={6} h={2} c={P.ink} />
      <PixelRect x={x + 11} y={y + 20} w={4} h={2} c={P.ink} />
      <PixelRect x={x + 12} y={y + 19} w={2} h={1} c={P.ink} />
      {/* Bezel */}
      <PixelRect x={x} y={y} w={26} h={20} c={P.ink} />
      <PixelRect x={x} y={y} w={26} h={1} c={P.ink_hi} />
      <PixelRect x={x + 25} y={y} w={1} h={20} c={P.ink_2} />
      {/* Screen */}
      <PixelRect x={x + 2} y={y + 2} w={22} h={16} c={P.sage_3} />
      <PixelRect x={x + 2} y={y + 2} w={22} h={1} c={P.sage_2} />
      <PixelRect x={x + 2} y={y + 17} w={22} h={1} c={P.sage_3} />
      {code}
      {(t >> 2) % 4 < 2 && (
        <PixelRect x={x + 22} y={y + 16} w={1} h={1} c={P.sage_hi} />
      )}
      <PixelRect x={x + 22} y={y + 19} w={2} h={1} c={t % 24 < 20 ? P.sage_hi : P.sage_2} />
      <PixelRect x={x + 2} y={y + 19} w={3} h={1} c={P.muted} />
    </G>
  );
}

function Keyboard({ x, y, t }: { x: number; y: number; t: number }) {
  const glow = (t >> 4) % 4;
  const keyDots1 = [];
  for (let i = 0; i < 18; i++) keyDots1.push(<Px key={`k1${i}`} x={x + 1 + i * 2} y={y + 1} c={P.muted} />);
  const keyDots2 = [];
  for (let i = 0; i < 17; i++) keyDots2.push(<Px key={`k2${i}`} x={x + 2 + i * 2} y={y + 2} c={P.muted} />);
  const glowDots = [];
  for (let i = 0; i < 4; i++) {
    glowDots.push(<Px key={`g${i}`} x={x + 3 + ((i + glow) % 4) * 8} y={y + 2} c={P.sage_hi} />);
  }
  return (
    <G>
      <PixelRect x={x} y={y} w={38} h={4} c={P.ink} />
      <PixelRect x={x} y={y} w={38} h={1} c={P.ink_hi} />
      <PixelRect x={x} y={y + 3} w={38} h={1} c={P.ink_2} />
      {keyDots1}
      {keyDots2}
      {glowDots}
      <PixelRect x={x + 12} y={y + 2} w={14} h={1} c={P.muted} />
    </G>
  );
}

function MousePad({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <PixelRect x={x} y={y} w={14} h={6} c={P.ink_hi} />
      <PixelRect x={x} y={y} w={14} h={1} c={P.muted_2} />
      <PixelRect x={x} y={y + 5} w={14} h={1} c={P.ink_2} />
      <PixelRect x={x + 5} y={y + 2} w={4} h={1} c={P.gold_2} />
    </G>
  );
}

function Mouse({ x, y, t }: { x: number; y: number; t: number }) {
  const lit = (t >> 3) % 6 < 5;
  return (
    <G>
      <PixelRect x={x} y={y + 1} w={5} h={4} c={P.cream} />
      <PixelRect x={x} y={y + 1} w={5} h={1} c={P.cream_3} />
      <PixelRect x={x} y={y + 4} w={5} h={1} c={P.cream_4} />
      <Px x={x + 2} y={y + 2} c={P.muted_2} />
      <Px x={x + 2} y={y + 5} c={lit ? P.tension_hi : P.tension_2} />
      <Px x={x + 2} y={y} c={P.ink} />
    </G>
  );
}

function Mug({ x, y, t }: { x: number; y: number; t: number }) {
  const steamY = (t >> 3) % 5;
  return (
    <G>
      <PixelRect x={x} y={y + 1} w={7} h={6} c={P.cream} />
      <PixelRect x={x} y={y + 1} w={7} h={1} c={P.cream_3} />
      <PixelRect x={x} y={y + 6} w={7} h={1} c={P.cream_3} />
      <PixelRect x={x + 6} y={y + 1} w={1} h={6} c={P.cream_4} />
      {/* Coffee */}
      <PixelRect x={x + 1} y={y + 1} w={5} h={1} c={P.terracotta_3} />
      <PixelRect x={x + 1} y={y + 2} w={5} h={1} c={P.terracotta_2} />
      {/* Handle */}
      <PixelRect x={x + 7} y={y + 2} w={1} h={4} c={P.cream} />
      <Px x={x + 8} y={y + 2} c={P.cream} />
      <Px x={x + 8} y={y + 5} c={P.cream} />
      {/* Steam */}
      {steamY < 4 && (
        <G>
          <Px x={x + 1} y={y - 2 - steamY} c={P.cream_3} />
          <Px x={x + 3} y={y - 1 - steamY} c={P.cream_3} />
          <Px x={x + 5} y={y - 3 - steamY} c={P.cream_3} />
        </G>
      )}
    </G>
  );
}

function Pizza({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <PixelRect x={x} y={y} w={14} h={4} c={P.cream_4} />
      <PixelRect x={x} y={y} w={14} h={1} c={P.cream_3} />
      <PixelRect x={x + 1} y={y + 1} w={12} h={2} c={P.cream_4} />
      <PixelRect x={x + 3} y={y + 1} w={4} h={1} c={P.terracotta_2} />
      <PixelRect x={x + 9} y={y + 2} w={3} h={1} c={P.terracotta_2} />
      <PixelRect x={x + 4} y={y + 2} w={5} h={1} c={P.tension} />
      <PixelRect x={x} y={y + 3} w={14} h={1} c={P.cream_4} />
    </G>
  );
}

function Succulent({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <PixelRect x={x + 1} y={y + 4} w={6} h={4} c={P.terracotta_2} />
      <PixelRect x={x + 1} y={y + 4} w={6} h={1} c={P.terracotta} />
      <PixelRect x={x + 2} y={y + 7} w={4} h={1} c={P.terracotta_3} />
      <Px x={x + 3} y={y} c={P.sage} />
      <PixelRect x={x + 2} y={y + 1} w={4} h={1} c={P.sage} />
      <PixelRect x={x + 1} y={y + 2} w={6} h={2} c={P.sage_2} />
      <PixelRect x={x + 2} y={y + 2} w={4} h={1} c={P.sage} />
      <Px x={x + 3} y={y + 2} c={P.sage_hi} />
      <Px x={x + 5} y={y + 1} c={P.sage_hi} />
    </G>
  );
}

function EngineerOnChair({ x, y, t }: { x: number; y: number; t: number }) {
  const bob = ((t >> 4) % 24 < 1) ? -1 : 0;
  const skin = P.cream_3, skinSh = P.cream_4;
  const hair = P.terracotta_3, hairHi = P.terracotta_2;
  const shirt = P.sage, shirtD = P.sage_2, shirtL = P.sage_hi;
  const pants = P.ink, pantsHi = P.ink_hi;
  const chair = P.ink, chairLi = P.ink_hi;
  const hy = y + bob;
  return (
    <G>
      {/* Hair silhouette */}
      <PixelRect x={x + 6} y={hy} w={8} h={1} c={hair} />
      <PixelRect x={x + 4} y={hy + 1} w={12} h={1} c={hair} />
      <PixelRect x={x + 3} y={hy + 2} w={14} h={6} c={hair} />
      <PixelRect x={x + 4} y={hy + 8} w={12} h={1} c={hair} />
      {/* Hair highlights */}
      <Px x={x + 6} y={hy + 1} c={hairHi} />
      <Px x={x + 9} y={hy + 1} c={hairHi} />
      <Px x={x + 12} y={hy + 1} c={hairHi} />
      <Px x={x + 6} y={hy + 4} c={hairHi} />
      <Px x={x + 13} y={hy + 4} c={hairHi} />
      <Px x={x + 9} y={hy + 6} c={hairHi} />
      <Px x={x + 3} y={hy + 5} c={skin} />
      <Px x={x + 16} y={hy + 5} c={skin} />
      {/* Neck */}
      <PixelRect x={x + 8} y={hy + 9} w={4} h={2} c={skin} />
      <PixelRect x={x + 8} y={hy + 10} w={4} h={1} c={skinSh} />
      {/* Shirt (drawn before chair, sides peek out) */}
      <PixelRect x={x + 5} y={y + 12} w={10} h={1} c={shirtD} />
      <PixelRect x={x + 3} y={y + 13} w={14} h={12} c={shirt} />
      <PixelRect x={x + 3} y={y + 13} w={14} h={1} c={shirtD} />
      <PixelRect x={x + 4} y={y + 14} w={2} h={1} c={shirtL} />
      <PixelRect x={x + 14} y={y + 14} w={2} h={1} c={shirtL} />
      <PixelRect x={x + 4} y={y + 15} w={1} h={5} c={shirtL} />
      <PixelRect x={x + 8} y={y + 13} w={4} h={1} c={skin} />
      <PixelRect x={x + 9} y={y + 14} w={2} h={1} c={skinSh} />
      <PixelRect x={x + 9} y={y + 15} w={1} h={9} c={shirtD} />
      <PixelRect x={x + 5} y={y + 17} w={1} h={6} c={shirtD} />
      <PixelRect x={x + 14} y={y + 17} w={1} h={6} c={shirtD} />
      {/* Chair backrest */}
      <PixelRect x={x} y={y + 6} w={20} h={16} c={chair} />
      <PixelRect x={x} y={y + 6} w={20} h={1} c={chairLi} />
      <PixelRect x={x} y={y + 21} w={20} h={1} c={P.ink_2} />
      {[0, 1, 2, 3, 4].map((i) => (
        <G key={`mesh${i}`}>
          <Px x={x + 3 + i * 3} y={y + 9} c={P.muted_2} />
          <Px x={x + 3 + i * 3} y={y + 13} c={P.muted_2} />
          <Px x={x + 3 + i * 3} y={y + 17} c={P.muted_2} />
        </G>
      ))}
      <Px x={x} y={y + 6} c={P.ink_2} />
      <Px x={x + 19} y={y + 6} c={P.ink_2} />
      <PixelRect x={x + 4} y={y + 4} w={12} h={4} c={chair} />
      <PixelRect x={x + 4} y={y + 4} w={12} h={1} c={chairLi} />
      <Px x={x + 4} y={y + 7} c={P.ink_2} />
      <Px x={x + 15} y={y + 7} c={P.ink_2} />
      {/* Armrests */}
      <PixelRect x={x} y={y + 16} w={2} h={5} c={chair} />
      <PixelRect x={x} y={y + 16} w={1} h={5} c={chairLi} />
      <PixelRect x={x + 18} y={y + 16} w={2} h={5} c={chair} />
      <PixelRect x={x + 19} y={y + 16} w={1} h={5} c={chairLi} />
      {/* Seat */}
      <PixelRect x={x + 1} y={y + 25} w={18} h={2} c={chair} />
      <PixelRect x={x + 1} y={y + 25} w={18} h={1} c={chairLi} />
      {/* Pants */}
      <PixelRect x={x + 5} y={y + 26} w={4} h={4} c={pants} />
      <PixelRect x={x + 5} y={y + 26} w={1} h={4} c={pantsHi} />
      <PixelRect x={x + 11} y={y + 26} w={4} h={4} c={pants} />
      <PixelRect x={x + 11} y={y + 26} w={1} h={4} c={pantsHi} />
      {/* Pneumatic post + base + casters */}
      <PixelRect x={x + 9} y={y + 27} w={2} h={3} c={chair} />
      <PixelRect x={x + 1} y={y + 30} w={18} h={2} c={chair} />
      <PixelRect x={x + 1} y={y + 30} w={18} h={1} c={chairLi} />
      {[0, 1, 2, 3, 4].map((i) => (
        <PixelRect key={`cast${i}`} x={x + 1 + i * 4} y={y + 32} w={2} h={1} c={chair} />
      ))}
      {/* Shoes */}
      <PixelRect x={x + 5} y={y + 30} w={4} h={1} c={P.terracotta_3} />
      <PixelRect x={x + 11} y={y + 30} w={4} h={1} c={P.terracotta_3} />
      <PixelRect x={x - 1} y={y + 33} w={22} h={1} c={P.terracotta_3} />
    </G>
  );
}

function GPU({ x, y, t }: { x: number; y: number; t: number }) {
  // 4-LED strip with independent blink periods (matches design exactly).
  const leds: Array<[string, string, number, number]> = [
    [P.sage_hi, P.sage_3, 7, 3],
    [P.gold_hi, P.gold_2, 11, 5],
    [P.tension_hi, P.tension_2, 13, 2],
    [P.sage_hi, P.sage_2, 5, 2],
  ];
  // Spinning fan blade — 4-frame loop.
  const fan = ((t / 2) | 0) % 4;
  let fanBlade: React.ReactNode;
  if (fan === 0) fanBlade = <PixelRect x={x + 6} y={y + 1} w={6} h={1} c={P.muted} />;
  else if (fan === 1) fanBlade = (
    <G>
      <Px x={x + 7} y={y + 1} c={P.muted} />
      <Px x={x + 9} y={y + 2} c={P.muted} />
      <Px x={x + 11} y={y + 1} c={P.muted} />
    </G>
  );
  else if (fan === 2) fanBlade = <PixelRect x={x + 8} y={y} w={2} h={3} c={P.muted} />;
  else fanBlade = (
    <G>
      <Px x={x + 7} y={y + 2} c={P.muted} />
      <Px x={x + 9} y={y + 1} c={P.muted} />
      <Px x={x + 11} y={y + 2} c={P.muted} />
    </G>
  );
  const vents = [];
  for (let i = 0; i < 7; i++) {
    vents.push(<PixelRect key={`v1${i}`} x={x + 2} y={y + 4 + i * 3} w={14} h={1} c={P.ink} />);
    vents.push(<PixelRect key={`v2${i}`} x={x + 2} y={y + 5 + i * 3} w={14} h={1} c={P.muted} />);
  }
  return (
    <G>
      <PixelRect x={x} y={y} w={18} h={32} c={P.ink} />
      <PixelRect x={x} y={y} w={18} h={1} c={P.ink_hi} />
      <PixelRect x={x + 17} y={y} w={1} h={32} c={P.ink_2} />
      <PixelRect x={x} y={y + 31} w={18} h={1} c={P.ink_2} />
      <PixelRect x={x + 1} y={y + 1} w={16} h={30} c={P.muted_2} />
      <PixelRect x={x + 1} y={y + 1} w={16} h={1} c={P.muted} />
      {vents}
      {leds.map(([on, off, period, onLen], i) => {
        const lit = (t + i * 4) % period < onLen;
        return (
          <G key={`led${i}`}>
            <PixelRect x={x + 14} y={y + 6 + i * 5} w={2} h={1} c={lit ? on : off} />
            {lit && <Px x={x + 16} y={y + 6 + i * 5} c={on} />}
          </G>
        );
      })}
      <PixelRect x={x + 2} y={y + 26} w={3} h={1} c={P.sage_hi} />
      <PixelRect x={x + 2} y={y + 27} w={3} h={1} c={P.sage} />
      <PixelRect x={x + 2} y={y} w={14} h={3} c={P.ink_2} />
      {fanBlade}
      <PixelRect x={x - 1} y={y + 32} w={20} h={1} c={P.terracotta_3} />
    </G>
  );
}

function Books({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <PixelRect x={x} y={y + 6} w={14} h={5} c={P.sage_2} />
      <PixelRect x={x} y={y + 6} w={14} h={1} c={P.sage} />
      <PixelRect x={x + 1} y={y + 7} w={12} h={1} c={P.sage_3} />
      <PixelRect x={x + 2} y={y + 8} w={2} h={1} c={P.cream} />
      <PixelRect x={x + 6} y={y + 8} w={6} h={1} c={P.cream} />
      <PixelRect x={x + 2} y={y + 2} w={13} h={4} c={P.tension} />
      <PixelRect x={x + 2} y={y + 2} w={13} h={1} c={P.tension_hi} />
      <PixelRect x={x + 4} y={y + 4} w={8} h={1} c={P.cream} />
      <PixelRect x={x + 1} y={y} w={11} h={2} c={P.gold_2} />
      <PixelRect x={x + 1} y={y} w={11} h={1} c={P.gold} />
      <PixelRect x={x + 3} y={y + 1} w={6} h={1} c={P.ink} />
      <PixelRect x={x - 1} y={y + 11} w={16} h={1} c={P.terracotta_3} />
    </G>
  );
}

function Plant({ x, y, t }: { x: number; y: number; t: number }) {
  const sway = ((t >> 5) % 8 < 4) ? 0 : 1;
  return (
    <G>
      <PixelRect x={x + 2} y={y + 18} w={14} h={8} c={P.terracotta} />
      <PixelRect x={x + 2} y={y + 18} w={14} h={1} c={P.terracotta_hi} />
      <PixelRect x={x + 3} y={y + 25} w={12} h={1} c={P.terracotta_2} />
      <PixelRect x={x + 4} y={y + 26} w={10} h={1} c={P.terracotta_3} />
      <PixelRect x={x + 8 + sway} y={y + 13} w={2} h={6} c={P.sage_3} />
      <PixelRect x={x + 5 + sway} y={y} w={8} h={2} c={P.sage_2} />
      <PixelRect x={x + 3 + sway} y={y + 1} w={12} h={3} c={P.sage} />
      <PixelRect x={x + 1 + sway} y={y + 4} w={16} h={4} c={P.sage_2} />
      <PixelRect x={x + sway} y={y + 8} w={18} h={4} c={P.sage} />
      <PixelRect x={x + 3 + sway} y={y + 12} w={12} h={3} c={P.sage_2} />
      <PixelRect x={x + 6 + sway} y={y + 15} w={6} h={2} c={P.sage_3} />
      <Px x={x + 6 + sway} y={y + 2} c={P.sage_hi} />
      <Px x={x + 10 + sway} y={y + 4} c={P.sage_hi} />
      <Px x={x + 4 + sway} y={y + 7} c={P.sage_hi} />
      <Px x={x + 13 + sway} y={y + 9} c={P.sage_hi} />
      <Px x={x + 8 + sway} y={y + 11} c={P.sage_hi} />
      <Px x={x + 13 + sway} y={y + 5} c={P.gold} />
      <PixelRect x={x + 1} y={y + 26} w={16} h={1} c={P.terracotta_3} />
    </G>
  );
}

function Cans({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <PixelRect x={x} y={y + 2} w={4} h={6} c={P.tension} />
      <PixelRect x={x} y={y + 2} w={4} h={1} c={P.tension_hi} />
      <PixelRect x={x} y={y + 7} w={4} h={1} c={P.tension_2} />
      <PixelRect x={x} y={y + 1} w={4} h={1} c={P.muted} />
      <PixelRect x={x + 1} y={y} w={2} h={1} c={P.muted} />
      <PixelRect x={x + 1} y={y + 4} w={2} h={1} c={P.cream} />
      <PixelRect x={x + 5} y={y + 7} w={6} h={2} c={P.sage_2} />
      <PixelRect x={x + 5} y={y + 7} w={6} h={1} c={P.sage_hi} />
      <Px x={x + 10} y={y + 7} c={P.muted} />
      <PixelRect x={x + 11} y={y + 8} w={3} h={1} c={P.sage_3} />
      <PixelRect x={x + 13} y={y + 7} w={3} h={2} c={P.gold} />
      <PixelRect x={x + 13} y={y + 7} w={3} h={1} c={P.gold_hi} />
      <Px x={x + 15} y={y + 8} c={P.muted} />
    </G>
  );
}

function Roomba({ x, y, t }: { x: number; y: number; t: number }) {
  const cycle = (t >> 1) % 4;
  return (
    <G>
      <PixelRect x={x + 1} y={y} w={10} h={1} c={P.ink_hi} />
      <PixelRect x={x} y={y + 1} w={12} h={4} c={P.ink} />
      <PixelRect x={x + 1} y={y + 5} w={10} h={1} c={P.ink_2} />
      <PixelRect x={x + 2} y={y + 1} w={8} h={1} c={P.muted_2} />
      {[0, 1, 2, 3].map((i) => (
        <Px key={`r${i}`} x={x + 2 + i * 2} y={y + 3} c={i === cycle ? P.sage_hi : P.muted} />
      ))}
      <PixelRect x={x} y={y + 4} w={12} h={1} c={P.muted} />
      <Px x={x + 6} y={y + 2} c={P.gold} />
      <PixelRect x={x - 1} y={y + 6} w={14} h={1} c={P.terracotta_3} />
    </G>
  );
}

// Cable from monitor jack to GPU — slight downward sag mimics physical cable.
function Cable({ x1, y1, x2, y2, color }: { x1: number; y1: number; x2: number; y2: number; color: string }) {
  const dx = x2 - x1, dy = y2 - y1;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  const pixels = [];
  for (let i = 0; i <= steps; i++) {
    const ft = i / steps;
    const sag = Math.sin(ft * Math.PI) * 4;
    pixels.push(
      <Px
        key={`cab${i}`}
        x={Math.round(x1 + dx * ft)}
        y={Math.round(y1 + dy * ft + sag)}
        c={color}
      />
    );
  }
  return <G>{pixels}</G>;
}

// Floating tokens drifting up from monitor — 4 sprites on offset phases.
function FloatingTokens({ spawnX, spawnY, t }: { spawnX: number; spawnY: number; t: number }) {
  const tokens = [0, 1, 2, 3].map((i) => {
    const phase = (t + i * 7) % 28;
    const opacity = phase < 24 ? 1 : 0.3;
    const py = spawnY - phase * 5;
    const px = spawnX + Math.round(Math.sin(phase / 3) * 4);
    return { i, px, py, opacity };
  });
  return (
    <G>
      {tokens.map((tk) => (
        <G key={tk.i} opacity={tk.opacity}>
          <PixelRect x={tk.px} y={tk.py} w={5} h={5} c={P.gold} />
          <PixelRect x={tk.px + 1} y={tk.py} w={3} h={1} c={P.gold_hi} />
          <PixelRect x={tk.px} y={tk.py + 1} w={1} h={3} c={P.gold_hi} />
          <PixelRect x={tk.px + 4} y={tk.py + 1} w={1} h={3} c={P.gold_2} />
          <PixelRect x={tk.px + 1} y={tk.py + 4} w={3} h={1} c={P.gold_2} />
        </G>
      ))}
    </G>
  );
}

function HitOutline({ zone }: { zone: HitZone }) {
  return (
    <G>
      <Rect
        x={zone.x - 1}
        y={zone.y - 1}
        width={zone.w + 2}
        height={zone.h + 2}
        fill="none"
        stroke={colors.gold_hi}
        strokeWidth={1}
      />
      <Rect
        x={zone.x - 2}
        y={zone.y - 2}
        width={zone.w + 4}
        height={zone.h + 4}
        fill="none"
        stroke={colors.ink}
        strokeWidth={1}
      />
    </G>
  );
}
