import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { dowShort } from '@/lib/format';
import { TRENDS, trendSeries, trendTips, type TrendKey } from '@/lib/trends';
import { useUnitsPrefs } from '@/state/units-prefs';
import { makeStyles, space } from '@/theme';

import { ColumnChart } from './charts';
import { AppText, Card, Chip, SectionHeader } from './ui';

const HOME_TRENDS: TrendKey[] = ['recovery', 'sleepScore', 'strain', 'stress', 'steps', 'active'];

/** "Weekly Trends": pick a metric, see the last 7 days as a column chart. Owns its own metric selection. */
export function WeeklyTrendsCard({ date }: { date: string }) {
  const styles = useStyles();
  const router = useRouter();
  const [trend, setTrend] = useState<TrendKey>('recovery');
  // some trend definitions (distance) read the units store live, so subscribe to re-render on a unit change
  useUnitsPrefs();

  const def = TRENDS[trend];
  const series = trendSeries(trend, date, 7);
  const best = series.values.reduce<number>((b, v, i) => ((v ?? -1) > (series.values[b] ?? -1) ? i : b), 0);

  return (
    <>
      <SectionHeader title="Weekly Trends" action="See all" onAction={() => router.push({ pathname: '/trends', params: { metric: trend } })} />
      <Card>
        <View style={styles.chipRow}>
          {HOME_TRENDS.map((k) => (
            <Chip key={k} label={TRENDS[k].label} active={k === trend} onPress={() => setTrend(k)} />
          ))}
        </View>
        <View style={[styles.cardTitle, { marginTop: space.lg }]}>
          <AppText variant="small" muted style={{ flex: 1 }}>
            Last 7 days · average
          </AppText>
          <AppText variant="h3">
            {def.fmt(series.avg)}{' '}
            <AppText variant="small" muted>
              {def.unit}
            </AppText>
          </AppText>
        </View>
        <ColumnChart values={series.values} labels={series.dates.map((d) => dowShort(d).slice(0, 1))} highlight={best} tips={trendTips(trend, series)} showScale />
      </Card>
    </>
  );
}

const useStyles = makeStyles(() => ({
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
}));
