import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { D } from "../core/decimal";
import {
  nodeCost,
  RESEARCH_NODES,
  ResearchBranch,
  ResearchNode,
} from "../core/research";
import { SPRINT_UPGRADES, SprintUpgradeDef, sprintUpgradeCost } from "../core/sprintUpgrades";
import {
  selectEquityStr,
  selectResearchPointsStr,
  selectUnlockedResearch,
  useGame,
} from "../game/store";
import { formatNumber } from "./formatNumber";
import { colors, fonts, PIXEL } from "./theme";

interface Props {
  onBack(): void;
}

// ─── Branch metadata ─────────────────────────────────────────────────────
// Labels + accent colors used for the branch headers and node accents.
// Colors mirror Claude Design `sub-screens.jsx::RESEARCH_BRANCHES` where
// each branch maps to a distinct chain color.
const BRANCH_META: Record<ResearchBranch, { label: string; color: string }> = {
  rd:      { label: "R&D",         color: colors.sage },
  compute: { label: "COMPUTE",     color: colors.terracotta },
  data:    { label: "DATA",        color: colors.gold },
  energy:  { label: "ENERGY",      color: colors.tensionRed },
  safety:  { label: "SAFETY",      color: colors.tension_hi },
  capital: { label: "CAPITAL",     color: colors.gold_2 },
};

// Pre-grouped nodes by branch, preserving definition order.
const NODES_BY_BRANCH: Record<ResearchBranch, ResearchNode[]> = (() => {
  const out: Record<ResearchBranch, ResearchNode[]> = {
    rd: [], compute: [], data: [], energy: [], safety: [], capital: [],
  };
  for (const n of RESEARCH_NODES) out[n.branch].push(n);
  return out;
})();

type NodeState = "owned" | "available" | "locked";

export function ResearchScreen({ onBack }: Props) {
  const equityStr = useGame(selectEquityStr);
  const rpStr = useGame(selectResearchPointsStr);
  const unlocked = useGame(selectUnlockedResearch);
  const ownedSprints = useGame((s) => s.run.sprintUpgradesUnlocked);
  const fundingRoundIdx = useGame((s) => s.run.fundingRoundIdx);
  const buy = useGame((s) => s.buyResearchNode);
  const buySprint = useGame((s) => s.buySprintUpgrade);
  const equity = D(equityStr);
  const rp = D(rpStr);

  // A node is "owned" if its id is in `unlocked`, "available" if affordable
  // AND any prerequisite of lower tier in the same branch is owned, otherwise
  // "locked". Current data has no explicit prereq field; we infer one: tier N
  // is gated behind ALL tier N-1 nodes in the same branch being owned.
  // (Matches the design's tree-walk intent — lower tiers come first.)
  const stateOf = (node: ResearchNode): NodeState => {
    if (unlocked.includes(node.id)) return "owned";
    const cost = nodeCost(node.tier);
    if (!equity.gte(cost)) return "locked";
    // Tier 1 nodes are always reachable (no prereq).
    if (node.tier === 1) return "available";
    const prereqsInSameBranch = NODES_BY_BRANCH[node.branch]
      .filter((n) => n.tier === node.tier - 1)
      .map((n) => n.id);
    const allPrereqsOwned = prereqsInSameBranch.every((id) => unlocked.includes(id));
    return allPrereqsOwned ? "available" : "locked";
  };

  return (
    <View style={styles.shell}>
      <ScreenHeader
        title="Research Tree"
        sub={`${formatNumber(equity)} Equity available · spend before prestige`}
        onBack={onBack}
      />

      {/* Sprint section — per-run RP-bought boosts (GDD §4 Beat 2). Lives
          above the Equity tree because RP is the R&D-allocation currency the
          player just generated this round; resets on prestige. */}
      <View style={styles.sprintHeader}>
        <View style={[styles.sprintSwatch, { backgroundColor: colors.sage }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.sprintLabel}>SPRINT · RP</Text>
          <Text style={styles.sprintSub}>per-run boosts · reset on prestige</Text>
        </View>
        <Text style={styles.sprintRp}>{formatNumber(rp)} RP</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sprintRow}
      >
        {SPRINT_UPGRADES.map((u) => {
          const cost = sprintUpgradeCost(u, fundingRoundIdx);
          return (
            <SprintCard
              key={u.id}
              def={u}
              cost={cost}
              owned={ownedSprints.includes(u.id)}
              affordable={rp.gte(cost)}
              onBuy={() => buySprint(u.id)}
            />
          );
        })}
      </ScrollView>

      {/* Equity card — gold accent, big number left, "next tier cost" right */}
      <View style={styles.equityCard}>
        <View style={[styles.equitySwatch, { backgroundColor: colors.gold }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.equityLabel}>EQUITY</Text>
          <Text style={styles.equityValue}>{formatNumber(equity)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.equityLabel}>NEXT TIER</Text>
          <Text style={styles.equityNextHint}>×3 cost</Text>
        </View>
      </View>

      {/* Branches as vertical rows; each row is a horizontal scroll of nodes */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.branchList}
        showsVerticalScrollIndicator={false}
      >
        {(Object.keys(NODES_BY_BRANCH) as ResearchBranch[])
          .filter((b) => NODES_BY_BRANCH[b].length > 0)
          .map((branch) => (
            <Branch
              key={branch}
              branch={branch}
              nodes={NODES_BY_BRANCH[branch]}
              stateOf={stateOf}
              onBuy={(id) => buy(id)}
            />
          ))}
      </ScrollView>
    </View>
  );
}

function Branch({
  branch,
  nodes,
  stateOf,
  onBuy,
}: {
  branch: ResearchBranch;
  nodes: ResearchNode[];
  stateOf(n: ResearchNode): NodeState;
  onBuy(id: string): void;
}) {
  const meta = BRANCH_META[branch];
  return (
    <View style={styles.branch}>
      <View style={styles.branchHeader}>
        <View style={[styles.branchSwatch, { backgroundColor: meta.color }]} />
        <Text style={[styles.branchLabel, { color: meta.color }]}>{meta.label}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.nodeRow}
      >
        {nodes.map((n) => (
          <ResearchNodeCard
            key={n.id}
            node={n}
            color={meta.color}
            state={stateOf(n)}
            onBuy={() => onBuy(n.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ResearchNodeCard({
  node,
  color,
  state,
  onBuy,
}: {
  node: ResearchNode;
  color: string;
  state: NodeState;
  onBuy(): void;
}) {
  // Accent color follows state — owned uses sage (always positive), available
  // uses the branch color (interactable), locked goes muted.
  const accent =
    state === "owned" ? colors.sage :
    state === "available" ? color :
    colors.muted;

  const bg =
    state === "owned" ? "#EAF1EC" :  // washed sage
    state === "locked" ? colors.cream_2 :
    colors.cream_hi;

  const cost = nodeCost(node.tier);

  return (
    <Pressable
      onPress={state === "available" ? onBuy : undefined}
      disabled={state !== "available"}
      style={[
        styles.nodeCard,
        {
          backgroundColor: bg,
          borderColor: accent,
          shadowColor: accent,
          opacity: state === "locked" ? 0.55 : 1,
        },
      ]}
    >
      {/* Top row — tier badge + state indicator */}
      <View style={styles.nodeTopRow}>
        <View style={[styles.tierBadge, { backgroundColor: accent }]}>
          <Text style={styles.tierBadgeText}>T{node.tier}</Text>
        </View>
        <View style={styles.stateIndicator}>
          {state === "owned" && (
            <Text style={[styles.indicatorOwned, { color: colors.sage }]}>✓</Text>
          )}
          {state === "locked" && (
            <Text style={styles.indicatorLocked}>🔒</Text>
          )}
          {state === "available" && (
            <Text style={[styles.indicatorCost, { color: accent }]}>
              {cost}
              <Text style={styles.indicatorEq}> Eq</Text>
            </Text>
          )}
        </View>
      </View>

      {/* Node name + effect summary */}
      <Text style={styles.nodeName} numberOfLines={2}>{node.name}</Text>
      <Text style={[styles.nodeEffect, { color: accent }]} numberOfLines={2}>
        {node.description}
      </Text>
    </Pressable>
  );
}

// ─── SprintCard — per-run RP-bought boost ────────────────────────────────
function SprintCard({
  def,
  cost,
  owned,
  affordable,
  onBuy,
}: {
  def: SprintUpgradeDef;
  cost: number;
  owned: boolean;
  affordable: boolean;
  onBuy(): void;
}) {
  const accent = owned ? colors.sage_2 : affordable ? colors.sage : colors.cream_4;
  const effectLabel =
    def.effect.type === "tokens_mult"  ? `+${Math.round((def.effect.value - 1) * 100)}% tokens`
    : def.effect.type === "capital_mult"? `+${Math.round((def.effect.value - 1) * 100)}% capital`
    : def.effect.type === "hype_mult"   ? `+${Math.round((def.effect.value - 1) * 100)}% hype`
    :                                     `+${Math.round((def.effect.value - 1) * 100)}% RP`;
  return (
    <Pressable
      onPress={() => { if (!owned && affordable) onBuy(); }}
      style={[
        styles.sprintCard,
        { borderColor: accent, opacity: owned ? 0.65 : 1 },
      ]}
    >
      <View style={[styles.sprintCardSwatch, { backgroundColor: accent }]} />
      <Text style={styles.sprintCardName} numberOfLines={2}>{def.name}</Text>
      <Text style={[styles.sprintCardEffect, { color: accent }]} numberOfLines={1}>
        {effectLabel}
      </Text>
      <Text style={styles.sprintCardFlavor} numberOfLines={2}>{def.flavor}</Text>
      <View style={styles.sprintCardFooter}>
        {owned ? (
          <Text style={[styles.sprintCardCost, { color: colors.sage_2 }]}>OWNED</Text>
        ) : (
          <Text style={[styles.sprintCardCost, { color: affordable ? colors.ink : colors.muted }]}>
            {formatNumber(D(cost))} RP
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── ScreenHeader (same pattern as Producers/Allocate) ───────────────────
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
        {sub && <Text style={styles.sub} numberOfLines={1}>{sub}</Text>}
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
  equityCard: {
    margin: 8,
    marginBottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.cream_hi,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  equitySwatch: {
    width: 16,
    height: 16,
  },
  equityLabel: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    color: colors.muted,
    letterSpacing: 1,
  },
  equityValue: {
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    color: colors.gold,
    lineHeight: 20,
    marginTop: 2,
  },
  equityNextHint: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
    marginTop: 2,
  },
  branchList: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 10,
  },
  branch: {},
  branchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  branchSwatch: {
    width: 8,
    height: 8,
  },
  branchLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
  },
  nodeRow: {
    gap: 6,
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  nodeCard: {
    width: 110,
    padding: 6,
    borderWidth: 1,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  nodeTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tierBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tierBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    color: colors.cream_hi,
    letterSpacing: 0.5,
  },
  stateIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  indicatorOwned: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
  },
  indicatorLocked: {
    fontSize: 11,
  },
  indicatorCost: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
  },
  indicatorEq: {
    fontFamily: fonts.displayRegular,
    fontSize: 7,
  },
  nodeName: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.ink,
    marginTop: 4,
    lineHeight: 13,
  },
  nodeEffect: {
    fontFamily: fonts.displayRegular,
    fontSize: 7,
    letterSpacing: 0.5,
    marginTop: 3,
    lineHeight: 9,
  },
  sprintHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  sprintSwatch: {
    width: 10,
    height: 10,
  },
  sprintLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 1,
  },
  sprintSub: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    color: colors.muted,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  sprintRp: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.ink,
  },
  sprintRow: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  sprintCard: {
    width: 132,
    padding: 8,
    backgroundColor: colors.cream_hi,
    borderWidth: 1,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  sprintCardSwatch: {
    width: 14,
    height: 4,
    marginBottom: 4,
  },
  sprintCardName: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.ink,
    lineHeight: 14,
  },
  sprintCardEffect: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    letterSpacing: 0.5,
    marginTop: 3,
  },
  sprintCardFlavor: {
    fontFamily: fonts.displayRegular,
    fontSize: 7,
    color: colors.muted,
    letterSpacing: 0.5,
    marginTop: 3,
    lineHeight: 9,
    minHeight: 18,
  },
  sprintCardFooter: {
    marginTop: 6,
    alignItems: "flex-end",
  },
  sprintCardCost: {
    fontFamily: fonts.display,
    fontSize: 10,
    letterSpacing: 1,
  },
});
