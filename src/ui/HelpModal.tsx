import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fonts, PIXEL } from "./theme";
import { useStrings } from "../core/i18n";

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
  const t = useStrings();
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      {/* Backdrop and frame are siblings (not parent/child). Wrapping the
          ScrollView in an outer Pressable was eating swipe gestures and the
          content couldn't scroll on touch devices. With the frame as a sibling
          View rendered above the absolutely-positioned backdrop, touches on
          the frame never reach the backdrop, so we don't need stopPropagation. */}
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.frame}>
          <View style={styles.headerRow}>
            <View style={[styles.swatch, { backgroundColor: colors.gold }]} />
            <Text style={styles.brand}>{t.helpModal.title}</Text>
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
            {t.helpModal.sections.map((s, i) => (
              <Section key={i} title={s.title} body={s.body} />
            ))}
          </ScrollView>
        </View>
      </View>
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
  modalRoot: {
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
