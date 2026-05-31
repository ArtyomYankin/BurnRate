import { beforeEach, describe, expect, it } from "vitest";
import { freshSave } from "../../core/save";
import { useGame } from "../store";

// Tests for the Beat 3 Decide-flow (GDD §4). Zustand stores are singletons
// — `setState` resets between tests so each case starts from a clean slate.

function reset() {
  const fresh = freshSave();
  useGame.setState({
    run: fresh.run,
    persistent: fresh.persistent,
    account: fresh.account,
    lastTickAt: Date.now(),
    hydrated: true,
    pendingDebtEvents: [],
  });
}

describe("store.resolveVignette", () => {
  beforeEach(reset);

  it("applies the picked reply's effect and locks the resolution", () => {
    const { resolveVignette } = useGame.getState();
    const ok = resolveVignette("welcome", 0);
    expect(ok).toBe(true);

    const s = useGame.getState();
    expect(s.persistent.resolvedVignettes.welcome).toBe(0);
    expect(s.run.activeEffects.length).toBe(1);
    const eff = s.run.activeEffects[0];
    expect(eff.source).toBe("slack_dm");
    expect(eff.label).toMatch(/Hype/i);
    expect(eff.effect).toEqual({ type: "hype_mult", value: 1.05 });
    // 1h default duration per GDD §4 Beat 3
    expect(eff.expiresAt - eff.appliedAt).toBe(3_600_000);
  });

  it("is idempotent — re-resolving the same vignette returns false and adds no extra effect", () => {
    const { resolveVignette } = useGame.getState();
    expect(resolveVignette("welcome", 0)).toBe(true);
    const before = useGame.getState().run.activeEffects.length;
    expect(resolveVignette("welcome", 1)).toBe(false);
    expect(resolveVignette("welcome", 0)).toBe(false);
    expect(useGame.getState().run.activeEffects.length).toBe(before);
    // The lock-in records the FIRST pick, not the attempted second one.
    expect(useGame.getState().persistent.resolvedVignettes.welcome).toBe(0);
  });

  it("returns false for unknown vignette ids without mutating state", () => {
    const { resolveVignette } = useGame.getState();
    const before = useGame.getState();
    expect(resolveVignette("does_not_exist", 0)).toBe(false);
    const after = useGame.getState();
    expect(after.run.activeEffects).toEqual(before.run.activeEffects);
    expect(after.persistent.resolvedVignettes).toEqual(before.persistent.resolvedVignettes);
  });

  it("returns false when the reply index is out of range", () => {
    const { resolveVignette } = useGame.getState();
    // welcome has 3 replies (indices 0..2). 5 is past the end.
    expect(resolveVignette("welcome", 5)).toBe(false);
    expect(useGame.getState().run.activeEffects.length).toBe(0);
  });

  it("returns false for a vignette with no replyEffects (flavor-only reply)", () => {
    const { resolveVignette } = useGame.getState();
    // V09 town_hall_transcript is a Slack DM but has no replies / replyEffects.
    expect(resolveVignette("town_hall_transcript", 0)).toBe(false);
  });

  it("each Slack reply picks its own effect (proves index alignment)", () => {
    // Pick index 2 → 3rd reply on welcome ("what's the wifi password" → +5% Capital).
    const { resolveVignette } = useGame.getState();
    expect(resolveVignette("welcome", 2)).toBe(true);
    const eff = useGame.getState().run.activeEffects[0];
    expect(eff.effect).toEqual({ type: "capital_mult", value: 1.05 });
  });
});
