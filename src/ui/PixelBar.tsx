import React from "react";
import { View, ViewStyle } from "react-native";
import { PIXEL, colors } from "./theme";

interface SegmentSpec {
  /** Fraction of total width 0..1. Segments are stacked left-to-right. */
  pct: number;
  color: string;
}

interface Props {
  /** Either a single 0..100% (filled bar) or multiple stacked segments. */
  pct?: number;
  fill?: string;
  segments?: SegmentSpec[];
  /** Bar height in PIXEL units. Default 4 = 8px. */
  cells?: number;
  track?: string;
  border?: string;
  /** Drop the outer ink border (use for thin chain mini-bars). */
  borderless?: boolean;
  style?: ViewStyle;
}

/**
 * Pixel-art progress / allocation bar.
 *
 * Mode A — `pct`: classic single-color fill. Used for round-progress, debt.
 * Mode B — `segments`: stacked fractions (R&D / Prod / Mkt / Safe row from
 *   the mock). Caller sums to <= 1.0; we don't normalize here — that's the
 *   caller's contract (and Allocation already normalizes in math.ts).
 *
 * The bar itself is just two nested Views, no SVG. The "pixel" feel comes
 * from sharp corners (no border-radius), the outer ink border, and the
 * crisp segment boundaries (no gradient).
 */
export function PixelBar({
  pct,
  fill = colors.sage,
  segments,
  cells = 4,
  track = colors.hairline,
  border = colors.ink,
  borderless,
  style,
}: Props) {
  const h = cells * PIXEL;
  const t = borderless ? 0 : PIXEL;

  return (
    <View
      style={[
        {
          backgroundColor: borderless ? track : border,
          padding: t,
          height: h + t * 2,
        },
        style,
      ]}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          backgroundColor: track,
          overflow: "hidden",
        }}
      >
        {segments
          ? segments.map((s, i) => (
              <View
                key={i}
                style={{
                  width: `${Math.max(0, Math.min(100, s.pct * 100))}%`,
                  backgroundColor: s.color,
                  height: "100%",
                }}
              />
            ))
          : (
            <View
              style={{
                width: `${Math.max(0, Math.min(100, pct ?? 0))}%`,
                backgroundColor: fill,
                height: "100%",
              }}
            />
          )}
      </View>
    </View>
  );
}
