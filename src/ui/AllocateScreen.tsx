import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { DEFAULT_ALLOCATION } from "../core/math";
import { Allocation } from "../core/types";
import { selectAllocation, useGame } from "../game/store";
import { colors, fonts, PIXEL } from "./theme";

interface Props {
  onBack(): void;
}

// 5% steps — matches Claude Design `AllocateModal` exactly. Big enough that
// every tap moves the bar visibly, small enough to land on round numbers.
const STEP_PCT = 5;

type RowMeta = {
  key: keyof Allocation;
  label: string;
  sub: string;
  color: string;
};

const ROWS: ReadonlyArray<RowMeta> = [
  { key: "rd",        label: "R&D",       sub: "→ Research Points",  color: colors.sage },
  { key: "product",   label: "Product",   sub: "→ Capital, Users",   color: colors.terracotta },
  { key: "marketing", label: "Marketing", sub: "→ Hype",             color: colors.gold },
  { key: "safety",    label: "Safety",    sub: "→ Pay Down Debt",    color: colors.tensionRed },
];

export function AllocateScreen({ onBack }: Props) {
  const stored = useGame(selectAllocation);
  const setAllocation = useGame((s) => s.setAllocation);

  // Local draft as integer percentages 0..100. Easier to reason about for
  // the proportional rebalance than fractional 0..1. Commit on Save.
  const [draftPct, setDraftPct] = useState<Record<keyof Allocation, number>>({
    rd:        Math.round(stored.rd * 100),
    product:   Math.round(stored.product * 100),
    marketing: Math.round(stored.marketing * 100),
    safety:    Math.round(stored.safety * 100),
  });

  const total =
    draftPct.rd + draftPct.product + draftPct.marketing + draftPct.safety;
  const balanced = total === 100;
  const safetyLow = draftPct.safety < 10;

  // Bump one key by `delta`%, then proportionally take/give the inverse from
  // the other three so the sum stays at 100. Matches design's algorithm.
  function bump(key: keyof Allocation, delta: number) {
    setDraftPct((prev) => {
      const next = Math.max(0, Math.min(100, prev[key] + delta));
      const diff = next - prev[key];
      const others = (Object.keys(prev) as (keyof Allocation)[]).filter((k) => k !== key);
      const otherSum = others.reduce((s, k) => s + prev[k], 0);
      const result = { ...prev, [key]: next };
      if (otherSum > 0) {
        let leftover = -diff;
        others.forEach((k, i) => {
          if (i === others.length - 1) {
            // Soak any rounding error into the last sibling.
            result[k] = Math.max(0, prev[k] + leftover);
          } else {
            const share = Math.round(-diff * (prev[k] / otherSum));
            result[k] = Math.max(0, prev[k] + share);
            leftover -= share;
          }
        });
      }
      return result;
    });
  }

  const reset = () => {
    setDraftPct({
      rd:        Math.round(DEFAULT_ALLOCATION.rd * 100),
      product:   Math.round(DEFAULT_ALLOCATION.product * 100),
      marketing: Math.round(DEFAULT_ALLOCATION.marketing * 100),
      safety:    Math.round(DEFAULT_ALLOCATION.safety * 100),
    });
  };

  const save = () => {
    if (!balanced) return;
    setAllocation({
      rd:        draftPct.rd / 100,
      product:   draftPct.product / 100,
      marketing: draftPct.marketing / 100,
      safety:    draftPct.safety / 100,
    });
    onBack();
  };

  return (
    <View style={styles.shell}>
      <ScreenHeader title="Allocate" sub="Split each token across departments" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Stacked-bar preview — visual mirror of the bottom-of-Home alloc strip */}
        <View style={styles.previewWrap}>
          <View style={styles.previewBar}>
            {ROWS.map((r, i) => (
              <View
                key={r.key}
                style={{
                  flex: Math.max(draftPct[r.key], 0.001),
                  backgroundColor: r.color,
                  borderRightWidth: i < ROWS.length - 1 ? 1 : 0,
                  borderRightColor: "rgba(42,42,42,0.4)",
                }}
              >
                <View style={styles.previewHi} />
              </View>
            ))}
          </View>
        </View>

        {/* 4 stepper rows */}
        <View style={styles.list}>
          {ROWS.map((row) => {
            const v = draftPct[row.key];
            const warn = row.key === "safety" && v < 10;
            return (
              <View
                key={row.key}
                style={[
                  styles.row,
                  {
                    backgroundColor: warn ? "#FCE6E8" : colors.cream_hi,
                    borderColor: warn ? colors.tensionRed : colors.hairline,
                  },
                ]}
              >
                {/* Left: swatch + label + sub */}
                <View style={styles.rowLeft}>
                  <View style={[styles.swatch, { backgroundColor: warn ? colors.tensionRed : row.color }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowLabel, { color: warn ? colors.tensionRed : row.color }]}>
                      {row.label}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>{row.sub}</Text>
                  </View>
                </View>

                {/* Minus stepper */}
                <Pressable
                  onPress={() => bump(row.key, -STEP_PCT)}
                  style={[styles.stepperBtn, { backgroundColor: colors.cream_2 }]}
                  hitSlop={6}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>

                {/* Big % value */}
                <View style={styles.pctWrap}>
                  <Text style={[styles.pct, { color: warn ? colors.tensionRed : row.color }]}>
                    {v}
                    <Text style={styles.pctSign}>%</Text>
                  </Text>
                </View>

                {/* Plus stepper — colored to match the dept */}
                <Pressable
                  onPress={() => bump(row.key, +STEP_PCT)}
                  style={[styles.stepperBtn, { backgroundColor: row.color }]}
                  hitSlop={6}
                >
                  <Text style={[styles.stepperBtnText, { color: colors.cream_hi }]}>+</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Status line: total + warn/ok */}
        <View style={styles.statusRow}>
          <Text style={styles.statusTotal}>TOTAL · {total}%</Text>
          {!balanced && (
            <Text style={[styles.statusWarn, { color: colors.tensionRed }]}>
              ⚠ MUST SUM TO 100%
            </Text>
          )}
          {balanced && safetyLow && (
            <Text style={[styles.statusWarn, { color: colors.tensionRed }]}>
              ⚠ ALIGNMENT DEBT WILL ACCRUE
            </Text>
          )}
          {balanced && !safetyLow && (
            <Text style={[styles.statusWarn, { color: colors.sage_2 }]}>
              ✓ BALANCED
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA row at bottom */}
      <View style={styles.ctaRow}>
        <Pressable onPress={reset} style={[styles.btn, { backgroundColor: colors.cream_2 }]}>
          <Text style={[styles.btnText, { color: colors.ink }]}>RESET</Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={!balanced}
          style={[
            styles.btn,
            styles.btnPrimary,
            { backgroundColor: balanced ? colors.sage : colors.disabled },
          ]}
        >
          <Text style={styles.btnText}>
            {balanced ? "SAVE ALLOCATION" : `OFF BY ${total - 100 > 0 ? "+" : ""}${total - 100}%`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── ScreenHeader (same pattern as ProducersScreen) ──────────────────────
function ScreenHeader({ title, sub, onBack }: { title: string; sub?: string; onBack(): void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
        <Text style={styles.backChevron}>‹</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>
          BURN<Text style={{ color: colors.terracotta }}>·</Text>RATE
        </Text>
        <Text style={styles.title}>{title}</Text>
        {sub && <Text style={styles.sub}>{sub}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.cream },
  header: {
    paddingTop: 14,
    paddingBottom: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.cream_2,
    borderBottomWidth: 1,
    borderBottomColor: colors.cream_4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: { padding: 6 },
  backChevron: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    color: colors.ink,
    lineHeight: 22,
  },
  brand: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 2,
    lineHeight: 18,
  },
  sub: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  scroll: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 100,
  },
  previewWrap: {
    marginHorizontal: 4,
    marginBottom: 10,
  },
  previewBar: {
    flexDirection: "row",
    height: 16,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.cream_2,
    overflow: "hidden",
  },
  previewHi: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  list: {
    gap: 6,
    marginHorizontal: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    width: 110,
    minWidth: 0,
  },
  swatch: {
    width: 10,
    height: 10,
  },
  rowLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    lineHeight: 13,
  },
  rowSub: {
    fontFamily: fonts.displayRegular,
    fontSize: 7,
    color: colors.muted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  stepperBtn: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  stepperBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
    lineHeight: 16,
  },
  pctWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 50,
  },
  pct: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    lineHeight: 22,
  },
  pctSign: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
  },
  statusRow: {
    marginTop: 10,
    marginHorizontal: 4,
    paddingHorizontal: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusTotal: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1,
  },
  statusWarn: {
    fontFamily: fonts.display,
    fontSize: 9,
    letterSpacing: 1,
  },
  ctaRow: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 16,
    flexDirection: "row",
    gap: 8,
  },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 88,
  },
  btnPrimary: {
    flex: 1,
  },
  btnText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.cream_hi,
    letterSpacing: 1,
  },
});
