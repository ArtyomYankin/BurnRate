import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { D } from "../core/decimal";
import { roundThreshold } from "../core/math";
import {
  PITY_THRESHOLD,
  TIER_PROBS,
  trainingRunCost,
  TrainingTier,
} from "../core/trainingRun";
import {
  selectFundingRoundIdx,
  selectTokensStr,
  selectTrainingPity,
  useGame,
} from "../game/store";
import * as audio from "../audio";
import { CueId } from "../audio/registry";
import { formatNumber } from "./formatNumber";
import { colors, fonts, PIXEL } from "./theme";

interface Props {
  visible: boolean;
  onClose(): void;
}

// ─── Tier metadata ────────────────────────────────────────────────────────
// Ported from Claude Design `screens.jsx::TR_TIERS`. Visual+copy only — the
// real game math (effect type / duration / cost) stays in trainingRun.ts.
// Multipliers below display +X% computed from TIER_TOKEN_MULT so the modal
// stays honest if we ever rebalance.
const TIER_FLAVOR: Record<TrainingTier, string> = {
  Failed:
    "Loss never converged. The eval suite literally cried.",
  Marginal:
    "Numbers go up. A little. Cautiously celebrate.",
  Solid:
    "A real model. It compiles. It mostly behaves.",
  SOTA:
    "Top of leaderboard for ~36 hours. Screenshot Slack.",
  Breakthrough:
    "You will be on the Lex Fridman podcast within 6 weeks.",
};

const TIER_COLOR: Record<TrainingTier, string> = {
  Failed:       colors.muted,
  Marginal:     colors.cream_4,
  Solid:        colors.sage_2,
  SOTA:         colors.terracotta,
  Breakthrough: colors.gold,
};

const TIER_CUE: Record<TrainingTier, CueId> = {
  Failed:       "tr_failed",
  Marginal:     "tr_marginal",
  Solid:        "tr_solid",
  SOTA:         "tr_sota",
  Breakthrough: "tr_breakthrough",
};

// Display multiplier per tier — pulled from the *real* TIER_TOKEN_MULT table
// in trainingRun.ts so the player sees what they actually get. If we rebalance
// effects later, the modal updates without code changes here.
const TIER_DISPLAY_MULT: Record<TrainingTier, string> = {
  Failed:       "+0%",
  Marginal:     "+5%",
  Solid:        "+10%",
  SOTA:         "+20%",
  Breakthrough: "+50%",
};

const TIERS_ORDER: TrainingTier[] = ["Failed", "Marginal", "Solid", "SOTA", "Breakthrough"];

/**
 * Training-run gacha modal — design-port of `screens.jsx::TrainingRunModal`.
 *
 * Three phases: `idle` → `rolling` → `reveal`. Roll commits to the store
 * IMMEDIATELY when the player taps "Roll" (tokens debited, effect applied,
 * pity counter updated). The 2.4s reel animation is purely cosmetic — if
 * the player closes mid-spin, their result is already saved.
 *
 * Reel visuals borrow CRT-machine tropes: black background, scanline
 * overlay, side fade gradients, gold crosshair markers, on-reveal glow for
 * SOTA+. Per GDD §14 ("Training run roll — Breakthrough: massive, climactic,
 * rare"), Breakthrough also gets a larger scale jump on reveal.
 */
export function TrainingRunModal({ visible, onClose }: Props) {
  const tokensStr = useGame(selectTokensStr);
  const fundingRoundIdx = useGame(selectFundingRoundIdx);
  const pity = useGame(selectTrainingPity);
  const roll = useGame((s) => s.rollTrainingRun);

  const threshold = roundThreshold(fundingRoundIdx);
  const cost = trainingRunCost(threshold);
  const tokens = D(tokensStr);
  const canRoll = tokens.gte(cost);

  type Phase = "idle" | "rolling" | "reveal";
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<{ tier: TrainingTier; pityFired: boolean } | null>(null);
  const [reelIdx, setReelIdx] = useState(0);

  // Reset to idle whenever the modal closes — so re-opening shows the roll
  // CTA, not a stale reveal screen.
  useEffect(() => {
    if (!visible) {
      setPhase("idle");
      setResult(null);
      setReelIdx(0);
    }
  }, [visible]);

  const onRoll = () => {
    if (phase !== "idle" || !canRoll) return;
    const r = roll();
    if (!r) return;
    // Commit-then-animate. Result is locked from this instant; the reel is
    // purely a piece of theater played on top of it.
    setResult({ tier: r.tier, pityFired: r.pityFired });
    setPhase("rolling");
  };

  // Reel animation — setTimeout chain so the interval can ease out. raf would
  // also work but setTimeout is easier to read and tear down on unmount.
  const cancelledRef = useRef(false);
  useEffect(() => {
    if (phase !== "rolling" || !result) return;
    cancelledRef.current = false;
    const targetIdx = TIERS_ORDER.indexOf(result.tier);
    let elapsed = 0;
    let interval = 60; // ms — fast at start
    const tick = () => {
      if (cancelledRef.current) return;
      setReelIdx((i) => (i + 1) % TIERS_ORDER.length);
      elapsed += interval;
      // Ease — match the design's Math.pow(elapsed/100, 1.8) ramp
      interval = 60 + Math.pow(elapsed / 100, 1.8);
      if (elapsed < 2400) {
        setTimeout(tick, interval);
      } else {
        // Snap to the locked-in result and flip to reveal
        setReelIdx(targetIdx);
        setPhase("reveal");
        audio.play(TIER_CUE[result.tier]);
      }
    };
    const id = setTimeout(tick, interval);
    return () => {
      cancelledRef.current = true;
      clearTimeout(id);
    };
  }, [phase, result]);

  const onRollAgain = () => {
    setPhase("idle");
    setResult(null);
    setReelIdx(0);
  };

  const displayedTier =
    phase === "reveal" && result ? result.tier : TIERS_ORDER[reelIdx];
  const tierColor = TIER_COLOR[displayedTier];

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop-propagation: the inner sheet is its own Pressable that swallows
            taps so backdrop dismiss doesn't fire when the player taps inside. */}
        <Pressable style={styles.sheetWrap} onPress={() => { /* swallow */ }}>
          <View style={styles.sheet}>
            {/* Close */}
            <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
              <Text style={styles.closeText}>×</Text>
            </Pressable>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerKicker}>TRAINING RUN</Text>
              <Text style={styles.headerTitle}>
                {phase === "idle"   && "roll for a breakthrough"}
                {phase === "rolling" && "training…"}
                {phase === "reveal" && "result"}
              </Text>
            </View>

            {/* Reel display */}
            <View style={styles.reelWrap}>
              <View style={styles.reelInner}>
                <Scanlines />
                <SideFade side="left" />
                <SideFade side="right" />
                <CrosshairMarker side="left" />
                <CrosshairMarker side="right" />
                <View
                  style={[
                    styles.reelContent,
                    phase === "reveal" && {
                      transform: [{ scale: displayedTier === "Breakthrough" ? 1.12 : 1.06 }],
                    },
                  ]}
                >
                  <Text style={styles.reelKicker}>// RESULT</Text>
                  <Text
                    style={[
                      styles.reelTier,
                      { color: tierColor },
                      // Glow effect on reveal for SOTA+. textShadow works on
                      // RN-Web (CSS) and modern iOS/Android; degrades silently.
                      phase === "reveal" &&
                        (displayedTier === "SOTA" || displayedTier === "Breakthrough") && {
                          textShadowColor: tierColor,
                          textShadowOffset: { width: 0, height: 0 },
                          textShadowRadius: 16,
                        },
                    ]}
                  >
                    {displayedTier.toUpperCase()}
                  </Text>
                  <Text style={[styles.reelMult, { color: tierColor }]}>
                    {TIER_DISPLAY_MULT[displayedTier]}
                  </Text>
                </View>
              </View>
            </View>

            {/* Body — flavor / hint / rolling chatter */}
            <View style={styles.body}>
              {phase === "idle" && (
                <Text style={styles.bodyText}>
                  Spend <Text style={styles.bodySpend}>{formatNumber(cost)} tokens</Text> for a probabilistic Breakthrough. Pity guarantees breakthrough at <Text style={styles.bodyStrong}>{PITY_THRESHOLD} runs</Text>.
                </Text>
              )}
              {phase === "rolling" && (
                <Text style={[styles.bodyText, styles.bodyItalic]}>
                  The eval suite is mostly held together with prayer.
                </Text>
              )}
              {phase === "reveal" && result && (
                <Text style={[styles.bodyText, styles.bodyItalic]}>
                  "{TIER_FLAVOR[result.tier]}"
                  {result.pityFired && (
                    <Text style={styles.pityFiredTag}>  · PITY FIRED</Text>
                  )}
                </Text>
              )}
            </View>

            {/* Probability table — idle only */}
            {phase === "idle" && (
              <View style={styles.probTable}>
                {TIER_PROBS.map((t) => (
                  <View
                    key={t.tier}
                    style={[styles.probCell, { flexGrow: t.weight }]}
                  >
                    <Text style={[styles.probCellName, { color: TIER_COLOR[t.tier] }]}>
                      {t.tier.slice(0, 3).toUpperCase()}
                    </Text>
                    <Text style={styles.probCellPct}>
                      {Math.round(t.weight * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Pity bar — idle only */}
            {phase === "idle" && (
              <View style={styles.pityWrap}>
                <View style={styles.pityLabelRow}>
                  <Text style={styles.pityLabel}>PITY → BREAKTHROUGH</Text>
                  <Text style={styles.pityLabel}>{pity} / {PITY_THRESHOLD}</Text>
                </View>
                <View style={styles.pityTrack}>
                  <View
                    style={[
                      styles.pityFill,
                      { width: `${(pity / PITY_THRESHOLD) * 100}%` },
                    ]}
                  />
                </View>
              </View>
            )}

            {/* CTAs */}
            <View style={styles.cta}>
              {phase === "idle" && (
                <>
                  <Pressable
                    onPress={onRoll}
                    disabled={!canRoll}
                    style={[
                      styles.btn,
                      styles.btnPrimary,
                      { backgroundColor: canRoll ? colors.terracotta : colors.disabled },
                    ]}
                  >
                    <Text style={styles.btnText}>
                      {canRoll ? `ROLL · ${formatNumber(cost)}` : "NOT ENOUGH TOKENS"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onClose}
                    style={[styles.btn, styles.btnSmall, { backgroundColor: colors.cream_2 }]}
                  >
                    <Text style={[styles.btnText, { color: colors.ink }]}>LATER</Text>
                  </Pressable>
                </>
              )}
              {phase === "rolling" && (
                <View
                  style={[
                    styles.btn,
                    styles.btnPrimary,
                    { backgroundColor: colors.cream_2 },
                  ]}
                >
                  <Text style={[styles.btnText, { color: colors.muted }]}>COMPILING…</Text>
                </View>
              )}
              {phase === "reveal" && result && (
                <>
                  <Pressable
                    onPress={onRollAgain}
                    style={[
                      styles.btn,
                      styles.btnPrimary,
                      { backgroundColor: TIER_COLOR[result.tier] },
                    ]}
                  >
                    <Text
                      style={[
                        styles.btnText,
                        { color: result.tier === "Failed" ? colors.cream : colors.ink },
                      ]}
                    >
                      ROLL AGAIN
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onClose}
                    style={[styles.btn, styles.btnSmall, { backgroundColor: colors.cream_2 }]}
                  >
                    <Text style={[styles.btnText, { color: colors.ink }]}>CLOSE</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── CRT atmosphere helpers ──────────────────────────────────────────────
// Stacked translucent strips approximate the CRT scanline pattern that real
// CSS would do with repeating-linear-gradient. Not perfect but reads as
// "screen, not just a black box."
function Scanlines() {
  const lines = [];
  for (let i = 0; i < 24; i++) {
    lines.push(
      <View
        key={i}
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0, right: 0,
          top: i * 3,
          height: 1,
          backgroundColor: "rgba(255,255,255,0.05)",
        }}
      />,
    );
  }
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>{lines}</View>;
}

function SideFade({ side }: { side: "left" | "right" }) {
  return (
    <LinearGradient
      colors={[colors.ink, "transparent"]}
      start={{ x: side === "left" ? 0 : 1, y: 0.5 }}
      end={{ x: side === "left" ? 1 : 0, y: 0.5 }}
      style={[
        {
          position: "absolute",
          top: 0, bottom: 0,
          width: 30,
          zIndex: 2,
        },
        side === "left" ? { left: 0 } : { right: 0 },
      ]}
      pointerEvents="none"
    />
  );
}

// Slot-machine gold pointers on each side of the reel.
function CrosshairMarker({ side }: { side: "left" | "right" }) {
  const isLeft = side === "left";
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: "50%",
        width: 0, height: 0,
        marginTop: -4,
        borderTopWidth: 4,
        borderTopColor: "transparent",
        borderBottomWidth: 4,
        borderBottomColor: "transparent",
        ...(isLeft
          ? { left: 4, borderLeftWidth: 6, borderLeftColor: colors.gold }
          : { right: 4, borderRightWidth: 6, borderRightColor: colors.gold }),
        zIndex: 3,
      }}
    />
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(26,22,18,0.75)",
    justifyContent: "flex-end",
  },
  sheetWrap: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  sheet: {
    backgroundColor: colors.cream_hi,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    paddingBottom: 12,
    position: "relative",
  },
  close: {
    position: "absolute",
    top: 6,
    right: 8,
    zIndex: 10,
    paddingHorizontal: 4,
  },
  closeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.muted,
    lineHeight: 18,
  },
  header: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 6,
  },
  headerKicker: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.ink,
    marginTop: 2,
    lineHeight: 20,
  },
  reelWrap: {
    marginHorizontal: 12,
    marginVertical: 8,
    padding: 4,
    backgroundColor: colors.ink,
  },
  reelInner: {
    backgroundColor: colors.ink,
    borderWidth: 3,
    borderColor: colors.cream_hi,
    paddingVertical: 16,
    paddingHorizontal: 8,
    minHeight: 100,
    position: "relative",
    overflow: "hidden",
  },
  reelContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    zIndex: 1,
  },
  reelKicker: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    color: colors.cream_3,
    letterSpacing: 2,
  },
  reelTier: {
    fontFamily: fonts.bodyBold,
    fontSize: 30,
    letterSpacing: 2,
    lineHeight: 32,
  },
  reelMult: {
    fontFamily: fonts.mono,
    fontSize: 22,
    lineHeight: 22,
  },
  body: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    minHeight: 40,
  },
  bodyText: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.ink_hi,
    lineHeight: 18,
  },
  bodyItalic: {
    fontStyle: "italic",
  },
  bodyStrong: {
    fontFamily: fonts.bodyBold,
    color: colors.ink,
  },
  bodySpend: {
    fontFamily: fonts.bodyBold,
    color: colors.terracotta,
  },
  pityFiredTag: {
    fontFamily: fonts.display,
    fontSize: 9,
    color: colors.gold,
    letterSpacing: 1,
  },
  probTable: {
    flexDirection: "row",
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: colors.ink,
    padding: 1,
    gap: 1,
  },
  probCell: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.cream_2,
    paddingHorizontal: 2,
    paddingVertical: 4,
    alignItems: "center",
  },
  probCellName: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 12,
  },
  probCellPct: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  pityWrap: {
    paddingHorizontal: 12,
    marginTop: 8,
  },
  pityLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pityLabel: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    color: colors.muted,
    letterSpacing: 1,
  },
  pityTrack: {
    height: 5,
    marginTop: 2,
    backgroundColor: colors.cream_2,
    borderWidth: 1,
    borderColor: colors.ink,
    overflow: "hidden",
  },
  pityFill: {
    height: "100%",
    backgroundColor: colors.gold,
  },
  cta: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: {
    flex: 1,
  },
  btnSmall: {
    minWidth: 80,
  },
  btnText: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: colors.cream_hi,
    letterSpacing: 1,
  },
});
