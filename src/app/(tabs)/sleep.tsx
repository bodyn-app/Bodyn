import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayStrip } from '@/components/day-strip';
import { SleepBody } from '@/components/sleep-view';
import { AppText } from '@/components/ui';
import { useSelectedDate } from '@/state/selected-date';
import { space, useTheme } from '@/theme';

export default function Sleep() {
  const { colors } = useTheme();
  const date = useSelectedDate((s) => s.date);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Ionicons name="moon" size={20} color={colors.lime} />
          <AppText variant="h2">Sleep</AppText>
        </View>

        <DayStrip />
        <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
          Sleep is shown on the day you woke up.
        </AppText>

        <SleepBody date={date} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: space.lg, paddingBottom: space.xxl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
