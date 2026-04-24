import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

type Props = {
  color: string;
  duration?: number;
  minOpacity?: number;
  maxOpacity?: number;
  borderRadius?: number;
};

export default function PulseGlow({
  color,
  duration = 2400,
  minOpacity = 0.18,
  maxOpacity = 0.55,
  borderRadius = 20,
}: Props) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
  }, [t, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: minOpacity + t.value * (maxOpacity - minOpacity),
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius, overflow: 'hidden' }, animatedStyle]}
    >
      <LinearGradient
        colors={[`${color}00`, `${color}33`, `${color}00`]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}
