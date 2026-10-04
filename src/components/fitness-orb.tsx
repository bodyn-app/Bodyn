import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { type Colors, useTheme } from '@/theme';

import { type ProfileTone } from '@/metrics';

const toneStops: Record<ProfileTone, [string, string, string]> = {
  // bright core → mid → deep edge, tinted by tone
  good: ['#D7FF7A', '#3DDC84', '#0E4B2A'],
  neutral: ['#BEE3FF', '#4FA3FF', '#0E2E52'],
  bad: ['#FFC9C2', '#FF5A4F', '#5A140F'],
};

/** Fixed bubble definitions (never randomised per render, so nothing jumps between renders): start x, size, timing. */
const BUBBLES = [
  { x: 0.22, r: 4, duration: 5200, delay: 0, sway: 7 },
  { x: 0.68, r: 3, duration: 4400, delay: 600, sway: -6 },
  { x: 0.42, r: 5, duration: 6000, delay: 1400, sway: 5 },
  { x: 0.8, r: 2.5, duration: 3800, delay: 300, sway: -8 },
  { x: 0.32, r: 2.5, duration: 5000, delay: 2200, sway: 6 },
  { x: 0.58, r: 3.5, duration: 4700, delay: 1000, sway: -5 },
  { x: 0.14, r: 2, duration: 4100, delay: 1800, sway: 4 },
  { x: 0.9, r: 2, duration: 5500, delay: 700, sway: -4 },
];

/** One small circle drifting slowly up through the orb, fading in and out, looping forever. */
function Bubble({ size, x, r, duration, delay, sway }: { size: number; x: number; r: number; duration: number; delay: number; sway: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false));
  }, [t, delay, duration]);

  const style = useAnimatedStyle(() => {
    const rise = interpolate(t.value, [0, 1], [size * 0.06, -size * 1.05]);
    const wobble = Math.sin(t.value * Math.PI * 2.4) * sway;
    const opacity = interpolate(t.value, [0, 0.12, 0.75, 1], [0, 0.85, 0.55, 0]);
    return { opacity, transform: [{ translateY: rise }, { translateX: wobble }] };
  });

  return <Animated.View style={[{ position: 'absolute', left: `${x * 100}%`, bottom: 0, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: '#fff' }, style]} />;
}

/**
 * The glowing sphere behind the fitness-age number: a soft radial gradient, a couple of blurred highlight
 * blobs, small bubbles drifting slowly upward on a loop, and a slow, subtle breathing pulse. Colour comes
 * from `tone`.
 */
export function FitnessOrb({ size = 220, tone, children }: { size?: number; tone: ProfileTone; children?: ReactNode }) {
  const { colors } = useTheme();
  const stops = toneStops[tone];
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [pulse]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.02 }] }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* soft outer glow, matches the app's card background so it blends in rather than boxing itself */}
      <View style={{ position: 'absolute', width: size * 1.3, height: size * 1.3, borderRadius: size, backgroundColor: stops[1], opacity: 0.14 }} />
      <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }, animStyle]}>
        <LinearGradient colors={[stops[0], stops[1], stops[2]]} start={{ x: 0.3, y: 0.15 }} end={{ x: 0.75, y: 1 }} style={{ width: '100%', height: '100%' }} />
        {/* two soft highlight blobs for a bit of depth */}
        <View style={{ position: 'absolute', width: size * 0.5, height: size * 0.5, borderRadius: size, top: size * 0.08, left: size * 0.1, backgroundColor: '#fff', opacity: 0.16 }} />
        <View style={{ position: 'absolute', width: size * 0.3, height: size * 0.3, borderRadius: size, bottom: size * 0.14, right: size * 0.16, backgroundColor: stops[0], opacity: 0.22 }} />
        {BUBBLES.map((b, i) => (
          <Bubble key={i} size={size} {...b} />
        ))}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: size / 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' }} />
      </Animated.View>
      <View style={{ position: 'absolute', alignItems: 'center' }}>{children}</View>
    </View>
  );
}

export const toneBg = (c: Colors, tone: ProfileTone) => (tone === 'good' ? c.good : tone === 'bad' ? c.bad : c.core);
