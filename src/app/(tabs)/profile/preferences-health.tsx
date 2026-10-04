import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppText, Card, DetailScreen, SectionHeader } from '@/components/ui';
import { type ActivityStatus, useHealthPrefs } from '@/state/health-prefs';
import { makeStyles, radius, space, useTheme } from '@/theme';

const STATUS: { v: ActivityStatus; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { v: 'active', label: 'Active', hint: 'Healthy and training normally', icon: 'walk' },
  { v: 'injury', label: 'Injury', hint: 'Recovering from a physical injury', icon: 'bandage' },
  { v: 'sickness', label: 'Sickness', hint: 'Recovering from illness or infection', icon: 'medkit' },
  { v: 'rest', label: 'Rest', hint: 'Taking a break for rest or mental health', icon: 'bed' },
];

/** Sleep/heart-rate inputs the metrics engine actually uses, plus a training-status flag the coach's daily call reads. */
export default function PreferencesHealth() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const prefs = useHealthPrefs();

  return (
    <DetailScreen title="Health Preferences">
      <View style={{ gap: space.md }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }} onPress={() => router.push('/profile/preferences-sleep-goal')}>
          <Ionicons name="bed-outline" size={20} color={colors.limeText} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">Sleep Goal</AppText>
            <AppText variant="small" muted>
              {prefs.sleepGoalMin ? `${(prefs.sleepGoalMin / 60).toFixed(1)} hours` : '8.0 hours (default)'}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Card>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }} onPress={() => router.push('/profile/preferences-heart')}>
          <Ionicons name="heart-outline" size={20} color={colors.limeText} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">Heart Preferences</AppText>
            <AppText variant="small" muted>
              Max HR, resting HR, training zones
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </Card>
      </View>

      <SectionHeader title="Training Status" />
      <AppText variant="small" muted style={{ marginBottom: space.md, marginTop: -space.sm }}>
        Your coach's daily guidance takes this into account.
      </AppText>
      <View style={{ gap: space.sm }}>
        {STATUS.map((s) => {
          const on = prefs.status === s.v;
          return (
            <Card key={s.v} style={[styles.row, on && { borderColor: colors.lime }]} onPress={() => prefs.set({ status: s.v })}>
              <View style={[styles.badge, on && { backgroundColor: colors.lime }]}>
                <Ionicons name={s.icon} size={18} color={on ? colors.onLime : colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="h3">{s.label}</AppText>
                <AppText variant="small" muted>
                  {s.hint}
                </AppText>
              </View>
              {on ? <Ionicons name="checkmark-circle" size={20} color={colors.lime} /> : null}
            </Card>
          );
        })}
      </View>
    </DetailScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
}));
