import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { health } from '@/health';
import { dateLabel, workoutIcon, workoutLabel } from '@/lib/format';
import { convertDistance, convertEnergy, distanceDecimals, distanceLabel, energyLabel } from '@/lib/units';
import { useUnitsPrefs } from '@/state/units-prefs';
import { makeStyles, radius, space, useTheme } from '@/theme';

import { AppText, Card, fmtDuration, fmtNum, SectionHeader, Stat } from './ui';

/** "Summary Activity": a side-scrolling row of the selected day's activity, sleep and each workout. */
export function SummaryActivityCard({ date }: { date: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnitsPrefs();

  const day = health.getDay(date);
  const workouts = health.getWorkouts(date, date);
  const allWorkouts = health.getWorkouts();
  const label = dateLabel(date, health.lastDay);
  const isToday = date === health.lastDay;

  return (
    <>
      <SectionHeader title="Summary Activity" action="See all" onAction={() => router.push('/workouts')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
        <Card style={styles.summaryCard} onPress={() => router.navigate('/activity')}>
          <View style={styles.cardTitle}>
            <Ionicons name="footsteps" size={16} color={colors.lime} />
            <AppText variant="h3" style={{ flex: 1 }}>
              {isToday ? "Today's activity" : `${label}`}
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </View>
          <View style={styles.statRow}>
            <Stat icon="flag" label="Steps" value={fmtNum(day?.steps)} />
            <Stat icon="trending-up" label="Distance" value={day?.distanceKm != null ? fmtNum(convertDistance(day.distanceKm, units.distance), distanceDecimals(units.distance)) : '–'} unit={distanceLabel(units.distance)} />
          </View>
          <View style={styles.statRow}>
            <Stat icon="flame" label="Active" value={day?.activeKcal != null ? fmtNum(convertEnergy(day.activeKcal, units.energy)) : '–'} unit={energyLabel(units.energy)} />
            <Stat icon="pulse" label="Avg HR" value={fmtNum(day?.hr?.avg)} unit="bpm" />
          </View>
        </Card>

        <Card style={styles.summaryCard} onPress={() => router.navigate('/sleep')}>
          <View style={styles.cardTitle}>
            <Ionicons name="moon" size={16} color={colors.lime} />
            <AppText variant="h3" style={{ flex: 1 }}>
              Sleep
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </View>
          {day?.sleep ? (
            <>
              <View style={styles.statRow}>
                <Stat icon="bed" label="Asleep" value={fmtDuration(day.sleep.asleepMin)} />
                <Stat icon="speedometer" label="Efficiency" value={fmtNum(day.sleep.efficiency)} unit="%" />
              </View>
              <View style={styles.statRow}>
                <Stat icon="water" label="Deep" value={fmtDuration(day.sleep.deepMin)} />
                <Stat icon="cloudy-night" label="REM" value={fmtDuration(day.sleep.remMin)} />
              </View>
            </>
          ) : (
            <AppText muted style={{ marginTop: space.sm }}>
              No sleep recorded for this day
            </AppText>
          )}
        </Card>

        {workouts.map((w) => (
          <Card key={w.start} style={styles.summaryCard} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(allWorkouts.indexOf(w)) } })}>
            <View style={styles.cardTitle}>
              <Ionicons name={workoutIcon(w.type)} size={16} color={colors.lime} />
              <AppText variant="h3" style={{ flex: 1 }}>
                {workoutLabel(w.type)}
              </AppText>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
            <View style={styles.statRow}>
              <Stat icon="time" label="Duration" value={fmtDuration(w.durationMin)} />
              <Stat icon="flame" label="Energy" value={w.kcal != null ? fmtNum(convertEnergy(w.kcal, units.energy)) : '–'} unit={energyLabel(units.energy)} />
            </View>
            <View style={styles.statRow}>
              <Stat icon="pulse" label="Avg HR" value={fmtNum(w.hrAvg)} unit="bpm" />
              <Stat icon="heart" label="Max HR" value={fmtNum(w.hrMax)} unit="bpm" />
            </View>
          </Card>
        ))}
      </ScrollView>
    </>
  );
}

const useStyles = makeStyles(() => ({
  summaryCard: { width: 250, gap: space.md, borderRadius: radius.lg },
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  statRow: { flexDirection: 'row', gap: space.md },
}));
