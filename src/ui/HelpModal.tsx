import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fonts, PIXEL } from "./theme";

/**
 * "How does this work?" reference panel. Same content the tutorial explains
 * in onboardingStep 1/4/5, but always available from the [?] chip on the
 * Home screen so players can re-read without resetting their save.
 */
interface Props {
  visible: boolean;
  onClose(): void;
}

export function HelpModal({ visible, onClose }: Props) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.frame} onPress={(e) => e.stopPropagation()}>
          <View style={styles.headerRow}>
            <View style={[styles.swatch, { backgroundColor: colors.gold }]} />
            <Text style={styles.brand}>HOW IT WORKS</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeX}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
          >
            <Section
              title="HOW TOKENS ARE MADE"
              body={
                "Tokens are the fuel. They come from a pipeline of 4 chains:\n\n" +
                "ENGINEERS · GPU · DATA · ENERGY\n\n" +
                "The bottleneck (smallest of GPU/Data/Energy) caps your rate. " +
                "Engineers multiply on top. Balance all four — building only one stalls everything."
              }
            />

            <Section
              title="ALLOCATION · TOK → 4 DEPARTMENTS"
              body={
                "Every token you earn splits across four departments. Tap ALLOCATE to tune the mix.\n\n" +
                "• PRODUCT     → Capital ($) to buy more producers\n" +
                "• R&D            → Research Points (RP) for per-run sprint upgrades\n" +
                "• MARKETING → Hype to lower the next round's threshold\n" +
                "• SAFETY       → pays down Alignment Debt; under 10% accrues it"
              }
            />

            <Section
              title="WHAT THE COUNTERS MEAN"
              body={
                "$  CAPITAL — buys producers. Resets at prestige.\n" +
                "RP RESEARCH POINTS — per-run, spend on sprint upgrades.\n" +
                "HY HYPE — lowers the next round's threshold. Resets.\n" +
                "EQ EQUITY — earned at prestige. PERSISTS. Spend on the permanent Research Tree.\n" +
                "DB ALIGNMENT DEBT — accrues if Safety < 10%. PERSISTS. Triggers events."
              }
            />

            <Section
              title="THE LOOP"
              body={
                "1. Buy producers in all 4 chains. Balance.\n" +
                "2. Tokens climb. Hit the round threshold.\n" +
                "3. CLOSE ROUND (prestige) — Capital/producers reset, you earn Equity.\n" +
                "4. Spend Equity on the permanent Research Tree.\n" +
                "5. Next round starts faster than the last."
              }
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(42,42,42,0.60)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  frame: {
    backgroundColor: colors.cream_hi,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    maxHeight: "85%",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  swatch: {
    width: 10,
    height: 10,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 2,
  },
  closeX: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    lineHeight: 22,
    paddingHorizontal: 6,
  },
  scroll: {
    flexShrink: 1,
  },
  section: {
    marginTop: 6,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cream_4,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.terracotta,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  sectionBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 19,
  },
});
