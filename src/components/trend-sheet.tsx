import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { health } from '@/health';
import { dateLong } from '@/lib/format';
import { TRENDS, type TrendKey } from '@/lib/trends';
import { makeStyles, space, useTheme } from '@/theme';

import { RANGES, TrendBody, type Range } from './trend-body';
import { AppText, Chip } from './ui';

/**
 * The same chart/summary a metric's "View trend" would show, opened as a sheet over the current page
 * instead of navigating away. Closes with the X, top right.
 */
export function TrendSheet({ visible, metricKey, onClose }: { visible: boolean; metricKey: TrendKey; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [range, setRange] = useState<Range>(30);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={{ width: 36 }} />
          <AppText variant="h2">{TRENDS[metricKey].label}</AppText>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityLabel="Close">
            <Ionicons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl }} showsVerticalScrollIndicator={false}>
          <AppText variant="small" muted style={{ textAlign: 'center' }}>
            Ending {dateLong(health.lastDay)}
          </AppText>
          <View style={[styles.chips, { marginTop: space.lg }]}>
            {RANGES.map((r) => (
              <Chip key={r} label={`${r} days`} active={r === range} onPress={() => setRange(r)} />
            ))}
          </View>
          <TrendBody metricKey={metricKey} endDate={health.lastDay} range={range} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
}));
