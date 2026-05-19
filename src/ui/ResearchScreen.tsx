import { LinearGradient } from "expo-linear-gradient";
import {
  Banknote,
  Beaker,
  Cpu,
  Database,
  LucideIcon,
  Shield,
  Zap,
} from "lucide-react-native";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { D } from "../core/decimal";
import {
  nodeCost,
  RESEARCH_NODES,
  ResearchBranch,
  ResearchNode,
} from "../core/research";
import {
  selectEquityStr,
  selectUnlockedResearch,
  useGame,
} from "../game/store";
import { formatNumber } from "./formatNumber";
import { ParticleBurst } from "./ParticleBurst";
import { Pressy } from "./Pressy";
import { colors, gradient, radii, shadow, spacing, type } from "./theme";

interface Props {
  onBack(): void;
}

const BRANCH_LABEL: Record<ResearchBranch, string> = {
  rd:      "R&D",
  compute: "Compute",
  data:    "Data",
  energy:  "Energy",
  safety:  "Safety",
  capital: "Capital",
};

const BRANCH_ICON: Record<ResearchBranch, LucideIcon> = {
  rd:      Beaker,
  compute: Cpu,
  data:    Database,
  energy:  Zap,
  safety:  Shield,
  capital: Banknote,
};

const BRANCH_COLOR: Record<ResearchBranch, string> = {
  rd:      colors.sage,
  compute: colors.terracotta,
  data:    colors.gold,
  energy:  colors.tensionRed,
  safety:  colors.tensionRed,
  capital: colors.terracotta,
};

// Pre-grouped nodes by branch, preserving GDD ordering.
const NODES_BY_BRANCH: Record<ResearchBranch, ResearchNode[]> = (() => {
  const out: Record<ResearchBranch, ResearchNode[]> = {
    rd: [], compute: [], data: [], energy: [], safety: [], capital: [],
  };
  for (const n of RESEARCH_NODES) out[n.branch].push(n);
  return out;
})();

export function ResearchScreen({ onBack }: Props) {
  const equityStr = useGame(selectEquityStr);
  const unlocked = useGame(selectUnlockedResearch);
  const buy = useGame((s) => s.buyResearchNode);
  const equity = D(equityStr);

  const [burst, setBurst] = React.useState(0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>← back</Text>
        </Pressable>
        <Text style={type.caption}>
          Equity: <Text style={{ color: colors.gold, fontWeight: "700" }}>{formatNumber(equity)}</Text>
        </Text>
      </View>

      <Text style={[type.body, { color: colors.muted, marginBottom: spacing.s }]}>
        Spend Equity on permanent multipliers. Effects stack multiplicatively
        and persist across funding rounds.
      </Text>

      {(Object.keys(NODES_BY_BRANCH) as ResearchBranch[])
        .filter((b) => NODES_BY_BRANCH[b].length > 0)
        .map((branch) => (
          <Branch
            key={branch}
            branch={branch}
            nodes={NODES_BY_BRANCH[branch]}
            unlocked={unlocked}
            equity={equity}
            onBuy={(id) => {
              const r = buy(id);
              if (r.bought) setBurst((n) => n + 1);
            }}
          />
        ))}
      <ParticleBurst trigger={burst} count={16} palette={[colors.gold, colors.cream, colors.sage]} />
    </ScrollView>
  );
}

function Branch({
  branch,
  nodes,
  unlocked,
  equity,
  onBuy,
}: {
  branch: ResearchBranch;
  nodes: ResearchNode[];
  unlocked: string[];
  equity: ReturnType<typeof D>;
  onBuy(id: string): void;
}) {
  const Icon = BRANCH_ICON[branch];
  const color = BRANCH_COLOR[branch];

  return (
    <View style={styles.branchBlock}>
      <View style={styles.branchHeader}>
        <Icon size={16} color={color} strokeWidth={2.5} />
        <Text style={[type.h2, { color }]}>{BRANCH_LABEL[branch]}</Text>
      </View>
      {nodes.map((node) => {
        const isOwned = unlocked.includes(node.id);
        const cost = nodeCost(node.tier);
        const affordable = equity.gte(cost);
        return (
          <NodeCard
            key={node.id}
            node={node}
            isOwned={isOwned}
            affordable={affordable}
            color={color}
            onBuy={() => onBuy(node.id)}
          />
        );
      })}
    </View>
  );
}

function NodeCard({
  node,
  isOwned,
  affordable,
  color,
  onBuy,
}: {
  node: ResearchNode;
  isOwned: boolean;
  affordable: boolean;
  color: string;
  onBuy(): void;
}) {
  const cost = nodeCost(node.tier);
  return (
    <View
      style={[
        styles.node,
        { borderLeftColor: color },
        isOwned && styles.nodeOwned,
        !isOwned && !affordable && styles.nodeDisabled,
      ]}
    >
      <View style={styles.nodeText}>
        <View style={styles.nodeTitleRow}>
          <Text style={type.h2}>{node.name}</Text>
          <View style={[styles.tierPill, { backgroundColor: color }]}>
            <Text style={styles.tierPillText}>T{node.tier}</Text>
          </View>
        </View>
        <Text style={type.caption}>{node.description}</Text>
      </View>
      {isOwned ? (
        <View style={styles.ownedTag}>
          <Text style={styles.ownedText}>OWNED</Text>
        </View>
      ) : (
        <Pressy
          style={[styles.buyBtn, !affordable && styles.buyBtnDisabled]}
          onPress={onBuy}
          disabled={!affordable}
        >
          {affordable && (
            <LinearGradient
              colors={gradient.gold}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          <Text style={[styles.buyText, !affordable && styles.buyTextDisabled]}>
            {cost} Eq
          </Text>
        </Pressy>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.s,
  },
  back: { color: colors.terracotta, fontSize: 14, fontWeight: "600" },
  branchBlock: { marginBottom: spacing.l, gap: spacing.s },
  branchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    marginBottom: spacing.xs,
  },
  node: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radii.md,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.m,
    gap: spacing.m,
    ...shadow.sm,
  },
  nodeOwned: {
    backgroundColor: "#F0EBDD",
    borderColor: colors.gold,
  },
  nodeDisabled: { opacity: 0.6 },
  nodeText: { flex: 1, gap: spacing.xs },
  nodeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  tierPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  tierPillText: {
    color: colors.cream,
    fontSize: 10,
    fontWeight: "700",
  },
  buyBtn: {
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderRadius: radii.sm,
    minWidth: 90,
    alignItems: "center",
    backgroundColor: colors.gold,
    overflow: "hidden",
    ...shadow.md,
  },
  buyBtnDisabled: { backgroundColor: colors.disabled },
  buyText: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  buyTextDisabled: { color: colors.muted },
  ownedTag: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: radii.sm,
    backgroundColor: colors.sage,
    minWidth: 90,
    alignItems: "center",
  },
  ownedText: { color: colors.cream, fontWeight: "700", fontSize: 12, letterSpacing: 0.6 },
});
