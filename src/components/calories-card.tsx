import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { health } from '@/health';
import { convertEnergy, energyLabel } from '@/lib/units';
import { useUnitsPrefs } from '@/state/units-prefs';
import { makeStyles, space, useTheme } from '@/theme';

import { MiniBars } from './charts';
import { AppText, Card, fmtNum } from './ui';

/** Compact calories tile for the home grid: total for the day, the active/rest split and an hourly sparkline. */
export function CaloriesCard({ date }: { date: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const units = useUnitsPrefs();
  const day = health.getDay(date);
  const active = day?.activeKcal ?? 0;
  const rest = day?.basalKcal ?? 0;

  return (
    <Card style={{ flex: 1 }} onPress={() => router.push('/calories')}>
      <View style={styles.cardTitle}>
        <AppText variant="small" muted style={{ flex: 1 }}>
          Calories
        </AppText>
        <Ionicons name="flame" size={16} color={colors.text} />
      </View>
      <AppText variant="h2" style={{ marginBottom: 2 }}>
        {fmtNum(convertEnergy(active + rest, units.energy))}{' '}
        <AppText variant="small" lime>
          {energyLabel(units.energy)}
        </AppText>
      </AppText>
      <AppText variant="tiny" muted style={{ marginBottom: space.sm }}>
        {fmtNum(convertEnergy(active, units.energy))} active · {fmtNum(convertEnergy(rest, units.energy))} rest
      </AppText>
      <MiniBars values={day?.hourly.activeKcal ?? new Array(24).fill(0)} />
    </Card>
  );
}

const useStyles = makeStyles(() => ({
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
}));
