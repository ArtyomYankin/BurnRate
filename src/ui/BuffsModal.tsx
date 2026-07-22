import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ActiveEffectSerialized } from "../core/types";
import { selectActiveEffects, useGame } from "../game/store";
import { colors, fonts, PIXEL } from "./theme";
import { useStrings } from "../core/i18n";

interface Props {
  visible: boolean;
  onClose(): void;
}

/**
 * Active-buffs viewer. Replaces the opaque "N BUFFS" chip on Home with a
 * tappable list: per buff, the human label (where it came from), the effect
 * (e.g. "+10% tokens"), the source category, and the live time remaining.
 *
 * Re-renders once per second (via a local setInterval) so the countdown
 * tickts even when nothing in game state has changed. Cheap — the modal is
 * only mounted while visible.
 */
export function BuffsModal({ visible, onClose }: Props) {
  const t = useStrings();
  const effects = useGame(selectActiveEffects);
  const [now, setNow] = useState(() => Date.now());

  // 1s heartbeat for the countdown labels — only while open.
  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible]);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.frame}>
          {/* Header ribbon */}
          <View style={styles.ribbon}>
            <Text style={styles.ribbonText}>{t.buffs.ribbonTitle}</Text>
          </View>

          {effects.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t.buffs.nothingActive}</Text>
              <Text style={styles.emptyBody}>{t.buffs.emptyBody}</Text>
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listPad}>
              {effects.map((e) => (
                <BuffRow key={e.id} eff={e} now={now} />
              ))}
            </ScrollView>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>{t.buffs.closeBtn}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function BuffRow({ eff, now }: { eff: ActiveEffectSerialized; now: number }) {
  const t = useStrings();
  const { label: effLabel, tint } = formatEffect(eff.effect);
  const remaining = formatRemaining(eff.expiresAt - now);
  return (
    <View style={styles.row}>
      <View style={[styles.rowSwatch, { backgroundColor: tint }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowLabel} numberOfLines={1}>
          {eff.label}
        </Text>
        <View style={styles.rowMetaRow}>
          <Text style={[styles.rowSource, { color: tint }]}>
            {t.buffs.sources[eff.source] ?? eff.source.toUpperCase()}
          </Text>
          <Text style={styles.rowDot}>·</Text>
          <Text style={[styles.rowEffect, { color: tint }]}>{effLabel}</Text>
        </View>
      </View>
      <Text style={styles.rowTime}>{remaining}</Text>
    </View>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<ActiveEffectSerialized["source"], string> = {
  training_run:   "TRAINING RUN",
  slack_dm:       "SLACK DM",
  board_memo:     "BOARD MEMO",
  alignment_debt: "DEBT EVENT",
  companion:      "COMPANION",
};

function formatEffect(eff: ActiveEffectSerialized["effect"]): {
  label: string;
  tint: string;
} {
  const pct = (v: number) => {
    const diff = Math.round((v - 1) * 100);
    return `${diff >= 0 ? "+" : "−"}${Math.abs(diff)}%`;
  };
  switch (eff.type) {
    case "tokens_mult":
      return { label: `${pct(eff.value)} tokens`, tint: colors.sage };
    case "chain_supply_mult":
      return { label: `${pct(eff.value)} ${eff.chain}`, tint: colors.terracotta };
    case "debt_accrual_mult":
      return { label: `${pct(eff.value)} debt accrual`, tint: colors.tensionRed };
    case "capital_mult":
      return { label: `${pct(eff.value)} capital`, tint: colors.gold };
    case "hype_mult":
      return { label: `${pct(eff.value)} hype`, tint: colors.gold_2 };
    case "rp_mult":
      return { label: `${pct(eff.value)} RP`, tint: colors.sage_2 };
  }
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sr = s % 60;
  if (m < 60) return `${m}m ${sr.toString().padStart(2, "0")}s`;
  const h = Math.floor(m / 60);
  const mr = m % 60;
  return `${h}h ${mr.toString().padStart(2, "0")}m`;
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20,18,12,0.85)",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  frame: {
    backgroundColor: colors.cream_hi,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    maxWidth: 380,
    alignSelf: "center",
    width: "100%",
    overflow: "hidden",
  },
  ribbon: {
    backgroundColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ribbonText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.ink_2,
    letterSpacing: 2,
    textAlign: "center",
  },
  empty: {
    paddingHorizontal: 14,
    paddingVertical: 18,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 1.5,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 17,
    textAlign: "center",
  },
  list: {
    maxHeight: 360,
  },
  listPad: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.cream_4,
  },
  rowSwatch: {
    width: 4,
    alignSelf: "stretch",
  },
  rowLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 15,
  },
  rowMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  rowSource: {
    fontFamily: fonts.display,
    fontSize: 8,
    letterSpacing: 1,
  },
  rowDot: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: colors.muted,
  },
  rowEffect: {
    fontFamily: fonts.mono,
    fontSize: 13,
  },
  rowTime: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
    minWidth: 56,
    textAlign: "right",
  },
  closeBtn: {
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream_2,
    borderTopWidth: 1,
    borderTopColor: colors.ink,
  },
  closeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
});
