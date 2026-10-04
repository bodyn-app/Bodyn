import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AreaChart, MiniBars, PillBars } from '@/components/charts';
import { DayStrip } from '@/components/day-strip';
import { AppText, Card, fmtDuration, fmtNum } from '@/components/ui';
import { health } from '@/health';
import { convertDistance, convertEnergy, distanceDecimals, distanceLabel, energyLabel } from '@/lib/units';
import { DEFAULT_GLASS_ML, entriesOnDay, useIntakeLog } from '@/state/intake-log';
import { useSelectedDate } from '@/state/selected-date';
import { useUnitsPrefs } from '@/state/units-prefs';
import { makeStyles, space, useTheme } from '@/theme';

const BLOCKS = ['00', '03', '06', '09', '12', '15', '18', '21'];

export default function Activity() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const date = useSelectedDate((s) => s.date);
  const day = health.getDay(date);
  const units = useUnitsPrefs();
  const dist = (km: number | null | undefined) => (km == null ? '–' : fmtNum(convertDistance(km, units.distance), distanceDecimals(units.distance)));
  const en = (kcal: number | null | undefined) => (kcal == null ? '–' : fmtNum(convertEnergy(kcal, units.energy)));
  const intake = useIntakeLog((s) => s.entries);
  const todayIntake = entriesOnDay(intake);
  const waterMl = todayIntake.filter((e) => e.kind === 'water').reduce((t, e) => t + (e.ml ?? DEFAULT_GLASS_ML), 0);
  const caffeineCount = todayIntake.filter((e) => e.kind === 'caffeine').length;

  // aggregate hourly steps into 3-hour blocks
  const steps = day?.hourly.steps ?? new Array(24).fill(0);
  const blocks = BLOCKS.map((_, i) => steps.slice(i * 3, i * 3 + 3).reduce((a, b) => a + b, 0));
  const peak = blocks.indexOf(Math.max(...blocks));

  const hr = day?.hr;
  const active = day?.activeKcal ?? 0;
  const rest = day?.basalKcal ?? 0;
  const total = active + rest;
  const moveGoal = day?.goals?.moveKcal || 1000;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Ionicons name="walk" size={20} color={colors.lime} />
          <AppText variant="h2">Activity</AppText>
        </View>

        <DayStrip />

        <Card style={{ marginTop: space.lg }}>
          <View style={styles.title}>
            <AppText variant="h3" style={{ flex: 1 }}>
              Steps by time of day
            </AppText>
            <AppText variant="small" muted>
              {fmtNum(day?.steps)} steps · {dist(day?.distanceKm)} {distanceLabel(units.distance)}
            </AppText>
          </View>
          <View style={{ marginTop: space.lg }}>
            <PillBars
              values={blocks}
              labels={BLOCKS.map((b) => `${b}:00`)}
              highlight={peak}
              tips={blocks.map((v, i) => ({ title: `${BLOCKS[i]}:00 – ${String((i * 3 + 3) % 24).padStart(2, '0')}:00`, value: `${fmtNum(v)} steps` }))}
              showScale
            />
          </View>
        </Card>

        {/* calories: total + split */}
        <Card style={{ marginTop: space.md }} onPress={() => router.push('/calories')}>
          <View style={styles.title}>
            <AppText variant="small" muted style={{ flex: 1 }}>
              Total calories burned
            </AppText>
            <Ionicons name="flame" size={16} color={colors.text} />
          </View>
          <AppText variant="big" style={{ marginTop: 4 }}>
            {en(total)}{' '}
            <AppText variant="small" lime>
              {energyLabel(units.energy)}
            </AppText>
          </AppText>
          <View style={styles.splitBar}>
            <View style={{ flex: Math.max(active, 0.001), backgroundColor: colors.lime }} />
            <View style={{ flex: Math.max(rest, 0.001), backgroundColor: colors.rest }} />
          </View>
          <View style={styles.legend}>
            <Legend color={colors.lime} label="Active" value={convertEnergy(active, units.energy)} unit={energyLabel(units.energy)} />
            <Legend color={colors.rest} label="Rest" value={convertEnergy(rest, units.energy)} unit={energyLabel(units.energy)} />
          </View>
        </Card>

        <View style={[styles.grid, { marginTop: space.md }]}>
          <Card style={{ flex: 1 }} onPress={() => router.push('/calories')}>
            <View style={styles.title}>
              <View style={[styles.dot, { backgroundColor: colors.lime }]} />
              <AppText variant="small" muted style={{ flex: 1 }}>
                Active calories
              </AppText>
            </View>
            <AppText variant="h2" style={{ marginVertical: space.sm }}>
              {en(active)}{' '}
              <AppText variant="small" lime>
                {energyLabel(units.energy)}
              </AppText>
            </AppText>
            <MiniBars values={day?.hourly.activeKcal ?? new Array(24).fill(0)} />
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.min(100, (active / moveGoal) * 100)}%` }]} />
            </View>
            <AppText variant="tiny" muted style={{ marginTop: 6 }}>
              Move goal {en(moveGoal)} {energyLabel(units.energy)}
            </AppText>
          </Card>
          <Card style={{ flex: 1 }} onPress={() => router.push('/calories')}>
            <View style={styles.title}>
              <View style={[styles.dot, { backgroundColor: colors.rest }]} />
              <AppText variant="small" muted style={{ flex: 1 }}>
                Rest calories
              </AppText>
            </View>
            <AppText variant="h2" style={{ marginVertical: space.sm }}>
              {en(rest)}{' '}
              <AppText variant="small" style={{ color: colors.rest }}>
                {energyLabel(units.energy)}
              </AppText>
            </AppText>
            <AppText variant="tiny" muted>
              Energy your body burns at rest (basal metabolism), even without moving.
            </AppText>
            <AppText variant="tiny" muted style={{ marginTop: 8 }}>
              {total ? Math.round((rest / total) * 100) : 0}% of today&apos;s total
            </AppText>
          </Card>
        </View>

        <Card style={{ marginTop: space.md }} onPress={() => router.push('/quick-log')}>
          <View style={styles.title}>
            <AppText variant="small" muted style={{ flex: 1 }}>
              Water & caffeine
            </AppText>
            <Ionicons name="water-outline" size={16} color={colors.text} />
          </View>
          <View style={[styles.grid, { marginTop: space.sm }]}>
            <Legend color={colors.rest} label="Water" value={waterMl} unit="ml" />
            <Legend color={colors.warn} label="Caffeine" value={caffeineCount} unit={caffeineCount === 1 ? 'drink' : 'drinks'} />
          </View>
          <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
            Tap to log water or a coffee
          </AppText>
        </Card>

        <Card style={{ marginTop: space.md }} onPress={() => router.push('/exercise')}>
          <View style={styles.title}>
            <AppText variant="small" muted style={{ flex: 1 }}>
              Exercise
            </AppText>
            <Ionicons name="timer-outline" size={16} color={colors.text} />
          </View>
          <AppText variant="h2" style={{ marginVertical: space.sm }}>
            {fmtDuration(day?.exerciseMin)}
          </AppText>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, ((day?.exerciseMin ?? 0) / (day?.goals?.exerciseMin || 45)) * 100)}%` }]} />
          </View>
          <AppText variant="tiny" muted style={{ marginTop: 6 }}>
            Goal {day?.goals?.exerciseMin ?? 45} min · Stand {day?.standHours ?? 0}/{day?.goals?.standHours ?? 12} h
          </AppText>
        </Card>

        <Card style={{ marginTop: space.md }} onPress={() => router.push('/heart-rate')}>
          <View style={styles.title}>
            <AppText variant="h2" style={{ flex: 1 }}>
              {fmtNum(hr?.avg)}{' '}
              <AppText variant="small" lime>
                Bpm
              </AppText>
            </AppText>
            <Ionicons name="heart-outline" size={18} color={colors.text} />
          </View>
          <View style={{ marginTop: space.md }}>
            <AreaChart values={day?.hourly.hr ?? []} height={130} showScale xLabels={['00:00', '06:00', '12:00', '18:00', '24:00']} />
          </View>
        </Card>
        <View style={styles.minMax}>
          <AppText variant="small" muted>
            Min <AppText variant="small">{fmtNum(hr?.min)} bpm</AppText>
          </AppText>
          <AppText variant="small" muted>
            Resting <AppText variant="small">{fmtNum(day?.rhr)} bpm</AppText>
          </AppText>
          <AppText variant="small" muted>
            Max <AppText variant="small">{fmtNum(hr?.max)} bpm</AppText>
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Legend({ color, label, value, unit = 'kcal' }: { color: string; label: string; value: number; unit?: string }) {
  const styles = useStyles();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <View style={styles.title}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <AppText variant="tiny" muted>
          {label}
        </AppText>
      </View>
      <AppText variant="h3">
        {fmtNum(value)} {unit}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  scroll: { padding: space.lg, paddingBottom: space.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  grid: { flexDirection: 'row', gap: space.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
  splitBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: space.lg, gap: 2 },
  legend: { flexDirection: 'row', gap: space.md, marginTop: space.md },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.barIdle, overflow: 'hidden', marginTop: space.md },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.lime },
  minMax: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md, paddingHorizontal: space.sm },
}));
