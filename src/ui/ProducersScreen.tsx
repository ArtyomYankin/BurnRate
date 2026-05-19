import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { D } from "../core/decimal";
import {
  bottleneckChain,
  nextProducerCost,
  upgradeMultiplier,
  upgradeTier,
} from "../core/math";
import { CHAINS, producersForChain } from "../core/producers";
import { ChainId, ProducerDef } from "../core/types";
import { selectCapitalStr, selectProducersOwned, useGame } from "../game/store";
import { FloatUp } from "./FloatUp";
import { formatNumber, formatRate } from "./formatNumber";
import { CHAIN_COLOR, CHAIN_ICON } from "./icons";
import { ParticleBurst } from "./ParticleBurst";
import { Pressy } from "./Pressy";
import { colors, gradient, radii, shadow, spacing, type } from "./theme";

interface Props {
  onBack(): void;
  defaultChain?: ChainId;
}

export function ProducersScreen({ onBack, defaultChain }: Props) {
  const capitalStr = useGame(selectCapitalStr);
  const owned = useGame(selectProducersOwned);
  const buy = useGame((s) => s.buyProducer);
  const capital = D(capitalStr);
  const [activeChain, setActiveChain] = useState<ChainId>(defaultChain ?? "engineers");
  const bottleneck = bottleneckChain({
    fundingRoundIdx: 0,
    tokens: "0",
    capital: capitalStr,
    hype: "0",
    researchPoints: "0",
    allocation: { rd: 0, product: 0, marketing: 0, safety: 0 },
    producersOwned: owned,
    activeEffects: [],
    trainingPity: 0,
  });

  const tiers = producersForChain(activeChain);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>← back</Text>
        </Pressable>
        <Text style={type.caption}>Capital: ${formatNumber(capital)}</Text>
      </View>

      <View style={styles.tabs}>
        {CHAINS.map((c) => {
          const isActive = c.id === activeChain;
          const isLimiting = c.id === bottleneck;
          const Icon = CHAIN_ICON[c.id];
          const tabColor = isActive ? colors.ink : colors.muted;
          return (
            <Pressy
              key={c.id}
              onPress={() => setActiveChain(c.id)}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Icon size={14} color={tabColor} strokeWidth={2.25} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {c.name}
              </Text>
              {isLimiting && <View style={styles.bottleneckDot} />}
            </Pressy>
          );
        })}
      </View>

      <FlatList
        data={tiers}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: spacing.s, paddingBottom: spacing.xxl }}
        renderItem={({ item }) => (
          <ProducerCard
            def={item}
            ownedCount={owned[item.id] ?? 0}
            capital={capital}
            onBuy={() => buy(item.id, 1)}
          />
        )}
      />
    </View>
  );
}

// Indexed by current upgradeTier (0..3). The tier-3 entries are null because
// there's no further upgrade beyond ×64.
const UPGRADE_NEXT_THRESHOLD: readonly (number | null)[] = [10, 50, 100, null];
const UPGRADE_NEXT_LABEL: readonly (string | null)[] = ["×2", "×8", "×64", null];

function ProducerCard({
  def,
  ownedCount,
  capital,
  onBuy,
}: {
  def: ProducerDef;
  ownedCount: number;
  capital: ReturnType<typeof D>;
  onBuy(): void;
}) {
  const cost = nextProducerCost(def, ownedCount);
  const affordable = capital.gte(cost);
  const upMult = upgradeMultiplier(ownedCount);
  const tier = upgradeTier(ownedCount);
  const effectiveRatePerOne = def.baseOutputPerSec * upMult;
  const yourRate = D(effectiveRatePerOne).mul(ownedCount);
  const nextThreshold = UPGRADE_NEXT_THRESHOLD[tier];
  const nextLabel = UPGRADE_NEXT_LABEL[tier];

  // Trigger counters: bump on buy and on upgrade-tier crossing.
  const [buyPop, setBuyPop] = useState(0);
  const [tierPop, setTierPop] = useState(0);
  const lastTier = useRef(tier);
  useEffect(() => {
    if (tier > lastTier.current) setTierPop((n) => n + 1);
    lastTier.current = tier;
  }, [tier]);

  const Icon = CHAIN_ICON[def.chain];
  const chainColor = CHAIN_COLOR[def.chain];

  return (
    <View
      style={[
        styles.card,
        { borderLeftColor: chainColor },
        !affordable && styles.cardDisabled,
      ]}
    >
      <View style={styles.iconBubble}>
        <Icon size={20} color={chainColor} strokeWidth={2.25} />
      </View>
      <View style={styles.cardLeft}>
        <View style={styles.titleRow}>
          <Text style={type.h2}>{def.name}</Text>
          {upMult > 1 && (
            <View style={styles.upgradeBadge}>
              <Text style={styles.upgradeBadgeText}>×{upMult}</Text>
            </View>
          )}
        </View>
        <Text style={type.caption}>
          {formatRate(D(effectiveRatePerOne))} each · owned {ownedCount}
          {ownedCount > 0 ? ` · ${formatRate(yourRate)}` : ""}
        </Text>
        {nextThreshold && nextLabel && (
          <Text style={[type.caption, { color: colors.gold }]}>
            {nextThreshold - ownedCount} more → {nextLabel} unlock
          </Text>
        )}
        {/* The +rate pop floats out of the title area on buy. */}
        <FloatUp trigger={buyPop} label={`+${formatRate(D(effectiveRatePerOne))}`} color={chainColor} />
        <FloatUp trigger={tierPop} label={`${nextLabel ?? "×?"} unlocked!`} color={colors.gold} scatter={false} />
        <ParticleBurst trigger={tierPop} count={18} palette={[colors.gold, "#E8C25F", colors.cream]} />
      </View>
      <Pressy
        style={[styles.buyBtn, !affordable && styles.buyBtnDisabled]}
        onPress={() => {
          if (!affordable) return;
          onBuy();
          setBuyPop((n) => n + 1);
        }}
        disabled={!affordable}
      >
        {affordable && (
          <LinearGradient
            colors={gradient.terracotta}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <Text style={[styles.buyText, !affordable && styles.buyTextDisabled]}>
          ${formatNumber(cost)}
        </Text>
      </Pressy>
    </View>
  );
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
  tabs: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.cardBg,
    padding: spacing.xs,
    borderRadius: radii.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.s,
    alignItems: "center",
    borderRadius: radii.sm,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  tabActive: { backgroundColor: colors.cream },
  tabText: { fontSize: 13, color: colors.muted, fontWeight: "500" },
  tabTextActive: { color: colors.ink, fontWeight: "700" },
  bottleneckDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.tensionRed,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderLeftWidth: 3,
    borderLeftColor: colors.sage,
    borderRadius: radii.md,
    padding: spacing.m,
    gap: spacing.m,
    ...shadow.sm,
  },
  cardDisabled: { opacity: 0.55 },
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
  cardLeft: { flex: 1, gap: spacing.xs },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.s },
  upgradeBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  upgradeBadgeText: { color: colors.ink, fontSize: 11, fontWeight: "700" },
  buyBtn: {
    backgroundColor: colors.terracotta,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderRadius: radii.sm,
    minWidth: 110,
    alignItems: "center",
    overflow: "hidden",
    ...shadow.md,
  },
  buyBtnDisabled: { backgroundColor: colors.disabled },
  buyText: { color: colors.cream, fontWeight: "700", fontSize: 14 },
  buyTextDisabled: { color: colors.muted },
});
