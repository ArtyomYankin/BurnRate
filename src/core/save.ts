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
      freeTrainingRunUsed: false,
      panelHintsSeen: [],
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
      sfxMuted: false,
      musicEnabled: false,
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
        // v13 → v14: free training run freebie. false on migrate so vets
        // also get the teaching boost on their next session.
        freeTrainingRunUsed: (oldPersist as Partial<PersistentState>).freeTrainingRunUsed ?? false,
        // v16 → v17: panel hints seen-set. Empty on migrate so vets see
        // each compact hint once (and can dismiss it once).
        panelHintsSeen: (oldPersist as Partial<PersistentState>).panelHintsSeen ?? [],
      },
      account: {
        // v9 → v10: push-notification opt-in fields. Conservative defaults —
        // sessionsStarted starts at 1 (this counts as a session), pushOptedIn
        // false, pushPromptedAt 0.
        // v10 → v11: language for the Settings menu. "EN" default.
        // v13 → v14: onboardingStep semantics shifted — a new "Training Run"
        // step was inserted at 6, pushing the old "Ready" closer from 6 → 7
        // and "done" from 7 → 8. Shift any veteran value > 5 by +1 so the
        // closer still fires in its right slot (and done players stay done).
        ...(blob.account as AccountState),
        sessionsStarted: (blob.account as Partial<AccountState>).sessionsStarted ?? 1,
        pushOptedIn:     (blob.account as Partial<AccountState>).pushOptedIn     ?? false,
        pushPromptedAt:  (blob.account as Partial<AccountState>).pushPromptedAt  ?? 0,
        language:        (blob.account as Partial<AccountState>).language        ?? "EN",
        // v14 → v15: backfill defaults that match the old transient-only
        // values (SFX on, music off — the GDD §14 "public spaces" default).
        sfxMuted:        (blob.account as Partial<AccountState>).sfxMuted        ?? false,
        musicEnabled:    (blob.account as Partial<AccountState>).musicEnabled    ?? false,
        onboardingStep:  shiftOnboardingStep(
          (blob.account as Partial<AccountState>).onboardingStep ?? 0,
          blob.schemaVersion ?? 0,
        ),
      },
    };
  }
  return freshSave();
}

/** Cumulative onboarding-step shifts applied as new tutorial steps were
 *  inserted into the chain over the schema's life. Each guard checks the
 *  source version so re-running on an already-migrated value is a no-op. */
function shiftOnboardingStep(step: number, fromVersion: number): number {
  // v13 → v14: inserted "Training Run" at step 6.
  if (fromVersion < 14 && step >= 6) step += 1;
  // v15 → v16: inserted "Research tutorial" at step 8.
  if (fromVersion < 16 && step >= 8) step += 1;
  // v17 → v18: inserted "Open ALLOCATE" at step 5, "Open INBOX" at step 10,
  // "Open ACHIEVEMENTS" at step 11. Apply in order so a veteran "done"
  // (was step 9 after v16 migration) lands on the new "done" (step 12).
  if (fromVersion < 18) {
    if (step >= 5) step += 1;
    if (step >= 10) step += 1;
    if (step >= 11) step += 1;
  }
  return step;
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
