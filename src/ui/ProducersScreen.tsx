import React, { useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { D, Decimal } from "../core/decimal";
import {
  autonomousAgentMult,
  nextProducerCost,
  upgradeMultiplier,
  upgradeTier,
} from "../core/math";
import {
  AUTONOMOUS_AGENT,
  CHAINS,
  producersForChain,
  unlockRoundForTier,
} from "../core/producers";
import { getRound } from "../core/rounds";
import * as audio from "../audio";
import { PanelHelpModal, PanelHint, PanelInfoButton } from "./PanelHelp";
import { useStrings } from "../core/i18n";
import { ChainId, ProducerDef } from "../core/types";
import {
  selectCapitalStr,
  selectFundingRoundIdx,
  selectProducersOwned,
  tokensPerSec,
  useGame,
} from "../game/store";
import { formatNumber, formatRate, formatMoney } from "./formatNumber";
import { colors, fonts, PIXEL, spacing } from "./theme";

interface Props {
  onBack(): void;
  defaultChain?: ChainId;
  /** When set, only this chain's tab is rendered — used by the guided
   *  tutorial to force the player into buying from a specific chain during
   *  steps 2/3. Other tabs are hidden so there's no escape. */
  lockedChain?: ChainId;
}

// Chain accent colors only — labels/subs/tabs come from i18n via
// t.producers.chains so they can localize per-language.
const CHAIN_COLORS: Record<ChainId, string> = {
  engineers: colors.sage,
  gpu:       colors.terracotta,
  data:      colors.gold,
  energy:    colors.tensionRed,
};

export function ProducersScreen({ onBack, defaultChain, lockedChain }: Props) {
  const [infoOpen, setInfoOpen] = useState(false);
  const t = useStrings();
  const capitalStr = useGame(selectCapitalStr);
  const owned = useGame(selectProducersOwned);
  const fundingRoundIdx = useGame(selectFundingRoundIdx);
  const buy = useGame((s) => s.buyProducer);
  const capital = D(capitalStr);

  const [activeChain, setActiveChain] = useState<ChainId | "agent">(
    lockedChain ?? defaultChain ?? "engineers"
  );
  const agentUnlocked = fundingRoundIdx >= AUTONOMOUS_AGENT.unlockRoundIdx;
  const isAgent = activeChain === "agent";
  // Falls back to engineers' meta when the agent tab is active — only ever read
  // inside the chain-mode branch, but keeps `meta` non-null for the header.
  const metaChain: ChainId = isAgent ? "engineers" : activeChain;
  const meta = {
    label: t.producers.chains[metaChain].label,
    sub:   t.producers.chains[metaChain].sub,
    tab:   t.producers.chains[metaChain].tab,
    color: CHAIN_COLORS[metaChain],
  };

  // Live chain supply for the footer (+X/s).
  const runForCalc = {
    fundingRoundIdx,
    tokens: "0",
    capital: capitalStr,
    hype: "0",
    researchPoints: "0",
    allocation: { rd: 0, product: 0, marketing: 0, safety: 0 },
    producersOwned: owned,
    activeEffects: [],
    trainingPity: 0,
    sprintUpgradesUnlocked: [],
  };
  const totalTps = tokensPerSec(runForCalc);

  // Autonomous Agent (AGI arc) — a global tokens/sec flywheel, not a chain.
  const agentOwned = owned[AUTONOMOUS_AGENT.id] ?? 0;
  const agentMult = autonomousAgentMult(runForCalc);
  const agentCost = nextProducerCost(AUTONOMOUS_AGENT, agentOwned);
  const agentAffordable = capital.gte(agentCost);

  const tiers = activeChain === "agent" ? [] : producersForChain(activeChain);
  // Identify the lowest tier whose unlock round equals the current round.
  // That tier gets the "NEW" pulse — matches design intent ("next unlocked").
  const newTierIdx = tiers.find((t) => unlockRoundForTier(t.tierIdx) === fundingRoundIdx)?.tierIdx;

  return (
    <View style={styles.shell}>
      <ScreenHeader
        title={t.producers.title}
        sub={t.producers.sub}
        onBack={onBack}
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <PanelInfoButton onPress={() => setInfoOpen(true)} />
            <CapitalChip capital={capital} />
          </View>
        }
      />

      <PanelHint panelKey="producers" text={t.producers.hint} />

      <PanelHelpModal
        visible={infoOpen}
        title={t.producers.title}
        sections={t.producers.help}
        onClose={() => setInfoOpen(false)}
      />

      {/* Chain tabs — 4 buttons side-by-side, active gets full color fill.
          Filtered to a single tab when `lockedChain` is set (tutorial
          forces the player into that chain only). */}
      <View style={styles.tabsRow}>
        {CHAINS.filter((c) => !lockedChain || c.id === lockedChain).map((c) => {
          const tabLabel = t.producers.chains[c.id].tab;
          const tabColor = CHAIN_COLORS[c.id];
          const active = c.id === activeChain;
          return (
            // Plain Pressable here — Pressy's Animated.View wrapper swallows
            // flex:1 on iOS, leaving each tab at min-content width. With
            // Pressable we get reliable flex distribution across the row.
            <Pressable
              key={c.id}
              onPress={() => setActiveChain(c.id)}
              style={[
                styles.tab,
                {
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: active ? tabColor : colors.cream_2,
                },
              ]}
            >
              <View style={styles.tabInner}>
                <Text
                  style={[
                    styles.tabLabel,
                    { color: active ? colors.cream_hi : colors.ink },
                  ]}
                  numberOfLines={1}
                >
                  {tabLabel}
                </Text>
              </View>
            </Pressable>
          );
        })}
        {agentUnlocked && (
          <Pressable
            onPress={() => setActiveChain("agent")}
            style={[
              styles.tab,
              {
                flex: 1,
                minWidth: 0,
                backgroundColor: isAgent ? colors.tension_2 : colors.cream_2,
              },
            ]}
          >
            <View style={styles.tabInner}>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isAgent ? colors.cream_hi : colors.ink },
                ]}
                numberOfLines={1}
              >
                AGI
              </Text>
            </View>
          </Pressable>
        )}
      </View>

      {isAgent ? (
        <>
          {/* Agent header */}
          <View style={styles.chainHeader}>
            <View style={[styles.chainSwatch, { backgroundColor: colors.tension_2 }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.chainLabel, { color: colors.tension_2 }]}>
                AUTONOMOUS AGENT
              </Text>
              <Text style={styles.chainSub}>
                Self-improving AI · ×{AUTONOMOUS_AGENT.multPerUnit.toFixed(2)} tokens/s each
              </Text>
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            <AgentCard
              owned={agentOwned}
              mult={agentMult}
              cost={agentCost}
              affordable={agentAffordable}
              onBuy={() => {
                const r = buy(AUTONOMOUS_AGENT.id, 1);
                if (r.bought > 0) audio.play("producer_buy");
              }}
            />
          </ScrollView>

          {/* Global multiplier footer */}
          <View style={styles.footer}>
            <Text style={styles.footerLabel}>{t.producers.globalMultiplier}</Text>
            <Text style={[styles.footerValue, { color: colors.tension_2 }]}>
              ×{formatNumber(agentMult)}
            </Text>
          </View>
        </>
      ) : (
        <>
          {/* Chain header — name + sub */}
          <View style={styles.chainHeader}>
            <View style={[styles.chainSwatch, { backgroundColor: meta.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.chainLabel, { color: meta.color }]}>{meta.label}</Text>
              <Text style={styles.chainSub}>{meta.sub}</Text>
            </View>
          </View>

          {/* Tier list */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {tiers.map((tier) => (
              <ProducerCard
                key={tier.id}
                def={tier}
                ownedCount={owned[tier.id] ?? 0}
                capital={capital}
                currentRound={fundingRoundIdx}
                color={meta.color}
                fresh={tier.tierIdx === newTierIdx}
                onBuy={() => {
                  const r = buy(tier.id, 1);
                  if (r.bought > 0) {
                    // "Advanced" buy SFX from the audio kit kicks in for
                    // mid/late-tier producers (Staff Engineer + above) where
                    // each purchase is a meaningful capital commitment. Lower
                    // tiers stay on the lighter standard buy cue.
                    audio.play(tier.tierIdx >= 4 ? "producer_upgrade" : "producer_buy");
                  }
                }}
              />
            ))}
          </ScrollView>

          {/* Total chain supply footer */}
          <View style={styles.footer}>
            <Text style={styles.footerLabel}>{t.producers.chainOutput}</Text>
            <Text style={[styles.footerValue, { color: meta.color }]}>
              +{formatRate(totalTps)}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

// ─── AgentCard ───────────────────────────────────────────────────────────
function AgentCard({
  owned,
  mult,
  cost,
  affordable,
  onBuy,
}: {
  owned: number;
  mult: Decimal;
  cost: Decimal;
  affordable: boolean;
  onBuy(): void;
}) {
  const t = useStrings();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.cream_hi,
          borderColor: colors.ink,
          shadowColor: colors.ink,
        },
      ]}
    >
      <View style={[styles.cardSwatch, { backgroundColor: colors.tension_2 }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, { color: colors.ink }]} numberOfLines={1}>
            {(t.producers.names as Record<string, string>)[AUTONOMOUS_AGENT.id] ?? AUTONOMOUS_AGENT.name}
          </Text>
          <View style={[styles.upgradeBadge, { backgroundColor: colors.tension_hi }]}>
            <Text style={[styles.upgradeBadgeText, { color: colors.cream_hi }]}>
              ×{formatNumber(mult)}
            </Text>
          </View>
        </View>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {t.producers.owned} · {owned} · ×{AUTONOMOUS_AGENT.multPerUnit.toFixed(2)} {t.producers.globalEach}
        </Text>
        <Text style={styles.upgradeHint} numberOfLines={2}>
          {t.producers.agentFlywheel}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          if (!affordable) return;
          onBuy();
        }}
        disabled={!affordable}
        style={[
          styles.buyBtn,
          { backgroundColor: affordable ? colors.tension_2 : colors.disabled },
        ]}
      >
        <Text style={styles.buyText}>${formatMoney(cost)}</Text>
      </Pressable>
    </View>
  );
}

// ─── ProducerCard ────────────────────────────────────────────────────────
function ProducerCard({
  def,
  ownedCount,
  capital,
  currentRound,
  color,
  fresh,
  onBuy,
}: {
  def: ProducerDef;
  ownedCount: number;
  capital: Decimal;
  currentRound: number;
  color: string;
  fresh: boolean;
  onBuy(): void;
}) {
  const t = useStrings();
  const unlockRound = unlockRoundForTier(def.tierIdx);
  const locked = currentRound < unlockRound;

  const cost = nextProducerCost(def, ownedCount);
  const affordable = !locked && capital.gte(cost);
  const upMult = upgradeMultiplier(ownedCount);
  const tier = upgradeTier(ownedCount);
  const effectiveRate = D(def.baseOutputPerSec * upMult);
  const nextThreshold = UPGRADE_NEXT_THRESHOLD[tier];
  const nextLabel = UPGRADE_NEXT_LABEL[tier];

  // NEW-tier pulse — slow 1.6s opacity sine so it draws the eye without
  // shouting. Matches the design's `slackPulse` keyframe (kept simple).
  const pulse = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!fresh) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [fresh, pulse]);

  return (
    <Animated.View
      style={[
        styles.cardWrap,
        fresh && {
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }),
        },
      ]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: locked ? colors.cream_2 : colors.cream_hi,
            borderColor: locked ? colors.cream_4 : colors.ink,
            shadowColor: locked ? colors.cream_4 : colors.ink,
            opacity: locked ? 0.6 : 1,
          },
        ]}
      >
        {/* Chain-color swatch on left, doubles as "category" stripe */}
        <View style={[styles.cardSwatch, { backgroundColor: locked ? colors.muted : color }]} />

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, { color: locked ? colors.muted : colors.ink }]} numberOfLines={1}>
              {(t.producers.names as Record<string, string>)[def.id] ?? def.name}
            </Text>
            {upMult > 1 && (
              <View style={styles.upgradeBadge}>
                <Text style={styles.upgradeBadgeText}>×{upMult}</Text>
              </View>
            )}
            {fresh && !locked && (
              <Text style={styles.newBadge}>{t.producers.newBadge}</Text>
            )}
          </View>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {t.producers.owned} · {ownedCount} · {t.producers.out} {formatRate(effectiveRate)}
          </Text>
          {/* Always render the hint row to preserve vertical card height —
              when the player buys past the last upgrade tier the hint goes
              empty, and without this placeholder the card collapses by ~10px
              and every card below jumps up. */}
          <Text
            style={[
              styles.upgradeHint,
              (locked || nextThreshold === null || nextLabel === null) && { opacity: 0 },
            ]}
            numberOfLines={1}
          >
            {!locked && nextThreshold !== null && nextLabel !== null
              ? `${nextThreshold - ownedCount} → ${nextLabel} ${t.producers.multiplier}`
              : "·"}
          </Text>
        </View>

        {/* Right: buy button OR lock badge */}
        {locked ? (
          <View style={styles.lockBadge}>
            <Text style={styles.lockBadgeText}>
              🔒 {(t.roundNames[getRound(unlockRound).id as keyof typeof t.roundNames] ?? getRound(unlockRound).name).replace("Series ", "S")}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              if (!affordable) return;
              onBuy();
            }}
            disabled={!affordable}
            style={[
              styles.buyBtn,
              { backgroundColor: affordable ? color : colors.disabled },
            ]}
          >
            <Text style={styles.buyText}>${formatMoney(cost)}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const UPGRADE_NEXT_THRESHOLD: readonly (number | null)[] = [10, 50, 100, null];
const UPGRADE_NEXT_LABEL: readonly (string | null)[] = ["×2", "×8", "×64", null];

// ─── ScreenHeader (inline, reusable later) ───────────────────────────────
function ScreenHeader({
  title, sub, onBack, right,
}: {
  title: string;
  sub?: string;
  onBack(): void;
  /** Optional right-aligned slot for a stat chip (e.g. live Capital). */
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
        <Text style={styles.backChevron}>‹</Text>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.brand} numberOfLines={1}>
          BURN<Text style={{ color: colors.terracotta }}>·</Text>RATE
        </Text>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {/* numberOfLines={1} + ellipsis so the sub line never reflows when the
            CapitalChip on the right grows (e.g. $61 → $1.05M widens the chip,
            stealing horizontal pixels and wrapping the sub from 1 to 2 lines).
            Combined with the chip's fixed minWidth below, the header height
            is stable across the whole game. */}
        {sub && <Text style={styles.sub} numberOfLines={1} ellipsizeMode="tail">{sub}</Text>}
      </View>
      {right}
    </View>
  );
}

// Capital chip for the header — terracotta swatch (matches the chain accent
// of "Product" / Capital in the allocation strip) + big mono number. Reads
// at a glance so the player can decide whether to scroll the tier list.
function CapitalChip({ capital }: { capital: Decimal }) {
  const t = useStrings();
  return (
    <View style={styles.capitalChip}>
      <View style={[styles.capitalSwatch, { backgroundColor: colors.terracotta }]} />
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.capitalLabel}>{t.producers.capitalHeader}</Text>
        <Text style={styles.capitalValue}>${formatMoney(capital)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.cream,
  },
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
  backBtn: {
    padding: 6,
  },
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
  capitalChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.cream_hi,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    // Fixed min-width so the chip doesn't grow with the formatted capital
    // string ($61 → $1.05M → $4.32B). Without this the chip steals horizontal
    // pixels from the title/sub block on the left, wrapping the subtitle from
    // 1 line to 2 and shifting every row below.
    minWidth: 92,
  },
  capitalSwatch: {
    width: 10,
    height: 10,
  },
  capitalLabel: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    color: colors.muted,
    letterSpacing: 1,
  },
  capitalValue: {
    // VT323 mono — capital chip in the header. PixelifySans Bold made
    // values like "$268" / "$926" look mushy at this size. Bumped 14 →
    // 16 to compensate for mono's narrower em.
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.ink,
    lineHeight: 16,
    marginTop: 1,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  tab: {
    // Pressable now BOTH provides the touch target AND owns the visual chrome.
    // Inner View takes care of centering label + bottleneck dot in a row.
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  tabInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  tabLabel: {
    fontFamily: fonts.display,
    // Bumped 11 → 14: Silkscreen at 11 is borderline-invisible on retina iOS.
    // 14 reads cleanly on phone without breaking web layout (tabs still fit).
    fontSize: 14,
    letterSpacing: 1,
    lineHeight: 16,
  },
  chainHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
  },
  chainSwatch: {
    width: 12,
    height: 12,
  },
  chainLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 16,
  },
  chainSub: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 8,
    paddingBottom: spacing.xl,
    gap: 6,
  },
  cardWrap: {},
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    // Fixed height so the card never resizes when an upgrade badge (×2 at
    // 10 owned, ×8 at 50, ×64 at 100) appears in the title row. Without this
    // the title row gains ~2px from the badge's border+padding and every
    // card below shifts. 70 fits all states comfortably.
    height: 70,
    borderWidth: 1,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  cardSwatch: {
    width: 4,
    alignSelf: "stretch",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    // Fixed minimum height so the upgrade badge or NEW chip appearing/dis-
    // appearing doesn't change the row's vertical footprint by a px or two.
    minHeight: 18,
  },
  cardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    lineHeight: 16,
    flexShrink: 1,
  },
  upgradeBadge: {
    backgroundColor: colors.gold,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  upgradeBadgeText: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 0,
  },
  newBadge: {
    fontFamily: fonts.display,
    fontSize: 8,
    color: colors.gold_2,
    letterSpacing: 1,
  },
  cardMeta: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    color: colors.muted,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  upgradeHint: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    color: colors.gold_2,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  buyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 68,
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
  buyText: {
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.cream_hi,
    letterSpacing: 0,
  },
  lockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "#FCE6E8",
    borderWidth: 1,
    borderColor: colors.tensionRed,
    minWidth: 68,
    alignItems: "center",
    justifyContent: "center",
  },
  lockBadgeText: {
    fontFamily: fonts.display,
    fontSize: 8,
    color: colors.tensionRed,
    letterSpacing: 1,
  },
  footer: {
    margin: 8,
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
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerLabel: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1,
  },
  footerValue: {
    fontFamily: fonts.mono,
    fontSize: 18,
  },
});
