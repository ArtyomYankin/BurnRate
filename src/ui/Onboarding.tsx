import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGame } from "../game/store";
import { HitId } from "./PixelScene";
import { colors, fonts, PIXEL } from "./theme";

/**
 * Guided first-run tutorial. Sits below the IntroModal in the onboarding
 * chain.
 *
 * onboardingStep semantics:
 *   0 → IntroModal (welcome). Separate component (IntroModal.tsx).
 *   1 → "hire one more engineer" — auto-advances when the player buys any
 *        engineers-chain producer (hook is in store.buyProducer).
 *   2 → "buy one more GPU" — same, on gpu-chain purchase.
 *   3 → "you're set" closer — no required action; tap to dismiss.
 *   4 → done. Tutorial component renders nothing.
 *
 * The pulsing scene highlight that points to the target is owned by
 * PixelScene via the `tutorialHighlight` prop, which HomeScreen feeds with
 * `tutorialHighlightForStep()` below.
 */

interface TutorialStep {
  target: HitId | null;
  title: string;
  text: string;
  /** Step is dismissible by tapping the card (no required scene action). */
  manualDismiss?: boolean;
}

const TUTORIAL_STEPS: Record<number, TutorialStep> = {
  1: {
    target: "engineer",
    title: "STEP 1 of 2",
    text: "Tap the engineer to hire one more. More engineers = faster everything.",
  },
  2: {
    target: "gpu",
    title: "STEP 2 of 2",
    text: "Now tap the GPU. The engineer needs compute to run code on.",
  },
  3: {
    target: null,
    title: "READY",
    text: "Tokens climb on their own. Balance all 4 chains, close the round, repeat.\n(Tap to dismiss.)",
    manualDismiss: true,
  },
};

/**
 * Helper used by HomeScreen to know which scene zone to pulse for the
 * current onboardingStep. Returns null when no highlight is needed.
 */
export function tutorialHighlightForStep(step: number): HitId | null {
  return TUTORIAL_STEPS[step]?.target ?? null;
}

export function Onboarding() {
  const step = useGame((s) => s.account.onboardingStep);
  const advance = useGame((s) => s.setOnboardingStep);

  const def = TUTORIAL_STEPS[step];
  if (!def) return null;

  const onTap = def.manualDismiss ? () => advance(step + 1) : undefined;

  // Pressable wrapper is no-op when manualDismiss is false — but we still
  // render it as a Pressable so the touch target reads consistently.
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable onPress={onTap} style={styles.card} disabled={!def.manualDismiss}>
        <View style={styles.headerRow}>
          <View style={[styles.swatch, { backgroundColor: colors.gold }]} />
          <Text style={styles.title}>{def.title}</Text>
        </View>
        <Text style={styles.body}>{def.text}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Top of screen, just below the TopHUD. The scene's interactive sprites
    // (engineer, GPU, books, etc.) all live in the middle/lower band, so a
    // top placement never occludes them — and never fights the ItemPopup,
    // which sits at bottom: 110. Right edge clears the DEV chip (top:140,
    // right:6, ~40px wide) so they don't overlap in __DEV__ builds.
    position: "absolute",
    left: 12,
    right: 58,
    top: 138,
    zIndex: 40,
  },
  card: {
    backgroundColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.ink_hi,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  swatch: {
    width: 8,
    height: 8,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.gold,
    letterSpacing: 2,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.cream_hi,
    lineHeight: 17,
    marginTop: 6,
  },
});
