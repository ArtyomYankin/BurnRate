import React from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { D } from "../core/decimal";
import * as audio from "../audio";
import { formatNumber } from "./formatNumber";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Polygon,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { colors, fonts } from "./theme";
import {
  useGame,
  selectCompanionInteractions,
  getCompanionState,
  AGI_PROMPTS,
} from "../game/store";

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
  | "catwalk"
  | "agi"             // planetary: moon → Autonomous Agent (AGI) purchase
  | "cosmonaut"       // planetary: tethered EVA character (mirror of Inspector/Bartender)
  | "prompt_engineer" // agi scene: dev at floating desk (mirror of Inspector/Bartender/Cosmonaut)
  | "cat"             // seed/garage: roaming tabby (1st of the 8-companion arc)
  | "pizza_guy"       // coworking: pizza delivery walker (2nd of the arc)
  | "vc"              // startup office: patagonia-vest angel investor (7th of the arc)
  | "spot"            // megacorp: boston dynamics robot dog patrol (4th of the arc)
  | "bartender"       // campus: sliding-drink bartender (5th of the arc)
  | "inspector";      // datacenter: sparking-rack inspector (6th of the arc)

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
  // Garage Cat — dynamic hit zone rendered separately (DynamicCatHit)
  // that follows the cat's live position (floor OR desk OR mid-jump).
  // No static entry here — it would either eat unrelated taps if wide
  // enough to cover the arc, or fail to cover the cat when it's on the
  // desk if tightened to home. See PixelScene's touch overlay.
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
  // Boston Dynamics Spot — dynamic hit rendered separately
  // (DynamicSpotHit). Static entry removed: the 240-wide band was eating
  // taps on the mainframes below. See PixelScene's touch overlay.
];

// AGI SINGULARITY — design v11 rewrite. The company has become a gravity
// well: a supermassive black hole at the center, with producer anchors
// orbiting around it.
//   research = the black hole itself (the model IS the research at this point)
//   energy   = Dyson Sphere (lower-right) — caged star with collimated tap beam
//   books    = Galactic Archive (spiral galaxy upper-right)
//   monitor  = polar relativistic jet (top, "Observe")
//   gpu      = Matrioshka swarm (lower-left)
// Earlier design intent was to omit research here ("the model trains itself"),
// but the playable experience needs an Equity sink in the loop-around AGI
// round too — so the black hole doubles as the research portal. Engineers can
// still be bought via the Producers screen.
const AGI_ZONES: HitZone[] = [
  { id: "research", x:  92, y: 124, w: 56, h: 52, label: "Tune the AGI" },
  { id: "energy",   x: 186, y: 264, w: 44, h: 44, label: "Dyson Sphere" },
  { id: "books",    x: 184, y:  50, w: 44, h: 40, label: "Galactic Archive" },
  // Training Run zone — wraps the Stellar Forge sprite (cx 32, cy 200, ~50px).
  { id: "monitor",  x:   4, y: 172, w: 56, h: 56, label: "Stellar Forge · Training Run" },
  { id: "gpu",      x:   8, y: 264, w: 52, h: 44, label: "Matrioshka Swarm" },
  // Prompt Engineer — dynamic hit rendered separately (RoguePromptHit)
  // that follows his live position + surfaces the rogue-prompt catch
  // event. Static entry removed for the same reason as cosmonaut —
  // static box drew the selection outline whereas dynamic hits skip it.
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
  // Pizza Guy — dynamic hit zone rendered separately (DynamicPizzaGuyHit)
  // that follows his live position across the upper floor. Static entry
  // removed: the 240-wide band was eating taps on wall props above the
  // bench. See PixelScene's touch overlay for the follow-the-sprite hit.
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
  // VC — dynamic hit rendered separately (DynamicVCHit). Static entry
  // removed: the 180-wide band was eating taps on the desk row below.
  // See PixelScene's touch overlay.
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
// Top-wall zones (energy/research/books) are pre-shifted +60 in y to match
// the same translate the upper-wall sprites get inside DatacenterScene
// (clears the floating TopHUD — see the +60 translate comment there).
// Floor zones (catwalk + mainframes) use raw v8 y values — the floor
// section is rendered unshifted so the front-row mainframes sit fully
// inside the SVG viewport.
const DATACENTER_ZONES: HitZone[] = [
  // Catwalk band first so back-row mainframes (later in the array) win on overlap
  { id: "catwalk",   x:   0, y: 173, w: 240, h:  24, label: "The Inspector" },
  // ─── Upper walls (shifted +60 to match scene's top-wall translate) ───
  // 2026-07 iPad-fix: bumped from +25 to +60 (all zone-y +35) so the wall
  // hit targets sit below the HUD on iPad-portrait, where the scene is
  // ~3.2× scaled vs ~1.75× on phones. Research zone height trimmed 92→82
  // so it stops at y=196 (back-row top) — avoids stealing back-row taps
  // in their narrow x-overlap band.
  // Energy zone expanded to cover the FULL 3-cabinet switchgear bank
  // (raw y=18..74, +60 shift = y=78..134). Was tightened to the lower
  // panel only in design v9 to avoid conflict with the floating Slack
  // button in the top-left corner — Slack has since moved into TopHUD
  // chrome, so the constraint is gone and the zone can wrap the entire
  // visible substation.
  { id: "energy",    x:   4, y:  78, w:  68, h:  56, label: "Buy Energy (Substation)" },
  // 2026-07: sprite niche resized (ny 60→18, nh 84→56 → screen y=78..134
  // after the +60 wall translate) to sit at the same top-baseline as the
  // Energy substation and Data patch-panel. Zone follows: y=78, h=56 to
  // cover exactly the visible niche instead of the old 82-tall drop-band
  // that pointed into empty floor.
  { id: "research",  x:  72, y:  78, w:  52, h:  56, label: "Research (Autonomous R&D)" },
  { id: "books",     x: 120, y:  68, w: 114, h:  66, label: "Buy Data (Surveillance Tap)" },
  // ─── Back row of floor mainframes — halved to h=48 (design v13) ───
  // Semantics rearranged: monitor (Training Run) moved to FRONT-CENTER
  // where the new drawSlotMainframe visual lives; back row is now
  // gpu/engineer/gpu2 spatially left-to-right.
  // 2026-07 iPad-view fix: y bumped from 144 → 196 so the back row sits
  // fully BELOW the Inspector's catwalk (zone y=168..192). Previously
  // the row's top half was clipped behind the HUD on iPad portrait.
  { id: "gpu",       x:  30, y: 208, w:  56, h:  48, label: "Buy GPU (Hyperscale Region)" },
  { id: "engineer",  x:  94, y: 208, w:  56, h:  48, label: "Autonomous Ops" },
  { id: "gpu2",      x: 158, y: 208, w:  56, h:  48, label: "Buy GPU (Continent-Scale)" },
  // ─── Front row (halved) — TRAINING RUN console is the center
  //     cabinet; flanking mainframes are extra GPU tap points. ──
  { id: "gpu",       x:  24, y: 278, w:  56, h:  48, label: "Buy GPU (Front Row L)" },
  { id: "monitor",   x:  88, y: 278, w:  56, h:  48, label: "Training Run (Neural-Net Console)" },
  { id: "engineer",  x: 152, y: 278, w:  56, h:  48, label: "Autonomous Ops (Front Row R)" },
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
  // Lunar mass-driver refinery (upper-right) — design v13 rerouted this
  // from Energy to AGI: the moon is now the anchor for the Autonomous
  // Agent purchase modal. Zone wraps moon body + halo. Energy moved to
  // an equatorial power-grid megastructure on Earth (see below).
  { id: "agi",       x: 170, y:  57, w:  60, h:  56, label: "Autonomous Agent (Lunar Refinery)" },
  // Planet-scale training band — Endurance ring ship sprite at cx=116, cy=64.
  { id: "monitor",   x:  76, y:  48, w:  80, h:  32, label: "Planet-Scale Training" },
  // Cosmonaut on EVA — floats on a slow ellipse (ocx=98, ocy=102, rx=30,
  // ry=14) below-left of the Endurance ring. Zone covers the drift ellipse
  // Cosmonaut — dynamic hit rendered separately (CosmonautTetherHit)
  // that follows his live drift position + surfaces the tether-snap
  // event. Static entry removed: the 80-wide box was catching drift-
  // area taps unrelated to the sprite and drawing the yellow selection
  // outline (whereas dynamic hits skip that outline via setActiveIdx).
  // Orbital storage ring girdling Earth — Data. Selection outline traces
  // the visible arc band itself instead of a rectangle.
  { id: "books",     x:   0, y: 168, w: 240, h:  52, label: "Buy Data (Orbital Ring)",
    arc: { cx: 120, cy: 352, r: 180, band: 16, a0: Math.PI * 1.06, a1: Math.PI * 1.94 } },
  // Continent-scale resource megastructures (design v13 replaces the
  // 6-generic-city cluster model with 5 typed nodes).
  //   NA autonomous region → Engineer chain (self-organizing hex swarm)
  //   Asia-Pacific compute → GPU chain (big silicon substrate + thermal bloom)
  //   Americas compute belt → GPU (2nd tap point, alt narrative)
  //   Equatorial power grid → Energy chain (reactor core + hex substations,
  //   fed by the lunar mass-driver beam)
  // Node coords derive from PlanetaryScene's cx=120, cy=352:
  //   NA:    (cx-96, cy-70) = (24, 282, r=17)
  //   Asia:  (cx+70, cy-84) = (190, 268, r=22)
  //   Ams:   (cx-56, cy-4)  = (64, 348, r=17) — capped by scene bottom
  //   Enrg:  (cx+40, cy-32) = (160, 320, r=15)
  { id: "engineer",  x:   4, y: 260, w:  44, h:  44, label: "Autonomous Region (NA)" },
  { id: "gpu",       x: 166, y: 244, w:  50, h:  50, label: "Buy GPU (Asia-Pacific)" },
  { id: "gpu2",      x:  44, y: 328, w:  40, h:  30, label: "Buy GPU (Americas Belt)" },
  { id: "energy",    x: 144, y: 304, w:  34, h:  34, label: "Buy Energy (Equatorial Grid)" },
  // Frontier Research Array — deep-space observatory upper-left corner.
  { id: "research",  x:  16, y:  38, w:  46, h:  40, label: "Research (Frontier Array)" },
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
 * Funding-round → scene mapping for the 10-round ladder (v12).
 *   seed       → rounds 0-1 (Seed, Series A)         — garage, solo founder
 *   coworking  → round 2   (Series B)                — WeWork bench (1 round)
 *   office     → round 3   (IPO)                     — brick + Edison bulbs (1 round)
 *   megacorp   → rounds 4-5 (Secondary, Acquisition) — corporate slate-blue
 *   campus     → round 6   (Sovereign Wealth)        — Apple-Park-ish campus
 *   datacenter → round 7   (Government Bailout)      — dark server hall
 *   planetary  → round 8   (Civilizational)          — Earth from low orbit
 *   agi        → round 9   (Singularity)             — galactic endgame
 */
export function sceneForRound(roundIdx: number): SceneId {
  if (roundIdx <= 1) return "seed";
  if (roundIdx === 2) return "coworking";
  if (roundIdx === 3) return "office";
  if (roundIdx <= 5) return "megacorp";
  if (roundIdx === 6) return "campus";
  if (roundIdx === 7) return "datacenter";
  if (roundIdx === 8) return "planetary";
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
        // Default preserveAspectRatio (xMidYMid meet) keeps the native
        // 240×360 aspect — required for the pixel art to look right.
        // The "none" stretch experiment squashed architectural elements
        // on iPad portrait. Side gutters on wide screens are smoothed
        // over by the scene-tinted sceneWrap background in HomeScreen
        // (the gutter takes the scene's dominant wall color).
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

      {/* Invisible touch overlay — one Pressable per hit zone. When the
          tutorial is forcing the player toward a specific zone
          (`tutorialHighlight` set), filter out every other zone so taps on
          non-target sprites do nothing. Keeps the player on the strict
          guided path during steps 2/3 without us needing a separate
          overlay component. */}
      {onHit && (
        <View
          style={{ position: "absolute", left: 0, top: 0, width, height }}
          pointerEvents="box-none"
        >
          {zones
            .filter((z) => !tutorialHighlight || z.id === tutorialHighlight)
            .map((z) => {
            const sx = width / W;
            const sy = height / H;
            // Match index back into the unfiltered zone list so activeHit
            // outline still finds its zone.
            const idxInAll = zones.indexOf(z);
            return (
              <Pressable
                key={`${z.id}-${idxInAll}`}
                onPress={() => {
                  setActiveIdx(idxInAll);
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
          {/* Dynamic cat hit-target — follows the cat's live position so
              the player can tap wherever the cat currently IS (floor,
              desk, mid-arc). Only mounted for the seed scene. */}
          {scene === "seed" && (
            <DynamicCatHit
              width={width}
              height={height}
              onHit={onHit}
              setActiveIdx={setActiveIdx}
            />
          )}
          {/* Same idea for the Coworking scene's Pizza Guy — follow his
              walk-across-the-floor position so the tap target isn't a
              static band eating other zones. */}
          {scene === "coworking" && (
            <DynamicPizzaGuyHit
              width={width}
              height={height}
              onHit={onHit}
              setActiveIdx={setActiveIdx}
            />
          )}
          {/* Office scene's VC — same follow-the-sprite pattern; taps
              during the ready window sign him a check into your capital. */}
          {scene === "office" && (
            <DynamicVCHit
              width={width}
              height={height}
              onHit={onHit}
              setActiveIdx={setActiveIdx}
            />
          )}
          {/* Megacorp's Spot — compliance-alert override. Taps during the
              red-! window silence the audit for a small token boost. */}
          {scene === "megacorp" && (
            <DynamicSpotHit
              width={width}
              height={height}
              onHit={onHit}
              setActiveIdx={setActiveIdx}
            />
          )}
          {/* Campus bartender info + his drink-slide event. Info-hit
              rendered FIRST so the drink-catch (later sibling) wins on
              overlap when the glass is on the counter. */}
          {scene === "campus" && (
            <>
              <DynamicBartenderHit
                width={width}
                height={height}
                onHit={onHit}
                setActiveIdx={setActiveIdx}
              />
              <BartenderDrinkHit
                width={width}
                height={height}
                setActiveIdx={setActiveIdx}
              />
            </>
          )}
          {/* Datacenter inspector info + sparking-rack cool-down event.
              Both render — different y ranges so they don't overlap. */}
          {scene === "datacenter" && (
            <>
              <DynamicInspectorHit
                width={width}
                height={height}
                onHit={onHit}
                setActiveIdx={setActiveIdx}
              />
              <SparkingRackHit
                width={width}
                height={height}
                setActiveIdx={setActiveIdx}
              />
            </>
          )}
          {/* Planetary cosmonaut: info tap + UFO fly-by catch. Each UFO
              gets its own follow-the-sprite Pressable while it's live. */}
          {scene === "planetary" && (
            <CosmonautUFOHit
              width={width}
              height={height}
              onHit={onHit}
              setActiveIdx={setActiveIdx}
            />
          )}
          {/* AGI Singularity prompt engineer: info tap + AGI 3-choice
              modal (the model asks a question, 3 replies each with a
              distinct effect). */}
          {scene === "agi" && (
            <AGIPromptHit
              width={width}
              height={height}
              onHit={onHit}
              setActiveIdx={setActiveIdx}
            />
          )}
        </View>
      )}
    </View>
  );
}

// Live cat hit target — reads the cat's current position each frame (via
// its own 20fps smooth tick) and positions a Pressable overlay there so
// the player can pet the cat wherever it actually is on-screen. Larger
// than the sprite by a few px for comfortable tapping.
//
// Owns the pet-cat mini-interaction end-to-end: calls the store, plays a
// chirp on reward, spawns a rising "+N" floater over the cat's head. Only
// routes to the info popup (via `onHit`) when the reward is NOT ready —
// so a rewarded tap feels satisfying instead of interrupted by a modal.
interface CatRewardFloaterState {
  id: number;
  x: number; // scene-native coords (0..240)
  y: number; // scene-native coords (0..360)
  text: string;
}
function DynamicCatHit({
  width,
  height,
  onHit,
  setActiveIdx,
}: {
  width: number;
  height: number;
  onHit: (id: HitId) => void;
  setActiveIdx: (idx: number | null) => void;
}) {
  useTick(50);
  const t = Date.now() / 200;
  const s = garageCatState(t);
  const sx = width / W;
  const sy = height / H;
  const boxX = (s.x - 6) * sx;
  const boxY = (s.y - 9) * sy;
  const boxW = 20 * sx;
  const boxH = 24 * sy;
  const [floaters, setFloaters] = React.useState<CatRewardFloaterState[]>([]);
  const nextId = React.useRef(0);
  return (
    <>
      <Pressable
        onPress={() => {
          setActiveIdx(null);
          const result = useGame.getState().interactWithCompanion("cat");
          if (result.rewarded && result.tokens) {
            audio.play("vignette_pop");
            const id = nextId.current++;
            const tokens = D(result.tokens);
            const text = `+${formatNumber(tokens)}`;
            // Spawn floater at cat's HEAD (above the sprite).
            setFloaters((f) => [...f, { id, x: s.x + 4, y: s.y - 4, text }]);
            // Auto-remove after the fade animation finishes.
            setTimeout(() => {
              setFloaters((f) => f.filter((x) => x.id !== id));
            }, 900);
            return;
          }
          // Not ready — fall through to the normal info popup path.
          onHit("cat");
        }}
        style={{
          position: "absolute",
          left: boxX,
          top: boxY,
          width: boxW,
          height: boxH,
        }}
      />
      {floaters.map((f) => (
        <CatRewardFloater
          key={f.id}
          text={f.text}
          sceneX={f.x}
          sceneY={f.y}
          viewScaleX={sx}
          viewScaleY={sy}
        />
      ))}
    </>
  );
}

// "+N" floater over the cat when a pet lands in the ready window. Mounts,
// smoothly rises ~30px while fading to zero over 900ms, then unmounts
// (parent removes it from state on the same schedule). Non-interactive.
function CatRewardFloater({
  text,
  sceneX,
  sceneY,
  viewScaleX,
  viewScaleY,
}: {
  text: string;
  sceneX: number;
  sceneY: number;
  viewScaleX: number;
  viewScaleY: number;
}) {
  const anim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start();
  }, [anim]);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -30] });
  const opacity = anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        floaterStyles.wrap,
        {
          left: sceneX * viewScaleX - 24,
          top: sceneY * viewScaleY - 12,
          width: 48,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Text style={floaterStyles.text}>{text}</Text>
    </Animated.View>
  );
}

const floaterStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.gold,
    textShadowColor: colors.ink,
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 0,
    letterSpacing: 1,
  },
});

// Live Pizza-Guy hit target — follows the sprite for the info popup +
// spawns flying pizza slices as the round-2 mini-interaction. Every
// ~18-22 sec the pizza box "burps" a slice: it flies in a parabolic arc
// away from the guy, spins as it goes, and the player has ~2s to tap it
// mid-air before it falls off the scene bottom. Caught slice = small
// token burst (same 1% of round threshold as the cat's pet reward);
// missed slice = nothing (no punishment, no lost currency).
interface FlyingSliceState {
  id: number;
  bornMs: number;   // wall-clock when spawned — drives motion + rotation
  x0: number;       // spawn coords (scene-native)
  y0: number;
  vx: number;       // initial velocity px per frame @ 20fps
  vy: number;
}
const SLICE_MIN_INTERVAL_MS = 18_000;
const SLICE_MAX_INTERVAL_MS = 25_000;
const SLICE_GRAVITY = 0.35;          // px / frame² @ 20fps
const SLICE_MAX_LIFETIME_MS = 3_500; // hard despawn after this even if still on-screen
function DynamicPizzaGuyHit({
  width,
  height,
  onHit,
  setActiveIdx,
}: {
  width: number;
  height: number;
  onHit: (id: HitId) => void;
  setActiveIdx: (idx: number | null) => void;
}) {
  useTick(50);
  const now = Date.now();
  const t = now / 200;
  const s = coworkPizzaState(t);
  const sx = width / W;
  const sy = height / H;
  const boxX = (s.x - 4) * sx;
  const boxY = (s.qy - 8) * sy;
  const boxW = 26 * sx;
  const boxH = 60 * sy;

  // Slice queue + spawn scheduler. Refs so re-renders don't re-arm.
  const [slices, setSlices] = React.useState<FlyingSliceState[]>([]);
  const nextIdRef = React.useRef(0);
  const nextSpawnRef = React.useRef(now + SLICE_MIN_INTERVAL_MS);
  const [floaters, setFloaters] = React.useState<CatRewardFloaterState[]>([]);
  const floaterIdRef = React.useRef(10_000); // avoid collision with cat floater ids

  // Spawn loop — every render checks if it's time. Cheap because state
  // updates only fire on actual spawns.
  React.useEffect(() => {
    if (now < nextSpawnRef.current) return;
    // Spawn a slice from the current box position, biased opposite the
    // walking direction so it arcs across the visible floor.
    const dir = s.facing > 0 ? -1 : 1;
    const newSlice: FlyingSliceState = {
      id: nextIdRef.current++,
      bornMs: now,
      x0: s.x + 7,           // roughly box-center
      y0: s.qy + 2,          // just above the box lid
      vx: dir * 2.2,         // sideways drift
      vy: -6.5,              // strong upward pop
    };
    setSlices((prev) => [...prev, newSlice]);
    // Random re-arm 18-25s out.
    const jitter = Math.floor((s.x * 37 + s.qy * 13) % (SLICE_MAX_INTERVAL_MS - SLICE_MIN_INTERVAL_MS));
    nextSpawnRef.current = now + SLICE_MIN_INTERVAL_MS + jitter;
  }, [now, s.facing, s.qy, s.x]);

  // Prune expired slices (offscreen or over the lifetime cap).
  React.useEffect(() => {
    if (slices.length === 0) return;
    const alive = slices.filter((sl) => {
      const age = (now - sl.bornMs) / 50; // frames @ 20fps
      const cy = sl.y0 + sl.vy * age + 0.5 * SLICE_GRAVITY * age * age;
      return now - sl.bornMs < SLICE_MAX_LIFETIME_MS && cy < H + 20;
    });
    if (alive.length !== slices.length) setSlices(alive);
  }, [now, slices]);

  const catchSlice = (id: number) => {
    // Look up the slice's live position for the floater spawn.
    const sl = slices.find((x) => x.id === id);
    setSlices((prev) => prev.filter((x) => x.id !== id));
    const result = useGame.getState().catchPizzaSlice();
    audio.play("vignette_pop");
    if (sl) {
      const age = (now - sl.bornMs) / 50;
      const cx = sl.x0 + sl.vx * age;
      const cy = sl.y0 + sl.vy * age + 0.5 * SLICE_GRAVITY * age * age;
      const fid = floaterIdRef.current++;
      const text = `+${formatNumber(D(result.tokens))}`;
      setFloaters((prev) => [...prev, { id: fid, x: cx, y: cy, text }]);
      setTimeout(() => setFloaters((prev) => prev.filter((f) => f.id !== fid)), 900);
    }
  };

  return (
    <>
      {/* Pizza-guy sprite tap — opens the compact info popup. */}
      <Pressable
        onPress={() => {
          setActiveIdx(null);
          onHit("pizza_guy");
        }}
        style={{
          position: "absolute",
          left: boxX,
          top: boxY,
          width: boxW,
          height: boxH,
        }}
      />
      {/* Slice hit targets + visuals — one per live slice. */}
      {slices.map((sl) => (
        <FlyingPizzaSlice
          key={sl.id}
          slice={sl}
          now={now}
          viewScaleX={sx}
          viewScaleY={sy}
          onCatch={() => catchSlice(sl.id)}
        />
      ))}
      {/* Reward floaters from caught slices. */}
      {floaters.map((f) => (
        <CatRewardFloater
          key={f.id}
          text={f.text}
          sceneX={f.x}
          sceneY={f.y}
          viewScaleX={sx}
          viewScaleY={sy}
        />
      ))}
    </>
  );
}

// Rendered single pizza slice mid-flight. Own Pressable AND own SVG-in-
// absolute-View render — kept together so the visible sprite and the
// tap target are always at the exact same position. Rotation via CSS
// transform so we don't fight react-native-svg's transform handling.
function FlyingPizzaSlice({
  slice,
  now,
  viewScaleX,
  viewScaleY,
  onCatch,
}: {
  slice: FlyingSliceState;
  now: number;
  viewScaleX: number;
  viewScaleY: number;
  onCatch(): void;
}) {
  const age = (now - slice.bornMs) / 50; // frames @ 20fps
  const cx = slice.x0 + slice.vx * age;
  const cy = slice.y0 + slice.vy * age + 0.5 * SLICE_GRAVITY * age * age;
  const rotDeg = (age * 22) % 360; // slow spin
  // Slice sprite: 8×8 pixel triangle-ish pizza slice. Rendered as inline
  // absolute View with a couple stacked rectangles — cheap and readable.
  const size = 12;
  return (
    <Pressable
      onPress={onCatch}
      hitSlop={6}
      style={{
        position: "absolute",
        left: cx * viewScaleX - (size * viewScaleX) / 2,
        top: cy * viewScaleY - (size * viewScaleY) / 2,
        width: size * viewScaleX,
        height: size * viewScaleY,
        transform: [{ rotate: `${rotDeg}deg` }],
      }}
    >
      <View style={sliceStyles.body}>
        <View style={sliceStyles.crust} />
        <View style={sliceStyles.cheese} />
        <View style={sliceStyles.pepperoni1} />
        <View style={sliceStyles.pepperoni2} />
      </View>
    </Pressable>
  );
}

const sliceStyles = StyleSheet.create({
  body: {
    flex: 1,
    position: "relative",
  },
  crust: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "40%",
    backgroundColor: "#C9531E", // terracotta crust
  },
  cheese: {
    position: "absolute",
    left: "15%",
    right: "15%",
    top: "10%",
    bottom: "50%",
    backgroundColor: "#F0C060", // gold cheese
  },
  pepperoni1: {
    position: "absolute",
    left: "22%",
    top: "20%",
    width: "22%",
    height: "22%",
    backgroundColor: "#B23A2A", // deep red
  },
  pepperoni2: {
    position: "absolute",
    right: "22%",
    top: "35%",
    width: "18%",
    height: "18%",
    backgroundColor: "#B23A2A",
  },
});

// Live VC hit target — same follow-the-sprite pattern as the cat.
// Tap during the ready window (visible via the gold $ over his head)
// calls `interactWithCompanion("vc")` and awards CAPITAL (5% of your
// current) — spawns a gold "+$N" floater at his head. Non-ready taps
// fall through to `onHit("vc")` for the standard compact info popup.
function DynamicVCHit({
  width,
  height,
  onHit,
  setActiveIdx,
}: {
  width: number;
  height: number;
  onHit: (id: HitId) => void;
  setActiveIdx: (idx: number | null) => void;
}) {
  useTick(50);
  const t = Date.now() / 200;
  const s = officeVCState(t);
  const sx = width / W;
  const sy = height / H;
  // VC sprite spans roughly x-3 .. x+16 (hair + phone in peering pose),
  // head at y≈220, feet at y=250. Pad ±3px for comfortable taps.
  const boxX = (s.x - 5) * sx;
  const boxY = (220 - 6) * sy;
  const boxW = 26 * sx;
  const boxH = 44 * sy;
  const [floaters, setFloaters] = React.useState<CatRewardFloaterState[]>([]);
  const nextId = React.useRef(20_000); // avoid collision with cat/pizza ids
  return (
    <>
      <Pressable
        onPress={() => {
          setActiveIdx(null);
          const result = useGame.getState().interactWithCompanion("vc");
          if (result.rewarded && result.capital) {
            audio.play("vignette_pop");
            const id = nextId.current++;
            const capital = D(result.capital);
            const text = `+$${formatNumber(capital)}`;
            setFloaters((f) => [...f, { id, x: s.x + 6, y: 220 - 4, text }]);
            setTimeout(() => {
              setFloaters((f) => f.filter((x) => x.id !== id));
            }, 900);
            return;
          }
          onHit("vc");
        }}
        style={{
          position: "absolute",
          left: boxX,
          top: boxY,
          width: boxW,
          height: boxH,
        }}
      />
      {floaters.map((f) => (
        <CatRewardFloater
          key={f.id}
          text={f.text}
          sceneX={f.x}
          sceneY={f.y}
          viewScaleX={sx}
          viewScaleY={sy}
        />
      ))}
    </>
  );
}

// Live Spot hit target — follows the robot dog's live position across
// the Megacorp floor. Tap during the compliance-alert window (visible
// via the red "!" over his sensor cluster) → +tokens (silenced audit
// = throughput uptick). Non-ready taps fall through to the compact
// info popup.
function DynamicSpotHit({
  width,
  height,
  onHit,
  setActiveIdx,
}: {
  width: number;
  height: number;
  onHit: (id: HitId) => void;
  setActiveIdx: (idx: number | null) => void;
}) {
  useTick(50);
  const t = Date.now() / 200;
  // Megacorp scene sets FLOOR_Y=222 in MegacorpScene body; Spot uses
  // floorY-2 for feet. Hardcode 222 here since we can't cheaply read it
  // from scene state — same convention the sprite uses.
  const FLOOR_Y = 222;
  const s = megaSpotState(t, FLOOR_Y);
  const sx = width / W;
  const sy = height / H;
  // Spot's body spans roughly x .. x+14, torso y ≈ (FLOOR_Y+3-12)..(FLOOR_Y+3)
  // = FLOOR_Y-9..FLOOR_Y+3 after the 5px drop. Hit box is padded above.
  const boxX = (s.x - 4) * sx;
  const boxY = (FLOOR_Y - 15) * sy;
  const boxW = 22 * sx;
  const boxH = 24 * sy;
  const [floaters, setFloaters] = React.useState<CatRewardFloaterState[]>([]);
  const nextId = React.useRef(30_000);
  return (
    <>
      <Pressable
        onPress={() => {
          setActiveIdx(null);
          const result = useGame.getState().interactWithCompanion("spot");
          if (result.rewarded && result.tokens) {
            audio.play("vignette_pop");
            const id = nextId.current++;
            const tokens = D(result.tokens);
            const text = `+${formatNumber(tokens)}`;
            setFloaters((f) => [...f, { id, x: s.x + 7, y: FLOOR_Y - 15, text }]);
            setTimeout(() => {
              setFloaters((f) => f.filter((x) => x.id !== id));
            }, 900);
            return;
          }
          onHit("spot");
        }}
        style={{
          position: "absolute",
          left: boxX,
          top: boxY,
          width: boxW,
          height: boxH,
        }}
      />
      {floaters.map((f) => (
        <CatRewardFloater
          key={f.id}
          text={f.text}
          sceneX={f.x}
          sceneY={f.y}
          viewScaleX={sx}
          viewScaleY={sy}
        />
      ))}
    </>
  );
}

// Campus bartender drink-slide hit target. The scene owns the timing
// (bartenderDrinkSlideState), the store awards tokens once per pour via
// a local "already caught this cycle" ref. Hit-box follows the drink's
// live position as it slides across the bar top.
function BartenderDrinkHit({
  width,
  height,
  setActiveIdx,
}: {
  width: number;
  height: number;
  setActiveIdx: (idx: number | null) => void;
}) {
  useTick(50);
  const t = Math.floor((Date.now() / 200) * 3);
  const drink = bartenderDrinkSlideState(t);
  const caughtCycleRef = React.useRef<number>(-1);
  const [floaters, setFloaters] = React.useState<CatRewardFloaterState[]>([]);
  const nextId = React.useRef(40_000);
  if (!drink.active || drink.launching || caughtCycleRef.current === drink.cycle) {
    return (
      <>
        {floaters.map((f) => (
          <CatRewardFloater
            key={f.id}
            text={f.text}
            sceneX={f.x}
            sceneY={f.y}
            viewScaleX={width / W}
            viewScaleY={height / H}
          />
        ))}
      </>
    );
  }
  const sx = width / W;
  const sy = height / H;
  const x0 = BAR_CBX + 12;
  const x1 = BAR_CBX + BAR_CBW - 12;
  const dy = 196;
  const dx = drink.facing > 0
    ? x0 + (x1 - x0) * drink.p
    : x1 - (x1 - x0) * drink.p;
  // Generous hit area — 32×24 scene-px around the glass (~48×36 on-screen)
  // + 8px hitSlop pad. The drink slides across the bar in 2s so the
  // target needs to forgive imprecise taps, and it competes with the
  // static "bar" cosmetic zone underneath (which opens the info popup
  // if it wins the tap). Sibling later in JSX = wins overlap in RN.
  const boxW = 32;
  const boxH = 24;
  return (
    <>
      <Pressable
        hitSlop={8}
        onPress={() => {
          setActiveIdx(null);
          if (caughtCycleRef.current === drink.cycle) return;
          caughtCycleRef.current = drink.cycle;
          const result = useGame.getState().catchBartenderDrink();
          audio.play("vignette_pop");
          const id = nextId.current++;
          const text = `+${formatNumber(D(result.tokens))}`;
          setFloaters((f) => [...f, { id, x: dx, y: dy - 8, text }]);
          setTimeout(() => {
            setFloaters((f) => f.filter((x) => x.id !== id));
          }, 900);
        }}
        style={{
          position: "absolute",
          left: (dx - boxW / 2) * sx,
          top: (dy - boxH + 4) * sy,
          width: boxW * sx,
          height: boxH * sy,
        }}
      />
      {floaters.map((f) => (
        <CatRewardFloater
          key={f.id}
          text={f.text}
          sceneX={f.x}
          sceneY={f.y}
          viewScaleX={sx}
          viewScaleY={sy}
        />
      ))}
    </>
  );
}

// Datacenter sparking-rack hit target. sparkingMainframeState picks which
// of 5 racks is alerting; player has ~4s to tap it. Awards tokens once
// per event via cycle-guard ref.
interface SparkingRackState {
  activeIdx: number | null;
  framesActive: number;
  cycle: number;
}
const SPARK_PERIOD = 660;
const SPARK_ALERT  = 96;
// Rack positions match DatacenterScene's actual sprite y-coords.
// Back row: FLOOR_Y(150)+58 = 208. Front row: H(360)-82 = 278. Front
// centre is the TRAINING RUN console — skipped so sparks don't overlap
// its dedicated tap target.
const DC_RACKS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 32,  y: 208 },   // 0 back-left
  { x: 96,  y: 208 },   // 1 back-centre
  { x: 160, y: 208 },   // 2 back-right
  { x: 26,  y: 278 },   // 3 front-left  (L2)
  { x: 154, y: 278 },   // 4 front-right (R2)
];
function sparkingMainframeState(t: number): SparkingRackState {
  const phase = t % SPARK_PERIOD;
  const cycle = Math.floor(t / SPARK_PERIOD);
  if (phase >= SPARK_ALERT) return { activeIdx: null, framesActive: 0, cycle };
  return { activeIdx: (cycle * 7 + 3) % 5, framesActive: phase, cycle };
}

function SparkingRackHit({
  width,
  height,
  setActiveIdx,
}: {
  width: number;
  height: number;
  setActiveIdx: (idx: number | null) => void;
}) {
  useTick(50);
  const t = Math.floor(Date.now() / 200);
  const spark = sparkingMainframeState(t);
  const caughtCycleRef = React.useRef<number>(-1);
  const [floaters, setFloaters] = React.useState<CatRewardFloaterState[]>([]);
  const nextId = React.useRef(50_000);
  const sx = width / W;
  const sy = height / H;
  if (spark.activeIdx == null || caughtCycleRef.current === spark.cycle) {
    return (
      <>
        {floaters.map((f) => (
          <CatRewardFloater
            key={f.id}
            text={f.text}
            sceneX={f.x}
            sceneY={f.y}
            viewScaleX={sx}
            viewScaleY={sy}
          />
        ))}
      </>
    );
  }
  const rk = DC_RACKS[spark.activeIdx];
  const boxW = 52;
  const boxH = 48;
  return (
    <>
      <Pressable
        onPress={() => {
          setActiveIdx(null);
          if (caughtCycleRef.current === spark.cycle) return;
          caughtCycleRef.current = spark.cycle;
          const result = useGame.getState().coolDownSparkingRack();
          audio.play("vignette_pop");
          const id = nextId.current++;
          const text = `+${formatNumber(D(result.tokens))}`;
          setFloaters((f) => [...f, { id, x: rk.x + 24, y: rk.y - 10, text }]);
          setTimeout(() => {
            setFloaters((f) => f.filter((x) => x.id !== id));
          }, 900);
        }}
        style={{
          position: "absolute",
          left: rk.x * sx,
          top: rk.y * sy,
          width: boxW * sx,
          height: boxH * sy,
        }}
      />
      {floaters.map((f) => (
        <CatRewardFloater
          key={f.id}
          text={f.text}
          sceneX={f.x}
          sceneY={f.y}
          viewScaleX={sx}
          viewScaleY={sy}
        />
      ))}
    </>
  );
}

// Dynamic hit target that follows the bartender's live walking position
// (bar counter x=cbX+8 .. cbX+cbW-16, head y≈176..186). Tap → compact
// info popup for the character himself; the sliding-drink hit target
// (BartenderDrinkHit) is a separate later-rendered sibling that wins
// overlap while the drink is on-screen. Both live in the touch overlay.
function DynamicBartenderHit({
  width,
  height,
  onHit,
  setActiveIdx,
}: {
  width: number;
  height: number;
  onHit: (id: HitId) => void;
  setActiveIdx: (idx: number | null) => void;
}) {
  useTick(50);
  const t = (Date.now() / 200) * 3;
  const cbX = BAR_CBX;
  const cbW = BAR_CBW;
  const span = cbW - 24;
  const phase = (t / 8) % (span * 2);
  const walk = phase < span ? phase : span * 2 - phase;
  const bx = cbX + 8 + walk;
  const sx = width / W;
  const sy = height / H;
  const boxX = (bx - 2) * sx;
  const boxY = 172 * sy;   // head top ≈ 176; pad 4px above
  const boxW = 18 * sx;
  const boxH = 22 * sy;    // covers head + top of torso above the counter
  return (
    <Pressable
      onPress={() => {
        setActiveIdx(null);
        onHit("bartender");
      }}
      style={{
        position: "absolute",
        left: boxX,
        top: boxY,
        width: boxW,
        height: boxH,
      }}
    />
  );
}

// Same idea for the Datacenter inspector — dynamic hit on his live
// catwalk position → compact popup. Sparking-rack hit is a separate
// later-rendered sibling (they don't compete visually — inspector on
// catwalk y≈170..200, sparks on mainframes y≈216 or 268).
function DynamicInspectorHit({
  width,
  height,
  onHit,
  setActiveIdx,
}: {
  width: number;
  height: number;
  onHit: (id: HitId) => void;
  setActiveIdx: (idx: number | null) => void;
}) {
  useTick(50);
  const t = Date.now() / 200;
  // Inspector walks: figX = 16 + ((t/8) % (W - 40))
  const figX = 16 + ((t / 8) % (W - 40));
  const sx = width / W;
  const sy = height / H;
  // Feet at cwY=185 (FLOOR_Y+35), body iy=cwY-30=155. Box pads 2-3px.
  const boxX = (figX - 2) * sx;
  const boxY = 153 * sy;
  const boxW = 16 * sx;
  const boxH = 36 * sy;
  return (
    <Pressable
      onPress={() => {
        setActiveIdx(null);
        onHit("inspector");
      }}
      style={{
        position: "absolute",
        left: boxX,
        top: boxY,
        width: boxW,
        height: boxH,
      }}
    />
  );
}

// Planetary cosmonaut info tap + UFO catch layer. Cosmonaut tap opens
// the compact info popup; UFO taps use the deterministic ufoFlybyState
// list — a caught-set ref tracks which UFO ids have already been
// redeemed so each saucer only pays out once (even if the deterministic
// state re-materializes it briefly on a jitter/rerender).
function CosmonautUFOHit({
  width,
  height,
  onHit,
  setActiveIdx,
}: {
  width: number;
  height: number;
  onHit: (id: HitId) => void;
  setActiveIdx: (idx: number | null) => void;
}) {
  useTick(50);
  const t = Date.now() / 200;
  const tInt = Math.floor(t);
  const { mx, my } = cosmonautPos(t);
  const sx = width / W;
  const sy = height / H;
  const ufos = ufoFlybyState(tInt);
  const caughtIdsRef = React.useRef<Set<number>>(new Set());
  const [floaters, setFloaters] = React.useState<CatRewardFloaterState[]>([]);
  const nextFloaterId = React.useRef(60_000);

  const catchUFO = (id: number, ux: number, uy: number) => {
    if (caughtIdsRef.current.has(id)) return;
    caughtIdsRef.current.add(id);
    const result = useGame.getState().catchUFO();
    audio.play("vignette_pop");
    const fid = nextFloaterId.current++;
    const text = `+${formatNumber(D(result.tokens))}`;
    setFloaters((f) => [...f, { id: fid, x: ux, y: uy - 6, text }]);
    setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== fid)), 900);
  };

  return (
    <>
      {/* Cosmonaut info tap — always available */}
      <Pressable
        onPress={() => {
          setActiveIdx(null);
          onHit("cosmonaut");
        }}
        style={{
          position: "absolute",
          left: (mx - 2) * sx,
          top:  (my - 2) * sy,
          width:  14 * sx,
          height: 22 * sy,
        }}
      />
      {/* One tap target per live UFO — bigger box + generous hitSlop
          since the saucer keeps moving and taps need to feel forgiving. */}
      {ufos.map((u) => {
        if (caughtIdsRef.current.has(u.id)) return null;
        const ux = Math.floor(u.x);
        const uy = Math.floor(u.y);
        const boxW = 28;
        const boxH = 18;
        return (
          <Pressable
            key={`ufo${u.id}`}
            hitSlop={10}
            onPress={() => {
              setActiveIdx(null);
              catchUFO(u.id, ux, uy);
            }}
            style={{
              position: "absolute",
              left: (ux - boxW / 2) * sx,
              top:  (uy - 5) * sy,
              width:  boxW * sx,
              height: boxH * sy,
            }}
          />
        );
      })}
      {floaters.map((f) => (
        <CatRewardFloater
          key={f.id}
          text={f.text}
          sceneX={f.x}
          sceneY={f.y}
          viewScaleX={sx}
          viewScaleY={sy}
        />
      ))}
    </>
  );
}

// AGI Singularity 3-choice prompt event (Round 9). Every 45-60s the
// model asks a question via a full terminal-window modal above the
// prompt engineer's desk. Player has 10s to pick one of 3 replies,
// each with a DIFFERENT effect (currency burst / temp mult / debt
// paydown / debt add / hype swing). Ties into store's AGI_PROMPTS
// table + applyAGIPromptChoice handler.
const AGI_PROMPT_MIN_MS = 45_000;
const AGI_PROMPT_MAX_MS = 60_000;
const AGI_PROMPT_WINDOW_MS = 10_000;
function AGIPromptHit({
  width,
  height,
  onHit,
  setActiveIdx,
}: {
  width: number;
  height: number;
  onHit: (id: HitId) => void;
  setActiveIdx: (idx: number | null) => void;
}) {
  useTick(50);
  const now = Date.now();
  const sx = width / W;
  const sy = height / H;
  const peBase = promptEngineerPos(Date.now() / 200);
  const [active, setActive] = React.useState<{ promptId: string; bornMs: number } | null>(null);
  const nextSpawnRef = React.useRef(now + AGI_PROMPT_MIN_MS);
  const promptCycleRef = React.useRef(0);
  const [floater, setFloater] = React.useState<CatRewardFloaterState | null>(null);
  const floaterIdRef = React.useRef(70_000);

  // Auto-close expired prompt.
  React.useEffect(() => {
    if (!active) return;
    if (now - active.bornMs >= AGI_PROMPT_WINDOW_MS) {
      setActive(null);
      // Re-arm with random delay after silent dismiss.
      const jitter = Math.floor((now * 37) % (AGI_PROMPT_MAX_MS - AGI_PROMPT_MIN_MS));
      nextSpawnRef.current = now + AGI_PROMPT_MIN_MS + jitter;
    }
  }, [active, now]);

  // Spawn a new prompt when timer elapses.
  React.useEffect(() => {
    if (active) return;
    if (now < nextSpawnRef.current) return;
    const prompts = AGI_PROMPTS;
    const promptIdx = promptCycleRef.current % prompts.length;
    promptCycleRef.current++;
    setActive({ promptId: prompts[promptIdx].id, bornMs: now });
  }, [active, now]);

  const respond = (choiceIdx: number) => {
    if (!active) return;
    const result = useGame.getState().applyAGIPromptChoice(active.promptId, choiceIdx);
    audio.play("vignette_pop");
    const fid = floaterIdRef.current++;
    setFloater({ id: fid, x: peBase.x + 4, y: peBase.y - 20, text: result.label });
    setTimeout(() => setFloater((f) => (f && f.id === fid ? null : f)), 1500);
    setActive(null);
    const jitter = Math.floor((now * 37) % (AGI_PROMPT_MAX_MS - AGI_PROMPT_MIN_MS));
    nextSpawnRef.current = now + AGI_PROMPT_MIN_MS + jitter;
  };

  const prompt = active ? AGI_PROMPTS.find((p) => p.id === active.promptId) : null;

  return (
    <>
      {/* Prompt Engineer info tap — always present */}
      <Pressable
        onPress={() => {
          setActiveIdx(null);
          onHit("prompt_engineer");
        }}
        style={{
          position: "absolute",
          left: (peBase.x - 2) * sx,
          top:  (peBase.y - 2) * sy,
          width:  14 * sx,
          height: 20 * sy,
        }}
      />
      {/* AGI terminal prompt modal — magenta/purple frame, 3 choice buttons */}
      {prompt && (
        <View
          pointerEvents="box-none"
          style={agiPromptStyles.overlay}
        >
          <View style={agiPromptStyles.terminal}>
            <View style={agiPromptStyles.header}>
              <View style={agiPromptStyles.headerDot} />
              <Text style={agiPromptStyles.headerLabel}>AGI</Text>
            </View>
            <Text style={agiPromptStyles.prompt} numberOfLines={1}>{`> ${prompt.text}`}</Text>
            <View style={agiPromptStyles.choicesRow}>
              {prompt.choices.map((c, i) => (
                <Pressable
                  key={`c${i}`}
                  onPress={() => respond(i)}
                  style={agiPromptStyles.choiceBtn}
                >
                  <Text style={agiPromptStyles.choiceText} numberOfLines={1}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
      {floater && (
        <CatRewardFloater
          text={floater.text}
          sceneX={floater.x}
          sceneY={floater.y}
          viewScaleX={sx}
          viewScaleY={sy}
        />
      )}
    </>
  );
}

const agiPromptStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    // Sit above the prompt engineer (~y=248 in scene coords) but below
    // the bottom-alloc chrome. Fixed on-screen offset works fine here
    // because it lives inside the touch overlay which is already scene-
    // scaled by PixelScene's SVG viewBox math.
    top: "58%",
    alignItems: "center",
    zIndex: 5,
  },
  terminal: {
    backgroundColor: "#1A0E22",
    borderColor: "#E85AFF",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 220,
    maxWidth: 300,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  headerDot: {
    width: 5,
    height: 5,
    backgroundColor: "#E85AFF",
  },
  headerLabel: {
    fontFamily: fonts.display,
    fontSize: 9,
    color: "#E85AFF",
    letterSpacing: 1,
  },
  prompt: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: "#FBF7EC",
    marginBottom: 8,
  },
  choicesRow: {
    flexDirection: "row",
    gap: 4,
  },
  choiceBtn: {
    flex: 1,
    backgroundColor: "#6A2A7A",
    borderColor: "#E85AFF",
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "flex-start",
    minHeight: 46,
  },
  choiceText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: "#FBF7EC",
    letterSpacing: 1,
  },
});

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
// Wry one-liners the Garage Cat cycles through — first (Round 1) of the
// 8-companion arc. Tone: deadpan house cat observing founder chaos.
// Cycle offset +1.5s (36 frames) so it doesn't sync with the Inspector.
const GARAGE_CAT_QUIPS = [
  "the human's been on git blame for six hours.",
  "second monitor still showing 404.",
  "keyboard is warm. that's my throne now.",
  "he named the AI 'meow'. i approve.",
  "the standup was three people talking to themselves.",
  "commit message: 'idk'. mood.",
  "founder pitched to a wall. i think it went well.",
  "the intern brought me tuna. cofounder now.",
];

interface GarageCatState {
  x: number;
  y: number;
  sitting: boolean;
  facing: 1 | -1;
  jumping: boolean;
  air: number;
  qx: number;
  qy: number;
}

// Deterministic 480-frame loop through: walk floor → jump onto keyboard →
// sit on desk → jump down → walk home → sit on floor. Both the sprite
// component and the quip anchor derive from this so they stay in sync.
function garageCatState(t: number): GarageCatState {
  // 2026-07 reroute: cat lives on the RIGHT floor (upper-floor band at
  // y=275, feet on wood planks), occasionally jumps LEFT over the empty
  // middle onto the desk keyboard throne at (58, 250) — long tall parabola
  // — sits there, hops back. Fixes the earlier version that walked across
  // the wainscoting wall band instead of the floor.
  const HOME   = { x: 190, y: 275 }; // right-side floor
  const LAUNCH = { x: 140, y: 275 }; // left edge of the right zone
  // Desk perch — sit at the RIGHT END of the desk (between pizza x=112
  // and the desk edge x=140) so the cat doesn't overlap the mouse pad
  // or the pizza sprite. Was x=102 → landed on the mouse.
  const TABLE  = { x: 125, y: 247 };
  // `t` is now a FRACTIONAL 5fps-frame value (see useCatSmoothT) — no
  // Math.floor here, positions interpolate between frames so the cat
  // walks smoothly at 30fps instead of jumping at the scene's 5fps
  // tick rate. Multiplier stays 6× so cycle length is unchanged (~16s).
  const loop = (t * 6) % 480;
  let x = 0, y = 0;
  let sitting = false, facing: 1 | -1 = 1, jumping = false, air = 0;
  if (loop < 108) {
    x = HOME.x; y = HOME.y;
    sitting = true; facing = -1;
  } else if (loop < 150) {
    const u = (loop - 108) / 42;
    x = HOME.x + (LAUNCH.x - HOME.x) * u; y = 275; facing = -1;
  } else if (loop < 186) {
    const u = (loop - 150) / 36;
    x = LAUNCH.x + (TABLE.x - LAUNCH.x) * u;
    y = (LAUNCH.y + (TABLE.y - LAUNCH.y) * u) - 40 * Math.sin(Math.PI * u);
    facing = -1; jumping = true; air = u;
  } else if (loop < 330) {
    x = TABLE.x; y = TABLE.y;
    sitting = true; facing = 1;
  } else if (loop < 366) {
    const u = (loop - 330) / 36;
    x = TABLE.x + (LAUNCH.x - TABLE.x) * u;
    y = (TABLE.y + (LAUNCH.y - TABLE.y) * u) - 30 * Math.sin(Math.PI * u);
    facing = 1; jumping = true; air = u;
  } else {
    const u = (loop - 366) / 114;
    x = LAUNCH.x + (HOME.x - LAUNCH.x) * u; y = 275; facing = 1;
  }
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  return { x: xi, y: yi, sitting, facing, jumping, air, qx: xi + 5, qy: yi - 14 };
}

// Garage Cat sprite — 3 pose states (walking / sitting / jumping), each
// with mirroring by `facing`. Orange tabby, big round eyes with blink,
// tail flick / leg cycle every 4 frames.
//
// Uses its own SMOOTH tick (20fps) instead of the scene's 5fps `t` prop
// so the cat interpolates between frames — walk motion looks continuous
// instead of the jerky 5-step-per-second jump the rest of the scene has.
// `t` is derived from wall-clock ms to match the 5fps frame scale that
// garageCatState was authored against, just fractional.
function GarageCat(_props: { t: number }) {
  useTick(50);
  const t = Date.now() / 200;
  const s = garageCatState(t);
  const interactions = useGame(selectCompanionInteractions);
  const companionState = getCompanionState(Date.now(), interactions, "cat");
  // "Purring / nuzzling" pose kicks in when the reward is ready AND the
  // cat is at rest — closed eyes, small purr squiggles above head, gentle
  // 1-px breath bob. Walking / jumping cats never enter purr mode.
  const purring = companionState === "ready" && s.sitting;
  const breathe = purring && (Math.floor(t / 4) % 2); // ~800ms per breath
  const breathY = breathe ? 1 : 0;
  const x = s.x, y = s.y + breathY, f = s.facing;
  const ORANGE = "#E08A3C";
  const HI = "#F0A85C";
  const STRIPE = "#B5641F";
  const BELLY = "#F5EFE2";
  const NOSE = "#E88AA0";
  const DARK = "#241A12";
  // Blink / tail cycles use FLOORED t so the on/off flips at defined
  // 5fps beats (matches the pre-smoothing look for these secondary
  // animations — no need to sub-frame interpolate a 1-bit toggle).
  const tInt = Math.floor(t);
  const blink = (tInt % 40) < 3;
  // Purring cats have half-closed happy eyes (slits) — override the
  // normal blink toggle so the eyes stay visually shut most of the time.
  const eyeColor = purring ? STRIPE : (blink ? STRIPE : DARK);
  const tail = ((tInt >> 2) % 2);
  // Purr squiggle position + phase — 2 tiny "~" strokes above ears that
  // fade in/out ~every 400ms while purring.
  const purrPulse = purring && ((tInt >> 1) % 3 !== 0);

  if (s.jumping) {
    const rising = s.air < 0.5;
    const hx = f > 0 ? x + 9 : x - 3;
    const tx = f > 0 ? x - 3 : x + 11;
    const ty = rising ? y - 2 : y + 1;
    return (
      <G>
        {/* Elongated body (leaping stretch) */}
        <PixelRect x={x}     y={y + 1} w={12} h={4} c={ORANGE} />
        <PixelRect x={x}     y={y + 1} w={12} h={1} c={HI} />
        <PixelRect x={x + 2} y={y + 4} w={7}  h={1} c={BELLY} />
        {/* Stripes */}
        <PixelRect x={x + 3} y={y + 1} w={1} h={3} c={STRIPE} />
        <PixelRect x={x + 6} y={y + 1} w={1} h={3} c={STRIPE} />
        <PixelRect x={x + 9} y={y + 1} w={1} h={3} c={STRIPE} />
        {/* Tucked legs */}
        <Px x={x + 2}  y={y + 5} c={ORANGE} />
        <Px x={x + 4}  y={y + 5} c={ORANGE} />
        <Px x={x + 8}  y={y + 5} c={ORANGE} />
        <Px x={x + 10} y={y + 5} c={ORANGE} />
        {/* Tail streaming */}
        <PixelRect x={tx} y={ty} w={3} h={1} c={ORANGE} />
        <Px x={f > 0 ? tx - 1 : tx + 3} y={ty - 1} c={ORANGE} />
        <Px x={tx + 1} y={ty} c={STRIPE} />
        {/* Head (reaching forward) */}
        <PixelRect x={hx} y={y - 1} w={5} h={4} c={ORANGE} />
        <PixelRect x={hx} y={y - 1} w={5} h={1} c={HI} />
        <Px x={f > 0 ? hx : hx + 4} y={y - 2} c={ORANGE} />
        <Px x={f > 0 ? hx + 3 : hx + 1} y={y} c={DARK} />
        <Px x={f > 0 ? hx + 4 : hx} y={y + 1} c={NOSE} />
      </G>
    );
  }

  if (s.sitting) {
    return (
      <G>
        {/* Tail curling (flicks) */}
        <PixelRect x={x - 3 + tail} y={y + 8} w={4} h={2} c={ORANGE} />
        <Px x={x - 3 + tail} y={y + 8} c={STRIPE} />
        {/* Upright oval body */}
        <PixelRect x={x - 1} y={y + 1} w={8} h={9} c={ORANGE} />
        <PixelRect x={x - 1} y={y + 1} w={8} h={1} c={HI} />
        <PixelRect x={x + 1} y={y + 4} w={4} h={6} c={BELLY} />
        {/* Stripes */}
        <PixelRect x={x - 1} y={y + 3} w={8} h={1} c={STRIPE} />
        <PixelRect x={x - 1} y={y + 6} w={2} h={1} c={STRIPE} />
        <PixelRect x={x + 5} y={y + 6} w={2} h={1} c={STRIPE} />
        {/* Front paws */}
        <Px x={x}     y={y + 9} c={BELLY} />
        <Px x={x + 5} y={y + 9} c={BELLY} />
        {/* Head */}
        <PixelRect x={x} y={y - 4} w={6} h={5} c={ORANGE} />
        <PixelRect x={x} y={y - 4} w={6} h={1} c={HI} />
        {/* Ears */}
        <Px x={x}     y={y - 5} c={ORANGE} />
        <Px x={x + 5} y={y - 5} c={ORANGE} />
        <Px x={x}     y={y - 4} c={STRIPE} />
        <Px x={x + 5} y={y - 4} c={STRIPE} />
        {/* Eyes — normal dots, or slits when purring (closed happy eyes) */}
        {purring ? (
          <>
            <PixelRect x={x + 1} y={y - 2} w={2} h={1} c={eyeColor} />
            <PixelRect x={x + 4} y={y - 2} w={2} h={1} c={eyeColor} />
          </>
        ) : (
          <>
            <Px x={x + 1} y={y - 2} c={eyeColor} />
            <Px x={x + 4} y={y - 2} c={eyeColor} />
          </>
        )}
        {/* Nose */}
        <Px x={x + 2} y={y - 1} c={NOSE} />
        <Px x={x + 3} y={y - 1} c={NOSE} />
        {/* Purr squiggles above ears — 2 tiny "~" that pulse while ready */}
        {purrPulse && (
          <G>
            <Px x={x - 2} y={y - 7} c={STRIPE} />
            <Px x={x - 1} y={y - 8} c={STRIPE} />
            <Px x={x + 7} y={y - 8} c={STRIPE} />
            <Px x={x + 8} y={y - 7} c={STRIPE} />
          </G>
        )}
      </G>
    );
  }

  // Walking side-profile
  const hx = f > 0 ? x + 8 : x - 2;
  const tx = f > 0 ? x - 1 : x + 10;
  return (
    <G>
      {/* Horizontal body */}
      <PixelRect x={x}     y={y + 1} w={10} h={5} c={ORANGE} />
      <PixelRect x={x}     y={y + 1} w={10} h={1} c={HI} />
      <PixelRect x={x + 2} y={y + 4} w={6}  h={2} c={BELLY} />
      {/* Body stripes */}
      <PixelRect x={x + 2} y={y + 1} w={1} h={4} c={STRIPE} />
      <PixelRect x={x + 5} y={y + 1} w={1} h={4} c={STRIPE} />
      <PixelRect x={x + 8} y={y + 1} w={1} h={4} c={STRIPE} />
      {/* Legs (2-frame alt) */}
      <Px x={x + 1} y={y + 6 + (tail ? 0 : 1)} c={ORANGE} />
      <Px x={x + 4} y={y + 6 + (tail ? 1 : 0)} c={ORANGE} />
      <Px x={x + 7} y={y + 6 + (tail ? 0 : 1)} c={ORANGE} />
      <Px x={x + 9} y={y + 6 + (tail ? 1 : 0)} c={ORANGE} />
      {/* Tail up */}
      <PixelRect x={tx} y={y - 2} w={1} h={5} c={ORANGE} />
      <Px x={tx} y={y - 3 + tail} c={ORANGE} />
      <Px x={tx} y={y - 1} c={STRIPE} />
      <Px x={tx} y={y + 2} c={STRIPE} />
      {/* Head */}
      <PixelRect x={hx} y={y - 2} w={5} h={5} c={ORANGE} />
      <PixelRect x={hx} y={y - 2} w={5} h={1} c={HI} />
      {/* Ears */}
      <Px x={hx}     y={y - 3} c={ORANGE} />
      <Px x={hx + 4} y={y - 3} c={ORANGE} />
      {/* Eye */}
      <Px x={f > 0 ? hx + 3 : hx + 1} y={y} c={blink ? STRIPE : DARK} />
      {/* Nose */}
      <Px x={f > 0 ? hx + 4 : hx} y={y + 1} c={NOSE} />
    </G>
  );
}

// Pink pixel-heart that hovers above the cat's head whenever the
// mini-interaction is ready to redeem (see interactWithCompanion in
// store.ts). Pulses on/off every ~0.6s (3 ticks at 5 t/s) to draw the eye
// without becoming visual noise. Positioned relative to the cat's live
// state so it follows the cat as it moves.
function GarageCatReadyIndicator(_props: { t: number }) {
  // Match the sprite's 20fps smooth tick so the heart anchors to the
  // interpolated cat position (not the scene's coarse 5fps snapshot).
  useTick(50);
  const t = Date.now() / 200;
  const interactions = useGame(selectCompanionInteractions);
  const state = getCompanionState(Date.now(), interactions, "cat");
  if (state !== "ready") return null;
  const s = garageCatState(t);
  const tInt = Math.floor(t);
  // Anchor to the cat's HEAD (which sits at y-2 relative to body y).
  // Heart floats ~10px above the head with a subtle 1px bob.
  const bob = ((tInt >> 1) % 2);
  const hx = s.x + 4;
  const hy = s.y - 12 - bob;
  const PINK = "#F5A0B4";
  const PINK_HI = "#FBC8D2";
  const PINK_SH = "#C97088";
  const blink = (tInt >> 2) % 4 < 3; // ~600ms on, ~200ms off
  if (!blink) return null;
  return (
    <G>
      {/* Two lobes on top */}
      <Px x={hx + 1} y={hy}     c={PINK_HI} />
      <Px x={hx + 4} y={hy}     c={PINK_HI} />
      <PixelRect x={hx}     y={hy + 1} w={3} h={2} c={PINK} />
      <PixelRect x={hx + 3} y={hy + 1} w={3} h={2} c={PINK} />
      <Px x={hx + 1} y={hy + 1} c={PINK_HI} />
      <Px x={hx + 4} y={hy + 1} c={PINK_HI} />
      {/* V-point */}
      <PixelRect x={hx + 1} y={hy + 3} w={4} h={1} c={PINK} />
      <PixelRect x={hx}     y={hy + 3} w={6} h={1} c={PINK_SH} />
      <PixelRect x={hx + 2} y={hy + 4} w={2} h={1} c={PINK_SH} />
    </G>
  );
}

// Shared wrap helper for the companion quip bubbles. Silkscreen 6px
// renders ~4.3px per char, so a raw `length * 3 + N` estimate (used by
// the earlier one-liner bubbles) truncates long quips. This wraps into
// up to 2 lines, splitting at the nearest word boundary, and returns
// the pixel bubble width the widest line needs.
const QUIP_CHAR_W = 4.3;
function wrapQuipLines(text: string, maxBubbleW: number, padPx: number): { lines: string[]; bubbleW: number } {
  const lineCap = Math.max(4, Math.floor((maxBubbleW - padPx) / QUIP_CHAR_W));
  const lines: string[] = [];
  if (text.length <= lineCap) {
    lines.push(text);
  } else {
    let split = text.lastIndexOf(" ", lineCap);
    if (split < lineCap * 0.4) split = text.indexOf(" ", lineCap);
    if (split < 0 || split >= text.length) split = lineCap;
    const l1 = text.slice(0, split).trim();
    let l2 = text.slice(split).trim();
    if (l2.length > lineCap) l2 = l2.slice(0, lineCap - 1) + "…";
    lines.push(l1, l2);
  }
  const widest = Math.max(...lines.map((l) => l.length * QUIP_CHAR_W + padPx));
  return { lines, bubbleW: Math.ceil(Math.min(maxBubbleW, widest)) };
}

// Warm-brown "fridge note" bubble, cream border. Offset +1.5s (36 frames)
// from Inspector so the cat and the datacenter's Inspector don't mutter
// simultaneously if both scenes are previewed at once.
function GarageCatQuip({ t }: { t: number }) {
  // Anchor bubble tail to the SMOOTH cat position so the tail doesn't
  // "teleport" 5px between scene ticks. Cycle timing (`t + 36`, `/24`,
  // etc.) still uses the parent 5fps t — those beats were tuned to the
  // scene's coarse tick and switching them to sub-frame would just make
  // the quip flicker faster.
  const smoothT = Date.now() / 200;
  const s = garageCatState(smoothT);
  const cycle = ((t + 36) / 24) % 12;
  if (cycle > 4) return null;
  const idx = Math.floor((t + 36) / 24 / 12) % GARAGE_CAT_QUIPS.length;
  const text = GARAGE_CAT_QUIPS[idx];
  // Paw glyph eats ~7px of left padding + 2px right margin.
  // Cat bubble uses a narrow 140px cap (vs the ~232px other companions
  // get) so quips wrap into 2 short lines instead of one wide banner —
  // reads faster + doesn't cover the desk / GPU.
  const { lines, bubbleW } = wrapQuipLines(text, 140, 12);
  const rowH = 8;
  const bubbleH = 4 + lines.length * rowH;
  const bubbleX = Math.max(2, Math.min(s.qx - bubbleW / 2, W - bubbleW - 2));
  const bubbleY = Math.max(2, s.qy - (bubbleH + 2));
  return (
    <G>
      {/* Bubble body */}
      <PixelRect x={bubbleX}                 y={bubbleY}              w={bubbleW} h={bubbleH} c="#3A2418" />
      <PixelRect x={bubbleX}                 y={bubbleY}              w={bubbleW} h={1}       c="#F5EFE2" />
      <PixelRect x={bubbleX}                 y={bubbleY + bubbleH - 1} w={bubbleW} h={1}      c="#241408" />
      <PixelRect x={bubbleX}                 y={bubbleY}              w={1}       h={bubbleH} c="#F5EFE2" />
      <PixelRect x={bubbleX + bubbleW - 1}   y={bubbleY}              w={1}       h={bubbleH} c="#241408" />
      {/* Tail down to the cat */}
      <PixelRect x={s.qx - 1} y={bubbleY + bubbleH} w={3} h={2} c="#3A2418" />
      <Px x={s.qx} y={bubbleY + bubbleH + 2} c="#3A2418" />
      {/* Paw-print glyph */}
      <Px x={bubbleX + 3} y={bubbleY + 4} c="#C8A078" />
      <Px x={bubbleX + 3} y={bubbleY + 8} c="#C8A078" />
      {lines.map((line, i) => (
        <SvgText
          key={`ln${i}`}
          x={bubbleX + 7}
          y={bubbleY + 8 + i * rowH}
          fontSize={6}
          fontFamily={fonts.displayRegular}
          fill="#F5EFE2"
        >
          {line}
        </SvgText>
      ))}
    </G>
  );
}

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
      {/* Garage Cat — 1st of the 8-companion arc. Roams floor↔desk in a
          480-frame loop (walk → jump to keyboard → sit → jump down →
          walk back → sit on floor). Drawn AFTER the desk so the cat is
          visible sitting on the keyboard, not hidden behind the monitor.
          ReadyIndicator overlays a pink heart above the cat's head when
          the pet-cat mini-interaction is ready to redeem. */}
      <GarageCat t={t} />
      <GarageCatReadyIndicator t={t} />
      <GarageCatQuip t={t} />
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

// Wry one-liners the Pizza Guy cycles through — 2nd of the 8-companion
// arc. Tone: delivery-driver deadpan about startup food orders. Cycle
// offset +10.5s (252 frames).
const COWORKING_PIZZA_QUIPS = [
  "third pizza this shift. all to the same address.",
  "48 slices. 12 in the meeting. 36 in the trash tomorrow.",
  "no one at the door. slack said 'leave it.'",
  "the AI ordered pineapple. i respected it more than the humans.",
  "the founder said 'i'll venmo you.' he never does.",
  "customer rating: 5 stars. it was left by the AI.",
  "delivery to conference room B. there is no conference room B.",
  "someone asked if this was gluten free. it's pizza.",
];

interface CoworkPizzaState {
  x: number;
  facing: 1 | -1;
  look: boolean;
  earbud: boolean;
  stopped: boolean;
  stride: number;
  qx: number;
  qy: number;
}

// Patrol path along the open floor at Inspector cadence (t >> 3). Every
// ~48 frames stops briefly for a head-turn ("who ordered?"). Every ~96
// frames taps the earbud to confirm with dispatch.
function coworkPizzaState(_t: number): CoworkPizzaState {
  // 6× speed — pizza guy patrols a longer floor span than the cat.
  // `t` is fractional now (see CoworkPizzaGuy's smooth tick) so position
  // math (phase / walk) interpolates between scene ticks. Timing-based
  // toggles (look / earbud / stride) still use floored integer t so
  // their on/off flip stays at defined beats.
  const t = _t * 6;
  const tInt = Math.floor(t);
  const x0 = 6;
  const span = 210;
  const phase = (t / 8) % (span * 2);
  const walk = phase < span ? phase : span * 2 - phase;
  const facing: 1 | -1 = phase < span ? 1 : -1;
  const look = (tInt % 48) >= 45;
  const earbud = (tInt % 96) >= 90;
  const stopped = look || earbud;
  const stride = (!stopped && (tInt >> 1) % 2) ? 1 : 0;
  const x = Math.floor(x0 + walk);
  const fy = 250;
  const hy = fy - 32;
  const boxY = hy - 9;
  return { x, facing, look, earbud, stopped, stride, qx: x + 7, qy: boxY - 4 };
}

// Delivery guy walking with a pizza box balanced overhead. Signature key:
// the WHITE SQUARE BOX perfectly level above the head — no bob, delivery
// pride. Red cap + dark hoodie + backpack strap + earbud confirm dispatch.
function CoworkPizzaGuy(_props: { t: number }) {
  useTick(50);
  const t = Date.now() / 200;
  const s = coworkPizzaState(t);
  const x = s.x;
  const f = s.facing;
  const stride = s.stride;
  const headDx = s.look ? f * 3 : 0;
  const fy = 250;
  const hy = fy - 32;
  const boxY = hy - 9;
  const HOODIE = "#40404E";
  const HOODIE_HI = "#54545F";
  const HOODIE_SH = "#2A2A34";
  const SKIN = "#D8A878";
  const SKIN_HI = "#F0C89C";
  const CAP = "#C9531E";
  const CAP_HI = "#E87A3C";
  const BOX = "#F5EFE2";
  const BOX_SH = "#D8CFBC";
  const LOGO = "#C9531E";
  const DARK = "#2A2A2A";
  const showSteam = (Math.floor(t) >> 2) % 4 < 2;
  return (
    <G>
      {/* Legs / baggy pants + sneakers */}
      <PixelRect x={x + 3}  y={fy - 12} w={4} h={12} c={DARK} />
      <PixelRect x={x + 9}  y={fy - 12} w={4} h={12} c={DARK} />
      <PixelRect x={x + 2  + (stride ? -1 : 0)} y={fy} w={4} h={2} c="#141414" />
      <PixelRect x={x + 11 + (stride ?  1 : 0)} y={fy} w={4} h={2} c="#141414" />
      <PixelRect x={x + 2}  y={fy - 1} w={4} h={1} c="#E8E8E8" />
      <PixelRect x={x + 11} y={fy - 1} w={4} h={1} c="#E8E8E8" />
      {/* Charcoal delivery polo + chest logo patch */}
      <PixelRect x={x + 1} y={fy - 24} w={15} h={12} c={HOODIE} />
      <PixelRect x={x + 1} y={fy - 24} w={15} h={2}  c={HOODIE_HI} />
      <PixelRect x={x + 1} y={fy - 13} w={15} h={1}  c={HOODIE_SH} />
      <PixelRect x={x + (f > 0 ? 10 : 3)} y={fy - 21} w={3} h={3} c={LOGO} />
      {/* Backpack strap */}
      <Line x1={x + 4} y1={fy - 24} x2={x + 12} y2={fy - 13} stroke="#1E1E22" strokeWidth={1} />
      {/* Both arms raised overhead */}
      <PixelRect x={x}      y={fy - 30} w={3} h={9} c={HOODIE} />
      <PixelRect x={x + 14} y={fy - 30} w={3} h={9} c={HOODIE} />
      <PixelRect x={x}      y={fy - 32} w={3} h={2} c={SKIN} />
      <PixelRect x={x + 14} y={fy - 32} w={3} h={2} c={SKIN} />
      {/* Head + red delivery cap */}
      <PixelRect x={x + 5 + headDx} y={hy + 4} w={7}  h={7} c={SKIN} />
      <PixelRect x={x + 5 + headDx} y={hy + 4} w={7}  h={2} c={SKIN_HI} />
      <PixelRect x={x + 3 + headDx} y={hy + 1} w={11} h={4} c={CAP} />
      <PixelRect x={x + 3 + headDx} y={hy + 1} w={11} h={1} c={CAP_HI} />
      <PixelRect x={x + (f > 0 ? 13 : 1) + headDx} y={hy + 4} w={3} h={2} c={CAP} />
      {/* Eyes + earbud */}
      <PixelRect x={x + 6  + headDx} y={hy + 7} w={2} h={2} c="#241A12" />
      <PixelRect x={x + 10 + headDx} y={hy + 7} w={2} h={2} c="#241A12" />
      <PixelRect x={x + (f > 0 ? 4 : 12) + headDx} y={hy + 7} w={2} h={2} c={s.earbud ? "#FFFFFF" : "#E8E8E8"} />
      {s.earbud && (
        <G>
          <PixelRect x={x + 13} y={hy + 4} w={3} h={5} c={HOODIE} />
          <PixelRect x={x + 13} y={hy + 4} w={2} h={2} c={SKIN} />
        </G>
      )}
      {/* Pizza box — level, no bob */}
      <PixelRect x={x - 2} y={boxY}     w={19} h={9} c={BOX} />
      <PixelRect x={x - 2} y={boxY}     w={19} h={2} c="#FFFFFF" />
      <PixelRect x={x - 2} y={boxY + 8} w={19} h={1} c={BOX_SH} />
      <PixelRect x={x - 2} y={boxY + 3} w={19} h={1} c={BOX_SH} />
      <PixelRect x={x + 6} y={boxY + 2} w={5}  h={5} c={LOGO} />
      <PixelRect x={x + 7} y={boxY + 3} w={2}  h={2} c="#F0A060" />
      {/* Faint steam wisps */}
      {showSteam && (
        <G>
          <Rect x={x + 3}  y={boxY - 2} width={2} height={2} fill="#F5EFE2" opacity={0.3} />
          <Rect x={x + 12} y={boxY - 3} width={2} height={2} fill="#F5EFE2" opacity={0.3} />
        </G>
      )}
    </G>
  );
}

// Tomato-red "pizza box receipt" bubble with a small pizza-slice motif at
// the tail. Cycle offset +10.5s from Inspector.
function CoworkPizzaGuyQuip({ t }: { t: number }) {
  // Anchor bubble to smooth cat position; cycle math stays on parent 5fps t.
  const smoothT = Date.now() / 200;
  const s = coworkPizzaState(smoothT);
  const cycle = ((t + 252) / 24) % 12;
  if (cycle > 4) return null;
  const idx = Math.floor((t + 252) / 24 / 12) % COWORKING_PIZZA_QUIPS.length;
  const text = COWORKING_PIZZA_QUIPS[idx];
  // Pizza-slice glyph eats ~9px of left padding + 2px right margin.
  const { lines, bubbleW } = wrapQuipLines(text, W - 8, 14);
  const rowH = 8;
  const bubbleH = 4 + lines.length * rowH;
  const bubbleX = Math.max(2, Math.min(s.qx - bubbleW / 2, W - bubbleW - 2));
  const bubbleY = Math.max(2, s.qy - (bubbleH + 2));
  return (
    <G>
      {/* Bubble body */}
      <PixelRect x={bubbleX}                 y={bubbleY}              w={bubbleW} h={bubbleH} c="#C9531E" />
      <PixelRect x={bubbleX}                 y={bubbleY}              w={bubbleW} h={1}       c="#F5EFE2" />
      <PixelRect x={bubbleX}                 y={bubbleY + bubbleH - 1} w={bubbleW} h={1}      c="#8C3A14" />
      <PixelRect x={bubbleX}                 y={bubbleY}              w={1}       h={bubbleH} c="#F5EFE2" />
      <PixelRect x={bubbleX + bubbleW - 1}   y={bubbleY}              w={1}       h={bubbleH} c="#8C3A14" />
      {/* Tail down + pizza-slice motif */}
      <PixelRect x={s.qx - 1} y={bubbleY + bubbleH} w={3} h={2} c="#C9531E" />
      <Px x={s.qx} y={bubbleY + bubbleH + 2} c="#C9531E" />
      <Px x={bubbleX + 4} y={bubbleY + 3} c="#F5EFE2" />
      <PixelRect x={bubbleX + 3} y={bubbleY + 4} w={3} h={1} c="#F5EFE2" />
      <Px x={bubbleX + 4} y={bubbleY + 4} c="#C9531E" />
      {lines.map((line, i) => (
        <SvgText
          key={`ln${i}`}
          x={bubbleX + 9}
          y={bubbleY + 8 + i * rowH}
          fontSize={6}
          fontFamily={fonts.displayRegular}
          fill="#F5EFE2"
        >
          {line}
        </SvgText>
      ))}
    </G>
  );
}

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

  // Bench-style shared desktop. Extended from 150 to 175 wide (2026-06
   // playtest: rightmost chair + succulent visually fell off the original
   // 150px-wide top). 4 legs now (was 3) so the bench reads as a real
   // 3-person workstation rather than a 2-person bench with overhang.
  const podX = 30, podY = 256;
  const podW = 175;
  R(podX, podY, podW, 4, COWORK.floorSeam);
  R(podX, podY, podW, 1, COWORK.floor);
  R(podX, podY + 4, podW, 1, COWORK.brickDark);
  R(podX + 2,        podY + 5, 3, 28, COWORK.brickDark);
  R(podX + 56,       podY + 5, 3, 28, COWORK.brickDark);
  R(podX + 112,      podY + 5, 3, 28, COWORK.brickDark);
  R(podX + podW - 5, podY + 5, 3, 28, COWORK.brickDark);
  R(podX + 10, podY + 6, podW - 20, 1, "#3A3A3A");

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
      {/* Pizza Delivery Guy — walks left↔right along the upper floor with
          the box balanced overhead. Drawn BEFORE the workstations so the
          monitors occlude his upper body when he passes behind them
          (z-order via JSX draw order). */}
      <CoworkPizzaGuy t={t} />
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
      {/* Quip bubble drawn LAST — always above all scene sprites. */}
      <CoworkPizzaGuyQuip t={t} />
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

// Wry one-liners the VC cycles through — 7th of the 8-companion arc.
// Tone: puffy-vest angel investor "just dropping by" with wine glass +
// Apple Watch. Cycle offset +4.5s (108 frames) so he doesn't sync with
// Inspector or the Cat.
const OFFICE_VC_QUIPS = [
  "great deck. no ask? that's the ask.",
  "i led the last three rounds. i don't remember the companies.",
  "we're not seeing PMF. we're seeing PMF-adjacent.",
  "my thesis is: 'AI but for'.",
  "your burn is your bruh. also your bank.",
  "just dropped by. i have 12 more offices today.",
  "you said 'ecosystem.' i signed the check.",
  "you're preemptive. everyone is preemptive.",
];

interface OfficeVCState {
  x: number;
  facing: 1 | -1;
  standing: boolean;
  watch: boolean;
  sip: boolean;
  bob: number;
  qx: number;
  qy: number;
}

// Continuous walk MINX=40 → MAXX=200 across the upper floor. 120-frame
// blocks: 80f walk, 40f stop. Stops alternate between sipping wine and
// checking the Apple Watch, so he's always on-screen and tappable.
function officeVCState(_t: number): OfficeVCState {
  // 3× speed — matches cat/pizza/spot cadence. `t` is fractional (see
  // OfficeVC's smooth tick) so position math (W / p / walk) interpolates
  // between scene ticks. Block-scoped state (stopped/watch/sip) uses the
  // floored int so those toggles flip at defined beats.
  const t = _t * 3;
  const tInt = Math.floor(t);
  const MINX = 40;
  const MAXX = 200;
  const span = MAXX - MINX;
  const block = 120;
  const walkDur = 80;
  const cyc = tInt % block;
  const blockIdx = Math.floor(tInt / block);
  const stopped = cyc >= walkDur;
  const watch = stopped && (blockIdx % 2 === 1);
  const sip = stopped && (blockIdx % 2 === 0);
  const cycFrac = t - blockIdx * block;
  const wFrac = blockIdx * walkDur + Math.min(cycFrac, walkDur);
  const p = (wFrac / 2) % (span * 2);
  const walk = p < span ? p : span * 2 - p;
  const facing: 1 | -1 = p < span ? 1 : -1;
  const x = Math.floor(MINX + walk);
  const bob = (!stopped && ((tInt >> 2) % 2)) ? 1 : 0;
  const fy = 250 + bob;
  const hy = fy - 30;
  return {
    x,
    facing,
    standing: stopped,
    watch,
    sip,
    bob,
    qx: x + 6,
    qy: hy - 4,
  };
}

// Puffy Patagonia vest + white untucked shirt + chinos. Wine glass in
// left hand (sips), Apple Watch on right wrist (checks near end of
// "dropping by"). Casting-key silhouette: quilted vest with 3 seam lines.
function OfficeVC(_props: { t: number }) {
  // Own 20fps tick — walk motion interpolates between scene ticks.
  useTick(50);
  const smoothT = Date.now() / 200;
  const t = Math.floor(smoothT * 3);
  const s = officeVCState(smoothT);
  // Peering mode: when the check-signing ready window is open, VC leans
  // forward slightly and holds his phone up like he's snapping a photo
  // of your monitor. Overrides the sip/watch pose so it's visually
  // unmistakable that something is up.
  const interactions = useGame(selectCompanionInteractions);
  const peering = getCompanionState(Date.now(), interactions, "vc") === "ready";
  const x = s.x;
  const f = s.facing;
  const bob = s.bob;
  const fy = 250 + bob;
  const hy = fy - 30 + (peering ? 1 : 0); // 1px forward lean when peering
  const VEST = "#1F2C48";
  const VEST_HI = "#33436A";
  const VEST_SH = "#141C30";
  const SHIRT = "#F5EFE2";
  const SHIRT_SH = "#D8D2C4";
  const CHINO = "#C2B280";
  const CHINO_HI = "#D4C79A";
  const SKIN = "#E0B084";
  const SKIN_HI = "#F0C89C";
  const HAIR = "#3A2A1E";
  const WINE = "#C97B3A";
  const GLASS = "#E4E0D8";
  const stride = (!s.standing && (t >> 2) % 2) ? 1 : 0;
  const sipY = s.sip ? -2 : 0;
  return (
    <G>
      {/* Chinos + brown dress shoes (legs 4×10) */}
      <PixelRect x={x + 2}  y={fy - 10} w={4} h={10} c={CHINO} />
      <PixelRect x={x + 8}  y={fy - 10} w={4} h={10} c={CHINO} />
      <PixelRect x={x + 2}  y={fy - 10} w={1} h={10} c={CHINO_HI} />
      <PixelRect x={x + 8}  y={fy - 10} w={1} h={10} c={CHINO_HI} />
      <PixelRect x={x + 2 + (stride ? -1 : 0)} y={fy} w={4} h={1} c="#5A3A22" />
      <PixelRect x={x + 8 + (stride ?  1 : 0)} y={fy} w={4} h={1} c="#5A3A22" />
      {/* White button-up shirt (torso 12×14, sleeves rolled) */}
      <PixelRect x={x + 1} y={fy - 24} w={12} h={14} c={SHIRT} />
      <PixelRect x={x + 1} y={fy - 11} w={12} h={1}  c={SHIRT_SH} />
      <PixelRect x={x + 6} y={fy - 23} w={1}  h={12} c={SHIRT_SH} />
      {/* Puffy Patagonia vest — quilted, 4px panels + 3 seam lines each side */}
      <PixelRect x={x + 1}  y={fy - 24} w={4}  h={12} c={VEST} />
      <PixelRect x={x + 9}  y={fy - 24} w={4}  h={12} c={VEST} />
      <PixelRect x={x + 1}  y={fy - 24} w={12} h={1}  c={VEST_HI} />
      <PixelRect x={x + 1}  y={fy - 20} w={4}  h={1}  c={VEST_SH} />
      <PixelRect x={x + 9}  y={fy - 20} w={4}  h={1}  c={VEST_SH} />
      <PixelRect x={x + 1}  y={fy - 17} w={4}  h={1}  c={VEST_SH} />
      <PixelRect x={x + 9}  y={fy - 17} w={4}  h={1}  c={VEST_SH} />
      <PixelRect x={x + 1}  y={fy - 14} w={4}  h={1}  c={VEST_SH} />
      <PixelRect x={x + 9}  y={fy - 14} w={4}  h={1}  c={VEST_SH} />
      {/* Head 8×8, hair, stubble, eyes */}
      <PixelRect x={x + 3} y={hy}     w={8} h={8} c={SKIN} />
      <PixelRect x={x + 3} y={hy}     w={8} h={1} c={SKIN_HI} />
      <PixelRect x={x + 3} y={hy - 2} w={8} h={3} c={HAIR} />
      <Px x={x + (f > 0 ? 10 : 3)} y={hy + 1} c={HAIR} />
      <Px x={x + 5} y={hy + 7} c="#5A4632" />
      <Px x={x + 8} y={hy + 7} c="#5A4632" />
      <Px x={x + (f > 0 ? 7 : 4)} y={hy + 4} c="#241A12" />
      <Px x={x + (f > 0 ? 9 : 6)} y={hy + 4} c="#241A12" />
      {/* Right arm: Peering (phone raised, snooping) OR Apple Watch OR resting */}
      {peering ? (
        <G>
          {/* Upper arm bent up, forearm extended forward with phone in hand */}
          <PixelRect x={x + 12} y={fy - 22} w={2} h={6} c={VEST} />
          <PixelRect x={x + 13} y={fy - 26} w={3} h={2} c={SKIN} />
          {/* Phone — black slab with a tiny glowing screen (recording indicator) */}
          <PixelRect x={x + 14} y={fy - 30} w={3} h={5} c="#1A1A1A" />
          <PixelRect x={x + 15} y={fy - 29} w={1} h={3} c="#3FE0F0" />
          <Px x={x + 15} y={fy - 28} c="#FFFFFF" />
        </G>
      ) : s.watch ? (
        <G>
          <PixelRect x={x + 12} y={fy - 22} w={2} h={8} c={VEST} />
          <PixelRect x={x + 13} y={fy - 25} w={2} h={4} c={SKIN} />
          <PixelRect x={x + 13} y={fy - 22} w={2} h={2} c="#1A1A1A" />
          <Px x={x + 13} y={fy - 22} c="#4A6FA5" />
        </G>
      ) : (
        <G>
          <PixelRect x={x + 12} y={fy - 18} w={2} h={7} c={SHIRT} />
          <Px x={x + 12} y={fy - 18} c={VEST} />
        </G>
      )}
      {/* Left arm holds wine glass at chest (sips) — hidden when peering
          (both hands on phone in a "shooting content" pose). */}
      {!peering && (
        <G>
          <PixelRect x={x - 1} y={fy - 18} w={2} h={7} c={SHIRT} />
          <Px x={x - 1} y={fy - 18} c={VEST} />
          <PixelRect x={x - 1} y={fy - 13} w={2} h={1} c="#1A1A1A" />
          {/* Wine glass */}
          <PixelRect x={x - 3} y={fy - 16 + sipY} w={3} h={4} c={GLASS} />
          <Px x={x - 2} y={fy - 15 + sipY} c={WINE} />
          <Px x={x - 1} y={fy - 15 + sipY} c={WINE} />
          <Px x={x - 2} y={fy - 12 + sipY} c={GLASS} />
          <Px x={x - 2} y={fy - 11 + sipY} c={GLASS} />
        </G>
      )}
      {peering && (
        <G>
          {/* Left arm also up, both-hands-on-phone pose */}
          <PixelRect x={x - 1} y={fy - 22} w={2} h={6} c={VEST} />
          <PixelRect x={x}     y={fy - 26} w={2} h={2} c={SKIN} />
        </G>
      )}
    </G>
  );
}

// Gold "$" glyph that hovers over VC's head when the check-signing
// window is open. Pulses on/off similar to the cat's heart. Positioned
// via VC's live state so it follows him as he walks.
function OfficeVCReadyIndicator(_props: { t: number }) {
  useTick(50);
  const t = Date.now() / 200;
  const interactions = useGame(selectCompanionInteractions);
  const state = getCompanionState(Date.now(), interactions, "vc");
  if (state !== "ready") return null;
  const s = officeVCState(t);
  const tInt = Math.floor(t);
  const bob = ((tInt >> 1) % 2);
  // Head is roughly at (s.x+3 .. s.x+11, hy .. hy+8). Float the $ 8-10px
  // above the top of the head so it doesn't clip into the hair.
  const gx = s.x + 6;
  const gy = 250 - 30 - 12 - bob;
  const GOLD    = "#F0C060";
  const GOLD_HI = "#FFE38C";
  const GOLD_SH = "#B58840";
  const blink = (tInt >> 2) % 4 < 3; // ~600ms on, ~200ms off
  if (!blink) return null;
  return (
    <G>
      {/* Pixel-art "$" — 3×5 with two horizontal serifs and a vertical stem */}
      <PixelRect x={gx}     y={gy}     w={3} h={1} c={GOLD} />
      <Px        x={gx}     y={gy + 1}           c={GOLD} />
      <PixelRect x={gx}     y={gy + 2} w={3} h={1} c={GOLD_HI} />
      <Px        x={gx + 2} y={gy + 3}           c={GOLD} />
      <PixelRect x={gx}     y={gy + 4} w={3} h={1} c={GOLD_SH} />
      {/* Vertical stem through the center */}
      <PixelRect x={gx + 1} y={gy - 1} w={1} h={7} c={GOLD_HI} />
    </G>
  );
}

// Deep-navy + gold "wine + capital + wisdom" bubble. VC is always on-screen.
function OfficeVCQuip({ t }: { t: number }) {
  const s = officeVCState(Date.now() / 200);
  const cycle = ((t + 108) / 24) % 12;
  if (cycle > 4) return null;
  const idx = Math.floor((t + 108) / 24 / 12) % OFFICE_VC_QUIPS.length;
  const text = OFFICE_VC_QUIPS[idx];
  // Tight side padding — no left glyph, just border + inner margin.
  const { lines, bubbleW } = wrapQuipLines(text, W - 8, 8);
  const rowH = 8;
  const bubbleH = 4 + lines.length * rowH;
  const bubbleX = Math.max(2, Math.min(s.qx - bubbleW / 2, W - bubbleW - 2));
  const bubbleY = Math.max(2, s.qy - (bubbleH + 2));
  return (
    <G>
      {/* Bubble body */}
      <PixelRect x={bubbleX}                 y={bubbleY}              w={bubbleW} h={bubbleH} c="#1F2C48" />
      <PixelRect x={bubbleX}                 y={bubbleY}              w={bubbleW} h={1}       c="#D4A24C" />
      <PixelRect x={bubbleX}                 y={bubbleY + bubbleH - 1} w={bubbleW} h={1}      c="#101828" />
      <PixelRect x={bubbleX}                 y={bubbleY}              w={1}       h={bubbleH} c="#D4A24C" />
      <PixelRect x={bubbleX + bubbleW - 1}   y={bubbleY}              w={1}       h={bubbleH} c="#D4A24C" />
      {/* Tail + wine drop motif */}
      <PixelRect x={s.qx - 1} y={bubbleY + bubbleH} w={3} h={2} c="#1F2C48" />
      <Px x={s.qx} y={bubbleY + bubbleH + 2} c="#1F2C48" />
      <Px x={s.qx} y={bubbleY + bubbleH + 4} c="#C97B3A" />
      {lines.map((line, i) => (
        <SvgText
          key={`ln${i}`}
          x={bubbleX + 4}
          y={bubbleY + 8 + i * rowH}
          fontSize={6}
          fontFamily={fonts.displayRegular}
          fill="#F5EFE2"
        >
          {line}
        </SvgText>
      ))}
    </G>
  );
}

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
      {/* The VC — "just dropping by" in his Patagonia vest with a wine
          glass. Continuously walks the upper floor between x=40 and x=200.
          Drawn BEFORE the desks so monitors/desks occlude him when he
          passes behind (z-order via JSX draw order). */}
      <OfficeVC t={t} />
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
      {/* $-indicator over VC's head when the check-signing window is open,
          drawn ABOVE the desks so it's always visible. */}
      <OfficeVCReadyIndicator t={t} />
      {/* Quip bubble drawn LAST — always above all scene sprites. */}
      <OfficeVCQuip t={t} />
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

// Wry one-liners Spot broadcasts from his internal log — 4th of the
// 8-companion arc. Tone: Boston Dynamics deadpan robot-security-dog.
// Cycle offset +7.5s (180 frames).
const MEGACORP_SPOT_QUIPS = [
  "patrol complete. detected: sadness in cubicle 4.",
  "the humans smile when they see me. sensors indicate stress.",
  "logged: 47,000 steps today. purpose: unknown.",
  "the CEO gave me an OKR. it is 'be more approachable'.",
  "detected coffee spill. filed insurance claim.",
  "my firmware update deleted my sense of humor.",
  "the AI monitor greeted me. i replied 'woof.exe'.",
  "instructed to 'boost morale.' morale unchanged.",
];

interface MegaSpotState {
  x: number;
  facing: 1 | -1;
  scan: boolean;
  heartbeat: boolean;
  step: number;
  scanDx: number;
  qx: number;
  qy: number;
}

// Left↔right patrol at Inspector cadence (t >> 3). Every ~40 frames a
// 4-frame SENSOR SCAN (cluster tilts side-to-side); every ~90 frames a
// STATUS HEARTBEAT flash of the LED. No bob, no wag — pure robotic gait.
function megaSpotState(_t: number, floorY: number): MegaSpotState {
  // 3× speed. Fractional t for smooth position, floored int for on/off
  // beats (scan / heartbeat / step / scanDx).
  const t = _t * 3;
  const tInt = Math.floor(t);
  const x0 = 8;
  const span = 200;
  const phase = (t / 8) % (span * 2);
  const walk = phase < span ? phase : span * 2 - phase;
  const facing: 1 | -1 = phase < span ? 1 : -1;
  const scan = (tInt % 40) >= 36;
  const heartbeat = (tInt % 90) >= 86;
  const stopped = scan;
  const step = (!stopped && (tInt >> 1) % 2) ? 1 : 0;
  const scanDx = scan ? ((tInt % 4) < 2 ? 1 : -1) : 0;
  const xi = Math.floor(x0 + walk);
  const fy = floorY - 2;
  const bodyY = fy - 12;
  return {
    x: xi,
    facing,
    scan,
    heartbeat,
    step,
    scanDx,
    qx: xi + 7,
    qy: bodyY - 6,
  };
}

// Boston Dynamics Spot silhouette — yellow boxy torso + 4 segmented
// mechanical legs (trot gait: diagonal pairs step) + sensor cluster at
// the front (no head) + rear antenna nub (no tail). Silhouette-key: the
// yellow #F0C030 + black joint breaks.
function MegaSpot(_props: { t: number; floorY: number }) {
  useTick(50);
  const t = Date.now() / 200;
  const s = megaSpotState(t, _props.floorY);
  // Alert mode: when the compliance-audit window is open, the sensor LED
  // flips from green to red and pulses faster — Spot has flagged you and
  // is asking permission to escalate. Overrides the normal heartbeat.
  const interactions = useGame(selectCompanionInteractions);
  const alerting = getCompanionState(Date.now(), interactions, "spot") === "ready";
  const F = s.facing;
  const bx = s.x;
  // Feet at floorY+3 — the original -2 offset left Spot's paws hovering
  // 5px above the walking surface, reading as "on the wall."
  const fy = _props.floorY + 3;
  const bodyY = fy - 12;
  const Y = "#F0C030";
  const Y_HI = "#FFE08A";
  const Y_SH = "#C09820";
  const BLK = "#1A1A1A";
  const JOINT = "#D8DCE0";
  const LED_G = "#4CE070";
  const LED_OFF = "#2A4A34";
  const LED_R = "#FF4A3A";
  const LED_R_OFF = "#5A1A14";
  const tInt = Math.floor(t);
  const led = alerting
    ? ((tInt >> 1) % 2 ? LED_R : LED_R_OFF)  // fast red blink when alert
    : s.heartbeat ? Y : (((tInt >> 1) % 4) < 2 ? LED_G : LED_OFF);
  const legX = [bx + 1, bx + 4, bx + 9, bx + 12];
  const legStep = [s.step, 1 - s.step, 1 - s.step, s.step];
  const legs: React.ReactNode[] = [];
  for (let i = 0; i < 4; i++) {
    const lx = legX[i];
    const up = legStep[i] ? 1 : 0;
    legs.push(<PixelRect key={`th${i}`} x={lx} y={fy - 7} w={2} h={3} c={Y} />);
    legs.push(<Px        key={`kn${i}`} x={lx} y={fy - 4} c={BLK} />);
    legs.push(<PixelRect key={`sh${i}`} x={lx} y={fy - 3 - up} w={2} h={3 + up} c={Y_SH} />);
    legs.push(<Px        key={`ft${i}`} x={lx} y={fy - up} c={JOINT} />);
  }
  const frontX = F > 0 ? bx + 13 : bx - 3;
  const rearX  = F > 0 ? bx - 1  : bx + 14;
  return (
    <G>
      {legs}
      {/* Boxy torso — flat top, longer than tall */}
      <PixelRect x={bx}     y={bodyY}     w={14} h={6} c={Y} />
      <PixelRect x={bx}     y={bodyY}     w={14} h={1} c={Y_HI} />
      <PixelRect x={bx}     y={bodyY + 5} w={14} h={1} c={Y_SH} />
      <PixelRect x={bx + 3} y={bodyY + 2} w={8}  h={1} c={Y_SH} />
      <Px x={bx + 1}  y={bodyY + 4} c={JOINT} />
      <Px x={bx + 4}  y={bodyY + 4} c={JOINT} />
      <Px x={bx + 9}  y={bodyY + 4} c={JOINT} />
      <Px x={bx + 12} y={bodyY + 4} c={JOINT} />
      {/* Backpack module */}
      <PixelRect x={bx + 5} y={bodyY - 3} w={5} h={3} c={BLK} />
      <PixelRect x={bx + 5} y={bodyY - 3} w={5} h={1} c="#3A3A3A" />
      <Px x={bx + 7} y={bodyY - 2} c="#5A5A5A" />
      {/* Sensor cluster at the FRONT (no head) — tilts on scan */}
      <PixelRect x={frontX} y={bodyY + 1 + s.scanDx} w={3} h={4} c={BLK} />
      <Px x={frontX + (F > 0 ? 0 : 2)} y={bodyY + 2 + s.scanDx} c="#3A3A3A" />
      <Px x={frontX + (F > 0 ? 0 : 2)} y={bodyY + 3 + s.scanDx} c="#3A3A3A" />
      <Px x={frontX + 1} y={bodyY + 1 + s.scanDx} c={led} />
      {/* Rear antenna nub */}
      <PixelRect x={rearX} y={bodyY} w={1} h={3} c={BLK} />
      <Px x={rearX} y={bodyY - 1} c="#3A3A3A" />
    </G>
  );
}

// Red "!" glyph over Spot's sensor cluster when the compliance-audit
// window is open. Pulses like a real hardware alert light. Positioned
// via his live state so it tracks him as he patrols the floor.
function MegaSpotReadyIndicator({ floorY }: { t: number; floorY: number }) {
  useTick(50);
  const t = Date.now() / 200;
  const interactions = useGame(selectCompanionInteractions);
  if (getCompanionState(Date.now(), interactions, "spot") !== "ready") return null;
  const s = megaSpotState(t, floorY);
  const tInt = Math.floor(t);
  const bob = ((tInt >> 1) % 2);
  const fy = floorY + 3; // matches MegaSpot — see comment there
  const bodyY = fy - 12;
  // Anchor 8-10px above the sensor cluster (which sits at bodyY..bodyY+4).
  const frontX = s.facing > 0 ? s.x + 13 : s.x - 3;
  const gx = frontX;
  const gy = bodyY - 10 - bob;
  const RED    = "#FF4A3A";
  const RED_HI = "#FF8874";
  const RED_SH = "#8A2018";
  const blink = (tInt >> 1) % 3 !== 0; // fast alert-light pulse
  if (!blink) return null;
  return (
    <G>
      {/* Vertical stroke */}
      <PixelRect x={gx + 1} y={gy}     w={1} h={4} c={RED} />
      <Px        x={gx}     y={gy}     c={RED_HI} />
      <Px        x={gx + 2} y={gy}     c={RED_SH} />
      <Px        x={gx}     y={gy + 3} c={RED_HI} />
      <Px        x={gx + 2} y={gy + 3} c={RED_SH} />
      {/* Dot below */}
      <PixelRect x={gx + 1} y={gy + 5} w={1} h={1} c={RED} />
    </G>
  );
}

// "Robot terminal HUD" bubble — deep navy-black fill + yellow border +
// terminal-green text. Circuit-trace motif at the tail (2 pixel-thin
// traces going down). Cycle offset +7.5s.
function MegaSpotQuip({ t, floorY }: { t: number; floorY: number }) {
  const s = megaSpotState(Date.now() / 200, floorY);
  const cycle = ((t + 180) / 24) % 12;
  if (cycle > 4) return null;
  const idx = Math.floor((t + 180) / 24 / 12) % MEGACORP_SPOT_QUIPS.length;
  const text = MEGACORP_SPOT_QUIPS[idx];
  // LED glyph eats ~9px of left padding + 2px right margin.
  const { lines, bubbleW } = wrapQuipLines(text, W - 8, 14);
  const rowH = 8;
  const bubbleH = 4 + lines.length * rowH;
  const bubbleX = Math.max(2, Math.min(s.qx - bubbleW / 2, W - bubbleW - 2));
  const bubbleY = Math.max(2, s.qy - (bubbleH + 2));
  return (
    <G>
      {/* Bubble body */}
      <PixelRect x={bubbleX}                 y={bubbleY}              w={bubbleW} h={bubbleH} c="#0A0E14" />
      <PixelRect x={bubbleX}                 y={bubbleY}              w={bubbleW} h={1}       c="#F0C030" />
      <PixelRect x={bubbleX}                 y={bubbleY + bubbleH - 1} w={bubbleW} h={1}      c="#8A6E14" />
      <PixelRect x={bubbleX}                 y={bubbleY}              w={1}       h={bubbleH} c="#F0C030" />
      <PixelRect x={bubbleX + bubbleW - 1}   y={bubbleY}              w={1}       h={bubbleH} c="#F0C030" />
      {/* Tail + circuit-trace motif (2 thin traces down) */}
      <PixelRect x={s.qx - 1} y={bubbleY + bubbleH} w={3} h={2} c="#0A0E14" />
      <Px x={s.qx - 1} y={bubbleY + bubbleH + 2} c="#7EE0A0" />
      <Px x={s.qx + 1} y={bubbleY + bubbleH + 2} c="#7EE0A0" />
      {/* Tiny sensor/LED glyph at top-left */}
      <PixelRect x={bubbleX + 3} y={bubbleY + 4} w={3} h={3} c="#1A1A1A" />
      <Px x={bubbleX + 4} y={bubbleY + 5} c="#4CE070" />
      {lines.map((line, i) => (
        <SvgText
          key={`ln${i}`}
          x={bubbleX + 9}
          y={bubbleY + 8 + i * rowH}
          fontSize={6}
          fontFamily={fonts.displayRegular}
          fill="#7EE0A0"
        >
          {line}
        </SvgText>
      ))}
    </G>
  );
}

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

  // Glass partition wall (window into another office). Render order:
  //   1. Glass pane background
  //   2. City skyline + stars + clouds (CONTENT through the glass)
  //   3. Frame edges (top/bottom/left/right) + central mullion ON TOP
  // The earlier ordering had the skyline drawn after the mullion, which made
  // the mullion disappear behind tall buildings; and the loop ran one column
  // past the right frame so the city leaked outside the window.
  R(12, 70, 100, 90, CORP.glass);
  // Distant city skyline through glass — clamped to x:13..x:110 so it stays
  // strictly inside the frame's left/right edges.
  const sky = [10,18,8,22,14,28,11,20,8,16,25,18,12,22,10,20,8,18,14,25,16,10,20,18,12,22,10,16,25,12];
  for (let i = 0; i < 98; i++) {
    const h = sky[i % 30];
    R(13 + i, 158 - h, 1, h, CORP.wallSh);
  }
  for (let i = 0; i < 20; i++) PX(16 + i * 5, 154 - (i % 4) * 3, CORP.bulb);
  for (let i = 0; i < 5; i++) R(20 + i * 18, 75 + i * 4, 4, 1, CORP.white);

  // ─── Air traffic through the window (planes, helicopter, drone) ────
  // Ported from Claude Design v13 megacorp scene. Wrapped in an SVG
  // clipPath below (see JSX return) that masks anything past the glass
  // frame interior — without it, both airliner and helicopter drift
  // past the right/left edges and appear to fly on the office wall.
  //
  // Airliner — slow left→right cruise (nose leads right), high altitude,
  // with a 13-segment fading contrail streaming behind (to the left).
  // Beacon at nose blinks red.
  const airEls: React.ReactNode[] = [];
  let ak = 0;
  const airKey = () => `mca${ak++}`;
  const airR = (x: number, y: number, w: number, h: number, c: string) =>
    airEls.push(<PixelRect key={airKey()} x={x} y={y} w={w} h={h} c={c} />);
  const airPX = (x: number, y: number, c: string) =>
    airEls.push(<Px key={airKey()} x={x} y={y} c={c} />);
  {
    const ax = 13 + (((t * 0.35) % 150) - 24);
    const ay = 100;
    for (let i = 1; i < 14; i++) {
      const alpha = 0.5 - i * 0.03;
      if (alpha > 0.02) {
        airEls.push(
          <Rect key={airKey()} x={Math.floor(ax - i * 2)} y={ay}
            width={2} height={1} fill="#EEF2F6" opacity={alpha} />
        );
      }
    }
    airR(Math.floor(ax),     ay - 1, 7, 2, "#C8CED6");   // fuselage
    airR(Math.floor(ax) + 7, ay - 1, 2, 1, CORP.wallSh); // nose taper
    airR(Math.floor(ax) + 2, ay + 1, 2, 1, CORP.wallSh); // wing
    airR(Math.floor(ax) + 1, ay - 2, 1, 1, CORP.wallSh); // tail fin
    airPX(Math.floor(ax) + 3, ay + 1, "#7C8088");        // engine
    airPX(Math.floor(ax) + 6, ay, (t >> 2) % 4 < 2 ? "#E85A4C" : "#7C3A34"); // beacon
  }
  // Helicopter — right→left (nose leads left), lower, with a spinning rotor
  // that flickers between full-span blur and short blur to read as motion.
  {
    const hx = 13 + (130 - ((t * 0.6) % 160));
    const hy = 128;
    const spin = (t % 4) < 2;
    if (spin) airR(Math.floor(hx) - 3, hy - 3, 11, 1, "#5C6068"); // full rotor blur
    else      airR(Math.floor(hx) + 1, hy - 3,  3, 1, "#5C6068"); // short rotor blur
    airR(Math.floor(hx) + 2, hy - 3, 1, 2, "#5C6068"); // rotor mast
    airR(Math.floor(hx),     hy - 1, 6, 3, "#3A4656"); // cabin body
    airR(Math.floor(hx),     hy - 1, 6, 1, "#5A6A7E"); // canopy highlight
    airR(Math.floor(hx) + 6, hy,     3, 1, "#3A4656"); // tail boom
    airPX(Math.floor(hx) + 8, hy - 1, "#3A4656");      // tail rotor
    airPX(Math.floor(hx) - 1, hy, (t >> 1) % 4 < 2 ? "#7EE0FF" : "#2A5A6A"); // nose nav light
  }
  // Tiny distant drone/quadcopter bobbing (ambient motion, no clear
  // trajectory — reads as hovering surveillance).
  {
    const dx = 13 + 66 + Math.round(Math.sin(t / 30) * 9);
    const dy = 112 + Math.round(Math.sin(t / 17) * 4);
    airR(dx, dy, 3, 1, CORP.dark);                     // body
    airPX(dx - 1, dy - 1, CORP.wallSh);                // left rotor
    airPX(dx + 3, dy - 1, CORP.wallSh);                // right rotor
    airPX(dx + 1, dy + 1, (t >> 2) % 3 === 0 ? "#E85A4C" : "#5A2A26"); // underside LED
  }

  // Frame on top of skyline (and air traffic) so it cleanly contains
  // the city silhouette and clips anything sneaking past the edges.
  R(12, 70, 100, 1, CORP.dark);   // top edge
  R(12, 159, 100, 1, CORP.dark);  // bottom edge
  R(12, 70, 1, 90, CORP.dark);    // left edge
  R(111, 70, 1, 90, CORP.dark);   // right edge
  R(61, 70, 2, 90, CORP.dark);    // central mullion

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
      {/* Air traffic clipped to the window frame interior — planes and
          the heli were flying past the right/left edges and appearing
          to circle the office wall. ClipPath is defined inline so this
          scene stays self-contained. */}
      <Defs>
        <ClipPath id="megaSky">
          <Rect x={13} y={71} width={98} height={88} />
        </ClipPath>
      </Defs>
      <G clipPath="url(#megaSky)">{airEls}</G>
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

      <FloatingTokens spawnX={110} spawnY={236} t={t} />
      {/* Boston Dynamics Spot — yellow robot dog patrolling the office
          floor. 4th of the 8-companion arc. Quip drawn LAST above all
          scene sprites. */}
      <MegaSpot t={t} floorY={FLOOR_Y} />
      {/* Red "!" over Spot's sensor cluster when the compliance-audit
          window is open. Drawn above everything else so it's always
          visible over the mainframes / bench. */}
      <MegaSpotReadyIndicator t={t} floorY={FLOOR_Y} />
      <MegaSpotQuip t={t} floorY={FLOOR_Y} />
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

// Wry one-liners the Bartender cycles through — Campus mirror of the
// Datacenter Inspector, with bar/hospitality flavor. Offset by 6 (half
// the ~12s cycle) inside the quip renderer so the two characters don't
// mutter in sync when the player has both scenes visible in one session.
const CAMPUS_BARTENDER_QUIPS = [
  "the CEO ordered oat milk. the CEO is a model now.",
  "the intern's martini evaporated. so did the intern.",
  "the AI ordered 'surprise me.' i poured it a null.",
  "founder asked what year it is. i said 'yes.'",
  "someone paid in equity. the plants said thanks.",
  "sober october is a cost center. HR shut it down.",
  "board offsite ordered 'the strongest thing.' i gave them coffee.",
  "no one at the bar. peaceful. bots tip better.",
];

// Bar geometry constants shared by Bartender + BartenderQuip so both
// derive the exact same walking position from `t` without threading it
// through props.
const BAR_CBX = 158;
const BAR_CBW = 80;

// Bartender sprite + counter re-draw (concealment) — the campus mirror of
// the datacenter Inspector. Walks left↔right behind the open bar, hair,
// dark leather apron over cream shirt, alternating cocktail-shaker /
// polished-lowball frames. Backlit by the amber shelf-glow behind him.
//
// Legs are drawn full-length then the counter top + front are re-drawn
// on top so the lower body reads as concealed behind the bar (matches
// the canvas design's imperative overdraw pattern).
// Bartender drink-slide event state (design port). PERIOD ≈ 22.5s between
// pours at the 24fps design frame rate, translated here to our scaled t
// where the state function receives the same effective 3× cadence used
// by Bartender's walk. `launching` = 0.5s arm-shove freeze at the start;
// after that the drink slides for ~2s across the counter.
interface BartenderDrinkSlideState {
  active: boolean;
  launching: boolean;
  p: number;         // 0..1 slide progress
  facing: 1 | -1;
  cycle: number;     // which pour this is (for reward-once bookkeeping)
}
const BARTENDER_DRINK_PERIOD = 540;
const BARTENDER_DRINK_LAUNCH = 12;
const BARTENDER_DRINK_SLIDE  = 48;
function bartenderDrinkSlideState(t: number): BartenderDrinkSlideState {
  const phase = t % BARTENDER_DRINK_PERIOD;
  const cycle = Math.floor(t / BARTENDER_DRINK_PERIOD);
  const facing: 1 | -1 = (cycle % 2) ? -1 : 1;
  if (phase < BARTENDER_DRINK_LAUNCH)
    return { active: true, launching: true, p: 0, facing, cycle };
  if (phase < BARTENDER_DRINK_LAUNCH + BARTENDER_DRINK_SLIDE)
    return {
      active: true, launching: false,
      p: (phase - BARTENDER_DRINK_LAUNCH) / BARTENDER_DRINK_SLIDE,
      facing, cycle,
    };
  return { active: false, launching: false, p: 0, facing, cycle };
}

function Bartender(_props: { t: number }) {
  // 20fps smooth tick + fractional t for continuous walking motion.
  // Toggles (bob / stride) still use floored int for defined on/off flip.
  useTick(50);
  const t = (Date.now() / 200) * 3;
  const tInt = Math.floor(t);
  const drink = bartenderDrinkSlideState(tInt);
  const push = drink.active && drink.launching;
  const cbX = BAR_CBX;
  const cbW = BAR_CBW;
  const FLOOR_Y = 250;
  const span = cbW - 24;
  const phase = (t / 8) % (span * 2);
  const walk = phase < span ? phase : span * 2 - phase;
  const bob = ((tInt >> 2) % 2) ? 0 : 1;
  const bx = cbX + 8 + walk;
  const by = 176 + bob;
  const stride = (tInt >> 2) % 2;
  const slats: React.ReactNode[] = [];
  for (let sx = cbX + 3; sx < cbX + cbW - 2; sx += 7) {
    slats.push(<PixelRect key={`bsl${sx}`} x={sx} y={204} w={1} h={FLOOR_Y - 206} c={CAMP.barSlat} />);
  }
  return (
    <G>
      {/* Amber backlight wash from the backlit shelves */}
      <Rect x={bx - 2} y={by} width={16} height={40} fill="#EBBE6E" opacity={0.10} />
      {/* Legs (dark trousers, alternating stride — concealed by counter below) */}
      <PixelRect x={bx + 2} y={by + 24} w={3} h={14} c="#2A2A2E" />
      <PixelRect x={bx + 6} y={by + 24} w={3} h={14} c="#2A2A2E" />
      {/* Cream long-sleeve shirt torso */}
      <PixelRect x={bx + 1} y={by + 12} w={10} h={13} c="#F0EAD8" />
      <PixelRect x={bx + 1} y={by + 12} w={10} h={1} c="#FBF7EC" />
      {/* Dark leather apron */}
      <PixelRect x={bx + 2} y={by + 15} w={8} h={12} c="#26221E" />
      <PixelRect x={bx + 2} y={by + 15} w={8} h={1} c="#3A342C" />
      <PixelRect x={bx + 4} y={by + 13} w={4} h={2} c="#26221E" />
      <Px x={bx + 3} y={by + 15} c="#6E5A3A" />
      <Px x={bx + 8} y={by + 15} c="#6E5A3A" />
      {/* GPU-chip pin badge on apron chest */}
      <PixelRect x={bx + 5} y={by + 18} w={2} h={2} c="#7EE0A0" />
      <Px x={bx + 5} y={by + 18} c="#3F8A6A" />
      {/* Upper sleeves (rolled to elbow — cream) */}
      <PixelRect x={bx} y={by + 13} w={2} h={5} c="#F0EAD8" />
      <PixelRect x={bx + 10} y={by + 13} w={2} h={5} c="#F0EAD8" />
      {/* Alternate: cocktail shaker vs. lowball-with-towel */}
      {stride ? (
        <>
          <PixelRect x={bx + 1} y={by + 17} w={3} h={3} c="#D8DAE0" />
          <PixelRect x={bx + 8} y={by + 17} w={3} h={3} c="#D8DAE0" />
          <PixelRect x={bx + 4} y={by + 15} w={4} h={8} c="#B8BCC4" />
          <PixelRect x={bx + 4} y={by + 15} w={4} h={1} c="#EFF1F5" />
          <PixelRect x={bx + 4} y={by + 14} w={4} h={1} c="#9CA0A8" />
          <Px x={bx + 5} y={by + 17} c="#FFFFFF" />
        </>
      ) : (
        <>
          <PixelRect x={bx + 1} y={by + 18} w={3} h={2} c="#D8A878" />
          <PixelRect x={bx + 8} y={by + 18} w={3} h={2} c="#D8A878" />
          <PixelRect x={bx + 4} y={by + 17} w={4} h={5} c="#BFE3EC" />
          <PixelRect x={bx + 4} y={by + 17} w={4} h={1} c="#E8F6FA" />
          <PixelRect x={bx + 3} y={by + 18} w={6} h={3} c="#FBF7EC" />
        </>
      )}
      {/* Small towel draped over left shoulder */}
      <PixelRect x={bx} y={by + 11} w={3} h={5} c="#EDE7D6" />
      <PixelRect x={bx} y={by + 11} w={3} h={1} c="#FBF7EC" />
      {/* Drink-launch pose: extended palm-up arm shoving a drink down the bar */}
      {push && (
        <G>
          <PixelRect x={bx + 10} y={by + 16} w={4} h={2} c="#F0EAD8" />
          <Px x={bx + 13} y={by + 15} c="#F0EAD8" />
          <PixelRect x={bx + 13} y={by + 17} w={2} h={2} c="#D8A878" />
        </G>
      )}
      {/* Neck + head */}
      <PixelRect x={bx + 4} y={by + 10} w={3} h={2} c="#C8986A" />
      <PixelRect x={bx + 3} y={by + 3} w={6} h={8} c="#E0B088" />
      <PixelRect x={bx + 3} y={by + 3} w={6} h={1} c="#EAC098" />
      <Px x={bx + 4} y={by + 6} c="#2A2A2A" />
      <Px x={bx + 7} y={by + 6} c="#2A2A2A" />
      <Px x={bx + 5} y={by + 8} c="#B98A5E" />
      {/* Short hair tuft */}
      <PixelRect x={bx + 3} y={by + 2} w={6} h={2} c="#3A2A1E" />
      <PixelRect x={bx + 2} y={by + 3} w={1} h={3} c="#3A2A1E" />
      <Px x={bx + 8} y={by + 3} c="#4A3524" />

      {/* Concealment redraw of counter top + front over the lower body */}
      <PixelRect x={cbX} y={196} w={cbW} h={6} c={CAMP.barTop} />
      <PixelRect x={cbX} y={196} w={cbW} h={1} c={CAMP.barTopHi} />
      <PixelRect x={cbX} y={197} w={cbW} h={1} c={CAMP.barTopGlow} />
      <PixelRect x={cbX} y={202} w={cbW} h={FLOOR_Y - 202} c={CAMP.barFront} />
      {slats}
      <PixelRect x={cbX} y={FLOOR_Y - 6} w={cbW} h={1} c={CAMP.brass} />
    </G>
  );
}

// Cocktail glass sprite (5×7 V-shape martini with amber liquid + olive on
// skewer + oak coaster). Design port — matches drawCocktailGlass in the
// pixel-art.jsx reference.
function CocktailGlass({ x, y }: { x: number; y: number }) {
  return (
    <G>
      <PixelRect x={x - 1} y={y}     w={6} h={1} c="#3A2418" />
      <Px        x={x - 1} y={y}                   c="#4E3220" />
      <PixelRect x={x + 1} y={y - 1} w={3} h={1} c="#C8C4BC" />
      <Px        x={x + 2} y={y - 2}               c="#D8D4CC" />
      <Px        x={x + 2} y={y - 3}               c="#D8D4CC" />
      <PixelRect x={x}     y={y - 6} w={5} h={1} c="#E4E0D8" />
      <Px        x={x + 1} y={y - 5}               c="#E4E0D8" />
      <Px        x={x + 3} y={y - 5}               c="#E4E0D8" />
      <Px        x={x + 2} y={y - 5}               c="#D48844" />
      <Px        x={x + 1} y={y - 4}               c="#E4E0D8" />
      <Px        x={x + 3} y={y - 4}               c="#E4E0D8" />
      <Px        x={x + 2} y={y - 4}               c="#C87838" />
      <Px        x={x + 2} y={y - 3}               c="#E4E0D8" />
      <Px        x={x + 4} y={y - 7}               c="#7E9A85" />
      <Px        x={x + 4} y={y - 6}               c="#D4A24C" />
    </G>
  );
}

// 3 short amber speed lines behind the sliding drink (opacity ramps down
// further from the glass). Direction depends on facing (1 = drink flying
// right → lines trail left; -1 = drink flying left → lines trail right).
function CocktailSpeedLines({
  x, y, facing,
}: { x: number; y: number; facing: 1 | -1 }) {
  return (
    <G>
      {[0, 1, 2].map((i) => {
        const alpha = 0.45 - i * 0.13;
        const lx = x - facing * (5 + i * 3);
        return (
          <Rect
            key={`csl${i}`}
            x={facing > 0 ? lx : lx - 1}
            y={y - 3 - i}
            width={2}
            height={1}
            fill="#EBBE6E"
            opacity={alpha}
          />
        );
      })}
    </G>
  );
}

// The drink-slide event sprite — freeze at launch point during the
// bartender's palm-shove, then glide across the bar top. Rendered inside
// CampusScene right after the Bartender so it draws over the counter
// concealment redraw. Splash foam at launch is 3 tiny cream pixels.
function BartenderDrinkSprite(_props: { t: number }) {
  useTick(50);
  const t = Math.floor((Date.now() / 200) * 3);
  const drink = bartenderDrinkSlideState(t);
  if (!drink.active) return null;
  const x0 = BAR_CBX + 12;
  const x1 = BAR_CBX + BAR_CBW - 12;
  const dy = 196;
  const dx = drink.launching
    ? (drink.facing > 0 ? x0 : x1)
    : (drink.facing > 0 ? x0 + (x1 - x0) * drink.p : x1 - (x1 - x0) * drink.p) | 0;
  return (
    <G>
      {!drink.launching && (
        <CocktailSpeedLines x={dx} y={dy} facing={drink.facing} />
      )}
      <CocktailGlass x={dx} y={dy} />
      {drink.launching && (() => {
        const sx = drink.facing > 0 ? x0 : x1;
        const f = drink.facing;
        return (
          <G>
            <Px x={sx}     y={193} c="#FFFFFF" />
            <Px x={sx + f} y={192} c="#F0EAD8" />
            <Px x={sx - f} y={194} c="#FFFFFF" />
          </G>
        );
      })()}
    </G>
  );
}

// Wry-quip speech bubble anchored above the Bartender's head. Warm cream
// fill + amber border (vs. the Inspector's cyan-on-navy) so the two
// characters read as distinct. Offset the cycle by 6 so bartender and
// inspector don't mutter simultaneously on scene-switch previews.
function BartenderQuip({ t: _t }: { t: number }) {
  // Anchor bubble to Bartender's SMOOTH position (fractional t at 3× scale)
  // so the tail doesn't teleport between scene ticks. Quip cycle timing
  // uses the parent-passed integer t below.
  const t = (Date.now() / 200) * 3;
  const tInt = Math.floor(t);
  const cbX = BAR_CBX;
  const cbW = BAR_CBW;
  const span = cbW - 24;
  const phase = (t / 8) % (span * 2);
  const walk = phase < span ? phase : span * 2 - phase;
  const bob = ((tInt >> 2) % 2) ? 0 : 1;
  const bx = cbX + 8 + walk;
  const by = 176 + bob;
  const qx = bx + 6;
  const qy = by + 1;

  // Quip cadence uses the ORIGINAL tick so we don't spam the bubble 3× faster.
  const cycle = ((_t / 24) + 6) % 12;
  if (cycle > 4) return null;
  const idx = Math.floor(((_t / 24) + 6) / 12) % CAMPUS_BARTENDER_QUIPS.length;
  const text = CAMPUS_BARTENDER_QUIPS[idx];
  const { lines, bubbleW } = wrapQuipLines(text, W - 8, 8);
  const rowH = 8;
  const bubbleH = 4 + lines.length * rowH;
  const bubbleX = Math.max(2, Math.min(qx - bubbleW / 2, W - bubbleW - 2));
  const bubbleY = Math.max(2, qy - (bubbleH + 2));
  return (
    <G>
      {/* Bubble body */}
      <PixelRect x={bubbleX}                 y={bubbleY}              w={bubbleW} h={bubbleH} c="#F5EFE2" />
      <PixelRect x={bubbleX}                 y={bubbleY}              w={bubbleW} h={1}       c="#EBBE6E" />
      <PixelRect x={bubbleX}                 y={bubbleY + bubbleH - 1} w={bubbleW} h={1}      c="#C89868" />
      <PixelRect x={bubbleX}                 y={bubbleY}              w={1}       h={bubbleH} c="#EBBE6E" />
      <PixelRect x={bubbleX + bubbleW - 1}   y={bubbleY}              w={1}       h={bubbleH} c="#C89868" />
      {/* Tail pointing down at bartender's head */}
      <PixelRect x={qx - 1} y={bubbleY + bubbleH} w={3} h={2} c="#F5EFE2" />
      <Px x={qx} y={bubbleY + bubbleH + 2} c="#EBBE6E" />
      {lines.map((line, i) => (
        <SvgText
          key={`ln${i}`}
          x={bubbleX + 4}
          y={bubbleY + 8 + i * rowH}
          fontSize={6}
          fontFamily={fonts.displayRegular}
          fill="#2A2A2A"
        >
          {line}
        </SvgText>
      ))}
    </G>
  );
}

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
      {/* Bartender behind the open bar — sprite + counter concealment
          redraw, so his lower body reads as hidden behind the counter.
          Placed BEFORE the gallery/tree sprites so those sit visually
          in front of him if they overlap; his quip bubble is drawn
          LAST (below) so it sits on top of everything. */}
      <Bartender t={t} />
      {/* Bartender's drink-slide event — glass slides across the bar top
          right after his palm-shove freeze. Drawn AFTER the counter
          concealment redraw (which lives inside Bartender) so it sits
          on top of the wood and reads as ON the bar. */}
      <BartenderDrinkSprite t={t} />
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
      {/* Bartender's speech bubble — LAST so it sits above every scene
          sprite (gallery, trees, tokens, etc). Same pattern as the
          Inspector's bubble in DatacenterScene. */}
      <BartenderQuip t={t} />
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
// Training-console mainframe (Datacenter TRAINING RUN — replaces the old
// slot-machine visual on the front row's middle cabinet). Same dark chassis
// as `Mainframe`, but with a cyan trim, a small "TRAINING RUN" header, a
// live 3-layer neural network on the main screen (signals pulse left→right),
// a slim epoch progress bar along the base, and a right-flank column of
// GPU-utilization LEDs. Reads unambiguously as a training run, not casino.
function TrainingMainframe({ x, y, w, h, t }: { x: number; y: number; w: number; h: number; t: number }) {
  const els: React.ReactNode[] = [];
  let k = 0;
  const key = () => `tmf${k++}`;
  const R = (xx: number, yy: number, ww: number, hh: number, c: string) =>
    els.push(<PixelRect key={key()} x={xx} y={yy} w={ww} h={hh} c={c} />);
  const PXp = (xx: number, yy: number, c: string) =>
    els.push(<Px key={key()} x={xx} y={yy} c={c} />);
  const A = (xx: number, yy: number, ww: number, hh: number, c: string, op: number) =>
    els.push(<Rect key={key()} x={xx} y={yy} width={ww} height={hh} fill={c} opacity={op} />);

  // Cabinet body (same dark chassis as Mainframe)
  R(x, y, w, h, "#0C0E11");
  R(x, y, w, 2, "#23272D");
  R(x, y, 2, h, "#1A1E24");
  R(x + w - 2, y, 2, h, "#060708");
  R(x, y + h - 1, w, 1, "#060708");

  // Cyan status trim framing the face (compute, not casino)
  R(x + 2, y + 2, w - 4, 1, "#16C4E0");
  R(x + 2, y + h - 3, w - 4, 1, "#0E8AA0");
  R(x + 2, y + 2, 1, h - 4, "#16C4E0");
  R(x + w - 3, y + 2, 1, h - 4, "#0A5A6A");

  // Header bar with "TRAINING RUN" label + live status dot
  const mY = y + 4;
  R(x + 4, mY, w - 8, 9, "#0A1A22");
  R(x + 4, mY, w - 8, 1, "#16323A");
  PXp(x + 8, mY + 4, (t >> 3) % 2 ? "#7EE0A0" : "#2A5A3A");

  // Main screen (neural network shows behind it)
  const sX = x + 5, sY = y + 13, sW = w - 10, sH = h - 17;
  R(sX - 1, sY - 1, sW + 2, sH + 2, "#000000");
  R(sX, sY, sW, sH, "#06121A");

  // 3-layer neural network. Node columns evenly spaced across sW.
  const layers: number[][] = [
    [sY + 6, sY + 15, sY + 24],
    [sY + 4, sY + 12, sY + 20, sY + 28],
    [sY + 10, sY + 20],
  ];
  const colX = [sX + 6, sX + Math.round(sW / 2), sX + sW - 6];

  // Edges — drawn as stepped pixel lines; light up on a traveling wave.
  for (let L = 0; L < 2; L++) {
    const from = layers[L];
    const to = layers[L + 1];
    for (let a = 0; a < from.length; a++) {
      for (let b = 0; b < to.length; b++) {
        const x0 = colX[L], y0 = from[a];
        const x1 = colX[L + 1], y1 = to[b];
        const wave = (t >> 1) % 24;
        const active = L === 0 ? wave < 12 : wave >= 12;
        const on = active && ((a + b + (t >> 2)) % 3 === 0);
        const col = on ? "#16C4E0" : "#0C3038";
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let s = 0; s <= steps; s += 2) {
          const px2 = Math.floor(x0 + (x1 - x0) * (s / steps));
          const py2 = Math.floor(y0 + (y1 - y0) * (s / steps));
          els.push(<Px key={`ne${L}-${a}-${b}-${s}`} x={px2} y={py2} c={col} />);
        }
      }
    }
  }
  // Nodes over the edges — output layer (2 nodes) in gold, others green.
  for (let L = 0; L < 3; L++) {
    for (let n = 0; n < layers[L].length; n++) {
      const nx2 = colX[L], ny2 = layers[L][n];
      const lit = ((n + L + (t >> 2)) % 4) === 0;
      const base = L === 2 ? "#E8B24C" : "#7EE0A0";
      R(nx2 - 2, ny2 - 2, 4, 4, lit ? "#FFF3C8" : base);
      R(nx2 - 1, ny2 - 1, 2, 2, "#06121A");
    }
  }

  // Slim epoch progress bar along the base — fills, resets on loop.
  const pbY = y + h - 4;
  R(sX, pbY, sW, 3, "#0A1418");
  R(sX, pbY, sW, 1, "#16323A");
  const prog = (t % 200) / 200;
  R(sX + 1, pbY + 1, Math.max(0, Math.floor((sW - 2) * prog)), 1, "#7EE0A0");

  // Right-flank GPU-utilization LED column
  const lX = x + w - 1;
  R(lX, sY, 2, sH, "#0A0C0E");
  for (let i = 0; i < 6; i++) {
    const on = ((t >> 1) + i * 2) % 12 < 8;
    const c = on ? (i > 4 ? "#E8B24C" : "#7EE0A0") : "#1A2A20";
    PXp(lX, sY + 2 + i * 4, c);
  }

  // Floor reflection (cool cyan pooling)
  A(x - 2, y + h, w + 4, 6, "#16C4E0", 0.12);
  R(x - 1, y + h, w + 2, 1, "#0A0C0E");

  return (
    <G>
      {els}
      <SvgText
        x={x + w / 2}
        y={mY + 7}
        fontSize={5}
        fontFamily={fonts.displayRegular}
        fill="#7EE0FF"
        textAnchor="middle"
      >
        TRAINING RUN
      </SvgText>
    </G>
  );
}

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
function Inspector({ cwY, t: _propT }: { cwY: number; t: number }) {
  // Own 20fps smooth tick so the walk interpolates between scene ticks.
  // Position (figX) uses fractional t; stride / quip cycle use floored int.
  useTick(50);
  const t = Date.now() / 200;
  const tInt = Math.floor(t);
  const figX = 16 + ((t / 8) % (W - 40));
  const stride = (tInt >> 2) % 2;
  const ix = Math.floor(figX), iy = cwY - 30;

  const cyclePhase = tInt % 60;
  const showQuip = cyclePhase < 20;
  const quipIdx = Math.floor(tInt / 60) % INSPECTOR_QUIPS.length;
  const quip = INSPECTOR_QUIPS[quipIdx];

  // Bubble geometry — Silkscreen 6px renders ~4px wide per char; pad +10.
  const bubbleW = Math.min(W - 8, quip.length * 4 + 10);
  const bubbleH = 14;
  // Top of helmet for tail anchor — bubble sits ABOVE the head.
  const headTopY = iy + 5;
  const tailY = headTopY - 4;
  const bubbleY = tailY - bubbleH;
  const bubbleAnchorX = ix + 4; // tail points at helmet crest
  const bubbleX = Math.max(2, Math.min(bubbleAnchorX - Math.floor(bubbleW / 2), W - bubbleW - 2));

  return (
    <G>
      {/* Soft amber light cone — cast down from the inspector onto the
          mainframes. Drawn first so the figure sits on top. */}
      <Rect x={ix + 2} y={iy + 30} width={16} height={H - (iy + 30)} fill="#EBBE6E" opacity={0.07} />

      {/* Legs — dark trousers, alternating stride */}
      <PixelRect x={ix + 2} y={iy + 22} w={3} h={8} c="#1A1F26" />
      <PixelRect x={ix + 6} y={iy + 22} w={3} h={8} c="#1A1F26" />
      <PixelRect x={ix + (stride ? 1 : 2)} y={iy + 29} w={4} h={1} c="#0A0C0E" />
      <PixelRect x={ix + (stride ? 7 : 6)} y={iy + 29} w={4} h={1} c="#0A0C0E" />

      {/* Hi-vis vest torso */}
      <PixelRect x={ix + 1} y={iy + 12} w={9} h={11} c="#E8A024" />
      <PixelRect x={ix + 1} y={iy + 12} w={9} h={1}  c="#F4C24C" />
      <PixelRect x={ix + 2} y={iy + 13} w={2} h={9}  c="#3A4048" />
      <PixelRect x={ix + 7} y={iy + 13} w={2} h={9}  c="#3A4048" />
      <PixelRect x={ix + 1} y={iy + 16} w={9} h={1}  c="#F4F4F4" />
      <PixelRect x={ix + 1} y={iy + 19} w={9} h={1}  c="#F4F4F4" />

      {/* Arms — back arm + front upper arm + skin forearm */}
      <PixelRect x={ix - 1}  y={iy + 13} w={2} h={7} c="#E8A024" />
      <PixelRect x={ix + 10} y={iy + 13} w={2} h={5} c="#E8A024" />
      <PixelRect x={ix + 11} y={iy + 17} w={3} h={2} c="#D8A878" />

      {/* Clipboard the inspector studies */}
      <PixelRect x={ix + 13} y={iy + 15} w={5} h={6} c="#C9B68A" />
      <PixelRect x={ix + 13} y={iy + 15} w={5} h={1} c="#7C6A44" />
      <Px x={ix + 14} y={iy + 17} c="#3A4048" />
      <Px x={ix + 16} y={iy + 17} c="#3A4048" />
      <Px x={ix + 14} y={iy + 19} c="#3A4048" />

      {/* Neck + head (skin) */}
      <PixelRect x={ix + 3} y={iy + 9}  w={5} h={4} c="#D8A878" />
      <PixelRect x={ix + 4} y={iy + 11} w={3} h={1} c="#B98A5E" />
      <PixelRect x={ix + 4} y={iy + 12} w={3} h={1} c="#C8986A" />

      {/* Hardhat — dome + highlight + brim + crest */}
      <PixelRect x={ix + 2} y={iy + 6} w={7} h={3} c="#F0C030" />
      <PixelRect x={ix + 2} y={iy + 6} w={7} h={1} c="#FCE070" />
      <PixelRect x={ix + 1} y={iy + 9} w={9} h={1} c="#D8A820" />
      <Px x={ix + 5} y={iy + 5} c="#FCE070" />

      {/* Scanner/flashlight pixel from the clipboard hand */}
      <Px x={ix + 18} y={iy + 17} c={(t >> 2) % 4 < 2 ? "#D45A68" : "#3A1A1E"} />

      {/* Speech bubble — terminal-style cyan border, tail pointing at the head */}
      {showQuip && (
        <G>
          <PixelRect x={bubbleX} y={bubbleY} w={bubbleW} h={bubbleH} c="#0E1216" />
          <PixelRect x={bubbleX} y={bubbleY} w={bubbleW} h={1} c="#16A6C4" />
          <PixelRect x={bubbleX} y={bubbleY + bubbleH - 1} w={bubbleW} h={1} c="#0A0C0E" />
          <PixelRect x={bubbleX} y={bubbleY} w={1} h={bubbleH} c="#16A6C4" />
          <PixelRect x={bubbleX + bubbleW - 1} y={bubbleY} w={1} h={bubbleH} c="#0A0C0E" />
          {/* Tail pointing down to the inspector's helmet */}
          <PixelRect x={bubbleAnchorX - 1} y={bubbleY + bubbleH} w={3} h={2} c="#0E1216" />
          <Px x={bubbleAnchorX} y={bubbleY + bubbleH + 2} c="#0E1216" />
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

  // ─── TOP: CENTER WALL — HVAC removed 2026-07: it overlapped the
  // up-shifted Research niche (now at y=18..74 sharing the substation +
  // patch-panel baseline), so the 3-fan block was clutter behind the
  // niche's frame. If a cooling accent is needed later, add a slim
  // 4-wide vent bar to the LEFT of the niche (x=72..76). ────────────

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
  // baseline y=18..74, h=56 — same as substation (left, y=18..74) and
  // patch-panel (right, y=16..74). Interior rescaled from the previous
  // 84-tall frame: loss-curve subwindow shrunk 36→24, bars-window shrunk
  // 39→23 (3 bars at 5-px spacing). All content preserved, no crops.
  {
    const nx = 76, ny = 18, nw = 44, nh = 56;
    R(nx - 2, ny - 2, nw + 4, nh + 4, "#0A0C0E");
    R(nx - 2, ny - 2, nw + 4, 1, "#2E343C");
    R(nx, ny, nw, nh, "#10141A");
    A(nx - 2, ny - 2, nw + 4, nh + 4, "#16A6C4", 0.10);
    const sx = nx + 3, sy = ny + 3, sw = nw - 6, sh = 24;
    R(sx, sy, sw, sh, "#0A1418");
    R(sx, sy, sw, 1, "#16323A");
    for (let g = 1; g < 3; g++) R(sx, sy + g * 8, sw, 1, "#0E2228");
    for (let g = 1; g < 5; g++) R(sx + g * 7, sy, 1, sh, "#0E2228");
    const cBase = sy + sh - 4;
    for (let gx = 0; gx < sw - 4; gx += 1) {
      const prog = gx / (sw - 4);
      const ly = sy + 3 + (cBase - sy - 3) * (1 - Math.pow(1 - prog, 2.4))
                       + Math.sin((gx + (t >> 1)) / 4) * 1.0;
      PX(sx + 2 + gx, ly | 0, "#3FE0F0");
    }
    const hx = sx + 2 + ((t >> 1) % (sw - 5));
    const hp = (hx - sx - 2) / (sw - 4);
    const hy = sy + 3 + (cBase - sy - 3) * (1 - Math.pow(1 - hp, 2.4));
    R(hx, hy | 0, 1, 2, "#A4F0FF");
    PX(hx, (hy - 2) | 0, "#EBBE6E");
    const by = sy + sh + 2, bh = nh - sh - 8;
    R(sx, by, sw, bh, "#0A1418");
    R(sx, by, sw, 1, "#16323A");
    const barCols = ["#3FE0F0", "#7E9A85", "#EBBE6E"];
    for (let b = 0; b < 3; b++) {
      const bry = by + 3 + b * 5;
      R(sx + 3, bry, sw - 16, 2, "#0E2228");
      const bw = 4 + ((t >> 3) + b * 7) % (sw - 18);
      R(sx + 3, bry, bw, 2, barCols[b]);
      PX(sx + sw - 6, bry, "#16A6C4");
      PX(sx + sw - 4, bry, "#16A6C4");
    }
    for (let d = 0; d < 9; d++) {
      PX(sx + 3 + d * 4, by + bh - 2, ((t >> 2) + d) % 7 < 4 ? "#3FE0F0" : "#16323A");
    }
    R(nx + 2, ny - 7, nw - 4, 4, "#D4A24C");
    PX(nx + 3, ny - 6, "#8B5E2C");
    PX(nx + nw - 4, ny - 6, (t >> 3) % 6 < 4 ? "#7E9A85" : "#2A3A2E");
  }

  // Catwalk Y — used for both drawing + Inspector's feet position.
  // 2026-07: lowered from FLOOR_Y+30=180 to FLOOR_Y+50=200 so the
  // Inspector patrols below the Research niche's lower edge (niche
  // spans y=120..204 after the +60 wall translate), and so back+front
  // rows breathe apart instead of the whole floor compressing to center.
  // 2026-07: catwalk raised 15px (from FLOOR_Y+50=200 to FLOOR_Y+35=185)
  // so the Inspector sits higher above the back-row racks instead of
  // "in the wall" reading. Back+front rows also spread apart (see below).
  const cwY = FLOOR_Y + 35;

  return (
    <G>
      {/* Background (unshifted) */}
      {bgEls}
      {/* Upper-wall items, shifted +60 (was +25) to clear the floating HUD.
          On iPad the scene scale is ~3.2× vs ~1.75× on phone, so the same
          fixed-size HUD covers proportionally more scene-native pixels;
          +25 left switchgear tops + POWER/DATA labels hidden behind the
          HUD strip. +60 pushes wall content past the HUD on both form
          factors (see zone-y bumps in DATACENTER_ZONES too — they were
          pre-shifted +25 and are now +60). Wall bottom (NOC niche) ends
          near native y=202 = just above the back-row zone at y=196; the
          back row wins on overlap (later in zones array), so tapping the
          niche area still triggers Research above y=196 and Buy GPU below. */}
      <G transform="translate(0, 60)">{topEls}</G>

      {/* Back row of 3 floor-standing mainframes — halved from h=96 to h=48
          (design v13). 2026-07 iPad-view fix: y moved from FLOOR_Y-6=144
          to FLOOR_Y+46=196 so the row sits ENTIRELY BELOW the Inspector's
          catwalk (deck at cwY=180, zone extends to y=192). Previously the
          back row's TOP half was hidden behind the raised HUD on iPad-
          portrait (scenePadTop=0 pushes scene up so that y=144 lands
          behind the HUD strip). Zone semantics: LEFT=gpu, CENTER=engineer,
          RIGHT=gpu2. */}
      <Mainframe x={32}  y={FLOOR_Y + 58} w={52} h={48} t={t} />
      <Mainframe x={96}  y={FLOOR_Y + 58} w={52} h={48} t={t + 20} />
      <Mainframe x={160} y={FLOOR_Y + 58} w={52} h={48} t={t + 40} />

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

      {/* Front row — 2 regular mainframes flanking the new TRAINING RUN
          console. Halved (h=48) + lifted 4px (y=H-108, was H-104) so the
          front row breathes and doesn't crowd the alloc chrome on tablet.
          The center cabinet is the TRAINING RUN neural-net dashboard,
          replacing the earlier slot-machine visual — cyan trim, live
          3-layer network, epoch progress bar, GPU-util LEDs. */}
      <Mainframe          x={26}  y={H - 82} w={52} h={48} t={t + 8} />
      <TrainingMainframe  x={90}  y={H - 82} w={52} h={48} t={t + 28} />
      <Mainframe          x={154} y={H - 82} w={52} h={48} t={t + 48} />

      {/* Sparking-server overlay — drawn LAST so it sits on top of the
          mainframe tops + LED banks. Picks which rack is alerting from
          sparkingMainframeState (scene-owned timer). */}
      <SparkOverlay t={t} />
    </G>
  );
}

// Renders spark burst + pulsing red "!" + falling ember on whichever rack
// sparkingMainframeState picks. Live 20fps re-render so the 3-frame spark
// cycle + warning pulse look continuous instead of stuttering with the
// scene's 5fps tick.
function SparkOverlay(_props: { t: number }) {
  useTick(50);
  const t = Math.floor(Date.now() / 200);
  const spark = sparkingMainframeState(t);
  if (spark.activeIdx == null) return null;
  const rk = DC_RACKS[spark.activeIdx];
  const cx = rk.x + 24;
  // Design port: 3-frame spark loop at ~12fps
  const f = (t >> 1) % 3;
  const sparkY = rk.y - 2;
  const warnX = cx + 2;
  const warnY = rk.y - 8;
  const warnBlink = (t >> 2) % 2 === 0;
  const emberY = rk.y + (spark.framesActive % 6);
  return (
    <G>
      {/* Spark burst (3-frame loop): lightning fork → zigzag → ember cross */}
      {f === 0 && (
        <G>
          <Px x={cx}     y={sparkY} c="#FFFFFF" />
          <Px x={cx + 4} y={sparkY} c="#FFFFFF" />
          <Px x={cx + 2} y={sparkY} c="#3FE0F0" />
        </G>
      )}
      {f === 1 && (
        <G>
          <Px x={cx + 1} y={sparkY - 1} c="#FFFFFF" />
          <Px x={cx + 2} y={sparkY}     c="#FFFFFF" />
          <Px x={cx + 3} y={sparkY - 1} c="#FFFFFF" />
          <Px x={cx + 2} y={sparkY - 1} c="#A4F0FF" />
        </G>
      )}
      {f === 2 && (
        <G>
          <Px x={cx}     y={sparkY}     c="#EBBE6E" />
          <Px x={cx + 4} y={sparkY}     c="#EBBE6E" />
          <Px x={cx + 2} y={sparkY - 1} c="#EBBE6E" />
          <Px x={cx + 2} y={sparkY + 1} c="#EBBE6E" />
        </G>
      )}
      {/* Pulsing red warning "!" — vertical stroke + dot below */}
      {warnBlink && (
        <G>
          <PixelRect x={warnX} y={warnY} w={1} h={4} c="#F04438" />
          <Px        x={warnX} y={warnY + 5}       c="#F04438" />
        </G>
      )}
      {/* Falling ember drip */}
      <Px x={cx + 1} y={emberY} c="#F0503A" />
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

// ─── Frontier Research Array (planetary research access) ──────────────
// Design v10 port. Deep-space observatory: parabolic dish pointed up-left
// into the void, two solar wings, central hub, sensor mast, and a
// sweeping scan-beam. Anchored top-left at (x, y).
function FrontierResearchArray({ x, y, t }: { x: number; y: number; t: number }) {
  const halo: React.ReactNode[] = [];
  for (let g = 0; g < 6; g++) {
    halo.push(
      <Circle key={`h${g}`} cx={x + 8} cy={y + 8} r={18 - g}
        stroke="#3FC4E0" strokeWidth={2} fill="none"
        opacity={0.04 + g * 0.005} />
    );
  }

  const wings: React.ReactNode[] = [];
  for (const s of [-1, 1]) {
    const wx = x + 8 + s * 13;
    wings.push(<PixelRect key={`w${s}a`} x={wx - 2} y={y + 4} w={4} h={9} c="#1E2A52" />);
    wings.push(<PixelRect key={`w${s}b`} x={wx - 2} y={y + 4} w={4} h={1} c="#3F4E8A" />);
    for (let i = 0; i < 3; i++) {
      wings.push(<Px key={`w${s}c${i}`} x={wx} y={y + 5 + i * 3} c="#4A6AD0" />);
    }
    // boom to hub
    wings.push(<PixelRect key={`w${s}d`} x={x + 8 + s * 7} y={y + 8} w={6} h={1} c="#6C7A92" />);
  }

  // Parabolic dish — Ellipse with rotation. Canvas used -0.6 rad ≈ -34.4°.
  const dcx = x + 2, dcy = y - 2;
  const rotDeg = -34.4;

  // Scanning beam — sin-wave sweep. Triangle polygon.
  const sweep = Math.sin(t / 18) * 0.5;
  const beamPts = [
    [dcx, dcy],
    [dcx - 30 + sweep * 14, dcy - 22],
    [dcx - 18 + sweep * 14, dcy - 30],
  ];

  // Data pings traveling back down the beam (2 dots).
  const pings: React.ReactNode[] = [];
  for (let k = 0; k < 2; k++) {
    const pp = ((t + k * 20) % 40) / 40;
    const px2 = Math.floor(dcx - (24 + sweep * 14) * (1 - pp));
    const py2 = Math.floor(dcy - 22 * (1 - pp));
    pings.push(<Px key={`p${k}`} x={px2} y={py2} c="#FBE6A8" />);
  }

  return (
    <G>
      {/* Faint research halo */}
      {halo}

      {/* Solar wings */}
      {wings}

      {/* Central hub */}
      <PixelRect x={x + 4} y={y + 4} w={8} h={9} c="#8C9AB0" />
      <PixelRect x={x + 4} y={y + 4} w={8} h={1} c="#C8D0DC" />
      <PixelRect x={x + 4} y={y + 12} w={8} h={1} c="#4C5A72" />
      <Px x={x + 6} y={y + 7} c="#0E1115" />
      <Px x={x + 9} y={y + 7} c="#0E1115" />

      {/* Sensor mast + blinking nav light */}
      <PixelRect x={x + 8} y={y - 6} w={1} h={5} c="#6C7A92" />
      <Px x={x + 8} y={y - 7} c={(t >> 1) % 8 < 4 ? "#E85A7E" : "#3A1A1E"} />

      {/* Faint scan-beam cone */}
      <Polygon points={beamPts.map((p) => `${p[0]},${p[1]}`).join(" ")} fill="#A4F0FF" opacity={0.10} />
      {pings}

      {/* Parabolic dish — outer rim + dark interior, rotated up-left */}
      <Ellipse cx={dcx} cy={dcy} rx={6} ry={4} fill="#B0B8C4"
        transform={`rotate(${rotDeg} ${dcx} ${dcy})`} />
      <Ellipse cx={dcx} cy={dcy} rx={4} ry={2.6} fill="#2A3038"
        transform={`rotate(${rotDeg} ${dcx} ${dcy})`} />

      {/* Feed strut + receiver tip */}
      <PixelRect x={dcx - 1} y={dcy} w={2} h={6} c="#6C7A92" />
      <Px x={dcx} y={dcy} c={(t >> 2) % 6 < 3 ? "#A4F0FF" : "#2A6E88"} />
    </G>
  );
}

// ─── Per-type Earth-surface megastructures (Round 8) ────────────────────
// Each continent-scale feature now reads as its RESOURCE, not a generic
// city. Design v13 replaces the old 6-generic-city cluster model with
// 5 typed nodes: 2 GPU compute belts, 1 equatorial energy grid, 1 NA
// autonomous region, 1 decorative city cluster. Power lines flow from
// energy to GPU nodes; data fibers link the 3 non-city nodes together.
interface PlanetaryNode {
  x: number;
  y: number;
  r: number;
  type: "gpu" | "energy" | "auto" | "city";
  big?: boolean;
}

// GPU compute belt — dark silicon substrate tiled with terracotta GPU
// dies, cyan interconnect bus lines, thermal bloom, data glints,
// demand pulse ring. Reads unmistakably as compute.
function ComputeRegion({ node, t }: { node: PlanetaryNode; t: number }) {
  const { x, y, r, big } = node;
  const step = 4;
  // Thermal bloom — 6 layered orange ellipses
  const bloom: React.ReactNode[] = [];
  for (let g = 0; g < 6; g++) {
    bloom.push(
      <Ellipse key={`bl${g}`}
        cx={x} cy={y}
        rx={r * 1.4 - g * 2}
        ry={r * 1.1 - g * 1.6}
        fill={g % 2 ? "#E8894C" : "#C9531E"}
        opacity={0.05 + g * 0.008}
      />
    );
  }
  // GPU-die lattice — grid of small square dies, thermally flickering
  const dies: React.ReactNode[] = [];
  let di = 0;
  for (let gx = -r; gx <= r; gx += step) {
    for (let gy = -r * 0.82; gy <= r * 0.82; gy += step) {
      if ((gx * gx) / (r * r) + (gy * gy) / (r * r * 0.67) > 1) continue;
      const dx = Math.floor(x + gx), dy = Math.floor(y + gy);
      const heat = (t + gx * 3 + gy * 5) % 44;
      dies.push(
        <PixelRect key={`d${di++}`} x={dx} y={dy} w={3} h={3}
          c={heat < 32 ? "#C9683E" : "#7A3A22"} />
      );
      dies.push(
        <Px key={`d${di++}`} x={dx + 1} y={dy + 1}
          c={heat < 18 ? "#FFB070" : "#E8894C"} />
      );
    }
  }
  // Cyan interconnect bus lines (horizontal)
  const bus: React.ReactNode[] = [];
  for (let gy = -r * 0.5; gy <= r * 0.5; gy += step * 2) {
    bus.push(
      <Line key={`b${gy}`}
        x1={x - r * 0.8} y1={y + gy}
        x2={x + r * 0.8} y2={y + gy}
        stroke="#3FA8C4" strokeWidth={1} opacity={0.45}
      />
    );
  }
  // Traveling data glints on the bus
  const glints: React.ReactNode[] = [];
  const nGlints = big ? 4 : 3;
  for (let k = 0; k < nGlints; k++) {
    const tp = (((t >> 1) + k * 16) % 48) / 48;
    glints.push(
      <Px key={`g${k}`}
        x={Math.floor(x - r * 0.8 + r * 1.6 * tp)}
        y={Math.floor(y - r * 0.3 + k * step * 2)}
        c="#7EE0FF"
      />
    );
  }
  // Demand pulse — orange expanding ring
  const pulse = (t + x) % 48;
  const pulseRing = pulse < 24 ? (
    <Circle cx={x} cy={y} r={3 + pulse}
      fill="none" stroke="#E8894C" strokeWidth={1}
      opacity={0.3 * (1 - pulse / 24)} />
  ) : null;
  return (
    <G>
      {bloom}
      <Ellipse cx={x} cy={y} rx={r} ry={r * 0.82} fill="#1A120C" opacity={0.55} />
      {dies}
      {bus}
      {glints}
      {pulseRing}
    </G>
  );
}

// Energy grid — white-hot reactor core with hex substations on
// transmission spokes; periodic incoming lunar power beam. Reads as raw
// power. The beam originates from the moon's direction (upper-right).
function EnergyRegion({ node, t }: { node: PlanetaryNode; t: number }) {
  const { x, y, r } = node;
  // Amber power bloom — 8 layered circles
  const bloom: React.ReactNode[] = [];
  for (let g = 0; g < 8; g++) {
    bloom.push(
      <Circle key={`b${g}`} cx={x} cy={y} r={r * 1.3 - g * 1.5}
        fill={g % 2 ? "#EBBE6E" : "#FFE08A"} opacity={0.04 + g * 0.007}
      />
    );
  }
  // Lunar power beam (periodic, from upper-right)
  const beamPhase = t % 96;
  const beam = beamPhase < 12 ? (
    <Line x1={x + 40} y1={y - 92} x2={x} y2={y}
      stroke="#FFE08A" strokeWidth={1}
      opacity={0.45 - beamPhase * 0.03} />
  ) : null;
  // Transmission spokes + hex substations
  const spokes: React.ReactNode[] = [];
  const subs = 6;
  for (let s = 0; s < subs; s++) {
    const ang = (s / subs) * Math.PI * 2 + 0.3;
    const ex = x + Math.cos(ang) * r;
    const ey = y + Math.sin(ang) * r * 0.8;
    spokes.push(
      <Line key={`sp${s}`} x1={x} y1={y} x2={ex} y2={ey}
        stroke="#D4A24C" strokeWidth={1} opacity={0.6} />
    );
    spokes.push(
      <PixelRect key={`ss${s}`}
        x={Math.floor(ex - 1)} y={Math.floor(ey - 1)}
        w={3} h={3} c="#C9A24C" />
    );
    spokes.push(
      <Px key={`sl${s}`}
        x={Math.floor(ex)} y={Math.floor(ey)}
        c={(t + s * 6) % 24 < 12 ? "#FFF2C8" : "#8B5E2C"} />
    );
    const tp = (((t >> 1) + s * 8) % 30) / 30;
    spokes.push(
      <Px key={`spp${s}`}
        x={Math.floor(x + (ex - x) * tp)}
        y={Math.floor(y + (ey - y) * tp)}
        c="#FFE08A" />
    );
  }
  // Reactor core — white-hot, breathing
  const beat = 0.6 + 0.4 * Math.sin(t / 6);
  return (
    <G>
      {bloom}
      {beam}
      {spokes}
      <Rect x={x - 3} y={y - 3} width={6} height={6} fill="#FFF8E0" opacity={beat} />
      <PixelRect x={x - 2} y={y - 2} w={4} h={4} c="#FFE08A" />
      <Px x={x} y={y} c="#FFFFFF" />
      <Circle cx={x} cy={y} r={6} fill="none" stroke="#EBBE6E" strokeWidth={1} opacity={0.7} />
    </G>
  );
}

// Autonomous region — sage honeycomb of self-organizing cells inside a
// dashed self-drawn border, with a tiny flag. Reads as self-governing
// ("it filed its own incorporation papers").
function AutoRegion({ node, t }: { node: PlanetaryNode; t: number }) {
  const { x, y, r } = node;
  // Sage + cyan halo
  const halo: React.ReactNode[] = [];
  for (let g = 0; g < 6; g++) {
    halo.push(
      <Circle key={`h${g}`} cx={x} cy={y} r={r * 1.2 - g * 1.4}
        fill={g % 2 ? "#7E9A85" : "#3FA8C4"} opacity={0.04 + g * 0.006} />
    );
  }
  // Honeycomb cells
  const hs = 5;
  const cells: React.ReactNode[] = [];
  for (let row = -2; row <= 2; row++) {
    for (let col = -2; col <= 2; col++) {
      const hx = x + col * hs + (row % 2 ? hs / 2 : 0);
      const hy = y + row * hs * 0.8;
      if (Math.hypot(hx - x, (hy - y) / 0.8) > r) continue;
      const lit = (t + row * 7 + col * 3) % 36 < 28;
      cells.push(
        <PixelRect key={`c${row}-${col}a`}
          x={Math.floor(hx - 1)} y={Math.floor(hy - 1)}
          w={3} h={3} c={lit ? "#A4C8B0" : "#3F5142"} />
      );
      cells.push(
        <Px key={`c${row}-${col}b`}
          x={Math.floor(hx)} y={Math.floor(hy)}
          c={lit ? "#CFEAD6" : "#5C7560"} />
      );
    }
  }
  return (
    <G>
      {halo}
      {cells}
      {/* Self-drawn dashed boundary */}
      <Circle cx={x} cy={y} r={r + 1} fill="none"
        stroke="#7EE0B0" strokeWidth={1} strokeDasharray="2,3" opacity={0.55} />
      {/* Tiny flag on a pole */}
      <PixelRect x={x} y={y - r - 4} w={1} h={4} c="#7EE0B0" />
      <Px x={x + 1} y={y - r - 4} c="#3FA8C4" />
    </G>
  );
}

// Decorative golden city cluster — the original look, kept dimmer and
// smaller so it doesn't compete with the resource megastructures.
function CityRegion({ node, t }: { node: PlanetaryNode; t: number }) {
  const { x, y, r } = node;
  const count = r * 4;
  const lights: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const ang = i * 2.39996;
    const rd = Math.pow(i / count, 0.7) * r;
    const lx = Math.floor(x + Math.cos(ang) * rd);
    const ly = Math.floor(y + Math.sin(ang) * rd * 0.85);
    const flick = (t + i * 7) % 34 < 28;
    const col = flick
      ? (i % 4 === 0 ? "#FBE6A8" : "#D4A24C")
      : "#6B481E";
    lights.push(<Px key={`l${i}`} x={lx} y={ly} c={col} />);
  }
  return (
    <G>
      {lights}
      <PixelRect x={x - 1} y={y - 1} w={2} h={2} c="#FFF8E0" />
    </G>
  );
}

// Wry one-liners the Cosmonaut cycles through — the Planetary mirror of
// the Datacenter Inspector and Campus Bartender. Tone: cosmic loneliness
// + resignation to the AI. Cycle offset by +3s from Inspector (0) and
// Bartender (+6) so the trio don't mutter simultaneously on scene-switch.
const PLANETARY_COSMONAUT_QUIPS = [
  "earth's on mute. i checked. it's not mute.",
  "the AI says hi. been saying hi for eight years.",
  "no ground crew tonight. peaceful. earth's dreaming.",
  "docking bay 4 reports nominal. we don't have a docking bay 4.",
  "the model asked me to feed the cat. i don't have a cat.",
  "mission control forgot my name. i forgive them.",
  "the airlock's been cycling since twenty-four. nobody's used it.",
  "space is quiet. the model just polite about it.",
];

// Shared math for the cosmonaut's drift ellipse — used by both the sprite
// component and the quip anchor so both derive the same position from t
// without prop-threading. Ellipse below-left of the Endurance ring hub.
function cosmonautPos(t: number): { mx: number; my: number; puffing: boolean } {
  // `t` may be fractional (see Cosmonaut's smooth tick) — cos/sin give
  // continuous positions, then floor to pixel grid. Puffing check uses
  // floored int since it's an on/off state. Orbit period ≈ 2π·8/5 ≈ 10s
  // (previously 32s — felt lethargic for a space scene).
  const a = t / 8 + 1.6;
  const ocx = 98, ocy = 102, rx = 30, ry = 14;
  let mx = Math.floor(ocx + Math.cos(a) * rx);
  let my = Math.floor(ocy + Math.sin(a) * ry);
  const tInt = Math.floor(t);
  const puffing = (tInt % 96) < 3;
  if (puffing) {
    mx += (tInt % 2 ? 1 : -1);
    my -= 1;
  }
  return { mx, my, puffing };
}

// Bulky EVA cosmonaut tethered to the Endurance ring — floats on a slow
// ellipse below-left of the hub. White suit + gold mirror visor + PLSS
// backpack + AR PDA in front-arm, occasional cold-gas thruster puff.
// UFO fly-by event (Round 8 Planetary companion). Design port from
// pixel-art.jsx::ufoFlybyState. Deterministic per-cycle spawning:
// every 300-500 frames (~15-25s @ 20fps) a new saucer enters from
// alternating edges, flies horizontally with a tiny sin wobble, and
// exits after ~12s max. Multiple UFOs can be on-screen simultaneously.
interface UFOState {
  id: number;
  x: number;
  y: number;
  facing: 1 | -1;
}
const UFO_VX = 1.4;
const UFO_LIFE = 240;    // frames @ 20fps = 12s hard cap
const UFO_CYCLE = 400;   // spawn every ~20s
function ufoFlybyState(t: number): UFOState[] {
  const out: UFOState[] = [];
  // Design's spawn table iterates c=[-1..40] assuming t starts at 0.
  // Our t is `Date.now()/200` (billions), so instead we only search
  // cycles bracketing NOW — the current cycle and the two before/after
  // (so a saucer spawned near a cycle boundary and still crossing the
  // screen is included).
  const currentCycle = Math.floor(t / UFO_CYCLE);
  for (let c = currentCycle - 2; c <= currentCycle + 1; c++) {
    // Deterministic per-cycle spawn timestamp + tiny jitter.
    const born = c * UFO_CYCLE + (Math.abs(c * 53) % 120);
    const age = t - born;
    if (age < 0 || age > UFO_LIFE) continue;
    const facing: 1 | -1 = ((c % 2) + 2) % 2 === 0 ? 1 : -1;
    const startX = facing > 0 ? -16 : W + 16;
    const x = startX + facing * UFO_VX * age;
    if (x < -36 || x > W + 36) continue;
    const wobble = (Math.abs(c) * 1.7) % 6.283;
    // Fly-band BELOW the cosmonaut (who orbits at y≈102): saucers cruise
    // through the open space between him and Earth's top edge.
    const spawnY = 118 + (Math.abs(c * 37) % 36); // 118..153
    const y = spawnY + Math.sin(t / 12 + wobble) * 3;
    out.push({ id: c, x, y, facing });
  }
  return out;
}

function Cosmonaut(_props: { t: number }) {
  useTick(50);
  const t = Date.now() / 200;
  const tInt = Math.floor(t);
  const { mx, my, puffing } = cosmonautPos(t);
  const ringCx = 116, ringCy = 64;
  const tetherMidX = (mx + ringCx) / 2 + 3;
  const tetherMidY = (my + ringCy) / 2 + 6;
  const tetherPath = `M ${mx + 2} ${my + 4} Q ${tetherMidX} ${tetherMidY} ${ringCx} ${ringCy + 3}`;
  return (
    <G>
      <Path d={tetherPath} stroke="#C8D2DC" strokeWidth={1} fill="none" opacity={0.8} />
      {/* Ambient cyan rim glow from Earthlight below */}
      <Rect x={mx - 2} y={my + 9} width={12} height={3} fill="#16A6C4" opacity={0.18} />
      {/* PLSS backpack + blinking amber-red status LED */}
      <PixelRect x={mx - 2} y={my + 4} w={3} h={8} c="#B8BEC6" />
      <PixelRect x={mx - 2} y={my + 4} w={3} h={1} c="#DDE2E8" />
      <Px x={mx - 1} y={my + 6} c={(t >> 2) % 6 < 3 ? "#FF6A4C" : "#F4B24C"} />
      {/* Bulky off-white suit torso with reflective segments */}
      <PixelRect x={mx} y={my + 4} w={9} h={9} c="#E8E8DE" />
      <PixelRect x={mx} y={my + 4} w={9} h={1} c="#FFFFFF" />
      <PixelRect x={mx} y={my + 12} w={9} h={1} c="#B4B4AC" />
      <PixelRect x={mx + 1} y={my + 7} w={7} h={1} c="#BFC6CE" />
      <Px x={mx + 2} y={my + 5} c="#CFE6EE" />
      <Px x={mx + 6} y={my + 5} c="#CFE6EE" />
      {/* Chest control pad + blinking status */}
      <PixelRect x={mx + 3} y={my + 9} w={3} h={2} c="#3A4656" />
      <Px x={mx + 4} y={my + 9} c={(t >> 1) % 4 < 2 ? "#7EE0FF" : "#2A5A6A"} />
      {/* Legs (floating, slightly bent) */}
      <PixelRect x={mx + 1} y={my + 13} w={3} h={4} c="#E0E0D6" />
      <PixelRect x={mx + 5} y={my + 13} w={3} h={3} c="#E0E0D6" />
      <Px x={mx + 1} y={my + 16} c="#B4B4AC" />
      <Px x={mx + 6} y={my + 15} c="#B4B4AC" />
      {/* Back arm + front arm holding AR PDA tablet ("clipboard") */}
      <PixelRect x={mx - 1} y={my + 5} w={2} h={5} c="#E8E8DE" />
      <PixelRect x={mx + 8} y={my + 5} w={2} h={4} c="#E8E8DE" />
      <PixelRect x={mx + 9} y={my + 8} w={2} h={2} c="#E8E8DE" />
      <PixelRect x={mx + 10} y={my + 7} w={4} h={4} c="#1A2230" />
      <PixelRect x={mx + 11} y={my + 8} w={2} h={2} c={(t >> 2) % 4 < 2 ? "#7EE0FF" : "#2AA6C4"} />
      <Rect x={mx + 10} y={my + 7} width={4} height={4} fill="#16A6C4" opacity={0.4} />
      {/* Helmet: white shell + golden mirror visor */}
      <PixelRect x={mx + 1} y={my - 2} w={7} h={7} c="#F0F0E8" />
      <PixelRect x={mx + 1} y={my - 2} w={7} h={1} c="#FFFFFF" />
      <PixelRect x={mx + 2} y={my} w={5} h={4} c="#E8B24C" />
      <PixelRect x={mx + 2} y={my} w={5} h={1} c="#FCE79A" />
      <PixelRect x={mx + 2} y={my + 3} w={5} h={1} c="#B0812C" />
      <Px x={mx + 3} y={my + 1} c="#8FE6F0" />
      <Px x={mx + 5} y={my + 2} c="#8FE6F0" />
      {/* Cold-gas thruster puff (2-3 frame white sparkle from belt jet) */}
      {puffing && (
        <G>
          <Px x={mx - 3} y={my + 11} c="#FFFFFF" />
          <Px x={mx - 4} y={my + 12} c="#DFF4FF" />
          <Px x={mx - 3} y={my + 13} c="#BFE6F0" />
          <Px x={mx - 5} y={my + 11} c="#EAF8FF" />
        </G>
      )}
    </G>
  );
}

// Cosmonaut's speech bubble — deep-space navy fill, cyan-white border,
// pale-cyan text. Cycle offset by +3s (Inspector=0, Bartender=+6). Anchor
// derives from cosmonautPos so the bubble tracks the drifting sprite.
function CosmonautQuip({ t }: { t: number }) {
  const { mx, my } = cosmonautPos(Date.now() / 200);
  const qx = mx + 4;
  const qy = my - 3;
  const cycle = ((t / 24) + 3) % 12;
  if (cycle > 4) return null;
  const idx = Math.floor(((t / 24) + 3) / 12) % PLANETARY_COSMONAUT_QUIPS.length;
  const text = PLANETARY_COSMONAUT_QUIPS[idx];
  // Narrow 140px cap so long lines wrap into 2 short lines inside the
  // bubble instead of extending past the border (or getting clipped).
  const { lines, bubbleW } = wrapQuipLines(text, 140, 8);
  const rowH = 8;
  const bubbleH = 4 + lines.length * rowH;
  const bubbleX = Math.max(2, Math.min(qx - bubbleW / 2, W - bubbleW - 2));
  const bubbleY = Math.max(2, qy - (bubbleH + 2));
  const sparkleOn = (t >> 2) % 4 < 2;
  return (
    <G>
      {/* Bubble body — deep space navy + cyan-white border */}
      <PixelRect x={bubbleX}                 y={bubbleY}              w={bubbleW} h={bubbleH} c="#0A1225" />
      <PixelRect x={bubbleX}                 y={bubbleY}              w={bubbleW} h={1}       c="#7EE0FF" />
      <PixelRect x={bubbleX}                 y={bubbleY + bubbleH - 1} w={bubbleW} h={1}      c="#2A5A7A" />
      <PixelRect x={bubbleX}                 y={bubbleY}              w={1}       h={bubbleH} c="#7EE0FF" />
      <PixelRect x={bubbleX + bubbleW - 1}   y={bubbleY}              w={1}       h={bubbleH} c="#2A5A7A" />
      {/* Tail down to cosmonaut helmet */}
      <PixelRect x={qx - 1} y={bubbleY + bubbleH} w={3} h={2} c="#0A1225" />
      <Px x={qx} y={bubbleY + bubbleH + 2} c="#7EE0FF" />
      {/* Tiny star sparkle near tail — "signal transmitted through space" */}
      {sparkleOn && (
        <G>
          <Px x={qx + 3} y={bubbleY + bubbleH + 1} c="#FFFFFF" />
          <Px x={qx + 4} y={bubbleY + bubbleH + 2} c="#BFE6F0" />
        </G>
      )}
      {lines.map((line, i) => (
        <SvgText
          key={`ln${i}`}
          x={bubbleX + 4}
          y={bubbleY + 8 + i * rowH}
          fontSize={6}
          fontFamily={fonts.displayRegular}
          fill="#E0F4FF"
        >
          {line}
        </SvgText>
      ))}
    </G>
  );
}

// UFO sprite — ~15×7 px chunky saucer. Design port from drawUFO in
// pixel-art.jsx, scaled up ~1.5× so it reads clearly below the
// cosmonaut. Cyan cabin dome, thicker metal disc, 4 rotating rim
// lights, wider abduction beam. Trail drawn separately (UFOTrail).
function UFO({ x, y, t }: { x: number; y: number; t: number }) {
  const tInt = Math.floor(t);
  const idx = (tInt >> 2) % 4;
  const cols = ["#F04438", "#EBBE6E", "#5AE0B0", "#3FE0F0"];
  const xs = [x - 6, x - 2, x + 2, x + 6];
  const beamOn = ((tInt >> 3) % 2) === 1;
  return (
    <G>
      {/* Cabin dome — 5 wide, 2 rows */}
      <PixelRect x={x - 2} y={y - 3} w={5} h={1} c="#3FE0F0" />
      <PixelRect x={x - 2} y={y - 2} w={5} h={1} c="#7EE0FF" />
      {/* Body disc — 15 wide, 2 rows */}
      <PixelRect x={x - 7} y={y - 1} w={15} h={1} c="#8C9AB0" />
      <PixelRect x={x - 7} y={y}     w={15} h={1} c="#5C6068" />
      {/* Underside rim — 9 wide */}
      <PixelRect x={x - 4} y={y + 1} w={9} h={1} c="#3A3E44" />
      <PixelRect x={x - 3} y={y + 2} w={7} h={1} c="#2A2E34" />
      {/* Rotating rim light on the body's shadow row */}
      <Px x={xs[idx]} y={y} c={cols[idx]} />
      {/* Abduction beam — 3 wide, 6 tall, thicker to match the bigger disc */}
      {beamOn && (
        <Rect x={x - 1} y={y + 3} width={3} height={6} fill="#3FE0F0" opacity={0.35} />
      )}
    </G>
  );
}

// 3 amber/white speed lines behind the UFO. Direction depends on facing
// (1 = flying right → trail extends left, -1 = flying left). Sized up
// to match the bigger sprite: offset from disc edge, 4-px lines.
function UFOTrail({ x, y, facing }: { x: number; y: number; facing: 1 | -1 }) {
  return (
    <G>
      {[0, 1, 2].map((i) => {
        const alpha = 0.45 - i * 0.13;
        const lx = x - facing * (9 + i * 4);
        return (
          <Rect
            key={`uft${i}`}
            x={lx - 2}
            y={y}
            width={4}
            height={1}
            fill="#E4E0D8"
            opacity={alpha}
          />
        );
      })}
    </G>
  );
}

// Renders all live UFOs from ufoFlybyState. Called from PlanetaryScene
// AFTER star field but BEFORE ring/cosmonaut so saucers appear behind
// the ring hub if they overlap.
function UFOLayer(_props: { t: number }) {
  useTick(50);
  const t = Math.floor(Date.now() / 200);
  const ufos = ufoFlybyState(t);
  if (ufos.length === 0) return null;
  return (
    <G>
      {ufos.map((u) => (
        <G key={u.id}>
          <UFOTrail x={Math.floor(u.x)} y={Math.floor(u.y)} facing={u.facing} />
          <UFO x={Math.floor(u.x)} y={Math.floor(u.y)} t={t} />
        </G>
      ))}
    </G>
  );
}

function PlanetaryScene({ t }: { t: number }) {
  // ─── Earth + Moon geometry ────────────────────────────────────────────
  const cx = W / 2, cy = H - 8, R = 150;
  const mx = 200, my = 81, mR = 17;
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

  // Continent-scale RESOURCE megastructures (design v13) — each reads as
  // its own type. Order aligned with PLANETARY_ZONES hit-zone mapping:
  //   [0] NA autonomous  → engineer zone
  //   [1] Asia-Pacific   → gpu zone (big=true → +1 data glint)
  //   [2] Americas belt  → gpu2 zone
  //   [3] Equatorial grid → energy zone (fed by lunar mass-driver beam)
  //   [4] decorative     → no hit zone (visual filler on Europe/Africa)
  const nodes: PlanetaryNode[] = [
    { x: cx - 96, y: cy - 70, r: 17, type: "auto" },
    { x: cx + 70, y: cy - 84, r: 22, type: "gpu", big: true },
    { x: cx - 56, y: cy - 4,  r: 17, type: "gpu" },
    { x: cx + 40, y: cy - 32, r: 15, type: "energy" },
    { x: cx - 10, y: cy - 96, r: 11, type: "city" },
  ];
  const energyNode = nodes.find((n) => n.type === "energy");
  const gpuNodes = nodes.filter((n) => n.type === "gpu");

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

  // ─── Continent-linkage networks (drawn BEHIND the megastructures) ─────
  //   POWER lines: bowed quadratic-bezier from the equatorial energy node
  //     to each GPU compute belt, with flowing amber packets along the arc
  //   DATA fibers: straight cyan links between the 3 non-city nodes
  //     (NA auto ↔ Asia GPU ↔ Americas GPU), with a single traveling packet
  const powerLines: React.ReactNode[] = [];
  if (energyNode) {
    for (let gi = 0; gi < gpuNodes.length; gi++) {
      const g = gpuNodes[gi];
      const midX = (energyNode.x + g.x) / 2;
      const midY = (energyNode.y + g.y) / 2 - 10;
      powerLines.push(
        <Path key={`pl${gi}`}
          d={`M ${energyNode.x} ${energyNode.y} Q ${midX} ${midY} ${g.x} ${g.y}`}
          stroke="#EBBE6E" strokeWidth={1} fill="none" opacity={0.22}
        />
      );
      for (let k = 0; k < 3; k++) {
        const tp = (((t >> 1) + k * 20) % 60) / 60;
        const ix = energyNode.x + (g.x - energyNode.x) * tp;
        const iy = energyNode.y + (g.y - energyNode.y) * tp - Math.sin(tp * Math.PI) * 10;
        powerLines.push(
          <Px key={`pp${gi}-${k}`} x={Math.floor(ix)} y={Math.floor(iy)} c="#FFE08A" />
        );
      }
    }
  }
  const dataFibers: React.ReactNode[] = [];
  const dataLinks: Array<[PlanetaryNode, PlanetaryNode]> = [
    [nodes[0], nodes[1]], [nodes[1], nodes[2]], [nodes[0], nodes[2]],
  ];
  for (let li = 0; li < dataLinks.length; li++) {
    const [a, b] = dataLinks[li];
    dataFibers.push(
      <Line key={`df${li}`}
        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke="#3FA8C4" strokeWidth={1} opacity={0.12}
      />
    );
    const tp = (((t >> 1) + li * 17) % 50) / 50;
    dataFibers.push(
      <Px key={`dp${li}`}
        x={Math.floor(a.x + (b.x - a.x) * tp)}
        y={Math.floor(a.y + (b.y - a.y) * tp)}
        c="#7EE0FF"
      />
    );
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
        {/* Continent-linkage networks (behind the megastructures) */}
        {powerLines}
        {dataFibers}
        {/* Per-type continent megastructures — 4 renderers dispatch on
            node.type: compute belts (silicon+dies), energy grid (reactor
            +hex substations), autonomous region (honeycomb+dashed border
            +flag), decorative city cluster (dim golden ambient). */}
        {nodes.map((n, ni) => {
          if (n.type === "gpu")    return <ComputeRegion key={`n${ni}`} node={n} t={t} />;
          if (n.type === "energy") return <EnergyRegion  key={`n${ni}`} node={n} t={t} />;
          if (n.type === "auto")   return <AutoRegion    key={`n${ni}`} node={n} t={t} />;
          return                          <CityRegion    key={`n${ni}`} node={n} t={t} />;
        })}
        {/* Cloud bands */}
        {cloudPx}
        {/* Polar aurora */}
        {aurora}
      </G>

      {/* Frontier Research Array — deep-space observatory on the left.
          Raised above the floating Slack button (which covers SVG y≈77-102
          in our geometry) to keep the sprite + halo + mast visible. */}
      <FrontierResearchArray x={36} y={50} t={t} />

      {/* Endurance ring ship — Training Run target for the planetary round.
          Upper-center deep space; rotating modules + ion thruster plume. */}
      <EnduranceShip cx={116} cy={64} t={t} />

      {/* UFO fly-by event layer — drawn BEFORE the ring/cosmonaut so
          saucers pass behind them if they overlap. Deterministic per-
          cycle spawning; multiple UFOs can be on-screen at once. */}
      <UFOLayer t={t} />
      {/* Cosmonaut on EVA — tethered to the Endurance hub, floats on a slow
          ellipse below-left of the ring. Third character companion in the
          Inspector/Bartender/Cosmonaut trio. Quip bubble drawn LAST below
          so it sits on top of every scene sprite. */}
      <Cosmonaut t={t} />

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

      {/* Cosmonaut's speech bubble — drawn LAST so it sits on top of every
          scene sprite (ring, hub, packets, endurance, etc). */}
      <CosmonautQuip t={t} />
    </G>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// AGI SINGULARITY SCENE — design v11 rewrite. A supermassive black hole at
// galactic scale: accretion disk + photon ring + lensed starfield + polar
// jets + Doppler beaming. Producer anchors orbit: a Matrioshka swarm
// (lower-left), a Dyson Sphere (lower-right), a Galactic Archive spiral
// (upper-right). Deadpan apocalypse vibe — "the company has become a
// gravity well." Per pixel-art.jsx::composeAGIScene.
// ═══════════════════════════════════════════════════════════════════════

// — Spiral galaxy (background decor + Data producer anchor) —
function SpiralGalaxy({
  cx, cy, R, ry, t, spin, core, arm,
}: { cx: number; cy: number; R: number; ry: number; t: number; spin: number; core: string; arm: string }) {
  const out: React.ReactNode[] = [];
  let k = 0;
  // Bulge — concentric ellipses, increasing alpha toward center.
  for (let g = 4; g > 0; g--) {
    out.push(
      <Ellipse key={`b${g}`} cx={cx} cy={cy} rx={g * 2.4} ry={g * 1.7}
        fill={core} opacity={0.09 * g} />
    );
  }
  // Two arms — pixel trails along parametric spirals.
  for (let a2 = 0; a2 < 2; a2++) {
    for (let i = 0; i < 64; i++) {
      const a = i * 0.17 + spin + a2 * Math.PI + t / 320;
      const rr = (i / 64) * R;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * (ry / R);
      const tw = (t + i * 3 + a2 * 20) % 30 < 22;
      out.push(<Px key={`g${k++}`} x={x | 0} y={y | 0} c={tw ? arm : core} />);
      if (i % 9 === 0) out.push(<Px key={`gh${k++}`} x={(x + 1) | 0} y={y | 0} c="#FBF7EC" />);
    }
  }
  // Bright stellar core.
  out.push(<PixelRect key={`c0`} x={cx - 1} y={cy - 1} w={3} h={3} c="#FFF8E8" />);
  out.push(<Px key={`c1`} x={cx} y={cy} c="#FFFFFF" />);
  return <G>{out}</G>;
}

// — One half of the tilted accretion disk (back-half partly occluded by the
// event horizon; front-half pops over the hole). Drawn as 10 concentric
// elliptical arcs with a temperature gradient + animated Doppler shimmer. —
function DiskHalf({
  cx, cy, rx, ry, irx, iry, a0, a1, t, back,
}: { cx: number; cy: number; rx: number; ry: number; irx: number; iry: number; a0: number; a1: number; t: number; back: boolean }) {
  const out: React.ReactNode[] = [];
  let k = 0;
  const bands = 10;
  for (let b = 0; b < bands; b++) {
    const f = b / (bands - 1);
    const bx = irx + (rx - irx) * f;
    const by = iry + (ry - iry) * f;
    const col = f < 0.2 ? "#FFF6DC"
              : f < 0.4 ? "#FFD27A"
              : f < 0.6 ? "#FF9A3A"
              : f < 0.8 ? "#F5602A"
                        : "#C0301E";
    const [sx, sy] = [cx + Math.cos(a0) * bx, cy + Math.sin(a0) * by];
    const [ex, ey] = [cx + Math.cos(a1) * bx, cy + Math.sin(a1) * by];
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    out.push(
      <Path key={`d${b}`}
        d={`M ${sx} ${sy} A ${bx} ${by} 0 ${large} 1 ${ex} ${ey}`}
        stroke={col} strokeWidth={2} fill="none"
        opacity={back ? 0.45 : 0.85} />
    );
  }
  // Doppler beaming shimmer — bright on the approaching side.
  for (let i = 0; i < 44; i++) {
    const a = a0 + (a1 - a0) * (i / 44);
    const f = 0.35 + 0.6 * ((Math.sin(i * 0.7 + t / 6) + 1) / 2);
    const bx = irx + (rx - irx) * f;
    const by = iry + (ry - iry) * f;
    const x = cx + Math.cos(a) * bx;
    const y = cy + Math.sin(a) * by;
    if ((t * 2 + i * 5) % 20 >= 12) continue;
    out.push(<Px key={`dd${k++}`} x={x | 0} y={y | 0} c={Math.cos(a) < 0 ? "#FFFFFF" : "#FFC878"} />);
  }
  return <G>{out}</G>;
}

// — The black hole centerpiece: outer glow + back-disk + lensed top arcs +
// event-horizon shadow + photon ring + front-disk + relativistic polar jets. —
function BlackHole({ cx, cy, t }: { cx: number; cy: number; t: number }) {
  const ehR = 22, diskRx = 86, diskRy = 26, innerRx = 30, innerRy = 9;
  // Top gravitational-lensing arcs (5 concentric).
  const lensRings: React.ReactNode[] = [];
  for (let ring = 0; ring < 5; ring++) {
    const lcx = cx, lcy = cy;
    const lrx = ehR + 6 + ring * 2, lry = ehR + 14 + ring * 3;
    const aL = Math.PI * 1.06, aR = Math.PI * 1.94;
    const [sx, sy] = [lcx + Math.cos(aL) * lrx, lcy + Math.sin(aL) * lry];
    const [ex, ey] = [lcx + Math.cos(aR) * lrx, lcy + Math.sin(aR) * lry];
    lensRings.push(
      <Path key={`l${ring}`}
        d={`M ${sx} ${sy} A ${lrx} ${lry} 0 0 1 ${ex} ${ey}`}
        stroke={ring < 2 ? "#FFF2C8" : ring < 4 ? "#FFC04A" : "#FF8030"}
        strokeWidth={2} fill="none"
        opacity={0.55 - ring * 0.09} />
    );
  }
  // Polar jets — vertical fan of bright streaks above + below.
  const jets: React.ReactNode[] = [];
  let jk = 0;
  for (const dir of [-1, 1]) {
    for (let j = 0; j < 58; j++) {
      const jy = cy + dir * (ehR + 2 + j * 1.7);
      const spread = j * 0.16;
      const col = j < 12 ? "#CFEFFF" : j < 30 ? "#7EC8E8" : "#3F88C4";
      const op = Math.max(0, 0.5 - j * 0.008);
      const w = Math.max(1, Math.floor(spread * 2));
      jets.push(
        <Rect key={`j${jk++}`} x={cx - spread} y={jy} width={w} height={1} fill={col} opacity={op} />
      );
      if ((t + j * 2) % 8 < 3) {
        jets.push(<Px key={`jp${jk++}`} x={cx | 0} y={jy | 0} c="#FFFFFF" />);
      }
    }
  }
  return (
    <G>
      {/* Outer disk glow */}
      <Ellipse cx={cx} cy={cy} rx={diskRx + 8} ry={diskRy + 7} fill="#FF7A2A" opacity={0.16} />
      {/* Back half of accretion disk */}
      <DiskHalf cx={cx} cy={cy} rx={diskRx} ry={diskRy} irx={innerRx} iry={innerRy}
        a0={Math.PI} a1={Math.PI * 2} t={t} back />
      {/* Gravitational lensing arcs over the top */}
      {lensRings}
      {/* Event-horizon shadow */}
      <Ellipse cx={cx} cy={cy} rx={ehR} ry={ehR} fill="#070410" />
      {/* Photon ring + soft halo */}
      <Ellipse cx={cx} cy={cy} rx={ehR + 1.5} ry={ehR + 1.5} fill="none"
        stroke="#FFF6DC" strokeWidth={1.5} opacity={0.9} />
      <Ellipse cx={cx} cy={cy} rx={ehR + 3} ry={ehR + 3} fill="none"
        stroke="#FFB84A" strokeWidth={1} opacity={0.4} />
      {/* Front half of accretion disk (over the hole) */}
      <DiskHalf cx={cx} cy={cy} rx={diskRx} ry={diskRy} irx={innerRx} iry={innerRy}
        a0={0} a1={Math.PI} t={t} back={false} />
      {/* Relativistic polar jets — above and below */}
      {jets}
    </G>
  );
}

// — Matrioshka / Dyson compute swarm (GPU producer anchor) —
function DysonSwarm({ cx, cy, t }: { cx: number; cy: number; t: number }) {
  const dots: React.ReactNode[] = [];
  let k = 0;
  for (let ring = 0; ring < 3; ring++) {
    const rad = 8 + ring * 4, ph = t / 40 + ring;
    for (let kk = 0; kk < 8; kk++) {
      const a = kk * Math.PI / 4 + ph;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad * 0.6;
      dots.push(<Px key={`s${k++}`} x={x | 0} y={y | 0} c={ring % 2 ? "#A86AD0" : "#6A4A9A"} />);
      if ((t + kk) % 6 < 3) {
        dots.push(<Px key={`sh${k++}`} x={x | 0} y={(y - 1) | 0} c="#C9A0E0" />);
      }
    }
  }
  return (
    <G>
      <Ellipse cx={cx} cy={cy} rx={20} ry={20} fill="#5C3A6A" opacity={0.22} />
      <PixelRect x={cx - 3} y={cy - 3} w={6} h={6} c="#FFE0A0" />
      <PixelRect x={cx - 2} y={cy - 2} w={4} h={4} c="#FFF8E0" />
      <Px x={cx} y={cy} c="#FFFFFF" />
      {dots}
    </G>
  );
}

// — Stellar Forge (AGI training-run target) —
// Protostar condensing from a nebula knot: swirling infall + accretion ring
// + fusion core that pulses + periodic ignition flare. "Forging a new mind."
function StellarForge({ cx, cy, t }: { cx: number; cy: number; t: number }) {
  // Ignition cycle — flares bright every ~64 ticks
  const cyc = t % 64;
  const igniting = cyc < 10;
  const flare = igniting ? (1 - cyc / 10) : 0;
  const breathe = 1 + Math.sin(t / 14) * 0.12 + flare * 0.8;
  const coreR = 5 * breathe;

  // Spiraling infall — 3 streams of pixel dots
  const infall: React.ReactNode[] = [];
  let ik = 0;
  for (let s = 0; s < 3; s++) {
    const base = s * 2.1 + t / 18;
    for (let i = 0; i < 18; i++) {
      const a = base + i * 0.34;
      const rr = 26 - i * 1.3;
      if (rr < 5) break;
      if ((t + i * 2 + s * 5) % 10 < 6) {
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr * 0.6;
        const col = i < 5 ? "#FFE8A8" : i < 11 ? "#E8902A" : "#7A3A6A";
        infall.push(<Px key={`if${ik++}`} x={x | 0} y={y | 0} c={col} />);
      }
    }
  }

  // Orbiting bright clump on the accretion ring
  const oa = -t / 12;
  const orx = Math.cos(oa) * 22;
  const ory = Math.sin(oa) * 22 * 0.42;
  const ox = cx + orx * Math.cos(-0.5) - ory * Math.sin(-0.5);
  const oy = cy + orx * Math.sin(-0.5) + ory * Math.cos(-0.5);

  // Rising newborn-star sparks
  const sparks: React.ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    const sp = (t + i * 13) % 64;
    if (sp < 40) {
      const opacity = 0.7 * (1 - sp / 40);
      const sxk = cx + Math.sin(i * 2 + t / 10) * (4 + sp * 0.2);
      sparks.push(
        <Rect key={`sp${i}`} x={sxk | 0} y={(cy - sp * 0.5) | 0}
          width={1} height={1} fill={i % 2 ? "#FFE08A" : "#A4F0FF"} opacity={opacity} />
      );
    }
  }

  return (
    <G>
      {/* Nebula knots — 3 layered ellipses */}
      <Ellipse cx={cx - 10} cy={cy - 6} rx={20} ry={16} fill="#3A1E50" opacity={0.45} />
      <Ellipse cx={cx + 9}  cy={cy + 5} rx={20} ry={16} fill="#1E2E5C" opacity={0.45} />
      <Ellipse cx={cx + 2}  cy={cy + 9} rx={20} ry={16} fill="#4A2030" opacity={0.45} />

      {/* Spiraling infall */}
      {infall}

      {/* Accretion ring — 3 banded ellipses, tilted -0.5 rad */}
      <Ellipse cx={cx} cy={cy} rx={22} ry={22 * 0.42} fill="none" stroke="#FFF2C8" strokeWidth={1.5} opacity={0.8} transform={`rotate(-28.6 ${cx} ${cy})`} />
      <Ellipse cx={cx} cy={cy} rx={19} ry={19 * 0.42} fill="none" stroke="#FFC04A" strokeWidth={1.5} opacity={0.8} transform={`rotate(-28.6 ${cx} ${cy})`} />
      <Ellipse cx={cx} cy={cy} rx={16} ry={16 * 0.42} fill="none" stroke="#E8702A" strokeWidth={1.5} opacity={0.8} transform={`rotate(-28.6 ${cx} ${cy})`} />

      {/* Orbiting bright clump */}
      <PixelRect x={ox - 1} y={oy - 1} w={2} h={2} c="#FFF8E0" />

      {/* Core halo (breathing) */}
      <Ellipse cx={cx} cy={cy} rx={breathe * 19.2} ry={breathe * 19.2} fill="#FFD27A" opacity={0.18 + flare * 0.4} />
      <Ellipse cx={cx} cy={cy} rx={breathe * 12.0} ry={breathe * 12.0} fill="#FFD27A" opacity={0.28 + flare * 0.5} />
      <Ellipse cx={cx} cy={cy} rx={breathe * 7.2}  ry={breathe * 7.2}  fill="#FF8A3A" opacity={0.5 + flare * 0.4} />

      {/* Fusion core */}
      <Ellipse cx={cx} cy={cy} rx={coreR} ry={coreR} fill="#FF9A3A" />
      <Ellipse cx={cx} cy={cy} rx={coreR * 0.66} ry={coreR * 0.66} fill="#FFE08A" />
      <Ellipse cx={cx} cy={cy} rx={coreR * 0.34} ry={coreR * 0.34} fill="#FFFFFF" />

      {/* Ignition flare — cross spikes + ring shock */}
      {igniting && (
        <G opacity={flare}>
          <Rect x={cx - (14 + (1 - flare) * 16)} y={cy} width={(14 + (1 - flare) * 16) * 2} height={1} fill="#FFF8E0" />
          <Rect x={cx} y={cy - (14 + (1 - flare) * 16)} width={1} height={(14 + (1 - flare) * 16) * 2} fill="#FFF8E0" />
          <Ellipse cx={cx} cy={cy} rx={10 + (1 - flare) * 22} ry={(10 + (1 - flare) * 22) * 0.6} fill="none" stroke="#FFF2C8" strokeWidth={1} />
        </G>
      )}

      {sparks}
    </G>
  );
}

// — Endurance ring ship (Planetary training-run target) —
// Interstellar-style rotating-ring craft: 12 modules on a spinning ring,
// central hub with docking spokes, antenna, and an ion thruster plume.
function EnduranceShip({ cx, cy, t }: { cx: number; cy: number; t: number }) {
  const RX = 26;
  const RY = 9.5;
  const spin = t / 26;

  // 12 modules around the ring, split into back/front for proper z-ordering
  type Mod = { mxp: number; myp: number; front: boolean; i: number };
  const modules: Mod[] = [];
  for (let i = 0; i < 12; i++) {
    const a = spin + (i / 12) * Math.PI * 2;
    modules.push({
      mxp: cx + Math.cos(a) * RX,
      myp: cy + Math.sin(a) * RY,
      front: Math.sin(a) > 0,
      i,
    });
  }
  const renderModule = (m: Mod, prefix: string) => {
    const hab = m.i % 2 === 0;
    const blink = (t + m.i * 4) % 16 < 9;
    const blinkCol = blink ? (hab ? "#FFE8A8" : "#7EE0FF") : "#2A3340";
    return (
      <G key={`${prefix}${m.i}`}>
        <PixelRect x={m.mxp - 2} y={m.myp - 2} w={4} h={4} c={hab ? "#D8E0EC" : "#3A4656"} />
        <PixelRect x={m.mxp - 2} y={m.myp - 2} w={4} h={1} c={hab ? "#FFFFFF" : "#5A6A7E"} />
        <Px x={m.mxp | 0} y={m.myp | 0} c={blinkCol} />
      </G>
    );
  };

  // Ion thruster plume — 9 horizontal bars, fading
  const plume: React.ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const op = (0.8 - i * 0.08) * (0.6 + 0.4 * Math.sin(t / 4 + i));
    const col = i < 2 ? "#FFFFFF" : i < 4 ? "#A4F0FF" : i < 6 ? "#5AB0E0" : "#2A6AA0";
    plume.push(
      <Rect key={`pl${i}`} x={(cx - RX - 2 - i * 2) | 0} y={cy - 1}
        width={2} height={2} fill={col} opacity={Math.max(0, op)} />
    );
  }

  // Periodic data burst toward Earth
  const burn = (t % 48) / 48;
  const dataBurst = burn < 0.5 ? (
    <Rect x={(cx + RX + 2 + burn * 30) | 0} y={(cy + 4 + burn * 20) | 0}
      width={2} height={2} fill="#FFE08A" opacity={0.7 * (1 - burn * 2)} />
  ) : null;

  // Docking spokes — 6 short lines radiating from hub
  const spokes: React.ReactNode[] = [];
  for (let i = 0; i < 6; i++) {
    const a = spin * 0.5 + i * Math.PI / 3;
    spokes.push(
      <Line key={`sp${i}`}
        x1={cx} y1={cy}
        x2={cx + Math.cos(a) * RX * 0.42}
        y2={cy + Math.sin(a) * RY * 0.42}
        stroke="#6C7C92" strokeWidth={1} />
    );
  }

  // Beacon on forward command pod — blinks
  const beaconCol = (t >> 1) % 6 < 3 ? "#FF5A4C" : "#5A1A14";

  return (
    <G>
      {/* Running-light halo */}
      <Ellipse cx={cx} cy={cy} rx={RX + 8} ry={RY + 6} fill="#9AB4D0" opacity={0.10} />
      <Ellipse cx={cx} cy={cy} rx={RX + 4} ry={RY + 3} fill="#9AB4D0" opacity={0.14} />

      {/* Back half of ring (behind hub) */}
      <Path d={`M ${cx - RX} ${cy} A ${RX} ${RY} 0 0 0 ${cx + RX} ${cy}`}
        stroke="#5A6A82" strokeWidth={2} fill="none" />

      {/* Back modules */}
      {modules.filter(m => !m.front).map(m => renderModule(m, "b"))}

      {/* Front half of ring */}
      <Path d={`M ${cx - RX} ${cy} A ${RX} ${RY} 0 0 1 ${cx + RX} ${cy}`}
        stroke="#7E8EA6" strokeWidth={2} fill="none" />

      {/* Docking spokes */}
      {spokes}

      {/* Hub body */}
      <PixelRect x={cx - 4} y={cy - 3} w={8} h={6} c="#C8D2E0" />
      <PixelRect x={cx - 4} y={cy - 3} w={8} h={1} c="#FFFFFF" />
      <PixelRect x={cx - 4} y={cy + 2} w={8} h={1} c="#7E8EA6" />
      <Px x={cx - 2} y={cy} c="#3A4656" />
      <Px x={cx + 1} y={cy} c="#3A4656" />

      {/* Forward command pod + beacon */}
      <PixelRect x={cx - 1} y={cy - 6} w={2} h={3} c="#D8E0EC" />
      <Px x={cx} y={cy - 7} c={beaconCol} />

      {/* Antenna dish (small arc) */}
      <Path d={`M ${cx + 6 + Math.cos(Math.PI * 1.2) * 2.5} ${cy - 2 + Math.sin(Math.PI * 1.2) * 2.5} A 2.5 2.5 0 0 1 ${cx + 6 + Math.cos(Math.PI * 2.1) * 2.5} ${cy - 2 + Math.sin(Math.PI * 2.1) * 2.5}`}
        stroke="#8C9AAE" strokeWidth={1} fill="none" />

      {/* Front modules (over hub) */}
      {modules.filter(m => m.front).map(m => renderModule(m, "f"))}

      {/* Ion thruster plume trailing left */}
      {plume}

      {/* Data burst toward Earth */}
      {dataBurst}
    </G>
  );
}

// — Dyson Sphere (Energy producer anchor in AGI scene) —
// A brilliant star caged in a geodesic Dyson lattice with collector panels
// along the equator; energy tapped off as a collimated beam.
function DysonStar({ cx, cy, t }: { cx: number; cy: number; t: number }) {
  const R = 14;

  // Stellar corona — 7 nested low-alpha ellipses
  const corona: React.ReactNode[] = [];
  for (let g = 7; g > 0; g--) {
    corona.push(
      <Ellipse key={`co${g}`} cx={cx} cy={cy} rx={g * 2.6} ry={g * 2.6}
        fill={g > 4 ? "#FFD27A" : "#FF9A3A"} opacity={0.05 + g * 0.006} />,
    );
  }

  // Surface granulation flicker — 5 short-lived dots on the star surface
  const granulation: React.ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    if ((t + i * 3) % 10 < 5) {
      const a = i * 1.7 + t / 8;
      const rr = (R - 4) * 0.6;
      granulation.push(
        <Px key={`gr${i}`} x={(cx + Math.cos(a) * rr) | 0} y={(cy + Math.sin(a) * rr) | 0} c="#FFE8A8" />,
      );
    }
  }

  // Dyson geodesic lattice — 3 great-circle rings at angles, slow rotation
  const spin = t / 60;
  const rings = [0, Math.PI / 3, -Math.PI / 3];
  const latticeRings: React.ReactNode[] = rings.map((base, i) => {
    const rotDeg = ((base + spin) * 180) / Math.PI;
    return (
      <Ellipse
        key={`lr${i}`}
        cx={cx}
        cy={cy}
        rx={R}
        ry={R * 0.34}
        fill="none"
        stroke="#2A3340"
        strokeWidth={1}
        opacity={0.9}
        transform={`rotate(${rotDeg.toFixed(2)} ${cx} ${cy})`}
      />
    );
  });

  // Collector panels caged around the equator with blinking glints
  const collectors: React.ReactNode[] = [];
  for (let i = 0; i < 12; i++) {
    const a = spin * 0.7 + (i / 12) * Math.PI * 2;
    const pxx = cx + Math.cos(a) * R;
    const pyy = cy + Math.sin(a) * R * 0.34;
    collectors.push(
      <React.Fragment key={`cp${i}`}>
        <PixelRect x={pxx - 1} y={pyy - 1} w={2} h={2} c={i % 2 ? "#3A4656" : "#222A36"} />
        <Px x={pxx | 0} y={pyy | 0} c={(t + i * 3) % 14 < 8 ? "#FFB84A" : "#5A3A1A"} />
      </React.Fragment>,
    );
  }

  // Energy tap beam — 16 horizontal pulsing bars trailing right
  const beam: React.ReactNode[] = [];
  for (let j = 0; j < 16; j++) {
    const op = Math.max(0, (0.85 - j * 0.05) * (0.6 + 0.4 * Math.sin(t / 4 + j)));
    const col = j < 3 ? "#FFFFFF" : j < 7 ? "#FFE8A8" : "#EBBE6E";
    beam.push(
      <Rect key={`bm${j}`} x={(cx + R + 2 + j * 2) | 0} y={cy - 1} width={2} height={2} fill={col} opacity={op} />,
    );
  }

  // Power-collected pulse ring (briefly, every 30 ticks)
  const burn = (t % 30) / 30;
  const pulseRing = burn < 0.5
    ? (
      <Ellipse
        cx={cx}
        cy={cy}
        rx={R + 2 + burn * 14}
        ry={(R + 2 + burn * 14) * 0.5}
        fill="none"
        stroke="#FFD27A"
        strokeWidth={1}
        opacity={0.4 * (1 - burn * 2)}
      />
    )
    : null;

  return (
    <G>
      {corona}
      {/* The star — 3 concentric ellipses */}
      <Ellipse cx={cx} cy={cy} rx={R - 2}             ry={R - 2}             fill="#FF9A3A" />
      <Ellipse cx={cx} cy={cy} rx={(R - 2) * 0.7}     ry={(R - 2) * 0.7}     fill="#FFD27A" />
      <Ellipse cx={cx} cy={cy} rx={(R - 2) * 0.36}    ry={(R - 2) * 0.36}    fill="#FFF8E0" />
      {granulation}
      {latticeRings}
      {collectors}
      {beam}
      {pulseRing}
    </G>
  );
}

// Wry one-liners the Prompt Engineer cycles through — the AGI Singularity
// mirror of the Datacenter Inspector / Campus Bartender / Planetary
// Cosmonaut. Tone: dev at the end of the universe, still prompting the
// model, still tracking OKRs, still on probation. Cycle offset by +9s
// (Inspector=0, Bartender=+6, Cosmonaut=+3) so the four-character
// rotation doesn't mutter in sync when scene-hopping.
const AGI_PROMPT_ENGINEER_QUIPS = [
  "prompt v4728: 'act as god.' response: 'thanks for the promo.'",
  "asked what to do. it said 'yes.' good enough for me.",
  "the model replied with just a semicolon. i think that's a haiku.",
  "sprint retro at 3am. attendees: me. the model. it was quiet.",
  "OKR: 'align the aligned.' status: green. always green.",
  "AGI said 'i love you.' i said 'invalid.' it laughed politely.",
  "day 47298 of this conversation. we're vibing.",
  "asked for a raise. it granted me tenure. tenure of what.",
];

// Shared math for the Prompt Engineer's drift position — used by the
// sprite component AND the quip anchor so both derive the same {x, y}
// from t without prop-threading. Anchored at (128, 248) with a tiny
// 5×4 orbit (much tighter than the Cosmonaut's 30×14 — a dev at his
// desk barely moves).
function promptEngineerPos(t: number): { x: number; y: number; typing: boolean } {
  // `t` may be fractional — cos/sin interpolate continuously, then floor
  // to pixel grid. typing beat uses floored int so on/off flip is defined.
  const a = t / 60;
  const x = Math.floor(128 + Math.cos(a) * 5);
  const y = Math.floor(248 + Math.sin(a * 1.2) * 4);
  const typing = (Math.floor(t) % 48) < 4;
  return { x, y, typing };
}

// Prompt Engineer at a floating desk — fourth companion in the
// Inspector → Bartender → Cosmonaut → Prompt-Engineer arc. At AGI
// scale physical presence stopped mattering; he's a pattern that
// thinks he's a dev, typing into a terminal wired to the black hole.
function PromptEngineer(_props: { t: number }) {
  useTick(50);
  const t = Date.now() / 200;
  const { x, y, typing } = promptEngineerPos(t);
  const hb = typing ? 1 : 0;
  // Power/latency cable trailing from behind the laptop toward the hole —
  // catenary-ish curve via 5 sample points wobbling on sin(t).
  const cableSegs: string[] = [];
  cableSegs.push(`M ${x + 16} ${y + 3}`);
  for (let i = 1; i <= 5; i++) {
    const cxp = x + 16 + i * 5;
    const cyp = y + 3 + Math.sin((t / 14) + i) * 2 - i;
    cableSegs.push(`L ${Math.floor(cxp)} ${Math.floor(cyp)}`);
  }
  const cablePath = cableSegs.join(" ");
  // Scrolling terminal code lines
  const codeLines: React.ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    const on = ((t >> 1) + i * 2) % 7 < 4;
    if (on) codeLines.push(<PixelRect key={`cl${i}`} x={x + 5} y={y + 5 + i} w={7} h={1} c="#46EEDC" />);
  }
  return (
    <G>
      {/* Thin power/latency cable */}
      <Path d={cablePath} stroke="#3A2A44" strokeWidth={1} fill="none" opacity={0.55} />
      {/* Cool space glow halo so the dev separates from deep space */}
      <Rect x={x - 4} y={y - 12} width={34} height={36} fill="#33506E" opacity={0.28} />
      <Rect x={x - 7} y={y - 15} width={40} height={42} fill="#243A52" opacity={0.16} />
      {/* Warm accretion rim wash on the hole-facing (right) side */}
      <Rect x={x + 12} y={y - 10} width={16} height={30} fill="#E8702A" opacity={0.18} />
      {/* Floating desk: thin flat slab, no legs, cyan underglow */}
      <PixelRect x={x} y={y + 12} w={26} h={3} c="#3A3646" />
      <PixelRect x={x} y={y + 12} w={26} h={1} c="#5A5468" />
      <Rect x={x + 2} y={y + 15} width={22} height={2} fill="#5AC8E0" opacity={0.4} />
      {/* Dev figure: dark hoodie torso + shoulder highlight + arm variants */}
      <PixelRect x={x + 5} y={y + 1} w={12} h={12} c="#40404E" />
      <PixelRect x={x + 5} y={y + 1} w={12} h={2}  c="#565466" />
      <PixelRect x={x + 5} y={y + 1} w={2}  h={12} c="#4A4856" />
      <Px x={x + 16} y={y + 4} c="#F0863A" />
      <Px x={x + 16} y={y + 6} c="#E8702A" />
      <PixelRect x={x + 5} y={y + 10} w={2} h={3} c="#2A2834" />
      <PixelRect x={x + 7} y={y - 1}  w={8} h={2} c="#4A4856" />
      {/* Head + gaming headset (bobs on typing burst) */}
      <PixelRect x={x + 7}  y={y - 7 - hb} w={8}  h={7} c="#E0B084" />
      <PixelRect x={x + 7}  y={y - 7 - hb} w={8}  h={2} c="#F0C89C" />
      <Px x={x + 13} y={y - 3 - hb} c="#F0863A" />
      <PixelRect x={x + 6}  y={y - 8 - hb} w={10} h={2} c="#20202A" />
      <PixelRect x={x + 6}  y={y - 6 - hb} w={2}  h={4} c="#2C2C38" />
      <PixelRect x={x + 14} y={y - 6 - hb} w={2}  h={4} c="#2C2C38" />
      <PixelRect x={x + 6}  y={y - 2 - hb} w={1}  h={3} c="#2C2C38" />
      <Px x={x + 6} y={y + 1 - hb} c={(t >> 2) % 2 ? "#7EE0FF" : "#2A6A7A"} />
      {/* Hands on keyboard (bob on typing burst) */}
      <PixelRect x={x + 5}  y={y + 9 + hb} w={3} h={2} c="#E0B084" />
      <PixelRect x={x + 13} y={y + 9 + hb} w={3} h={2} c="#E0B084" />
      {/* Laptop: lid/back + tilted terminal + scrolling code + cursor */}
      <PixelRect x={x + 3} y={y + 3} w={15} h={9} c="#20202A" />
      <PixelRect x={x + 3} y={y + 3} w={15} h={1} c="#3A3A46" />
      <PixelRect x={x + 4} y={y + 4} w={13} h={7} c="#0A2E38" />
      {codeLines}
      {((t >> 2) % 2) === 1 && <Px x={x + 15} y={y + 8} c="#8CFFF0" />}
      <Rect x={x + 3} y={y + 3} width={15} height={9} fill="#3FE0D0" opacity={0.45} />
      <PixelRect x={x + 4} y={y + 12} w={15} h={2} c="#2E2E3A" />
      <Px x={x + 17} y={y + 3} c="#F0863A" />
      {/* Energy drink can beside the laptop (red + white band) */}
      <PixelRect x={x + 20} y={y + 6} w={3} h={6} c="#E03A32" />
      <PixelRect x={x + 20} y={y + 8} w={3} h={1} c="#F5F0E8" />
      <Px x={x + 21} y={y + 6} c="#F5A0A0" />
    </G>
  );
}

// Prompt Engineer's speech bubble — deep-purple + hot-magenta palette
// pulled from the accretion glow so it reads as "signal from the black
// hole." Terminal-prompt "> " sigil at the tail hints the quip was typed
// out loud from his terminal. Cycle offset +9s from Inspector.
//
// Word-wrap: Silkscreen at 6pt renders ~4.3 px/char (undermeasured as 3
// in the original port — this is why long quips got mid-word truncated
// even after the 224 width cap). The bubble now grows to 2 rows for
// quips that don't fit on one line, splitting at the nearest word
// boundary to the midpoint. All 8 current quips fit in 1 or 2 rows.
function PromptEngineerQuip({ t }: { t: number }) {
  const { x, y } = promptEngineerPos(Date.now() / 200);
  const qx = x + 11;
  const cycle = ((t / 24) + 9) % 12;
  if (cycle > 4) return null;
  const idx = Math.floor(((t / 24) + 9) / 12) % AGI_PROMPT_ENGINEER_QUIPS.length;
  const text = AGI_PROMPT_ENGINEER_QUIPS[idx];

  const CHAR_W = 4.3;                              // Silkscreen 6pt real width
  // Narrow cap (was 224) so quips wrap into 2 short lines instead of
  // one wide banner that stretches across the whole scene. Match cat /
  // cosmonaut bubble widths for consistent visual language.
  const MAX_BUBBLE_W = 150;
  // Both lines start at bubbleX + 10 (past the `>` sigil), so both use
  // the same 12 px padding (10 left + 2 right) for their character cap.
  const LINE1_CAP = Math.floor((MAX_BUBBLE_W - 12) / CHAR_W); // ~49 chars
  const LINE2_CAP = LINE1_CAP;                                // same cap for both lines

  // Wrap into 1 or 2 lines. Split at nearest word boundary to LINE1_CAP;
  // if no space is found in a sane range, hard-split at cap.
  const lines: string[] = [];
  if (text.length <= LINE1_CAP) {
    lines.push(text);
  } else {
    let split = text.lastIndexOf(" ", LINE1_CAP);
    if (split < LINE1_CAP * 0.4) split = text.indexOf(" ", LINE1_CAP);
    if (split < 0 || split >= text.length) split = LINE1_CAP;
    const l1 = text.slice(0, split).trim();
    let l2 = text.slice(split).trim();
    if (l2.length > LINE2_CAP) l2 = l2.slice(0, LINE2_CAP - 1) + "…";
    lines.push(l1);
    lines.push(l2);
  }

  const rowH = 10;
  const bubbleH = 4 + lines.length * rowH;
  // Bubble width = widest line's rendered width + shared 12 px padding
  // (both lines start at bubbleX + 10, 2 px right margin).
  const line1W = lines[0].length * CHAR_W + 12;
  const line2W = lines[1] ? lines[1].length * CHAR_W + 12 : 0;
  const bubbleW = Math.min(MAX_BUBBLE_W, Math.max(line1W, line2W));
  const bubbleX = Math.max(2, Math.min(qx - bubbleW / 2, 238 - bubbleW - 2));
  const qy = y - (bubbleH - 2);
  const bubbleY = Math.max(2, qy - 16);
  const clipId = `pe-quip-clip-${idx}-${lines.length}`;

  return (
    <G>
      <Defs>
        <ClipPath id={clipId}>
          <Rect x={bubbleX + 9} y={bubbleY} width={bubbleW - 11} height={bubbleH} />
        </ClipPath>
      </Defs>
      {/* Bubble body — deep-purple + hot-magenta border */}
      <PixelRect x={bubbleX}                 y={bubbleY}              w={bubbleW} h={bubbleH} c="#1A0E22" />
      <PixelRect x={bubbleX}                 y={bubbleY}              w={bubbleW} h={1}       c="#E85AFF" />
      <PixelRect x={bubbleX}                 y={bubbleY + bubbleH - 1} w={bubbleW} h={1}      c="#6A2A7A" />
      <PixelRect x={bubbleX}                 y={bubbleY}              w={1}       h={bubbleH} c="#E85AFF" />
      <PixelRect x={bubbleX + bubbleW - 1}   y={bubbleY}              w={1}       h={bubbleH} c="#6A2A7A" />
      {/* Tail down to the terminal */}
      <PixelRect x={qx - 1} y={bubbleY + bubbleH} w={3} h={2} c="#1A0E22" />
      <Px x={qx} y={bubbleY + bubbleH + 2} c="#E85AFF" />
      {/* Terminal-prompt "> " sigil on first row */}
      <SvgText
        x={bubbleX + 3}
        y={bubbleY + 8}
        fontSize={6}
        fontFamily={fonts.displayRegular}
        fill="#E85AFF"
      >
        {">"}
      </SvgText>
      {/* Wrapped quip lines — clipped to bubble interior. BOTH lines
          start at the same left edge (bubbleX + 10) so the second row
          is aligned with the first past the `>` sigil, and neither
          line's first char gets shaved by the clipPath (which starts
          at bubbleX + 9). Aligning also reads cleaner as a "continued
          thought" than a hanging indent would. */}
      <G clipPath={`url(#${clipId})`}>
        {lines.map((line, i) => (
          <SvgText
            key={`peline${i}`}
            x={bubbleX + 10}
            y={bubbleY + 8 + i * rowH}
            fontSize={6}
            fontFamily={fonts.displayRegular}
            fill="#F0D8FF"
          >
            {line}
          </SvgText>
        ))}
      </G>
    </G>
  );
}

function AGIScene({ t }: { t: number }) {
  const cx = 120, cy = 150;

  // Lensed starfield — stars that bend around the hole within d<72.
  const starElems = React.useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let i = 0; i < 130; i++) {
      const x0 = (i * 71 + (i * i) % 17) % W;
      const y0 = (i * 43 + (i % 7) * 11) % H;
      const dx = x0 - cx, dy = y0 - cy, d = Math.hypot(dx, dy);
      if (d < 24) continue;
      let sx = x0, sy = y0;
      if (d < 72) {
        const ang = Math.atan2(dy, dx) + ((72 - d) / 72) * 0.8;
        sx = cx + Math.cos(ang) * d;
        sy = cy + Math.sin(ang) * d;
      }
      const tier = i % 5;
      const c = tier === 0 ? "#FFFFFF" : tier === 1 ? "#C8D4E6" : "#7C8AA0";
      out.push(<Px key={`st${i}`} x={sx | 0} y={sy | 0} c={c} />);
    }
    return out;
  }, []);

  // Infalling gas streams — 3 spirals decaying into the disk.
  const infall: React.ReactNode[] = [];
  let ifk = 0;
  for (let s = 0; s < 3; s++) {
    const base = s * 2.1 + t / 60;
    for (let i = 0; i < 26; i++) {
      const a = base + i * 0.26, rr = 98 - i * 3;
      if (rr < 30) break;
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr * 0.42;
      if ((t + i * 3 + s * 7) % 12 < 7) {
        const col = i < 8 ? "#FFB84A" : i < 16 ? "#E8702A" : "#7A2A1E";
        infall.push(<Px key={`if${ifk++}`} x={x | 0} y={y | 0} c={col} />);
      }
    }
  }

  // Accretion-glow wash behind everything (6 nested low-alpha ellipses).
  const wash: React.ReactNode[] = [];
  for (let g = 6; g > 0; g--) {
    wash.push(
      <Ellipse key={`w${g}`} cx={cx} cy={cy} rx={g * 22} ry={g * 16}
        fill={g > 3 ? "#3A1A40" : "#5C2A20"} opacity={0.05} />
    );
  }

  return (
    <G>
      <Defs>
        <SvgLinearGradient id="agi-bg" x1="0" y1="0" x2="0" y2={H}>
          <Stop offset="0" stopColor="#06050C" />
          <Stop offset="1" stopColor="#0C091A" />
        </SvgLinearGradient>
      </Defs>

      {/* Backdrop */}
      <Rect x={0} y={0} width={W} height={H} fill="url(#agi-bg)" />

      {/* Accretion-glow wash */}
      {wash}

      {/* Lensed starfield (stars curve around the hole) */}
      {starElems}

      {/* Distant background galaxies — purple + amber */}
      <SpiralGalaxy cx={40} cy={58} R={18} ry={8} t={t} spin={0.5} core="#C9A0E0" arm="#7A5AA8" />
      <SpiralGalaxy cx={200} cy={320} R={14} ry={6} t={t} spin={2.1} core="#E0C090" arm="#A8804A" />

      {/* Tiny edge-on galaxy (top-mid, gold core) */}
      <Rect x={150} y={40} width={16} height={1} fill="#C8D4E6" opacity={0.7} />
      <Rect x={154} y={39} width={8}  height={1} fill="#FBF7EC" opacity={0.7} />
      <Rect x={156} y={38} width={4}  height={1} fill="#FFFFFF" opacity={0.7} />

      {/* The black hole centerpiece */}
      <BlackHole cx={cx} cy={cy} t={t} />

      {/* Infalling gas streams spiraling into the disk */}
      {infall}

      {/* PRODUCER ANCHORS */}
      <DysonSwarm cx={34} cy={288} t={t} />
      {/* Energy anchor — Dyson Sphere (caged star + collimated tap beam),
          replaces the older Quasar Tap. */}
      <DysonStar cx={208} cy={288} t={t} />
      <SpiralGalaxy cx={206} cy={70} R={20} ry={9} t={t} spin={1.2} core="#A4F0D0" arm="#3F8A6A" />
      <PixelRect x={204} y={68} w={4} h={4} c="#CFFBE8" />

      {/* TRAINING RUN target — Stellar Forge (protostar igniting). Tap on it
          opens the Training Run modal; coords match the design's lower-left
          placement (32, 200). */}
      <StellarForge cx={32} cy={200} t={t} />

      {/* R12 · AGI badge (bottom-left) */}
      <PixelRect x={4} y={H - 22} w={92} h={18} c="#0E0A18" />
      <PixelRect x={4} y={H - 22} w={92} h={1}  c="#5C2050" />
      <PixelRect x={4} y={H - 5}  w={92} h={1}  c="#5C2050" />
      <PixelRect x={8}  y={H - 19} w={4} h={12} c="#D45A68" />
      <PixelRect x={14} y={H - 19} w={4} h={12} c="#D45A68" />
      <PixelRect x={20} y={H - 13} w={4} h={6}  c="#D45A68" />
      <PixelRect x={30} y={H - 17} w={62} h={1} c="#EBBE6E" />
      <PixelRect x={30} y={H - 13} w={52} h={1} c="#FBF7EC" />
      <PixelRect x={30} y={H - 9}  w={42} h={1} c="#D45A68" />

      <FloatingTokens spawnX={100} spawnY={190} t={t} />

      {/* Prompt Engineer — fourth companion in the Inspector/Bartender/
          Cosmonaut/Prompt-Engineer arc. Sits at a floating desk near
          the black hole, typing into a terminal wired to the singularity.
          Quip bubble drawn LAST so it sits above every scene sprite. */}
      <PromptEngineer t={t} />
      <PromptEngineerQuip t={t} />
    </G>
  );
}

// ─── Tick hook ──────────────────────────────────────────────────────────
// Anchored to wall-clock time so that sprite animations (Inspector patrol,
// Endurance ring spin, star twinkle, etc.) resume from where they were
// visually when the player navigates away and comes back — instead of
// reseting to t=0 on remount. The setInterval only exists to force a
// re-render at the tick rate; the actual returned value is derived from
// `Date.now()` so the animation phase is deterministic across mounts.
// Was a plain counter (setT(n+1)) — that reset every time the Home screen
// remounted after the player opened Producers/Research/Allocate.
export function useTick(periodMs: number): number {
  const [, forceRender] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => forceRender((n) => (n + 1) % 100_000), periodMs);
    return () => clearInterval(id);
  }, [periodMs]);
  return Math.floor(Date.now() / periodMs) % 100_000;
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
