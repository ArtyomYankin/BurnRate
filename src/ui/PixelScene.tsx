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

export type SceneId = "seed" | "coworking" | "office" | "megacorp" | "agi";

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

// MEGACORP OFFICE — coords ported 1:1 from Claude Design v5
// (screens.jsx::MEGACORP_HITS). Design v5 narrowed the 3 desks to fit a
// dedicated server-room alcove on the right, and grew the GPU zone to wrap
// the WHOLE alcove (2 BigRacks + 2 GPU towers behind a glass partition).
const MEGACORP_ZONES: HitZone[] = [
  // 3 narrower desks — engineer (Hire) below, monitor (Training) above
  { id: "engineer", x:  16, y: 266, w: 22, h: 34, label: "Hire (desk 1)" },
  { id: "engineer", x:  68, y: 266, w: 22, h: 34, label: "Hire (desk 2)" },
  { id: "engineer", x: 120, y: 266, w: 22, h: 34, label: "Hire (desk 3)" },
  { id: "monitor",  x:  13, y: 234, w: 26, h: 22, label: "Training (West cluster)" },
  { id: "monitor",  x:  65, y: 234, w: 26, h: 22, label: "Training (Central cluster)" },
  { id: "monitor",  x: 117, y: 234, w: 26, h: 22, label: "Training (East cluster)" },
  // Server room alcove (Datacenter Pod) — wraps the whole alcove
  { id: "gpu",      x: 192, y: 228, w: 48, h: 100, label: "Buy GPU (alcove)" },
  // In-glass rack on the back wall — DATA (Synthetic Pipeline)
  { id: "books",    x: 130, y: 100, w: 18, h: 56, label: "Buy Data (glass rack)" },
  // Ceiling fluorescent strip — ENERGY (Substation)
  { id: "energy",   x:   8, y:   1, w: 60, h:  5, label: "Buy Energy (substation)" },
  // Corporate kanban whiteboard — RESEARCH
  { id: "research", x: 158, y:  80, w: 80, h: 60, label: "Research (kanban)" },
  // Far-left corner plant — cosmetic
  { id: "plant",    x:   0, y: 262, w: 18, h: 30, label: "Cosmetic" },
];

// AGI SINGULARITY — coords ported 1:1 from Claude Design v3
// (screens.jsx::AGI_HITS). The mega-structure core IS the Autonomous Agent
// producer; the energy beam IS the Fusion Constellation; the orbital arrays
// ARE the Data tap; Earth itself IS planetary compute (GPU); the pulsing
// inner core IS Recursive Self-Training.
//
// Research isn't in design v3's AGI hits (the player is past spending Equity
// at this point), but we keep a compact zone on the top-right nebula so
// reaching the Research screen from Home stays possible across all scenes.
const AGI_ZONES: HitZone[] = [
  { id: "engineer", x: 119, y: 121, w: 60, h: 60, label: "Autonomous Agent (core)" },
  { id: "energy",   x:  70, y: 150, w: 60, h: 80, label: "Energy (beam)" },
  { id: "books",    x:   0, y:  60, w: 70, h: 70, label: "Data (orbital arrays)" },
  { id: "monitor",  x: 139, y: 141, w: 22, h: 22, label: "Recursive Self-Training" },
  { id: "gpu",      x:   0, y: 250, w: 70, h: 90, label: "Planetary Compute (Earth)" },
  // Off-design fallback so Research is still reachable from this scene.
  { id: "research", x: 184, y:  30, w: 52, h: 38, label: "Research (nebula)" },
];

// COWORKING (Series B/C) — coords ported 1:1 from Claude Design v4
// (screens.jsx::COWORKING_HITS). Shared bench with 3 engineers + 3 monitors,
// La Croix tower = energy tap, half-height rack = GPU, kanban = research.
// Cosmetics from the design (phone booth, foosball, kombucha) are skipped
// for now — they'd need new HitIds + popup cases to read correctly. Plant
// is reused as a generic "Cosmetic" with the existing popup flavor.
const COWORKING_ZONES: HitZone[] = [
  { id: "engineer", x:  49, y: 266, w: 22, h: 34, label: "Hire (bench 1)" },
  { id: "engineer", x:  99, y: 266, w: 22, h: 34, label: "Hire (bench 2)" },
  { id: "engineer", x: 149, y: 266, w: 22, h: 34, label: "Hire (bench 3)" },
  { id: "monitor",  x:  48, y: 234, w: 26, h: 22, label: "Training (laptop 1)" },
  { id: "monitor",  x:  98, y: 234, w: 26, h: 22, label: "Training (laptop 2)" },
  { id: "monitor",  x: 148, y: 234, w: 26, h: 22, label: "Training (laptop 3)" },
  // Design v4 zone is x:202 y:120 w:24 h:38 but that includes ~10px of empty
  // brick above the kitchen items — the ring highlight ends up framing dead
  // wall. Tightened to hug the visible kitchen content (La Croix pyramid +
  // kombucha tap + counter top) so the selection feels accurate.
  { id: "energy",   x: 198, y: 126, w: 42, h: 34, label: "Buy Energy (kitchen)" },
  { id: "gpu",      x: 210, y: 300, w: 22, h: 32, label: "Buy GPU (rack)" },
  { id: "research", x:  95, y:  35, w: 52, h: 40, label: "Research (kanban)" },
  { id: "plant",    x: 184, y: 262, w: 22, h: 36, label: "Cosmetic" },
];

// STARTUP OFFICE (Series D/IPO) — coords ported 1:1 from Claude Design v4
// (screens.jsx::OFFICE_HITS). 3 desks (Senior/Staff/Senior), tall rack +
// GPU tower in right server nook, hanging planter = energy, whiteboard =
// research. Design v4 has no Data prop in this scene; player uses Producers
// screen tabs to buy Data here.
const OFFICE_ZONES: HitZone[] = [
  { id: "engineer", x:  24, y: 260, w: 22, h: 34, label: "Hire (desk 1)" },
  { id: "engineer", x:  74, y: 260, w: 22, h: 34, label: "Hire (desk 2)" },
  { id: "engineer", x: 124, y: 260, w: 22, h: 34, label: "Hire (desk 3)" },
  { id: "monitor",  x:  23, y: 228, w: 26, h: 22, label: "Training (A100 pod 1)" },
  { id: "monitor",  x:  73, y: 228, w: 26, h: 22, label: "Training (A100 pod 2)" },
  { id: "monitor",  x: 123, y: 228, w: 26, h: 22, label: "Training (A100 pod 3)" },
  { id: "gpu",      x: 194, y: 232, w: 46, h: 56, label: "Buy GPU (server nook)" },
  { id: "research", x: 196, y:  64, w: 34, h: 24, label: "Research (whiteboard)" },
  { id: "energy",   x: 148, y:  60, w: 14, h: 12, label: "Buy Energy (planter)" },
  { id: "plant",    x: 156, y: 258, w: 22, h: 36, label: "Cosmetic" },
];

export const HIT_ZONES_BY_SCENE: Record<SceneId, HitZone[]> = {
  seed: SEED_ZONES,
  coworking: COWORKING_ZONES,
  office: OFFICE_ZONES,
  megacorp: MEGACORP_ZONES,
  agi: AGI_ZONES,
};

/**
 * Funding-round → scene mapping. 5 scenes today; the 3 remaining slots
 * (campus / datacenter / planetary) will land later between megacorp and agi.
 *   seed      → rounds 0-1 (Seed, Series A)       — garage, solo founder
 *   coworking → rounds 2-3 (Series B, Series C)   — WeWork bench
 *   office    → rounds 4-5 (Series D, IPO)        — brick + Edison bulbs
 *   megacorp  → rounds 6-8 (Secondary…Sovereign)  — corporate slate-blue
 *   agi       → rounds 9-11 (Bailout…Singularity) — galactic endgame
 */
export function sceneForRound(roundIdx: number): SceneId {
  if (roundIdx <= 1) return "seed";
  if (roundIdx <= 3) return "coworking";
  if (roundIdx <= 5) return "office";
  if (roundIdx <= 8) return "megacorp";
  return "agi";
}

interface Props {
  width: number;
  height: number;
  onHit?(id: HitId): void;
  activeHit?: HitId | null;
  scene?: SceneId;
  /** Optional tutorial highlight: pulses a gold ring around the named zone
   *  so the first-run tutorial can point at "the engineer" / "the GPU". */
  tutorialHighlight?: HitId | null;
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
export function PixelScene({ width, height, onHit, activeHit, scene = "seed", tutorialHighlight = null }: Props) {
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
        ) : scene === "coworking" ? (
          <CoworkingScene t={t} />
        ) : scene === "office" ? (
          <OfficeScene t={t} />
        ) : (
          <SeedScene t={t} />
        )}
        {/* Selection ring — wraps only the tapped object, like the garage */}
        {activeHit && activeIdx != null && zones[activeIdx] && (
          <HitOutline zone={zones[activeIdx]} />
        )}
        {/* Tutorial pulse — gold pulsing ring around the first matching zone
            with this id. Driven by the same tick the scene already uses. */}
        {tutorialHighlight && (() => {
          const z = zones.find((zz) => zz.id === tutorialHighlight);
          return z ? <TutorialPulse zone={z} t={t} /> : null;
        })()}
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
// NEW HELPERS (used by Coworking scene — design v4)
// ═══════════════════════════════════════════════════════════════════════

// Half-height networking rack with glass front + patch cables. Used by the
// CoworkingScene as the GPU compute target ("the corner server").
function CoworkRack({ x, y, t }: { x: number; y: number; t: number }) {
  const units = [];
  for (let i = 0; i < 6; i++) {
    units.push(
      <G key={`u${i}`}>
        <PixelRect x={x + 3} y={y + 3 + i * 4} w={16} h={3} c={P.ink_hi} />
        <PixelRect x={x + 3} y={y + 3 + i * 4} w={16} h={1} c={P.ink_hi} />
        <Px x={x + 5} y={y + 4 + i * 4} c={(t + i * 3) % 5 < 2 ? P.sage_hi : P.sage_3} />
        <Px x={x + 7} y={y + 4 + i * 4} c={(t + i) % 7 < 3 ? P.gold : P.terracotta_3} />
        <Px x={x + 16} y={y + 4 + i * 4} c={(t + i * 2) % 4 < 2 ? P.terracotta : P.ink_hi} />
      </G>
    );
  }
  return (
    <G>
      <PixelRect x={x} y={y} w={22} h={30} c={P.ink_2} />
      <PixelRect x={x} y={y} w={22} h={1} c={P.muted} />
      <PixelRect x={x + 21} y={y} w={1} h={30} c={P.ink_2} />
      <Rect x={x + 2} y={y + 2} width={18} height={26} fill={P.sage_hi} opacity={0.3} />
      <PixelRect x={x + 2} y={y + 2} w={18} h={1} c={P.sage_2} />
      {units}
      {/* Patch cables spilling out the side */}
      <Px x={x + 22} y={y + 8} c={P.tension} />
      <Px x={x + 23} y={y + 9} c={P.sage} />
      <Px x={x + 22} y={y + 11} c={P.gold} />
      {/* Caster feet */}
      <PixelRect x={x + 1} y={y + 30} w={3} h={2} c={P.ink_2} />
      <PixelRect x={x + 18} y={y + 30} w={3} h={2} c={P.ink_2} />
      <PixelRect x={x - 1} y={y + 32} w={24} h={1} c={"#A88858"} />
    </G>
  );
}

// Tall server rack with 8 stacked 1U units, blinking LEDs, drive bays.
// Used by the OfficeScene as the GPU compute target.
function BigRack({ x, y, t }: { x: number; y: number; t: number }) {
  const ledColors = [P.sage_hi, P.gold_hi, P.tension_hi, P.sage];
  const units = [];
  for (let i = 0; i < 8; i++) {
    const sy = y + 3 + i * 6;
    const leds = [];
    for (let j = 0; j < 4; j++) {
      const lit = (t + i * 5 + j * 3) % (4 + j * 2) < 2;
      leds.push(
        <Px key={`l${j}`} x={x + 4 + j * 2} y={sy + 2} c={lit ? ledColors[j % 4] : P.ink} />
      );
    }
    units.push(
      <G key={`u${i}`}>
        <PixelRect x={x + 2} y={sy} w={20} h={5} c={P.ink_hi} />
        <PixelRect x={x + 2} y={sy} w={20} h={1} c={P.ink_2} />
        {leds}
        <PixelRect x={x + 14} y={sy + 1} w={6} h={3} c={P.ink} />
        <Px x={x + 16} y={sy + 2} c={P.sage_hi} />
      </G>
    );
  }
  return (
    <G>
      <PixelRect x={x} y={y} w={24} h={56} c={P.ink} />
      <PixelRect x={x} y={y} w={24} h={1} c={P.ink_hi} />
      <PixelRect x={x + 23} y={y} w={1} h={56} c={P.ink_2} />
      <PixelRect x={x + 1} y={y + 1} w={22} h={54} c={P.muted_2} />
      <PixelRect x={x + 1} y={y + 1} w={22} h={1} c={P.muted} />
      {units}
      <PixelRect x={x - 1} y={y + 56} w={26} h={1} c={P.terracotta_3} />
    </G>
  );
}

// "MOVE FAST" / "SHIP IT" framed poster. Used by OfficeScene wall decor.
// variant=0 → first set of text widths, variant=1 → second set.
function WallPoster({
  x, y, color, variant,
}: { x: number; y: number; color: string; variant: 0 | 1 }) {
  return (
    <G>
      <PixelRect x={x - 1} y={y - 1} w={22} h={18} c={P.terracotta_3} />
      <PixelRect x={x} y={y} w={20} h={16} c={P.cream_hi} />
      <PixelRect x={x + 2} y={y + 2} w={16} h={6} c={color} />
      <PixelRect x={x + 3} y={y + 10} w={14} h={1} c={P.ink} />
      <PixelRect x={x + 3} y={y + 12} w={variant ? 8 : 11} h={1} c={P.ink} />
      <PixelRect x={x + 3} y={y + 14} w={variant ? 12 : 7} h={1} c={color} />
    </G>
  );
}

// Gold beanbag chair (Office lounge corner).
function Beanbag2({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <PixelRect x={x + 2} y={y + 8} w={18} h={6} c={P.gold_2} />
      <PixelRect x={x} y={y + 9} w={22} h={4} c={P.gold_2} />
      <PixelRect x={x + 4} y={y} w={14} h={5} c={P.gold} />
      <PixelRect x={x + 2} y={y + 3} w={18} h={6} c={P.gold} />
      <PixelRect x={x + 4} y={y} w={14} h={1} c={P.gold_hi} />
      <PixelRect x={x + 6} y={y + 7} w={10} h={2} c={P.gold_2} />
      <Px x={x + 6} y={y + 2} c={P.gold_hi} />
      <PixelRect x={x - 1} y={y + 14} w={24} h={1} c={"#9A6E40"} />
    </G>
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
// COWORKING / WEWORK SCENE — Series B/C, scrappy mid-2010s shared office.
// Port of pixel-art.jsx::composeCoworkingScene (design v4).
// ═══════════════════════════════════════════════════════════════════════
const COWORK = {
  wallTop:    "#F5EFE2",
  wallTopHi:  "#FBF7EC",
  wallBrick:  "#B57A5B",
  brickDark:  "#8B5639",
  brickEdge:  "#5C3924",
  duct:       "#9CA098",
  ductRivet:  "#7C7C7C",
  ceilTop:    "#C8B89A",
  ceilEdge:   "#A89878",
  floor:      "#C8A878",
  floorHi:    "#D8C090",
  floorSeam:  "#A88858",
  bulb:       "#EBBE6E",
  bulbOff:    "#A88858",
  glow:       "#FFFFEE",
  boothBody:  "#3F5142",
  boothEdge:  "#5C7560",
  boothDark:  "#2A3A2E",
  glass:      "#A4BDA9",
  glassHi:    "#E0E4E8",
  felt:       "#3F5142",
  feltEdge:   "#5C7560",
  feltDark:   "#2A3A2E",
};

function CoworkingScene({ t }: { t: number }) {
  const FLOOR_Y = 222;
  const els: React.ReactNode[] = [];
  let k = 0;
  const key = () => `cw${k++}`;
  const R = (x: number, y: number, w: number, h: number, c: string) =>
    els.push(<PixelRect key={key()} x={x} y={y} w={w} h={h} c={c} />);
  const PX = (x: number, y: number, c: string) =>
    els.push(<Px key={key()} x={x} y={y} c={c} />);

  // Ceiling (exposed ducts)
  R(0, 0, W, 7, COWORK.ceilTop);
  R(0, 0, W, 1, COWORK.ceilEdge);
  R(0, 3, W, 3, COWORK.duct);
  for (let i = 4; i < W; i += 18) R(i, 3, 1, 3, COWORK.ductRivet);
  // Cream upper wall
  R(0, 7, W, 90, COWORK.wallTop);
  for (let y = 9; y < 96; y += 8) R(0, y, W, 1, COWORK.wallTopHi);
  // Exposed brick lower band
  R(0, 96, W, FLOOR_Y - 96, COWORK.wallBrick);
  for (let by = 96; by < FLOOR_Y; by += 6) {
    R(0, by, W, 1, COWORK.brickDark);
    const off = ((by / 6) % 2) * 8;
    for (let bx = -off; bx < W; bx += 16) R(bx, by, 1, 6, COWORK.brickDark);
  }
  // Wall→floor seam
  R(0, FLOOR_Y - 2, W, 1, COWORK.brickEdge);
  // Blonde wood floor
  R(0, FLOOR_Y, W, H - FLOOR_Y, COWORK.floor);
  for (let i = 0; i < W; i += 20) R(i + ((i / 20) % 3) * 4, FLOOR_Y, 1, H - FLOOR_Y, COWORK.floorSeam);
  R(0, FLOOR_Y, W, 1, COWORK.floorHi);
  R(0, FLOOR_Y + 1, W, 1, COWORK.floor);
  R(0, H - 3, W, 1, COWORK.floorSeam);

  // Edison-bulb string lights
  for (let x = 0; x < W; x++) {
    const sag = (Math.sin(x / 30) * 4 + 14) | 0;
    PX(x, sag, COWORK.brickEdge);
  }
  for (let bx = 14; bx < W; bx += 30) {
    const sag = (Math.sin(bx / 30) * 4 + 14) | 0;
    R(bx, sag + 1, 1, 3, COWORK.brickEdge);
    const glow = (t + bx) % 40 < 36;
    R(bx - 1, sag + 4, 3, 4, glow ? COWORK.bulb : COWORK.bulbOff);
    PX(bx, sag + 3, glow ? COWORK.glow : COWORK.bulbOff);
  }

  // 2 phone-booth pods — translucent glass door is the defining detail,
  // so we push a half-alpha <Rect> directly (R-helper only does opaque).
  for (let p = 0; p < 2; p++) {
    const bx = 8 + p * 40;
    const by = 40;
    // Solid green frame
    R(bx, by, 26, 56, COWORK.boothBody);
    R(bx, by, 26, 1, COWORK.boothEdge);
    R(bx + 25, by, 1, 56, COWORK.boothDark);
    // Glass door panel (alpha 0.4) — see-through, sits over the frame
    els.push(
      <Rect
        key={key()}
        x={bx + 4} y={by + 6} width={18} height={44}
        fill={COWORK.glass} opacity={0.4}
      />
    );
    // Door frame top + bottom edges
    R(bx + 4, by + 6, 18, 1, COWORK.boothEdge);
    R(bx + 4, by + 49, 18, 1, COWORK.boothDark);
    // Vertical glass reflection streak
    R(bx + 7, by + 10, 1, 30, COWORK.glassHi);
    // Person silhouette inside (faint, behind the glass)
    R(bx + 10, by + 18, 6, 18, COWORK.boothDark);
    R(bx + 11, by + 14, 4, 4, COWORK.boothBody);
    // Occupied indicator light
    PX(bx + 21, by + 8, (p + (t >> 4)) % 2 ? colors.tensionRed : colors.sage);
    // Roof
    R(bx - 1, by - 2, 28, 2, COWORK.boothDark);
  }

  // Kanban whiteboard between pods and kitchen
  const wbX = 96, wbY = 36;
  R(wbX - 1, wbY - 1, 52, 40, COWORK.ceilEdge);
  R(wbX, wbY, 50, 38, COWORK.wallTopHi);
  R(wbX, wbY, 50, 2, COWORK.ceilEdge);
  const colHeads = [colors.sage, colors.gold, colors.terracotta];
  const stickyHues = ["#FCF066", "#A5C8FF", "#B6F2C7", "#FF9A8B"];
  for (let c = 0; c < 3; c++) {
    R(wbX + 4 + c * 16, wbY + 5, 1, 30, COWORK.ceilTop);
    R(wbX + 6 + c * 16, wbY + 6, 10, 1, colHeads[c]);
    for (let s = 0; s < 2 + (c % 2); s++) {
      R(wbX + 5 + c * 16, wbY + 10 + s * 7, 12, 5, stickyHues[(c + s) % 4]);
    }
  }

  // Kitchen counter + La Croix tower + kombucha tap
  const kX = 200;
  R(kX, 150, 40, 8, COWORK.floorSeam);
  R(kX, 150, 40, 1, COWORK.floor);
  R(kX, 158, 40, FLOOR_Y - 158, COWORK.brickDark);
  R(kX + 4, 162, 14, FLOOR_Y - 166, "#7C5030");
  R(kX + 22, 162, 14, FLOOR_Y - 166, "#7C5030");
  PX(kX + 16, 170, colors.gold);
  PX(kX + 24, 170, colors.gold);
  // La Croix pyramid
  const lcColors = ["#A5C8FF", "#FF9A8B", "#B6F2C7", "#EBBE6E"];
  for (let row = 0; row < 4; row++) {
    const count = 4 - row;
    for (let c = 0; c < count; c++) {
      const cx = kX + 4 + row * 2 + c * 4;
      const cy = 148 - row * 6;
      R(cx, cy, 3, 5, lcColors[(row + c) % 4]);
      R(cx, cy, 3, 1, COWORK.wallTopHi);
      PX(cx + 1, cy + 2, COWORK.wallTopHi);
    }
  }
  // Kombucha tap
  const ktX = kX + 28;
  R(ktX, 138, 6, 12, "#5C5C5C");
  R(ktX, 138, 6, 1, "#7C7C7C");
  R(ktX + 2, 134, 2, 4, "#3A3A3A");
  R(ktX + 1, 133, 4, 1, colors.gold);
  PX(ktX + 3, 150, colors.terracotta);
  R(ktX - 2, 128, 10, 3, COWORK.felt);
  R(ktX, 129, 6, 1, COWORK.glass);

  // Bench-style shared desktop
  const podX = 30, podY = 256;
  R(podX, podY, 150, 4, COWORK.floorSeam);
  R(podX, podY, 150, 1, COWORK.floor);
  R(podX, podY + 4, 150, 1, COWORK.brickDark);
  R(podX + 2, podY + 5, 3, 28, COWORK.brickDark);
  R(podX + 145, podY + 5, 3, 28, COWORK.brickDark);
  R(podX + 73, podY + 5, 3, 28, COWORK.brickDark);
  R(podX + 10, podY + 6, 130, 1, "#3A3A3A");

  // Foosball table
  const fbX = 8, fbY = 300;
  R(fbX, fbY, 40, 18, COWORK.felt);
  R(fbX, fbY, 40, 1, COWORK.feltEdge);
  R(fbX, fbY + 17, 40, 1, COWORK.feltDark);
  R(fbX, fbY, 1, 18, COWORK.brickDark);
  R(fbX + 39, fbY, 1, 18, COWORK.brickDark);
  R(fbX + 20, fbY, 1, 18, COWORK.feltEdge);
  R(fbX, fbY + 7, 1, 4, "#1A1A1A");
  R(fbX + 39, fbY + 7, 1, 4, "#1A1A1A");
  for (let rod = 0; rod < 4; rod++) {
    const rx = fbX + 6 + rod * 9;
    R(rx, fbY - 2, 1, 22, COWORK.duct);
    for (let fig = 0; fig < 3; fig++) {
      R(rx - 1, fbY + 3 + fig * 5, 3, 3, rod % 2 ? colors.tensionRed : colors.gold);
    }
    R(rx - 1, fbY - 4, 3, 2, "#3A3A3A");
  }
  R(fbX + 2, fbY + 18, 2, 10, COWORK.brickEdge);
  R(fbX + 36, fbY + 18, 2, 10, COWORK.brickEdge);

  return (
    <G>
      {els}
      {/* 3 workstations on the bench (sprites layered over the els bg) */}
      {[0, 1, 2].map((i) => {
        const dx = podX + 8 + i * 50;
        return (
          <G key={`ws${i}`}>
            <Monitor x={dx + 10} y={podY - 22} t={t + i * 7} />
            <EngineerOnChair x={dx + 13} y={podY + 12} t={t + i * 11} />
            <Keyboard x={dx + 6} y={podY - 2} t={t + i * 5} />
            <Succulent x={dx + 40} y={podY - 9} />
          </G>
        );
      })}
      {/* Big leafy floor plant (right of pod) + woven pot */}
      <Plant x={186} y={FLOOR_Y + 46} t={t} />
      <PixelRect x={186} y={FLOOR_Y + 64} w={18} h={10} c={COWORK.floorSeam} />
      {[0, 3, 6, 9, 12, 15].map((dx) => (
        <PixelRect key={`bk${dx}`} x={186 + dx} y={FLOOR_Y + 64} w={1} h={10} c={COWORK.brickDark} />
      ))}
      {/* Half-height networking rack — the pod's GPU */}
      <CoworkRack x={210} y={FLOOR_Y + 78} t={t} />
      <FloatingTokens spawnX={60} spawnY={244} t={t} />
    </G>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// STARTUP OFFICE SCENE — Series D / IPO, exposed brick + Edison bulbs +
// posters + couch lounge. Port of pixel-art.jsx::composeOfficeScene (design v4).
// Note: FLOOR_Y=214 here (not 222) — design picks a higher floor so the
// lounge couch + standing rack at the back fit comfortably below.
// ═══════════════════════════════════════════════════════════════════════
const OFFICE = {
  beamDark:   "#5C3924",
  beamMid:    "#8B5639",
  wallCream:  "#F5EFE2",
  wallHi:     "#FBF7EC",
  brick:      "#A8503A",
  brickEdge:  "#8B3A28",
  brickHi:    "#B85C44",
  floorWood:  "#B58858",
  floorPlank: "#9A6E40",
  floorHi:    "#C89868",
  bulb:       "#EBBE6E",
  bulbOff:    "#9A6E40",
  posterRed:  "#C97B5B",
  posterSage: "#7E9A85",
  goldFrame:  "#D4A24C",
  frameGreen: "#3F5142",
  frameSage:  "#7E9A85",
  neonOn:     "#D45A68",
  neonOff:    "#5C2050",
  switchBlue: "#4A6FA5",
  switchRed:  "#B23A48",
};

function OfficeScene({ t }: { t: number }) {
  const FLOOR_Y = 214;
  const els: React.ReactNode[] = [];
  let k = 0;
  const key = () => `of${k++}`;
  const R = (x: number, y: number, w: number, h: number, c: string) =>
    els.push(<PixelRect key={key()} x={x} y={y} w={w} h={h} c={c} />);
  const PX = (x: number, y: number, c: string) =>
    els.push(<Px key={key()} x={x} y={y} c={c} />);

  // Ceiling with exposed wood beams
  R(0, 0, W, 6, OFFICE.beamDark);
  for (let i = 0; i < W; i += 22) R(i, 0, 2, 6, OFFICE.beamMid);
  // Cream upper wall
  R(0, 6, W, 54, OFFICE.wallCream);
  for (let y = 8; y < 58; y += 7) R(0, y, W, 1, OFFICE.wallHi);
  // Exposed brick lower wall
  R(0, 60, W, FLOOR_Y - 60, OFFICE.brick);
  for (let by = 60; by < FLOOR_Y; by += 6) {
    R(0, by, W, 1, OFFICE.brickEdge);
    const off = ((by / 6) % 2) * 8;
    for (let bx = -off; bx < W; bx += 16) R(bx, by, 1, 6, OFFICE.brickEdge);
  }
  // Lighter-brick highlights — break the texture monotony
  for (let i = 0; i < 14; i++) {
    const hx = (i * 37) % W, hy = 62 + ((i * 23) % (FLOOR_Y - 66));
    R(hx, ((hy / 6) | 0) * 6, 14, 5, OFFICE.brickHi);
  }
  R(0, FLOOR_Y - 2, W, 1, OFFICE.beamDark);

  // Warm wood floor
  R(0, FLOOR_Y, W, H - FLOOR_Y, OFFICE.floorWood);
  for (let i = 0; i < W; i += 22) R(i + ((i / 22) % 3) * 5, FLOOR_Y, 1, H - FLOOR_Y, OFFICE.floorPlank);
  R(0, FLOOR_Y, W, 1, OFFICE.floorHi);
  R(0, H - 3, W, 1, OFFICE.floorPlank);

  // Edison bulb string with subtle sag
  for (let x = 0; x < W; x++) {
    const sag = ((Math.sin(x / 34) * 3 + 10) | 0);
    PX(x, sag, "#3A3A3A");
  }
  for (let bx = 18; bx < W; bx += 34) {
    const sag = ((Math.sin(bx / 34) * 3 + 10) | 0);
    R(bx, sag + 1, 1, 2, "#3A3A3A");
    const glow = (t + bx) % 44 < 40;
    R(bx - 1, sag + 3, 3, 3, glow ? OFFICE.bulb : OFFICE.bulbOff);
  }

  // Framed first dollar (gold frame, green matte, sage bill)
  R(80, 66, 16, 14, OFFICE.goldFrame);
  R(81, 67, 14, 12, OFFICE.frameGreen);
  R(83, 70, 10, 6, OFFICE.frameSage);
  PX(88, 73, OFFICE.bulb);
  R(84, 69, 8, 1, colors.sage_hi);

  // Neon "AGI?" sign on the brick (4 vertical strokes, blinking)
  const neonOn = (t >> 3) % 8 < 6;
  const neon = neonOn ? OFFICE.neonOn : OFFICE.neonOff;
  R(112, 68, 18, 1, neon);
  R(112, 68, 1, 8, neon);
  R(120, 68, 1, 8, neon);
  R(128, 68, 1, 8, neon);

  // Hanging planter (Energy hit target — design v4 uses the wall electrical
  // at this position; we render the leafy planter as the "buy energy" prop).
  R(150, 62, 10, 4, OFFICE.beamMid);
  for (let i = 0; i < 8; i++) PX(148 + i * 2, 66 + (i % 3) * 3, OFFICE.posterSage);

  // Yellow-and-black caution mat under the server nook
  for (let sx = 192; sx < 240; sx += 6) R(sx, 234, 3, 1, OFFICE.goldFrame);

  // Couch (mid-century terracotta) — left-front lounge
  const cX = 8, cY = 308;
  R(cX, cY, 40, 4, OFFICE.posterRed);
  R(cX, cY + 4, 40, 12, "#B5664A");
  R(cX, cY + 14, 44, 8, OFFICE.posterRed);
  R(cX - 2, cY + 6, 4, 16, "#B5664A");
  R(cX + 40, cY + 6, 4, 16, "#B5664A");
  R(cX + 14, cY + 4, 1, 12, OFFICE.beamMid);
  R(cX + 28, cY + 4, 1, 12, OFFICE.beamMid);
  R(cX + 2, cY + 22, 2, 5, OFFICE.beamDark);
  R(cX + 38, cY + 22, 2, 5, OFFICE.beamDark);
  R(cX + 4, cY + 8, 9, 7, OFFICE.posterSage);
  PX(cX + 7, cY + 11, colors.sage_hi);

  // Switch console on a side table (next to beanbag)
  R(cX + 74, cY + 18, 12, 2, OFFICE.beamDark);
  R(cX + 76, cY + 12, 8, 5, "#2A2A2A");
  R(cX + 77, cY + 13, 2, 3, OFFICE.switchRed);
  R(cX + 82, cY + 13, 2, 3, OFFICE.switchBlue);
  PX(cX + 80, cY + 14, (t >> 3) % 2 ? OFFICE.posterSage : OFFICE.frameGreen);

  // Floor plant pot rim
  R(158, FLOOR_Y + 62, 18, 10, OFFICE.floorPlank);

  return (
    <G>
      {els}
      {/* Wall decor — posters + clock + whiteboard layered as sprites */}
      <WallPoster x={14} y={66} color={OFFICE.posterRed} variant={0} />
      <WallPoster x={44} y={66} color={OFFICE.posterSage} variant={1} />
      <Clock x={176} y={66} t={t} />
      <Whiteboard x={196} y={64} />
      {/* 3 desks (Senior/Staff/Senior per design v4) */}
      {[0, 1, 2].map((i) => {
        const dx = 14 + i * 50;
        const podY = 250;
        return (
          <G key={`desk${i}`}>
            <PixelRect x={dx} y={podY} w={44} h={4} c={OFFICE.floorPlank} />
            <PixelRect x={dx} y={podY} w={44} h={1} c={OFFICE.floorHi} />
            <PixelRect x={dx + 3} y={podY + 4} w={2} h={26} c={"#7C5030"} />
            <PixelRect x={dx + 39} y={podY + 4} w={2} h={26} c={"#7C5030"} />
            <Monitor x={dx + 9} y={podY - 22} t={t + i * 7} />
            <EngineerOnChair x={dx + 12} y={podY + 12} t={t + i * 11} />
            <Keyboard x={dx + 4} y={podY - 2} t={t + i * 5} />
            <Succulent x={dx + 34} y={podY - 9} />
          </G>
        );
      })}
      {/* Server nook on the right (GPU): half-height rack + tower */}
      <BigRack x={214} y={240} t={t} />
      <GPU x={196} y={FLOOR_Y + 44} t={t} />
      {/* Couch lounge accessories + big floor plant */}
      <Beanbag2 x={58} y={316} />
      <Plant x={158} y={FLOOR_Y + 44} t={t} />
      <FloatingTokens spawnX={60} spawnY={228} t={t} />
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
      {/* Front bank of 3 desks — design v5 narrows them to make room for
          the server-room alcove on the right (no mug; sleeker corporate). */}
      {[0, 1, 2].map((i) => {
        const dx = 4 + i * 52;
        const deskY = 256;
        return (
          <G key={`desk${i}`}>
            <PixelRect x={dx} y={deskY} w={46} h={4} c={CORP.dark} />
            <PixelRect x={dx} y={deskY} w={46} h={1} c={CORP.mid} />
            <PixelRect x={dx + 4} y={deskY + 4} w={2} h={30} c={CORP.dark} />
            <PixelRect x={dx + 40} y={deskY + 4} w={2} h={30} c={CORP.dark} />
            <Monitor x={dx + 10} y={deskY - 22} t={t + i * 7} />
            <EngineerOnChair x={dx + 13} y={deskY + 12} t={t + i * 11} />
            <Keyboard x={dx + 6} y={deskY - 2} t={t + i * 5} />
          </G>
        );
      })}

      {/* ── Server room alcove on the right ── (design v5 redesign)
          Glass partition at x=180 separates the work zone from the
          server room. Inside: 2 BigRacks + 2 GPU towers on a cold-aisle
          dark-gray floor tint, "SERVER ROOM" sign over the door, and a
          gold caution stripe at the threshold. */}

      {/* Back wall partition for the server alcove */}
      <PixelRect x={189} y={152} w={51} h={70} c={CORP.dark} />
      <PixelRect x={189} y={152} w={51} h={1} c={CORP.mid} />
      {/* Cold-aisle floor tint inside the alcove */}
      <PixelRect x={189} y={FLOOR_Y} w={51} h={H - FLOOR_Y} c={"#4A4A4A"} />
      {/* Glass-partition divider frame */}
      <PixelRect x={180} y={150} w={3} h={72} c={CORP.darker} />
      <PixelRect x={180} y={150} w={3} h={1} c={CORP.mid} />
      {/* Glass pane (semi-transparent — direct Rect with opacity) */}
      <Rect x={183} y={152} width={6} height={70} fill={CORP.glass} opacity={0.25} />
      {/* Glass highlight streaks */}
      <PixelRect x={184} y={158} w={1} h={30} c={"#E0E4E8"} />
      <PixelRect x={186} y={170} w={1} h={20} c={"#E0E4E8"} />
      {/* Door handle + gold key dot */}
      <PixelRect x={181} y={188} w={2} h={8} c={CORP.mid} />
      <Px x={181} y={192} c={colors.gold} />
      {/* "SERVER ROOM" sign above the door */}
      <PixelRect x={178} y={144} w={24} h={5} c={CORP.darker} />
      <PixelRect x={178} y={144} w={24} h={1} c={CORP.mid} />
      <PixelRect x={181} y={146} w={18} h={1} c={colors.sage} />
      {/* 2 BigRacks standing in the alcove */}
      <BigRack x={194} y={230} t={t} />
      <BigRack x={214} y={230} t={t + 30} />
      {/* 2 GPU towers in front of the racks */}
      <GPU x={200} y={FLOOR_Y + 72} t={t} />
      <GPU x={220} y={FLOOR_Y + 72} t={t + 17} />
      {/* Caution stripe at alcove threshold */}
      {Array.from({ length: 9 }, (_, i) => (
        <PixelRect
          key={`c${i}`}
          x={189 + i * 6}
          y={218}
          w={3}
          h={2}
          c={colors.gold}
        />
      ))}

      {/* Corporate plant — sleek black pot (far left per design v5) */}
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

/**
 * Tutorial highlight: two nested gold rings + a slow pulse driven by the
 * scene's existing tick so we don't pay for a separate Animated.Value. Uses
 * a sine pulse (0.4 → 1.0 opacity) at roughly one cycle per second.
 */
function TutorialPulse({ zone, t }: { zone: HitZone; t: number }) {
  // tick fires every 200ms (5/s). Two cycles per second feels lively
  // without being epileptic — divide t by 1.2 so a full sine wave is ~2.4s.
  const phase = Math.sin(t / 1.2);
  const opacity = 0.4 + 0.6 * (phase * 0.5 + 0.5);
  return (
    <G opacity={opacity}>
      <Rect
        x={zone.x - 2}
        y={zone.y - 2}
        width={zone.w + 4}
        height={zone.h + 4}
        fill="none"
        stroke={colors.gold_hi}
        strokeWidth={2}
      />
      <Rect
        x={zone.x - 4}
        y={zone.y - 4}
        width={zone.w + 8}
        height={zone.h + 8}
        fill="none"
        stroke={colors.gold}
        strokeWidth={1}
      />
    </G>
  );
}
