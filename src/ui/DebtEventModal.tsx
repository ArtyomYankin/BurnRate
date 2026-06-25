import { LinearGradient } from "expo-linear-gradient";
import { AlertOctagon } from "lucide-react-native";
import React from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { getDebtEvent } from "../core/debtEvents";
import {
  selectPendingDebtEvents,
  useGame,
} from "../game/store";
import { Pressy } from "./Pressy";
import { colors, gradient, radii, shadow, spacing, type } from "./theme";
import { useStrings } from "../core/i18n";

/**
 * Sits at the App root. Self-shows when pendingDebtEvents queue is non-empty.
 * Drains one head-of-queue at a time so each event lands as a discrete moment.
 */
export function DebtEventModal() {
  const t = useStrings();
  const queue = useGame(selectPendingDebtEvents);
  const ack = useGame((s) => s.acknowledgeDebtEvent);
  const head = queue[0];
  if (head === undefined) return null;

  const ev = getDebtEvent(head);
  if (!ev) {
    // Defensive: queue had an unknown threshold. Drain it so we don't lock the
    // UI forever.
    ack();
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible onRequestClose={ack}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <LinearGradient
            colors={gradient.tensionRed}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerGradient}
          >
            <AlertOctagon size={20} color={colors.cream} strokeWidth={2.5} />
            <Text style={styles.headerText}>{ev.title}</Text>
            <Text style={styles.thresholdTag}>{t.debtEvent.debtPrefix} ≥ {ev.threshold}</Text>
          </LinearGradient>

          <Text style={styles.body}>{ev.body}</Text>

          <View style={styles.effectBlock}>
            <Text style={[type.caption, { color: colors.muted, marginBottom: 4 }]}>
              {t.debtEvent.consequence}
            </Text>
            <Text style={[type.h2, { color: colors.tensionRed }]}>{ev.effectLabel}</Text>
            <Text style={[type.caption, { color: colors.muted, marginTop: 4 }]}>
              {formatDuration(ev.durationMs)}
            </Text>
          </View>

          <Pressy style={styles.primary} onPress={ack}>
            <LinearGradient
              colors={gradient.terracotta}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.primaryText}>{t.debtEvent.closeBtn}</Text>
          </Pressy>
        </View>
      </View>
    </Modal>
  );
}

function formatDuration(ms: number): string {
  const h = Math.round(ms / 3600 / 1000);
  return `for ${h} hour${h === 1 ? "" : "s"}`;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(42,42,42,0.7)",
    justifyContent: "center",
    paddingHorizontal: spacing.l,
  },
  sheet: {
    backgroundColor: colors.cream,
    borderRadius: radii.lg,
    overflow: "hidden",
    ...shadow.lg,
  },
  headerGradient: {
    padding: spacing.l,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  headerText: {
    color: colors.cream,
    fontSize: 20,
    fontWeight: "700",
    flex: 1,
  },
  thresholdTag: {
    color: colors.cream,
    fontSize: 11,
    fontWeight: "600",
    opacity: 0.8,
    fontFamily: "Courier",
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
  },
  effectBlock: {
    margin: spacing.l,
    padding: spacing.m,
    backgroundColor: colors.cardBg,
    borderRadius: radii.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.tensionRed,
  },
  primary: {
    marginHorizontal: spacing.l,
    marginBottom: spacing.l,
    padding: spacing.l,
    borderRadius: radii.md,
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: colors.terracotta,
    ...shadow.md,
  },
  primaryText: { color: colors.cream, fontWeight: "700", fontSize: 15 },
});
