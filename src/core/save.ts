import { D, ZERO } from "./decimal";
import {
  AccountState,
  Allocation,
  PersistentState,
  RunState,
  SaveBlob,
  SCHEMA_VERSION,
} from "./types";
import { DEFAULT_ALLOCATION, freshRunState } from "./math";

function genUid(): string {
  // Lightweight UUID-v4 — good enough for an anonymous local-only ID.
  const hex = (n: number) =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0");
  return `${hex(0)}${hex(0)}-${hex(0)}-4${hex(0).slice(1)}-${hex(0)}-${hex(0)}${hex(0)}${hex(0)}`;
}

export function freshSave(now: number = Date.now()): SaveBlob {
  return {
    schemaVersion: SCHEMA_VERSION,
    run: freshRunState(),
    persistent: {
      equity: ZERO.toString(),
      totalPrestiges: 0,
      alignmentDebt: ZERO.toString(),
      unlockedResearch: [],
      firedDebtThresholds: [],
      unlockedVignettes: [],
      unreadVignettes: [],
      resolvedVignettes: {},
      unlockedAchievements: [],
      endgameSeenAt: 0,
    },
    account: {
      anonUid: genUid(),
      createdAt: now,
      lastPlayAt: now,
      onboardingStep: 0,
      sessionsStarted: 0,
      pushOptedIn: false,
      pushPromptedAt: 0,
      language: "EN",
    },
  };
}

/**
 * Forward-migrate any prior schema_version to current. Each version bump
 * appends a step. v1 → v2 adds Allocate fields without nuking the player's run.
 */
export function migrate(raw: unknown): SaveBlob {
  if (!raw || typeof raw !== "object") return freshSave();
  const blob = raw as Partial<SaveBlob> & { schemaVersion?: number };
  if ((blob.schemaVersion ?? 0) > SCHEMA_VERSION) {
    throw new Error(
      `Save schema v${blob.schemaVersion} is newer than this build (v${SCHEMA_VERSION}). Refusing to load.`
    );
  }
  if (blob.schemaVersion === SCHEMA_VERSION && blob.run && blob.persistent && blob.account) {
    return blob as SaveBlob;
  }
  // v1/v2/v3 → v4 migration in one shot, since each older version is just
  // "the current shape minus some fields." Missing fields get safe defaults.
  if ((blob.schemaVersion ?? 0) < SCHEMA_VERSION && blob.run && blob.persistent && blob.account) {
    // v11 → v12: round ladder went from 12 → 10 rounds (Series C and D
    // dropped). Remap any pre-v12 fundingRoundIdx so the player lands
    // somewhere sensible in the new ladder. Each dropped round folds into
    // its scene-mate's successor: old 3 (Series C, coworking) → new 2
    // (Series B, still coworking); old 4 (Series D, office) → new 3 (IPO,
    // still office). Old indices ≥ 5 shift down by 2.
    const remapRoundIdx = (old: number | undefined): number | undefined => {
      if (typeof old !== "number") return old;
      if ((blob.schemaVersion ?? 0) >= 12) return old;
      const MAP: Record<number, number> = {
        0: 0, 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8, 11: 9,
      };
      return MAP[old] ?? Math.min(old, 9);
    };
    const oldRun = blob.run as RunState & Partial<{
      hype: string;
      researchPoints: string;
      allocation: Allocation;
      activeEffects: RunState["activeEffects"];
      trainingPity: number;
      sprintUpgradesUnlocked: string[];
    }>;
    const oldPersist = blob.persistent as PersistentState & Partial<{
      alignmentDebt: string;
      unlockedResearch: string[];
      firedDebtThresholds: number[];
      unlockedVignettes: string[];
      unreadVignettes: string[];
      resolvedVignettes: Record<string, number>;
      unlockedAchievements: string[];
    }>;
    return {
      schemaVersion: SCHEMA_VERSION,
      run: {
        ...oldRun,
        hype:           oldRun.hype           ?? ZERO.toString(),
        researchPoints: oldRun.researchPoints ?? ZERO.toString(),
        allocation:     oldRun.allocation     ?? DEFAULT_ALLOCATION,
        activeEffects:  oldRun.activeEffects  ?? [],
        trainingPity:   oldRun.trainingPity   ?? 0,
        // v7 → v8: per-run sprint upgrades. Empty array = no boosts
        // carried over; the player can buy them this round with RP.
        sprintUpgradesUnlocked: oldRun.sprintUpgradesUnlocked ?? [],
        // v11 → v12: clamp/remap into the new 10-round ladder.
        fundingRoundIdx: remapRoundIdx(oldRun.fundingRoundIdx) ?? 0,
      },
      persistent: {
        ...oldPersist,
        alignmentDebt:       oldPersist.alignmentDebt       ?? ZERO.toString(),
        unlockedResearch:    oldPersist.unlockedResearch    ?? [],
        firedDebtThresholds: oldPersist.firedDebtThresholds ?? [],
        // v5 → v6: vignettes added. Empty arrays are safe — the trigger
        // loop re-checks unlock conditions every tick and will repopulate
        // anything the player has already qualified for on next session.
        unlockedVignettes:   oldPersist.unlockedVignettes   ?? [],
        unreadVignettes:     oldPersist.unreadVignettes     ?? [],
        // v6 → v7: Beat 3 resolutions. Empty map = "no replies picked yet"
        // — when the player re-opens an unlocked Slack DM with replyEffects,
        // they get a fresh chance to pick a reply.
        resolvedVignettes:   oldPersist.resolvedVignettes   ?? {},
        // v8 → v9: achievements grid. Empty on migrate — the tick re-checks
        // every condition, so already-earned ones re-fire on the next tick
        // (with the audio cue + unread badge, briefly).
        unlockedAchievements: oldPersist.unlockedAchievements ?? [],
        // v12 → v13: endgame modal seen marker. 0 lets the finale fire
        // again for legacy saves — the modal triggers on the NEXT prestige
        // from round 9 anyway, so the worst case is "veteran player sees
        // it once after the migration" which is the intended UX.
        endgameSeenAt: (oldPersist as Partial<PersistentState>).endgameSeenAt ?? 0,
      },
      account: {
        // v9 → v10: push-notification opt-in fields. Conservative defaults —
        // sessionsStarted starts at 1 (this counts as a session), pushOptedIn
        // false, pushPromptedAt 0.
        // v10 → v11: language for the Settings menu. "EN" default.
        ...(blob.account as AccountState),
        sessionsStarted: (blob.account as Partial<AccountState>).sessionsStarted ?? 1,
        pushOptedIn:     (blob.account as Partial<AccountState>).pushOptedIn     ?? false,
        pushPromptedAt:  (blob.account as Partial<AccountState>).pushPromptedAt  ?? 0,
        language:        (blob.account as Partial<AccountState>).language        ?? "EN",
      },
    };
  }
  return freshSave();
}

export function serialize(save: SaveBlob): string {
  // Decimal values already live as strings in SaveBlob.
  return JSON.stringify(save);
}

export function deserialize(text: string): SaveBlob {
  return migrate(JSON.parse(text));
}

// Convenience helpers so the UI doesn't have to reach for break_eternity directly.
export const decimalFromState = (s: string) => D(s);
export type { RunState, PersistentState, AccountState };
