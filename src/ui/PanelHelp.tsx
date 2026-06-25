import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useGame } from "../game/store";
import { colors, fonts, PIXEL } from "./theme";

/**
 * Per-panel help system. Two pieces:
 *
 *   1. **`PanelHint`** — compact one-shot banner that appears at the top of
 *      the panel the first time the player opens it. Single line of
 *      actionable orientation copy + "×" to dismiss. After dismissal the
 *      banner never re-appears (tracked via `persistent.panelHintsSeen`).
 *
 *   2. **`PanelInfoButton`** + **`PanelHelpModal`** — a tiny "?" chip in the
 *      panel header that opens a longer-form info modal with multiple
 *      sections (mechanics deep-dive). Always available, not gated on
 *      first-visit state.
 *
 * Both share a single `panelKey` so dismissing the hint doesn't lose the
 * "?" button — the chip is a separate affordance. Keep hint copy tight (1-2
 * lines) and put the long-form copy in the help-modal sections instead.
 */

export interface PanelHelpSection {
  title: string;
  body: string;
}

interface PanelHintProps {
  panelKey: string;
  text: string;
}

export function PanelHint({ panelKey, text }: PanelHintProps) {
  const seen = useGame((s) => s.persistent.panelHintsSeen);
  const mark = useGame((s) => s.markPanelHintSeen);
  if (seen.includes(panelKey)) return null;
  return (
    <View style={styles.hintRow}>
      <Text style={styles.hintBadge}>TIP</Text>
      <Text style={styles.hintText} numberOfLines={2}>
        {text}
      </Text>
      <Pressable onPress={() => mark(panelKey)} hitSlop={10} style={styles.hintClose}>
        <Text style={styles.hintCloseX}>×</Text>
      </Pressable>
    </View>
  );
}

interface PanelInfoButtonProps {
  onPress(): void;
}

export function PanelInfoButton({ onPress }: PanelInfoButtonProps) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.infoBtn}>
      <Text style={styles.infoBtnText}>?</Text>
    </Pressable>
  );
}

interface PanelHelpModalProps {
  visible: boolean;
  title: string;
  sections: PanelHelpSection[];
  onClose(): void;
}

export function PanelHelpModal({ visible, title, sections, onClose }: PanelHelpModalProps) {
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.modalFrame}>
          <View style={styles.modalHeader}>
            <View style={[styles.modalSwatch, { backgroundColor: colors.gold }]} />
            <Text style={styles.modalBrand}>{title.toUpperCase()}</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.modalCloseX}>×</Text>
            </Pressable>
          </View>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
          >
            {sections.map((s, i) => (
              <View key={i} style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>{s.title}</Text>
                <Text style={styles.modalSectionBody}>{s.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 8,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.cream_hi,
    borderWidth: 1,
    borderColor: colors.gold,
    borderLeftWidth: 4,
  },
  hintBadge: {
    fontFamily: fonts.display,
    fontSize: 9,
    color: colors.gold_2,
    letterSpacing: 1.5,
  },
  hintText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ink,
    lineHeight: 16,
  },
  hintClose: {
    paddingHorizontal: 4,
  },
  hintCloseX: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.muted,
    lineHeight: 18,
  },
  infoBtn: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream_2,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  infoBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 14,
  },
  modalRoot: {
    flex: 1,
    backgroundColor: "rgba(42,42,42,0.60)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalFrame: {
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
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  modalSwatch: { width: 10, height: 10 },
  modalBrand: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.ink,
    letterSpacing: 2,
  },
  modalCloseX: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    color: colors.ink,
    lineHeight: 20,
    paddingHorizontal: 6,
  },
  modalScroll: { flexShrink: 1 },
  modalSection: {
    marginTop: 6,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cream_4,
  },
  modalSectionTitle: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.terracotta,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  modalSectionBody: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.ink,
    lineHeight: 18,
  },
});
