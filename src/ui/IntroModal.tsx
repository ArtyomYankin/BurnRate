import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useGame } from "../game/store";
import { colors, fonts, PIXEL } from "./theme";

/**
 * First-launch welcome screen. Sets the story up so the player knows WHY
 * they're tapping things: it's the AI era, you need tokens, build the
 * pipeline, grow as fast as you can.
 *
 * Fires once, when `account.onboardingStep === 0`. On dismiss it advances
 * the step to 1 so the existing tooltip onboarding (Onboarding.tsx) picks
 * up from there. Resetting the save via DEV wipes the step back to 0 and
 * the intro fires again on next launch.
 */
export function IntroModal() {
  const step = useGame((s) => s.account.onboardingStep);
  const hydrated = useGame((s) => s.hydrated);
  const advance = useGame((s) => s.setOnboardingStep);
  // Always mount the <Modal>; toggle visibility via the prop. Unmounting an
  // open native Modal can leave a ghost overlay that swallows touches across
  // the whole screen (the bug behind "after BEGIN nothing in the scene clicks").
  //
  // `hydrated` gate prevents the intro from flashing for returning players —
  // before the save loads, default state has onboardingStep=0 (which would
  // open the modal); after hydrate, the persisted higher step kicks in and
  // dismisses it. The flash is jarring on every cold launch — easier to just
  // not render the intro until we KNOW the player's actual step.
  const visible = hydrated && step === 0;
  const begin = () => advance(1);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={begin}>
      <View style={styles.backdrop}>
        <View style={styles.frame}>
          <View style={styles.brandRow}>
            <View style={[styles.brandSwatch, { backgroundColor: colors.gold }]} />
            <Text style={styles.brand}>
              BURN<Text style={{ color: colors.terracotta }}>·</Text>RATE
            </Text>
          </View>

          <Text style={styles.eyebrow}>IT'S THE AI ERA</Text>

          <Text style={styles.body}>
            You have a garage, a hoodie, and an idea worth a billion dollars.
          </Text>
          <Text style={styles.body}>
            To ship it you need <Text style={styles.bodyEm}>TOKENS</Text> — and
            to make tokens you need <Text style={styles.bodyEm}>Engineers</Text>,{" "}
            <Text style={styles.bodyEm}>GPUs</Text>,{" "}
            <Text style={styles.bodyEm}>Data</Text>, and{" "}
            <Text style={styles.bodyEm}>Energy</Text>.
          </Text>
          <Text style={styles.body}>
            Build all four. Balance the pipeline. Grow as fast as you can.
            Close funding rounds, raise the bar, and try not to lose the
            alignment plot.
          </Text>

          <View style={styles.hintRow}>
            <View style={[styles.hintDot, { backgroundColor: colors.sage }]} />
            <Text style={styles.hint}>TAP things on the screen to buy / act</Text>
          </View>
          <View style={styles.hintRow}>
            <View style={[styles.hintDot, { backgroundColor: colors.terracotta }]} />
            <Text style={styles.hint}>WATCH the token counter at the top</Text>
          </View>
          <View style={styles.hintRow}>
            <View style={[styles.hintDot, { backgroundColor: colors.gold }]} />
            <Text style={styles.hint}>CLOSE ROUND when you hit the threshold</Text>
          </View>

          <Pressable style={styles.cta} onPress={begin}>
            <Text style={styles.ctaText}>BEGIN →</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(42,42,42,0.55)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  frame: {
    backgroundColor: colors.cream_hi,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: colors.ink,
    // Pixel box: hard ink-offset shadow, no blur.
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    gap: 8,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandSwatch: {
    width: 12,
    height: 12,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 14,
    color: colors.ink,
    letterSpacing: 2,
  },
  eyebrow: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1.5,
    marginTop: 2,
    marginBottom: 4,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 18,
  },
  bodyEm: {
    fontFamily: fonts.bodyBold,
    color: colors.terracotta_2,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  hintDot: {
    width: 6,
    height: 6,
  },
  hint: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1,
  },
  cta: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: "stretch",
    alignItems: "center",
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  ctaText: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 2,
  },
});
