import React from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fonts, PIXEL } from "./theme";

/**
 * Floating Slack-style inbox button — port of design v8 screens.jsx::SlackButton.
 *
 * Visual: dark navy slab anchored to the right edge with a white "SLACK"
 * label and a pulsing tension-red unread badge. Stands out from the cream
 * scene chrome on purpose — it's the player's notification surface, the
 * Persona-B-bait "the Slack badge is glowing" moment.
 *
 * Behavior: tapping opens whatever inbox surface the caller wires up
 * (currently the full-screen VignettesScreen). When `unread === 0` the
 * button stays mounted but doesn't show the badge; the player still has
 * access to past messages via the codex/log.
 */
interface Props {
  unread: number;
  onPress(): void;
}

export function SlackButton({ unread, onPress }: Props) {
  // Pulsing badge — runs only when there are unread messages, so the rest
  // of the time the layout effect doesn't burn frames.
  const pulse = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (unread <= 0) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [unread, pulse]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
    >
      {/* Tiny pixel "S" mark — stand-in for the slack icon. White on navy. */}
      <View style={styles.iconBox}>
        <Text style={styles.iconChar}>#</Text>
      </View>
      <Text style={styles.label}>SLACK</Text>
      {unread > 0 && (
        <Animated.View style={[styles.badge, { transform: [{ scale: pulse }] }]}>
          <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    // Design v9 placed it on the left at top:230, left:30 — that 30px inset
    // off the screen edge leaves a small cream margin matching the rest of
    // the bottom-bar chrome, and keeps the dark navy slab away from the
    // scene's top-row hit zones across all scenes.
    top: 230,
    left: 8,
    zIndex: 35,
    backgroundColor: "#1A1D29",
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 44,
    // PixelBox effect: 1px ink outline + 2px ink shadow under.
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
  },
  iconBox: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconChar: {
    fontFamily: fonts.display,
    fontSize: 12,
    color: "#FFFFFF",
    lineHeight: 14,
  },
  label: {
    fontFamily: fonts.display,
    fontSize: 9,
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  badge: {
    marginLeft: 4,
    backgroundColor: colors.tensionRed,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.ink,
  },
  badgeText: {
    fontFamily: fonts.display,
    fontSize: 10,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
});
