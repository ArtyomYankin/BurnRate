import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useGame } from "../game/store";
import { HitId } from "./PixelScene";
import { colors, fonts, PIXEL } from "./theme";
import { useStrings } from "../core/i18n";

/**
 * Guided first-run tutorial. Sits below the IntroModal in the onboarding
 * chain.
 *
 * onboardingStep semantics (12-step forced walkthrough):
 *   0 → IntroModal (welcome). Separate component (IntroModal.tsx).
 *   1 → "How tokens are made" — Liebig pipeline explanation. Manual dismiss.
 *   2 → "Hire an engineer" — auto-advances on any engineers-chain purchase.
 *   3 → "Buy a GPU" — auto-advances on any gpu-chain purchase.
 *   4 → "Allocation" explainer — what the 4 departments mean. Manual.
 *   5 → "Open ALLOCATE" FORCED — spotlight on the bottom allocation bar,
 *        every other tap blocked. Auto-advances when AllocateScreen opens.
 *   6 → "Currencies" — quick glossary. Manual dismiss.
 *   7 → "Training Run" — points at the monitor; auto-advances when the
 *        player consumes the free-first-roll freebie (handled in store).
 *   8 → "Ready" closer. Manual dismiss.
 *   9 → "Research available" — appears only AFTER the player closes their
 *        first round (so they have Equity to spend). Auto-advances on first
 *        research-node buy.
 *   10 → "Open INBOX" FORCED — spotlight on Slack button, blocks everything
 *        else. Only renders once the player actually has an unread vignette.
 *        Auto-advances on Vignettes screen open.
 *   11 → "Open ACHIEVEMENTS" FORCED — spotlight on the ACH chip in the HUD,
 *        blocks others. Auto-advances on AchievementsScreen open.
 *   12 → done. Tutorial component renders nothing.
 *
 * Explainer steps render as a BIGGER card with title + multi-line body.
 * Interactive scene-tap steps render as a compact chip at the top. Forced
 * walkthrough steps (5/10/11) render via TutorialSpotlight — the overlay
 * with the cutout — so this component renders NOTHING for those.
 */

interface TutorialStepMeta {
  target: HitId | null;
  /** Step is dismissible by tapping the card (no required scene action). */
  manualDismiss?: boolean;
  /** Render as a large explanation card instead of a compact action chip. */
  layout?: "chip" | "explainer";
}

// Non-localizable metadata only — title / text come from i18n via
// t.onboarding.steps[step].
const STEP_META: Record<number, TutorialStepMeta> = {
  1:  { target: null,       manualDismiss: true, layout: "explainer" },
  2:  { target: "engineer",                       layout: "chip" },
  3:  { target: "gpu",                            layout: "chip" },
  4:  { target: null,       manualDismiss: true, layout: "explainer" },
  // Step 5 is a forced walkthrough — rendered by TutorialSpotlight, not
  // here. Onboarding.tsx returns null below so the spotlight's caption is
  // the only thing the player sees for this step.
  5:  { target: null,                             layout: "chip" },
  6:  { target: null,       manualDismiss: true, layout: "explainer" },
  7:  { target: "monitor",                        layout: "chip" },
  8:  { target: null,       manualDismiss: true, layout: "explainer" },
  9:  { target: "research",                       layout: "chip" },
  // Steps 10 & 11 are forced — rendered by TutorialSpotlight. Onboarding
  // skips rendering for them too.
  10: { target: null,                             layout: "chip" },
  11: { target: null,                             layout: "chip" },
};

/**
 * Helper used by HomeScreen to know which scene zone to pulse for the
 * current onboardingStep. Returns null when no highlight is needed.
 */
export function tutorialHighlightForStep(step: number): HitId | null {
  return STEP_META[step]?.target ?? null;
}

export function Onboarding() {
  const step = useGame((s) => s.account.onboardingStep);
  const hydrated = useGame((s) => s.hydrated);
  const advance = useGame((s) => s.setOnboardingStep);
  const t = useStrings();

  // Same flash-prevention as IntroModal: don't render the tutorial card
  // until the save has loaded, otherwise step=0's "tap the engineer" chip
  // briefly appears even for veteran players.
  if (!hydrated) return null;
  // Forced-walkthrough steps (5/10/11) are rendered by TutorialSpotlight,
  // not here. Onboarding stays out of the way so the spotlight's caption
  // is the only on-screen instruction for those steps.
  if (step === 5 || step === 10 || step === 11) return null;
  const meta = STEP_META[step];
  if (!meta) return null;
  const copy = t.onboarding.steps[step as keyof typeof t.onboarding.steps];
  if (!copy) return null;
  // Step 9 (Research) advances on opening the Research screen — not on
  // buying a node. So we no longer gate the chip on equity > 0; the
  // player can complete the step even with 0 Equity (the chip teaches
  // WHERE Research lives, doesn't force a spend).

  const onTap = meta.manualDismiss ? () => advance(step + 1) : undefined;
  const isExplainer = meta.layout === "explainer";

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
            <Text style={styles.explainerTitle}>{copy.title}</Text>
          </View>
          <Text style={styles.explainerBody}>{copy.text}</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable onPress={onTap} style={styles.card} disabled={!meta.manualDismiss}>
        <View style={styles.headerRow}>
          <View style={[styles.swatch, { backgroundColor: colors.gold }]} />
          <Text style={styles.title}>{copy.title}</Text>
        </View>
        <Text style={styles.body}>{copy.text}</Text>
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
