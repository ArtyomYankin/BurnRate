import React from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Bell } from "lucide-react-native";
import { colors, fonts, PIXEL } from "./theme";
import { TutorialTargetKey } from "./tutorialTargets";
import { useTutorialTargetMeasure } from "./TutorialSpotlight";

interface Props {
  tokens: string;
  rate: string;
  pct: number;
  roundLabel: string;
  capital: string;
  equity: string;
  nextThresholdLabel: string;
  /** Optional: called when player taps the big token counter. Genre-standard
   *  "click for +1 token" affordance — relevant early, irrelevant once
   *  passive rate dwarfs +1/tap. */
  onPressTokens?(): void;
  /** Opens the Settings menu (sfx / music / language). Rendered as a small
   *  gear icon in the HUD's top-right. */
  onOpenSettings?(): void;
  /** Opens the HelpModal ("How it works"). Rendered as a small ? icon next
   *  to the gear. */
  onOpenHelp?(): void;
  /** Fired when the player taps the BURN·RATE wordmark 7 times within 3
   *  seconds. The secret gesture to open the developer cheat panel — works
   *  in release builds so we can debug live, but invisible to normal play. */
  onSecretActivate?(): void;
  /** Opens the Vignettes inbox. Bell icon in HUD's top-right chrome, with
   *  an unread badge that pulses. Formerly a floating absolute-positioned
   *  button; embedded into HUD so we don't fight scene items for the
   *  upper-left corner across 8 scenes with different landmarks. */
  onOpenInbox?(): void;
  /** Unread vignette count — badge shown on the bell when > 0. */
  unreadVignettes?: number;
  /** Tutorial spotlight target for the bell (forced walkthrough anchors
   *  its highlight ring on this key's measured rect). */
  inboxTutorialTargetKey?: TutorialTargetKey;
}

/**
 * Floating glass HUD strip, ported from Claude Design `screens.jsx::TopHUD`.
 *
 * Sits above the pixel scene with absolute positioning + a 1px ink outline
 * and a 2px ink bottom-shadow (the "pixel box" pattern from the mock — same
 * shape as our PixelFrame but inlined here so we can absolutely position
 * everything inside without paying for the corner-cutout views).
 */
export function TopHUD({
  tokens,
  rate,
  pct,
  roundLabel,
  capital,
  equity,
  nextThresholdLabel,
  onPressTokens,
  onOpenSettings,
  onOpenHelp,
  onSecretActivate,
  onOpenInbox,
  unreadVignettes = 0,
  inboxTutorialTargetKey,
}: Props) {
  // Tutorial spotlight registration for the bell. Only wire the hook if a
  // key was provided — passing an empty string would still register.
  const bellTargetHook = useTutorialTargetMeasure(
    inboxTutorialTargetKey ?? ("slack-btn" as TutorialTargetKey),
  );
  // Unread-badge pulse. Runs only while there's actually an unread count so
  // no idle animation frames burn when the inbox is empty.
  const pulse = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (unreadVignettes <= 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [unreadVignettes, pulse]);
  // Secret-tap detector for the dev cheat panel. Counts taps on the BURN·RATE
  // wordmark; if 7 land within 3 seconds, fire onSecretActivate. The window
  // resets on the next tap after a 3-second gap so we don't accumulate stale
  // taps from minutes ago.
  const tapCount = React.useRef(0);
  const tapWindowStart = React.useRef(0);
  const onBrandTap = () => {
    const now = Date.now();
    if (now - tapWindowStart.current > 3000) {
      tapCount.current = 1;
      tapWindowStart.current = now;
      return;
    }
    tapCount.current += 1;
    if (tapCount.current >= 7) {
      tapCount.current = 0;
      tapWindowStart.current = 0;
      onSecretActivate?.();
    }
  };
  // Floating "+1" feedback — animates each tap. We keep a small queue (max
  // 4) of in-flight floaters so rapid taps still feel responsive without
  // burning frame time on dozens of animated nodes.
  const [floaters, setFloaters] = React.useState<{ id: number }[]>([]);
  const nextId = React.useRef(0);
  const onTapTokens = () => {
    onPressTokens?.();
    const id = nextId.current++;
    setFloaters((f) => (f.length >= 4 ? [...f.slice(1), { id }] : [...f, { id }]));
    setTimeout(() => {
      setFloaters((f) => f.filter((x) => x.id !== id));
    }, 750);
  };

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.box}>
        {/* Row 1 — brand + round badge + nav icons (gear / ?). The icons
            sit at the very top-right of the HUD strip so they're reachable
            from the home position without crowding the bottom of the screen. */}
        <View style={styles.row}>
          <Pressable onPress={onBrandTap} hitSlop={6}>
            <Text style={styles.brand}>
              BURN<Text style={{ color: colors.terracotta }}>·</Text>RATE
            </Text>
          </Pressable>
          <View style={styles.row1Right}>
            {/* roundLabel shrinks + truncates with ellipsis when the round
                name is long (AGI Singularity Round · Round 10 etc), so the
                gear / ? icons always stay reachable on the right edge. */}
            <Text
              style={styles.roundLabel}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {roundLabel}
            </Text>
            {onOpenInbox && (
              <Pressable
                ref={bellTargetHook.ref}
                onLayout={bellTargetHook.onLayout}
                onPress={onOpenInbox}
                hitSlop={6}
                style={styles.navIconBtn}
              >
                <Bell size={14} color={colors.ink} strokeWidth={2.25} />
                {unreadVignettes > 0 && (
                  <Animated.View style={[styles.bellBadge, { transform: [{ scale: pulse }] }]}>
                    <Text style={styles.bellBadgeText}>
                      {unreadVignettes > 9 ? "9+" : unreadVignettes}
                    </Text>
                  </Animated.View>
                )}
              </Pressable>
            )}
            {onOpenSettings && (
              <Pressable onPress={onOpenSettings} hitSlop={6} style={styles.navIconBtn}>
                <Svg width={16} height={16} viewBox="0 0 16 16">
                  <Path d="M7 0 H9 V2 H7 Z M7 14 H9 V16 H7 Z M0 7 H2 V9 H0 Z M14 7 H16 V9 H14 Z" fill={colors.ink} />
                  <Path d="M2 2 H4 V4 H2 Z M12 2 H14 V4 H12 Z M2 12 H4 V14 H2 Z M12 12 H14 V14 H12 Z" fill={colors.ink} />
                  <Circle cx={8} cy={8} r={5} fill={colors.ink} />
                  <Circle cx={8} cy={8} r={2} fill={colors.cream_hi} />
                </Svg>
              </Pressable>
            )}
            {onOpenHelp && (
              <Pressable onPress={onOpenHelp} hitSlop={6} style={styles.navIconBtn}>
                <Text style={styles.navIconText}>?</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Row 2 — big tokens + per-second rate. The whole token row is the
            tap target for the "+1 click" affordance. */}
        <Pressable
          onPress={onTapTokens}
          style={[styles.row, { marginTop: 4, alignItems: "baseline" }]}
          hitSlop={6}
        >
          <View style={styles.tokenRow}>
            <View style={styles.tokenIcon} />
            {/* Explicit line clamp so a briefly-long token string (e.g.
                during a units-boundary tick "999.5K" → "1.00M") can't
                wrap to a second line and shift the HUD height for a
                frame. */}
            <Text style={styles.tokenBig} numberOfLines={1} ellipsizeMode="tail">{tokens}</Text>
            <Text style={styles.tokenRate}>+{rate}</Text>
            {floaters.map((f) => (
              <PlusOneFloater key={f.id} />
            ))}
          </View>
        </Pressable>

        {/* Row 3 — small stats (Capital + Equity) + pct */}
        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <View style={[styles.statSwatch, { backgroundColor: colors.terracotta }]} />
            <Text style={styles.statLabel}>$</Text>
            <Text style={styles.statValue}>{capital}</Text>
          </View>
          <View style={styles.statChip}>
            <View style={[styles.statSwatch, { backgroundColor: colors.gold }]} />
            <Text style={styles.statLabel}>EQ</Text>
            <Text style={styles.statValue}>{equity}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text
            style={[
              styles.progressPct,
              { color: pct > 85 ? colors.gold_2 : colors.sage_2 },
            ]}
          >
            {Math.floor(pct)}%
          </Text>
        </View>

        {/* Row 4 — round-progress pixel bar with tick marks */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.max(0, Math.min(100, pct))}%`,
                backgroundColor: pct > 85 ? colors.gold : colors.sage,
              },
            ]}
          />
          <View
            style={[
              styles.progressHi,
              {
                width: `${Math.max(0, Math.min(100, pct))}%`,
                backgroundColor: pct > 85 ? colors.gold_hi : colors.sage_hi,
              },
            ]}
          />
          {/* 11 tick separators carve the bar into 12 visible cells */}
          {Array.from({ length: 11 }, (_, i) => (
            <View
              key={i}
              style={[styles.progressTick, { left: `${((i + 1) / 12) * 100}%` }]}
            />
          ))}
        </View>

        {/* Same line-clamp reason as tokenBig — a briefly-long threshold
            label (long round name + long "1e32 TOKENS" tail) can wrap on
            narrow screens and bump the HUD height. Ellipsizing prevents
            the visible "jump" when transitioning between screens (e.g.
            closing Producers) where the same value re-renders. */}
        <Text style={styles.nextLabel} numberOfLines={1} ellipsizeMode="tail">{nextThresholdLabel}</Text>
      </View>
    </View>
  );
}

/** Tiny "+1" that fades up and out — fires once per token tap. */
function PlusOneFloater() {
  const anim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [anim]);
  return (
    <Animated.Text
      style={[
        styles.floater,
        {
          opacity: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-2, -22] }) },
          ],
        },
      ]}
    >
      +1
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    zIndex: 30,
  },
  box: {
    backgroundColor: colors.cream_hi,
    paddingHorizontal: 10,
    paddingVertical: 8,
    // PixelBox effect: 1px ink outline + 2px ink shadow under.
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    // 2026-07: center-aligned by default (was "baseline"). Row 1 contains
    // mixed content — text (brand + roundLabel) alongside SVG icons (bell,
    // gear, ?) — and baseline layout with SVG children is unreliable on
    // first mount: react-native-svg reports its measured size on a second
    // pass, which briefly makes Row 1 taller before it settles, pushing
    // Row 2 (the big token counter) down by a few pixels and back up.
    // That's the visible "jump" between the top row and the token count
    // when returning from Producers/other screens. Row 2 sets its own
    // inline `alignItems: "baseline"` override so token/rate baseline
    // pairing is preserved.
    alignItems: "center",
    minHeight: 22,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 11,
    color: colors.ink,
    letterSpacing: 1.5,
  },
  roundLabel: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1,
    // flexShrink so a long round name ("AGI Singularity Round · Round 10")
    // collapses with an ellipsis instead of pushing the gear / ? icons off
    // the screen edge.
    flexShrink: 1,
  },
  row1Right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    // Claim remaining horizontal space (with brand on the far left) so
    // children inside can layout cleanly with shrinking text + fixed icons.
    flex: 1,
    justifyContent: "flex-end",
    marginLeft: 8,
  },
  navIconBtn: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream_2,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  bellBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tensionRed,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  bellBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 8,
    color: "#FFFFFF",
    lineHeight: 10,
  },
  navIconText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 14,
  },
  tokenRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  tokenIcon: {
    width: 10,
    height: 10,
    backgroundColor: colors.gold,
    alignSelf: "center",
  },
  tokenBig: {
    // VT323 mono — same family as the rate "+X/s" right next to it. The
    // chunky PixelifySans bold we used before made 2/6/8 hard to tell
    // apart at low token counts; mono digits have wider apertures and
    // are unambiguous.
    fontFamily: fonts.mono,
    fontSize: 34,
    color: colors.ink,
    lineHeight: 34,
  },
  tokenRate: {
    fontFamily: fonts.mono,
    fontSize: 16,
    color: colors.sage_2,
  },
  floater: {
    position: "absolute",
    right: 4,
    top: -2,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.gold,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  statSwatch: {
    width: 8,
    height: 8,
  },
  statLabel: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 1,
  },
  // Round-progress percentage — promoted to a bigger, bolder, colored stat
  // so the player can see at a glance how close they are to closing the
  // round. Color matches the progress bar (sage growing, gold near
  // threshold) so it reads as part of the same indicator.
  progressPct: {
    fontFamily: fonts.mono,
    fontSize: 22,
    letterSpacing: 0,
  },
  statValue: {
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.ink,
  },
  progressTrack: {
    marginTop: 4,
    height: 9,
    backgroundColor: colors.cream_2,
    borderWidth: 1,
    borderColor: colors.ink,
    position: "relative",
    overflow: "hidden",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
  },
  progressHi: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 2,
    opacity: 0.7,
  },
  progressTick: {
    position: "absolute",
    top: 1,
    bottom: 1,
    width: 1,
    backgroundColor: "rgba(42,42,42,0.18)",
  },
  nextLabel: {
    fontFamily: fonts.displayRegular,
    fontSize: 8,
    color: colors.muted,
    letterSpacing: 1,
    marginTop: 3,
    textAlign: "right",
  },
});
