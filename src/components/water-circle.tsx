import { Ionicons } from '@expo/vector-icons';
import { useEffect, useId, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

import { AppText } from './ui';

const BORDER = 3;

/**
 * One sine wave, two periods wide (period = `period`), filled down to `height`.
 * Sliding it left by exactly one period loops seamlessly.
 */
const wavePath = (period: number, amp: number, height: number, phase: number) => {
  const pts: string[] = [];
  for (let x = 0; x <= period * 2; x += 4) pts.push(`${x},${amp + amp * Math.sin((x / period) * Math.PI * 2 + phase)}`);
  return `M${pts.join(' L')} L${period * 2},${height} L0,${height} Z`;
};

/** A wave layer that slides horizontally forever. `reverse` flips the direction. */
function Wave({ size, amp, duration, reverse, children }: { size: number; amp: number; duration: number; reverse?: boolean; children: ReactNode }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [t, duration]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: reverse ? -size * (1 - t.value) : -size * t.value }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: size * 2, height: size + amp * 2 }, style]}>
      <Svg width={size * 2} height={size + amp * 2}>
        {children}
      </Svg>
    </Animated.View>
  );
}

/**
 * Round "glass" that fills with water as `ml` approaches `goal`. The level eases to each new value
 * and two waves drift across the surface in opposite directions so the water always looks alive.
 */
export function WaterCircle({ ml, goal, size = 230 }: { ml: number; goal: number; size?: number }) {
  const { colors } = useTheme();
  const gradId = `water${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const progress = goal > 0 ? Math.min(1, ml / goal) : 0;
  const inner = size - BORDER * 2;
  const amp = inner * 0.035;

  const level = useSharedValue(0);
  useEffect(() => {
    level.value = withTiming(progress, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [level, progress]);
  // a small sliver of water shows as soon as anything is logged, like a glass that isn't quite empty
  const rise = useAnimatedStyle(() => {
    const shown = level.value > 0 ? 0.06 + level.value * 0.94 : 0;
    return { transform: [{ translateY: inner * (1 - shown) - amp * 2 }] };
  });

  // once the water passes the numbers they sit on dark blue, so switch them to white
  const onWater = progress > 0.52;
  const textColor = onWater ? '#FFFFFF' : colors.text;
  const pct = Math.round((ml / Math.max(1, goal)) * 100);

  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: BORDER, borderColor: colors.rest + '66', backgroundColor: colors.rest + '14', overflow: 'hidden', alignSelf: 'center' }}>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: inner, height: inner + amp * 2 }, rise]}>
        <Wave size={inner} amp={amp * 1.3} duration={5200} reverse>
          <Path d={wavePath(inner, amp * 1.3, inner + amp * 3, 1.2)} fill={colors.rest} opacity={0.35} />
        </Wave>
        <Wave size={inner} amp={amp} duration={3600}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.core} />
              <Stop offset="1" stopColor={colors.deep} />
            </LinearGradient>
          </Defs>
          <Path d={wavePath(inner, amp, inner + amp * 2, 0)} fill={`url(#${gradId})`} />
        </Wave>
      </Animated.View>

      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <AppText style={{ color: textColor, fontSize: 44, fontWeight: '800', fontVariant: ['tabular-nums'] }}>
          {ml.toLocaleString('en-US')}
          <AppText style={{ color: textColor, fontSize: 18, fontWeight: '700' }}> ml</AppText>
        </AppText>
        <AppText variant="small" style={{ color: onWater ? '#FFFFFFCC' : colors.textMuted }}>
          of {goal.toLocaleString('en-US')} ml
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: onWater ? '#FFFFFF33' : colors.rest + '22' }}>
          <Ionicons name="water" size={12} color={onWater ? '#FFFFFF' : colors.rest} />
          <AppText variant="small" style={{ color: onWater ? '#FFFFFF' : colors.rest, fontWeight: '700' }}>
            {pct}%
          </AppText>
        </View>
      </View>
    </View>
  );
}
