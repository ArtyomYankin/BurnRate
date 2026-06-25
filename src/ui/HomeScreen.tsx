import React from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { D } from "../core/decimal";
import { getRound } from "../core/rounds";
import { ChainId } from "../core/types";
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
import { BottomAllocation } from "./BottomAllocation";
import { BuffsModal } from "./BuffsModal";
import { HelpModal } from "./HelpModal";
import { SettingsModal } from "./SettingsModal";
import { SlackButton } from "./SlackButton";
import { formatNumber, formatRate } from "./formatNumber";
import { ItemPopup, PopupContent } from "./ItemPopup";
import { HitId, PixelScene, sceneForRound } from "./PixelScene";
import { Onboarding, tutorialHighlightForStep } from "./Onboarding";
import { useTutorialTargetMeasure } from "./TutorialSpotlight";
import { useStrings, getStrings } from "../core/i18n";
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

const HIT_TO_CHAIN: Partial<Record<HitId, ChainId>> = {
  engineer: "engineers",
  gpu:      "gpu",
  gpu2:     "gpu",
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
  const t = useStrings();
  // Forced-walkthrough target registration. The ACH chip is a Pressy here
  // (Slack and Allocate self-register inside their own components).
  const achTargetProps = useTutorialTargetMeasure("ach-btn");
  const clickToken = useGame((s) => s.clickToken);

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
  const tps = tokensPerSec(runForCalc, undefined, { equity: equityStr });

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
  const screenH = Dimensions.get("window").height;
  // Tablet (iPad etc.) detection — min-side ≥ 600px is a reliable threshold
  // across all current iPad generations and Android tablets. On tablet,
  // scene is bound by BOTH width and available height (chrome reserve ≈
  // 360px for TopHUD + secondary row + alloc bar + safe-area), whichever
  // is more restrictive — so it grows to fill the larger canvas without
  // overflowing the bottom chrome. Phones keep the original behavior:
  // width-capped at 420px, scene height free to overflow (gets clipped
  // gracefully behind the floating HUD strip).
  const isTablet = Math.min(screenW, screenH) >= 600;
  let sceneW: number;
  if (isTablet) {
    // Try width-first up to a generous cap, fall back to height-bound if
    // the resulting scene would overflow the available vertical area.
    // Chrome reserve ≈ 96 (TopHUD padding) + ~150 (bottom alloc bar +
    // secondary row + safe area). Earlier 360 was way too generous and
    // left a huge cream gap below the scene.
    const widthCap = 760;
    const sceneWByWidth = Math.min(screenW - 16, widthCap);
    const sceneHByWidth = Math.round(sceneWByWidth * (360 / 240));
    const heightAvail = screenH - 250;
    if (sceneHByWidth <= heightAvail) {
      sceneW = sceneWByWidth;
    } else {
      sceneW = Math.round(heightAvail * (240 / 360));
    }
  } else {
    sceneW = Math.min(screenW, 420);
  }
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
    // Achievement unlock — light chime cue (re-using vignette_pop's slack
    // notification sound). The old `producer_upgrade` mapping was wrong: the
    // "Advanced buy" track from the audio kit belongs on actual tier-4+
    // producer purchases, not on the achievements grid.
    if (achievementCount > prevAchievementsRef.current) audio.play("vignette_pop");
    prevAchievementsRef.current = achievementCount;
  }, [achievementCount]);
  // Dev-cheats modal. Two ways in:
  //   1. __DEV__ builds also show a visible DEV chip in the top-right.
  //   2. ALL builds (incl. release) accept the secret gesture: 7 taps on
  //      the BURN·RATE wordmark within 3 seconds. Lets us debug live builds
  //      without baking a debug-only menu into release. Players who don't
  //      know the gesture never see the panel.
  const [devOpen, setDevOpen] = React.useState(false);
  const [buffsOpen, setBuffsOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  const handleHit = (id: HitId) => {
    setActiveHit(id);
    setPopup(buildPopup(id));
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
        roundLabel={`${(t.roundNames[round.id as keyof typeof t.roundNames] ?? round.name).toUpperCase()} · ${t.topHud.round} ${round.idx + 1}`}
        capital={formatNumber(capital)}
        equity={formatNumber(equity)}
        nextThresholdLabel={
          hypeDiscount > 0.005
            ? `${t.topHud.next}: ${(t.roundNames[round.id as keyof typeof t.roundNames] ?? round.name).toUpperCase()} · ${t.topHud.hypeDiscount} -${Math.round(hypeDiscount * 100)}%`
            : `${t.topHud.next}: ${(t.roundNames[nextRound.id as keyof typeof t.roundNames] ?? nextRound.name).toUpperCase()} · 1e${nextRound.tokenThresholdLog10} ${t.topHud.tokens}`
        }
        onPressTokens={clickToken}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onSecretActivate={() => setDevOpen(true)}
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
      {/* DevPanel mounts in ALL builds — it's not the visible DEV chip that
          guards access, it's the secret 7-tap gesture on the BURN·RATE
          wordmark wired through TopHUD's onSecretActivate. The chip is just
          a shortcut for local development. */}
      <DevPanel visible={devOpen} onClose={() => setDevOpen(false)} />

      {/* Bottom row of secondary buttons — keep prestige + producers/research
          reachable even when the player ignores hit zones. Sits above the
          allocation strip. */}
      {/* Floating Slack-style inbox button (right edge, dark navy). Ported
          from design v8 — replaces the old INBOX chip in the bottom row.
          Stands out from the cream chrome on purpose: it's the player's
          notification surface. */}
      <SlackButton unread={unreadVignettes} onPress={onOpenVignettes} tutorialTargetKey="slack-btn" />

      <View style={styles.secondaryRow} pointerEvents="box-none">
        <Pressy onPress={onOpenAchievements}>
          <View
            ref={achTargetProps.ref}
            onLayout={achTargetProps.onLayout}
            style={styles.inboxBtn}
          >
            <Text style={styles.inboxText}>{t.home.ach}</Text>
            {achievementCount > 0 && (
              <View style={[styles.inboxBadge, { backgroundColor: colors.sage_2 }]}>
                <Text style={styles.inboxBadgeText}>{achievementCount}</Text>
              </View>
            )}
          </View>
        </Pressy>
        {canPrestige && (
          <Pressy style={styles.prestigeBtn} onPress={onOpenPrestige}>
            <Text style={styles.prestigeText}>{t.home.closeRound} →</Text>
          </Pressy>
        )}
        {activeEffects.length > 0 && (
          <Pressable
            style={styles.effectsChip}
            onPress={() => setBuffsOpen(true)}
          >
            <Text style={styles.effectsChipText}>
              {activeEffects.length} {activeEffects.length === 1 ? t.home.buff : t.home.buffs} ▸
            </Text>
          </Pressable>
        )}
        {debt.gt(0) && (
          <View style={styles.debtChip}>
            <Text style={styles.debtChipText}>{t.home.debt} {formatNumber(debt)}</Text>
          </View>
        )}
      </View>

      <BottomAllocation
        allocation={allocation}
        onEdit={onOpenAllocate}
        tutorialTargetKey="alloc-bar"
      />

      <ItemPopup item={popup} onClose={closePopup} onAction={handlePopupAction} />
      <BuffsModal visible={buffsOpen} onClose={() => setBuffsOpen(false)} />
      <HelpModal visible={helpOpen} onClose={() => setHelpOpen(false)} />
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Guided tutorial card — hide while the item popup is open so its
          BUY button isn't covered. Lives in HomeScreen (not App) so it
          also auto-hides on the Producers/Allocate/etc. sub-screens. */}
      {!popup && <Onboarding />}
    </View>
  );
}

function buildPopup(id: HitId): PopupContent {
  const t = getStrings();
  switch (id) {
    case "monitor":
      return {
        hit: id,
        kind: "action",
        title: t.itemPopup.monitor.title,
        subtitle: t.itemPopup.monitor.subtitle,
        body: t.itemPopup.monitor.body,
        flavor: t.itemPopup.monitor.flavor,
        cta: t.itemPopup.monitor.cta,
      };
    case "engineer":
      return chainPopup(id, t.itemPopup.engineer.title, t.itemPopup.engineer.subtitle, t.itemPopup.engineer.body, t.itemPopup.engineer.cta);
    case "gpu":
      return chainPopup(id, t.itemPopup.gpu.title, t.itemPopup.gpu.subtitle, t.itemPopup.gpu.body, t.itemPopup.gpu.cta);
    case "books":
      return chainPopup(id, t.itemPopup.data.title, t.itemPopup.data.subtitle, t.itemPopup.data.body, t.itemPopup.data.cta);
    case "energy":
      return chainPopup(id, t.itemPopup.energy.title, t.itemPopup.energy.subtitle, t.itemPopup.energy.body, t.itemPopup.energy.cta);
    case "research":
      return {
        hit: id,
        kind: "action",
        title: t.itemPopup.research.title,
        subtitle: t.itemPopup.research.subtitle,
        body: t.itemPopup.research.body,
        flavor: t.itemPopup.research.flavor,
        cta: t.itemPopup.research.cta,
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
    case "emptyseat":
      return {
        hit: id,
        kind: "cosmetic",
        title: "Vacated Workstation",
        subtitle: "HEADCOUNT · AUTOMATED",
        body: "A Distinguished Engineer occupied this pod. Their sabbatical became permanent the day the model passed their own code review. The succulent is thriving.",
      };
    case "courtyard":
      return {
        hit: id,
        kind: "cosmetic",
        title: "Outdoor Courtyard",
        subtitle: "EMPLOYEE WELLNESS · TIER 4",
        body: "Designed by the same firm that did Apple Park. The hammock has a 2-week waitlist. Nobody actually goes outside; the trees were a leasing-incentive line item.",
      };
    case "bar":
      return {
        hit: id,
        kind: "cosmetic",
        title: "Open Bar",
        subtitle: "PERK · ALWAYS-ON",
        body: "Top-shelf liquor, hand-pulled beer, signature cocktails — all free, all day. People used to celebrate shipping. Now they drink while the model ships for them.",
      };
    case "lake":
      return {
        hit: id,
        kind: "cosmetic",
        title: "Lakeside Deck",
        subtitle: "FOCUS ZONE · OUTDOORS",
        body: "Cedar planking, glass railing, a single Adirondack chair facing the water. The laptop on his lap is asleep. He has been reviewing the same Notion doc for forty minutes.",
      };
    case "agent_monitor":
      return {
        hit: id,
        kind: "cosmetic",
        title: "Autonomous Agent — Active",
        subtitle: "STAFF ENGINEER · v4.2",
        body: "Last week this seat held a Staff Engineer with twelve years of distributed-systems experience. Today his calendar reads \"sabbatical (open-ended)\" and the agent ships his JIRA tickets 4× faster. HR called it a \"win-win.\" His Slack still says \"on PTO, back Monday.\" It has said that for forty-one Mondays.",
      };
    case "gpu2":
      return chainPopup(
        id,
        "Buy GPU",
        "COMPUTE · CONTINENT-SCALE",
        "Another row of mainframes, end to end. The facility footprint is now visible from orbit. Someone made it the desktop wallpaper.",
        "OPEN GPU",
      );
    case "catwalk":
      return {
        hit: id,
        kind: "cosmetic",
        title: "The Inspector",
        subtitle: "CATWALK ROUNDS · HI-VIS VEST",
        body: "A single silhouette walks the catwalk above the mainframes with a scanner. Nobody is sure who employs them. They have a badge. The badge works.",
      };
  }
}

/**
 * Generic chain popup — replaces the old per-tier producerCard that lied
 * about tier-0 costs/output in late-game scenes. Shows just chain name +
 * a one-line description, with a button that routes to the full Producers
 * screen where actual per-tier prices are honest.
 */
function chainPopup(
  hit: HitId,
  title: string,
  subtitle: string,
  body: string,
  cta: string,
): PopupContent {
  return { hit, kind: "action", title, subtitle, body, cta };
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
    // paddingLeft slightly tighter than paddingRight to compensate for the
    // trailing letterSpacing on the text — without the extra right room, iOS
    // clips the final glyph (the "H" in ACH).
    paddingLeft: 10,
    paddingRight: 14,
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
    // Hairline padding-right inside the Text itself in case the wrapper still
    // measures tight on certain glyphs. Belt-and-suspenders with the button
    // padding above.
    paddingRight: 2,
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
    fontFamily: fonts.mono,
    fontSize: 13,
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
    // Asymmetric padding: trailing letterSpacing on the "V" needs extra room
    // or iOS clips the right side of the glyph (same issue as the ACH chip).
    paddingLeft: 6,
    paddingRight: 10,
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
    paddingRight: 2,
  },
});
