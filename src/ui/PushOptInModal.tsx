import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useGame } from "../game/store";
import {
  isEligibleForPushPrompt,
  requestPushPermission,
} from "../game/notifications";
import { colors, fonts, PIXEL } from "./theme";
import { useStrings } from "../core/i18n";

/**
 * Push-permission opt-in card. Fires once when the player crosses the
 * session-3 threshold (GDD §12 — never on first launch). Two CTAs:
 *
 *   ENABLE  → asks the OS for permission, records the result
 *   NOT NOW → records the prompt timestamp so we don't re-ask for a week
 *
 * Honest copy: this is the player's only re-engagement surface, and we
 * don't have ads OR streak mechanics, so the value prop is "we'll ping
 * you if there's something fun to come back to" — Pillar 1 anti-FOMO.
 */
export function PushOptInModal() {
  const t = useStrings();
  const account = useGame((s) => s.account);
  const recordPrompt = useGame((s) => s.recordPushPromptResult);

  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (isEligibleForPushPrompt(account)) {
      // Slight delay so we don't fire over a screen transition.
      const t = setTimeout(() => setOpen(true), 1500);
      return () => clearTimeout(t);
    }
  }, [account]);

  const enable = async () => {
    const granted = await requestPushPermission();
    recordPrompt(granted);
    setOpen(false);
  };

  const skip = () => {
    recordPrompt(false);
    setOpen(false);
  };

  return (
    <Modal transparent animationType="fade" visible={open} onRequestClose={skip}>
      <View style={styles.backdrop}>
        <View style={styles.frame}>
          <View style={styles.headerRow}>
            <View style={[styles.swatch, { backgroundColor: colors.gold }]} />
            <Text style={styles.brand}>{t.pushOptIn.title}</Text>
          </View>

          <Text style={styles.body}>{t.pushOptIn.body1}</Text>
          <Text style={styles.body}>{t.pushOptIn.body2}</Text>

          <Pressable style={styles.cta} onPress={enable}>
            <Text style={styles.ctaText}>{t.pushOptIn.enableBtn}</Text>
          </Pressable>
          <Pressable style={styles.skipBtn} onPress={skip}>
            <Text style={styles.skipText}>{t.pushOptIn.notNowBtn}</Text>
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
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  swatch: { width: 10, height: 10 },
  brand: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 2,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
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
  skipBtn: {
    marginTop: 4,
    paddingVertical: 6,
    alignSelf: "center",
  },
  skipText: {
    fontFamily: fonts.displayRegular,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1.5,
  },
});
