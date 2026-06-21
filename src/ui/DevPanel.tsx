import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  __devAddCapital,
  __devAddEquity,
  __devAddTokens,
  __devFillRoundThreshold,
  __devJumpToRound,
  __devReplayIntro,
  __devSendTestPush,
  __devResetVignetteResolutions,
  __devSkipTime,
  __devUnlockAllResearch,
  __devUnlockAllVignettes,
  __devWipeSave,
} from "../game/devActions";
import { FUNDING_ROUNDS } from "../core/rounds";
import { colors, fonts, PIXEL } from "./theme";

interface Props {
  visible: boolean;
  onClose(): void;
}

/**
 * Developer cheat panel. Hidden in release builds — App.tsx wraps this in a
 * `__DEV__` check so the file isn't even imported on production bundles.
 *
 * Opens via long-press on the BURN·RATE wordmark in HomeScreen. Inside:
 * grouped sections of one-tap actions, each calling an underlying
 * `__dev*` function from devActions.ts.
 *
 * Visual language: pixel chrome to match the rest of the game, but with a
 * loud terracotta DEV stripe across the top so screenshots can't be
 * mistaken for the live UX.
 */
export function DevPanel({ visible, onClose }: Props) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheetWrap} onPress={() => { /* swallow */ }}>
          <View style={styles.sheet}>
            <View style={styles.titleStripe}>
              <Text style={styles.titleStripeText}>DEV · CHEATS · NOT IN RELEASE</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={styles.scrollPad}>
              <Section label="START OVER">
                <Btn
                  label="RESTART GAME (wipe save)"
                  danger
                  onPress={() => {
                    // Close the panel BEFORE the wipe — otherwise DevPanel
                    // and IntroModal end up stacked on top of each other and
                    // taps get caught in the middle.
                    onClose();
                    void __devWipeSave();
                  }}
                />
              </Section>

              <Section label="TIME">
                <Btn label="+1h"  onPress={() => __devSkipTime(3600)} />
                <Btn label="+8h"  onPress={() => __devSkipTime(8 * 3600)} />
                <Btn label="+24h" onPress={() => __devSkipTime(24 * 3600)} />
              </Section>

              <Section label="TOKENS">
                <Btn label="+1M"   onPress={() => __devAddTokens(6)} />
                <Btn label="+1B"   onPress={() => __devAddTokens(9)} />
                <Btn label="+1e20" onPress={() => __devAddTokens(20)} />
                <Btn label="+1e34 (IPO)" onPress={() => __devAddTokens(34)} />
                <Btn label="FILL ROUND" onPress={() => __devFillRoundThreshold()} />
              </Section>

              <Section label="OTHER CURRENCIES">
                <Btn label="+1M Capital" onPress={() => __devAddCapital(6)} />
                <Btn label="+1B Capital" onPress={() => __devAddCapital(9)} />
                <Btn label="+100 Equity" onPress={() => __devAddEquity(100)} />
                <Btn label="+1K Equity"  onPress={() => __devAddEquity(1000)} />
              </Section>

              <Section label="ROUND JUMP — resets producers / tokens / capital">
                {FUNDING_ROUNDS.map((r) => (
                  <Btn
                    key={r.id}
                    label={`→ ${r.name}`}
                    onPress={() => __devJumpToRound(r.idx)}
                  />
                ))}
              </Section>

              <Section label="VIGNETTES">
                <Btn label="Unlock all" onPress={() => __devUnlockAllVignettes()} />
                <Btn label="Reset replies" onPress={() => __devResetVignetteResolutions()} />
              </Section>

              <Section label="RESEARCH">
                <Btn label="Unlock all nodes" onPress={() => __devUnlockAllResearch()} />
              </Section>

              <Section label="ONBOARDING">
                <Btn label="Replay intro" onPress={() => __devReplayIntro()} />
              </Section>

              <Section label="NOTIFICATIONS">
                <Btn label="Test push (5s)" onPress={() => void __devSendTestPush()} />
              </Section>
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.btnRow}>{children}</View>
    </View>
  );
}

function Btn({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress(): void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.btn,
        { backgroundColor: danger ? colors.tensionRed : colors.cream_hi },
      ]}
    >
      <Text
        style={[
          styles.btnText,
          { color: danger ? colors.cream : colors.ink },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26,22,18,0.75)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheetWrap: {
    width: "92%",
    maxWidth: 440,
  },
  sheet: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  titleStripe: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.terracotta,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  titleStripeText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.cream_hi,
    letterSpacing: 1.5,
  },
  closeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    color: colors.cream_hi,
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  scrollPad: {
    padding: 10,
    gap: 12,
  },
  section: {
    gap: 6,
  },
  sectionLabel: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.muted,
    letterSpacing: 1.5,
  },
  btnRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  btnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    letterSpacing: 0.5,
  },
});
