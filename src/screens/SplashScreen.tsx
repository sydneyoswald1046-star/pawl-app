import { useEffect } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  RadialGradient,
  Rect,
} from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Stylized P path, centered around (0, 0) in a 600x600 viewBox.
// Vertical stem on the left + oval bowl attaching to upper two-thirds of the stem.
const P_PATH =
  'M -60 220 L -60 -220 C 150 -220 150 40 -60 40';

const DASH = 1600;

// Warm palette that matches the reference:
// magenta → violet → amber, sweeping left-to-right
const SPIRO_PATHS = 14;
const SPLASH_TOTAL_MS = 2100;

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const { width: W, height: H } = Dimensions.get('window');
  const size = Math.min(W, H) * 0.78;

  // Master animation clock (0 → 1 over ~1200ms), feeds all spirograph paths.
  const spiroProgress = useSharedValue(0);
  // White core P (0 → 1 over ~500ms), starts late.
  const coreProgress = useSharedValue(0);
  // Background bloom (pulses gently through the whole scene).
  const bloom = useSharedValue(0);
  // Final fade-out.
  const fade = useSharedValue(1);

  useEffect(() => {
    // Background bloom: swell in quickly, then breathe.
    bloom.value = withSequence(
      withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }),
      withRepeat(withTiming(0.78, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true)
    );

    // Spirograph ribbons draw across ~1100ms, staggered per-path.
    spiroProgress.value = withDelay(
      120,
      withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) })
    );

    // Crisp core P draws on at the end.
    coreProgress.value = withDelay(
      1050,
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })
    );

    // Crossfade the whole splash off.
    fade.value = withDelay(
      SPLASH_TOTAL_MS - 400,
      withTiming(0, { duration: 400, easing: Easing.in(Easing.quad) })
    );

    const done = setTimeout(onDone, SPLASH_TOTAL_MS);
    return () => clearTimeout(done);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const bloomStyle = useAnimatedStyle(() => ({ opacity: 0.55 + bloom.value * 0.45 }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.root, fadeStyle]}
    >
      {/* Background glow layer */}
      <Animated.View style={[StyleSheet.absoluteFill, bloomStyle]}>
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="bgPink" cx="28%" cy="42%" rx="55%" ry="55%">
              <Stop offset="0" stopColor="#ec4899" stopOpacity="0.28" />
              <Stop offset="1" stopColor="#ec4899" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="bgOrange" cx="82%" cy="45%" rx="60%" ry="60%">
              <Stop offset="0" stopColor="#f59e0b" stopOpacity="0.32" />
              <Stop offset="1" stopColor="#f59e0b" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="bgGreen" cx="10%" cy="92%" rx="55%" ry="55%">
              <Stop offset="0" stopColor="#10b981" stopOpacity="0.18" />
              <Stop offset="1" stopColor="#10b981" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="vignette" cx="50%" cy="50%" rx="75%" ry="75%">
              <Stop offset="0.45" stopColor="#000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000" stopOpacity="0.75" />
            </RadialGradient>
          </Defs>
          <Rect width={W} height={H} fill="url(#bgPink)" />
          <Rect width={W} height={H} fill="url(#bgOrange)" />
          <Rect width={W} height={H} fill="url(#bgGreen)" />
          <Rect width={W} height={H} fill="url(#vignette)" />
        </Svg>
      </Animated.View>

      {/* Logo */}
      <View style={styles.center}>
        <Svg width={size} height={size} viewBox="-300 -300 600 600">
          <Defs>
            <SvgLinearGradient id="spiroGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#ec4899" />
              <Stop offset="0.5" stopColor="#a855f7" />
              <Stop offset="1" stopColor="#f59e0b" />
            </SvgLinearGradient>
          </Defs>

          {/* Spirograph ribbons */}
          {Array.from({ length: SPIRO_PATHS }).map((_, i) => {
            const t = i / (SPIRO_PATHS - 1); // 0..1
            const angle = (t - 0.5) * 42; // -21°..+21°
            const scale = 0.88 + t * 0.18;
            const opacity = 0.55 - t * 0.1;
            return (
              <SpiroRibbon
                key={i}
                index={i}
                total={SPIRO_PATHS}
                progress={spiroProgress}
                transform={`rotate(${angle}) scale(${scale})`}
                strokeOpacity={opacity}
              />
            );
          })}

          {/* Core crisp P */}
          <CorePath progress={coreProgress} />
        </Svg>
      </View>
    </Animated.View>
  );
}

function SpiroRibbon({
  index,
  total,
  progress,
  transform,
  strokeOpacity,
}: {
  index: number;
  total: number;
  progress: SharedValue<number>;
  transform: string;
  strokeOpacity: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    // Each ribbon occupies a window inside the master 0..1 progress.
    const start = (index / total) * 0.45; // stagger start
    const duration = 0.55;
    const local = Math.min(1, Math.max(0, (progress.value - start) / duration));
    return {
      strokeDashoffset: DASH * (1 - local),
      opacity: local * strokeOpacity,
    };
  });

  return (
    <AnimatedPath
      d={P_PATH}
      transform={transform}
      fill="none"
      stroke="url(#spiroGrad)"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={DASH}
      animatedProps={animatedProps}
    />
  );
}

function CorePath({ progress }: { progress: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: DASH * (1 - progress.value),
    opacity: progress.value,
  }));
  return (
    <AnimatedPath
      d={P_PATH}
      fill="none"
      stroke="#ffffff"
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={DASH}
      animatedProps={animatedProps}
    />
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: '#0a0306' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
