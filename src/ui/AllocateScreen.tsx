import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Allocation } from "../core/types";
import { selectAllocation, useGame } from "../game/store";
import { PanelHelpModal, PanelHint, PanelInfoButton } from "./PanelHelp";
import { useStrings } from "../core/i18n";
import { colors, fonts, PIXEL } from "./theme";

interface Props {
  onBack(): void;
}

// 5% steps — matches Claude Design `AllocateModal` exactly. Big enough that
// every tap moves the bar visibly, small enough to land on round numbers.
const STEP_PCT = 5;

type RowMeta = {
  key: keyof Allocation;
  color: string;
};

// Row colors only — label/sub localized via t.allocate.departments[key].
const ROWS: ReadonlyArray<RowMeta> = [
  { key: "rd",        color: colors.sage       },
  { key: "product",   color: colors.terracotta },
  { key: "marketing", color: colors.gold       },
  { key: "safety",    color: colors.tensionRed },
];

export function AllocateScreen({ onBack }: Props) {
  const [infoOpen, setInfoOpen] = useState(false);
  const t = useStrings();
  const stored = useGame(selectAllocation);
  const setAllocation = useGame((s) => s.setAllocation);

  // Snapshot of the allocation at mount — frozen so RESET returns the
  // player to what they saw when they OPENED the screen, not to some global
  // default. useMemo with no deps captures once; the `stored` reference
  // updates if another screen modifies allocation, but we deliberately keep
  // this stale to preserve the snapshot semantics.
  const initialPct = useMemo<Record<keyof Allocation, number>>(() => ({
    rd:        Math.round(stored.rd * 100),
    product:   Math.round(stored.product * 100),
    marketing: Math.round(stored.marketing * 100),
    safety:    Math.round(stored.safety * 100),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  // Local draft as integer percentages 0..100. Player edits freely; the
  // free pool (100 - sum) accumulates as they decrease slots, and they
  // spend it back by tapping +. SAVE is gated on pool === 0.
  const [draftPct, setDraftPct] = useState<Record<keyof Allocation, number>>(initialPct);

  const total =
    draftPct.rd + draftPct.product + draftPct.marketing + draftPct.safety;
  const pool = 100 - total;          // free points available to assign
  const balanced = pool === 0;
  const safetyLow = draftPct.safety < 10;

  // Plus/minus no longer auto-redistributes — minus releases STEP_PCT into
  // the pool, plus consumes STEP_PCT from the pool. Reject the bump if the
  // operation would over/underflow the [0..100] range OR drive pool < 0
  // (i.e. plus when there's nothing to spend).
  function bump(key: keyof Allocation, delta: number) {
    setDraftPct((prev) => {
      const next = prev[key] + delta;
      if (next < 0 || next > 100) return prev;
      // delta > 0 (plus) needs pool >= delta. delta < 0 (minus) always frees
      // points, but we still cap at 0 above.
      const prevPool = 100 - (prev.rd + prev.product + prev.marketing + prev.safety);
      if (delta > 0 && prevPool < delta) return prev;
      return { ...prev, [key]: next };
    });
  }

  const reset = () => {
    setDraftPct(initialPct);
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
      <ScreenHeader
        title={t.allocate.title}
        sub={t.allocate.sub}
        onBack={onBack}
        right={<PanelInfoButton onPress={() => setInfoOpen(true)} />}
      />

      <PanelHint panelKey="allocate" text={t.allocate.hint} />

      <PanelHelpModal
        visible={infoOpen}
        title={t.allocate.title}
        sections={t.allocate.help}
        onClose={() => setInfoOpen(false)}
      />

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
                      {t.allocate.departments[row.key].label}
                    </Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {t.allocate.departments[row.key].sub}
                    </Text>
                  </View>
                </View>

                {/* Minus stepper — disabled when slot is at zero. */}
                <Pressable
                  onPress={() => bump(row.key, -STEP_PCT)}
                  disabled={v < STEP_PCT}
                  style={[
                    styles.stepperBtn,
                    { backgroundColor: v < STEP_PCT ? colors.disabled : colors.cream_2 },
                  ]}
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

                {/* Plus stepper — colored to match the dept; greyed out
                    when there's nothing left in the pool to spend. */}
                <Pressable
                  onPress={() => bump(row.key, +STEP_PCT)}
                  disabled={pool < STEP_PCT}
                  style={[
                    styles.stepperBtn,
                    { backgroundColor: pool < STEP_PCT ? colors.disabled : row.color },
                  ]}
                  hitSlop={6}
                >
                  <Text style={[styles.stepperBtnText, { color: colors.cream_hi }]}>+</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* Status line: free pool + balance hint. Pool drives both the "to
            assign" indicator AND whether SAVE is enabled. */}
        <View style={styles.statusRow}>
          <Text
            style={[
              styles.statusTotal,
              pool > 0 && { color: colors.gold_2, fontFamily: fonts.bodyBold, fontSize: 12, letterSpacing: 0.5 },
            ]}
          >
            {pool > 0 ? `${t.allocate.pool}: ${pool}%` : `${t.allocate.barTitle} · ${total}%`}
          </Text>
          {pool > 0 && (
            <Text style={[styles.statusWarn, { color: colors.gold_2 }]}>
              {t.allocate.toAssign}
            </Text>
          )}
          {balanced && safetyLow && (
            <Text style={[styles.statusWarn, { color: colors.tensionRed }]}>
              {t.allocate.debtWarn}
            </Text>
          )}
          {balanced && !safetyLow && (
            <Text style={[styles.statusWarn, { color: colors.sage_2 }]}>
              {t.allocate.balanced}
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Sticky CTA row at bottom */}
      <View style={styles.ctaRow}>
        <Pressable onPress={reset} style={[styles.btn, { backgroundColor: colors.cream_2 }]}>
          <Text style={[styles.btnText, { color: colors.ink }]}>{t.common.reset.toUpperCase()}</Text>
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
            {balanced ? t.allocate.saveBalanced : `${t.allocate.assignSuffix} ${pool}%`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── ScreenHeader (same pattern as ProducersScreen) ──────────────────────
function ScreenHeader({
  title, sub, onBack, right,
}: {
  title: string;
  sub?: string;
  onBack(): void;
  right?: React.ReactNode;
}) {
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
      {right}
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
    fontFamily: fonts.mono,
    fontSize: 26,
    lineHeight: 26,
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
