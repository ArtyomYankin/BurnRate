import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HitId } from "./PixelScene";
import { Pressy } from "./Pressy";
import { colors, fonts, PIXEL } from "./theme";

export interface PopupContent {
  hit: HitId;
  title: string;
  subtitle: string;
  body?: string;
  flavor?: string;
  cta?: string;
  cost?: string;
  owned?: number | string;
  rate?: string;
  kind: "producer" | "action" | "vignette" | "cosmetic";
}

interface Props {
  item: PopupContent | null;
  onClose(): void;
  /** Primary CTA action — buy / roll / read / dismiss depending on kind. */
  onAction?(): void;
}

/**
 * Slide-up sheet ported from Claude Design `screens.jsx::ItemPopup`.
 *
 * Sits above BottomAllocation (z-index 40 vs 25), reaches for the chunky
 * pixel-border look via inline borderWidth/shadow (same primitives as the
 * HUD strip — kept inline because we want zero corner-cutout views over
 * the cream background).
 *
 * Vignette content is intentionally left to the caller — GDD §13 says
 * vignettes should look like real Slack/email/etc., not pixel art.
 */
export function ItemPopup({ item, onClose, onAction }: Props) {
  if (!item) return null;
  const isProducer = item.kind === "producer";
  const isAction = item.kind === "action";

  return (
    <View style={styles.wrap}>
      <View style={styles.box}>
        {/* Plain Pressable (not Pressy) — Pressy puts the absolute style on
            the inner Pressable, which leaves the touch target stranded in
            the popup's flex flow instead of the visual top-right corner. */}
        <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
          <Text style={styles.closeX}>×</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>

        {isProducer && (
          <>
            <Text style={styles.detail}>
              Owned <Text style={styles.detailStrong}>{item.owned ?? 0}</Text>
              {item.rate ? (
                <>
                  {"  ·  Output "}
                  <Text style={styles.detailStrong}>{item.rate}/s</Text>
                </>
              ) : null}
            </Text>
            {item.flavor && <Text style={styles.flavor}>"{item.flavor}"</Text>}
            <View style={styles.ctaRow}>
              <Pressy style={[styles.cta, { backgroundColor: colors.sage }]} onPress={onAction ?? onClose}>
                <Text style={styles.ctaText}>
                  BUY 1 {item.cost ? `· $${item.cost}` : ""}
                </Text>
              </Pressy>
            </View>
          </>
        )}

        {isAction && (
          <>
            {item.body && <Text style={styles.detail}>{item.body}</Text>}
            {item.flavor && <Text style={styles.flavor}>"{item.flavor}"</Text>}
            <View style={styles.ctaRow}>
              <Pressy style={[styles.cta, { backgroundColor: colors.terracotta }]} onPress={onAction ?? onClose}>
                <Text style={styles.ctaText}>{item.cta ?? "GO"}</Text>
              </Pressy>
            </View>
          </>
        )}

        {(item.kind === "cosmetic" || item.kind === "vignette") && (
          <>
            {item.body && <Text style={styles.detail}>{item.body}</Text>}
            <View style={styles.ctaRow}>
              <Pressy
                style={[styles.cta, { backgroundColor: colors.cream_2 }]}
                onPress={onClose}
              >
                <Text style={[styles.ctaText, { color: colors.ink }]}>OK</Text>
              </Pressy>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    // Sit above the BottomAllocation strip — its top edge is at bottom: 16
    // + 80px tall ≈ bottom: 100. Give 6px breathing room.
    left: 8,
    right: 8,
    bottom: 110,
    zIndex: 40,
  },
  box: {
    backgroundColor: colors.cream_hi,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  closeBtn: {
    position: "absolute",
    top: 4,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  closeX: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.muted,
    lineHeight: 16,
  },
  header: {
    marginBottom: 6,
    paddingRight: 24,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.ink,
    lineHeight: 20,
  },
  subtitle: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1,
    marginTop: 2,
  },
  detail: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink_hi,
    marginBottom: 6,
  },
  detailStrong: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
  },
  flavor: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.muted,
    marginBottom: 8,
    fontStyle: "italic",
  },
  ctaRow: {
    flexDirection: "row",
    gap: 6,
  },
  cta: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.cream,
    letterSpacing: 1,
  },
});
