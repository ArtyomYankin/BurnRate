import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { PIXEL, colors } from "./theme";

interface Props {
  children?: React.ReactNode;
  /** Fill color inside the frame. */
  bg?: string;
  /** Border color. */
  border?: string;
  /** Hard ink-offset drop (2px down-right). Use for clickable surfaces. */
  raised?: boolean;
  /** Border thickness in PIXEL units (1 = 2px, 2 = 4px). */
  thickness?: 1 | 2;
  style?: ViewStyle;
  padding?: number;
}

/**
 * 9-slice pixel-art frame. Outer rect is the border color; inner rect is the
 * fill. Four 1×1 corner squares are masked back to the page color (`cream`)
 * so the corners read as chamfered, not rounded — that's what makes the
 * frame look "pixel" rather than just "thin border".
 *
 * Used everywhere a card/panel/button needs the retro chrome from the Seed
 * garage mock. Cheaper than nesting 4 PixelCorner components per surface
 * and renders one extra View per corner instead of an SVG.
 */
export function PixelFrame({
  children,
  bg = colors.cardBg,
  border = colors.ink,
  raised,
  thickness = 1,
  style,
  padding,
}: Props) {
  const t = thickness * PIXEL;
  const body = (
    <View
      style={[
        {
          backgroundColor: border,
          padding: t,
        },
        style,
      ]}
    >
      <View
        style={{
          backgroundColor: bg,
          padding: padding ?? 0,
        }}
      >
        {children}
      </View>
      {/* Four corner cutouts — paint them as the surrounding page color so
          the visible silhouette is a chamfered rectangle. Consumers can pass
          a bg-matching color via the page background; default `cream` covers
          90% of cases (Home, modals over cream). */}
      <View pointerEvents="none" style={[styles.corner, { top: 0, left: 0, width: t, height: t, backgroundColor: colors.cream }]} />
      <View pointerEvents="none" style={[styles.corner, { top: 0, right: 0, width: t, height: t, backgroundColor: colors.cream }]} />
      <View pointerEvents="none" style={[styles.corner, { bottom: 0, left: 0, width: t, height: t, backgroundColor: colors.cream }]} />
      <View pointerEvents="none" style={[styles.corner, { bottom: 0, right: 0, width: t, height: t, backgroundColor: colors.cream }]} />
    </View>
  );

  if (!raised) return body;

  // Raised variant: pad bottom-right by 2px and absolutely position an
  // ink-colored block underneath, offset by the same amount. Total click
  // target stays the same; visually it floats above its shadow.
  return (
    <View style={{ position: "relative", paddingBottom: PIXEL, paddingRight: PIXEL }}>
      <View
        style={{
          position: "absolute",
          left: PIXEL,
          top: PIXEL,
          right: 0,
          bottom: 0,
          backgroundColor: colors.ink,
        }}
      />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: "absolute" },
});
