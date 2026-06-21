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
 *   1 → "How tokens are made" — Liebig pipeline explanation. Manual dismiss.
 *   2 → "Hire an engineer" — auto-advances on any engineers-chain purchase.
 *   3 → "Buy a GPU" — auto-advances on any gpu-chain purchase.
 *   4 → "Allocation" — explain Product/Marketing/R&D/Safety split. Manual.
 *   5 → "Currencies" — quick glossary of $ Capital / Hype / RP / Equity / Debt. Manual.
 *   6 → "Ready" closer. Manual dismiss.
 *   7 → done. Tutorial component renders nothing.
 *
 * The pulsing scene highlight that points to the target is owned by
 * PixelScene via the `tutorialHighlight` prop, which HomeScreen feeds with
 * `tutorialHighlightForStep()` below.
 *
 * Explanation steps (1/4/5) render as a BIGGER card with title + multi-line
 * body. Interactive steps (2/3) render as a compact chip with a 1-line
 * instruction that disappears once the player completes the required action.
 */

interface TutorialStep {
  target: HitId | null;
  title: string;
  text: string;
  /** Step is dismissible by tapping the card (no required scene action). */
  manualDismiss?: boolean;
  /** Render as a large explanation card instead of a compact action chip. */
  layout?: "chip" | "explainer";
}

const TUTORIAL_STEPS: Record<number, TutorialStep> = {
  1: {
    target: null,
    title: "HOW TOKENS ARE MADE",
    text:
      "Tokens are the fuel — and they come from a pipeline of 4 chains:\n\n" +
      "ENGINEERS · GPU · DATA · ENERGY\n\n" +
      "The bottleneck (smallest of GPU/Data/Energy) caps your rate. " +
      "Engineers multiply on top. Balance all four — building only one stalls everything.\n\n" +
      "(Tap to continue.)",
    manualDismiss: true,
    layout: "explainer",
  },
  2: {
    target: "engineer",
    title: "STEP 1 of 2 · HIRE",
    text: "Tap the engineer to hire one more. Engineers multiply the pipeline.",
    layout: "chip",
  },
  3: {
    target: "gpu",
    title: "STEP 2 of 2 · COMPUTE",
    text: "Tap the GPU. The engineer needs compute to run code on.",
    layout: "chip",
  },
  4: {
    target: null,
    title: "ALLOCATION · TOK → 4 DEPARTMENTS",
    text:
      "Every token you earn splits across four departments. Tap ALLOCATE to tune the mix.\n\n" +
      "• PRODUCT  → Capital ($) to buy more producers\n" +
      "• R&D       → Research Points (RP) for per-run sprint upgrades\n" +
      "• MARKETING → Hype to lower the next round's threshold\n" +
      "• SAFETY    → pays down Alignment Debt; under 10% accrues it\n\n" +
      "Default is Product-heavy. Crank Safety if events warn you.\n\n" +
      "(Tap to continue.)",
    manualDismiss: true,
    layout: "explainer",
  },
  5: {
    target: null,
    title: "WHAT THE COUNTERS MEAN",
    text:
      "$  CAPITAL — buys producers. Resets at prestige.\n" +
      "RP  RESEARCH POINTS — per-run, spend on sprint upgrades.\n" +
      "HY  HYPE — lowers the next round's threshold. Resets.\n" +
      "EQ  EQUITY — earned at prestige. PERSISTS. Spend on the permanent Research Tree.\n" +
      "DB  ALIGNMENT DEBT — accrues if Safety < 10%. PERSISTS. Triggers events.\n\n" +
      "(Tap to continue.)",
    manualDismiss: true,
    layout: "explainer",
  },
  6: {
    target: null,
    title: "READY",
    text:
      "Numbers climb on their own. Balance the 4 chains, close the round, prestige, " +
      "spend Equity on Research, repeat.\n\n(Tap to dismiss.)",
    manualDismiss: true,
    layout: "explainer",
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
  const hydrated = useGame((s) => s.hydrated);
  const advance = useGame((s) => s.setOnboardingStep);

  // Same flash-prevention as IntroModal: don't render the tutorial card
  // until the save has loaded, otherwise step=0's "tap the engineer" chip
  // briefly appears even for veteran players.
  if (!hydrated) return null;
  const def = TUTORIAL_STEPS[step];
  if (!def) return null;

  const onTap = def.manualDismiss ? () => advance(step + 1) : undefined;
  const isExplainer = def.layout === "explainer";

  // Explainer cards are wider + centered + full-screen modal-like (with a
  // dimmed backdrop) so the player notices the new information. Chip cards
  // stay compact at the top so they don't occlude the scene during the
  // interactive "tap the engineer" moments.
  if (isExplainer) {
    return (
      <Pressable
        pointerEvents="auto"
        style={styles.explainerBackdrop}
        onPress={onTap}
      >
        <View style={styles.explainerCard}>
          <View style={styles.headerRow}>
            <View style={[styles.swatch, { backgroundColor: colors.gold }]} />
            <Text style={styles.explainerTitle}>{def.title}</Text>
          </View>
          <Text style={styles.explainerBody}>{def.text}</Text>
        </View>
      </Pressable>
    );
  }

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
  explainerBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(42,42,42,0.55)",
    justifyContent: "center",
    paddingHorizontal: 20,
    zIndex: 60,
  },
  explainerCard: {
    backgroundColor: colors.cream_hi,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  explainerTitle: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.ink,
    letterSpacing: 2,
  },
  explainerBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 19,
    marginTop: 10,
  },
});
