import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { health } from '@/health';
import { makeStyles, space, useTheme } from '@/theme';

import { AreaChart } from './charts';
import { AppText, Card, fmtNum } from './ui';

/** Compact heart-rate tile for the home grid: day average, resting HR and the hourly curve. */
export function HeartRateCard({ date }: { date: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const day = health.getDay(date);

  return (
    <Card style={{ flex: 1 }} onPress={() => router.push('/heart-rate')}>
      <View style={styles.cardTitle}>
        <AppText variant="small" muted style={{ flex: 1 }}>
          Heart rate
        </AppText>
        <Ionicons name="heart-outline" size={16} color={colors.text} />
      </View>
      <AppText variant="h2" style={{ marginBottom: 2 }}>
        {fmtNum(day?.hr?.avg)}{' '}
        <AppText variant="small" lime>
          bpm
        </AppText>
      </AppText>
      <AppText variant="tiny" muted style={{ marginBottom: space.sm }}>
        Resting {fmtNum(day?.rhr)} bpm
      </AppText>
      <AreaChart values={day?.hourly.hr ?? []} height={44} />
    </Card>
  );
}

const useStyles = makeStyles(() => ({
  cardTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
}));
