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
} from "../core/math";
import {
  aggregateResearchEffects,
  nodeCost,
  RESEARCH_BY_ID,
  ResearchEffects,
} from "../core/research";
import {
  effectForTier,
  resolveTrainingRun,
  TrainingTier,
  trainingRunCost,
} from "../core/trainingRun";
import { freshSave } from "../core/save";
import { M0_LAST_ROUND_IDX } from "../core/rounds";
import {
  AccountState,
  Allocation,
  PersistentState,
  RunState,
  SaveBlob,
  SCHEMA_VERSION,
} from "../core/types";

interface GameState {
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

  hydrate(save: SaveBlob, now?: number): void;
  applyOfflineCatchup(now?: number): { dtSeconds: number };
  tick(now?: number): void;
  buyProducer(producerId: string, count?: number): { bought: number };
  buyResearchNode(nodeId: string): { bought: boolean };
  /** Run a Training Run roll. Returns the tier rolled, or null if insufficient tokens. */
  rollTrainingRun():
    | { tier: TrainingTier; pityFired: boolean; spent: string }
    | null;
  /** Drop the head of pendingDebtEvents — UI calls after the player taps "Continue". */
  acknowledgeDebtEvent(): void;
  prestige(): { awarded: string } | null;
  setAllocation(a: Allocation): void;
  setOnboardingStep(step: number): void;
  toSaveBlob(): SaveBlob;
}

export const useGame = create<GameState>((set, get) => ({
  ...freshSave(),
  lastTickAt: Date.now(),
  hydrated: false,
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

    set({
      run,
      persistent: save.persistent,
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
    set({
      run: r.run,
      persistent: r.persistent,
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
    set({
      run: r.run,
      persistent: r.persistent,
      lastTickAt: now,
      pendingDebtEvents:
        r.firedThresholds.length === 0
          ? s.pendingDebtEvents
          : [...s.pendingDebtEvents, ...r.firedThresholds],
    });
  },

  buyProducer(producerId, count = 1) {
    const s = get();
    const r = buyProducerCore(s.run, producerId, count);
    if (r.bought > 0) set({ run: r.run });
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
    set({
      persistent: {
        ...s.persistent,
        equity: equity.sub(cost).toString(),
        unlockedResearch: [...s.persistent.unlockedResearch, nodeId],
      },
    });
    return { bought: true };
  },

  rollTrainingRun() {
    const s = get();
    const threshold = roundThreshold(s.run.fundingRoundIdx);
    const cost = trainingRunCost(threshold);
    const tokens = D(s.run.tokens);
    if (tokens.lt(cost)) return null;

    const { tier, nextPity, pityFired } = resolveTrainingRun(s.run.trainingPity);
    const now = Date.now();
    const newEffect = effectForTier(
      tier,
      now,
      `${s.run.activeEffects.length}-${Math.floor(Math.random() * 1e6)}`
    );

    set({
      run: {
        ...s.run,
        tokens: tokens.sub(cost).toString(),
        trainingPity: nextPity,
        activeEffects: newEffect
          ? [...s.run.activeEffects, newEffect]
          : s.run.activeEffects,
      },
    });
    return { tier, pityFired, spent: cost.toString() };
  },

  prestige() {
    const s = get();
    if (!canPrestige(s.run)) return null;
    const awarded = equityFromPrestige(s.run);
    const nextEquity = D(s.persistent.equity).add(awarded);
    const nextRoundIdx = Math.min(s.run.fundingRoundIdx + 1, M0_LAST_ROUND_IDX + 1);
    const fresh = freshRunState();
    set({
      // Carry allocation through prestige — re-picking it every round would
      // punish the GDD's "respect the player's time" goal.
      run: { ...fresh, fundingRoundIdx: nextRoundIdx, allocation: s.run.allocation },
      persistent: {
        ...s.persistent,
        equity: nextEquity.toString(),
        totalPrestiges: s.persistent.totalPrestiges + 1,
        // alignmentDebt + unlockedResearch persist (the thematic + design point).
      },
    });
    return { awarded: awarded.toString() };
  },

  acknowledgeDebtEvent() {
    set((s) => ({ pendingDebtEvents: s.pendingDebtEvents.slice(1) }));
  },

  setAllocation(a) {
    set((s) => ({ run: { ...s.run, allocation: normalizeAllocation(a) } }));
  },

  setOnboardingStep(step) {
    set((s) => ({ account: { ...s.account, onboardingStep: step } }));
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
export const selectActiveEffects = (s: GameState) => s.run.activeEffects;
export const selectTrainingPity = (s: GameState) => s.run.trainingPity;
export const selectPendingDebtEvents = (s: GameState) => s.pendingDebtEvents;
export const selectCanPrestige = (s: GameState) => canPrestige(s.run);
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
