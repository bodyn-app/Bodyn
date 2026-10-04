import { View } from 'react-native';

import { dayNum } from '@/lib/format';
import { TRENDS, trendSeries, trendTips, type TrendKey } from '@/lib/trends';
import { useUnitsPrefs } from '@/state/units-prefs';
import { makeStyles, space } from '@/theme';

import { ColumnChart, LineChart } from './charts';
import { AppText, Card } from './ui';

export const RANGES = [7, 14, 30, 60, 90] as const;
export type Range = (typeof RANGES)[number];

/** The chart + summary cards for one metric and range. Shared by the Trends page and the Fitness age trend sheet. */
export function TrendBody({ metricKey, endDate, range }: { metricKey: TrendKey; endDate: string; range: Range }) {
  const styles = useStyles();
  // TRENDS['distance'] reads the units store live (via a getter), but this component still needs its own
  // subscription so it re-renders the moment the unit changes, rather than waiting for an unrelated re-render.
  useUnitsPrefs();
  const def = TRENDS[metricKey];
  const s = trendSeries(metricKey, endDate, range);
  const best = s.values.reduce<number>((b, v, i) => {
    if (v == null || v <= 0) return b;
    const cur = s.values[b];
    if (cur == null || cur <= 0) return i;
    return (def.lowerIsBetter ? v < cur : v > cur) ? i : b;
  }, 0);
  const labelEvery = range === 7 || range === 14 ? 1 : range === 30 ? 5 : range === 60 ? 10 : 15;

  return (
    <>
      <Card style={{ marginTop: space.lg }}>
        {metricKey === 'rhr' ? (
          // heart-rate-related trend: same glow line style as the Heart rate page
          <LineChart values={s.values} labels={s.dates.map((d) => dayNum(d))} labelEvery={labelEvery} highlight={best} tips={trendTips(metricKey, s)} height={190} showScale glow />
        ) : (
          <ColumnChart
            values={s.values}
            labels={s.dates.map((d) => dayNum(d))}
            labelEvery={labelEvery}
            highlight={best}
            tips={trendTips(metricKey, s)}
            height={190}
            showScale
            format={metricKey === 'sleep' ? (v) => `${Math.round((v / 60) * 10) / 10}h` : undefined}
          />
        )}
      </Card>

      <View style={[styles.chips, { marginTop: space.md, justifyContent: 'space-between' }]}>
        <Summary label="Average" value={`${def.fmt(s.avg)} ${def.unit}`} />
        <Summary label={def.lowerIsBetter ? 'Lowest' : 'Best day'} value={`${def.fmt(s.best)} ${def.unit}`} />
        {def.total ? <Summary label="Total" value={`${def.fmt(s.total)} ${def.unit}`} /> : null}
        <Summary label="Days with data" value={`${s.daysWithData} / ${range}`} />
      </View>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <Card style={styles.summary}>
      <AppText variant="small" muted>
        {label}
      </AppText>
      <AppText variant="h3">{value}</AppText>
    </Card>
  );
}

const useStyles = makeStyles(() => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  summary: { width: '48%', gap: 4 },
}));
