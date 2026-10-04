import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Chip, AppText, DetailScreen } from '@/components/ui';
import { RANGES, TrendBody, type Range } from '@/components/trend-body';
import { dateLong } from '@/lib/format';
import { TREND_KEYS, TRENDS, type TrendKey } from '@/lib/trends';
import { useSelectedDate } from '@/state/selected-date';
import { makeStyles, space } from '@/theme';

export default function Trends() {
  const styles = useStyles();
  const params = useLocalSearchParams<{ metric?: string }>();
  const date = useSelectedDate((s) => s.date);
  const [key, setKey] = useState<TrendKey>(TREND_KEYS.includes(params.metric as TrendKey) ? (params.metric as TrendKey) : 'steps');
  const [range, setRange] = useState<Range>(30);

  return (
    <DetailScreen title="Trends">
      <AppText variant="small" muted style={{ textAlign: 'center' }}>
        Ending {dateLong(date)}
      </AppText>

      <View style={[styles.chips, { marginTop: space.lg }]}>
        {TREND_KEYS.map((k) => (
          <Chip key={k} label={TRENDS[k].label} active={k === key} onPress={() => setKey(k)} />
        ))}
      </View>
      <View style={[styles.chips, { marginTop: space.sm }]}>
        {RANGES.map((r) => (
          <Chip key={r} label={`${r} days`} active={r === range} onPress={() => setRange(r)} />
        ))}
      </View>

      <TrendBody metricKey={key} endDate={date} range={range} />
    </DetailScreen>
  );
}

const useStyles = makeStyles(() => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
}));
