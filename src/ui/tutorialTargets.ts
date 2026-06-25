import { create } from "zustand";

/**
 * Lightweight registry of on-screen positions for tutorial spotlight targets.
 *
 * Any component that wants to be "pointable" by the forced walkthrough calls
 * `useRegisterTutorialTarget(key)` and spreads the returned `onLayout` prop on
 * a View. The View's measured rect (window-space, after a deferred measure
 * pass) lands in the store; the spotlight overlay reads it to cut a "hole"
 * the player can tap through.
 *
 * Why not just refs + measure on demand? The spotlight has to RE-cut the
 * hole on every layout change (rotation, virtual keyboard, content reflow).
 * A zustand store gives us reactive updates "for free".
 *
 * Targets are best-effort: if a target hasn't mounted yet, the spotlight
 * shows nothing (falls back to the older non-forced chip behavior) — the
 * tutorial still works, just without the gate. Keeps the system from
 * deadlocking on missing targets.
 */

export type TutorialTargetKey = "alloc-bar" | "slack-btn" | "ach-btn";

export interface TargetRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TargetsStore {
  rects: Partial<Record<TutorialTargetKey, TargetRect>>;
  setRect(key: TutorialTargetKey, rect: TargetRect | null): void;
}

export const useTutorialTargets = create<TargetsStore>((set) => ({
  rects: {},
  setRect: (key, rect) =>
    set((s) => {
      if (!rect) {
        const next = { ...s.rects };
        delete next[key];
        return { rects: next };
      }
      const prev = s.rects[key];
      if (
        prev &&
        prev.x === rect.x &&
        prev.y === rect.y &&
        prev.w === rect.w &&
        prev.h === rect.h
      ) {
        return s;
      }
      return { rects: { ...s.rects, [key]: rect } };
    }),
}));
