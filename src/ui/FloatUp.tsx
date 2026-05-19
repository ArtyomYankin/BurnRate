import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { colors } from "./theme";

interface Pop {
  id: number;
  label: string;
}

interface Props {
  /**
   * A monotonically-increasing counter the parent bumps every time a pop
   * should fire. Pair with a label prop to control what shows.
   */
  trigger: number;
  label: string;
  /** Horizontal offset from anchor — defaults to slight scatter. */
  scatter?: boolean;
  color?: string;
}

/**
 * Floats a short label upward from its parent's anchor and fades out. Used for
 * "+1" and "+$N" feedback when the player buys a producer.
 */
export function FloatUp({ trigger, label, scatter = true, color = colors.terracotta }: Props) {
  const [pops, setPops] = useState<Pop[]>([]);
  const lastTrigger = useRef(0);

  useEffect(() => {
    if (trigger === 0 || trigger === lastTrigger.current) return;
    lastTrigger.current = trigger;
    const id = trigger;
    setPops((p) => [...p, { id, label }]);
    const timeout = setTimeout(() => {
      setPops((p) => p.filter((x) => x.id !== id));
    }, 900);
    return () => clearTimeout(timeout);
  }, [trigger, label]);

  return (
    <>
      {pops.map((p) => (
        <FloatingLabel key={p.id} label={p.label} scatter={scatter} color={color} />
      ))}
    </>
  );
}

function FloatingLabel({
  label,
  scatter,
  color,
}: {
  label: string;
  scatter: boolean;
  color: string;
}) {
  const y = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const x = useRef(scatter ? (Math.random() - 0.5) * 30 : 0).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(y, { toValue: -36, duration: 800, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    ]).start();
  }, [y, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.float,
        { transform: [{ translateY: y }, { translateX: x }], opacity, borderColor: color },
      ]}
    >
      <Text style={[styles.text, { color }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  float: {
    position: "absolute",
    top: -8,
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: colors.cream,
    borderWidth: 1,
  },
  text: { fontWeight: "700", fontSize: 12 },
});
