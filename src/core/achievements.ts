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
    name: "Bootstrap — Vision 2030",
    description: "Close Bootstrap.",
    bucket: "milestone",
    condition: { kind: "reach_round", roundIdx: 2 },
  },
  {
    id: "a_closed_ipo",
    name: "Rang the bell",
    description: "Close the Startup Office round.",
    bucket: "milestone",
    condition: { kind: "reach_round", roundIdx: 4 },
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
    description: "Reach the Big Tech round and unlock the Autonomous Agent.",
    bucket: "endgame",
    condition: { kind: "reach_round", roundIdx: 5 },
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
    condition: { kind: "reach_round", roundIdx: 10 },
  },

  // ─── V31–V68: second batch ─────────────────────────────────────────────
  // Fills the missing round-close milestones, deeper grind tiers, more
  // hidden/subtle finds, broader comedy coverage, and the rest of the
  // endgame ladder. Pure data; no predicate or store changes.

  // Milestones — every funding-round close gets its own line so the grid
  // tells the story of the company chronologically.
  {
    id: "a_closed_series_b",
    name: "Out of the bench, into the lease",
    description: "Close Coworking.",
    bucket: "milestone",
    condition: { kind: "reach_round", roundIdx: 3 },
  },
  {
    id: "a_closed_secondary",
    name: "Liquidity is a feeling",
    description: "Close the Megacorp round.",
    bucket: "milestone",
    condition: { kind: "reach_round", roundIdx: 5 },
  },
  {
    id: "a_closed_acquisition",
    name: "Strategic partner",
    description: "Close the Big Tech round.",
    bucket: "milestone",
    condition: { kind: "reach_round", roundIdx: 6 },
  },
  {
    id: "a_closed_sovereign",
    name: "Camera off, audio off, voting",
    description: "Close the Campus round.",
    bucket: "milestone",
    condition: { kind: "reach_round", roundIdx: 7 },
  },
  {
    id: "a_closed_bailout",
    name: "Liquidity bridge",
    description: "Close the Datacenter round.",
    bucket: "milestone",
    condition: { kind: "reach_round", roundIdx: 8 },
  },
  {
    id: "a_closed_civilizational",
    name: "Three sovereign nations and an individual",
    description: "Close the Planetary round.",
    bucket: "milestone",
    condition: { kind: "reach_round", roundIdx: 9 },
  },
  {
    id: "a_first_prestige",
    name: "Fresh round, same team",
    description: "Close your first funding round.",
    bucket: "milestone",
    condition: { kind: "prestige_count", n: 1 },
  },

  // Grind — bigger numbers across chains, research counts, prestige stacks.
  {
    id: "a_hire_engineers_1000",
    name: "Symbolic 1000",
    description: "Own 1,000 producers across the Engineers chain.",
    bucket: "grind",
    condition: { kind: "chain_count", chain: "engineers", n: 1000 },
  },
  {
    id: "a_gpu_500",
    name: "Capacity team got a Slack channel",
    description: "Own 500 producers across the GPU chain.",
    bucket: "grind",
    condition: { kind: "chain_count", chain: "gpu", n: 500 },
  },
  {
    id: "a_data_500",
    name: "Eleven active data partnerships",
    description: "Own 500 producers across the Data chain.",
    bucket: "grind",
    condition: { kind: "chain_count", chain: "data", n: 500 },
  },
  {
    id: "a_energy_500",
    name: "Procurement is four people",
    description: "Own 500 producers across the Energy chain.",
    bucket: "grind",
    condition: { kind: "chain_count", chain: "energy", n: 500 },
  },
  {
    id: "a_total_producers_500",
    name: "Operating at scale",
    description: "Own 500 producers across all chains.",
    bucket: "grind",
    condition: { kind: "total_producers", n: 500 },
  },
  {
    id: "a_research_count_10",
    name: "Tech tree — partial credit",
    description: "Unlock 10 research nodes.",
    bucket: "grind",
    condition: { kind: "research_count", n: 10 },
  },
  {
    id: "a_tokens_1e15",
    name: "Crossed the petascale",
    description: "Reach 1e15 tokens in a single run.",
    bucket: "grind",
    condition: { kind: "tokens_log10", n: 15 },
  },
  {
    id: "a_prestige_20",
    name: "Twenty rounds. Twenty.",
    description: "Close 20 funding rounds total.",
    bucket: "grind",
    condition: { kind: "prestige_count", n: 20 },
  },

  // Subtle / hidden — show as "???" until unlocked.
  {
    id: "a_branch_complete_compute",
    name: "Compute branch — paid in full",
    description: "Unlock every node in the Compute research branch.",
    bucket: "subtle",
    condition: { kind: "research_branch_complete", branch: "compute" },
  },
  {
    id: "a_branch_complete_data",
    name: "Data branch — paid in full",
    description: "Unlock every node in the Data research branch.",
    bucket: "subtle",
    condition: { kind: "research_branch_complete", branch: "data" },
  },
  {
    id: "a_branch_complete_energy",
    name: "Energy branch — paid in full",
    description: "Unlock every node in the Energy research branch.",
    bucket: "subtle",
    condition: { kind: "research_branch_complete", branch: "energy" },
  },
  {
    id: "a_branch_complete_capital",
    name: "Capital branch — paid in full",
    description: "Unlock every node in the Capital research branch.",
    bucket: "subtle",
    condition: { kind: "research_branch_complete", branch: "capital" },
  },
  {
    id: "a_vignette_collector_40",
    name: "Filed under \"more context\"",
    description: "Unlock 40 different vignettes.",
    bucket: "subtle",
    condition: { kind: "vignette_count", n: 40 },
  },
  {
    id: "a_safety_unsealed",
    name: "The bell can't be unrung",
    description: "Trigger the existential-threshold event (debt 400).",
    bucket: "subtle",
    condition: { kind: "debt_threshold", level: 400 },
  },

  // Comedy / parody — the screenshot-worthy bucket per GDD §10 tone bible.
  {
    id: "a_intern_only",
    name: "Just the interns",
    description: "Own 250 Interns. Specifically interns.",
    bucket: "comedy",
    condition: { kind: "chain_count", chain: "engineers", n: 250 },
  },
  {
    id: "a_doom_loop",
    name: "Reframing engagement",
    description: "Fire the DAUs-down threshold event (debt 100).",
    bucket: "comedy",
    condition: { kind: "debt_threshold", level: 100 },
  },
  {
    id: "a_regulator_visit",
    name: "Industry best practices",
    description: "Fire the regulator-on-site event (debt 25).",
    bucket: "comedy",
    condition: { kind: "debt_threshold", level: 25 },
  },
  {
    id: "a_incident_zero",
    name: "Resolved (verbally)",
    description: "Fire the production-routing event (debt 50).",
    bucket: "comedy",
    condition: { kind: "debt_threshold", level: 50 },
  },
  {
    id: "a_six_zeroes_dejavu",
    name: "Numbers go vertical (again)",
    description: "Reach 1e60 tokens in a single run.",
    bucket: "comedy",
    condition: { kind: "tokens_log10", n: 60 },
  },
  {
    id: "a_tokens_1e200",
    name: "Heat-death warning",
    description: "Reach 1e200 tokens in a single run.",
    bucket: "comedy",
    condition: { kind: "tokens_log10", n: 200 },
  },
  {
    id: "a_research_count_25",
    name: "Tech tree — mostly fielded",
    description: "Unlock 25 research nodes. The OKR was \"improve the OKR process.\"",
    bucket: "comedy",
    condition: { kind: "research_count", n: 25 },
  },
  {
    id: "a_vignette_seed_only",
    name: "Five DMs deep",
    description: "Unlock 5 different vignettes. Inbox unread: still 5.",
    bucket: "comedy",
    condition: { kind: "vignette_count", n: 5 },
  },
  {
    id: "a_prestige_3_subtweet",
    name: "Three rounds in",
    description: "Close 3 funding rounds. The founder needs a therapist.",
    bucket: "comedy",
    condition: { kind: "prestige_count", n: 3 },
  },
  {
    id: "a_two_chains_grind",
    name: "Vertically integrated (allegedly)",
    description: "Own 250 producers across the GPU chain.",
    bucket: "comedy",
    condition: { kind: "chain_count", chain: "gpu", n: 250 },
  },

  // Endgame / AGI arc — fills the ladder between first agent and singularity.
  {
    id: "a_agents_25",
    name: "It is hiring its managers",
    description: "Own 25 Autonomous Agents simultaneously.",
    bucket: "endgame",
    condition: { kind: "autonomous_agent_count", n: 25 },
  },
  {
    id: "a_agents_50",
    name: "Org chart is a directed graph",
    description: "Own 50 Autonomous Agents simultaneously.",
    bucket: "endgame",
    condition: { kind: "autonomous_agent_count", n: 50 },
  },
  {
    id: "a_agents_100",
    name: "Org chart is a directed cycle",
    description: "Own 100 Autonomous Agents simultaneously.",
    bucket: "endgame",
    condition: { kind: "autonomous_agent_count", n: 100 },
  },
  {
    id: "a_tokens_1e34",
    name: "Planetary throughput",
    description: "Reach 1e34 tokens in a single run.",
    bucket: "endgame",
    condition: { kind: "tokens_log10", n: 34 },
  },
  {
    id: "a_full_debt_ladder",
    name: "Six distinct ways to look bad",
    description: "Fire all 6 alignment-debt threshold events.",
    bucket: "endgame",
    condition: { kind: "debt_thresholds_fired_count", n: 6 },
  },
  {
    id: "a_post_state_review",
    name: "Post-state review",
    description: "Reach the Planetary round.",
    bucket: "endgame",
    condition: { kind: "reach_round", roundIdx: 8 },
  },

  // ─── V69–V98: third batch (filler toward ~100 target) ─────────────────
  // Finer-grained progression beats (early token milestones, mid-game grind
  // ladders) so the achievements grid has steady drip-feed instead of long
  // dry stretches between unlocks. Pure data; no predicate changes.

  // Milestone — first-time beats + early progression markers
  {
    id: "a_token_1e3",
    name: "Hello, tokens",
    description: "Reach 1,000 tokens in a single run.",
    bucket: "milestone",
    condition: { kind: "tokens_log10", n: 3 },
  },
  {
    id: "a_token_1e9",
    name: "Billion-token club",
    description: "Reach 1e9 tokens in a single run.",
    bucket: "milestone",
    condition: { kind: "tokens_log10", n: 9 },
  },
  {
    id: "a_token_1e12",
    name: "Trillion served",
    description: "Reach 1e12 tokens in a single run.",
    bucket: "milestone",
    condition: { kind: "tokens_log10", n: 12 },
  },
  {
    id: "a_token_1e18",
    name: "Quintillion territory",
    description: "Reach 1e18 tokens in a single run.",
    bucket: "milestone",
    condition: { kind: "tokens_log10", n: 18 },
  },
  {
    id: "a_research_count_3",
    name: "Roots of the tree",
    description: "Unlock 3 research nodes.",
    bucket: "milestone",
    condition: { kind: "research_count", n: 3 },
  },
  {
    id: "a_prestige_2",
    name: "Sophomore round",
    description: "Close 2 funding rounds total.",
    bucket: "milestone",
    condition: { kind: "prestige_count", n: 2 },
  },
  {
    id: "a_vignette_count_3",
    name: "Three pings deep",
    description: "Unlock 3 different vignettes.",
    bucket: "milestone",
    condition: { kind: "vignette_count", n: 3 },
  },
  {
    id: "a_vignette_count_10",
    name: "Ten contexts collected",
    description: "Unlock 10 different vignettes.",
    bucket: "milestone",
    condition: { kind: "vignette_count", n: 10 },
  },
  {
    id: "a_sprint_count_2",
    name: "Sprint stack",
    description: "Buy 2 per-run sprint upgrades.",
    bucket: "milestone",
    condition: { kind: "sprint_count_in_run", n: 2 },
  },
  {
    id: "a_total_producers_100",
    name: "Three-digit org",
    description: "Own 100 producers across all chains.",
    bucket: "milestone",
    condition: { kind: "total_producers", n: 100 },
  },

  // Grind — deeper headcount + tech-tree + prestige ladders
  {
    id: "a_total_producers_1000",
    name: "Four-digit org",
    description: "Own 1,000 producers across all chains.",
    bucket: "grind",
    condition: { kind: "total_producers", n: 1000 },
  },
  {
    id: "a_total_producers_2500",
    name: "Datacenter headcount",
    description: "Own 2,500 producers across all chains.",
    bucket: "grind",
    condition: { kind: "total_producers", n: 2500 },
  },
  {
    id: "a_engineers_2500",
    name: "Two-and-a-half-thousand engineers",
    description: "Own 2,500 producers across the Engineers chain.",
    bucket: "grind",
    condition: { kind: "chain_count", chain: "engineers", n: 2500 },
  },
  {
    id: "a_gpu_2500",
    name: "GPU is the infrastructure",
    description: "Own 2,500 producers across the GPU chain.",
    bucket: "grind",
    condition: { kind: "chain_count", chain: "gpu", n: 2500 },
  },
  {
    id: "a_data_2500",
    name: "Data is the moat",
    description: "Own 2,500 producers across the Data chain.",
    bucket: "grind",
    condition: { kind: "chain_count", chain: "data", n: 2500 },
  },
  {
    id: "a_energy_2500",
    name: "Energy is the war",
    description: "Own 2,500 producers across the Energy chain.",
    bucket: "grind",
    condition: { kind: "chain_count", chain: "energy", n: 2500 },
  },
  {
    id: "a_prestige_50",
    name: "Fifty rounds",
    description: "Close 50 funding rounds total.",
    bucket: "grind",
    condition: { kind: "prestige_count", n: 50 },
  },
  {
    id: "a_research_count_20",
    name: "Tech tree mostly mapped",
    description: "Unlock 20 research nodes.",
    bucket: "grind",
    condition: { kind: "research_count", n: 20 },
  },

  // Subtle / hidden — "???" until unlocked
  {
    id: "a_vignette_count_30",
    name: "Filed under \"much context\"",
    description: "Unlock 30 different vignettes.",
    bucket: "subtle",
    condition: { kind: "vignette_count", n: 30 },
  },
  {
    id: "a_token_1e50",
    name: "Numbers go ridiculous",
    description: "Reach 1e50 tokens in a single run.",
    bucket: "subtle",
    condition: { kind: "tokens_log10", n: 50 },
  },
  {
    id: "a_token_1e150",
    name: "Past the heat death (gently)",
    description: "Reach 1e150 tokens in a single run.",
    bucket: "subtle",
    condition: { kind: "tokens_log10", n: 150 },
  },
  {
    id: "a_sprint_count_in_run_3",
    name: "Sprint triple",
    description: "Own 3 sprint upgrades in a single run.",
    bucket: "subtle",
    condition: { kind: "sprint_count_in_run", n: 3 },
  },
  {
    id: "a_debt_thresholds_fired_count_3",
    name: "Three distinct ways to look bad",
    description: "Fire 3 different alignment-debt threshold events.",
    bucket: "subtle",
    condition: { kind: "debt_thresholds_fired_count", n: 3 },
  },

  // Comedy / parody — the screenshot bucket
  {
    id: "a_intern_only_5000",
    name: "Five thousand interns",
    description: "Own 5,000 Interns. (We're tracking it for HR. We are not telling HR.)",
    bucket: "comedy",
    condition: { kind: "chain_count", chain: "engineers", n: 5000 },
  },
  {
    id: "a_research_count_30",
    name: "Tech tree fully fielded",
    description: "Unlock 30 research nodes. The model is now updating the tree itself.",
    bucket: "comedy",
    condition: { kind: "research_count", n: 30 },
  },
  {
    id: "a_token_1e75",
    name: "Numbers go ridiculous (sequel)",
    description: "Reach 1e75 tokens in a single run.",
    bucket: "comedy",
    condition: { kind: "tokens_log10", n: 75 },
  },
  {
    id: "a_total_producers_5000",
    name: "We are five thousand strong",
    description: "Own 5,000 producers. The slide had 4,276 names.",
    bucket: "comedy",
    condition: { kind: "total_producers", n: 5000 },
  },
  {
    id: "a_agent_500",
    name: "Org chart is a fractal",
    description: "Own 500 Autonomous Agents simultaneously.",
    bucket: "comedy",
    condition: { kind: "autonomous_agent_count", n: 500 },
  },

  // Endgame — extra rungs in the post-AGI loop
  {
    id: "a_token_1e25",
    name: "Septillion in the engine",
    description: "Reach 1e25 tokens in a single run.",
    bucket: "endgame",
    condition: { kind: "tokens_log10", n: 25 },
  },
  {
    id: "a_agent_250",
    name: "Quarter-thousand recursive interns",
    description: "Own 250 Autonomous Agents simultaneously.",
    bucket: "endgame",
    condition: { kind: "autonomous_agent_count", n: 250 },
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
