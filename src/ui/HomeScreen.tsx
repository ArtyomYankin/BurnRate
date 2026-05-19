import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { D, Decimal } from "../core/decimal";
import { CHAINS } from "../core/producers";
import { getRound } from "../core/rounds";
import { ChainId } from "../core/types";
import { engineerMultiplier } from "../core/math";
import {
  allChainSupplies,
  bottleneckChain,
  selectActiveEffects,
  selectAlignmentDebtStr,
  selectAllocation,
  selectCanPrestige,
  selectCapitalStr,
  selectEquityStr,
  selectFundingRoundIdx,
  selectHypeStr,
  selectProducersOwned,
  selectResearchPointsStr,
  selectTokensStr,
  tokensPerSec,
  useGame,
} from "../game/store";
import { formatNumber, formatRate, formatSupply } from "./formatNumber";
import { CHAIN_COLOR, CHAIN_ICON, ICON } from "./icons";
import { Pressy } from "./Pressy";
import { colors, gradient, radii, shadow, spacing, type } from "./theme";

interface Props {
  onOpenProducers(chain?: ChainId): void;
  onOpenAllocate(): void;
  onOpenResearch(): void;
  onOpenTraining(): void;
  onOpenPrestige(): void;
}

export function HomeScreen({
  onOpenProducers,
  onOpenAllocate,
  onOpenResearch,
  onOpenTraining,
  onOpenPrestige,
}: Props) {
  const tokensStr = useGame(selectTokensStr);
  const capitalStr = useGame(selectCapitalStr);
  const hypeStr = useGame(selectHypeStr);
  const rpStr = useGame(selectResearchPointsStr);
  const equityStr = useGame(selectEquityStr);
  const debtStr = useGame(selectAlignmentDebtStr);
  const allocation = useGame(selectAllocation);
  const owned = useGame(selectProducersOwned);
  const activeEffects = useGame(selectActiveEffects);
  const fundingRoundIdx = useGame(selectFundingRoundIdx);
  const canPrestige = useGame(selectCanPrestige);

  const tokens = D(tokensStr);
  const capital = D(capitalStr);
  const hype = D(hypeStr);
  const rp = D(rpStr);
  const equity = D(equityStr);
  const debt = D(debtStr);
  // The rate-shaped calculators only inspect producersOwned + engineers/
  // gpu/data/energy chains, so we don't need real values for allocation/hype/
  // etc. — but the type contract requires them. Cheap to fill in.
  const runForCalc = {
    fundingRoundIdx,
    tokens: tokensStr,
    capital: capitalStr,
    hype: "0",
    researchPoints: "0",
    allocation: { rd: 0, product: 0, marketing: 0, safety: 0 },
    producersOwned: owned,
    activeEffects: [],
    trainingPity: 0,
  };
  const tps = tokensPerSec(runForCalc);
  const supplies = allChainSupplies(runForCalc);
  const bottleneck = bottleneckChain(runForCalc);

  const round = getRound(fundingRoundIdx);
  const threshold = D(10).pow(round.tokenThresholdLog10);
  const pct = Math.min(100, tokens.div(threshold).toNumber() * 100);

  const TokensIcon = ICON.tokens;
  const CapitalIcon = ICON.capital;
  const HypeIcon = ICON.hype;
  const ResearchIcon = ICON.research;
  const EquityIcon = ICON.equity;
  const ShieldIcon = ICON.shield;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={type.caption}>BURN RATE</Text>
        <Text style={type.caption}>
          {round.name} · round {round.idx + 1}
        </Text>
      </View>

      <View style={styles.heroBlock}>
        <LinearGradient
          colors={gradient.hero}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroIconRow}>
          <TokensIcon size={18} color={colors.gold} strokeWidth={2.5} />
          <Text style={[type.caption, { color: colors.muted }]}>tokens</Text>
        </View>
        <Text style={styles.tokenNumber}>{formatNumber(tokens)}</Text>
        <Text style={[type.caption, { marginTop: spacing.xs }]}>
          + {formatRate(tps)}
        </Text>
        <Text style={[type.caption, { marginTop: 2, fontSize: 11 }]}>
          min({formatSupply(supplies.gpu)}, {formatSupply(supplies.data)}, {formatSupply(supplies.energy)}) × {formatSupply(engineerMultiplier(supplies.engineers))} (Eng)
        </Text>
      </View>

      <View style={styles.progressBlock}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={type.caption}>
          {round.name} · next funding round at 1e{round.tokenThresholdLog10} tokens
        </Text>
      </View>

      <View style={styles.suppliesBlock}>
        {CHAINS.map((c) => (
          <ChainRow
            key={c.id}
            chain={c.id}
            label={c.name}
            supply={supplies[c.id]}
            ownedTotal={totalOwnedInChain(c.id, owned)}
            isBottleneck={c.id === bottleneck}
            allSupplies={supplies}
          />
        ))}
      </View>

      <Pressy style={styles.allocCard} onPress={onOpenAllocate}>
        <View style={styles.allocHeader}>
          <Text style={type.caption}>Allocation</Text>
          <Text style={[type.caption, { color: colors.terracotta }]}>edit →</Text>
        </View>
        <View style={styles.allocRow}>
          <AllocPill icon={ResearchIcon}  iconColor={colors.sage}        label="R&D"       pct={allocation.rd}        value={formatNumber(rp)} />
          <AllocPill icon={CapitalIcon}   iconColor={colors.terracotta}  label="Product"   pct={allocation.product}   value={formatNumber(capital)} />
          <AllocPill icon={HypeIcon}      iconColor={colors.gold}        label="Marketing" pct={allocation.marketing} value={formatNumber(hype)} />
          <AllocPill
            icon={ShieldIcon}
            iconColor={colors.tensionRed}
            label="Safety"
            pct={allocation.safety}
            value={debt.gt(0) ? `debt ${formatNumber(debt)}` : "ok"}
            warn={allocation.safety < 0.10}
          />
        </View>
      </Pressy>

      {debt.gt(0) && (
        <View style={styles.debtStrip}>
          <Text style={styles.debtLabel}>Alignment Debt</Text>
          <Text style={styles.debtValue}>{formatNumber(debt)}</Text>
        </View>
      )}

      {activeEffects.length > 0 && <ActiveEffectsStrip />}

      <View style={styles.statsRow}>
        <Stat icon={CapitalIcon} iconColor={colors.terracotta} label="Capital ($)" value={formatNumber(capital)} />
        <Stat icon={EquityIcon}  iconColor={colors.gold}       label="Equity"      value={formatNumber(equity)} />
      </View>

      <Pressy
        style={styles.cta}
        onPress={canPrestige ? onOpenPrestige : () => onOpenProducers()}
      >
        <LinearGradient
          colors={canPrestige ? gradient.gold : gradient.terracotta}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={[styles.ctaText, canPrestige && { color: colors.ink }]}>
          {canPrestige ? "Close funding round →" : "Hire / build →"}
        </Text>
      </Pressy>

      <View style={styles.secondaryRow}>
        <Pressy style={styles.secondaryBtn} onPress={() => onOpenProducers()}>
          <Text style={styles.secondaryBtnText}>Producers</Text>
        </Pressy>
        <Pressy style={styles.secondaryBtn} onPress={onOpenResearch}>
          <Text style={styles.secondaryBtnText}>
            Research{equity.gt(0) ? `  ·  ${formatNumber(equity)} Eq` : ""}
          </Text>
        </Pressy>
        <Pressy style={styles.secondaryBtn} onPress={onOpenTraining}>
          <Text style={styles.secondaryBtnText}>Training</Text>
        </Pressy>
      </View>
    </View>
  );
}

type EffectKey = "tokens" | "capital" | "hype" | "rp" | "debt" | "supply_gpu" | "supply_data" | "supply_energy" | "supply_eng";

const EFFECT_KEY_LABEL: Record<EffectKey, string> = {
  tokens:        "Tokens",
  capital:       "Capital",
  hype:          "Hype",
  rp:            "Research Pts",
  debt:          "Debt accrual",
  supply_gpu:    "GPU supply",
  supply_data:   "Data supply",
  supply_energy: "Energy supply",
  supply_eng:    "Eng supply",
};

function effectKey(e: ReturnType<typeof selectActiveEffects>[number]): EffectKey {
  switch (e.effect.type) {
    case "tokens_mult":       return "tokens";
    case "capital_mult":      return "capital";
    case "hype_mult":         return "hype";
    case "rp_mult":           return "rp";
    case "debt_accrual_mult": return "debt";
    case "chain_supply_mult":
      switch (e.effect.chain) {
        case "engineers": return "supply_eng";
        case "gpu":       return "supply_gpu";
        case "data":      return "supply_data";
        case "energy":    return "supply_energy";
      }
  }
}

function ActiveEffectsStrip() {
  // Re-render once a second to keep the countdown alive. Cheap — strip is
  // rarely visible (only when something is active).
  const [, force] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const effects = useGame(selectActiveEffects);
  const now = Date.now();
  const live = effects.filter((e) => e.expiresAt > now);
  if (live.length === 0) return null;

  // Group by effect category and combine multiplicatively (matches the math
  // layer's aggregator). One chip per category instead of one per effect —
  // 30 individual "+5% Tokens" chips were unreadable.
  const groups = new Map<EffectKey, { mult: number; count: number; minExpiresAt: number }>();
  for (const e of live) {
    const k = effectKey(e);
    const g = groups.get(k) ?? { mult: 1, count: 0, minExpiresAt: Infinity };
    g.mult *= e.effect.value;
    g.count += 1;
    g.minExpiresAt = Math.min(g.minExpiresAt, e.expiresAt);
    groups.set(k, g);
  }

  return (
    <View style={styles.effectsStrip}>
      {[...groups.entries()].map(([key, g]) => {
        const remainingSec = Math.max(0, Math.round((g.minExpiresAt - now) / 1000));
        const min = Math.floor(remainingSec / 60);
        const sec = remainingSec % 60;
        const pct = Math.round((g.mult - 1) * 100);
        const isPositive = g.mult >= 1;
        const sign = pct >= 0 ? "+" : "";
        return (
          <View key={key} style={styles.effectChip}>
            <Text style={styles.effectChipText}>
              {EFFECT_KEY_LABEL[key]}{" "}
              <Text style={{ color: isPositive ? colors.sage : colors.tensionRed }}>
                {sign}{pct}%
              </Text>
              {g.count > 1 ? ` · ${g.count} buffs` : ""}
            </Text>
            <Text style={styles.effectChipTime}>
              next: {min}:{sec.toString().padStart(2, "0")}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ChainRow({
  chain,
  label,
  supply,
  ownedTotal,
  isBottleneck,
  allSupplies,
}: {
  chain: ChainId;
  label: string;
  supply: Decimal;
  ownedTotal: number;
  isBottleneck: boolean;
  allSupplies: ReturnType<typeof allChainSupplies>;
}) {
  const maxSupply = Decimal.max(
    allSupplies.engineers,
    Decimal.max(allSupplies.gpu, Decimal.max(allSupplies.data, allSupplies.energy))
  );
  const widthPct = maxSupply.lte(0)
    ? 0
    : Math.min(100, supply.div(maxSupply).toNumber() * 100);
  const Icon = CHAIN_ICON[chain];
  const chainColor = isBottleneck ? colors.tensionRed : CHAIN_COLOR[chain];

  return (
    <View style={styles.chainRow}>
      <View style={styles.chainRowLeft}>
        <Icon size={16} color={chainColor} strokeWidth={2.25} />
        <View style={styles.miniBarTrack}>
          <View
            style={[
              styles.miniBarFill,
              { width: `${widthPct}%`, backgroundColor: chainColor },
            ]}
          />
        </View>
        <Text style={[type.body, { fontWeight: "600", color: chainColor }]}>
          {label}
        </Text>
      </View>
      <Text style={type.caption}>
        {ownedTotal} · {formatRate(supply)}
      </Text>
    </View>
  );
}

function totalOwnedInChain(
  chainId: ChainId,
  owned: Record<string, number>
): number {
  const chain = CHAINS.find((c) => c.id === chainId);
  if (!chain) return 0;
  return chain.producers.reduce((acc, p) => acc + (owned[p.id] ?? 0), 0);
}

function AllocPill({
  icon: Icon,
  iconColor,
  label,
  pct,
  value,
  warn,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  iconColor: string;
  label: string;
  pct: number;
  value: string;
  warn?: boolean;
}) {
  const tint = warn ? colors.tensionRed : iconColor;
  return (
    <View style={[styles.pill, warn && styles.pillWarn]}>
      <View style={styles.pillTop}>
        <Icon size={14} color={tint} strokeWidth={2.25} />
        <Text style={[type.caption, { color: tint, fontWeight: "600" }]}>
          {Math.round(pct * 100)}%
        </Text>
      </View>
      <Text style={[type.caption, { fontSize: 10 }]}>{label}</Text>
      <Text style={[styles.pillValue, warn && { color: colors.tensionRed }]}>
        {value}
      </Text>
    </View>
  );
}

function Stat({
  icon: Icon,
  iconColor,
  label,
  value,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  iconColor: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statHeader}>
        <Icon size={14} color={iconColor} strokeWidth={2.25} />
        <Text style={type.caption}>{label}</Text>
      </View>
      <Text style={type.h2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.xl,
    gap: spacing.l,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroBlock: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    position: "relative",
    borderRadius: radii.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadow.md,
  },
  heroIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.xs,
  },
  tokenNumber: {
    ...type.display,
    fontSize: 56,
    color: colors.ink,
  },
  progressBlock: { gap: spacing.s },
  progressTrack: {
    height: 12,
    backgroundColor: colors.hairline,
    borderRadius: radii.sm,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.sage },
  suppliesBlock: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.md,
    padding: spacing.m,
    gap: spacing.s,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadow.sm,
  },
  chainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.m,
  },
  chainRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  miniBarTrack: {
    width: 80,
    height: 6,
    backgroundColor: colors.hairline,
    borderRadius: 3,
    overflow: "hidden",
  },
  miniBarFill: { height: "100%", backgroundColor: colors.sage },
  miniBarFillBottleneck: { backgroundColor: colors.tensionRed },
  allocCard: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.md,
    padding: spacing.m,
    gap: spacing.s,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadow.md,
  },
  allocHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  allocRow: { flexDirection: "row", gap: spacing.xs },
  pill: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: 6,
    borderRadius: radii.sm,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 2,
    minWidth: 0,
  },
  pillWarn: { borderColor: colors.tensionRed },
  pillTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    marginBottom: 2,
  },
  pillValue: { fontSize: 12, color: colors.ink, fontWeight: "600" },
  debtStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.tensionRed,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radii.md,
  },
  debtLabel: { color: colors.cream, fontSize: 13, fontWeight: "600" },
  debtValue: { color: colors.cream, fontSize: 16, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: spacing.l },
  stat: {
    flex: 1,
    backgroundColor: colors.cardBg,
    padding: spacing.m,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: 4,
    ...shadow.sm,
  },
  statHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cta: {
    padding: spacing.l,
    borderRadius: radii.md,
    alignItems: "center",
    marginTop: spacing.s,
    overflow: "hidden",
    ...shadow.lg,
  },
  ctaText: { color: colors.cream, fontSize: 16, fontWeight: "700" },
  effectsStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    backgroundColor: colors.cardBg,
    padding: spacing.s,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.gold,
    ...shadow.sm,
  },
  effectChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.s,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  effectChipText: { fontSize: 12, color: colors.ink, fontWeight: "600" },
  effectChipTime: { fontSize: 11, color: colors.muted, fontFamily: "Courier" },
  secondaryRow: {
    flexDirection: "row",
    gap: spacing.s,
    marginTop: spacing.s,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    borderRadius: radii.md,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.hairline,
    alignItems: "center",
    ...shadow.sm,
  },
  secondaryBtnText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
});
