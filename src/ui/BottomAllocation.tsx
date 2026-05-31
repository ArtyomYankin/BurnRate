import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Allocation } from "../core/types";
import { Pressy } from "./Pressy";
import { colors, fonts, PIXEL } from "./theme";

interface Props {
  allocation: Allocation;
  onEdit(): void;
}

/**
 * Bottom token-allocation strip — ported from Claude Design
 * `screens.jsx::BottomBar`. Single stacked pixel bar where each segment's
 * width is proportional to its % of incoming tokens. "Safety low" turns the
 * SAFE segment red and shows a debt-accruing warning underneath.
 */
export function BottomAllocation({ allocation, onEdit }: Props) {
  const pct = {
    rd:        Math.round(allocation.rd * 100),
    product:   Math.round(allocation.product * 100),
    marketing: Math.round(allocation.marketing * 100),
    safety:    Math.round(allocation.safety * 100),
  };
  const warnSafety = pct.safety < 10;
  const segments = [
    { key: "rd",        label: "R&D",  pct: pct.rd,        color: colors.sage },
    { key: "product",   label: "PROD", pct: pct.product,   color: colors.terracotta },
    { key: "marketing", label: "MKT",  pct: pct.marketing, color: colors.gold },
    {
      key: "safety",
      label: "SAFE",
      pct: pct.safety,
      color: warnSafety ? colors.tensionRed : colors.tensionRed,
    },
  ];

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.box}>
        <View style={styles.header}>
          <Text style={styles.title}>TOKEN ALLOCATION</Text>
          <Pressy onPress={onEdit}>
            <Text style={styles.editLink}>EDIT →</Text>
          </Pressy>
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
          <Text style={styles.warn}>⚠ SAFETY LOW · ALIGNMENT DEBT ACCRUING</Text>
        )}
      </View>
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
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.cream_hi,
    letterSpacing: 0.5,
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
