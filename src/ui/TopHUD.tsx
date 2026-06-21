import React from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, fonts, PIXEL } from "./theme";

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
}: Props) {
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
          <Text style={styles.brand}>
            BURN<Text style={{ color: colors.terracotta }}>·</Text>RATE
          </Text>
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
            <Text style={styles.tokenBig}>{tokens}</Text>
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
          <Text style={styles.statLabel}>{Math.floor(pct)}%</Text>
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

        <Text style={styles.nextLabel}>{nextThresholdLabel}</Text>
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
    alignItems: "baseline",
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
    fontFamily: fonts.bodyBold,
    fontSize: 28,
    color: colors.ink,
    lineHeight: 30,
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
