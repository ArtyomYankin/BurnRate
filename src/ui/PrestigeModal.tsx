import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { D } from "../core/decimal";
import {
  effectiveRoundThreshold,
  equityFromPrestige,
  hypeThresholdDiscount,
  roundThreshold,
} from "../core/math";
import { getRound, LAST_ROUND_IDX } from "../core/rounds";
import { useGame } from "../game/store";
import * as audio from "../audio";
import { transitionCueForRound } from "../audio";
import { useStrings } from "../core/i18n";
import { formatNumber } from "./formatNumber";
import { ParticleBurst } from "./ParticleBurst";
import { colors, fonts, PIXEL } from "./theme";

interface Props {
  visible: boolean;
  onClose(): void;
}

/**
 * End-of-round modal. Port of Claude Design `sub-screens.jsx::PrestigeModal`
 * (pixel-art mock). Layout top→bottom: gold ribbon banner, current-round
 * recap, ink-bg Equity payout block (with the GDD §8 formula), a
 * RESET/PERSISTS breakdown so the player knows what survives prestige, a
 * terracotta next-round preview, and two CTAs.
 *
 * The action layer (`prestige()` from the store + ParticleBurst celebration)
 * stays the same as the previous version; only the chrome was redesigned.
 */
export function PrestigeModal({ visible, onClose }: Props) {
  const t = useStrings();
  const run = useGame((s) => s.run);
  const prestige = useGame((s) => s.prestige);

  const round = getRound(run.fundingRoundIdx);
  const atFinalRound = run.fundingRoundIdx >= LAST_ROUND_IDX;
  // Finale UI: every time the player closes AGI Singularity (not just the
  // first), show the stripped-down OK variant. The full Equity / Reset
  // breakdown isn't meaningful on a perpetual final round — there's no
  // "next round" to preview. The endgame modal opens after, which always
  // re-shows: the climax beat shouldn't be one-shot just because we want
  // to suppress a future banner.
  const isFinale = atFinalRound;
  const nextRound = getRound(Math.min(run.fundingRoundIdx + 1, LAST_ROUND_IDX));

  const award = equityFromPrestige(run);
  const baseThreshold = roundThreshold(run.fundingRoundIdx);
  const effThreshold = effectiveRoundThreshold(run.fundingRoundIdx, run.hype);
  const hypeDiscount = hypeThresholdDiscount(run.fundingRoundIdx, run.hype);
  const tokens = D(run.tokens);
  // Threshold overshoot — what the design shows as "247% threshold". Computed
  // against the EFFECTIVE bar so a Hype-heavy close reads as "you cleared the
  // discounted bar by N%."
  const overshootPct = effThreshold.gt(0)
    ? Math.max(0, Math.round(tokens.div(effThreshold).toNumber() * 100))
    : 0;

  const [burst, setBurst] = useState(0);

  // Reset burst counter when the modal opens so the burst can fire again on
  // subsequent prestiges in the same session.
  useEffect(() => {
    if (visible) setBurst(0);
  }, [visible]);

  const confirm = () => {
    const closingRound = run.fundingRoundIdx;
    prestige();
    audio.play("fund_round_close");
    // Era-appropriate transition stinger fires alongside the close beat —
    // early/mid/late give the moment thematic weight as the player moves
    // through the round buckets.
    const stinger = transitionCueForRound(closingRound);
    if (stinger) setTimeout(() => audio.play(stinger), 400);
    setBurst((n) => n + 1);
    // Let the confetti play before the modal fades. 720ms matches ParticleBurst's
    // default duration.
    setTimeout(onClose, 720);
  };

  const localRoundName = t.roundNames[round.id as keyof typeof t.roundNames] ?? round.name;
  const closeCtaLabel = atFinalRound
    ? `${t.prestige.loopAgi} →`
    : `${t.prestige.closeVerb} ${localRoundName} →`;

  // Finale-first-close: stripped-down modal — ribbon + single OK. The full
  // payout / breakdown copy lives inside the EndgameModal that takes over
  // immediately on confirm. Keeping PrestigeModal here as a one-tap gate
  // (rather than auto-routing to EndgameModal) preserves the "I closed the
  // last round" beat without burying the player in two stacked modals.
  if (isFinale) {
    return (
      <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={styles.frame}>
            <View style={styles.ribbon}>
              <Text style={styles.ribbonText}>{t.prestige.ribbonAgiClosed}</Text>
            </View>
            <View style={styles.section}>
              <Text style={styles.eyebrow}>{t.prestige.closingRound} {round.idx + 1}</Text>
              <Text style={styles.roundName}>{localRoundName.toUpperCase()}</Text>
              <Text style={styles.recapMono}>
                {formatNumber(tokens)} {t.prestige.tokens} · {overshootPct}{t.prestige.overshootSuffix}
              </Text>
              <Text style={[styles.eyebrow, { marginTop: 12, textAlign: "center" }]}>
                {t.prestige.incomingTransmission}
              </Text>
            </View>
            <View style={[styles.ctaRow, { justifyContent: "center" }]}>
              <Pressable onPress={confirm} style={[styles.btnPrimary, { flex: 0, paddingHorizontal: 48 }]}>
                <Text style={styles.btnPrimaryText}>{t.prestige.okBtn}</Text>
                <ParticleBurst
                  trigger={burst}
                  count={28}
                  palette={[colors.gold, "#E8C25F", colors.cream, colors.terracotta]}
                  spread={120}
                  duration={900}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.frame}>
          {/* Gold ribbon banner */}
          <View style={styles.ribbon}>
            <Text style={styles.ribbonText}>{t.prestige.ribbonFundingComplete}</Text>
          </View>

          {/* Current round recap */}
          <View style={styles.section}>
            <Text style={styles.eyebrow}>{t.prestige.closingRound} {round.idx + 1}</Text>
            <Text style={styles.roundName}>{localRoundName.toUpperCase()}</Text>
            <Text style={styles.recapMono}>
              {formatNumber(tokens)} {t.prestige.tokens} · {overshootPct}{t.prestige.overshootSuffix}
            </Text>
            {hypeDiscount > 0.005 && (
              <Text style={styles.hypeLine}>
                {t.prestige.hypeDiscountLine} · -{Math.round(hypeDiscount * 100)}{t.prestige.overshootSuffix}
              </Text>
            )}
          </View>

          {/* Equity payout block — ink bg, gold number */}
          <View style={styles.sectionTight}>
            <View style={styles.equityBlock}>
              <Text style={styles.equityLabel}>{t.prestige.equityLabel}</Text>
              <Text style={styles.equityValue}>+ {formatNumber(award)}</Text>
              <Text style={styles.equityFormula}>
                floor(150 × √(tokens / threshold) × {round.equityMult.toFixed(2)})
              </Text>
            </View>
          </View>

          {/* RESET / PERSISTS breakdown */}
          <View style={styles.section}>
            <Text style={styles.subHeader}>{t.prestige.whatHappens}</Text>
            <ResetRow label={t.prestige.rowTokens}    state="reset"   accent={colors.muted} />
            <ResetRow label={t.prestige.rowCapital}   state="reset"   accent={colors.muted} />
            <ResetRow label={t.prestige.rowProducers} state="reset"   accent={colors.muted} />
            <ResetRow label={t.prestige.rowEquity}    state="persist" accent={colors.gold} />
            <ResetRow label={t.prestige.rowResearch}  state="persist" accent={colors.sage_2} />
            <ResetRow label={t.prestige.rowDebt}      state="persist" accent={colors.tensionRed} />
          </View>

          {/* Next round preview — terracotta bg */}
          <View style={styles.sectionTight}>
            <View style={styles.nextBlock}>
              <Text style={styles.nextLabel}>{t.prestige.nextRound}</Text>
              {atFinalRound ? (
                <>
                  <Text style={styles.nextName}>{t.prestige.singularityLoop}</Text>
                  <Text style={styles.nextMeta}>{t.prestige.singularitySub}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.nextName}>{(t.roundNames[nextRound.id as keyof typeof t.roundNames] ?? nextRound.name).toUpperCase()}</Text>
                  <Text style={styles.nextMeta}>
                    1e{nextRound.tokenThresholdLog10} {t.prestige.nextThresholdSuffix} · ×{nextRound.equityMult.toFixed(2)} {t.prestige.nextEquityMult}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* CTAs */}
          <View style={styles.ctaRow}>
            <Pressable onPress={onClose} style={styles.btnSecondary}>
              <Text style={styles.btnSecondaryText}>{t.prestige.notYet}</Text>
            </Pressable>
            <Pressable onPress={confirm} style={styles.btnPrimary}>
              <Text style={styles.btnPrimaryText}>{closeCtaLabel}</Text>
              <ParticleBurst
                trigger={burst}
                count={28}
                palette={[colors.gold, "#E8C25F", colors.cream, colors.terracotta]}
                spread={120}
                duration={900}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ResetRow({
  label,
  state,
  accent,
}: {
  label: string;
  state: "reset" | "persist";
  accent: string;
}) {
  const t = useStrings();
  const isReset = state === "reset";
  return (
    <View style={styles.resetRow}>
      <View style={[styles.resetSwatch, { backgroundColor: accent }]} />
      <Text style={styles.resetLabel}>{label}</Text>
      <View
        style={[
          styles.resetBadge,
          {
            borderColor: accent,
            backgroundColor: isReset ? colors.cream_2 : colors.cream_hi,
          },
        ]}
      >
        <Text style={[styles.resetBadgeText, { color: isReset ? colors.muted : accent }]}>
          {isReset ? t.prestige.resetTag : t.prestige.persistTag}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20,18,12,0.85)",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  frame: {
    backgroundColor: colors.cream_hi,
    borderWidth: 1,
    borderColor: colors.ink,
    // Pixel-box: hard ink-offset shadow, no blur.
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    maxWidth: 380,
    alignSelf: "center",
    width: "100%",
    overflow: "hidden",
  },
  ribbon: {
    backgroundColor: colors.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  ribbonText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: colors.ink_2,
    letterSpacing: 2,
    textAlign: "center",
  },
  section: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  sectionTight: {
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 4,
  },
  eyebrow: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1.5,
  },
  roundName: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.ink,
    lineHeight: 26,
    marginTop: 4,
    letterSpacing: 1,
  },
  recapMono: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.sage_2,
    marginTop: 2,
  },
  hypeLine: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.gold_2,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  equityBlock: {
    backgroundColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  equityLabel: {
    fontFamily: fonts.display,
    fontSize: 9,
    color: colors.cream_3,
    letterSpacing: 2,
  },
  equityValue: {
    fontFamily: fonts.mono,
    fontSize: 36,
    color: colors.gold_hi,
    lineHeight: 36,
    marginTop: 4,
    letterSpacing: 0,
  },
  equityFormula: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    color: colors.cream_3,
    letterSpacing: 1,
    marginTop: 4,
    textAlign: "center",
  },
  subHeader: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  resetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  resetSwatch: {
    width: 8,
    height: 8,
  },
  resetLabel: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.ink,
  },
  resetBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
  },
  resetBadgeText: {
    fontFamily: fonts.display,
    fontSize: 8,
    letterSpacing: 1,
  },
  nextBlock: {
    backgroundColor: colors.terracotta,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  nextLabel: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    color: colors.cream_3,
    letterSpacing: 1.5,
  },
  nextName: {
    fontFamily: fonts.display,
    fontSize: 16,
    color: colors.cream_hi,
    lineHeight: 18,
    marginTop: 2,
    letterSpacing: 1,
  },
  nextMeta: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.cream_2,
    marginTop: 2,
  },
  ctaRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
  },
  btnSecondary: {
    width: 96,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream_2,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  btnSecondaryText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.gold,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    overflow: "hidden",
  },
  btnPrimaryText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
  },
});
