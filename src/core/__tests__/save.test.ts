import { describe, expect, it } from "vitest";
import { freshSave, migrate, deserialize, serialize } from "../save";
import { SCHEMA_VERSION } from "../types";

// v5 → v6 migration is the live concern here: any player who installed before
// the vignette bump has a save without unlockedVignettes/unreadVignettes, and
// we must NOT crash or wipe their progress. These tests freeze that contract.

describe("freshSave", () => {
  it("ships current schema version with empty vignette arrays + empty resolution map", () => {
    const s = freshSave();
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.persistent.unlockedVignettes).toEqual([]);
    expect(s.persistent.unreadVignettes).toEqual([]);
    expect(s.persistent.resolvedVignettes).toEqual({});
  });
});

describe("migrate v5 → v6", () => {
  // A snapshot of a v5 save (schema before vignettes existed). Only the
  // shape matters for the migration; the values are arbitrary.
  const v5Save = {
    schemaVersion: 5,
    run: {
      fundingRoundIdx: 2,
      tokens: "12345",
      capital: "678",
      hype: "90",
      researchPoints: "5",
      allocation: { rd: 0.25, product: 0.4, marketing: 0.2, safety: 0.15 },
      producersOwned: { intern: 4 },
      activeEffects: [],
      trainingPity: 7,
    },
    persistent: {
      equity: "100",
      totalPrestiges: 1,
      alignmentDebt: "12",
      unlockedResearch: ["rd_kernel"],
      firedDebtThresholds: [10],
    },
    account: {
      anonUid: "abc",
      createdAt: 1,
      lastPlayAt: 2,
      onboardingStep: 3,
    },
  };

  it("upgrades a v5 save in place, preserving every existing field", () => {
    const migrated = migrate(v5Save);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    // Player progress untouched
    expect(migrated.run.fundingRoundIdx).toBe(2);
    expect(migrated.run.tokens).toBe("12345");
    expect(migrated.run.allocation).toEqual({ rd: 0.25, product: 0.4, marketing: 0.2, safety: 0.15 });
    expect(migrated.persistent.equity).toBe("100");
    expect(migrated.persistent.unlockedResearch).toEqual(["rd_kernel"]);
    expect(migrated.persistent.firedDebtThresholds).toEqual([10]);
    expect(migrated.account.anonUid).toBe("abc");
  });

  it("backfills the new vignette arrays as empty (trigger loop will repopulate)", () => {
    const migrated = migrate(v5Save);
    expect(migrated.persistent.unlockedVignettes).toEqual([]);
    expect(migrated.persistent.unreadVignettes).toEqual([]);
  });

  it("backfills resolvedVignettes as empty map (Beat 3 v7 field)", () => {
    const migrated = migrate(v5Save);
    expect(migrated.persistent.resolvedVignettes).toEqual({});
  });

  it("round-trips through serialize/deserialize without loss", () => {
    const a = freshSave();
    a.persistent.unlockedVignettes = ["welcome", "series_a_deck"];
    a.persistent.unreadVignettes = ["series_a_deck"];
    a.persistent.resolvedVignettes = { welcome: 1 };
    const b = deserialize(serialize(a));
    expect(b.persistent.unlockedVignettes).toEqual(["welcome", "series_a_deck"]);
    expect(b.persistent.unreadVignettes).toEqual(["series_a_deck"]);
    expect(b.persistent.resolvedVignettes).toEqual({ welcome: 1 });
  });

  it("refuses to load a save claiming a newer schema (forward-incompatible)", () => {
    const future = { ...v5Save, schemaVersion: SCHEMA_VERSION + 1 };
    expect(() => migrate(future)).toThrow(/newer/i);
  });
});

describe("migrate v6 → v7", () => {
  // A v6 save: has unlockedVignettes/unreadVignettes (added in v6) but no
  // resolvedVignettes (added in v7). Player has already opened the inbox
  // and read a couple — they keep that state, and gain the ability to
  // pick replies starting next session.
  const v6Save = {
    schemaVersion: 6,
    run: {
      fundingRoundIdx: 0,
      tokens: "100",
      capital: "0",
      hype: "0",
      researchPoints: "0",
      allocation: { rd: 0.10, product: 0.60, marketing: 0.15, safety: 0.15 },
      producersOwned: { intern: 1 },
      activeEffects: [],
      trainingPity: 0,
    },
    persistent: {
      equity: "0",
      totalPrestiges: 0,
      alignmentDebt: "0",
      unlockedResearch: [],
      firedDebtThresholds: [],
      unlockedVignettes: ["welcome"],
      unreadVignettes: [],
    },
    account: { anonUid: "u", createdAt: 1, lastPlayAt: 2, onboardingStep: 0 },
  };

  it("preserves vignette unlocked/unread arrays and seeds an empty resolution map", () => {
    const migrated = migrate(v6Save);
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(migrated.persistent.unlockedVignettes).toEqual(["welcome"]);
    expect(migrated.persistent.unreadVignettes).toEqual([]);
    expect(migrated.persistent.resolvedVignettes).toEqual({});
  });
});
