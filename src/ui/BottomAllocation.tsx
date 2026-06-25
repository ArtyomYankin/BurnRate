import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Allocation } from "../core/types";
import { colors, fonts, PIXEL } from "./theme";
import { TutorialTargetKey } from "./tutorialTargets";
import { useTutorialTargetMeasure } from "./TutorialSpotlight";
import { useStrings } from "../core/i18n";

interface Props {
  allocation: Allocation;
  onEdit(): void;
  /** Registers this bar's window-space rect into the tutorial spotlight
   *  registry for the forced walkthrough. */
  tutorialTargetKey: TutorialTargetKey;
}

/**
 * Bottom token-allocation strip — ported from Claude Design
 * `screens.jsx::BottomBar`. Single stacked pixel bar where each segment's
 * width is proportional to its % of incoming tokens. "Safety low" turns the
 * SAFE segment red and shows a debt-accruing warning underneath.
 */
export function BottomAllocation({ allocation, onEdit, tutorialTargetKey }: Props) {
  const targetHook = useTutorialTargetMeasure(tutorialTargetKey);
  const t = useStrings();
  const pct = {
    rd:        Math.round(allocation.rd * 100),
    product:   Math.round(allocation.product * 100),
    marketing: Math.round(allocation.marketing * 100),
    safety:    Math.round(allocation.safety * 100),
  };
  const warnSafety = pct.safety < 10;
  const segments = [
    { key: "rd",        label: t.allocate.rd,        pct: pct.rd,        color: colors.sage },
    { key: "product",   label: t.allocate.product,   pct: pct.product,   color: colors.terracotta },
    { key: "marketing", label: t.allocate.marketing, pct: pct.marketing, color: colors.gold },
    {
      key: "safety",
      label: t.allocate.safety,
      pct: pct.safety,
      color: warnSafety ? colors.tensionRed : colors.tensionRed,
    },
  ];

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {/* The whole strip is the tap target — earlier we only made the "EDIT
          →" link pressable, but players were tapping the percentage segments
          expecting that to open the editor. Now the entire box is a
          Pressable; the EDIT text is kept as a visual cue only. */}
      <Pressable
        ref={targetHook.ref}
        onLayout={targetHook.onLayout}
        onPress={onEdit}
        style={styles.box}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t.allocate.barTitle}</Text>
          <Text style={styles.editLink}>{t.allocate.edit} →</Text>
        </View>

        <View style={styles.bar}>
          {segments.map((s, i) => (
            <View
              key={s.key}
              style={[
                styles.segment,
                {
                  flex: Math.max(s.pct, 0.001),
                  backgroundColor: s.color,
                  borderRightWidth: i < segments.length - 1 ? 1 : 0,
                  borderRightColor: "rgba(42,42,42,0.4)",
                },
              ]}
            >
              <View style={styles.segmentHi} pointerEvents="none" />
              {s.pct > 6 && (
                <Text style={styles.segmentPct}>{s.pct}%</Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.labelRow}>
          {segments.map((s) => (
            <View key={s.key} style={{ flex: Math.max(s.pct, 0.001) }}>
              <Text
                style={[
                  styles.segmentLabel,
                  warnSafety && s.key === "safety" && { color: colors.tensionRed },
                ]}
                numberOfLines={1}
              >
                {s.label}
              </Text>
            </View>
          ))}
        </View>

        {warnSafety && (
          <Text style={styles.warn}>{t.allocate.safetyLowBanner}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 16,
    zIndex: 25,
  },
  box: {
    backgroundColor: colors.cream_hi,
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1,
  },
  editLink: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.terracotta,
    letterSpacing: 1,
  },
  bar: {
    flexDirection: "row",
    height: 18,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.cream_2,
    overflow: "hidden",
  },
  segment: {
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0,
    position: "relative",
  },
  segmentHi: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  segmentPct: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.cream_hi,
    letterSpacing: 0,
  },
  labelRow: {
    flexDirection: "row",
    marginTop: 3,
  },
  segmentLabel: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    color: colors.muted,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  warn: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    color: colors.tensionRed,
    letterSpacing: 0.5,
    marginTop: 3,
  },
});
