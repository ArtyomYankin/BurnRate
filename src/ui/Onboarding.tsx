import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useGame } from "../game/store";
import { colors, radii, spacing, type } from "./theme";

// GDD §4: 3 contextual tooltips at 0:05, 0:30, 1:30.
const TOOLTIPS = [
  { delaySec: 5,  text: "Tokens are your fuel. Watch them grow." },
  { delaySec: 30, text: "Hire your next engineer. Capital is on the producers screen." },
  { delaySec: 90, text: "You'll keep progressing while the app is closed. Come back tomorrow." },
];

export function Onboarding() {
  const step = useGame((s) => s.account.onboardingStep);
  const advance = useGame((s) => s.setOnboardingStep);
  const [visibleStep, setVisibleStep] = useState<number | null>(null);

  useEffect(() => {
    if (step >= TOOLTIPS.length) return;
    const t = TOOLTIPS[step];
    const handle = setTimeout(() => setVisibleStep(step), t.delaySec * 1000);
    return () => clearTimeout(handle);
  }, [step]);

  if (visibleStep === null) return null;
  const t = TOOLTIPS[visibleStep];
  if (!t) return null;

  const dismiss = () => {
    setVisibleStep(null);
    advance(visibleStep + 1);
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <View style={styles.toast}>
          <Text style={[type.body, { color: colors.cream }]}>{t.text}</Text>
          <Text style={[type.caption, { color: colors.cream, opacity: 0.7 }]}>
            tap to dismiss · {visibleStep + 1}/{TOOLTIPS.length}
          </Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(42,42,42,0.35)",
    justifyContent: "flex-end",
    padding: spacing.l,
  },
  toast: {
    backgroundColor: colors.ink,
    padding: spacing.l,
    borderRadius: radii.md,
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
});
