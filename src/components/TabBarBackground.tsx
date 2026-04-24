import { Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';

export const TAB_BAR_HEIGHT = 85;
export const TAB_BAR_DOME_RADIUS = 34;

export default function TabBarBackground() {
  const { c } = useTheme();
  const W = Dimensions.get('window').width;
  const R = TAB_BAR_DOME_RADIUS;
  const H = TAB_BAR_HEIGHT + R;
  const cx = W / 2;

  const d = `M 0,${H} L 0,${R} L ${cx - R},${R} A ${R},${R} 0 0 0 ${cx + R},${R} L ${W},${R} L ${W},${H} Z`;

  return (
    <Svg
      width={W}
      height={H}
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, top: -R }}
    >
      <Path d={d} fill={c.tabBar} />
    </Svg>
  );
}
