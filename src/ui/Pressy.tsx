import React, { useRef } from "react";
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";

/**
 * Pressable that scales down briefly on press. The tactile "click" feel that
 * idle games lean on — gives every tap a body.
 *
 * For gradient backgrounds: place <LinearGradient style={StyleSheet.absoluteFill} />
 * as the first child, then your real children on top. Set overflow:"hidden"
 * on the style so the gradient clips to the button's border radius.
 */
export function Pressy({
  children,
  style,
  scaleTo = 0.94,
  disabled,
  ...rest
}: PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 50,
      bounciness: 0,
    }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 10,
    }).start();
  };

  return (
    <Animated.View style={[{ transform: [{ scale }] }, disabled && { opacity: 0.55 }]}>
      <Pressable
        {...rest}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
