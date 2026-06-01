// Achievements — GDD §10 Content Systems + §15 (P1 screen).
// Goal: ~100 at v1.0 across five buckets:
//   - Milestone (~30): "Closed Series A."
//   - Quantity grind (~25): "Hire 1,000 engineers."
//   - Subtle / hidden (~15): "Refuse every Slack DM for a full session."
//   - Comedy / parody (~20): "Achievement Unlocked: Achievement Unlocked."
//   - Endgame / AGI (~10): "The model has reached you."
//
// This file ships the first batch (30) covering all five buckets so the
// grid screen isn't an empty promise. Adding more is data-only — no code.
//
// Pure data + predicate. No store, no UI, no side effects. The store's
// `processAchievementUnlocks` evaluates conditions against an
// AchievementContext snapshot (mirrors the vignettes pattern).

import { Decimal } from "./decimal";
import { ChainId } from "./types";

// ─── Buckets ─────────────────────────────────────────────────────────────
export type AchievementBucket =
  | "milestone"
  | "grind"
  | "subtle"
  | "comedy"
  | "endgame";

// ─── Conditions ──────────────────────────────────────────────────────────
// Discriminated union — keep the set small enough that the evaluator stays
// readable. Anything that needs persistent counters beyond the snapshot
// (e.g. "highest training tier ever rolled", "longest run streak") is a v2
// addition; for v1 every condition is evaluable from current state.
export type AchievementCondition =
  // Played past a funding round (reached idx OR higher).
  | { kind: "reach_round"; roundIdx: number }
  // Closed N total funding rounds.
  | { kind: "prestige_count"; n: number }
  // Own N of a specific chain (sums across all tiers in that chain).
  | { kind: "chain_count"; chain: ChainId; n: number }
  // Sum of all owned producers across all chains.
  | { kind: "total_producers"; n: number }
  // Run-current tokens reached 10^n at some tick (stays unlocked across prestige).
  | { kind: "tokens_log10"; n: number }
  // Player has unlocked N research nodes (cumulative, persists).
  | { kind: "research_count"; n: number }
  // Player has unlocked all research nodes in a specific branch.
  | { kind: "research_branch_complete"; branch: string }
  // Player has bought N sprint upgrades in the CURRENT run.
  | { kind: "sprint_count_in_run"; n: number }
  // Cumulative number of vignettes ever unlocked.
  | { kind: "vignette_count"; n: number }
  // A specific debt threshold has fired.
  | { kind: "debt_threshold"; level: number }
  // Cumulative count of distinct debt thresholds fired.
  | { kind: "debt_thresholds_fired_count"; n: number }
  // Own N Autonomous Agents in the current run (AGI arc).
  | { kind: "autonomous_agent_count"; n: number }
  // Player owns the Autonomous Agent producer at all (first one).
  | { kind: "any_autonomous_agent" };

// ─── Achievement shape ───────────────────────────────────────────────────
export interface AchievementDef {
  id: string;
  name: string;                 // shown in the grid; comedy-first writing
  description: string;          // one-line flavor; hidden until unlock for "subtle"
  bucket: AchievementBucket;
  condition: AchievementCondition;
}

// ─── Eval context ────────────────────────────────────────────────────────
// Snapshot passed in by the store every tick / buy / prestige. Same idea as
// UnlockContext in vignettes.ts but with the extra fields achievements care
// about (research/sprint/agent counts).
export interface AchievementContext {
  fundingRoundIdx: number;
  totalPrestiges: number;
  tokens: Decimal;
  producersOwned: Record<string, number>;
  totalProducersOwned: number;
  // Chain → sum of all producers in that chain (precomputed by caller).
  producersByChain: Record<ChainId, number>;
  unlockedResearch: string[];
  unlockedVignettes: string[];
  sprintUpgradesInRun: string[];
  firedDebtThresholds: number[];
  autonomousAgentCount: number;
}

// ─── Inventory (V01–V30 first batch) ─────────────────────────────────────
// IDs are stable save-state keys; renaming an id silently deletes the
// player's unlock. Renaming `name`/`description` is safe.
//
// Tone bible per GDD §10: "Achievement writing is comedy-first. Persona B
// will screenshot at least 5 per playthrough. Persona A will spreadsheet
// completion %."
export const ACHIEVEMENTS: AchievementDef[] = [
  // ─── Milestone (closed rounds, first events) ───────────────────────────
  {
    id: "a_first_hire",
    name: "Hello world",
    description: "Hire your first new producer of any chain.",
    bucket: "milestone",
    condition: { kind: "total_producers", n: 11 }, // starter is 10
  },
  {
    id: "a_closed_seed",
    name: "Out of the garage",
    description: "Close the Seed round.",
    bucket: "milestone",
    condition: { kind: "reach_round", roundIdx: 1 },
  },
  {
    id: "a_closed_series_a",
    name: "Series A — Vision 2030",
    description: "Close Series A.",
    bucket: "milestone",
    condition: { kind: "reach_round", roundIdx: 2 },
  },
  {
    id: "a_closed_series_c",
    name: "Dominant in five categories",
    description: "Close Series C.",
    bucket: "milestone",
    condition: { kind: "reach_round", roundIdx: 4 },
  },
  {
    id: "a_closed_ipo",
    name: "Rang the bell",
    description: "Close the IPO round.",
    bucket: "milestone",
    condition: { kind: "reach_round", roundIdx: 6 },
  },
  {
    id: "a_first_research",
    name: "Permanent multipliers stall (no longer)",
    description: "Unlock your first research node.",
    bucket: "milestone",
    condition: { kind: "research_count", n: 1 },
  },
  {
    id: "a_first_sprint",
    name: "Sprint zero",
    description: "Buy your first per-run sprint upgrade.",
    bucket: "milestone",
    condition: { kind: "sprint_count_in_run", n: 1 },
  },
  {
    id: "a_first_vignette",
    name: "you have one (1) unread DM",
    description: "Unlock your first vignette.",
    bucket: "milestone",
    condition: { kind: "vignette_count", n: 1 },
  },

  // ─── Quantity grind ────────────────────────────────────────────────────
  {
    id: "a_hire_engineers_100",
    name: "Real headcount",
    description: "Own 100 producers across the Engineers chain.",
    bucket: "grind",
    condition: { kind: "chain_count", chain: "engineers", n: 100 },
  },
  {
    id: "a_hire_engineers_500",
    name: "Reorg-resistant",
    description: "Own 500 producers across the Engineers chain.",
    bucket: "grind",
    condition: { kind: "chain_count", chain: "engineers", n: 500 },
  },
  {
    id: "a_gpu_100",
    name: "Cluster operator",
    description: "Own 100 producers across the GPU chain.",
    bucket: "grind",
    condition: { kind: "chain_count", chain: "gpu", n: 100 },
  },
  {
    id: "a_data_100",
    name: "Data hoarder",
    description: "Own 100 producers across the Data chain.",
    bucket: "grind",
    condition: { kind: "chain_count", chain: "data", n: 100 },
  },
  {
    id: "a_energy_100",
    name: "Grid customer",
    description: "Own 100 producers across the Energy chain.",
    bucket: "grind",
    condition: { kind: "chain_count", chain: "energy", n: 100 },
  },
  {
    id: "a_tokens_1e6",
    name: "Six zeroes",
    description: "Reach 1,000,000 tokens in a single run.",
    bucket: "grind",
    condition: { kind: "tokens_log10", n: 6 },
  },
  {
    id: "a_tokens_1e30",
    name: "Numbers go vertical",
    description: "Reach 1e30 tokens in a single run.",
    bucket: "grind",
    condition: { kind: "tokens_log10", n: 30 },
  },
  {
    id: "a_tokens_1e100",
    name: "There is no normal",
    description: "Reach 1e100 tokens in a single run.",
    bucket: "grind",
    condition: { kind: "tokens_log10", n: 100 },
  },
  {
    id: "a_prestige_5",
    name: "Returning founder",
    description: "Close 5 funding rounds total.",
    bucket: "grind",
    condition: { kind: "prestige_count", n: 5 },
  },
  {
    id: "a_prestige_10",
    name: "Serial founder",
    description: "Close 10 funding rounds total.",
    bucket: "grind",
    condition: { kind: "prestige_count", n: 10 },
  },

  // ─── Subtle / hidden ───────────────────────────────────────────────────
  // These show as "???" + "Hidden" in the grid until unlocked.
  {
    id: "a_vignette_collector",
    name: "Filed under \"context\"",
    description: "Unlock 20 different vignettes.",
    bucket: "subtle",
    condition: { kind: "vignette_count", n: 20 },
  },
  {
    id: "a_full_sprint",
    name: "Sprint maxed",
    description: "Own all 5 sprint upgrades in a single run.",
    bucket: "subtle",
    condition: { kind: "sprint_count_in_run", n: 5 },
  },
  {
    id: "a_branch_complete_rd",
    name: "R&D branch — fully fielded",
    description: "Unlock every node in the R&D research branch.",
    bucket: "subtle",
    condition: { kind: "research_branch_complete", branch: "rd" },
  },
  {
    id: "a_branch_complete_safety",
    name: "Safety branch — paid in full",
    description: "Unlock every node in the Safety research branch.",
    bucket: "subtle",
    condition: { kind: "research_branch_complete", branch: "safety" },
  },

  // ─── Comedy / parody ───────────────────────────────────────────────────
  {
    id: "a_intern_army",
    name: "Intern army",
    description: "Own 1,000 Interns. (Why are you doing this.)",
    bucket: "comedy",
    condition: { kind: "chain_count", chain: "engineers", n: 1000 },
  },
  {
    id: "a_debt_collector",
    name: "5 distinct ways to look bad",
    description: "Fire 5 different alignment-debt threshold events.",
    bucket: "comedy",
    condition: { kind: "debt_thresholds_fired_count", n: 5 },
  },
  {
    id: "a_pr_crisis",
    name: "PR Crisis: first event",
    description: "Fire your first alignment-debt threshold event (debt 10).",
    bucket: "comedy",
    condition: { kind: "debt_threshold", level: 10 },
  },
  {
    id: "a_congressional",
    name: "Senator, we run on attention",
    description: "Trigger the Congressional Hearing (alignment debt 200).",
    bucket: "comedy",
    condition: { kind: "debt_threshold", level: 200 },
  },

  // ─── Endgame / AGI arc ─────────────────────────────────────────────────
  {
    id: "a_entered_agi_arc",
    name: "Acquired by the future",
    description: "Reach the Acquisition round and unlock the Autonomous Agent.",
    bucket: "endgame",
    condition: { kind: "reach_round", roundIdx: 7 },
  },
  {
    id: "a_first_agent",
    name: "First agent online",
    description: "Buy your first Autonomous Agent.",
    bucket: "endgame",
    condition: { kind: "any_autonomous_agent" },
  },
  {
    id: "a_ten_agents",
    name: "It is hiring itself",
    description: "Own 10 Autonomous Agents simultaneously.",
    bucket: "endgame",
    condition: { kind: "autonomous_agent_count", n: 10 },
  },
  {
    id: "a_agi_singularity",
    name: "The model has reached you",
    description: "Close the AGI Singularity Round.",
    bucket: "endgame",
    condition: { kind: "reach_round", roundIdx: 12 },
  },
];

// ─── Lookup helpers ──────────────────────────────────────────────────────
export const ACHIEVEMENT_BY_ID: Record<string, AchievementDef> =
  Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export function getAchievement(id: string): AchievementDef | undefined {
  return ACHIEVEMENT_BY_ID[id];
}

// ─── Branch index for research_branch_complete ───────────────────────────
// Lazy-computed map (branch → list of node ids) so the predicate doesn't
// re-walk RESEARCH_NODES on every tick. The caller passes the node list
// once (avoids a circular import with research.ts).

let branchIndex: Map<string, string[]> | null = null;
export function setResearchBranchIndex(idx: Map<string, string[]>) {
  branchIndex = idx;
}

// ─── Predicate ───────────────────────────────────────────────────────────
export function isConditionMet(
  cond: AchievementCondition,
  ctx: AchievementContext,
): boolean {
  switch (cond.kind) {
    case "reach_round":
      return ctx.fundingRoundIdx >= cond.roundIdx;
    case "prestige_count":
      return ctx.totalPrestiges >= cond.n;
    case "chain_count":
      return (ctx.producersByChain[cond.chain] ?? 0) >= cond.n;
    case "total_producers":
      return ctx.totalProducersOwned >= cond.n;
    case "tokens_log10":
      return ctx.tokens.gte(Decimal.pow(10, cond.n));
    case "research_count":
      return ctx.unlockedResearch.length >= cond.n;
    case "research_branch_complete": {
      if (!branchIndex) return false;
      const ids = branchIndex.get(cond.branch);
      if (!ids || ids.length === 0) return false;
      return ids.every((id) => ctx.unlockedResearch.includes(id));
    }
    case "sprint_count_in_run":
      return ctx.sprintUpgradesInRun.length >= cond.n;
    case "vignette_count":
      return ctx.unlockedVignettes.length >= cond.n;
    case "debt_threshold":
      return ctx.firedDebtThresholds.includes(cond.level);
    case "debt_thresholds_fired_count":
      return ctx.firedDebtThresholds.length >= cond.n;
    case "autonomous_agent_count":
      return ctx.autonomousAgentCount >= cond.n;
    case "any_autonomous_agent":
      return ctx.autonomousAgentCount >= 1;
  }
}

/**
 * Return the IDs of all achievements whose condition is currently met AND
 * which the player hasn't yet unlocked. Stable insertion order.
 */
export function pendingAchievementUnlocks(
  ctx: AchievementContext,
  alreadyUnlocked: string[],
): string[] {
  const have = new Set(alreadyUnlocked);
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (have.has(a.id)) continue;
    if (isConditionMet(a.condition, ctx)) out.push(a.id);
  }
  return out;
}
