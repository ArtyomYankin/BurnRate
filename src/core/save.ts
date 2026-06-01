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
    },
    account: {
      anonUid: genUid(),
      createdAt: now,
      lastPlayAt: now,
      onboardingStep: 0,
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
      },
      account: blob.account as AccountState,
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
