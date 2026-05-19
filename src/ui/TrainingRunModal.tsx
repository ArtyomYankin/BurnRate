import { LinearGradient } from "expo-linear-gradient";
import { Beaker } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { D } from "../core/decimal";
import { roundThreshold } from "../core/math";
import { getRound } from "../core/rounds";
import {
  PITY_THRESHOLD,
  TIER_PROBS,
  trainingRunCost,
  TrainingTier,
} from "../core/trainingRun";
import {
  selectFundingRoundIdx,
  selectTokensStr,
  selectTrainingPity,
  useGame,
} from "../game/store";
import { formatNumber } from "./formatNumber";
import { ParticleBurst } from "./ParticleBurst";
import { Pressy } from "./Pressy";
import { colors, gradient, radii, shadow, spacing, type } from "./theme";

interface Props {
  visible: boolean;
  onClose(): void;
}

const TIER_COLOR: Record<TrainingTier, string> = {
  Failed:       colors.muted,
  Marginal:     colors.sage,
  Solid:        colors.terracotta,
  SOTA:         colors.gold,
  Breakthrough: colors.gold,
};

export function TrainingRunModal({ visible, onClose }: Props) {
  const tokensStr = useGame(selectTokensStr);
  const fundingRoundIdx = useGame(selectFundingRoundIdx);
  const pity = useGame(selectTrainingPity);
  const roll = useGame((s) => s.rollTrainingRun);

  const threshold = roundThreshold(fundingRoundIdx);
  const cost = trainingRunCost(threshold);
  const tokens = D(tokensStr);
  const canRoll = tokens.gte(cost);
  const round = getRound(fundingRoundIdx);

  const [lastResult, setLastResult] = useState<{
    tier: TrainingTier;
    pityFired: boolean;
  } | null>(null);
  const [burst, setBurst] = useState(0);
  // Rolling session history — newest first. Caps at 30 to keep the modal sane.
  // Resets on modal close (state is co-located with the modal instance).
  const [history, setHistory] = useState<TrainingTier[]>([]);

  const onRoll = () => {
    const r = roll();
    if (!r) return;
    setLastResult({ tier: r.tier, pityFired: r.pityFired });
    setHistory((h) => [r.tier, ...h].slice(0, 30));
    if (r.tier === "Breakthrough" || r.tier === "SOTA") {
      setBurst((n) => n + 1);
    }
  };

  // Tally for the running session breakdown.
  const tally: Record<TrainingTier, number> = {
    Failed: 0, Marginal: 0, Solid: 0, SOTA: 0, Breakthrough: 0,
  };
  for (const t of history) tally[t]++;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Beaker size={20} color={colors.terracotta} strokeWidth={2.5} />
            <Text style={type.h1}>Training Run</Text>
          </View>
          <Text style={[type.body, { color: colors.muted }]}>
            Spend tokens to roll a Breakthrough. Pity floor at {PITY_THRESHOLD} —
            guaranteed Breakthrough by the {PITY_THRESHOLD}-th non-Breakthrough roll.
          </Text>

          <View style={styles.statsBlock}>
            <Row label="Cost"      value={`${formatNumber(cost)} tokens (${round.name})`} />
            <Row label="You have" value={`${formatNumber(tokens)} tokens`} />
            <Row label="Pity"     value={`${pity} / ${PITY_THRESHOLD}`} highlight={pity >= 40} />
          </View>

          <View style={styles.probsBlock}>
            <Text style={[type.caption, { marginBottom: spacing.xs }]}>
              Designed roll table (resets on Breakthrough)
            </Text>
            {TIER_PROBS.map((t) => (
              <View key={t.tier} style={styles.probRow}>
                <View style={[styles.tierDot, { backgroundColor: TIER_COLOR[t.tier] }]} />
                <Text style={[type.body, { color: TIER_COLOR[t.tier], flex: 1 }]}>{t.tier}</Text>
                <Text style={type.caption}>{(t.weight * 100).toFixed(0)}%</Text>
              </View>
            ))}
          </View>

          {lastResult && (
            <View style={[styles.result, { borderColor: TIER_COLOR[lastResult.tier] }]}>
              <Text style={[type.h2, { color: TIER_COLOR[lastResult.tier] }]}>
                {lastResult.tier}
                {lastResult.pityFired ? " (pity)" : ""}
              </Text>
              <Text style={type.caption}>
                {lastResult.tier === "Failed"
                  ? "Nothing happens. Try again."
                  : `Temporary +Tokens multiplier is active — see Home.`}
              </Text>
            </View>
          )}

          {history.length > 0 && (
            <View style={styles.historyBlock}>
              <Text style={[type.caption, { color: colors.muted, marginBottom: spacing.xs }]}>
                Session — last {history.length} rolls (incl. Failed)
              </Text>
              <View style={styles.tallyRow}>
                {TIER_PROBS.map((t) => {
                  const n = tally[t.tier];
                  const pct = history.length === 0 ? 0 : (n / history.length) * 100;
                  return (
                    <View key={t.tier} style={styles.tallyCell}>
                      <Text style={[styles.tallyTier, { color: TIER_COLOR[t.tier] }]}>
                        {t.tier[0]}
                      </Text>
                      <Text style={styles.tallyCount}>{n}</Text>
                      <Text style={styles.tallyPct}>{pct.toFixed(0)}%</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.historyTrack}>
                {history.slice(0, 30).map((t, i) => (
                  <View
                    key={i}
                    style={[styles.historyDot, { backgroundColor: TIER_COLOR[t] }]}
                  />
                ))}
              </View>
            </View>
          )}

          <Pressy
            style={[styles.primary, !canRoll && styles.primaryDisabled]}
            onPress={onRoll}
            disabled={!canRoll}
          >
            {canRoll && (
              <LinearGradient
                colors={gradient.terracotta}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Text style={styles.primaryText}>
              {canRoll ? `Roll — ${formatNumber(cost)} tokens` : "Not enough tokens"}
            </Text>
            <ParticleBurst
              trigger={burst}
              count={20}
              palette={[colors.gold, colors.cream, colors.terracotta]}
              spread={100}
              duration={800}
            />
          </Pressy>
          <Pressable style={styles.secondary} onPress={onClose}>
            <Text style={styles.secondaryText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.statRow}>
      <Text style={type.caption}>{label}</Text>
      <Text style={[type.h2, highlight && { color: colors.gold }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(42,42,42,0.5)",
    justifyContent: "center",
    paddingHorizontal: spacing.l,
  },
  sheet: {
    backgroundColor: colors.cream,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.m,
    ...shadow.lg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  statsBlock: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.md,
    padding: spacing.m,
    gap: spacing.s,
    ...shadow.sm,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  probsBlock: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.md,
    padding: spacing.m,
    gap: 4,
    ...shadow.sm,
  },
  probRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  tierDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  result: {
    backgroundColor: colors.cardBg,
    borderWidth: 2,
    borderRadius: radii.md,
    padding: spacing.m,
    gap: spacing.xs,
    ...shadow.sm,
  },
  historyBlock: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.md,
    padding: spacing.m,
    gap: spacing.s,
    ...shadow.sm,
  },
  tallyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.s,
  },
  tallyCell: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  tallyTier: { fontSize: 14, fontWeight: "700" },
  tallyCount: { fontSize: 13, fontWeight: "700", color: colors.ink },
  tallyPct: { fontSize: 10, color: colors.muted, fontFamily: "Courier" },
  historyTrack: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  primary: {
    padding: spacing.l,
    borderRadius: radii.md,
    alignItems: "center",
    marginTop: spacing.s,
    overflow: "hidden",
    backgroundColor: colors.terracotta,
    ...shadow.md,
  },
  primaryDisabled: { backgroundColor: colors.disabled },
  primaryText: { color: colors.cream, fontWeight: "700", fontSize: 15 },
  secondary: { padding: spacing.m, alignItems: "center" },
  secondaryText: { color: colors.muted },
});
