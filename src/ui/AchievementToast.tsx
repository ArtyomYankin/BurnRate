import React from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { ACHIEVEMENT_BY_ID, AchievementBucket } from "../core/achievements";
import { selectUnlockedAchievements, useGame } from "../game/store";
import { colors, fonts, PIXEL } from "./theme";

/**
 * Toast banner that appears when an achievement is unlocked. Subscribes
 * to `persistent.unlockedAchievements`, diffs against a ref to find
 * newly-added IDs, and queues them up to show one at a time at the top
 * of the screen.
 *
 * Each toast is ~2.6s: 220ms slide-down + fade-in, 1.9s hold, 480ms
 * slide-up + fade-out. If multiple achievements unlock at once (common
 * after a prestige), the queue drains sequentially so the player sees
 * each name.
 *
 * Visual: cream-hi card with a bucket-color accent stripe on the left
 * and a small "ACHIEVEMENT UNLOCKED" eyebrow above the achievement name.
 * Mounted at the App root so it overlays any screen.
 */
const BUCKET_COLOR: Record<AchievementBucket, string> = {
  milestone: colors.sage,
  grind:     colors.terracotta,
  subtle:    colors.tension_2,
  comedy:    colors.gold,
  endgame:   colors.tensionRed,
};

const ENTER_MS = 220;
const HOLD_MS = 1900;
const EXIT_MS = 480;

export function AchievementToast() {
  const unlocked = useGame(selectUnlockedAchievements);
  const seenRef = React.useRef<Set<string> | null>(null);
  const [queue, setQueue] = React.useState<string[]>([]);
  const [currentId, setCurrentId] = React.useState<string | null>(null);

  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(-12)).current;

  // Initialize seenRef on first render to the existing unlocked set. This
  // prevents the toast from firing for every achievement a returning
  // player already had — only NEW unlocks (post-mount) toast.
  if (seenRef.current === null) {
    seenRef.current = new Set(unlocked);
  }

  // Diff incoming unlocked list against the seen set; append new IDs to
  // the queue.
  React.useEffect(() => {
    const seen = seenRef.current!;
    const fresh: string[] = [];
    for (const id of unlocked) {
      if (!seen.has(id)) {
        seen.add(id);
        fresh.push(id);
      }
    }
    if (fresh.length > 0) {
      setQueue((q) => [...q, ...fresh]);
    }
  }, [unlocked]);

  // Pop next item off the queue when no toast is currently showing.
  React.useEffect(() => {
    if (currentId !== null || queue.length === 0) return;
    const next = queue[0];
    setCurrentId(next);
    setQueue((q) => q.slice(1));
  }, [currentId, queue]);

  // Drive the show / hold / hide animation when currentId changes.
  React.useEffect(() => {
    if (currentId === null) return;
    opacity.setValue(0);
    translateY.setValue(-12);
    const seq = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 1, duration: ENTER_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: ENTER_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.delay(HOLD_MS),
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0,   duration: EXIT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -12, duration: EXIT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    ]);
    seq.start(({ finished }) => {
      if (finished) setCurrentId(null);
    });
    return () => seq.stop();
  }, [currentId, opacity, translateY]);

  if (!currentId) return null;
  const def = ACHIEVEMENT_BY_ID[currentId];
  if (!def) return null;
  const accent = BUCKET_COLOR[def.bucket] ?? colors.gold;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
        <View style={[styles.stripe, { backgroundColor: accent }]} />
        <View style={styles.content}>
          <Text style={[styles.eyebrow, { color: accent }]}>★ ACHIEVEMENT UNLOCKED</Text>
          <Text style={styles.name} numberOfLines={2}>{def.name}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 96,           // clear TopHUD + safe-area
    paddingHorizontal: 14,
    alignItems: "center",
    zIndex: 80,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: colors.cream_hi,
    borderWidth: 1,
    borderColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 0,
    overflow: "hidden",
  },
  stripe: {
    width: 6,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  eyebrow: {
    fontFamily: fonts.display,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
    lineHeight: 16,
  },
});
