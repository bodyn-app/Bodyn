import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { RangeSlider } from '@/components/slider';
import { AppText, Card, DetailScreen } from '@/components/ui';
import { useHealthPrefs } from '@/state/health-prefs';
import { space, useTheme } from '@/theme';

const MIN_MIN = 300; // 5h
const MAX_MIN = 660; // 11h
const STEP_MIN = 6; // 0.1h, so the slider reads out to one decimal place
const DEFAULT_MIN = 480;
const hours = (min: number) => (min / 60).toFixed(1);

/** Overrides the engine's 8h sleep-need base — the strain-based extra (up to 30 more min on a hard day) stays on top. */
export default function PreferencesSleepGoal() {
  const { colors } = useTheme();
  const prefs = useHealthPrefs();
  const goalMin = prefs.sleepGoalMin ?? DEFAULT_MIN;

  return (
    <DetailScreen title="Sleep Goal">
      <Card style={{ alignItems: 'center', gap: space.md }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: colors.core, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="moon" size={26} color={colors.core} />
        </View>
        <AppText variant="h2">Sleep Duration Goal</AppText>
        <AppText variant="small" muted style={{ textAlign: 'center' }}>
          Adjust your ideal sleep duration. Bodyn adds a little more on nights after a hard training day.
        </AppText>

        <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.core, marginTop: space.sm }}>
          <AppText variant="h2" style={{ color: colors.core }}>
            {hours(goalMin)} hours
          </AppText>
        </View>

        <View style={{ width: '100%', marginTop: space.md }}>
          <RangeSlider value={goalMin} min={MIN_MIN} max={MAX_MIN} step={STEP_MIN} onChange={(v) => prefs.set({ sleepGoalMin: v })} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm }}>
            <AppText variant="small" muted>{hours(MIN_MIN)}h</AppText>
            <AppText variant="small" style={{ color: colors.core, fontWeight: '700' }}>{hours(goalMin)}h</AppText>
            <AppText variant="small" muted>{hours(MAX_MIN)}h</AppText>
          </View>
        </View>

        <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
          Most adults need 7–9 hours of quality sleep per night.
        </AppText>
      </Card>
    </DetailScreen>
  );
}
