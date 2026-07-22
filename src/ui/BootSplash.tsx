import React from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { colors, fonts, PIXEL } from "./theme";

/**
 * Boot splash — shown until the save hydrates. Without this, HomeScreen
 * mounts on first paint with the default (round 0 / seed garage) scene,
 * then briefly flashes to the actual scene a few hundred ms later when the
 * persisted state loads. The flash is jarring for veterans who left at
 * round 8 and see a garage for a frame.
 *
 * Visual: cream background, BURN·RATE wordmark centered, pulsing gold
 * progress block. Matches the game's pixel-art chrome so the transition
 * to HomeScreen feels seamless (no color/font shift). No animations
 * dependent on game state — runs purely off Animated.loop so it works
 * BEFORE hydration.
 */
export function BootSplash() {
  const pulse = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  return (
    <View style={styles.root}>
      <View style={styles.brandRow}>
        <View style={[styles.swatch, { backgroundColor: colors.gold }]} />
        <Text style={styles.brand}>
          BURN<Text style={{ color: colors.terracotta }}>·</Text>RATE
        </Text>
      </View>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { opacity }]} />
      </View>

      <Text style={styles.subline}>LOADING</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  swatch: {
    width: 16,
    height: 16,
  },
  brand: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.ink,
    letterSpacing: 3,
  },
  barTrack: {
    width: 120,
    height: 6,
    borderWidth: 1,
    borderColor: colors.ink,
    backgroundColor: colors.cream_2,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    overflow: "hidden",
  },
  barFill: {
    flex: 1,
    backgroundColor: colors.gold,
  },
  subline: {
    fontFamily: fonts.displayRegular,
    fontSize: 9,
    color: colors.muted,
    letterSpacing: 2,
  },
});
