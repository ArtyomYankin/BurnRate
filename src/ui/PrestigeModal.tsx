import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { D } from "../core/decimal";
import { equityFromPrestige } from "../core/math";
import { getRound, M0_LAST_ROUND_IDX } from "../core/rounds";
import { useGame } from "../game/store";
import { formatNumber } from "./formatNumber";
import { ParticleBurst } from "./ParticleBurst";
import { Pressy } from "./Pressy";
import { colors, gradient, radii, shadow, spacing, type } from "./theme";

interface Props {
  visible: boolean;
  onClose(): void;
}

export function PrestigeModal({ visible, onClose }: Props) {
  const run = useGame((s) => s.run);
  const prestige = useGame((s) => s.prestige);
  const award = equityFromPrestige(run);
  const round = getRound(run.fundingRoundIdx);
  const nextRound = getRound(Math.min(run.fundingRoundIdx + 1, M0_LAST_ROUND_IDX + 1));
  const atM0Cap = run.fundingRoundIdx >= M0_LAST_ROUND_IDX;
  const [burst, setBurst] = useState(0);

  // Reset burst counter when the modal opens so the burst can fire again on
  // subsequent prestiges in the same session.
  useEffect(() => {
    if (visible) setBurst(0);
  }, [visible]);

  const confirm = () => {
    prestige();
    setBurst((n) => n + 1);
    // Let the confetti play before the modal fades. 700ms matches ParticleBurst's
    // default duration.
    setTimeout(onClose, 720);
  };

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={type.h1}>Close {round.name}?</Text>
          <Text style={[type.body, { color: colors.muted }]}>
            You'll reset Tokens, Capital, and producers — but keep Equity.
          </Text>

          <View style={styles.statsBlock}>
            <Stat label="Tokens this round" value={formatNumber(D(run.tokens))} />
            <Stat label="Equity awarded" value={`+ ${formatNumber(award)}`} highlight />
            <Stat
              label="Next round"
              value={atM0Cap ? "(unlocks past Series C in M+2)" : nextRound.name}
            />
          </View>

          <Pressy style={styles.primary} onPress={confirm}>
            <LinearGradient
              colors={gradient.gold}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.primaryText}>Close round</Text>
            <ParticleBurst
              trigger={burst}
              count={28}
              palette={[colors.gold, "#E8C25F", colors.cream, colors.terracotta]}
              spread={120}
              duration={900}
            />
          </Pressy>
          <Pressy style={styles.secondary} onPress={onClose}>
            <Text style={styles.secondaryText}>Keep playing this round</Text>
          </Pressy>
        </View>
      </View>
    </Modal>
  );
}

function Stat({
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
      <Text
        style={[
          type.h2,
          highlight && { color: colors.gold },
        ]}
      >
        {value}
      </Text>
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
  statsBlock: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.md,
    padding: spacing.m,
    gap: spacing.s,
    marginTop: spacing.s,
    ...shadow.sm,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  primary: {
    padding: spacing.l,
    borderRadius: radii.md,
    alignItems: "center",
    marginTop: spacing.s,
    overflow: "hidden",
    ...shadow.md,
  },
  primaryText: { color: colors.ink, fontWeight: "700", fontSize: 15 },
  secondary: { padding: spacing.m, alignItems: "center" },
  secondaryText: { color: colors.muted },
});
