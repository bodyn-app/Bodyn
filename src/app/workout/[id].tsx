import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Card, DetailScreen, fmtDuration, fmtNum } from '@/components/ui';
import { health } from '@/health';
import { clock, dateLong, workoutIcon, workoutLabel } from '@/lib/format';
import { convertDistance, convertEnergy, distanceDecimals, distanceLabel, energyLabel } from '@/lib/units';
import { useUnitsPrefs } from '@/state/units-prefs';
import { makeStyles, space, useTheme } from '@/theme';

export default function WorkoutDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const units = useUnitsPrefs();
  const { id } = useLocalSearchParams<{ id: string }>();
  const w = health.getWorkouts()[Number(id)];

  if (!w)
    return (
      <DetailScreen title="Workout">
        <AppText muted>Workout not found.</AppText>
      </DetailScreen>
    );

  // pace stays min/km regardless of the distance unit — converting it to min/mi would need its own toggle, not in scope here
  const paceSec = w.distanceKm && w.durationMin ? Math.round((w.durationMin / w.distanceKm) * 60) : null;
  const pace = paceSec ? `${Math.floor(paceSec / 60)}:${String(paceSec % 60).padStart(2, '0')}` : '–';
  const source = w.source.includes('Watch') ? 'Apple Watch' : 'Apple Health';
  const en = (kcal: number | null) => (kcal == null ? '–' : fmtNum(convertEnergy(kcal, units.energy)));

  return (
    <DetailScreen title={workoutLabel(w.type)}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name={workoutIcon(w.type)} size={32} color={colors.onLime} />
        </View>
        <AppText variant="h2" style={{ marginTop: space.md }}>
          {workoutLabel(w.type)}
        </AppText>
        <AppText variant="small" muted>
          {dateLong(w.start.slice(0, 10))} · {clock(w.start)} – {clock(w.end)}
        </AppText>
      </View>

      <View style={styles.grid}>
        <Big icon="time" label="Duration" value={fmtDuration(w.durationMin)} />
        <Big icon="flame" label="Active calories" value={en(w.kcal)} unit={energyLabel(units.energy)} />
      </View>
      <View style={[styles.grid, { marginTop: space.md }]}>
        <Big icon="battery-charging" label="Total calories" value={w.kcal != null ? en(w.kcal + (w.kcalRest ?? 0)) : '–'} unit={energyLabel(units.energy)} />
        <Big icon="bed" label="Rest calories" value={en(w.kcalRest)} unit={energyLabel(units.energy)} />
      </View>
      <View style={[styles.grid, { marginTop: space.md }]}>
        <Big icon="pulse" label="Average HR" value={fmtNum(w.hrAvg)} unit="bpm" />
        <Big icon="heart" label="Max HR" value={fmtNum(w.hrMax)} unit="bpm" />
      </View>
      {w.distanceKm ? (
        <View style={[styles.grid, { marginTop: space.md }]}>
          <Big icon="trending-up" label="Distance" value={fmtNum(convertDistance(w.distanceKm, units.distance), distanceDecimals(units.distance))} unit={distanceLabel(units.distance)} />
          <Big icon="speedometer" label="Avg pace" value={pace} unit="min/km" />
        </View>
      ) : null}
      <Card style={{ marginTop: space.md }}>
        <AppText variant="small" muted>
          Min heart rate {fmtNum(w.hrMin)} bpm · Recorded by {source}
          {w.route ? ' · GPS route available' : ''}
        </AppText>
      </Card>
    </DetailScreen>
  );
}

function Big({ icon, label, value, unit }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; unit?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Card style={{ flex: 1, gap: 4 }}>
      <View style={styles.row}>
        <Ionicons name={icon} size={14} color={colors.lime} />
        <AppText variant="small" muted>
          {label}
        </AppText>
      </View>
      <AppText variant="h2">
        {value}
        {unit ? (
          <AppText variant="small" muted>
            {' '}
            {unit}
          </AppText>
        ) : null}
      </AppText>
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  hero: { alignItems: 'center', marginVertical: space.lg },
  heroIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
}));
