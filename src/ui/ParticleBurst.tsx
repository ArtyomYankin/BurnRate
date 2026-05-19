import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors } from "./theme";

interface Particle {
  id: number;
  angle: number;
  distance: number;
  color: string;
  size: number;
}

interface Props {
  /** Bump this number to fire a new burst. */
  trigger: number;
  count?: number;
  palette?: readonly string[];
  /** Maximum travel distance in px. */
  spread?: number;
  duration?: number;
}

/**
 * Tiny confetti burst absolutely-positioned at its parent's center. Fires
 * when `trigger` changes. Used for tier unlocks and prestige moments —
 * sanctioned "juice" without going cartoony.
 */
export function ParticleBurst({
  trigger,
  count = 14,
  palette = DEFAULT_PALETTE,
  spread = 64,
  duration = 700,
}: Props) {
  const [bursts, setBursts] = useState<{ id: number; particles: Particle[] }[]>([]);
  const lastTrigger = useRef(0);

  useEffect(() => {
    if (trigger === 0 || trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;
    const id = trigger;
    const particles: Particle[] = Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: Math.random() * Math.PI * 2,
      distance: spread * (0.5 + Math.random() * 0.5),
      color: palette[Math.floor(Math.random() * palette.length)] ?? colors.gold,
      size: 4 + Math.random() * 4,
    }));
    setBursts((b) => [...b, { id, particles }]);
    const t = setTimeout(() => {
      setBursts((b) => b.filter((x) => x.id !== id));
    }, duration + 100);
    return () => clearTimeout(t);
  }, [trigger, count, palette, spread, duration]);

  return (
    <View pointerEvents="none" style={styles.root}>
      {bursts.map((b) =>
        b.particles.map((p) => <Pellet key={`${b.id}-${p.id}`} p={p} duration={duration} />)
      )}
    </View>
  );
}

function Pellet({ p, duration }: { p: Particle; duration: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration, useNativeDriver: true }).start();
  }, [t, duration]);

  const dx = Math.cos(p.angle) * p.distance;
  const dy = Math.sin(p.angle) * p.distance;
  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  // y has gravity — curves slightly downward at the end
  const translateY = t.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0, dy * 0.85, dy + 12],
  });
  const opacity = t.interpolate({
    inputRange: [0, 0.1, 0.85, 1],
    outputRange: [0, 1, 1, 0],
  });
  const scale = t.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.6, 1, 0.7],
  });
  const rotate = t.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", `${(p.angle * 180) / Math.PI + 180}deg`],
  });

  return (
    <Animated.View
      style={[
        styles.pellet,
        {
          width: p.size,
          height: p.size,
          backgroundColor: p.color,
          opacity,
          transform: [{ translateX }, { translateY }, { scale }, { rotate }],
        },
      ]}
    />
  );
}

const DEFAULT_PALETTE = [colors.gold, colors.terracotta, colors.sage, colors.cream] as const;

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 0,
    height: 0,
    overflow: "visible",
  },
  pellet: {
    position: "absolute",
    borderRadius: 2,
  },
});
