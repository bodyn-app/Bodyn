import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { metrics, type FitnessBand } from '@/metrics';
import { space, useTheme } from '@/theme';

import { FitnessOrb } from './fitness-orb';
import { AppText, Card } from './ui';

/** ProfileTone equivalent for a fitness-age band, so both the orb and the text agree on colour. */
export const bandTone = (band: FitnessBand) => (band === 'younger' ? 'good' : band === 'older' ? 'bad' : 'neutral') as 'good' | 'bad' | 'neutral';
export const bandColor = (colors: ReturnType<typeof useTheme>['colors'], band: FitnessBand) => (band === 'younger' ? colors.good : band === 'older' ? colors.bad : colors.core);

/** "2.7 years younger" / "About the same" / "1.4 years older" — with `full`, adds "than your age". */
export const deltaText = (delta: number, band: FitnessBand, full = true) => {
  if (band === 'same') return full ? 'About the same as your age' : 'About the same';
  const n = Math.abs(delta);
  return `${n.toFixed(1)} year${n === 1 ? '' : 's'} ${band === 'younger' ? 'younger' : 'older'}${full ? ' than your age' : ''}`;
};

/** Headline card for the Account tab. Tap for the full page. */
export function FitnessAgeCard() {
  const router = useRouter();
  const { colors } = useTheme();
  const f = metrics.fitness();

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }} onPress={() => router.push('/profile/fitness-age')}>
      {f ? (
        <FitnessOrb size={78} tone={bandTone(f.band)}>
          <AppText variant="h2" style={{ fontSize: 26, color: '#fff' }}>
            {f.fitnessAge}
          </AppText>
        </FitnessOrb>
      ) : (
        <View style={{ alignItems: 'center', minWidth: 78 }}>
          <AppText variant="big" style={{ fontSize: 44, color: colors.textMuted }}>
            –
          </AppText>
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="h3">Fitness age</AppText>
        {f ? (
          <>
            <AppText variant="small" style={{ color: bandColor(colors, f.band), fontWeight: '600' }}>
              {deltaText(f.delta, f.band)} ({f.age})
            </AppText>
            <AppText variant="tiny" muted>
              VO2 max {f.vo2.toFixed(1)} · {f.category}
            </AppText>
          </>
        ) : (
          <AppText variant="small" muted>
            Needs VO2 max readings from your Watch
          </AppText>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Card>
  );
}
