import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PillBars, Ring } from '@/components/charts';
import { AppText, Card, DetailScreen, fmtDuration, fmtNum, SectionHeader } from '@/components/ui';
import { addDays, health } from '@/health';
import { clock, dateLabel, dateLong, dowShort, workoutIcon, workoutLabel } from '@/lib/format';
import { useSelectedDate } from '@/state/selected-date';
import { makeStyles, space, useTheme } from '@/theme';

export default function Exercise() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const date = useSelectedDate((s) => s.date);
  const day = health.getDay(date);
  const goal = day?.goals?.exerciseMin || 45;
  const minutes = day?.exerciseMin ?? 0;
  const workouts = health.getWorkouts(date, date);
  const all = health.getWorkouts();
  const range = health.getRange(addDays(date, -13), date);
  const avg = range.reduce((a, r) => a + (r.day?.exerciseMin ?? 0), 0) / range.length;

  return (
    <DetailScreen title="Exercise">
      <AppText variant="small" muted style={{ textAlign: 'center' }}>
        {dateLong(date)}
      </AppText>

      <View style={{ alignItems: 'center', marginVertical: space.lg }}>
        <Ring size={150} stroke={13} progress={minutes / goal} color={colors.lime}>
          <AppText variant="big" style={{ fontSize: 34 }}>
            {minutes}
            <AppText variant="small" muted>
              {' '}
              min
            </AppText>
          </AppText>
          <AppText variant="tiny" muted>
            goal {goal} min
          </AppText>
        </Ring>
        <AppText variant="small" muted style={{ marginTop: space.md }}>
          Stand {day?.standHours ?? 0} / {day?.goals?.standHours ?? 12} hours
        </AppText>
      </View>

      <SectionHeader title="Last 14 days" />
      <Card>
        <PillBars
          values={range.map((r) => r.day?.exerciseMin ?? 0)}
          labels={range.map((r) => dowShort(r.date).slice(0, 1))}
          height={150}
          highlight={13}
          tips={range.map((r) => ({ title: dateLabel(r.date, health.lastDay), value: r.day ? `${r.day.exerciseMin ?? 0} min` : 'No data' }))}
          showScale
          goal={goal}
          format={(v) => `${Math.round(v)}`}
        />
        <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
          Exercise minutes per day · dashed line = your {goal}-minute goal · average {fmtNum(avg)} min
        </AppText>
      </Card>

      <SectionHeader title="Workouts that day" />
      {workouts.length ? (
        <View style={{ gap: space.sm }}>
          {workouts.map((w) => (
            <Card key={w.start} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(all.indexOf(w)) } })} style={styles.row}>
              <View style={styles.icon}>
                <Ionicons name={workoutIcon(w.type)} size={18} color={colors.onLime} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="h3">{workoutLabel(w.type)}</AppText>
                <AppText variant="small" muted>
                  {clock(w.start)} – {clock(w.end)} · {fmtDuration(w.durationMin)} · {fmtNum(w.kcal)} kcal
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Card>
          ))}
        </View>
      ) : (
        <Card>
          <AppText variant="small" muted>
            No workouts recorded on this day.
          </AppText>
        </Card>
      )}
    </DetailScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
}));
