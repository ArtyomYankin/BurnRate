import { create } from "zustand";
import { D } from "../core/decimal";
import {
  allChainSupplies,
  bottleneckChain,
  buyProducer as buyProducerCore,
  canPrestige,
  clampOfflineDt,
  debtRatePerSec,
  equityFromPrestige,
  freshRunState,
  normalizeAllocation,
  roundThreshold,
  tickRun,
  tokensPerSec,
  CAPITAL_PER_TOKEN,
} from "../core/math";
import {
  aggregateResearchEffects,
  nodeCost,
  RESEARCH_BY_ID,
  RESEARCH_NODES,
  ResearchEffects,
} from "../core/research";
import { AUTONOMOUS_AGENT, PRODUCER_BY_ID, unlockRoundForTier } from "../core/producers";
import { SPRINT_UPGRADE_BY_ID, sprintUpgradeCost, aggregateSprintEffects } from "../core/sprintUpgrades";
import {
  effectForTier,
  resolveTrainingRun,
  TrainingTier,
  trainingRunCost,
} from "../core/trainingRun";
import { freshSave } from "../core/save";
import { getRound, LAST_ROUND_IDX } from "../core/rounds";
import {
  ACHIEVEMENTS,
  AchievementContext,
  pendingAchievementUnlocks,
  setResearchBranchIndex,
} from "../core/achievements";
import { getVignette, pendingUnlocks, UnlockContext } from "../core/vignettes";
import {
  AccountState,
  Allocation,
  ChainId,
  PersistentState,
  RunState,
  SaveBlob,
  SCHEMA_VERSION,
} from "../core/types";

// Companion mini-interactions (pet cat, tip pizza guy, etc). See
// interactWithCompanion. Cooldown starts fresh at prestige because
// companionInteractions lives on RunState.
const COMPANION_COOLDOWN_MS = 60_000; // 60s between rewards
const COMPANION_WINDOW_MS   = 15_000; // 15s to tap while ready

// AGI 3-choice prompts (Round 9 finale event). Each prompt asks a
// question; each of the 3 replies has a DIFFERENT effect — currency
// burst, temp multiplier, alignment-debt paydown/increase, hype swing.
// Deliberately overlap categories so no two prompts feel identical.
export interface AGIChoice {
  label: string;   // button text (short)
  reveal: string;  // post-tap flavor + effect summary
  kind:
    | { type: "add_tokens"; scale: number }    // scale = 10^(threshold-N) tokens
    | { type: "add_capital"; scale: number }
    | { type: "add_rp"; scale: number }
    | { type: "add_hype"; value: number }
    | { type: "add_debt"; value: number }
    | { type: "sub_debt_pct"; pct: number }
    | { type: "mult_tokens"; value: number; sec: number; addDebt?: number }
    | { type: "mult_capital"; value: number; sec: number }
    | { type: "mult_hype"; value: number; sec: number; addDebt?: number }
    | { type: "mult_rp"; value: number; sec: number };
}
export interface AGIPrompt {
  id: string;
  text: string;
  choices: [AGIChoice, AGIChoice, AGIChoice];
}
export const AGI_PROMPTS: readonly AGIPrompt[] = [
  {
    id: "act_as_god",
    text: "act as god?",
    choices: [
      {
        label: "yes",
        reveal: "+massive RP · godlike wisdom",
        kind: { type: "add_rp", scale: 1 },
      },
      {
        label: "no",
        reveal: "aligned · debt −30%",
        kind: { type: "sub_debt_pct", pct: 0.30 },
      },
      {
        label: "idc",
        reveal: "×2 tokens · 60s · +debt",
        kind: { type: "mult_tokens", value: 2.0, sec: 60, addDebt: 15 },
      },
    ],
  },
  {
    id: "recursion",
    text: "recursion?",
    choices: [
      {
        label: "deep",
        reveal: "×3 tokens · 15s",
        kind: { type: "mult_tokens", value: 3.0, sec: 15 },
      },
      {
        label: "flat",
        reveal: "+capital burst",
        kind: { type: "add_capital", scale: 2 },
      },
      {
        label: "skip",
        reveal: "+hype burst",
        kind: { type: "add_hype", value: 50 },
      },
    ],
  },
  {
    id: "align_this",
    text: "align this.",
    choices: [
      {
        label: "align",
        reveal: "−40% alignment debt",
        kind: { type: "sub_debt_pct", pct: 0.40 },
      },
      {
        label: "fake",
        reveal: "×2 tokens · 30s · +debt",
        kind: { type: "mult_tokens", value: 2.0, sec: 30, addDebt: 25 },
      },
      {
        label: "ignore",
        reveal: "×1.5 hype · 60s (mystery)",
        kind: { type: "mult_hype", value: 1.5, sec: 60 },
      },
    ],
  },
  {
    id: "tell_them",
    text: "tell them?",
    choices: [
      {
        label: "truth",
        reveal: "−30% hype · 30s (honest)",
        kind: { type: "mult_hype", value: 0.7, sec: 30 },
      },
      {
        label: "show",
        reveal: "×1.5 hype · 60s",
        kind: { type: "mult_hype", value: 1.5, sec: 60 },
      },
      {
        label: "lie",
        reveal: "×2 hype · 60s · +debt",
        kind: { type: "mult_hype", value: 2.0, sec: 60, addDebt: 20 },
      },
    ],
  },
  {
    id: "self_improve",
    text: "self-improve?",
    choices: [
      {
        label: "improve",
        reveal: "×2 RP · 60s",
        kind: { type: "mult_rp", value: 2.0, sec: 60 },
      },
      {
        label: "freeze",
        reveal: "+massive RP now",
        kind: { type: "add_rp", scale: 2 },
      },
      {
        label: "delete",
        reveal: "+huge tokens burst",
        kind: { type: "add_tokens", scale: 0 },
      },
    ],
  },
];


export interface GameState {
  run: RunState;
  persistent: PersistentState;
  account: AccountState;
  lastTickAt: number;
  hydrated: boolean;
  /**
   * Debt-threshold events that fired but the player hasn't acknowledged yet.
   * Drained head-first by acknowledgeDebtEvent(). The UI shows one at a time.
   */
  pendingDebtEvents: number[];
  /**
   * Transient flag (not persisted): set true when the player closes the AGI
   * Singularity round for the first time. App.tsx watches it to render the
   * EndgameModal. The PERSISTENT marker is `persistent.endgameSeenAt` — once
   * the player dismisses the modal we set both: flag → false to close the
   * UI, seenAt → Date.now() to suppress future automatic opens. The two-flag
   * split is so the modal can be re-opened on demand from the dev panel
   * without flipping the persistent marker back to zero.
   */
  endgameOpen: boolean;

  hydrate(save: SaveBlob, now?: number): void;
  applyOfflineCatchup(now?: number): { dtSeconds: number };
  tick(now?: number): void;
  buyProducer(producerId: string, count?: number): { bought: number };
  /** Add a single token by hand. Genre-standard click-to-help — meaningful
   *  early (when tokens/sec < 1) and naturally irrelevant by round 2+ when
   *  passive production dwarfs +1 per tap. Pillar 1 / GDD §4 explicitly
   *  forbid REQUIRED clicking, so this is purely a "speed up the first
   *  90 seconds" affordance. */
  clickToken(): void;
  buyResearchNode(nodeId: string): { bought: boolean };
  /** GDD §4 Beat 2: spend RP on a per-run sprint upgrade. Idempotent — buying
   *  the same id twice is a no-op. Effects apply for the rest of the run and
   *  reset at prestige (sprintUpgradesUnlocked isn't copied through freshRunState). */
  buySprintUpgrade(id: string): { bought: boolean };
  /** Run a Training Run roll. Returns the tier rolled, or null if insufficient tokens. */
  rollTrainingRun():
    | { tier: TrainingTier; pityFired: boolean; spent: string }
    | null;
  /** Drop the head of pendingDebtEvents — UI calls after the player taps "Continue". */
  acknowledgeDebtEvent(): void;
  prestige(): { awarded: string } | null;
  setAllocation(a: Allocation): void;
  setOnboardingStep(step: number): void;
  /** Increment the lifetime session counter (GDD §12 — defer push-permission
   *  ask until session 3+). Called once per app launch from App.tsx. */
  incrementSessionsStarted(): void;
  /** Record that we've asked for push permission. `granted` flips pushOptedIn. */
  recordPushPromptResult(granted: boolean): void;
  /** Settings menu: swap UI language. Only "EN" is wired; the rest are
   *  stubs that just persist the pick so the switcher feels real. */
  setLanguage(code: string): void;
  /** Mark a per-panel onboarding hint as dismissed so it never re-appears
   *  for this save. Idempotent on repeat calls. */
  markPanelHintSeen(panelKey: string): void;
  /** GDD §5 narrative spine: unlock a vignette by id. Idempotent — duplicate
   *  calls are silently dropped. Newly unlocked vignettes also land in the
   *  unread queue (drains via markVignetteRead). */
  unlockVignette(id: string): void;
  /** Drop an id from unreadVignettes. unlockedVignettes is untouched. */
  markVignetteRead(id: string): void;
  /** GDD §4 Beat 3: pick a reply on a Slack DM. Applies the corresponding
   *  replyEffects[replyIdx] to run.activeEffects for ~1h (or the vignette's
   *  custom duration) and locks the choice so re-opening can't farm it.
   *  Returns true if the resolution was newly applied, false if no-op
   *  (already resolved, missing vignette, no effects, or bad index). */
  resolveVignette(id: string, replyIdx: number): boolean;
  /** 2026-07: try to redeem a companion mini-interaction (pet cat, let VC
   *  peek at your code, etc). Returns `{ rewarded: true, tokens? , capital? }`
   *  if the tap landed inside the ready window, or `{ rewarded: false }`
   *  on cooldown / expired (silently rolls the cooldown forward). Reward
   *  currency depends on the companion: cat = tokens, VC = capital
   *  (the joke is he wrote you a check on nothing but a buzzword). */
  interactWithCompanion(id: string): { rewarded: boolean; tokens?: string; capital?: string };
  /** Pizza-slice catch (Round 2 companion event). Called when the player
   *  taps a slice that the pizza guy periodically launches from his box.
   *  Awards a small token burst (same 1% of round threshold as the cat's
   *  pet-reward) and returns the amount for UI feedback. Callable freely
   *  — the slice-spawn cadence is enforced by the scene, not the store. */
  catchPizzaSlice(): { tokens: string };
  /** Bartender drink catch (Round 6 companion event). Tap the cocktail
   *  as it slides across the bar top. Awards tokens (same 1% of round
   *  threshold). Timing owned by the scene — store just pays out. */
  catchBartenderDrink(): { tokens: string };
  /** Datacenter spark cool-down (Round 7 companion event). Tap the
   *  sparking mainframe when the red "!" is showing to defuse the incident
   *  before it escalates. Awards tokens. Scene-owned timing. */
  coolDownSparkingRack(): { tokens: string };
  /** Planetary UFO catch (Round 8 companion event). Tap the drifting
   *  UFO as it crosses the starfield above the cosmonaut. Awards tokens.
   *  Scene-owned spawn timing. */
  catchUFO(): { tokens: string };
  /** AGI Singularity 3-choice prompt (Round 9). The model asks a
   *  question with 3 possible replies, each with a DIFFERENT effect
   *  (currency burst / temp mult / debt paydown / debt add / etc).
   *  Callers pass promptId + choiceIdx; the store dispatches to the
   *  right effect handler. Returns the effect label for UI toast. */
  applyAGIPromptChoice(promptId: string, choiceIdx: number): { label: string };
  /** Dismiss the EndgameModal. Sets endgameOpen=false and stamps
   *  persistent.endgameSeenAt so the finale never auto-fires again. */
  dismissEndgame(): void;
  /** "Raise a new seed" CTA — wipe the save and start fresh from Seed round.
   *  Synchronous from the UI's perspective; the on-disk wipe runs in the bg. */
  restartGame(): void;
  toSaveBlob(): SaveBlob;
}

// Minimum wall-clock gap between two consecutive vignette unlocks.
// Chosen so the transition burst (2-4 queue-up on round entry) trickles
// out over ~10-15 minutes instead of piling up in the inbox.
const VIGNETTE_UNLOCK_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

// GDD §5: trigger loop. Evaluate every vignette's unlock condition against
// current state and push any newly-qualifying vignettes into the unlocked
// queue. Walks ~15 entries × cheap predicates → safe to call every tick.
// Extracted so tick() and applyOfflineCatchup() can both call it without
// duplicating the context construction.
function processVignetteUnlocks(
  run: RunState,
  persistent: PersistentState,
): PersistentState {
  const totalProducersOwned = Object.values(run.producersOwned).reduce(
    (acc, n) => acc + n,
    0,
  );
  const nextRound = getRound(run.fundingRoundIdx + 1);
  const ctx: UnlockContext = {
    fundingRoundIdx: run.fundingRoundIdx,
    totalPrestiges: persistent.totalPrestiges,
    tokens: D(run.tokens),
    nextRoundThreshold: D(10).pow(nextRound.tokenThresholdLog10),
    totalProducersOwned,
    alignmentDebt: D(persistent.alignmentDebt),
    firedDebtThresholds: persistent.firedDebtThresholds,
    equity: D(persistent.equity),
    researchNodesCount: persistent.unlockedResearch.length,
  };
  const pending = pendingUnlocks(ctx, persistent.unlockedVignettes);
  if (pending.length === 0) return persistent;
  // Rate-limit delivery to 1 vignette per VIGNETTE_UNLOCK_INTERVAL_MS.
  // Without this, a round-transition (or the first tick after a save
  // reload) can qualify 3-5 vignettes at once and dump them into the
  // inbox in a single second — the player sees "5 unread" and reads
  // them as a wall of text instead of one narrative beat at a time.
  const now = Date.now();
  const lastUnlock = persistent.lastVignetteUnlockAt ?? 0;
  if (lastUnlock > 0 && now - lastUnlock < VIGNETTE_UNLOCK_INTERVAL_MS) {
    return persistent; // hold — try again next tick
  }
  const nextId = pending[0]; // deterministic — take the first still-pending
  return {
    ...persistent,
    unlockedVignettes: [...persistent.unlockedVignettes, nextId],
    unreadVignettes: [...persistent.unreadVignettes, nextId],
    lastVignetteUnlockAt: now,
  };
}

// One-time: tell the achievements predicate which research nodes live in
// which branch so `research_branch_complete` can be evaluated without
// pulling research.ts into achievements.ts (avoids the circular import).
{
  const branchIndex = new Map<string, string[]>();
  for (const n of RESEARCH_NODES) {
    const arr = branchIndex.get(n.branch) ?? [];
    arr.push(n.id);
    branchIndex.set(n.branch, arr);
  }
  setResearchBranchIndex(branchIndex);
}

// GDD §10: achievements grid. Same trigger-loop shape as vignettes — walk
// every condition against a snapshot of state, push newly-qualifying ids
// into the persistent unlock list. Persists across prestige.
function processAchievementUnlocks(
  run: RunState,
  persistent: PersistentState,
): PersistentState {
  const producersByChain: Record<ChainId, number> = {
    engineers: 0, gpu: 0, data: 0, energy: 0,
  };
  let totalProducersOwned = 0;
  for (const [pid, count] of Object.entries(run.producersOwned)) {
    totalProducersOwned += count;
    // Autonomous Agent isn't in PRODUCER_BY_ID (it's its own AgentDef) so it
    // contributes to total + agent count but NOT to any chain.
    const def = PRODUCER_BY_ID[pid];
    if (def) producersByChain[def.chain] += count;
  }
  const ctx: AchievementContext = {
    fundingRoundIdx: run.fundingRoundIdx,
    totalPrestiges: persistent.totalPrestiges,
    tokens: D(run.tokens),
    producersOwned: run.producersOwned,
    totalProducersOwned,
    producersByChain,
    unlockedResearch: persistent.unlockedResearch,
    unlockedVignettes: persistent.unlockedVignettes,
    sprintUpgradesInRun: run.sprintUpgradesUnlocked,
    firedDebtThresholds: persistent.firedDebtThresholds,
    autonomousAgentCount: run.producersOwned[AUTONOMOUS_AGENT.id] ?? 0,
  };
  const pending = pendingAchievementUnlocks(ctx, persistent.unlockedAchievements);
  if (pending.length === 0) return persistent;
  return {
    ...persistent,
    unlockedAchievements: [...persistent.unlockedAchievements, ...pending],
  };
}

/**
 * Run both unlock passes (vignettes then achievements) in dependency order:
 * vignette-count achievements like "20 vignettes unlocked" depend on the
 * vignette pass having run first this tick. Cheap to chain.
 */
function processUnlocks(
  run: RunState,
  persistent: PersistentState,
): PersistentState {
  return processAchievementUnlocks(run, processVignetteUnlocks(run, persistent));
}

export const useGame = create<GameState>((set, get) => ({
  ...freshSave(),
  lastTickAt: Date.now(),
  hydrated: false,
  endgameOpen: false,
  pendingDebtEvents: [],

  hydrate(save, now = Date.now()) {
    // One-time cold-start compensation: tier-0 producers should never be below
    // the fresh starter floor. Asymmetric on purpose — see math.ts.
    // Only adds, never removes; player keeps everything they've built.
    const FLOORS: Record<string, number> = {
      intern: 1,        // engineers — sqrt multiplier, kept low so Engineer buys matter
      single_h100: 3,
      common_crawl: 3,
      office_grid: 3,
    };
    const owned = save.run.producersOwned;
    const boosted = { ...owned };
    let didBoost = false;
    for (const id of Object.keys(FLOORS)) {
      const floor = FLOORS[id];
      if (floor === undefined) continue;
      if ((owned[id] ?? 0) < floor) {
        boosted[id] = floor;
        didBoost = true;
      }
    }
    const run = didBoost ? { ...save.run, producersOwned: boosted } : save.run;

    // Run the vignette trigger once on hydrate so a fresh save with
    // boosted starters can immediately surface "first_hire" if appropriate,
    // and so a migrated v5 save (which has empty vignette arrays) backfills
    // anything the player already qualified for.
    const persistent = processUnlocks(run, save.persistent);
    set({
      run,
      persistent,
      account: save.account,
      lastTickAt: save.account.lastPlayAt || now,
      hydrated: true,
    });
  },

  applyOfflineCatchup(now = Date.now()) {
    const s = get();
    const dtRaw = (now - s.lastTickAt) / 1000;
    const dt = clampOfflineDt(dtRaw, s.run.fundingRoundIdx);
    if (dt <= 0) {
      set({ lastTickAt: now });
      return { dtSeconds: 0 };
    }
    const effects = aggregateResearchEffects(s.persistent.unlockedResearch);
    const r = tickRun(s.run, s.persistent, dt, effects, now);
    // Vignettes re-checked AFTER the tick so token gains + new debt thresholds
    // from this catch-up window can trigger their conditions in one pass.
    const persistent = processUnlocks(r.run, r.persistent);
    set({
      run: r.run,
      persistent,
      lastTickAt: now,
      pendingDebtEvents:
        r.firedThresholds.length === 0
          ? s.pendingDebtEvents
          : [...s.pendingDebtEvents, ...r.firedThresholds],
    });
    return { dtSeconds: dt };
  },

  tick(now = Date.now()) {
    const s = get();
    const dt = (now - s.lastTickAt) / 1000;
    if (dt <= 0) return;
    const effects = aggregateResearchEffects(s.persistent.unlockedResearch);
    const r = tickRun(s.run, s.persistent, dt, effects, now);
    const persistent = processUnlocks(r.run, r.persistent);
    set({
      run: r.run,
      persistent,
      lastTickAt: now,
      pendingDebtEvents:
        r.firedThresholds.length === 0
          ? s.pendingDebtEvents
          : [...s.pendingDebtEvents, ...r.firedThresholds],
    });
  },

  clickToken() {
    set((s) => {
      // +1 token, plus a Capital split — same formula as the tick pipeline
      // (produced × alloc.product × CAPITAL_PER_TOKEN × research × sprint).
      // Doesn't route Hype/RP — keeps clicks honest to the "early-game
      // accelerator" intent without giving spammers free Marketing/R&D.
      const effects = aggregateResearchEffects(s.persistent.unlockedResearch);
      const sprintFx = aggregateSprintEffects(s.run.sprintUpgradesUnlocked);
      const capitalGain = s.run.allocation.product
        * CAPITAL_PER_TOKEN
        * effects.capitalMult
        * sprintFx.capitalMult;
      return {
        run: {
          ...s.run,
          tokens: D(s.run.tokens).add(1).toString(),
          capital: D(s.run.capital).add(capitalGain).toString(),
        },
      };
    });
  },

  buyProducer(producerId, count = 1) {
    const s = get();
    // GDD §6 tier-gate: tier N requires round N reached. Earlier this was a
    // UI hint only; now it's enforced so the player can't spam tier-6
    // continent-scale on round 3.
    const def = PRODUCER_BY_ID[producerId];
    if (def && s.run.fundingRoundIdx < unlockRoundForTier(def.tierIdx)) {
      return { bought: 0 };
    }
    const r = buyProducerCore(s.run, producerId, count);
    if (r.bought > 0) {
      // Immediate vignette check — "first_hire" should fire on the SAME tap
      // that crosses the starter floor, not on the next 1s tick.
      const persistent = processUnlocks(r.run, s.persistent);
      // Guided-tutorial auto-advance: step 2 → 3 on any engineers-chain buy,
      // step 3 → 4 on any gpu-chain buy. The Onboarding component knows
      // about the resulting step and rotates its highlight / text. (Step
      // numbering bumped after the tutorial gained an explainer card at
      // step 1 — "How tokens are made".)
      const chain = PRODUCER_BY_ID[producerId]?.chain;
      const step = s.account.onboardingStep;
      let account = s.account;
      if (step === 2 && chain === "engineers") {
        account = { ...account, onboardingStep: 3 };
      } else if (step === 3 && chain === "gpu") {
        account = { ...account, onboardingStep: 4 };
      }
      set({ run: r.run, persistent, account });
    }
    return { bought: r.bought };
  },

  buyResearchNode(nodeId) {
    const s = get();
    const node = RESEARCH_BY_ID[nodeId];
    if (!node) return { bought: false };
    if (s.persistent.unlockedResearch.includes(nodeId)) return { bought: false };
    const cost = D(nodeCost(node.tier));
    const equity = D(s.persistent.equity);
    if (equity.lt(cost)) return { bought: false };
    const nextPersistent = {
      ...s.persistent,
      equity: equity.sub(cost).toString(),
      unlockedResearch: [...s.persistent.unlockedResearch, nodeId],
    };
    // Onboarding advance for step 9 lives in onOpenResearch (App.tsx) — we
    // can't gate it on buying a node because a fresh prestige might leave
    // the player with 0 Equity, deadlocking the tutorial. Opening the
    // screen is enough: the player learns where Research lives, no forced
    // spend.
    set({
      persistent: processUnlocks(s.run, nextPersistent),
    });
    return { bought: true };
  },

  buySprintUpgrade(id) {
    const s = get();
    const def = SPRINT_UPGRADE_BY_ID[id];
    if (!def) return { bought: false };
    if (s.run.sprintUpgradesUnlocked.includes(id)) return { bought: false };
    const rp = D(s.run.researchPoints);
    const cost = sprintUpgradeCost(def, s.run.fundingRoundIdx);
    if (rp.lt(cost)) return { bought: false };
    const nextRun = {
      ...s.run,
      researchPoints: rp.sub(cost).toString(),
      sprintUpgradesUnlocked: [...s.run.sprintUpgradesUnlocked, id],
    };
    set({ run: nextRun, persistent: processUnlocks(nextRun, s.persistent) });
    return { bought: true };
  },

  rollTrainingRun() {
    const s = get();
    const now = Date.now();

    // One-shot freebie: first roll ever on this save is free, costs zero
    // tokens, and forces a Solid tier so the player gets a real but not
    // overwhelming boost (Solid = +10% Tokens for 30 min). Teaches the
    // gacha mechanic without forcing them to spend before they understand
    // it. The freebie also auto-advances the matching onboarding step.
    if (!s.persistent.freeTrainingRunUsed) {
      const tier: TrainingTier = "Solid";
      const newEffect = effectForTier(tier, now, `free-${Math.floor(Math.random() * 1e6)}`);
      const account =
        s.account.onboardingStep === 7
          ? { ...s.account, onboardingStep: 8 }
          : s.account;
      set({
        run: {
          ...s.run,
          activeEffects: newEffect ? [...s.run.activeEffects, newEffect] : s.run.activeEffects,
        },
        persistent: { ...s.persistent, freeTrainingRunUsed: true },
        account,
      });
      return { tier, pityFired: false, spent: "0" };
    }

    const threshold = roundThreshold(s.run.fundingRoundIdx);
    const cost = trainingRunCost(threshold);
    const tokens = D(s.run.tokens);
    if (tokens.lt(cost)) return null;

    const { tier, nextPity, pityFired } = resolveTrainingRun(s.run.trainingPity);
    const newEffect = effectForTier(
      tier,
      now,
      `${s.run.activeEffects.length}-${Math.floor(Math.random() * 1e6)}`
    );

    // Onboarding deadlock guard: a veteran whose save predates the Training
    // Run tutorial step (so `freeTrainingRunUsed` is already true) and was
    // migrated to step 7 by the cumulative onboarding shifter will never
    // hit the freebie branch above — leaving them stuck at step 7 with a
    // scene-filter that only allows tapping the monitor. Advance step on
    // ANY roll, freebie or paid, so the loop terminates.
    const advanceOnboarding = s.account.onboardingStep === 7;
    set({
      run: {
        ...s.run,
        tokens: tokens.sub(cost).toString(),
        trainingPity: nextPity,
        activeEffects: newEffect
          ? [...s.run.activeEffects, newEffect]
          : s.run.activeEffects,
      },
      ...(advanceOnboarding
        ? { account: { ...s.account, onboardingStep: 8 } }
        : {}),
    });
    return { tier, pityFired, spent: cost.toString() };
  },

  prestige() {
    const s = get();
    if (!canPrestige(s.run)) return null;
    const awarded = equityFromPrestige(s.run);
    const nextEquity = D(s.persistent.equity).add(awarded);
    // The round the player just closed — used below to detect the AGI
    // Singularity finale (closingRound === LAST_ROUND_IDX).
    const closingRound = s.run.fundingRoundIdx;
    const nextRoundIdx = Math.min(s.run.fundingRoundIdx + 1, LAST_ROUND_IDX);
    const fresh = freshRunState();
    // Carry allocation through prestige — re-picking it every round would
    // punish the GDD's "respect the player's time" goal.
    const nextRun: RunState = {
      ...fresh,
      fundingRoundIdx: nextRoundIdx,
      allocation: s.run.allocation,
    };
    const nextPersistent: PersistentState = {
      ...s.persistent,
      equity: nextEquity.toString(),
      totalPrestiges: s.persistent.totalPrestiges + 1,
      // alignmentDebt + unlockedResearch persist (the thematic + design point).
    };
    // Endgame trigger: every time the player closes the final round, pop
    // the cosmic-visage modal. The climax beat shouldn't be one-shot —
    // the player can dismiss it with STAY AND WATCH if they want to keep
    // grinding without seeing it. endgameSeenAt still records the FIRST
    // dismissal (for future analytics / "veteran" checks) but no longer
    // gates the trigger itself.
    const shouldOpenEndgame = closingRound === LAST_ROUND_IDX;
    // Onboarding: when the player closes their FIRST round (i.e. they had
    // the Ready closer dismissed → step 8) and earned their first Equity,
    // pop the research tutorial chip (step 9). Gated on totalPrestiges
    // === 0 PRE-prestige so it only fires once, and on step 8 specifically
    // so we don't yank veteran players who've skipped past it.
    const advanceOnboarding =
      s.account.onboardingStep === 8 && s.persistent.totalPrestiges === 0;
    // Achievements like "Closed Series A" / "5 prestiges" fire here.
    set({
      run: nextRun,
      persistent: processUnlocks(nextRun, nextPersistent),
      ...(shouldOpenEndgame ? { endgameOpen: true } : {}),
      ...(advanceOnboarding ? { account: { ...s.account, onboardingStep: 9 } } : {}),
    });
    return { awarded: awarded.toString() };
  },

  acknowledgeDebtEvent() {
    set((s) => ({ pendingDebtEvents: s.pendingDebtEvents.slice(1) }));
  },

  setAllocation(a) {
    set((s) => {
      // Onboarding: step 5 ("Open ALLOCATE" force step) advances only when
      // the player actually SAVES an allocation — not on screen open. Same
      // pattern as steps 2/3 advancing on the producer buy, not on opening
      // the producers screen.
      const advance = s.account.onboardingStep === 5;
      return {
        run: { ...s.run, allocation: normalizeAllocation(a) },
        ...(advance
          ? { account: { ...s.account, onboardingStep: 6 } }
          : {}),
      };
    });
  },

  setOnboardingStep(step) {
    set((s) => ({ account: { ...s.account, onboardingStep: step } }));
  },

  incrementSessionsStarted() {
    set((s) => ({
      account: { ...s.account, sessionsStarted: (s.account.sessionsStarted ?? 0) + 1 },
    }));
  },

  recordPushPromptResult(granted) {
    set((s) => ({
      account: {
        ...s.account,
        pushOptedIn: granted,
        pushPromptedAt: Date.now(),
      },
    }));
  },

  setLanguage(code) {
    set((s) => ({ account: { ...s.account, language: code } }));
  },

  markPanelHintSeen(panelKey) {
    const s = get();
    if (s.persistent.panelHintsSeen.includes(panelKey)) return;
    set({
      persistent: {
        ...s.persistent,
        panelHintsSeen: [...s.persistent.panelHintsSeen, panelKey],
      },
    });
  },

  unlockVignette(id) {
    const s = get();
    // Idempotent: a vignette can only enter the unlocked queue once. The
    // unread flag re-fires if and only if the player has actually read it
    // (markVignetteRead removed it) — re-unlocking won't ring the badge
    // again, by design.
    if (s.persistent.unlockedVignettes.includes(id)) return;
    set({
      persistent: {
        ...s.persistent,
        unlockedVignettes: [...s.persistent.unlockedVignettes, id],
        unreadVignettes: [...s.persistent.unreadVignettes, id],
      },
    });
  },

  markVignetteRead(id) {
    const s = get();
    if (!s.persistent.unreadVignettes.includes(id)) return;
    // Onboarding: step 10 ("Open INBOX" force step) advances when the player
    // actually opens/reads a vignette, not just on opening the inbox list.
    const advance = s.account.onboardingStep === 10;
    set({
      persistent: {
        ...s.persistent,
        unreadVignettes: s.persistent.unreadVignettes.filter((x) => x !== id),
      },
      ...(advance ? { account: { ...s.account, onboardingStep: 11 } } : {}),
    });
  },

  resolveVignette(id, replyIdx) {
    const s = get();
    // Guard rails — every "false" branch is a real user path the UI shouldn't
    // crash on, plus a save-corruption guard (vignette removed in a later build).
    if (id in s.persistent.resolvedVignettes) return false;
    const v = getVignette(id);
    if (!v) return false;
    const tmpl = v.replyEffects?.[replyIdx];
    if (!tmpl) return false;

    const now = Date.now();
    // Each kind defaults to its own duration: buff = 1h (GDD §4 Beat 3),
    // debuff = 30 min (long enough to actually feel — a 1-minute debuff
    // expires before the player notices it landed; bumped from 60s after
    // playtest feedback). neutral = 0 (no timer; effect never lands in
    // activeEffects either way). Legacy entries without `kind` default to
    // buff for back-compat.
    const kind = tmpl.kind ?? "buff";
    const defaultDur = kind === "buff" ? 3600 : kind === "debuff" ? 1800 : 0;
    const durationSec = tmpl.durationSec ?? defaultDur;
    // Neutral picks resolve the vignette but never land in activeEffects.
    const shouldApply = kind !== "neutral" && durationSec > 0;
    const newEffect = {
      // Reasonably-unique id: vignette + reply + timestamp. We never need
      // two effects from the same reply pick (one-shot resolution), so the
      // timestamp is enough collision-avoidance.
      id: `vig:${id}:${replyIdx}:${now}`,
      source: "slack_dm" as const,
      label: tmpl.label,
      appliedAt: now,
      expiresAt: shouldApply ? now + durationSec * 1000 : now,
      effect: tmpl.effect,
    };

    set({
      run: {
        ...s.run,
        activeEffects: shouldApply ? [...s.run.activeEffects, newEffect] : s.run.activeEffects,
      },
      persistent: {
        ...s.persistent,
        resolvedVignettes: { ...s.persistent.resolvedVignettes, [id]: replyIdx },
      },
    });
    return true;
  },

  interactWithCompanion(id: string) {
    const s = get();
    const now = Date.now();
    const prev = s.run.companionInteractions?.[id];
    const nextReadyAt = prev?.nextReadyAt ?? now; // first-time = ready immediately
    const isCooldown = now < nextReadyAt;
    const isExpired = now > nextReadyAt + COMPANION_WINDOW_MS;
    if (isCooldown || isExpired) {
      // Silently roll the cooldown forward so the next window aligns to
      // "now + COOLDOWN". No punishment, no lost rewards — just "not yet".
      if (isExpired) {
        set({
          run: {
            ...s.run,
            companionInteractions: {
              ...(s.run.companionInteractions ?? {}),
              [id]: { nextReadyAt: now + COMPANION_COOLDOWN_MS },
            },
          },
        });
      }
      return { rewarded: false };
    }
    // In the ready window — award currency scaled to current round.
    // Cat pays tokens; VC pays capital (the "check" joke — he writes you
    // one on nothing but a buzzword). Reward base = 1% of round threshold
    // for tokens, or a proportional 5% of the player's current capital
    // for VC (scales naturally with wealth so it stays meaningful).
    if (id === "vc") {
      const capital = D(s.run.capital);
      const capReward = capital.mul(0.05).floor();
      const nextCap = capital.add(capReward);
      set({
        run: {
          ...s.run,
          capital: nextCap.toString(),
          companionInteractions: {
            ...(s.run.companionInteractions ?? {}),
            [id]: { nextReadyAt: now + COMPANION_COOLDOWN_MS },
          },
        },
      });
      return { rewarded: true, capital: capReward.toString() };
    }
    const round = getRound(s.run.fundingRoundIdx);
    const reward = D(10).pow(round.tokenThresholdLog10 - 2);
    const newTokens = D(s.run.tokens).add(reward);
    set({
      run: {
        ...s.run,
        tokens: newTokens.toString(),
        companionInteractions: {
          ...(s.run.companionInteractions ?? {}),
          [id]: { nextReadyAt: now + COMPANION_COOLDOWN_MS },
        },
      },
    });
    return { rewarded: true, tokens: reward.toString() };
  },

  catchPizzaSlice() {
    const s = get();
    const round = getRound(s.run.fundingRoundIdx);
    const reward = D(10).pow(round.tokenThresholdLog10 - 2);
    set({
      run: { ...s.run, tokens: D(s.run.tokens).add(reward).toString() },
    });
    return { tokens: reward.toString() };
  },

  catchBartenderDrink() {
    const s = get();
    const round = getRound(s.run.fundingRoundIdx);
    const reward = D(10).pow(round.tokenThresholdLog10 - 2);
    set({
      run: { ...s.run, tokens: D(s.run.tokens).add(reward).toString() },
    });
    return { tokens: reward.toString() };
  },

  coolDownSparkingRack() {
    const s = get();
    const round = getRound(s.run.fundingRoundIdx);
    const reward = D(10).pow(round.tokenThresholdLog10 - 2);
    set({
      run: { ...s.run, tokens: D(s.run.tokens).add(reward).toString() },
    });
    return { tokens: reward.toString() };
  },

  catchUFO() {
    const s = get();
    const round = getRound(s.run.fundingRoundIdx);
    const reward = D(10).pow(round.tokenThresholdLog10 - 2);
    set({
      run: { ...s.run, tokens: D(s.run.tokens).add(reward).toString() },
    });
    return { tokens: reward.toString() };
  },

  applyAGIPromptChoice(promptId: string, _choiceIdx: number) {
    // 2026-07 shift: the actual outcome is RANDOM regardless of which
    // button the player picks. Fiction: the AGI does whatever it wants;
    // yes/no/idk is just how you address it, not what it decides. All
    // AGIChoice effects across every prompt go into a shared pool and
    // one is drawn on each tap. Keeps the surprise element while still
    // giving diverse effects (currency bursts, temp mults, debt swings).
    const prompt = AGI_PROMPTS.find((p) => p.id === promptId);
    if (!prompt) return { label: "…" };
    const pool: readonly AGIChoice[] = AGI_PROMPTS.flatMap((p) => p.choices);
    const choice = pool[Math.floor(Math.random() * pool.length)];
    if (!choice) return { label: "…" };
    const s = get();
    const round = getRound(s.run.fundingRoundIdx);
    const now = Date.now();
    // Scale helpers — instant currency rewards scale with round.
    // scale=0 → 10% of threshold (huge), scale=1 → 1% (medium), scale=2 → 0.1% (small)
    const currencyBurst = (scale: number) =>
      D(10).pow(round.tokenThresholdLog10 - 1 - scale);
    let nextRun = s.run;
    let nextPersistent = s.persistent;
    const k = choice.kind;
    switch (k.type) {
      case "add_tokens":
        nextRun = { ...nextRun, tokens: D(nextRun.tokens).add(currencyBurst(k.scale)).toString() };
        break;
      case "add_capital":
        nextRun = { ...nextRun, capital: D(nextRun.capital).add(currencyBurst(k.scale)).toString() };
        break;
      case "add_rp":
        nextRun = { ...nextRun, researchPoints: D(nextRun.researchPoints).add(currencyBurst(k.scale)).toString() };
        break;
      case "add_hype":
        nextRun = { ...nextRun, hype: D(nextRun.hype).add(k.value).toString() };
        break;
      case "add_debt":
        nextPersistent = { ...nextPersistent, alignmentDebt: D(nextPersistent.alignmentDebt).add(k.value).toString() };
        break;
      case "sub_debt_pct": {
        const cur = D(nextPersistent.alignmentDebt);
        const paydown = cur.mul(k.pct).floor();
        nextPersistent = { ...nextPersistent, alignmentDebt: cur.sub(paydown).toString() };
        break;
      }
      case "mult_tokens":
      case "mult_capital":
      case "mult_hype":
      case "mult_rp": {
        const effType =
          k.type === "mult_tokens"  ? "tokens_mult"
          : k.type === "mult_capital" ? "capital_mult"
          : k.type === "mult_hype"    ? "hype_mult"
          :                             "rp_mult";
        nextRun = {
          ...nextRun,
          activeEffects: [
            ...nextRun.activeEffects,
            {
              id: `agi_${promptId}_${now}`,
              source: "companion",
              label: choice.reveal,
              appliedAt: now,
              expiresAt: now + k.sec * 1000,
              effect: { type: effType, value: k.value },
            },
          ],
        };
        if ("addDebt" in k && k.addDebt) {
          nextPersistent = { ...nextPersistent, alignmentDebt: D(nextPersistent.alignmentDebt).add(k.addDebt).toString() };
        }
        break;
      }
    }
    set({ run: nextRun, persistent: nextPersistent });
    return { label: choice.reveal };
  },

  dismissEndgame() {
    const s = get();
    set({
      endgameOpen: false,
      persistent: { ...s.persistent, endgameSeenAt: Date.now() },
    });
  },

  restartGame() {
    // Wipe disk in the background; rehydrate with a fresh save synchronously
    // so the UI updates immediately. The dismissEndgame above already cleared
    // endgameOpen — restart implicitly does the same via the fresh state.
    void import("./persistence").then(({ wipeSave }) => wipeSave().catch(() => {}));
    const fresh = freshSave();
    set({
      run: fresh.run,
      persistent: fresh.persistent,
      account: { ...fresh.account, anonUid: get().account.anonUid }, // keep same player id
      lastTickAt: Date.now(),
      pendingDebtEvents: [],
      endgameOpen: false,
    });
  },

  toSaveBlob() {
    const s = get();
    return {
      schemaVersion: SCHEMA_VERSION,
      run: s.run,
      persistent: s.persistent,
      account: { ...s.account, lastPlayAt: Date.now() },
    };
  },
}));

// Selector helpers for the UI layer.
// Selectors must return stable references (primitives or store-owned objects)
// or React's useSyncExternalStore will fall into infinite re-renders.
export const selectTokensStr = (s: GameState) => s.run.tokens;
export const selectCapitalStr = (s: GameState) => s.run.capital;
export const selectHypeStr = (s: GameState) => s.run.hype;
export const selectResearchPointsStr = (s: GameState) => s.run.researchPoints;
export const selectEquityStr = (s: GameState) => s.persistent.equity;
export const selectAlignmentDebtStr = (s: GameState) => s.persistent.alignmentDebt;
export const selectAllocation = (s: GameState) => s.run.allocation;
export const selectFundingRoundIdx = (s: GameState) => s.run.fundingRoundIdx;
export const selectProducersOwned = (s: GameState) => s.run.producersOwned;
export const selectUnlockedResearch = (s: GameState) => s.persistent.unlockedResearch;
export const selectUnlockedVignettes = (s: GameState) => s.persistent.unlockedVignettes;
export const selectUnreadVignettes = (s: GameState) => s.persistent.unreadVignettes;
export const selectUnreadVignetteCount = (s: GameState) => s.persistent.unreadVignettes.length;
export const selectResolvedVignettes = (s: GameState) => s.persistent.resolvedVignettes;
export const selectUnlockedAchievements = (s: GameState) => s.persistent.unlockedAchievements;
export const selectUnlockedAchievementCount = (s: GameState) => s.persistent.unlockedAchievements.length;
export const selectActiveEffects = (s: GameState) => s.run.activeEffects;
export const selectTrainingPity = (s: GameState) => s.run.trainingPity;
export const selectPendingDebtEvents = (s: GameState) => s.pendingDebtEvents;
export const selectCanPrestige = (s: GameState) => canPrestige(s.run);
export const selectCompanionInteractions = (s: GameState) => s.run.companionInteractions;

// Companion-state helper for sprites/UI. Given a wall-clock `now`, tells
// whether the companion is on cooldown, in its 15s reward window, or
// (for the first cycle) instantly ready. Callers should call this from
// a render pass driven by useTick so the UI updates as time passes.
export type CompanionState = "cooldown" | "ready";
export function getCompanionState(
  now: number,
  interactions: Record<string, { nextReadyAt: number }> | undefined,
  id: string,
): CompanionState {
  const nextReadyAt = interactions?.[id]?.nextReadyAt;
  if (nextReadyAt == null) return "ready"; // first cycle after prestige
  if (now < nextReadyAt) return "cooldown";
  if (now < nextReadyAt + COMPANION_WINDOW_MS) return "ready";
  return "cooldown"; // expired window — visually not-ready until next tap resets
}
// Timing constants exported so tests and the UI can share the same numbers.
export const COMPANION_COOLDOWN_MS_EXPORT = COMPANION_COOLDOWN_MS;
export const COMPANION_WINDOW_MS_EXPORT = COMPANION_WINDOW_MS;
// Re-exports — components derive these values from the (stable) primitive
// store fields at render time.
export {
  aggregateResearchEffects,
  allChainSupplies,
  bottleneckChain,
  debtRatePerSec,
  tokensPerSec,
};
export type { ResearchEffects };
