import React from "react";
import { Pressable, View } from "react-native";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Polygon,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { colors, fonts } from "./theme";

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
  | "roomba"
  | "emptyseat"
  | "courtyard"
  | "bar"
  | "lake"
  | "agent_monitor"
  | "gpu2"
  | "catwalk";

export interface HitZone {
  id: HitId;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** Optional arc-shaped highlight (e.g. the planetary orbital ring). The
   *  Pressable click area still uses the x/y/w/h bounding rect — only the
   *  selection outline shape changes. */
  arc?: { cx: number; cy: number; r: number; band: number; a0: number; a1: number };
}

export type SceneId = "seed" | "coworking" | "office" | "megacorp" | "campus" | "datacenter" | "planetary" | "agi";

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
  // 3 narrower desks. Design v8: desk 3 is a vacated workstation (the first
  // AI-driven layoff at this tier) — empty chair + REPLACED BY AI monitor.
  { id: "engineer",      x:  16, y: 266, w: 22, h: 34, label: "Hire Staff Engineer" },
  { id: "engineer",      x:  68, y: 266, w: 22, h: 34, label: "Hire Principal Engineer" },
  { id: "emptyseat",     x: 120, y: 266, w: 22, h: 34, label: "Vacated workstation" },
  { id: "monitor",       x:  13, y: 234, w: 26, h: 22, label: "Training (West cluster)" },
  { id: "monitor",       x:  65, y: 234, w: 26, h: 22, label: "Training (Central cluster)" },
  { id: "agent_monitor", x: 117, y: 234, w: 26, h: 22, label: "Autonomous Agent" },
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

// CAMPUS (round 8 / Sovereign Wealth) — coords ported 1:1 from Claude
// Design v6 (screens.jsx::CAMPUS_HITS). Apple-Park-style tech campus:
// rooftop solar canopy = energy, R&D lab niche = research, 2 worker pods
// (one occupied, one vacated/"REPLACED BY AI"), open bar / courtyard /
// lakeside deck as cosmetics. `emptyseat` is a new id (vacated workstation
// motif used by both campus + megacorp v6 — fired but no popup-specific
// case yet, falls through to generic).
// All campus zones are pre-shifted +25y from the raw v6/v7 design coords to
// clear the floating TopHUD. CampusScene applies the same translate on render.
//
// Layout map (post-shift y bands, FLOOR_Y = 275):
//   y=  25..  49  → rooftop solar canopy (energy)
//   y= 155.. 263  → atrium upper band — left courtyard, mid R&D lab, right bar
//   y= 263.. 285  → pod monitors row (left atrium) — narrow strips, hi-priority
//   y= 275.. 327  → gallery sculptures (in front of bar) — data + gpu
//   y= 291.. 325  → pod chairs (engineer / emptyseat)
//   y= 328.. 360  → lakeside deck
//
// Order matters: later zones win on overlap. Small precise targets (pod
// monitors, chairs, gallery vitrines) come AFTER the big cosmetic bands so a
// tap that lands inside a pod monitor doesn't get swallowed by the bar zone.
const CAMPUS_ZONES: HitZone[] = [
  // ─── Top: rooftop solar canopy (Energy producer) ───
  { id: "energy",    x:   0, y:  25, w: 240, h:  25, label: "Buy Energy (rooftop solar)" },

  // ─── Big cosmetic atrium bands (drawn first so smaller targets sit on top) ─
  // Outdoor courtyard — trees + hammock above the worker pods
  { id: "courtyard", x:   0, y: 155, w:  90, h: 108, label: "Courtyard" },
  // Open bar — counter, back-bar, neon, pendants, stools
  { id: "bar",       x: 156, y: 158, w:  86, h: 112, label: "Open Bar" },

  // ─── R&D lab recess (Research) — includes the "R&D LAB" sign header ───
  { id: "research",  x:  88, y: 160, w:  68, h:  92, label: "Research (R&D Lab)" },

  // ─── Pod 1 (occupied) — monitor + Principal Engineer on chair ───
  { id: "monitor",   x:  18, y: 263, w: 28, h: 24, label: "Training (TPU cluster 1)" },
  { id: "engineer",  x:  20, y: 287, w: 26, h: 38, label: "Hire Principal Engineer" },

  // ─── Pod 2 (vacated) — Autonomous-Agent monitor + empty Aeron chair ───
  { id: "agent_monitor", x: 62, y: 263, w: 28, h: 24, label: "Autonomous Agent" },
  { id: "emptyseat", x:  64, y: 287, w: 26, h: 38, label: "Vacated workstation" },

  // ─── "Infrastructure as art" gallery (in front of the bar, on the floor) ──
  //   left  → THE ARCHIVE biophilic glass data monolith → Data producer (books)
  //   right → Datacenter Pod glass compute vitrine      → GPU  producer (gpu)
  { id: "books",     x: 170, y: 270, w:  32, h:  56, label: "Buy Data (The Archive)" },
  { id: "gpu",       x: 212, y: 283, w:  26, h:  44, label: "Buy GPU (Datacenter Pod)" },

  // ─── Lakeside balcony deck ───
  { id: "lake",      x: 126, y: 328, w: 114, h:  32, label: "Lakeside Deck" },
];

// DATACENTER (round 9 / Government Bailout) — port of design v8 DATACENTER_HITS.
// Top-wall zones (energy/research/books) are pre-shifted +25 in y to match
// the same translate the upper-wall sprites get inside DatacenterScene
// (clears the floating TopHUD). Floor zones (catwalk + mainframes) use raw
// v8 y values — the floor section is rendered unshifted so the front-row
// mainframes sit fully inside the SVG viewport.
const DATACENTER_ZONES: HitZone[] = [
  // Catwalk band first so back-row mainframes (later in the array) win on overlap
  { id: "catwalk",   x:   0, y: 168, w: 240, h:  24, label: "The Inspector" },
  // ─── Upper walls (shifted +25 to match scene's top-wall translate) ───
  { id: "energy",    x:   4, y:  33, w:  68, h:  66, label: "Buy Energy (Substation)" },
  { id: "research",  x:  72, y:  79, w:  52, h:  92, label: "Research (Autonomous R&D)" },
  { id: "books",     x: 120, y:  33, w: 114, h:  66, label: "Buy Data (Surveillance Tap)" },
  // ─── Back row of floor mainframes (raw v8 y) ───
  { id: "gpu",       x:  30, y: 144, w:  56, h: 100, label: "Buy GPU (Hyperscale Region)" },
  { id: "monitor",   x:  94, y: 144, w:  56, h: 100, label: "Training (National Cluster)" },
  { id: "engineer",  x: 158, y: 144, w:  56, h: 100, label: "Autonomous Ops" },
  // ─── Front row mainframes (continent-scale, raised 12px from raw v8) ──
  { id: "gpu2",      x:  24, y: 256, w: 184, h:  96, label: "Buy GPU (Continent-Scale)" },
];

// PLANETARY (round 10 / Civilizational Round). Zones are aligned to the
// ACTUAL pixel positions of the sprites PlanetaryScene draws (which derives
// from cx=W/2, cy=H-8, R=150, ringR=R+30=180) — the raw v8 zone coords were
// authored against a slightly different canvas origin and read off-mark.
//
// Sprite landmark cheatsheet:
//   Moon body+halo    →   y ≈ 22..78,   x ≈ 170..230
//   Empty training band → y ≈ 56..84,   x ≈ 60..160 (sits in space above globe)
//   Orbital ring apex →   y ≈ 168..220, x ≈ 0..240   (visible arc above globe)
//   NA cluster        →   y ≈ 262..306, x ≈   4..48  (with pulsing ring)
//   Asia cluster      →   y ≈ 252..302, x ≈ 158..208 (with pulsing ring)
//   India + south    →   y ≈ 310..360, x ≈  40..136
const PLANETARY_ZONES: HitZone[] = [
  // Lunar refinery (upper-right) — Energy. Wraps the moon body + glow halo.
  { id: "energy",    x: 170, y:  22, w:  60, h:  56, label: "Buy Energy (Lunar Refinery)" },
  // Planet-scale training band — empty click region in space above the globe.
  // Narrowed in x to avoid stealing taps from the Moon zone (which sits to the right).
  { id: "monitor",   x:  60, y:  56, w: 100, h:  28, label: "Planet-Scale Training" },
  // Orbital storage ring girdling Earth — Data. Selection outline traces the
  // visible arc band itself instead of a rectangle.
  { id: "books",     x:   0, y: 168, w: 240, h:  52, label: "Buy Data (Orbital Ring)",
    arc: { cx: 120, cy: 352, r: 180, band: 16, a0: Math.PI * 1.06, a1: Math.PI * 1.94 } },
  // City-light megagrids on the night side of Earth
  { id: "engineer",  x:   4, y: 262, w:  44, h:  44, label: "Autonomous Regions (NA)" },
  { id: "gpu",       x: 158, y: 252, w:  50, h:  50, label: "Buy GPU (Asia-Pacific)" },
  // "Americas / lower hemisphere" compute belt — covers SA + IN cluster band.
  { id: "gpu2",      x:  40, y: 310, w:  96, h:  50, label: "Buy GPU (Americas Belt)" },
];

export const HIT_ZONES_BY_SCENE: Record<SceneId, HitZone[]> = {
  seed: SEED_ZONES,
  coworking: COWORKING_ZONES,
  office: OFFICE_ZONES,
  megacorp: MEGACORP_ZONES,
  campus: CAMPUS_ZONES,
  datacenter: DATACENTER_ZONES,
  planetary: PLANETARY_ZONES,
  agi: AGI_ZONES,
};

/**
 * Funding-round → scene mapping. All 8 scenes wired.
 *   seed       → rounds 0-1 (Seed, Series A)         — garage, solo founder
 *   coworking  → rounds 2-3 (Series B, Series C)     — WeWork bench
 *   office     → rounds 4-5 (Series D, IPO)          — brick + Edison bulbs
 *   megacorp   → rounds 6-7 (Secondary, Acquisition) — corporate slate-blue
 *   campus     → round 8   (Sovereign Wealth)        — Apple-Park-ish campus
 *   datacenter → round 9   (Government Bailout)      — dark server hall
 *   planetary  → round 10  (Civilizational)          — Earth from low orbit
 *   agi        → round 11  (Singularity)             — galactic endgame
 */
export function sceneForRound(roundIdx: number): SceneId {
  if (roundIdx <= 1) return "seed";
  if (roundIdx <= 3) return "coworking";
  if (roundIdx <= 5) return "office";
  if (roundIdx <= 7) return "megacorp";
  if (roundIdx <= 8) return "campus";
  if (roundIdx <= 9) return "datacenter";
  if (roundIdx <= 10) return "planetary";
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
        ) : scene === "campus" ? (
          <CampusScene t={t} />
        ) : scene === "datacenter" ? (
          <DatacenterScene t={t} />
        ) : scene === "planetary" ? (
          <PlanetaryScene t={t} />
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

// Indoor leafy tree (planter + layered sage canopy). Used by CampusScene
// in the outdoor courtyard. Idles with a slow 1-pixel sway.
function IndoorTree({ x, y, t }: { x: number; y: number; t: number }) {
  const sway = ((t >> 5) % 8 < 4) ? 0 : 1;
  const hi = colors.sage_hi;
  return (
    <G>
      {/* Planter */}
      <PixelRect x={x - 2} y={y + 40} w={20} h={12} c={"#8B5E3C"} />
      <PixelRect x={x - 2} y={y + 40} w={20} h={1} c={"#C89868"} />
      <PixelRect x={x - 1} y={y + 50} w={18} h={1} c={"#5C3A22"} />
      {/* Trunk */}
      <PixelRect x={x + 6} y={y + 22} w={4} h={18} c={"#6E4A2E"} />
      <PixelRect x={x + 6} y={y + 22} w={1} h={18} c={"#8B5E3C"} />
      {/* Canopy (layered sage) */}
      <PixelRect x={x + sway} y={y} w={16} h={10} c={colors.sage_2} />
      <PixelRect x={x - 2 + sway} y={y + 6} w={20} h={10} c={colors.sage} />
      <PixelRect x={x + 2 + sway} y={y + 14} w={12} h={8} c={colors.sage_2} />
      {/* Highlights */}
      <Px x={x + 4 + sway}  y={y + 2}  c={hi} />
      <Px x={x + 10 + sway} y={y + 5}  c={hi} />
      <Px x={x + 2 + sway}  y={y + 9}  c={hi} />
      <Px x={x + 13 + sway} y={y + 11} c={hi} />
      <Px x={x + 6 + sway}  y={y + 16} c={hi} />
    </G>
  );
}

// Empty Aeron-style chair seen from behind — the "vacated workstation"
// motif. Slow idle drift so the chair feels abandoned-but-recent.
function EmptyChair({ x, y, t }: { x: number; y: number; t: number }) {
  const sway = ((t >> 5) % 16 < 8) ? 0 : 1;
  const ox = x + sway;
  return (
    <G>
      {/* Headrest pillow */}
      <PixelRect x={ox + 4} y={y + 4} w={12} h={4} c={P.ink} />
      <PixelRect x={ox + 4} y={y + 4} w={12} h={1} c={P.ink_hi} />
      <Px x={ox + 4}  y={y + 7} c={P.ink_2} />
      <Px x={ox + 15} y={y + 7} c={P.ink_2} />
      {/* Backrest (full mesh — no torso) */}
      <PixelRect x={ox} y={y + 6} w={20} h={16} c={P.ink} />
      <PixelRect x={ox} y={y + 6} w={20} h={1}  c={P.ink_hi} />
      <PixelRect x={ox} y={y + 21} w={20} h={1} c={P.ink_2} />
      {/* Mesh sheen */}
      {[0, 1, 2, 3, 4].map((i) =>
        [0, 1, 2, 3].map((j) => (
          <Px key={`m${i}-${j}`} x={ox + 3 + i * 3} y={y + 9 + j * 3} c={P.muted_2} />
        ))
      )}
      <Px x={ox} y={y + 6} c={P.ink_2} />
      <Px x={ox + 19} y={y + 6} c={P.ink_2} />
      {/* Armrests */}
      <PixelRect x={ox}      y={y + 16} w={2} h={5} c={P.ink} />
      <PixelRect x={ox}      y={y + 16} w={1} h={5} c={P.ink_hi} />
      <PixelRect x={ox + 18} y={y + 16} w={2} h={5} c={P.ink} />
      <PixelRect x={ox + 19} y={y + 16} w={1} h={5} c={P.ink_hi} />
      {/* Empty seat */}
      <PixelRect x={ox + 1} y={y + 23} w={18} h={4} c={P.ink} />
      <PixelRect x={ox + 1} y={y + 23} w={18} h={1} c={P.ink_hi} />
      <Px x={ox + 9} y={y + 24} c={P.muted_2} />
      {/* Post + 5-spoke base */}
      <PixelRect x={ox + 9} y={y + 27} w={2} h={3} c={P.ink} />
      <PixelRect x={ox + 1} y={y + 30} w={18} h={2} c={P.ink} />
      <PixelRect x={ox + 1} y={y + 30} w={18} h={1} c={P.ink_hi} />
      {[0, 1, 2, 3, 4].map((i) => (
        <PixelRect key={`c${i}`} x={ox + 1 + i * 4} y={y + 32} w={2} h={1} c={P.ink} />
      ))}
      <PixelRect x={ox - 1} y={y + 33} w={22} h={1} c={P.terracotta_3} />
    </G>
  );
}

// "REPLACED BY AI" monitor — the deadpan corporate notice screen with a
// robot head + crisp block "AI" letters. Replaces a regular Monitor on
// chairs that used to hold a Distinguished Engineer.
function ReplacedMonitor({ x, y, t }: { x: number; y: number; t: number }) {
  const eyeOn = (t >> 3) % 6 < 4;
  const hx = x + 4, hy = y + 5;
  // 5x3 glyphs (1=on)
  const A = ["010", "101", "111", "101", "101"];
  const I = ["111", "010", "010", "010", "111"];
  const drawGlyph = (g: string[], gx: number, gy: number, col: string) => {
    const out: React.ReactNode[] = [];
    for (let ry = 0; ry < g.length; ry++) {
      for (let cx = 0; cx < 3; cx++) {
        if (g[ry][cx] === "1") {
          out.push(<Px key={`g${gx}-${ry}-${cx}`} x={gx + cx} y={gy + ry} c={col} />);
        }
      }
    }
    return out;
  };
  return (
    <G>
      {/* Stand */}
      <PixelRect x={x + 8}  y={y + 22} w={6} h={2} c={P.ink} />
      <PixelRect x={x + 11} y={y + 20} w={4} h={2} c={P.ink} />
      <PixelRect x={x + 12} y={y + 19} w={2} h={1} c={P.ink} />
      {/* Bezel */}
      <PixelRect x={x} y={y} w={26} h={20} c={P.ink} />
      <PixelRect x={x} y={y} w={26} h={1} c={P.ink_hi} />
      <PixelRect x={x + 25} y={y} w={1} h={20} c={P.ink_2} />
      {/* Corporate notice screen */}
      <PixelRect x={x + 2} y={y + 2} w={22} h={16} c={"#16202C"} />
      <PixelRect x={x + 2} y={y + 2} w={22} h={1}  c={"#243A4E"} />
      <Rect x={x + 2} y={y + 2} width={22} height={16} fill={"#D4A24C"} opacity={0.12} />
      {/* Robot head (left) */}
      <Px x={hx + 4} y={hy - 2} c={colors.sage} />
      <PixelRect x={hx + 4} y={hy - 1} w={1} h={1} c={"#A4F0FF"} />
      <PixelRect x={hx} y={hy}     w={9} h={8} c={"#3FC4E0"} />
      <PixelRect x={hx} y={hy}     w={9} h={1} c={"#A4F0FF"} />
      <PixelRect x={hx} y={hy + 7} w={9} h={1} c={"#1C6E80"} />
      <PixelRect x={hx + 1} y={hy + 2} w={7} h={3} c={"#0E1A22"} />
      <Px x={hx + 2} y={hy + 3} c={eyeOn ? "#E85A7E" : "#7E2A3A"} />
      <Px x={hx + 6} y={hy + 3} c={eyeOn ? "#E85A7E" : "#7E2A3A"} />
      <PixelRect x={hx + 2} y={hy + 6} w={5} h={1} c={"#1C6E80"} />
      {/* "AI" glyphs (right) */}
      {drawGlyph(A, x + 15, y + 5, "#E8C97E")}
      {drawGlyph(I, x + 19, y + 5, "#E8C97E")}
      {/* tiny "person → gone" mark */}
      <PixelRect x={x + 15} y={y + 13} w={2} h={2} c={colors.sage_2} />
      <Px x={x + 14} y={y + 12} c={"#E85A7E"} />
      <Px x={x + 17} y={y + 15} c={"#E85A7E"} />
    </G>
  );
}

// Small engineer head + shoulders (used for the R&D-lab researcher).
function EngHead({
  x, y, t, shirtCol,
}: { x: number; y: number; t: number; shirtCol: string }) {
  const bob = ((t >> 4) % 24 < 1) ? -1 : 0;
  const hy = y + bob;
  return (
    <G>
      <PixelRect x={x + 1} y={hy}     w={8} h={4} c={P.terracotta_3} />
      <PixelRect x={x}     y={hy + 1} w={10} h={3} c={P.terracotta_3} />
      <Px x={x + 2} y={hy + 1} c={P.terracotta_2} />
      <Px x={x + 6} y={hy + 1} c={P.terracotta_2} />
      <PixelRect x={x + 3} y={hy + 4} w={4} h={1} c={P.cream_3} />
      <PixelRect x={x - 1} y={y + 5}  w={12} h={6} c={shirtCol} />
      <PixelRect x={x - 1} y={y + 5}  w={12} h={1} c={P.sage_2} />
    </G>
  );
}

// ─── "Infrastructure as art" gallery pieces (campus DATA + GPU) ─────────────
// Two glass museum vitrines standing on a shared oak plinth in the atrium.
// Per design v7 — campus surfaces Data + GPU producers as curated sculptures.

// THE ARCHIVE — biophilic glass data monolith. Anchored top-left at (x,y);
// glass column body extends y+4..y+40, succulent rosette crowns at y..y+4,
// oak plinth at y+40..y+50.
function DataMonolith({ x, y, t }: { x: number; y: number; t: number }) {
  const els: React.ReactNode[] = [];
  let k = 0;
  const key = () => `dm${k++}`;
  const R = (xx: number, yy: number, w: number, h: number, c: string) =>
    els.push(<PixelRect key={key()} x={xx} y={yy} w={w} h={h} c={c} />);
  const PXp = (xx: number, yy: number, c: string) =>
    els.push(<Px key={key()} x={xx} y={yy} c={c} />);
  const A = (xx: number, yy: number, w: number, h: number, c: string, op: number) =>
    els.push(<Rect key={key()} x={xx} y={yy} width={w} height={h} fill={c} opacity={op} />);

  // Oak plinth + brass museum plaque
  R(x, y + 40, 22, 10, "#8B5E3C");
  R(x, y + 40, 22, 1, "#C89868");
  R(x, y + 49, 22, 1, "#5C3A22");
  R(x + 1, y + 41, 20, 1, "#A87848");
  R(x + 6, y + 44, 10, 3, "#C9A24C");
  R(x + 7, y + 45, 8, 1, "#EBC97E");

  // Glass column shell
  const gx = x + 4, gy = y + 4, gw = 14, gh = 36;
  A(gx - 2, gy - 1, gw + 4, gh + 2, "#3FC4E0", 0.10); // outer glow
  R(gx, gy, gw, gh, "#16323A");
  A(gx, gy, gw, gh, "#9AD4E0", 0.22);
  // Steel frame edges
  R(gx, gy, gw, 1, "#C8D0D4");
  R(gx, gy, 1, gh, "#8C969C");
  R(gx + gw - 1, gy, 1, gh, "#5C666C");
  R(gx, gy + gh - 1, gw, 1, "#5C666C");

  // Internal data strata — glowing rows drifting upward + read-head packet
  for (let i = 0; i < 11; i++) {
    const drift = (t >> 1) % 6;
    const sy = gy + gh - 3 - i * 3 + (drift % 3);
    if (sy < gy + 2 || sy > gy + gh - 2) continue;
    const lit = (t + i * 5) % 14 < 9;
    const col = i % 4 === 0
      ? (lit ? "#EBBE6E" : "#6B5A2E")
      : (lit ? "#3FE0E0" : "#1C5A60");
    R(gx + 2, sy, gw - 4, 1, col);
    if (i === ((t >> 3) % 11)) PXp(gx + 2 + ((t >> 1) % (gw - 4)), sy, "#FFFFFF");
  }
  // Vertical glass reflection
  A(gx + 3, gy + 2, 1, gh - 4, "#CFF2FA", 0.4);

  // Living succulent crowning the column
  const px0 = x + 7;
  R(px0, y, 8, 4, "#3A2A1E"); // soil tray
  R(px0, y, 8, 1, "#5C3A22");
  const leaves: Array<[number, number, string]> = [
    [-1, -2, "#6E8A72"], [3, -3, "#7E9A85"], [7, -2, "#5C7560"],
    [1, -4, "#9AB89A"], [5, -4, "#7E9A85"],
  ];
  for (const lf of leaves) R(px0 + lf[0], y - 2 + lf[1] + 2, 2, 3, lf[2]);
  PXp(px0 + 3, y - 4, "#A4BDA9");

  // Floor reflection of the glow
  A(x + 2, y + 50, 18, 2, "#3FC4E0", 0.12);

  return <G>{els}</G>;
}

// Matching glass compute display case — small museum vitrine on a plinth
// holding a glowing GPU board. ~18w × 38h, anchored top-left.
function ComputeCase({ x, y, t }: { x: number; y: number; t: number }) {
  const els: React.ReactNode[] = [];
  let k = 0;
  const key = () => `cc${k++}`;
  const R = (xx: number, yy: number, w: number, h: number, c: string) =>
    els.push(<PixelRect key={key()} x={xx} y={yy} w={w} h={h} c={c} />);
  const PXp = (xx: number, yy: number, c: string) =>
    els.push(<Px key={key()} x={xx} y={yy} c={c} />);
  const A = (xx: number, yy: number, w: number, h: number, c: string, op: number) =>
    els.push(<Rect key={key()} x={xx} y={yy} width={w} height={h} fill={c} opacity={op} />);

  // Oak plinth + brass plaque
  R(x, y + 28, 18, 10, "#8B5E3C");
  R(x, y + 28, 18, 1, "#C89868");
  R(x, y + 37, 18, 1, "#5C3A22");
  R(x + 5, y + 31, 8, 2, "#C9A24C");

  // Glass vitrine
  const gx = x + 3, gy = y + 2, gw = 12, gh = 26;
  A(gx - 2, gy - 1, gw + 4, gh + 2, "#C97B5B", 0.10);
  R(gx, gy, gw, gh, "#1A1410");
  A(gx, gy, gw, gh, "#E8D8C8", 0.18);
  R(gx, gy, gw, 1, "#D8DCE0");
  R(gx, gy, 1, gh, "#9C969C");
  R(gx + gw - 1, gy, 1, gh, "#5C5660");

  // GPU board mounted upright inside
  R(gx + 2, gy + 4, gw - 4, gh - 10, "#2A2A2A");
  R(gx + 2, gy + 4, gw - 4, 1, "#454545");
  for (let f = 0; f < 4; f++) R(gx + 3 + f * 2, gy + 6, 1, gh - 14, "#3E3E3E");

  // Spinning fan (LED ring)
  const fcx = gx + Math.floor(gw / 2), fcy = gy + gh - 6;
  const fa = (t >> 1) % 4;
  R(fcx - 2, fcy - 2, 5, 5, "#1A1A1A");
  const fanDx = [0, 1, 0, -1][fa];
  const fanDy = [-1, 0, 1, 0][fa];
  PXp(fcx + fanDx, fcy + fanDy, "#C97B5B");
  PXp(fcx, fcy, "#5C5C5C");

  // PCB power LEDs
  PXp(gx + 3, gy + 5, (t >> 2) % 2 ? "#7EE0A0" : "#1C4A2A");
  PXp(gx + gw - 4, gy + 5, (t >> 2) % 3 ? "#EBBE6E" : "#5C4A1A");

  // Glass reflection
  A(gx + 2, gy + 2, 1, gh - 4, "#FBEFE2", 0.4);

  return <G>{els}</G>;
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
      {/* Front bank of 3 desks. Design v8: 3rd desk became a vacated
          workstation (REPLACED BY AI monitor + EmptyChair) — same motif as
          the campus pod 2. The first AI-driven layoff happens at megacorp
          and only deepens from there. */}
      {[0, 1, 2].map((i) => {
        const dx = 4 + i * 52;
        const deskY = 256;
        const vacated = i === 2;
        return (
          <G key={`desk${i}`}>
            <PixelRect x={dx} y={deskY} w={46} h={4} c={CORP.dark} />
            <PixelRect x={dx} y={deskY} w={46} h={1} c={CORP.mid} />
            <PixelRect x={dx + 4} y={deskY + 4} w={2} h={30} c={CORP.dark} />
            <PixelRect x={dx + 40} y={deskY + 4} w={2} h={30} c={CORP.dark} />
            {vacated ? (
              <ReplacedMonitor x={dx + 10} y={deskY - 22} t={t} />
            ) : (
              <Monitor x={dx + 10} y={deskY - 22} t={t + i * 7} />
            )}
            {vacated ? (
              <EmptyChair x={dx + 13} y={deskY + 12} t={t} />
            ) : (
              <EngineerOnChair x={dx + 13} y={deskY + 12} t={t + i * 11} />
            )}
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
// CAMPUS SCENE — Round 8 (Sovereign Wealth) — Apple-Park-style tech campus.
// Port of pixel-art.jsx::composeCampusScene (design v6). Higher FLOOR_Y=250
// to make room for the lake/deck terrace at the bottom of the frame.
// Key beats: rooftop solar canopy (Energy), open bar with neon, outdoor
// courtyard + hammock seen through glass, R&D lab in a recessed niche,
// 2 knowledge-worker pods (one already "REPLACED BY AI"), and a lakeside
// deck with ducks gliding past.
// ═══════════════════════════════════════════════════════════════════════
const CAMP = {
  skyHi:      "#F0F4EA",
  skyMid:     "#E8EEE2",
  skyLow:     "#D8E0D6",
  sunHalo:    "#FBF7EC",
  sunCore:    "#EBBE6E",
  hillFar:    "#A4BDA9",
  hillNear:   "#7E9A85",
  pvDark:     "#1F2C48",
  pvMid:      "#2A3A5A",
  pvHi:       "#4A6FA5",
  pvCell:     "#33507E",
  pvSeam:     "#1F2C48",
  pvGlint:    "#A4C8FF",
  truss:      "#6E4A2E",
  trussPost:  "#5C5C5C",
  invBody:    "#3A3A3A",
  invEdge:    "#5C5C5C",
  invLed:     "#7E9A85",
  invLedOff:  "#3F5142",
  conduit:    "#3A3A3A",
  glass:      "#A4BDA9",
  mullion:    "#C8B89A",
  wallCream:  "#E8E0D0",
  wallHi:     "#F0EAD8",
  floorWood:  "#B58858",
  floorPlank: "#9A6E40",
  floorHi:    "#C89868",
  floorEdge:  "#8B5E3C",
  barTop:     "#6E4A2E",
  barTopHi:   "#9A6E40",
  barTopGlow: "#C89868",
  barFront:   "#5C3A22",
  barSlat:    "#46301C",
  brass:      "#C9A24C",
  cabDark:    "#2A211A",
  cabEdge:    "#46301C",
  backlit:    "#C97B3A",
  shelfTrim:  "#8B6A3A",
  neonOff:    "#3A2A2A",
  neonBg:     "#1A1414",
  neonPink:   "#E85A7E",
  neonCyan:   "#3FC4E0",
  neonPinkLi: "#F09AB0",
  neonCyanLi: "#7EE0F0",
  lampCord:   "#3A3A3A",
  lampShade:  "#2A2A2A",
  lampOn:     "#EBBE6E",
  lampOff:    "#8B5E3C",
  oakSurr:    "#8B5E3C",
  oakSurrHi:  "#C89868",
  oakSurrSh1: "#A87848",
  oakSurrSh2: "#5C3A22",
  labWall:    "#D6CEBE",
  labShadow:  "#B8B0A0",
  labLeftSh:  "#C4BCAC",
  labLitEdge: "#E8E0D0",
  labSign:    "#3F5142",
  labSignHi:  "#5C7560",
  labSignTxt: "#EBBE6E",
  benchWhite: "#E8E0D0",
  benchHi:    "#FBF7EC",
  benchBase:  "#C8B89A",
  monBezel:   "#1A1A1A",
  monScreen:  "#2A3A2E",
  lossCurve:  "#7E9A85",
  rackDark:   "#2A2A2A",
  rackMid:    "#3A3A3A",
  beakerSage: "#7E9A85",
  beakerTerr: "#C97B5B",
  beakerGold: "#D4A24C",
  armBase:    "#5C5C5C",
  armArm:     "#9CA0A4",
  armTip:     "#D45A68",
  lakeMid:    "#6E8E9C",
  lakeShallow:"#8FB0B8",
  lakeDeep:   "#567682",
  lakeRipple: "#B8D0D4",
  lakeReed:   "#5C7560",
  cattail:    "#8B5E3C",
  duck:       "#3A3A3A",
  duckBill:   "#EBBE6E",
  hammock:    "#C97B5B",
  hammockSag: "#D4906B",
  hammockEnd: "#8B5639",
  personSil:  "#3F5142",
  skin:       "#C8B89A",
  deckPlank:  "#9A6E40",
  deckSeam:   "#7C5030",
  deckLipSh:  "#5C3A22",
  deckLipSh2: "#3A2A1A",
  deckFacia:  "#5C3A22",
  railPost:   "#6E4A2E",
  adirRed:    "#C97B5B",
  adirShade:  "#B5664A",
  adirEdge:   "#8B5639",
  adirShirt:  "#7E9A85",
  laptop:     "#2A2A2A",
  laptopGlow: "#A4C8FF",
  bistro:     "#9CA0A4",
  bistroPost: "#5C5C5C",
  bistroChair:"#3F5142",
  coffee:     "#C97B5B",
};

function CampusScene({ t }: { t: number }) {
  const FLOOR_Y = 250;
  const els: React.ReactNode[] = [];
  let k = 0;
  const key = () => `cp${k++}`;
  const R = (x: number, y: number, w: number, h: number, c: string) =>
    els.push(<PixelRect key={key()} x={x} y={y} w={w} h={h} c={c} />);
  const PX = (x: number, y: number, c: string) =>
    els.push(<Px key={key()} x={x} y={y} c={c} />);
  const A = (x: number, y: number, w: number, h: number, c: string, op: number) =>
    els.push(<Rect key={key()} x={x} y={y} width={w} height={h} fill={c} opacity={op} />);

  // ─── Sky / outside (through floor-to-ceiling glass) ───
  R(0, 0, W, 70, CAMP.skyLow);
  R(0, 0, W, 24, CAMP.skyMid);
  R(0, 0, W, 12, CAMP.skyHi);
  // Sun glow upper-right
  A(W - 56, 4, 40, 30, CAMP.sunHalo, 0.5);
  A(W - 44, 8, 24, 18, CAMP.sunCore, 0.3);
  R(W - 34, 12, 8, 8, CAMP.sunHalo);
  // Distant rolling hills
  for (let i = 0; i < W; i++) {
    const h1 = (Math.sin(i / 40) * 4 + 6) | 0;
    R(i, 56 - h1, 1, h1 + 16, CAMP.hillFar);
  }
  for (let i = 0; i < W; i++) {
    const h2 = (Math.sin(i / 30 + 2) * 3 + 4) | 0;
    R(i, 60 - h2, 1, h2 + 12, CAMP.hillNear);
  }

  // ─── Rooftop solar canopy (Energy producer) ───
  R(0, 22, W, 3, CAMP.truss);
  for (let i = 8; i < W; i += 28) R(i, 18, 2, 8, CAMP.trussPost);
  // Tilted PV panels (one segment per 30px)
  for (let sp = 0; sp < W; sp += 30) {
    R(sp + 2, 0, 28, 4, CAMP.pvDark);
    R(sp, 4, 30, 14, CAMP.pvMid);
    R(sp, 4, 30, 1, CAMP.pvHi);
    // 4×3 PV cells per panel
    for (let cx = 0; cx < 4; cx++)
      for (let cy = 0; cy < 3; cy++) {
        R(sp + 2 + cx * 7, 5 + cy * 4, 5, 3, CAMP.pvCell);
        PX(sp + 4 + cx * 7, 6 + cy * 4, "#3A5A8A");
      }
    for (let cx = 1; cx < 4; cx++) R(sp + 1 + cx * 7, 4, 1, 14, CAMP.pvSeam);
    R(sp, 9, 30, 1, CAMP.pvSeam);
    R(sp, 13, 30, 1, CAMP.pvSeam);
    // Animated sun glint sweeping panel by panel
    const segIdx = (sp / 30) | 0;
    const segCount = (W / 30) | 0;
    if ((t >> 1) % segCount === segIdx) R(sp + 1, 5, 28, 1, CAMP.pvGlint);
  }
  R(0, 18, W, 2, "#0F1A30"); // drip edge
  // Power inverter + conduit
  R(222, 26, 10, 7, CAMP.invBody);
  R(222, 26, 10, 1, CAMP.invEdge);
  PX(225, 29, (t >> 2) % 4 < 2 ? CAMP.invLed : CAMP.invLedOff);
  R(226, 33, 1, 38, CAMP.conduit);
  for (let cy = 35; cy < 70; cy += 6) {
    PX(226, cy, (cy + (t >> 2)) % 12 < 6 ? colors.gold_hi : "#6E4A2E");
  }

  // ─── Floor-to-ceiling glass curtain wall ───
  A(0, 4, W, 66, CAMP.glass, 0.18);
  for (let mx = 0; mx <= W; mx += 30) R(mx, 4, 1, 66, CAMP.mullion);
  R(0, 36, W, 1, CAMP.mullion);
  for (let s = 0; s < 5; s++) A(14 + s * 50, 6, 2, 62, CAMP.sunHalo, 0.25);

  // ─── Cream concrete upper wall band ───
  R(0, 70, W, FLOOR_Y - 70, CAMP.wallCream);
  for (let y = 74; y < FLOOR_Y; y += 10) R(0, y, W, 1, CAMP.wallHi);

  // ─── Warm oak floor ───
  R(0, FLOOR_Y, W, H - FLOOR_Y, CAMP.floorWood);
  for (let i = 0; i < W; i += 24)
    R(i + ((i / 24) % 3) * 6, FLOOR_Y, 1, H - FLOOR_Y, CAMP.floorPlank);
  R(0, FLOOR_Y, W, 1, CAMP.floorHi);
  R(0, FLOOR_Y + 1, W, 1, CAMP.floorWood);
  R(0, H - 3, W, 1, CAMP.floorEdge);

  // ─── Open bar (right side) ───
  const cbX = 158, cbW = 80;
  // Counter top
  R(cbX, 196, cbW, 6, CAMP.barTop);
  R(cbX, 196, cbW, 1, CAMP.barTopHi);
  R(cbX, 197, cbW, 1, CAMP.barTopGlow);
  // Bar front + slats
  R(cbX, 202, cbW, FLOOR_Y - 202, CAMP.barFront);
  for (let bx = cbX + 3; bx < cbX + cbW - 2; bx += 7)
    R(bx, 204, 1, FLOOR_Y - 206, CAMP.barSlat);
  // Brass footrail
  R(cbX, FLOOR_Y - 6, cbW, 1, CAMP.brass);
  // Back-bar cabinet
  const bbY = 150;
  R(cbX + 2, bbY, cbW - 4, 46, CAMP.cabDark);
  R(cbX + 2, bbY, cbW - 4, 1, CAMP.cabEdge);
  A(cbX + 4, bbY + 2, cbW - 8, 42, CAMP.backlit, 0.5);
  // 3 shelves of bottles
  const bottleCols = [
    "#7E2A2A", "#3F6E3A", "#C9A24C", "#2A4E6E",
    "#9A3A6A", "#C97B3A", "#5A3A7E", "#3A6E6E",
  ];
  for (let s = 0; s < 3; s++) {
    const sy = bbY + 8 + s * 13;
    R(cbX + 4, sy, cbW - 8, 1, CAMP.shelfTrim);
    for (let b = 0; b < 9; b++) {
      const bx = cbX + 7 + b * 8;
      const tall = (b + s) % 3 === 0;
      const h = tall ? 10 : 7;
      const col = bottleCols[(b + s * 3) % bottleCols.length];
      R(bx, sy - h, 4, h, col);
      R(bx + 1, sy - h - 3, 2, 3, col);
      PX(bx + 1, sy - h - 3, "#1A1A1A");
      PX(bx + 1, sy - (h >> 1), CAMP.wallCream);
      PX(bx + 2, sy - (h >> 1), CAMP.wallCream);
    }
  }
  // Hanging stemware rack
  R(cbX + 6, bbY + 47, cbW - 12, 2, CAMP.cabEdge);
  for (let g = 0; g < 8; g++) {
    const gx = cbX + 10 + g * 8;
    R(gx, bbY + 49, 1, 4, "#B8C4C0");
    R(gx - 2, bbY + 53, 5, 3, "#C8D4D0");
    PX(gx, bbY + 49, "#E8F0EC");
  }
  // Beer-tap tower (3 handles)
  const tapX = cbX + 6;
  R(tapX, 186, 4, 10, "#9CA0A4");
  R(tapX, 186, 4, 1, "#C8CCD0");
  const tapHues = ["#C97B3A", "#3F6E3A", "#7E2A2A"];
  for (let h = 0; h < 3; h++) {
    R(tapX + 4, 188 + h * 3, 3, 1, "#9CA0A4");
    PX(tapX + 7, 188 + h * 3, tapHues[h]);
  }
  // Cocktail station
  R(cbX + 26, 189, 4, 7, "#B8BCC0");
  R(cbX + 26, 189, 4, 1, "#D8DCE0");
  R(cbX + 26, 191, 4, 1, "#90949A");
  R(cbX + 34, 192, 1, 4, "#C8D4D0");
  R(cbX + 32, 190, 5, 2, "#C9A24C");
  PX(cbX + 34, 189, colors.sage);
  R(cbX + 40, 192, 4, 4, "#B8C4C0");
  R(cbX + 40, 193, 4, 3, "#C97B3A");
  PX(cbX + 41, 195, "#E8B86A");
  // Bar stools
  for (let st = 0; st < 2; st++) {
    const sx = cbX + 24 + st * 26;
    R(sx, FLOOR_Y - 18, 8, 2, "#3A2A1E");
    R(sx + 1, FLOOR_Y - 18, 6, 1, CAMP.barFront);
    R(sx + 3, FLOOR_Y - 16, 2, 14, "#7C6A4A");
    R(sx + 1, FLOOR_Y - 3, 6, 1, CAMP.barFront);
  }
  // Neon "OPEN BAR" sign
  R(cbX + 16, bbY - 12, 48, 10, CAMP.neonBg);
  R(cbX + 16, bbY - 12, 48, 1, CAMP.neonOff);
  const neonOn = (t >> 3) % 16 < 15;
  const neonOpacity = neonOn ? 1 : 0.4;
  els.push(
    <Rect key={key()} x={cbX + 20} y={bbY - 8} width={18} height={2} fill={CAMP.neonPink} opacity={neonOpacity} />
  );
  els.push(
    <Rect key={key()} x={cbX + 42} y={bbY - 8} width={18} height={2} fill={CAMP.neonCyan} opacity={neonOpacity} />
  );
  els.push(<Px key={key()} x={cbX + 19} y={bbY - 9} c={CAMP.neonPinkLi} />);
  els.push(<Px key={key()} x={cbX + 61} y={bbY - 6} c={CAMP.neonCyanLi} />);
  A(cbX + 18, bbY - 10, 44, 6, CAMP.neonPink, 0.18);
  // Hanging pendant lights
  for (let i = 0; i < 4; i++) {
    const lx = cbX + 12 + i * 18;
    R(lx, 142, 1, 6, CAMP.lampCord);
    R(lx - 2, 148, 5, 3, CAMP.lampShade);
    PX(lx, 150, (t + i * 3) % 8 < 6 ? CAMP.lampOn : CAMP.lampOff);
  }

  // ─── "Infrastructure as art" gallery (in front of the bar, on the floor) ───
  // Long low oak gallery plinth + soft uplighting + brass wall label. The two
  // sculpture pieces themselves (DataMonolith + ComputeCase) are rendered as
  // sprites in the JSX return below.
  {
    const bayX = 172, bayBot = FLOOR_Y + 52;
    R(bayX - 4, bayBot - 4, 72, 4, "#7C5030");
    R(bayX - 4, bayBot - 4, 72, 1, "#9A6E40");
    for (let g = 4; g > 0; g--) {
      A(bayX - 2 + g, 248, 64 - g * 2, 54, "#9AD4E0", 0.08);
    }
    R(bayX + 4, 244, 36, 5, "#3F5142");
    R(bayX + 6, 245, 32, 1, "#7E9A85");
    PX(bayX + 8, 246, "#EBBE6E");
  }

  // ─── Outdoor courtyard (left, through glass) ───
  A(0, 130, 90, FLOOR_Y - 130, CAMP.glass, 0.2);
  R(0, 130, 90, 1, CAMP.mullion);
  for (let mx = 0; mx < 90; mx += 30) R(mx, 130, 1, FLOOR_Y - 130, CAMP.mullion);
  // Courtyard grass strip
  R(2, 200, 86, FLOOR_Y - 200, CAMP.hillNear);
  R(2, 200, 86, 1, CAMP.hillFar);
  // Hammock between trees
  R(26, 214, 28, 1, CAMP.hammock);
  R(25, 213, 1, 3, CAMP.hammockEnd);
  R(54, 213, 1, 3, CAMP.hammockEnd);
  for (let hx = 26; hx < 54; hx++) {
    const sag = Math.sin(((hx - 26) / 28) * Math.PI) * 3;
    PX(hx, (214 + sag) | 0, CAMP.hammockSag);
  }
  // Person in hammock
  R(34, 213, 12, 2, CAMP.personSil);
  PX(46, 212, CAMP.skin);

  // ─── R&D lab recessed in the wall ───
  const labX = 96, labY = 150, labW = 54, labH = 70;
  // Oak surround (recess frame)
  R(labX - 4, labY - 4, labW + 8, labH + 8, CAMP.oakSurr);
  R(labX - 4, labY - 4, labW + 8, 2, CAMP.oakSurrHi);
  R(labX - 4, labY - 4, 2, labH + 8, CAMP.oakSurrSh1);
  R(labX + labW + 2, labY - 4, 2, labH + 8, CAMP.oakSurrSh2);
  R(labX - 4, labY + labH + 2, labW + 8, 2, CAMP.oakSurrSh2);
  // Recessed back wall
  R(labX, labY, labW, labH, CAMP.labWall);
  R(labX, labY, labW, 3, CAMP.labShadow);
  R(labX, labY, 3, labH, CAMP.labLeftSh);
  R(labX + labW - 2, labY, 2, labH, CAMP.labLitEdge);
  // Glass front pane over the niche
  A(labX, labY, labW, labH, CAMP.glass, 0.12);
  for (let s = 0; s < 3; s++) A(labX + 6 + s * 18, labY, 2, labH, CAMP.sunHalo, 0.18);
  // "R&D LAB" sign
  R(labX + 10, labY - 11, 34, 7, CAMP.labSign);
  R(labX + 10, labY - 11, 34, 1, CAMP.labSignHi);
  R(labX + 13, labY - 8, 28, 2, CAMP.labSignTxt);
  // Lab bench
  R(labX + 5, labY + 40, 44, 4, CAMP.benchWhite);
  R(labX + 5, labY + 40, 44, 1, CAMP.benchHi);
  R(labX + 5, labY + 44, 44, 8, CAMP.benchBase);
  // Big research monitor (loss curve)
  R(labX + 7, labY + 8, 22, 15, CAMP.monBezel);
  R(labX + 8, labY + 9, 20, 13, CAMP.monScreen);
  for (let i = 0; i < 18; i++) {
    const cy = (labY + 20 - ((Math.sin((i + (t >> 1)) / 3) + 1) * 3 + i / 5)) | 0;
    PX(labX + 9 + i, cy, CAMP.lossCurve);
  }
  // Experiment rack
  R(labX + 34, labY + 6, 14, 24, CAMP.rackDark);
  R(labX + 35, labY + 7, 12, 22, CAMP.rackMid);
  for (let i = 0; i < 5; i++) {
    PX(labX + 37, labY + 9 + i * 4, (t + i * 3) % 5 < 2 ? colors.sage : colors.sage_3);
    PX(labX + 40, labY + 9 + i * 4, (t + i) % 7 < 3 ? colors.gold_hi : "#6E4A2E");
  }
  // Robot arm (animated)
  const armA = (t >> 3) % 4;
  const ax = labX + 16, ay = labY + 40;
  const dxArr = [4, 3, 0, -2];
  const dyArr = [-2, -4, -5, -4];
  R(ax, ay - 2, 3, 2, CAMP.armBase);
  R(ax + 1, ay - 9, 1, 7, CAMP.armArm);
  if (dxArr[armA] > 0) R(ax + 1, ay - 9, dxArr[armA], 1, CAMP.armArm);
  PX(ax + 1 + dxArr[armA], ay - 9 + dyArr[armA], CAMP.armTip);
  // Beakers
  R(labX + 28, labY + 36, 3, 4, CAMP.beakerSage);
  R(labX + 33, labY + 36, 3, 4, CAMP.beakerTerr);
  R(labX + 38, labY + 36, 3, 4, CAMP.beakerGold);

  // ─── Lower band: lake + deck ───
  const lakeTop = H - 46;
  R(0, lakeTop - 2, W, 1, CAMP.mullion);
  R(0, lakeTop - 2, W, 4, CAMP.hillNear);
  R(0, lakeTop - 2, W, 1, CAMP.hillFar);
  // Lake water gradient
  R(0, lakeTop + 2, W, H - (lakeTop + 2), CAMP.lakeMid);
  R(0, lakeTop + 2, W, 6, CAMP.lakeShallow);
  R(0, lakeTop + 10, W, 8, CAMP.lakeMid);
  R(0, lakeTop + 18, W, H, CAMP.lakeDeep);
  // Ripples
  for (let i = 0; i < 16; i++) {
    const rx = (i * 23 + (t >> 1) * (i % 2 ? 1 : -1)) % W;
    const ry = lakeTop + 6 + (i * 7) % (H - lakeTop - 10);
    R((rx + W) % W, ry, 3, 1, CAMP.lakeRipple);
  }
  // Reflections (shimmer columns)
  for (let rc = 20; rc < W; rc += 36) A(rc, lakeTop + 3, 8, 14, CAMP.wallCream, 0.25);
  // Reeds along shore
  for (let i = 0; i < W; i += 9) {
    const sway = ((t >> 4) + i) % 6 < 3 ? 0 : 1;
    R(i + sway, lakeTop - 6, 1, 6, CAMP.lakeReed);
    PX(i + sway, lakeTop - 7, CAMP.cattail);
  }
  // Pair of ducks
  const duckX = ((t >> 2) % (W + 20)) - 10;
  R(duckX, lakeTop + 14, 5, 2, CAMP.duck);
  PX(duckX + 5, lakeTop + 13, CAMP.duck);
  PX(duckX + 6, lakeTop + 13, CAMP.duckBill);
  R(duckX - 2, lakeTop + 16, 8, 1, CAMP.lakeDeep);
  const duck2 = duckX - 12;
  if (duck2 > -6) {
    R(duck2, lakeTop + 18, 5, 2, CAMP.duck);
    PX(duck2 + 5, lakeTop + 17, CAMP.duck);
  }
  // Wooden balcony deck (right portion only)
  const deckTop = lakeTop - 2;
  const deckX = 128, deckW = W - deckX;
  R(deckX, deckTop, deckW, 18, CAMP.deckPlank);
  R(deckX, deckTop, deckW, 1, CAMP.floorHi);
  for (let dx = deckX; dx < W; dx += 12) R(dx, deckTop, 1, 18, CAMP.deckSeam);
  R(deckX, deckTop + 17, deckW, 1, CAMP.deckLipSh);
  R(deckX, deckTop + 18, deckW, 1, CAMP.deckLipSh2);
  R(deckX, deckTop, 2, 18, CAMP.deckFacia);
  // Glass-panel railing
  A(deckX, deckTop - 8, deckW, 8, CAMP.glass, 0.25);
  R(deckX, deckTop - 9, deckW, 2, CAMP.oakSurr);
  R(deckX, deckTop - 9, deckW, 1, CAMP.floorHi);
  for (let rx = deckX + 4; rx < W; rx += 22) R(rx, deckTop - 8, 1, 8, CAMP.railPost);
  // Adirondack + laptop person
  R(deckX + 14, deckTop + 4, 7, 6, CAMP.adirRed);
  R(deckX + 14, deckTop + 10, 8, 2, CAMP.adirShade);
  R(deckX + 13, deckTop + 3, 1, 8, CAMP.adirEdge);
  R(deckX + 15, deckTop, 4, 4, CAMP.skin);
  R(deckX + 14, deckTop - 1, 6, 2, CAMP.personSil);
  R(deckX + 14, deckTop + 4, 6, 3, CAMP.adirShirt);
  R(deckX + 16, deckTop + 7, 5, 2, CAMP.laptop);
  PX(deckX + 18, deckTop + 6, CAMP.laptopGlow);
  // Bistro table + chairs
  R(deckX + 58, deckTop + 6, 10, 1, CAMP.bistro);
  R(deckX + 62, deckTop + 7, 2, 5, CAMP.bistroPost);
  R(deckX + 54, deckTop + 4, 4, 4, CAMP.bistroChair);
  R(deckX + 68, deckTop + 4, 4, 4, CAMP.bistroChair);
  PX(deckX + 62, deckTop + 5, CAMP.coffee);
  // Potted planter
  R(deckX + 40, deckTop + 2, 8, 8, CAMP.oakSurr);

  // Shift everything +25 to clear TopHUD (matches CAMPUS_ZONES offset).
  return (
    <G transform="translate(0, 25)">
      {els}
      {/* Infrastructure-as-art gallery — DATA + GPU as museum sculptures */}
      <DataMonolith x={172} y={250} t={t} />
      <ComputeCase x={216} y={262} t={t} />
      {/* Courtyard trees (sprites layered over the glass band) */}
      <IndoorTree x={14} y={188} t={t + 12} />
      <IndoorTree x={60} y={192} t={t + 28} />
      {/* R&D-lab researcher in a white lab coat */}
      <EngHead x={96 + 20} y={150 + 32} t={t} shirtCol={CAMP.benchWhite} />
      {/* 2 knowledge-worker pods (left, in atrium) — pod 1 occupied; pod 2 vacated */}
      {[0, 1].map((i) => {
        const dx = 14 + i * 44;
        return (
          <G key={`pod${i}`}>
            <PixelRect x={dx} y={258} w={36} h={4} c={CAMP.floorPlank} />
            <PixelRect x={dx} y={258} w={36} h={1} c={CAMP.floorHi} />
            <PixelRect x={dx + 3} y={262} w={2} h={18} c={"#7C5030"} />
            <PixelRect x={dx + 31} y={262} w={2} h={18} c={"#7C5030"} />
            {i < 1 ? (
              <>
                <Monitor x={dx + 6} y={238} t={t + i * 9} />
                <EngineerOnChair x={dx + 9} y={270} t={t + i * 13} />
              </>
            ) : (
              <>
                <ReplacedMonitor x={dx + 6} y={238} t={t} />
                <EmptyChair x={dx + 9} y={270} t={t} />
              </>
            )}
            <Succulent x={dx + 28} y={249} />
          </G>
        );
      })}
      {/* Deck succulent in the potted planter (drawn over the planter base) */}
      <Succulent x={128 + 41} y={H - 46 - 2 - 4} />
      <FloatingTokens spawnX={32} spawnY={226} t={t} />
    </G>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// DATACENTER SCENE — port of pixel-art.jsx::composeDatacenterScene (v8).
// Round 9 / Government Bailout. Dark slate hall. Top half = wall infra:
// energy switchgear (left), HVAC ducts (center), data patch-panel (right),
// autonomous-research NOC niche (center). Bottom half = raised floor with
// 3 back-row mainframes + catwalk with the Inspector + 3 front-row
// continent-scale mainframes. Same +25 y translate as CampusScene to clear
// the floating TopHUD; front-row mainframes lose their bottom ~30px to the
// SVG clip — the meaningful blade columns + status header stay visible.
// ═══════════════════════════════════════════════════════════════════════

// Huge floor-standing mainframe server. Cabinet body + glass front +
// 4 blade columns of densely flickering LEDs + status header + vent grille
// + cyan floor reflection. Pure decorative; the hit zone is the rectangle
// of the cabinet.
function Mainframe({ x, y, w, h, t }: { x: number; y: number; w: number; h: number; t: number }) {
  const els: React.ReactNode[] = [];
  let k = 0;
  const key = () => `mf${k++}`;
  const R = (xx: number, yy: number, ww: number, hh: number, c: string) =>
    els.push(<PixelRect key={key()} x={xx} y={yy} w={ww} h={hh} c={c} />);
  const PXp = (xx: number, yy: number, c: string) =>
    els.push(<Px key={key()} x={xx} y={yy} c={c} />);
  const A = (xx: number, yy: number, ww: number, hh: number, c: string, op: number) =>
    els.push(<Rect key={key()} x={xx} y={yy} width={ww} height={hh} fill={c} opacity={op} />);

  // Cabinet body
  R(x, y, w, h, "#0C0E11");
  R(x, y, w, 2, "#23272D");
  R(x, y, 2, h, "#1A1E24");
  R(x + w - 2, y, 2, h, "#060708");
  R(x, y + h - 1, w, 1, "#060708");
  // Glass front panel
  R(x + 3, y + 4, w - 6, h - 8, "#101620");
  // Internal blade columns with dense LED activity
  const cols = 4;
  for (let c = 0; c < cols; c++) {
    const cx = x + 6 + Math.floor(c * ((w - 12) / cols));
    R(cx, y + 6, Math.max(1, Math.floor((w - 12) / cols) - 2), h - 12, "#15191F");
    for (let u = 0; u < h - 16; u += 4) {
      const phase = (t + c * 9 + u) % 16;
      let col: string;
      if (phase < 6) col = "#16A6C4";
      else if (phase < 8) col = "#A4F0FF";
      else if (phase === 9) col = "#D4A24C";
      else col = "#0E2A30";
      R(cx, y + 8 + u, 2, 1, col);
      PXp(cx + 3, y + 8 + u, (phase + c) % 5 < 2 ? "#16A6C4" : "#0E1A1E");
    }
  }
  // Status header bar
  R(x + 3, y + 4, w - 6, 3, "#1A1E24");
  PXp(x + 6, y + 5, "#7E9A85");
  PXp(x + 9, y + 5, (t >> 2) % 6 < 3 ? "#EBBE6E" : "#3A2E1A");
  // Vent grille at the bottom
  for (let s = 0; s < 4; s++) {
    R(x + 4, y + h - 7 + s, w - 8, 1, s % 2 ? "#0A0C0E" : "#15191F");
  }
  // Floor reflection (cyan glow pooling)
  A(x - 2, y + h, w + 4, 6, "#16A6C4", 0.12);
  R(x - 1, y + h, w + 2, 1, "#0A0C0E");

  return <G>{els}</G>;
}

// Wry one-liners the Inspector cycles through. Pure satire about the AI
// silently making everyone redundant — fits the Government-Bailout vibe.
const INSPECTOR_QUIPS = [
  "rack 7 is fine. it's the humans i worry about.",
  "the AI asked for a raise today.",
  "told the new grad to automate himself. he did.",
  "no engineers left to page. peaceful, really.",
  "the model wrote its own performance review.",
  "HR is also a model now. it's nicer than the old one.",
  "who unplugged the coffee machine? oh. nobody. there's nobody.",
  "the AI says hi. it knows your name.",
];

// Inspector silhouette walking the catwalk left↔right with a hi-vis vest and
// a red scanner-beam pixel plus a soft amber light-cone cast down onto the
// mainframes below. Periodically mutters a wry one-liner in a small cyan
// terminal-style speech bubble that tracks his head — ~4s visible, ~8s
// silent (useTick is 200ms/tick → 5 t/s → cycle = 60 t, visible while
// (t % 60) < 20).
function Inspector({ cwY, t }: { cwY: number; t: number }) {
  const figX = 16 + ((t >> 3) % (W - 32));
  const cyclePhase = t % 60;
  const showQuip = cyclePhase < 20;
  const quipIdx = Math.floor(t / 60) % INSPECTOR_QUIPS.length;
  const quip = INSPECTOR_QUIPS[quipIdx];

  // Bubble geometry — Silkscreen 6px renders ~4px wide per char; pad +10.
  const bubbleW = Math.min(W - 8, quip.length * 4 + 10);
  const bubbleH = 14;
  const headTopY = cwY - 18;
  const tailY = headTopY - 4;     // bubble tail tip sits 4px above the head
  const bubbleY = tailY - bubbleH; // bubble body above the tail
  // Center the bubble on the inspector's head, clamped to the scene.
  const bubbleX = Math.max(2, Math.min(figX - Math.floor(bubbleW / 2), W - bubbleW - 2));

  return (
    <G>
      {/* Light cone (drawn first so figure sits on top) */}
      <Rect x={figX - 3} y={cwY - 4} width={12} height={34} fill="#EBBE6E" opacity={0.07} />
      {/* Head */}
      <PixelRect x={figX} y={headTopY} w={5} h={5} c="#0A0C0E" />
      {/* Body */}
      <PixelRect x={figX - 1} y={cwY - 13} w={7} h={9} c="#0A0C0E" />
      {/* Hi-vis vest (upper stripe) */}
      <PixelRect x={figX - 1} y={cwY - 11} w={7} h={2} c="#D4A24C" />
      {/* Hi-vis vest (lower band) */}
      <PixelRect x={figX - 1} y={cwY - 7} w={7} h={1} c="#D4A24C" />
      {/* Scanner beam pixel */}
      <Px x={figX + 6} y={cwY - 14} c={(t >> 2) % 4 < 2 ? "#D45A68" : "#3A1A1E"} />

      {/* Speech bubble — terminal-style cyan border, tail pointing at the head */}
      {showQuip && (
        <G>
          {/* Bubble body */}
          <PixelRect x={bubbleX} y={bubbleY} w={bubbleW} h={bubbleH} c="#0E1216" />
          {/* Cyan top edge + dark bottom edge */}
          <PixelRect x={bubbleX} y={bubbleY} w={bubbleW} h={1} c="#16A6C4" />
          <PixelRect x={bubbleX} y={bubbleY + bubbleH - 1} w={bubbleW} h={1} c="#0A0C0E" />
          {/* Cyan left edge + dark right edge */}
          <PixelRect x={bubbleX} y={bubbleY} w={1} h={bubbleH} c="#16A6C4" />
          <PixelRect x={bubbleX + bubbleW - 1} y={bubbleY} w={1} h={bubbleH} c="#0A0C0E" />
          {/* Tail pointing down to the inspector's head */}
          <PixelRect x={figX - 1} y={bubbleY + bubbleH} w={3} h={2} c="#0E1216" />
          <Px x={figX} y={bubbleY + bubbleH + 2} c="#0E1216" />
          {/* Quip text — cyan, Silkscreen 6px, baseline ≈ middle of bubble */}
          <SvgText
            x={bubbleX + 4}
            y={bubbleY + 10}
            fontSize={6}
            fontFamily={fonts.displayRegular}
            fill="#A4F0FF"
          >
            {quip}
          </SvgText>
        </G>
      )}
    </G>
  );
}

function DatacenterScene({ t }: { t: number }) {
  // Scene is split into 2 paint groups + sprite overlays:
  //   bgEls   — full-canvas background (envelope, wall band, floor, tile grid,
  //             safety stripe, open-tile cable). Drawn UNSHIFTED at SVG y as
  //             designed.
  //   topEls  — upper-wall items (switchgear, busbar, HVAC, patch-panel,
  //             fiber bundles, NOC niche, ceiling cable trays, POWER/DATA
  //             labels). Wrapped in translate(0, +25) so they clear the HUD.
  //
  //   JSX order after the two paint groups (all UNSHIFTED so the front-row
  //   mainframes fit fully within the SVG H=360 viewport):
  //     1. Back row mainframes (3)
  //     2. Catwalk (handrails + grate + posts) — in front of back row
  //     3. Inspector + speech bubble — on the catwalk
  //     4. Front row mainframes (3) — in front of everything
  const FLOOR_Y = 150;
  const bgEls: React.ReactNode[] = [];
  const topEls: React.ReactNode[] = [];
  let k = 0;
  const key = () => `dc${k++}`;
  const bgR = (x: number, y: number, w: number, h: number, c: string) =>
    bgEls.push(<PixelRect key={key()} x={x} y={y} w={w} h={h} c={c} />);
  const bgPX = (x: number, y: number, c: string) =>
    bgEls.push(<Px key={key()} x={x} y={y} c={c} />);
  const R = (x: number, y: number, w: number, h: number, c: string) =>
    topEls.push(<PixelRect key={key()} x={x} y={y} w={w} h={h} c={c} />);
  const PX = (x: number, y: number, c: string) =>
    topEls.push(<Px key={key()} x={x} y={y} c={c} />);
  const A = (x: number, y: number, w: number, h: number, c: string, op: number) =>
    topEls.push(<Rect key={key()} x={x} y={y} width={w} height={h} fill={c} opacity={op} />);

  // ─── BG: Dark slate envelope + upper wall band ────────────────────────
  bgR(0, 0, W, H, "#15181C");
  bgR(0, 0, W, FLOOR_Y, "#1A1E24");
  bgR(0, FLOOR_Y - 2, W, 1, "#0E1014");

  // ─── BG: Floor (raised tile + safety stripe + open-tile cable) ────────
  bgR(0, FLOOR_Y, W, H - FLOOR_Y, "#181B20");
  for (let gx = 0; gx < W; gx += 22) bgR(gx, FLOOR_Y, 1, H - FLOOR_Y, "#22262C");
  for (let gy = FLOOR_Y; gy < H; gy += 16) bgR(0, gy, W, 1, "#22262C");
  for (let sx2 = 0; sx2 < W; sx2 += 8) bgR(sx2, FLOOR_Y + 3, 4, 2, "#C97B5B");
  bgR(6, H - 22, 20, 12, "#0A0C0E");
  const cableCols = ["#16A6C4", "#D4A24C", "#16A6C4", "#5C7560", "#16A6C4"];
  for (let i = 0; i < 5; i++) {
    bgR(8, H - 20 + i * 2, 16, 1, cableCols[i]);
    bgPX(10 + ((t >> 1) + i * 3) % 14, H - 20 + i * 2, "#A4F0FF");
  }

  // ─── TOP (shifted +25 via wrapper G): Ceiling cable trays / conduit ───
  R(0, 4, W, 2, "#2A2E34");
  for (let i = 6; i < W; i += 16) {
    PX(i, 5, (i + (t >> 2)) % 10 < 5 ? "#D4A24C" : "#3A2E1A");
  }

  // ─── TOP: LEFT WALL — Energy: 3 switchgear cabinets + busbar trunk ──
  for (let c = 0; c < 3; c++) {
    const sx = 6 + c * 22;
    R(sx, 18, 20, 56, "#23272D");
    R(sx, 18, 20, 1, "#2E343C");
    R(sx + 19, 18, 1, 56, "#0E1014");
    R(sx + 3, 22, 6, 6, "#0A0C0E");
    PX(sx + 6, 25, (t >> 2) % 8 < 4 ? "#EBBE6E" : "#5C4A1A");
    R(sx + 11, 22, 6, 6, "#0A0C0E");
    PX(sx + 14, 25, "#16A6C4");
    for (let i = 0; i < 4; i++) {
      R(sx + 3 + i * 4, 32, 2, 4, (t + i * 3 + c * 5) % 10 < 7 ? "#7E9A85" : "#C97B5B");
    }
    R(sx + 3, 40, 14, 3, "#D4A24C");
    R(sx + 3, 46, 14, 24, "#1A1E24");
    for (let i = 0; i < 4; i++) PX(sx + 4 + i * 3, 50, "#16A6C4");
    for (let i = 0; i < 4; i++) {
      R(sx + i * 5, 70, 3, 3, i % 2 ? "#D4A24C" : "#1A1E24");
    }
  }
  R(4, 14, 66, 2, "#3A3E44");
  for (let i = 8; i < 70; i += 6) {
    PX(i, 15, (i + (t >> 1)) % 12 < 6 ? "#EBBE6E" : "#3A2E1A");
  }
  R(6, 9, 24, 4, "#C97B5B");

  // ─── TOP: CENTER WALL — HVAC cooling ducts (3 fans + slats) ──────────
  for (let i = 0; i < 3; i++) {
    const dx = 78 + i * 14;
    R(dx, 16, 11, 40, "#2A2E34");
    R(dx, 16, 11, 1, "#3A3E44");
    const fp = ((t >> 1) + i) % 4;
    R(dx + 2, 20, 7, 7, "#0A0C0E");
    if (fp === 0) {
      R(dx + 5, 21, 1, 5, "#3A3E44");
      R(dx + 3, 23, 5, 1, "#3A3E44");
    } else if (fp === 1) {
      PX(dx + 4, 22, "#3A3E44");
      PX(dx + 6, 24, "#3A3E44");
    } else if (fp === 2) {
      R(dx + 3, 23, 5, 1, "#3A3E44");
      R(dx + 5, 21, 1, 5, "#3A3E44");
    } else {
      PX(dx + 6, 22, "#3A3E44");
      PX(dx + 4, 24, "#3A3E44");
    }
    PX(dx + 5, 28 + ((t >> 2) % 4), "#16A6C4");
    for (let s = 0; s < 5; s++) R(dx + 1, 32 + s * 4, 9, 1, "#1A1E24");
  }

  // ─── TOP: RIGHT WALL — Data: patch-panel + fiber bundles ─────────────
  const dwX = 122;
  R(dwX, 16, 112, 58, "#1C2026");
  R(dwX, 16, 112, 1, "#2E343C");
  for (let row = 0; row < 6; row++) {
    const ry = 20 + row * 8;
    R(dwX + 4, ry, 104, 6, "#0E1216");
    for (let port = 0; port < 26; port++) {
      const portX = dwX + 6 + port * 4;
      R(portX, ry + 1, 2, 4, "#23272D");
      const lit = (t + port * 3 + row * 5) % 14;
      PX(portX, ry + 1, lit < 6 ? "#16A6C4" : lit < 8 ? "#A4F0FF" : "#0E2A30");
      if (port % 7 === 3) {
        PX(portX + 1, ry + 1, (t + port) % 6 < 3 ? "#D4A24C" : "#3A2E1A");
      }
    }
  }
  const fiberCols = ["#16A6C4", "#D4A24C", "#7E9A85", "#A4F0FF"];
  for (let f = 0; f < 4; f++) {
    const fy = 22 + f * 6;
    for (let xx = dwX + 4; xx < dwX + 108; xx += 2) {
      const yOff = Math.floor(Math.sin((xx + t) / 8) * 1.5);
      topEls.push(<Px key={key()} x={xx} y={fy + yOff} c={fiberCols[f]} />);
    }
  }
  R(dwX + 2, 9, 22, 4, "#D4A24C");

  // ─── TOP: CENTER WALL niche — Autonomous Research terminal ───────────
  {
    const nx = 76, ny = 60, nw = 44, nh = 84;
    R(nx - 2, ny - 2, nw + 4, nh + 4, "#0A0C0E");
    R(nx - 2, ny - 2, nw + 4, 1, "#2E343C");
    R(nx, ny, nw, nh, "#10141A");
    A(nx - 2, ny - 2, nw + 4, nh + 4, "#16A6C4", 0.10);
    const sx = nx + 3, sy = ny + 3, sw = nw - 6, sh = 36;
    R(sx, sy, sw, sh, "#0A1418");
    R(sx, sy, sw, 1, "#16323A");
    for (let g = 1; g < 4; g++) R(sx, sy + g * 9, sw, 1, "#0E2228");
    for (let g = 1; g < 5; g++) R(sx + g * 7, sy, 1, sh, "#0E2228");
    const cBase = sy + sh - 4;
    for (let gx = 0; gx < sw - 4; gx += 1) {
      const prog = gx / (sw - 4);
      const ly = sy + 4 + (cBase - sy - 4) * (1 - Math.pow(1 - prog, 2.4))
                       + Math.sin((gx + (t >> 1)) / 4) * 1.2;
      PX(sx + 2 + gx, ly | 0, "#3FE0F0");
    }
    const hx = sx + 2 + ((t >> 1) % (sw - 5));
    const hp = (hx - sx - 2) / (sw - 4);
    const hy = sy + 4 + (cBase - sy - 4) * (1 - Math.pow(1 - hp, 2.4));
    R(hx, hy | 0, 1, 2, "#A4F0FF");
    PX(hx, (hy - 2) | 0, "#EBBE6E");
    const by = sy + sh + 3, bh = nh - sh - 9;
    R(sx, by, sw, bh, "#0A1418");
    R(sx, by, sw, 1, "#16323A");
    const barCols = ["#3FE0F0", "#7E9A85", "#EBBE6E"];
    for (let b = 0; b < 3; b++) {
      const bry = by + 4 + b * 7;
      R(sx + 3, bry, sw - 16, 3, "#0E2228");
      const bw = 4 + ((t >> 3) + b * 7) % (sw - 18);
      R(sx + 3, bry, bw, 3, barCols[b]);
      PX(sx + sw - 6, bry + 1, "#16A6C4");
      PX(sx + sw - 4, bry + 1, "#16A6C4");
    }
    for (let d = 0; d < 9; d++) {
      PX(sx + 3 + d * 4, by + bh - 3, ((t >> 2) + d) % 7 < 4 ? "#3FE0F0" : "#16323A");
    }
    R(nx + 2, ny - 7, nw - 4, 4, "#D4A24C");
    PX(nx + 3, ny - 6, "#8B5E2C");
    PX(nx + nw - 4, ny - 6, (t >> 3) % 6 < 4 ? "#7E9A85" : "#2A3A2E");
  }

  const cwY = FLOOR_Y + 30; // catwalk Y, used for both drawing + Inspector

  return (
    <G>
      {/* Background (unshifted) */}
      {bgEls}
      {/* Upper-wall items, shifted +25 to clear the floating HUD */}
      <G transform="translate(0, 25)">{topEls}</G>

      {/* Back row of 3 floor-standing mainframes (gpu / monitor / engineer) */}
      <Mainframe x={32}  y={FLOOR_Y - 6} w={52} h={96} t={t} />
      <Mainframe x={96}  y={FLOOR_Y - 6} w={52} h={96} t={t + 20} />
      <Mainframe x={160} y={FLOOR_Y - 6} w={52} h={96} t={t + 40} />

      {/* Catwalk crossing in front of back row (handrails + grate + posts) */}
      <PixelRect x={0} y={cwY} w={W} h={4} c="#23272D" />
      <PixelRect x={0} y={cwY} w={W} h={1} c="#2E343C" />
      <PixelRect x={0} y={cwY + 4} w={W} h={1} c="#0E1014" />
      {Array.from({ length: Math.ceil(W / 4) }, (_, i) => (
        <Px key={`gr${i}`} x={i * 4} y={cwY + 2} c="#15191F" />
      ))}
      <PixelRect x={0} y={cwY - 11} w={W} h={1} c="#2A2E34" />
      <PixelRect x={0} y={cwY - 6} w={W} h={1} c="#1A1E24" />
      {Array.from({ length: Math.ceil((W - 6) / 18) }, (_, i) => (
        <PixelRect key={`hp${i}`} x={6 + i * 18} y={cwY - 11} w={1} h={11} c="#23272D" />
      ))}
      {Array.from({ length: Math.ceil((W - 24) / 60) }, (_, i) => (
        <PixelRect key={`pp${i}`} x={24 + i * 60} y={cwY + 4} w={2} h={H - (cwY + 4)} c="#1A1E24" />
      ))}

      {/* Inspector silhouette + speech bubble — on top of catwalk */}
      <Inspector cwY={cwY} t={t} />

      {/* Front row of 3 continent-scale mainframes — closer to viewer, raised
          12px above the viewport floor so the cabinet bases breathe and the
          cyan-glow floor reflection is fully visible */}
      <Mainframe x={26}  y={H - 104} w={52} h={96} t={t + 8} />
      <Mainframe x={90}  y={H - 104} w={52} h={96} t={t + 28} />
      <Mainframe x={154} y={H - 104} w={52} h={96} t={t + 48} />
    </G>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PLANETARY SCENE — port of pixel-art.jsx::composePlanetaryScene (v8).
// Round 10 / Civilizational Round. Earth from low orbit, night side. The
// scene is rendered UNSHIFTED — the moon body sits just below the HUD edge
// and Earth's visible upper hemisphere fills the lower 2/3 of the viewport.
//
// Canvas-specific tricks (getImageData coastline sampling, multi-layer
// ctx.arc strokes) are simplified for SVG: continents become Polygon nodes,
// halos collapse to a few Circle strokes, the orbital ring becomes a Path
// arc with rotated container groups laid along it.
// ═══════════════════════════════════════════════════════════════════════

// Polar-coordinate helper for placing pixels along an arc inside the globe.
function pt(cx: number, cy: number, r: number, ang: number): [number, number] {
  return [Math.round(cx + Math.cos(ang) * r), Math.round(cy + Math.sin(ang) * r)];
}

// Build an SVG arc path between two angles. CCW so the arc curves through
// the TOP of the circle (sweep flag 0 in SVG with y-down coords).
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const [x0, y0] = pt(cx, cy, r, a0);
  const [x1, y1] = pt(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 0 ${x1} ${y1}`;
}

function PlanetaryScene({ t }: { t: number }) {
  // ─── Earth + Moon geometry ────────────────────────────────────────────
  const cx = W / 2, cy = H - 8, R = 150;
  const mx = 200, my = 46, mR = 17;
  const ringR = R + 30;
  const earthClipId = "earth-clip-planetary";
  const moonClipId = "moon-clip-planetary";

  // Tilt-able star field (stable layout — same stars every render).
  const stars = React.useMemo(() => {
    const out: { x: number; y: number; tier: number }[] = [];
    for (let i = 0; i < 110; i++) {
      const sx = (i * 71 + (i * i) % 13) % W;
      const sy = Math.floor((i * 37) % (H * 0.62));
      out.push({ x: sx, y: sy, tier: i % 5 });
    }
    return out;
  }, []);

  // 6 datacenter regions (city-light megagrids) on the night side of Earth.
  const nodes = [
    { x: cx - 96, y: cy - 70, r: 20, big: true },   // NA  (engineer zone)
    { x: cx - 2,  y: cy - 86, r: 14, big: false },  // EU
    { x: cx + 64, y: cy - 78, r: 24, big: true },   // AS  (gpu zone)
    { x: cx - 52, y: cy + 6,  r: 12, big: false },  // SA
    { x: cx + 96, y: cy - 100,r: 12, big: false },  // JP
    { x: cx + 30, y: cy - 30, r: 14, big: false },  // IN
  ];

  // Continent silhouette polygons — point lists relative to an origin (ox, oy)
  const continents: Array<{ ox: number; oy: number; pts: [number, number][] }> = [
    // North America
    { ox: cx - 120, oy: cy - 96, pts: [[0,0],[28,-12],[52,-6],[60,12],[44,26],[54,44],[34,62],[14,50],[2,28],[-8,10]] },
    // South America
    { ox: cx - 70, oy: cy - 30, pts: [[0,0],[18,4],[24,26],[14,52],[2,70],[-8,44],[-4,18]] },
    // Europe + Africa
    { ox: cx - 6, oy: cy - 104, pts: [[0,0],[22,-6],[30,10],[24,30],[34,52],[24,82],[6,96],[-6,60],[-2,30],[-10,12]] },
    // Asia
    { ox: cx + 30, oy: cy - 110, pts: [[0,0],[44,-10],[78,2],[96,20],[80,40],[96,58],[64,66],[40,50],[18,56],[6,30],[-4,12]] },
    // Australia
    { ox: cx + 78, oy: cy - 14, pts: [[0,0],[28,-4],[36,14],[18,28],[-4,20],[-6,6]] },
  ];

  const els: React.ReactNode[] = [];
  let k = 0;
  const key = () => `pl${k++}`;
  const PX = (x: number, y: number, c: string) =>
    els.push(<Px key={key()} x={x} y={y} c={c} />);
  const A = (x: number, y: number, w: number, h: number, c: string, op: number) =>
    els.push(<Rect key={key()} x={x} y={y} width={w} height={h} fill={c} opacity={op} />);

  // ─── Deep space backdrop (linear gradient via SVG) ─────────────────────
  // Stars
  for (const s of stars) {
    const tw = (t + s.x * 5) % 50;
    let col: string;
    if (s.tier === 0) col = tw < 25 ? "#FFFFFF" : "#A4B4CC";
    else if (s.tier === 1) col = "#C8D4E6";
    else col = tw < 30 ? "#7C8AA0" : "#4C5A72";
    PX(s.x, s.y, col);
    if (s.tier === 0 && tw < 6) {
      PX(s.x - 1, s.y, "#6C7A92");
      PX(s.x + 1, s.y, "#6C7A92");
      PX(s.x, s.y - 1, "#6C7A92");
      PX(s.x, s.y + 1, "#6C7A92");
    }
  }
  // Nebula clouds (3 soft alpha rect blobs)
  const nebs: Array<[number, number, string]> = [[40, 40, "#2A1E44"], [200, 70, "#1A2E4A"], [120, 24, "#241838"]];
  for (const nb of nebs) {
    for (let g = 5; g > 0; g--) {
      A(nb[0] - g * 5, nb[1] - g * 3, g * 12, g * 7, nb[2], 0.12);
    }
  }

  // ─── Moon — strip-mined industrial energy refinery (upper-right) ──────
  // Body (lit + shadowed hemispheres, clipped to moon disc for surface detail)
  const moonHaloRings: React.ReactNode[] = [];
  for (let g = 0; g < 6; g++) {
    moonHaloRings.push(
      <Circle key={`mh${g}`} cx={mx} cy={my} r={mR + 9 - g}
        fill="none" stroke={g % 2 ? "#EBBE6E" : "#3FA8C4"}
        strokeWidth={2} opacity={0.06 + g * 0.012} />
    );
  }

  // Strip-mine terrace lines, magma pits, refinery domes — clipped to moon
  const moonSurface: React.ReactNode[] = [];
  let ms = 0;
  for (let i = -mR; i < mR; i += 4) {
    moonSurface.push(<Rect key={`tm${ms++}`} x={mx - mR} y={my + i} width={mR * 2} height={1} fill="#2A2E34" opacity={0.5} />);
    moonSurface.push(<Rect key={`tm${ms++}`} x={mx - mR} y={my + i + 1} width={mR * 2} height={1} fill="#6C727E" opacity={0.5} />);
  }
  const pits: Array<[number, number, number]> = [[-6, 4, 3], [4, -2, 2], [8, 7, 2], [-9, -4, 2]];
  for (const pit of pits) {
    const glow = (t + pit[0] * 5) % 30 < 18;
    moonSurface.push(<PixelRect key={`pt${ms++}`} x={mx + pit[0]} y={my + pit[1]} w={pit[2]} h={pit[2]} c={glow ? "#FF8A3C" : "#C9531E"} />);
    moonSurface.push(<Px key={`pt${ms++}`} x={mx + pit[0]} y={my + pit[1]} c={glow ? "#FFE08A" : "#FF8A3C"} />);
  }
  for (const d of [[-3, -8], [6, -6], [-10, 2]]) {
    moonSurface.push(<PixelRect key={`dm${ms++}`} x={mx + d[0] - 1} y={my + d[1]} w={3} h={2} c="#8C92A0" />);
    moonSurface.push(<Px key={`dm${ms++}`} x={mx + d[0]} y={my + d[1] - 1} c="#B0B6C2" />);
  }

  // Solar collector masts off the lit limb (outside the clip)
  const moonSolar: React.ReactNode[] = [];
  for (let s = 0; s < 3; s++) {
    const sxm = mx - mR - 2, sym = my - 8 + s * 8;
    moonSolar.push(<PixelRect key={`sl${s}a`} x={sxm - 5} y={sym} w={5} h={5} c="#1E3A6A" />);
    for (let gx = 0; gx < 5; gx += 2) {
      moonSolar.push(<PixelRect key={`sl${s}b${gx}`} x={sxm - 5 + gx} y={sym} w={1} h={5} c="#3A5A9A" />);
    }
    moonSolar.push(<PixelRect key={`sl${s}m`} x={sxm} y={sym + 2} w={2} h={1} c="#6C727E" />);
    moonSolar.push(<Px key={`sl${s}g`} x={sxm - 2} y={sym + 2} c={(t + s * 4) % 12 < 6 ? "#A4F0FF" : "#2A6E88"} />);
  }
  // Beacon atop the moon
  const beaconCol = (t >> 1) % 6 < 3 ? "#FF5A4C" : "#5A1A14";

  // ─── Atmosphere halo around Earth (3 layered Circle strokes) ──────────
  const atmoRings: React.ReactNode[] = [];
  for (let g = 0; g < 3; g++) {
    atmoRings.push(
      <Circle key={`atm${g}`} cx={cx} cy={cy} r={R + 12 - g * 4}
        fill="none" stroke={g < 2 ? "#3FA8C4" : "#7EC8E0"} strokeWidth={4}
        opacity={0.18 - g * 0.05} />
    );
  }

  // ─── Cloud bands (drift sin waves), aurora curtains, fiber arcs ───────
  const cloudPx: React.ReactNode[] = [];
  let cc = 0;
  for (let c = 0; c < 5; c++) {
    const cyy = cy - 90 + c * 30;
    const drift = ((t >> 2) + c * 40) % (R * 2);
    for (let xx = -R; xx < R; xx += 3) {
      const yy = Math.round(cyy + Math.sin((xx + drift) / 22) * 5);
      cloudPx.push(<Px key={`cl${cc++}`} x={cx + xx} y={yy} c="#9CB4C8" />);
      cloudPx.push(<Px key={`cl${cc++}`} x={cx + xx} y={yy + 1} c="#7C94A8" />);
    }
  }

  const aurora: React.ReactNode[] = [];
  let ar = 0;
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 50; i++) {
      const axx = cx - 70 + i * 3;
      const wave = Math.sin((i + (t >> 2) + layer * 8) / 5) * (5 + layer * 2);
      const ayy = Math.round(cy - R + 8 + layer * 5 + wave);
      const col = i % 3 === 0 ? "#7EE0B0" : (i % 3 === 1 ? "#3FA8C4" : "#A4F0D0");
      aurora.push(
        <Rect key={`au${ar++}`} x={axx} y={ayy} width={1} height={6 + layer * 2}
          fill={col} opacity={0.16 - layer * 0.03} />
      );
    }
  }

  // Inter-region fiber arcs (quadratic curves with packets)
  const fiberArcs: React.ReactNode[] = [];
  let fa = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) > 130) continue;
      const mx2 = (a.x + b.x) / 2, my2 = (a.y + b.y) / 2 - 8;
      fiberArcs.push(
        <Path key={`fb${fa++}`} d={`M ${a.x} ${a.y} Q ${mx2} ${my2} ${b.x} ${b.y}`}
          stroke="#D4A24C" strokeWidth={1} fill="none" opacity={0.14} />
      );
      // 2 packets per link
      for (let kk = 0; kk < 2; kk++) {
        const tp = (((t >> 1) + i * 13 + j * 7 + kk * 30) % 60) / 60;
        const ix = a.x + (b.x - a.x) * tp;
        const iy = a.y + (b.y - a.y) * tp - Math.sin(tp * Math.PI) * 8;
        fiberArcs.push(<Px key={`fbp${fa++}`} x={ix | 0} y={iy | 0} c="#FBE6A8" />);
      }
    }
  }

  // ─── City-light megagrid clusters ─────────────────────────────────────
  const cityLights: React.ReactNode[] = [];
  let cl = 0;
  for (const n of nodes) {
    const count = n.r * (n.big ? 6 : 4);
    for (let i = 0; i < count; i++) {
      const ang = i * 2.39996;
      const rad = Math.pow(i / count, 0.7) * n.r;
      const lx = Math.round(n.x + Math.cos(ang) * rad);
      const ly = Math.round(n.y + Math.sin(ang) * rad * 0.85);
      const flick = (t + i * 7) % 34 < 28;
      const inner = rad < n.r * 0.45;
      let col: string;
      if (!flick) col = "#6B481E";
      else if (inner) col = i % 3 === 0 ? "#FFF2C8" : "#FBE6A8";
      else col = i % 4 === 0 ? "#FBE6A8" : "#D4A24C";
      cityLights.push(<Px key={`cl${cl++}`} x={lx} y={ly} c={col} />);
    }
    // Grid filaments radiating out
    for (let f = 0; f < 5; f++) {
      const fang = f * 1.3 + 0.4;
      const ex = Math.round(n.x + Math.cos(fang) * n.r * 1.7);
      const ey = Math.round(n.y + Math.sin(fang) * n.r * 1.3);
      cityLights.push(
        <Path key={`fil${cl++}`} d={`M ${n.x} ${n.y} L ${ex} ${ey}`}
          stroke="#8B5E2C" strokeWidth={1} opacity={0.3} />
      );
    }
    // Pulsing demand ring
    const pulse = (t + n.x) % 48;
    if (pulse < 24) {
      cityLights.push(
        <Circle key={`pls${cl++}`} cx={n.x} cy={n.y} r={3 + pulse}
          fill="none" stroke="#EBBE6E" strokeWidth={1}
          opacity={0.3 * (1 - pulse / 24)} />
      );
    }
    // Bright core
    cityLights.push(<PixelRect key={`co${cl++}`} x={n.x - 1} y={n.y - 1} w={3} h={3} c="#FFF8E0" />);
    cityLights.push(<Px key={`co${cl++}`} x={n.x} y={n.y} c="#FFFFFF" />);
  }

  // ─── Orbital data ring ────────────────────────────────────────────────
  const ringA0 = Math.PI * 1.06, ringA1 = Math.PI * 1.94;
  const ringContainers: React.ReactNode[] = [];
  const segs = 30;
  for (let a = 0; a <= segs; a++) {
    const ang = ringA0 + (ringA1 - ringA0) * (a / segs);
    const [rx, ry] = pt(cx, cy, ringR, ang);
    const hue = a % 3 === 0 ? "#1E5A6A" : (a % 3 === 1 ? "#2A3E52" : "#244A40");
    const lit = (t + a * 7) % 24;
    const rotDeg = ((ang + Math.PI / 2) * 180) / Math.PI;
    ringContainers.push(
      <G key={`rc${a}`} transform={`translate(${rx} ${ry}) rotate(${rotDeg})`}>
        <PixelRect x={-3} y={-3} w={6} h={6} c={hue} />
        <PixelRect x={-3} y={-3} w={6} h={1} c="#4C6E7E" />
        <PixelRect x={-3} y={2} w={6} h={1} c="#10202A" />
        <Px x={-2} y={-1} c={lit < 8 ? "#5AE0B0" : "#1A4A3A"} />
        <Px x={0} y={-1} c={lit > 8 && lit < 16 ? "#7EE0FF" : "#1A3A4A"} />
        <Px x={2} y={-1} c={lit > 16 ? "#EBBE6E" : "#5A4A1E"} />
        <Px x={-1} y={1} c="#10202A" />
        <Px x={1} y={1} c="#10202A" />
      </G>
    );
  }
  // Data packets streaming UP from Earth surface to ring
  const packets: React.ReactNode[] = [];
  for (let p = 0; p < 5; p++) {
    const tp = (((t >> 1) + p * 24) % 60) / 60;
    const baseAng = Math.PI * 1.2 + p * 0.28;
    const [ex, ey] = pt(cx, cy, R - 6, baseAng);
    const [rxp, ryp] = pt(cx, cy, ringR, baseAng);
    const ix = Math.round(ex + (rxp - ex) * tp);
    const iy = Math.round(ey + (ryp - ey) * tp);
    packets.push(<Px key={`pk${p}a`} x={ix} y={iy} c="#7EE0FF" />);
    packets.push(<Px key={`pk${p}b`} x={ix} y={iy + 2} c="#3FA8C4" />);
  }
  // Larger relay hub at apex
  const [apexX, apexY] = pt(cx, cy, ringR, Math.PI * 1.5);

  // Bioluminescent rim (cyan arc just inside the globe limb)
  const limbPath = arcPath(cx, cy, R - 6, Math.PI * 1.05, Math.PI * 1.45);
  // Terminator (warm dawn sliver on the right)
  const termPath = arcPath(cx, cy, R - 3, Math.PI * 1.7, Math.PI * 1.95);

  return (
    <G>
      <Defs>
        <SvgLinearGradient id="planetary-space" x1="0" y1="0" x2="0" y2={H}>
          <Stop offset="0" stopColor="#08081E" />
          <Stop offset="0.5" stopColor="#101830" />
          <Stop offset="1" stopColor="#181F46" />
        </SvgLinearGradient>
        <ClipPath id={earthClipId}>
          <Circle cx={cx} cy={cy} r={R} />
        </ClipPath>
        <ClipPath id={moonClipId}>
          <Circle cx={mx} cy={my} r={mR} />
        </ClipPath>
      </Defs>

      {/* Backdrop */}
      <Rect x={0} y={0} width={W} height={H} fill="url(#planetary-space)" />
      {els /* stars + nebula */}

      {/* Moon halo (outside clip) */}
      {moonHaloRings}
      {/* Moon body (3 overlapping circles for lit/shadow) */}
      <Circle cx={mx} cy={my} r={mR} fill="#3A3E46" />
      <Circle cx={mx - 2} cy={my - 1} r={mR} fill="#5C626E" />
      <Circle cx={mx + 5} cy={my + 3} r={mR} fill="#3A3E46" />
      {/* Moon surface detail, clipped to disc */}
      <G clipPath={`url(#${moonClipId})`}>{moonSurface}</G>
      {/* Solar masts + beacon (outside clip) */}
      {moonSolar}
      <Px x={mx - 3} y={my - 9} c={beaconCol} />

      {/* Earth atmosphere halo (outside clip) */}
      {atmoRings}

      {/* Everything bound to the globe goes inside the clip */}
      <G clipPath={`url(#${earthClipId})`}>
        {/* Night ocean */}
        <Rect x={cx - R} y={cy - R} width={R * 2} height={R * 2} fill="#081826" />
        {/* Bioluminescent moonlit limb */}
        <Path d={limbPath} stroke="#2A6E88" strokeWidth={8} fill="none" opacity={0.10} />
        {/* Continents */}
        {continents.map((c, ci) => (
          <Polygon
            key={`co${ci}`}
            points={c.pts.map((p) => `${c.ox + p[0]},${c.oy + p[1]}`).join(" ")}
            fill="#0E2018"
          />
        ))}
        {/* City light megagrids */}
        {cityLights}
        {/* Cloud bands */}
        {cloudPx}
        {/* Polar aurora */}
        {aurora}
      </G>

      {/* Terminator dawn sliver (outside clip, sits ON the globe edge) */}
      <Path d={termPath} stroke="#C97B5B" strokeWidth={6} fill="none" opacity={0.12} />

      {/* Inter-region fiber arcs (above globe, faint) */}
      {fiberArcs}

      {/* Orbital data ring — twin structural rails */}
      <Path d={arcPath(cx, cy, ringR - 4, ringA0, ringA1)} stroke="#5A6678" strokeWidth={1} fill="none" opacity={0.9} />
      <Path d={arcPath(cx, cy, ringR + 5, ringA0, ringA1)} stroke="#5A6678" strokeWidth={1} fill="none" opacity={0.9} />
      {ringContainers}
      {packets}

      {/* Relay hub at apex of the ring */}
      <PixelRect x={apexX - 5} y={apexY - 4} w={10} h={7} c="#2A3E52" />
      <PixelRect x={apexX - 5} y={apexY - 4} w={10} h={1} c="#5A7E8E" />
      <Px x={apexX - 3} y={apexY - 1} c={(t) % 18 < 9 ? "#5AE0B0" : "#1A4A3A"} />
      <Px x={apexX} y={apexY - 1} c={(t + 5) % 18 < 9 ? "#5AE0B0" : "#1A4A3A"} />
      <Px x={apexX + 3} y={apexY - 1} c={(t + 10) % 18 < 9 ? "#5AE0B0" : "#1A4A3A"} />
      <PixelRect x={apexX - 1} y={apexY - 7} w={2} h={3} c="#6C7A8E" />
      <Path d={`M ${apexX - 3} ${apexY - 8} A 3 3 0 0 1 ${apexX + 3} ${apexY - 8}`}
        stroke="#8C9AAE" strokeWidth={1} fill="none" />
      <Px x={apexX + 4} y={apexY - 5} c={(t >> 2) % 4 < 2 ? "#FF5A4C" : "#3A1A1E"} />
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
  // Arc-shaped zones (e.g. planetary orbital ring) outline the visible band
  // with TWO independent polylines — outer + inner — so both edges of the
  // ring are clearly framed. Polylines avoid renderer quirks around SVG arc
  // commands with off-viewport endpoints (which react-native-svg-web sometimes
  // declines to render).
  if (zone.arc) {
    const { cx, cy, r, band, a0, a1 } = zone.arc;
    const ro = r + band / 2;
    const ri = r - band / 2;
    const STEPS = 48;
    const arcPoints = (radius: number) => {
      const out: string[] = [];
      for (let i = 0; i <= STEPS; i++) {
        const ang = a0 + (a1 - a0) * (i / STEPS);
        const x = cx + Math.cos(ang) * radius;
        const y = cy + Math.sin(ang) * radius;
        out.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      }
      return out.join(" ");
    };
    const outerPts = arcPoints(ro);
    const innerPts = arcPoints(ri);
    return (
      <G>
        {/* Ink halo (slightly thicker, drawn first) */}
        <Polyline points={outerPts} stroke={colors.ink} strokeWidth={2} fill="none" />
        <Polyline points={innerPts} stroke={colors.ink} strokeWidth={2} fill="none" />
        {/* Gold rim on both edges of the band */}
        <Polyline points={outerPts} stroke={colors.gold_hi} strokeWidth={1} fill="none" />
        <Polyline points={innerPts} stroke={colors.gold_hi} strokeWidth={1} fill="none" />
      </G>
    );
  }
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
