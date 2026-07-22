export type ChainId = "engineers" | "gpu" | "data" | "energy";

export type ProducerId = string;

export interface ProducerDef {
  id: ProducerId;
  chain: ChainId;
  name: string;
  tierIdx: number;
  baseCostCapital: number;
  costMult: number;
  baseOutputPerSec: number;
}

export type FundingRoundId =
  | "seed"
  | "series_a"
  | "series_b"
  | "series_c"
  | "series_d"
  | "ipo"
  | "secondary"
  | "acquisition"
  | "sovereign_wealth"
  | "government_bailout"
  | "civilizational"
  | "agi_singularity";

export interface FundingRoundDef {
  id: FundingRoundId;
  idx: number;
  name: string;
  tokenThresholdLog10: number;
  equityMult: number;
  offlineCapHours: number;
}

// GDD §4 Beat 2: incoming tokens are split across four departments.
// Fractions must sum to 1.0; we normalize on set.
export interface Allocation {
  rd: number;
  product: number;
  marketing: number;
  safety: number;
}

// ActiveEffect lives here (not in effects.ts) so types.ts stays the schema's
// single source of truth without circular imports.
export interface ActiveEffectSerialized {
  id: string;
  source: "training_run" | "slack_dm" | "board_memo" | "alignment_debt" | "companion";
  label: string;
  appliedAt: number;
  expiresAt: number;
  effect:
    | { type: "tokens_mult"; value: number }
    | { type: "chain_supply_mult"; chain: "engineers" | "gpu" | "data" | "energy"; value: number }
    | { type: "debt_accrual_mult"; value: number }
    | { type: "capital_mult"; value: number }
    | { type: "hype_mult"; value: number }
    | { type: "rp_mult"; value: number };
}

// Decimal-valued fields are serialized as strings; in-memory we hold Decimal.
// `Decimal` is imported where needed to avoid circular boundaries.
export interface RunState {
  fundingRoundIdx: number;
  tokens: string;
  capital: string;
  hype: string;
  researchPoints: string;
  allocation: Allocation;
  producersOwned: Record<ProducerId, number>;
  /** Temporary multipliers active for this run. Pruned on tick. */
  activeEffects: ActiveEffectSerialized[];
  /** Training-run pity counter — resets to 0 on Breakthrough. */
  trainingPity: number;
  /**
   * GDD §4 Beat 2 + §9: R&D allocation buys "active-run research nodes"
   * (sprint upgrades) with RP. They live for the current run only and
   * disappear on prestige (because freshRunState() omits them).
   */
  sprintUpgradesUnlocked: string[];
  /**
   * 2026-07: per-level companion mini-interactions. Each companion has a
   * cooldown → ready → reward cycle. `nextReadyAt` is a wall-clock ms
   * timestamp: cooldown while now < nextReadyAt, ready window while
   * now ∈ [nextReadyAt, nextReadyAt + WINDOW]. Tapping in the window
   * awards a small token burst (~1% of round threshold) and resets the
   * cooldown. Missed windows silently roll to the next cycle on the
   * next player interaction — no lost rewards, no punishment. Optional
   * so old saves stay compatible without a migration.
   */
  companionInteractions?: Record<string, { nextReadyAt: number }>;
}

export interface PersistentState {
  equity: string;
  totalPrestiges: number;
  // GDD §5: Alignment Debt persists across prestige. Players can't IPO away
  // their accumulated safety neglect — the key thematic choice.
  alignmentDebt: string;
  // GDD §5: Research-tree nodes unlocked with Equity. Persists across prestige.
  // Order doesn't matter; the aggregator treats it as a set.
  unlockedResearch: string[];
  // GDD §9: Each debt-threshold event fires once per save, ever. Even if the
  // player pays debt back down below the threshold, the event doesn't re-fire.
  // The bell can't be unrung.
  firedDebtThresholds: number[];
  // GDD §5 (narrative spine) + §16 save schema. Vignette IDs that have ever
  // fired for this player. PERSIST across prestige — the player keeps their
  // story even after closing a funding round. Set semantics; order = unlock
  // order so the inbox can show newest-first.
  unlockedVignettes: string[];
  // Subset of unlockedVignettes that the player hasn't opened yet. Drives
  // the unread badge on the SLACK button in the HUD. Drained when the
  // player taps a row in the inbox.
  unreadVignettes: string[];
  // GDD §4 Beat 3: Slack DMs let the player pick a reply that modifies a
  // stat for 1h. The pick is one-shot — re-opening the vignette must NOT
  // re-apply the effect (would be a buff farm). Map: vignette id → index
  // of the reply the player chose. Presence in the map = "resolved";
  // absence = "still open for a pick" (if the vignette has replyEffects).
  resolvedVignettes: Record<string, number>;
  // GDD §10: ~100 achievements at v1.0, persistent across prestige.
  // Insertion order = unlock order so the grid can show newest-last (or
  // newest-first if the screen flips it). Set semantics — no dupes.
  unlockedAchievements: string[];
  // Timestamp (ms) the player first dismissed the endgame modal. 0 means
  // the modal has never been shown; any positive value suppresses future
  // automatic re-opens (player can still re-trigger from the dev panel).
  endgameSeenAt: number;
  // Has the player consumed the one-shot free Training Run that's given as
  // a teaching aid (guaranteed Solid tier, no token cost)? Persists across
  // prestige so the freebie is per-save, not per-run.
  freeTrainingRunUsed: boolean;
  // Set of per-panel hint banners the player has dismissed. Each panel
  // (producers, allocate, research, vignettes, achievements) shows a
  // compact one-shot hint on first visit; dismissing it pushes the key
  // here so it never re-appears. Persists across prestige.
  panelHintsSeen: string[];
  /** Wall-clock ms of the last vignette that landed in the inbox. Used
   *  to rate-limit unlock delivery: even if 4 predicates qualify at the
   *  same tick (e.g. round-transition burst), we drip them out one at
   *  a time so the player reads each on its own moment instead of
   *  seeing an unread-count of 4 stack up in one second. Optional so
   *  old saves default to "no throttle" (i.e., unlocks fire immediately
   *  the first time each condition is met after upgrade). */
  lastVignetteUnlockAt?: number;
}

export interface AccountState {
  anonUid: string;
  createdAt: number;
  lastPlayAt: number;
  onboardingStep: number;
  /** Total app-launch count. Used to defer the push-permission ask until
   *  session 3+ per GDD §12 (don't prompt on first launch). */
  sessionsStarted: number;
  /** True once the player has granted notification permission. */
  pushOptedIn: boolean;
  /** Epoch ms of the last time we asked. Cooldown a week between asks. */
  pushPromptedAt: number;
  /** 2-letter UI language code per the Settings menu (EN / ES / FR / DE /
   *  JA / ZH). Only "EN" is actually wired — others are GDD §12 i18n stubs
   *  so the switcher feels real to the player. */
  language: string;
  /** Persisted audio preferences. Were transient zustand state; moving here
   *  so the Settings toggles survive app launches. */
  sfxMuted: boolean;
  musicEnabled: boolean;
}

// v5 → v6: PersistentState gains unlockedVignettes + unreadVignettes for the
// narrative spine (GDD §5).
// v6 → v7: + resolvedVignettes (Record<id, replyIdx>) for the Beat 3 Slack
// reply mechanic (GDD §4). Empty map on migrate — player can pick a reply
// the next time they open an already-unlocked vignette.
// v7 → v8: RunState gains sprintUpgradesUnlocked (string[]) — per-run RP-
// bought boosts (GDD §4 Beat 2 + §9 "Active-run research nodes"). Empty
// array on migrate; player starts the next round with no sprints owned.
// v8 → v9: PersistentState gains unlockedAchievements (string[]) — GDD §10
// completionist hook (~100 at v1.0). Empty on migrate; achievements re-
// evaluate every tick so anything the player has already earned will fire
// on next session.
// v9 → v10: AccountState gains sessionsStarted / pushOptedIn / pushPromptedAt
// for the GDD §12 push-notification flow (defer prompt to session 3+).
// Backfill: sessionsStarted=1, pushOptedIn=false, pushPromptedAt=0.
// v10 → v11: AccountState gains `language` for the new Settings menu (per
// GDD §15 i18n-ready). Backfill: "EN".
// v11 → v12: round ladder compressed from 12 → 10 rounds (Series C and D
// dropped — each "small office" era now shows for exactly one round). Old
// fundingRoundIdx values 3, 4 etc. could now overshoot LAST_ROUND_IDX = 9,
// so the migration remaps them through OLD_TO_NEW_ROUND and clamps.
// v12 → v13: PersistentState gains `endgameSeenAt` so the AGI Singularity
// finale modal fires exactly once per save. Backfill 0 for existing players.
// v13 → v14: PersistentState gains `freeTrainingRunUsed` — the one-shot
// freebie that teaches the Training Run gacha mechanic. Backfill false so
// existing players also get the teaching freebie (the bonus is small).
// v14 → v15: AccountState gains `sfxMuted` + `musicEnabled` so audio prefs
// persist across launches. Defaults: SFX on, music off (same as the
// transient defaults that the AudioStore had before).
// v15 → v16: onboardingStep semantics shifted again — a new "Research
// tutorial" was inserted at step 8 (between Ready and done). Old saves at
// step 8 (= done) get bumped to 9 (= done in the new layout) so they don't
// see a stale tutorial chip.
// v16 → v17: PersistentState gains `panelHintsSeen` — set of panel keys
// the player has dismissed the compact-hint banner on. Backfill empty
// array so veterans see the hints once and they vanish after dismissal.
// v17 → v18: onboardingStep shifts AGAIN. Three new forced-walkthrough
// chips were inserted: "Open ALLOCATE" (step 5), "Open INBOX" (step 10),
// "Open ACHIEVEMENTS" (step 11). Cumulative shift in save.ts.
export const SCHEMA_VERSION = 18 as const;

export interface SaveBlob {
  schemaVersion: typeof SCHEMA_VERSION;
  run: RunState;
  persistent: PersistentState;
  account: AccountState;
}
