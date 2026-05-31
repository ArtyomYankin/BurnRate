import { describe, expect, it } from "vitest";
import { D } from "../decimal";
import {
  emptyContext,
  isConditionMet,
  pendingUnlocks,
  STARTER_TOTAL,
  VIGNETTES,
  VIGNETTE_BY_ID,
  getVignette,
} from "../vignettes";

describe("vignettes data layer", () => {
  it("every vignette has a stable id and lives in the lookup map", () => {
    const ids = new Set<string>();
    for (const v of VIGNETTES) {
      expect(v.id, "id must be non-empty").toBeTruthy();
      expect(ids.has(v.id), `duplicate id ${v.id}`).toBe(false);
      ids.add(v.id);
      expect(VIGNETTE_BY_ID[v.id], `${v.id} missing from VIGNETTE_BY_ID`).toBe(v);
      expect(getVignette(v.id)).toBe(v);
    }
  });

  it("every vignette has body copy + a recognized medium", () => {
    const validMediums = new Set([
      "slack", "board_memo", "fake_tweet", "leaked_email",
      "fake_news", "podcast", "system",
    ]);
    for (const v of VIGNETTES) {
      expect(v.body.length, `${v.id} empty body`).toBeGreaterThan(0);
      expect(v.sender.length, `${v.id} empty sender`).toBeGreaterThan(0);
      expect(validMediums.has(v.medium), `${v.id} unknown medium`).toBe(true);
    }
  });

  it("ships 15 starter vignettes (Appendix E V01-V15)", () => {
    expect(VIGNETTES.length).toBe(15);
  });

  it("when replyEffects is defined it is index-aligned with replies (Beat 3)", () => {
    for (const v of VIGNETTES) {
      if (!v.replyEffects) continue;
      expect(v.replies, `${v.id} has replyEffects but no replies`).toBeTruthy();
      expect(
        v.replyEffects.length,
        `${v.id} reply/effect length mismatch`,
      ).toBe(v.replies!.length);
      for (const eff of v.replyEffects) {
        expect(eff.label.length).toBeGreaterThan(0);
        // Effect.value > 0 for all multipliers (sub-1 is allowed for debt_accrual_mult).
        expect(eff.effect.value).toBeGreaterThan(0);
      }
    }
  });

  it("at least the three Slack DMs with replies have replyEffects wired", () => {
    const ids = ["welcome", "re_slack_reaction", "re_1on1_cancelled"];
    for (const id of ids) {
      const v = VIGNETTE_BY_ID[id];
      expect(v.replyEffects, `${id} missing replyEffects`).toBeTruthy();
      expect(v.replyEffects!.length).toBe(v.replies!.length);
    }
  });
});

describe("isConditionMet", () => {
  it("first_hire is false at the starter floor, true once anything is bought", () => {
    const ctx = emptyContext();
    expect(isConditionMet({ kind: "first_hire" }, ctx)).toBe(false);
    ctx.totalProducersOwned = STARTER_TOTAL + 1;
    expect(isConditionMet({ kind: "first_hire" }, ctx)).toBe(true);
  });

  it("total_producers_owned compares >=", () => {
    const ctx = emptyContext();
    ctx.totalProducersOwned = 20;
    expect(isConditionMet({ kind: "total_producers_owned", n: 20 }, ctx)).toBe(true);
    expect(isConditionMet({ kind: "total_producers_owned", n: 21 }, ctx)).toBe(false);
  });

  it("tokens_at_least handles Decimal magnitudes", () => {
    const ctx = emptyContext();
    ctx.tokens = D(9999);
    expect(isConditionMet({ kind: "tokens_at_least", n: 10000 }, ctx)).toBe(false);
    ctx.tokens = D(10000);
    expect(isConditionMet({ kind: "tokens_at_least", n: 10000 }, ctx)).toBe(true);
  });

  it("reach_round fires at or above the target index", () => {
    const ctx = emptyContext();
    ctx.fundingRoundIdx = 0;
    expect(isConditionMet({ kind: "reach_round", roundIdx: 1 }, ctx)).toBe(false);
    ctx.fundingRoundIdx = 1;
    expect(isConditionMet({ kind: "reach_round", roundIdx: 1 }, ctx)).toBe(true);
    ctx.fundingRoundIdx = 5;
    expect(isConditionMet({ kind: "reach_round", roundIdx: 1 }, ctx)).toBe(true);
  });

  it("approach_round requires both the right round AND the threshold ratio", () => {
    const ctx = emptyContext();
    ctx.fundingRoundIdx = 5;
    ctx.nextRoundThreshold = D(1000);
    ctx.tokens = D(400);
    expect(isConditionMet({ kind: "approach_round", roundIdx: 5, pct: 0.5 }, ctx)).toBe(false);
    ctx.tokens = D(500);
    expect(isConditionMet({ kind: "approach_round", roundIdx: 5, pct: 0.5 }, ctx)).toBe(true);
    // Wrong round → never fires even if tokens overshoot
    ctx.fundingRoundIdx = 4;
    ctx.tokens = D(10_000);
    expect(isConditionMet({ kind: "approach_round", roundIdx: 5, pct: 0.5 }, ctx)).toBe(false);
  });

  it("first_debt_event fires once any threshold lands", () => {
    const ctx = emptyContext();
    expect(isConditionMet({ kind: "first_debt_event" }, ctx)).toBe(false);
    ctx.firedDebtThresholds = [10];
    expect(isConditionMet({ kind: "first_debt_event" }, ctx)).toBe(true);
  });

  it("debt_threshold requires the exact level to have fired", () => {
    const ctx = emptyContext();
    ctx.firedDebtThresholds = [10, 25];
    expect(isConditionMet({ kind: "debt_threshold", level: 200 }, ctx)).toBe(false);
    ctx.firedDebtThresholds = [10, 25, 50, 100, 200];
    expect(isConditionMet({ kind: "debt_threshold", level: 200 }, ctx)).toBe(true);
  });

  it("prestige_count compares >=", () => {
    const ctx = emptyContext();
    ctx.totalPrestiges = 11;
    expect(isConditionMet({ kind: "prestige_count", n: 12 }, ctx)).toBe(false);
    ctx.totalPrestiges = 12;
    expect(isConditionMet({ kind: "prestige_count", n: 12 }, ctx)).toBe(true);
  });
});

describe("pendingUnlocks", () => {
  it("returns nothing when no condition is met yet", () => {
    expect(pendingUnlocks(emptyContext(), [])).toEqual([]);
  });

  it("returns the welcome vignette on first hire", () => {
    const ctx = emptyContext();
    ctx.totalProducersOwned = STARTER_TOTAL + 1;
    const ids = pendingUnlocks(ctx, []);
    expect(ids).toContain("welcome");
  });

  it("excludes vignettes that are already unlocked", () => {
    const ctx = emptyContext();
    ctx.totalProducersOwned = STARTER_TOTAL + 1;
    const ids = pendingUnlocks(ctx, ["welcome"]);
    expect(ids).not.toContain("welcome");
  });

  it("fires Series A board memo when fundingRoundIdx reaches 1", () => {
    const ctx = emptyContext();
    ctx.fundingRoundIdx = 1;
    const ids = pendingUnlocks(ctx, []);
    expect(ids).toContain("series_a_deck");
  });

  it("fires the AGI Singularity vignettes after the 12th prestige", () => {
    const ctx = emptyContext();
    ctx.totalPrestiges = 12;
    const ids = pendingUnlocks(ctx, []);
    expect(ids).toContain("final_tweet");
    expect(ids).toContain("you_made_a_company");
  });

  it("fires Congressional Hearing once debt threshold 200 lands", () => {
    const ctx = emptyContext();
    ctx.firedDebtThresholds = [10, 25, 50, 100, 200];
    const ids = pendingUnlocks(ctx, []);
    expect(ids).toContain("congressional_hearing");
    // The first_debt_event vignette also fires from the same condition cascade.
    expect(ids).toContain("techcrunch_sec_disclosure");
  });
});
