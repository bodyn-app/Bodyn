import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { metrics, type StressHour } from '@/metrics';
import { type Colors, space, useTheme } from '@/theme';

import { LevelBars, type LevelBar } from './charts';
import { AppText, Card } from './ui';

export const levelColor = (c: Colors, level: number) => (level < 1 ? c.good : level < 2 ? c.warn : c.bad);

/** One bar per hour: coloured by stress level when awake and inactive, a grey stub when asleep, a blue stub when active. */
export function stressBars(c: Colors, hours: StressHour[]): LevelBar[] {
  return hours.map((h) =>
    h.level != null
      ? { value: h.level, color: levelColor(c, h.level) }
      : { value: null, color: h.state === 'asleep' ? c.barIdle : h.state === 'active' ? c.rest : 'transparent' }
  );
}

/** Slim card for Home: today's stress level plus a tiny hour-by-hour strip. Tap for the full page. */
export function StressCard({ date }: { date: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const s = metrics.stress(date);

  return (
    <Card style={{ marginTop: space.lg, gap: space.md }} onPress={() => router.push('/stress')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <AppText variant="h3" style={{ flex: 1 }}>
          Stress
        </AppText>
        {s ? (
          <>
            <AppText variant="h2" style={{ color: levelColor(colors, s.level) }}>
              {s.level.toFixed(1)}
              <AppText variant="small" muted>
                {' '}
                / 3
              </AppText>
            </AppText>
            <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.surfaceAlt }}>
              <AppText variant="tiny" style={{ color: levelColor(colors, s.level), fontWeight: '700' }}>
                {s.label}
              </AppText>
            </View>
          </>
        ) : null}
      </View>
      {s ? (
        <LevelBars bars={stressBars(colors, s.hours)} height={44} captions={['00:00', '06:00', '12:00', '18:00', '24:00']} />
      ) : (
        <AppText variant="small" muted>
          Not enough daytime heart-rate data for this day.
        </AppText>
      )}
      <AppText variant="tiny" muted>
        Awake, inactive hours only · tap for details
      </AppText>
    </Card>
  );
}
