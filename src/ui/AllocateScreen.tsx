import { LinearGradient } from "expo-linear-gradient";
import { Banknote, Beaker, Megaphone, Shield } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { DEFAULT_ALLOCATION } from "../core/math";
import { Allocation } from "../core/types";
import { selectAllocation, useGame } from "../game/store";
import { Pressy } from "./Pressy";
import { colors, gradient, radii, shadow, spacing, type } from "./theme";

type DeptIcon = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
const ICONS: Record<keyof Allocation, DeptIcon> = {
  rd: Beaker,
  product: Banknote,
  marketing: Megaphone,
  safety: Shield,
};
const COLORS: Record<keyof Allocation, string> = {
  rd: colors.sage,
  product: colors.terracotta,
  marketing: colors.gold,
  safety: colors.tensionRed,
};

interface Props {
  onBack(): void;
}

// GDD §4 Beat 2: budget sliders for the four departments. Each row is a
// stepper (-/+) because true sliders on web+RN are fiddly and the integer-%
// experience is fine for an idle game.
const STEP = 0.05;
const KEYS: (keyof Allocation)[] = ["rd", "product", "marketing", "safety"];
const LABELS: Record<keyof Allocation, string> = {
  rd: "R&D",
  product: "Product",
  marketing: "Marketing",
  safety: "Safety",
};
const HELP: Record<keyof Allocation, string> = {
  rd: "Research Points → permanent multipliers (research tree).",
  product: "Capital → buy producers, fund the buildout.",
  marketing: "Hype → eases funding-round closure.",
  safety: "Pays down Alignment Debt (≥10% to avoid accrual).",
};

export function AllocateScreen({ onBack }: Props) {
  const stored = useGame(selectAllocation);
  const setAllocation = useGame((s) => s.setAllocation);

  // Edit a local draft so the sliders don't fight each other tick-by-tick;
  // commit on "Apply".
  const [draft, setDraft] = useState<Allocation>(stored);

  const adjust = (key: keyof Allocation, delta: number) => {
    setDraft((d) => {
      const next = clamp01(d[key] + delta);
      const otherKeys = KEYS.filter((k) => k !== key);
      // Redistribute the inverse delta across the other three proportionally
      // to preserve sum=1. If others are all zero, split evenly.
      const otherSum = otherKeys.reduce((acc, k) => acc + d[k], 0);
      const inv = next - d[key]; // signed change we just applied to `key`
      const out: Allocation = { ...d, [key]: next } as Allocation;
      if (otherSum === 0) {
        // even split if siblings have no room
        for (const k of otherKeys) out[k] = clamp01((1 - next) / otherKeys.length);
      } else {
        for (const k of otherKeys) {
          const share = d[k] / otherSum;
          out[k] = clamp01(d[k] - inv * share);
        }
      }
      return normalizeLocal(out);
    });
  };

  const reset = () => setDraft(DEFAULT_ALLOCATION);
  const apply = () => {
    setAllocation(draft);
    onBack();
  };
  const dirty =
    Math.abs(draft.rd - stored.rd) +
      Math.abs(draft.product - stored.product) +
      Math.abs(draft.marketing - stored.marketing) +
      Math.abs(draft.safety - stored.safety) >
    1e-9;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>← back</Text>
        </Pressable>
        <Text style={type.caption}>Token budget</Text>
      </View>

      <Text style={type.body}>
        Each tick your incoming tokens get split across these four departments.
      </Text>

      <View style={styles.list}>
        {KEYS.map((k) => (
          <Row
            key={k}
            icon={ICONS[k]}
            iconColor={COLORS[k]}
            label={LABELS[k]}
            help={HELP[k]}
            value={draft[k]}
            onDec={() => adjust(k, -STEP)}
            onInc={() => adjust(k, +STEP)}
            warnFloor={k === "safety" && draft.safety < 0.10}
          />
        ))}
      </View>

      <View style={styles.sumRow}>
        <Text style={type.caption}>Total</Text>
        <Text style={type.h2}>
          {Math.round((draft.rd + draft.product + draft.marketing + draft.safety) * 100)}%
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressy style={styles.secondary} onPress={reset}>
          <Text style={styles.secondaryText}>Reset to default</Text>
        </Pressy>
        <Pressy
          style={[styles.primary, !dirty && styles.primaryDisabled]}
          onPress={apply}
          disabled={!dirty}
        >
          {dirty && (
            <LinearGradient
              colors={gradient.terracotta}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <Text style={styles.primaryText}>{dirty ? "Apply" : "Already applied"}</Text>
        </Pressy>
      </View>
    </View>
  );
}

function Row({
  icon: Icon,
  iconColor,
  label,
  help,
  value,
  onDec,
  onInc,
  warnFloor,
}: {
  icon: DeptIcon;
  iconColor: string;
  label: string;
  help: string;
  value: number;
  onDec(): void;
  onInc(): void;
  warnFloor?: boolean;
}) {
  const tint = warnFloor ? colors.tensionRed : iconColor;
  return (
    <View style={[styles.row, warnFloor && { borderColor: colors.tensionRed }]}>
      <View style={styles.iconBubble}>
        <Icon size={20} color={tint} strokeWidth={2.25} />
      </View>
      <View style={styles.rowText}>
        <Text style={[type.h2, { color: tint }]}>{label}</Text>
        <Text style={type.caption}>{help}</Text>
        {warnFloor && (
          <Text style={[type.caption, { color: colors.tensionRed }]}>
            Below 10% — Alignment Debt is accruing.
          </Text>
        )}
      </View>
      <View style={styles.stepperRow}>
        <Pressy style={styles.stepBtn} onPress={onDec}>
          <Text style={styles.stepText}>−</Text>
        </Pressy>
        <Text style={styles.pct}>{Math.round(value * 100)}%</Text>
        <Pressy style={styles.stepBtn} onPress={onInc}>
          <Text style={styles.stepText}>+</Text>
        </Pressy>
      </View>
    </View>
  );
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** Renormalize a near-1 allocation back to exact 1 to avoid float drift. */
function normalizeLocal(a: Allocation): Allocation {
  const s = a.rd + a.product + a.marketing + a.safety;
  if (s <= 0) return DEFAULT_ALLOCATION;
  return {
    rd: a.rd / s,
    product: a.product / s,
    marketing: a.marketing / s,
    safety: a.safety / s,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.xl,
    gap: spacing.m,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  back: { color: colors.terracotta, fontSize: 14, fontWeight: "600" },
  list: { gap: spacing.s, marginTop: spacing.s },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radii.md,
    padding: spacing.m,
    gap: spacing.m,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadow.sm,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  rowText: { flex: 1, gap: spacing.xs },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: spacing.s },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: { color: colors.cream, fontSize: 18, fontWeight: "700" },
  pct: {
    minWidth: 44,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: colors.ink,
  },
  sumRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.s,
  },
  actions: { flexDirection: "row", gap: spacing.m, marginTop: spacing.s },
  primary: {
    flex: 1,
    backgroundColor: colors.terracotta,
    padding: spacing.l,
    borderRadius: radii.md,
    alignItems: "center",
    overflow: "hidden",
    ...shadow.md,
  },
  primaryDisabled: { backgroundColor: colors.disabled },
  primaryText: { color: colors.cream, fontWeight: "700" },
  secondary: {
    flex: 1,
    padding: spacing.l,
    borderRadius: radii.md,
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  secondaryText: { color: colors.ink, fontWeight: "600" },
});
