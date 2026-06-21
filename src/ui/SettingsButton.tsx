import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { colors, PIXEL } from "./theme";

/**
 * Floating gear button — port of design v12 SettingsButton. Mirrors the
 * Slack button on the OPPOSITE edge so the screen reads symmetric: Slack
 * inbox on the left, Settings cog on the right, both at the same y.
 *
 * Visual: 44×44 cream slab with a 1px ink outline + 3px ink bottom shadow
 * (the same PixelBox pattern used elsewhere) and an inline pixel-gear SVG.
 */
interface Props {
  onPress(): void;
}

export function SettingsButton({ onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.iconWrap}>
        <Svg width={20} height={20} viewBox="0 0 16 16">
          {/* 4 cardinal teeth + 4 diagonal teeth — pixel-art gear silhouette */}
          <Path d="M7 0 H9 V2 H7 Z M7 14 H9 V16 H7 Z M0 7 H2 V9 H0 Z M14 7 H16 V9 H14 Z" fill={colors.ink} />
          <Path d="M2 2 H4 V4 H2 Z M12 2 H14 V4 H12 Z M2 12 H4 V14 H2 Z M12 12 H14 V14 H12 Z" fill={colors.ink} />
          {/* Body ring */}
          <Circle cx={8} cy={8} r={5} fill={colors.ink} />
          {/* Hub punch-out (cream) */}
          <Circle cx={8} cy={8} r={2} fill={colors.cream_hi} />
        </Svg>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "absolute",
    // Mirrors SlackButton's (top:230, left:8) on the right edge.
    top: 230,
    right: 14,
    zIndex: 36,
    width: 44,
    height: 44,
    backgroundColor: colors.cream_hi,
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
  iconWrap: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
