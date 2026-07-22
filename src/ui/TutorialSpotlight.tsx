import React from "react";
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useGame } from "../game/store";
import { TutorialTargetKey, useTutorialTargets } from "./tutorialTargets";
import { colors, fonts, PIXEL } from "./theme";
import { useStrings } from "../core/i18n";

/**
 * Hook for making a UI element a tutorial-spotlight target. Returns a
 * `{ ref, onLayout }` pair that callers spread on their outermost
 * Pressable/View. The element's window-space rect is measured (via
 * measureInWindow) and stored in the tutorialTargets registry; the
 * spotlight overlay reads from there to cut the "hole" in the right spot.
 *
 * Why a hook and not a wrapper component? Several targets (SlackButton,
 * BottomAllocation, the ACH Pressy) use `position: absolute` styling on
 * their root. Wrapping them in a relative-positioned View collapses the
 * wrapper to 0×0 and breaks the measurement. The hook lets each target
 * keep its native layout while still self-registering.
 */
export function useTutorialTargetMeasure(targetKey: TutorialTargetKey) {
  const ref = React.useRef<View>(null);
  const setRect = useTutorialTargets((s) => s.setRect);

  const measure = React.useCallback(() => {
    ref.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) setRect(targetKey, { x, y, w, h });
    });
  }, [targetKey, setRect]);

  React.useEffect(() => {
    // Deferred initial measure — SafeAreaProvider insets often shift things
    // after first paint.
    const t = setTimeout(measure, 50);
    return () => {
      clearTimeout(t);
      setRect(targetKey, null);
    };
  }, [measure, targetKey, setRect]);

  return { ref, onLayout: measure };
}

// Backwards-compat wrapper for non-absolute targets. Same API as the
// removed `TutorialTarget` — accepts a style + children, applies the hook
// internally. Avoid for absolute-positioned children.
interface TutorialTargetProps {
  targetKey: TutorialTargetKey;
  style?: ViewStyle;
  children: React.ReactNode;
}

export function TutorialTarget({ targetKey, style, children }: TutorialTargetProps) {
  const { ref, onLayout } = useTutorialTargetMeasure(targetKey);
  return (
    <View ref={ref} style={style} onLayout={onLayout} collapsable={false}>
      {children}
    </View>
  );
}

/**
 * Forced-walkthrough overlay.
 *
 * When the current onboarding step has a `forceTarget` (looked up via
 * `forceTargetForStep`), this component renders a full-screen "spotlight":
 *
 *   - 4 absorber `Pressable`s tile the screen everywhere EXCEPT a hole
 *     positioned over the target's measured rect.
 *   - The absorbers catch and discard taps — the only place a tap reaches
 *     underlying UI is the hole. So the player can ONLY tap the highlighted
 *     control.
 *   - A pulsing border around the hole draws attention.
 *   - A small caption sits near the hole with the step's instruction text.
 *
 * If the target hasn't registered its rect yet (component not mounted), we
 * render nothing and the existing chip-style onboarding card from
 * `Onboarding.tsx` still shows the instruction — graceful fallback so the
 * tutorial never deadlocks.
 */

const FORCE_TARGET_BY_STEP: Record<number, TutorialTargetKey> = {
  5: "alloc-bar",
  10: "slack-btn",
  11: "ach-btn",
};

export function forceTargetForStep(step: number): TutorialTargetKey | null {
  return FORCE_TARGET_BY_STEP[step] ?? null;
}

const PADDING = 6;

/**
 * Props for routing a tap in the spotlight's "hole" region. Modals absorb
 * every tap on their window layer — even visually-uncovered areas — so the
 * spotlight can't rely on the player's tap reaching the underlying target.
 * App.tsx passes the same handlers it wires to the home-screen buttons,
 * keyed by tutorial target. The spotlight renders a transparent Pressable
 * in the hole that calls the matching handler directly.
 */
export interface SpotlightTargetActions {
  "alloc-bar"?(): void;
  "slack-btn"?(): void;
  "ach-btn"?(): void;
}

interface SpotlightProps {
  actions: SpotlightTargetActions;
  /** Whether the spotlight should be active. Should be true only while the
   *  home screen is mounted — every spotlight target lives on HomeScreen,
   *  so leaving the spotlight active on other screens risks the tap-
   *  forwarder firing when the player is trying to interact with, e.g., a
   *  vignette in the inbox (the target rect may not have been cleared
   *  yet by React's cleanup pass, or may be re-registered instantly on a
   *  bounce navigation). Defaults to true for backwards compat. */
  visible?: boolean;
}

export function TutorialSpotlight({ actions, visible = true }: SpotlightProps) {
  const step = useGame((s) => s.account.onboardingStep);
  const hydrated = useGame((s) => s.hydrated);
  const unreadCount = useGame((s) => s.persistent.unreadVignettes.length);
  const t = useStrings();
  const rect = useTutorialTargets((s) => {
    const key = forceTargetForStep(step);
    return key ? s.rects[key] : undefined;
  });

  const pulse = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    if (!rect) return;
    pulse.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [rect, pulse]);

  if (!hydrated || !visible) return null;
  const targetKey = forceTargetForStep(step);
  if (!targetKey || !rect) return null;
  // Step 10 (Open INBOX) only makes sense when the inbox has unread items —
  // otherwise the spotlight would point at an empty surface. Silently stay
  // on step 10 until a vignette unlocks (the tick loop will eventually
  // surface one based on milestones).
  if (step === 10 && unreadCount === 0) return null;

  const { width: screenW, height: screenH } = Dimensions.get("window");
  const holeX = Math.max(0, rect.x - PADDING);
  const holeY = Math.max(0, rect.y - PADDING);
  const holeW = rect.w + PADDING * 2;
  const holeH = rect.h + PADDING * 2;
  const holeRight = holeX + holeW;
  const holeBottom = holeY + holeH;
  // Caption text per force target — comes from the i18n dict, keyed by
  // the same target key as the rect registry.
  const captionByKey: Record<TutorialTargetKey, string> = {
    "alloc-bar": t.spotlight.allocBar,
    "slack-btn": t.spotlight.slackBtn,
    "ach-btn":   t.spotlight.achBtn,
  };
  const caption = captionByKey[targetKey] ?? "";

  // Caption placement: by default above the hole; if hole is near the top,
  // flip below. Centered horizontally on the hole, but clamped to screen.
  const captionAbove = holeY > 120;
  const captionWidth = 280;
  const captionLeft = Math.max(
    8,
    Math.min(screenW - captionWidth - 8, holeX + holeW / 2 - captionWidth / 2)
  );
  const captionTop = captionAbove ? Math.max(40, holeY - 70) : holeBottom + 12;

  const borderColor = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.gold, colors.terracotta],
  });

  // Render inside a native Modal so the overlay lives in its own window
  // layer above SafeAreaView/HomeScreen — sidesteps both z-order issues
  // (TopHUD/Slack/etc each set their own zIndex within HomeScreen) and the
  // safe-area padding offset that would otherwise mis-align the absorbers
  // vs the measureInWindow rects.
  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Four absorber Pressables. Empty onPress swallows the touch — no
          ripple, no haptic. */}
      <Pressable
        onPress={noop}
        style={[styles.absorber, { left: 0, top: 0, width: screenW, height: holeY }]}
      />
      <Pressable
        onPress={noop}
        style={[styles.absorber, { left: 0, top: holeBottom, width: screenW, height: screenH - holeBottom }]}
      />
      <Pressable
        onPress={noop}
        style={[styles.absorber, { left: 0, top: holeY, width: holeX, height: holeH }]}
      />
      <Pressable
        onPress={noop}
        style={[styles.absorber, { left: holeRight, top: holeY, width: screenW - holeRight, height: holeH }]}
      />

      {/* In-hole tap forwarder. The Modal absorbs every touch on its window
          layer (even visually-uncovered regions), so we can't rely on the
          tap reaching the underlying button. Instead, render a transparent
          Pressable at the hole and call the matching action directly. */}
      {actions[targetKey] && (
        <Pressable
          onPress={actions[targetKey]}
          style={{
            position: "absolute",
            left: holeX,
            top: holeY,
            width: holeW,
            height: holeH,
            backgroundColor: "transparent",
          }}
        />
      )}

      {/* Pulsing ring around the hole. pointerEvents="none" so it never
          eats the underlying tap. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          {
            left: holeX - 2,
            top: holeY - 2,
            width: holeW + 4,
            height: holeH + 4,
            borderColor,
          },
        ]}
      />

      {/* Caption */}
      <View
        pointerEvents="none"
        style={[
          styles.caption,
          {
            left: captionLeft,
            top: captionTop,
            width: captionWidth,
          },
        ]}
      >
        <View style={[styles.captionSwatch, { backgroundColor: colors.gold }]} />
        <Text style={styles.captionText}>{caption}</Text>
      </View>
    </View>
    </Modal>
  );
}

function noop() {}

const styles = StyleSheet.create({
  absorber: {
    position: "absolute",
    backgroundColor: "rgba(42,42,42,0.55)",
  },
  ring: {
    position: "absolute",
    borderWidth: 3,
    borderRadius: 2,
  },
  caption: {
    position: "absolute",
    backgroundColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.ink_hi,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: PIXEL },
    shadowOpacity: 1,
    shadowRadius: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  captionSwatch: {
    width: 8,
    height: 8,
    marginTop: 4,
  },
  captionText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.cream_hi,
    lineHeight: 17,
  },
});
