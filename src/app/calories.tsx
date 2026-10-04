import { StyleSheet, View } from 'react-native';

import { MiniBars, StackedBars } from '@/components/charts';
import { AppText, Card, DetailScreen, fmtNum, SectionHeader } from '@/components/ui';
import { addDays, health } from '@/health';
import { dateLabel, dateLong, dowShort } from '@/lib/format';
import { useSelectedDate } from '@/state/selected-date';
import { makeStyles, space, useTheme } from '@/theme';

export default function Calories() {
  const styles = useStyles();
  const { colors } = useTheme();
  const date = useSelectedDate((s) => s.date);
  const day = health.getDay(date);
  const active = day?.activeKcal ?? 0;
  const rest = day?.basalKcal ?? 0;
  const total = active + rest;
  const week = health.getRange(addDays(date, -6), date);
  const weekAvg = week.reduce((a, r) => a + (r.day?.activeKcal ?? 0), 0) / Math.max(1, week.filter((r) => r.day?.activeKcal).length);

  return (
    <DetailScreen title="Calories">
      <AppText variant="small" muted style={{ textAlign: 'center' }}>
        {dateLong(date)}
      </AppText>

      <Card style={{ marginTop: space.md }}>
        <AppText variant="small" muted>
          Total burned
        </AppText>
        <AppText variant="big">
          {fmtNum(total)}{' '}
          <AppText variant="small" lime>
            kcal
          </AppText>
        </AppText>
        <View style={styles.splitBar}>
          <View style={{ flex: Math.max(active, 0.001), backgroundColor: colors.lime }} />
          <View style={{ flex: Math.max(rest, 0.001), backgroundColor: colors.rest }} />
        </View>
        <View style={styles.legend}>
          <Legend color={colors.lime} label="Active" value={active} note="from movement and workouts" />
          <Legend color={colors.rest} label="Rest" value={rest} note="body at rest (basal)" />
        </View>
      </Card>

      <SectionHeader title="Active calories by hour" />
      <Card>
        <MiniBars values={day?.hourly.activeKcal ?? new Array(24).fill(0)} height={130} showScale xLabels={['00:00', '06:00', '12:00', '18:00', '24:00']} />
        <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
          kcal burned per hour
        </AppText>
      </Card>

      <SectionHeader title="Last 7 days" />
      <Card>
        <StackedBars
          values={week.map((r) => ({ a: r.day?.activeKcal ?? 0, b: r.day?.basalKcal ?? 0 }))}
          labels={week.map((r) => dowShort(r.date).slice(0, 1))}
          highlight={6}
          height={150}
          tips={week.map((r) => ({ title: dateLabel(r.date, health.lastDay), value: r.day ? `${fmtNum((r.day.activeKcal ?? 0) + (r.day.basalKcal ?? 0))} kcal` : 'No data' }))}
          showScale
        />
        <AppText variant="tiny" muted style={{ marginTop: space.md }}>
          Average active calories: {fmtNum(weekAvg)} kcal/day
        </AppText>
      </Card>
    </DetailScreen>
  );
}

function Legend({ color, label, value, note }: { color: string; label: string; value: number; note: string }) {
  const styles = useStyles();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={styles.row}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <AppText variant="small" muted>
          {label}
        </AppText>
      </View>
      <AppText variant="h3">{fmtNum(value)} kcal</AppText>
      <AppText variant="tiny" muted>
        {note}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  splitBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: space.lg, gap: 2 },
  legend: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
}));
