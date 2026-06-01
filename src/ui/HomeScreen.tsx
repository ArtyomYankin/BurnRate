import React from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { D } from "../core/decimal";
import { PRODUCER_BY_ID } from "../core/producers";
import { getRound } from "../core/rounds";
import { ChainId, ProducerDef } from "../core/types";
import { effectiveRoundThreshold, hypeThresholdDiscount } from "../core/math";
import {
  selectActiveEffects,
  selectAlignmentDebtStr,
  selectAllocation,
  selectCanPrestige,
  selectCapitalStr,
  selectEquityStr,
  selectFundingRoundIdx,
  selectHypeStr,
  selectPendingDebtEvents,
  selectProducersOwned,
  selectTokensStr,
  selectUnlockedAchievementCount,
  selectUnreadVignetteCount,
  tokensPerSec,
  useGame,
} from "../game/store";
import * as audio from "../audio";
import { useAudioStore } from "../audio";
import { BottomAllocation } from "./BottomAllocation";
import { BuffsModal } from "./BuffsModal";
import { formatNumber, formatRate } from "./formatNumber";
import { ItemPopup, PopupContent } from "./ItemPopup";
import { HitId, PixelScene, sceneForRound } from "./PixelScene";
import { Onboarding, tutorialHighlightForStep } from "./Onboarding";
import { Pressy } from "./Pressy";
import { colors, fonts } from "./theme";
import { DevPanel } from "./DevPanel";
import { TopHUD } from "./TopHUD";

interface Props {
  onOpenProducers(chain?: ChainId): void;
  onOpenAllocate(): void;
  onOpenResearch(): void;
  onOpenTraining(): void;
  onOpenPrestige(): void;
  onOpenVignettes(): void;
  onOpenAchievements(): void;
}

// Map each hit zone in the scene to a producer tier (so the popup can show
// "Owned N · Cost $X" without HomeScreen needing chain awareness for every
// click). Wall items (research, plant) and cosmetic items have no tier.
const HIT_TO_PRODUCER: Partial<Record<HitId, string>> = {
  engineer: "intern",
  monitor:  "intern",   // training run uses the monitor as its hit; producer field is read for context only
  gpu:      "single_h100",
  books:    "common_crawl",
  energy:   "office_grid",
};

const HIT_TO_CHAIN: Partial<Record<HitId, ChainId>> = {
  engineer: "engineers",
  gpu:      "gpu",
  books:    "data",
  energy:   "energy",
};

export function HomeScreen({
  onOpenProducers,
  onOpenAllocate,
  onOpenResearch,
  onOpenTraining,
  onOpenPrestige,
  onOpenVignettes,
  onOpenAchievements,
}: Props) {
  const tokensStr = useGame(selectTokensStr);
  const capitalStr = useGame(selectCapitalStr);
  const equityStr = useGame(selectEquityStr);
  const hypeStr = useGame(selectHypeStr);
  const debtStr = useGame(selectAlignmentDebtStr);
  const allocation = useGame(selectAllocation);
  const owned = useGame(selectProducersOwned);
  const activeEffects = useGame(selectActiveEffects);
  const fundingRoundIdx = useGame(selectFundingRoundIdx);
  const canPrestige = useGame(selectCanPrestige);
  const unreadVignettes = useGame(selectUnreadVignetteCount);
  const pendingDebtCount = useGame((s) => selectPendingDebtEvents(s).length);
  const achievementCount = useGame(selectUnlockedAchievementCount);
  const onboardingStep = useGame((s) => s.account.onboardingStep);
  const sfxMuted = useAudioStore((s) => s.sfxMuted);
  const toggleSfx = useAudioStore((s) => s.toggleSfx);

  const tokens = D(tokensStr);
  const capital = D(capitalStr);
  const equity = D(equityStr);
  const debt = D(debtStr);

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
    sprintUpgradesUnlocked: [],
  };
  const tps = tokensPerSec(runForCalc);

  const round = getRound(fundingRoundIdx);
  // Hype-discounted threshold: the progress bar fills against the effective
  // bar the player actually has to clear, so Hype investments show up live.
  const threshold = effectiveRoundThreshold(fundingRoundIdx, hypeStr);
  const hypeDiscount = hypeThresholdDiscount(fundingRoundIdx, hypeStr);
  const pct = Math.min(100, tokens.div(threshold).toNumber() * 100);
  const nextRound = getRound(fundingRoundIdx + 1);

  // Pixel scene dimensions — fit width of the phone (minus 8px gutter), keep
  // 2:3 ratio matching the design's 240×360 native scene.
  const screenW = Dimensions.get("window").width;
  const sceneW = Math.min(screenW, 420);
  const sceneH = Math.round(sceneW * (360 / 240));

  const [popup, setPopup] = React.useState<PopupContent | null>(null);
  const [activeHit, setActiveHit] = React.useState<HitId | null>(null);

  // ─── Reactive audio cues ───────────────────────────────────────────────
  // Played on STATE GROWTH so they don't fire on mount/hydrate. The refs
  // hold the previous value so we can compare on each re-render — cheap.
  const prevUnreadRef = React.useRef(unreadVignettes);
  React.useEffect(() => {
    if (unreadVignettes > prevUnreadRef.current) audio.play("vignette_pop");
    prevUnreadRef.current = unreadVignettes;
  }, [unreadVignettes]);

  const prevDebtCountRef = React.useRef(pendingDebtCount);
  React.useEffect(() => {
    if (pendingDebtCount > prevDebtCountRef.current) audio.play("debt_warn");
    prevDebtCountRef.current = pendingDebtCount;
  }, [pendingDebtCount]);

  // Music: swap track on era change (rounds 0-3 garage, 4-7 tower, 8+ agi).
  React.useEffect(() => {
    audio.setMusicForRound(fundingRoundIdx);
  }, [fundingRoundIdx]);

  // Achievements unlocked → reuse the producer_upgrade cue (which is
  // currently unused — upgrades auto-apply silently). Mood brief matches:
  // "bigger confirm + sparkle, once per tier" reads as "achievement unlock."
  const prevAchievementsRef = React.useRef(achievementCount);
  React.useEffect(() => {
    if (achievementCount > prevAchievementsRef.current) audio.play("producer_upgrade");
    prevAchievementsRef.current = achievementCount;
  }, [achievementCount]);
  // Dev-cheats modal. Only opens via long-press on BURN·RATE in __DEV__
  // builds. Release bundles tree-shake DevPanel out via the `__DEV__` import
  // guard at the top of App.tsx — we keep the state hook here either way
  // so the conditional render below stays simple.
  const [devOpen, setDevOpen] = React.useState(false);
  const [buffsOpen, setBuffsOpen] = React.useState(false);

  const handleHit = (id: HitId) => {
    setActiveHit(id);
    setPopup(buildPopup(id, owned));
  };

  const closePopup = () => {
    setPopup(null);
    setActiveHit(null);
  };

  // Primary CTA in the popup — route to the right screen/modal. Buys happen
  // on the dedicated screen (we don't shortcut buy-1 from the home for now;
  // the user can BUY 1 in the modal Producers screen, where cost shows live).
  const handlePopupAction = () => {
    if (!popup) return;
    closePopup();
    if (popup.hit === "monitor") {
      onOpenTraining();
      return;
    }
    if (popup.hit === "research") {
      onOpenResearch();
      return;
    }
    const chain = HIT_TO_CHAIN[popup.hit];
    if (chain) {
      onOpenProducers(chain);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.sceneWrap}>
        <PixelScene
          width={sceneW}
          height={sceneH}
          onHit={handleHit}
          activeHit={activeHit}
          scene={sceneForRound(fundingRoundIdx)}
          tutorialHighlight={tutorialHighlightForStep(onboardingStep)}
        />
      </View>

      <TopHUD
        tokens={formatNumber(tokens)}
        rate={formatRate(tps)}
        pct={pct}
        roundLabel={`${round.name.toUpperCase()} · ROUND ${round.idx + 1}`}
        capital={formatNumber(capital)}
        equity={formatNumber(equity)}
        nextThresholdLabel={
          hypeDiscount > 0.005
            ? `NEXT: ${round.name.toUpperCase()} · HYPE -${Math.round(hypeDiscount * 100)}%`
            : `NEXT: ${nextRound.name.toUpperCase()} · 1e${nextRound.tokenThresholdLog10} TOKENS`
        }
      />

      {/* Visible-in-dev cheat trigger. Replaces an earlier hidden long-press
          on BURN·RATE — that gesture is flaky on RN-Web (Pressable's long-
          press timer cancels if the cursor drifts off the text). A small
          tag in the corner is more honest and tree-shakes out in release. */}
      {__DEV__ && (
        <Pressable style={styles.devChip} onPress={() => setDevOpen(true)}>
          <Text style={styles.devChipText}>DEV</Text>
        </Pressable>
      )}
      {__DEV__ && <DevPanel visible={devOpen} onClose={() => setDevOpen(false)} />}

      {/* SFX mute toggle — small chip on the right edge, just below the DEV
          chip. Tap to flip; reads from useAudioStore so it stays in sync if
          anything else flips the mute. */}
      <Pressable style={styles.sfxChip} onPress={toggleSfx}>
        <Text style={styles.sfxChipText}>{sfxMuted ? "MUTE" : "SFX"}</Text>
      </Pressable>


      {/* Bottom row of secondary buttons — keep prestige + producers/research
          reachable even when the player ignores hit zones. Sits above the
          allocation strip. */}
      <View style={styles.secondaryRow} pointerEvents="box-none">
        {/* Inbox button — always visible so the player knows it exists.
            Badge appears when unreadVignettes > 0; tap navigates to the
            inbox screen, which also marks rows as read on open. */}
        <Pressy onPress={onOpenVignettes}>
          <View style={styles.inboxBtn}>
            <Text style={styles.inboxText}>INBOX</Text>
            {unreadVignettes > 0 && (
              <View style={styles.inboxBadge}>
                <Text style={styles.inboxBadgeText}>{unreadVignettes}</Text>
              </View>
            )}
          </View>
        </Pressy>
        <Pressy onPress={onOpenAchievements}>
          <View style={styles.inboxBtn}>
            <Text style={styles.inboxText}>ACH</Text>
            {achievementCount > 0 && (
              <View style={[styles.inboxBadge, { backgroundColor: colors.sage_2 }]}>
                <Text style={styles.inboxBadgeText}>{achievementCount}</Text>
              </View>
            )}
          </View>
        </Pressy>
        {canPrestige && (
          <Pressy style={styles.prestigeBtn} onPress={onOpenPrestige}>
            <Text style={styles.prestigeText}>CLOSE ROUND →</Text>
          </Pressy>
        )}
        {activeEffects.length > 0 && (
          <Pressable
            style={styles.effectsChip}
            onPress={() => setBuffsOpen(true)}
          >
            <Text style={styles.effectsChipText}>
              {activeEffects.length} BUFF{activeEffects.length === 1 ? "" : "S"} ▸
            </Text>
          </Pressable>
        )}
        {debt.gt(0) && (
          <View style={styles.debtChip}>
            <Text style={styles.debtChipText}>DBT {formatNumber(debt)}</Text>
          </View>
        )}
      </View>

      <BottomAllocation allocation={allocation} onEdit={onOpenAllocate} />

      <ItemPopup item={popup} onClose={closePopup} onAction={handlePopupAction} />
      <BuffsModal visible={buffsOpen} onClose={() => setBuffsOpen(false)} />

      {/* Guided tutorial card — hide while the item popup is open so its
          BUY button isn't covered. Lives in HomeScreen (not App) so it
          also auto-hides on the Producers/Allocate/etc. sub-screens. */}
      {!popup && <Onboarding />}
    </View>
  );
}

function buildPopup(id: HitId, owned: Record<string, number>): PopupContent {
  const producerId = HIT_TO_PRODUCER[id];
  const def = producerId ? PRODUCER_BY_ID[producerId] : undefined;

  switch (id) {
    case "monitor":
      return {
        hit: id,
        kind: "action",
        title: "Training Run",
        subtitle: "ROLL THE GACHA",
        body: "Spend tokens to roll: Failed · Marginal · Solid · SOTA · Breakthrough. Pity guaranteed at 50.",
        flavor: "Just one more run, the loss curve looks weird.",
        cta: "OPEN TRAINING",
      };
    case "engineer":
      return producerCard(id, "Hire Intern", "ENGINEERS · TIER 0", owned, def, "Snacks are in the kitchen.");
    case "gpu":
      return producerCard(id, "Buy GPU", "COMPUTE · TIER 0", owned, def, "It runs hot. The room is hot.");
    case "books":
      return producerCard(id, "Buy Data", "DATA · TIER 0", owned, def, "Some of this is even labeled.");
    case "energy":
      return producerCard(id, "Buy Energy", "ENERGY · TIER 0", owned, def, "The landlord doesn't ask questions.");
    case "research":
      return {
        hit: id,
        kind: "action",
        title: "Research",
        subtitle: "EQUITY SINK",
        body: "Spend Equity on permanent multipliers. 6 branches, ~30 nodes at v1.0.",
        flavor: "Every JIRA epic has been delivered. Nobody knows what it does.",
        cta: "OPEN RESEARCH",
      };
    case "plant":
      return {
        hit: id,
        kind: "cosmetic",
        title: "Snake Plant",
        subtitle: "BACKGROUND ITEM",
        body: "Office morale +0.0%. Hard to kill.",
      };
    case "mug":
      return {
        hit: id,
        kind: "cosmetic",
        title: "Coffee Mug",
        subtitle: "OFFICE ITEM",
        body: "Still warm. The intern made it.",
      };
    case "pizza":
      return {
        hit: id,
        kind: "cosmetic",
        title: "Pizza Box",
        subtitle: "EVIDENCE",
        body: "Friday's all-hands ended at midnight. The box stayed.",
      };
    case "clock":
      return {
        hit: id,
        kind: "cosmetic",
        title: "Wall Clock",
        subtitle: "TIME PASSES",
        body: "Tick. Tick. The clock judges you.",
      };
    case "window":
      return {
        hit: id,
        kind: "cosmetic",
        title: "Window",
        subtitle: "OUTSIDE",
        body: "It's a nice day. The cloud moves like it's in a hurry.",
      };
    case "roomba":
      return {
        hit: id,
        kind: "cosmetic",
        title: "Roomba",
        subtitle: "AUTONOMOUS AGENT v0.1",
        body: "It cleans the floor. Eventually it will do more.",
      };
  }
}

function producerCard(
  id: HitId,
  title: string,
  subtitle: string,
  owned: Record<string, number>,
  def: ProducerDef | undefined,
  flavor: string,
): PopupContent {
  if (!def) {
    return { hit: id, kind: "cosmetic", title, subtitle, body: "—" };
  }
  return {
    hit: id,
    kind: "producer",
    title,
    subtitle,
    owned: owned[def.id] ?? 0,
    rate: `${def.baseOutputPerSec}`,
    cost: `${def.baseCostCapital}`,
    flavor,
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream, position: "relative" },
  sceneWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 96, // leave room for TopHUD to float over the wall
  },
  secondaryRow: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 95,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "flex-end",
    zIndex: 22,
  },
  prestigeBtn: {
    backgroundColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  prestigeText: {
    fontFamily: fonts.display,
    fontSize: 11,
    color: colors.ink,
    letterSpacing: 1,
  },
  effectsChip: {
    backgroundColor: colors.cream_hi,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.gold,
    // Pixel shadow so it reads as a button, matching the INBOX chip.
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  effectsChipText: {
    fontFamily: fonts.display,
    fontSize: 9,
    color: colors.gold_2,
    letterSpacing: 1,
  },
  debtChip: {
    backgroundColor: colors.tensionRed,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  debtChipText: {
    fontFamily: fonts.display,
    fontSize: 9,
    color: colors.cream,
    letterSpacing: 1,
  },
  inboxBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.cream_hi,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  inboxText: {
    fontFamily: fonts.display,
    fontSize: 11,
    color: colors.ink,
    letterSpacing: 1,
  },
  inboxBadge: {
    backgroundColor: colors.tensionRed,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  inboxBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.cream_hi,
    lineHeight: 13,
  },
  devChip: {
    // Just below the TopHUD (which floats top:8 and is ~120px tall), on the
    // right edge. Avoids overlapping the round label in HUD row 1 (that was
    // the original bug) and stays clear of scene hit zones, which start lower.
    position: "absolute",
    top: 140,
    right: 6,
    backgroundColor: colors.tensionRed,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.ink,
    zIndex: 90,
  },
  devChipText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.cream_hi,
    letterSpacing: 1,
  },
  sfxChip: {
    // Same right-edge column as DEV chip. Sits below it (DEV at top:140, this
    // at top:178) so they stack neatly without colliding with the tutorial
    // card on the left or the HUD above.
    position: "absolute",
    top: 178,
    right: 6,
    minWidth: 44,
    alignItems: "center",
    backgroundColor: colors.cream_hi,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.ink,
    zIndex: 90,
  },
  sfxChipText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.ink,
    letterSpacing: 1,
  },
});
