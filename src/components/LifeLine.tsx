import { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent, PanResponder } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  data: number[];
  color: string;
  height: number;
  strokeWidth?: number;
  fill?: boolean;
  showPulse?: boolean;
  gradientId: string;
  /** Called as the user drags. Index is null on release. */
  onScrub?: (index: number | null) => void;
  /** Externally controlled selected index (overrides internal scrub state). */
  selectedIndex?: number | null;
};

export default function LifeLine({
  data,
  color,
  height,
  strokeWidth = 2,
  fill = true,
  showPulse = true,
  gradientId,
  onScrub,
  selectedIndex,
}: Props) {
  const [width, setWidth] = useState(0);
  const [internalIdx, setInternalIdx] = useState<number | null>(null);
  const pulse = useSharedValue(0);

  // Latest props captured for PanResponder closure (PanResponder is created once).
  const propsRef = useRef({ data, width, onScrub });
  propsRef.current = { data, width, onScrub };

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
  }, [pulse]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== width) setWidth(w);
  };

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const pad = strokeWidth + 2;
  const topPad = showPulse ? 6 : pad;
  const innerH = height - topPad - pad;

  const points = data.map((v, i) => ({
    x: width > 0 ? (i / Math.max(1, data.length - 1)) * (width - pad * 2) + pad : 0,
    y: height - pad - ((v - min) / range) * innerH,
  }));

  const linePath = smoothPath(points);
  const last = points[points.length - 1] ?? { x: 0, y: 0 };
  const first = points[0] ?? { x: 0, y: 0 };
  const areaPath = linePath
    ? `${linePath} L ${last.x},${height} L ${first.x},${height} Z`
    : '';

  const animatedHaloProps = useAnimatedProps(() => ({
    r: interpolate(pulse.value, [0, 1], [4, 12]),
    opacity: interpolate(pulse.value, [0, 1], [0.45, 0]),
  }));

  const activeIdx = selectedIndex !== undefined ? selectedIndex : internalIdx;
  const showScrub = activeIdx !== null && activeIdx >= 0 && activeIdx < points.length;
  const scrubPoint = showScrub ? points[activeIdx as number] : null;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { data: d, width: w, onScrub: cb } = propsRef.current;
          if (!w || d.length === 0) return;
          const idx = locateIndex(e.nativeEvent.locationX, w, d.length);
          if (idx !== null) {
            setInternalIdx(idx);
            cb?.(idx);
          }
        },
        onPanResponderMove: (e) => {
          const { data: d, width: w, onScrub: cb } = propsRef.current;
          if (!w || d.length === 0) return;
          const x = e.nativeEvent.locationX;
          const idx = locateIndex(x, w, d.length);
          if (idx !== null) {
            setInternalIdx(idx);
            cb?.(idx);
          }
        },
        onPanResponderRelease: () => {
          setInternalIdx(null);
          propsRef.current.onScrub?.(null);
        },
        onPanResponderTerminate: () => {
          setInternalIdx(null);
          propsRef.current.onScrub?.(null);
        },
      }),
    [],
  );

  return (
    <View style={[styles.container, { height }]} onLayout={onLayout} {...panResponder.panHandlers}>
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="0.32" />
              <Stop offset="1" stopColor={color} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          {fill && <Path d={areaPath} fill={`url(#${gradientId})`} />}
          <Path
            d={linePath}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {scrubPoint && (
            <>
              <Line
                x1={scrubPoint.x}
                y1={0}
                x2={scrubPoint.x}
                y2={height}
                stroke={color}
                strokeOpacity={0.35}
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              <Circle cx={scrubPoint.x} cy={scrubPoint.y} r={6} fill={color} fillOpacity={0.25} />
              <Circle cx={scrubPoint.x} cy={scrubPoint.y} r={3} fill={color} />
            </>
          )}

          {showPulse && !scrubPoint && (
            <>
              <AnimatedCircle
                cx={last.x}
                cy={last.y}
                fill={color}
                animatedProps={animatedHaloProps}
              />
              <Circle cx={last.x} cy={last.y} r={3} fill={color} />
            </>
          )}
        </Svg>
      )}
    </View>
  );
}

function locateIndex(x: number, width: number, count: number): number | null {
  if (count === 0 || width <= 0) return null;
  const clamped = Math.max(0, Math.min(width, x));
  const ratio = clamped / width;
  const idx = Math.round(ratio * (count - 1));
  return Math.max(0, Math.min(count - 1, idx));
}

function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

const styles = StyleSheet.create({
  container: { width: '100%' },
});
