import { StyleSheet, View } from 'react-native';

import { AreaChart, LineChart } from '@/components/charts';
import { AppText, Card, DetailScreen, fmtDuration, fmtNum, SectionHeader } from '@/components/ui';
import { health } from '@/health';
import { dateLong, dowShort } from '@/lib/format';
import { metrics, zoneMinutes } from '@/metrics';
import { trendSeries, trendTips } from '@/lib/trends';
import { useSelectedDate } from '@/state/selected-date';
import { makeStyles, space, type Colors, useTheme } from '@/theme';

const zonesOf = (colors: Colors) => [
  { label: 'Zone 1 · Very light', sub: 'under 60% of max', color: colors.rest },
  { label: 'Zone 2 · Light', sub: '60–70%', color: colors.good },
  { label: 'Zone 3 · Moderate', sub: '70–80%', color: colors.warn },
  { label: 'Zone 4 · Hard', sub: '80–90%', color: colors.awake },
  { label: 'Zone 5 · Maximum', sub: 'over 90%', color: colors.bad },
];

export default function HeartRate() {
  const { colors } = useTheme();
  const ZONES = zonesOf(colors);
  const styles = useStyles();
  const date = useSelectedDate((s) => s.date);
  const day = health.getDay(date);
  const hr = day?.hr;
  const { hrMax, hrRest } = metrics.hrProfile(date);
  const zoneMin = zoneMinutes(hr?.hist, hrMax);
  // Zone 1 includes all resting/sleeping hours, so scale bars against Zones 2–5 (Zone 1 is capped at full)
  const zoneMax = Math.max(...zoneMin.slice(1), 1);
  const rhr = trendSeries('rhr', date, 14);

  return (
    <DetailScreen title="Heart rate">
      <AppText variant="small" muted style={{ textAlign: 'center' }}>
        {dateLong(date)}
      </AppText>

      <View style={[styles.grid, { marginTop: space.md }]}>
        <Big label="Average" value={fmtNum(hr?.avg)} />
        <Big label="Resting" value={fmtNum(day?.rhr)} />
      </View>
      <View style={[styles.grid, { marginTop: space.md }]}>
        <Big label="Lowest" value={fmtNum(hr?.min)} />
        <Big label="Highest" value={fmtNum(hr?.max)} />
      </View>

      <SectionHeader title="Through the day" />
      <Card>
        <AreaChart values={day?.hourly.hr ?? []} height={170} showScale xLabels={['00:00', '06:00', '12:00', '18:00', '24:00']} />
        <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
          Average heart rate per hour (bpm)
        </AppText>
      </Card>

      <SectionHeader title="Time in heart-rate zones" />
      <Card style={{ gap: space.md }}>
        {ZONES.map((z, i) => (
          <View key={z.label} style={{ gap: 4 }}>
            <View style={styles.row}>
              <AppText variant="small" style={{ flex: 1 }}>
                {z.label} <AppText variant="tiny" muted>{z.sub}</AppText>
              </AppText>
              <AppText variant="small" muted>
                {fmtDuration(Math.round(zoneMin[i]))}
              </AppText>
            </View>
            <View style={styles.track}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: z.color, width: `${Math.min(1, zoneMin[i] / zoneMax) * 100}%` }} />
            </View>
          </View>
        ))}
        <AppText variant="tiny" muted>
          Max heart rate {fmtNum(hrMax)} bpm · resting {fmtNum(hrRest)} bpm
        </AppText>
      </Card>

      <SectionHeader title="Resting heart rate · 14 days" />
      <Card>
        <LineChart
          values={rhr.values}
          labels={rhr.dates.map((d) => dowShort(d).slice(0, 1))}
          tips={trendTips('rhr', rhr)}
          highlight={13}
          showScale
          height={150}
          glow
        />
      </Card>
    </DetailScreen>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ flex: 1 }}>
      <AppText variant="small" muted>
        {label}
      </AppText>
      <AppText variant="h1">
        {value}{' '}
        <AppText variant="small" lime>
          bpm
        </AppText>
      </AppText>
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  grid: { flexDirection: 'row', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.barIdle, overflow: 'hidden' },
}));
