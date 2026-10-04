import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, DetailScreen, fmtDuration, fmtNum } from '@/components/ui';
import { health } from '@/health';
import { dateLabel, workoutIcon, workoutLabel } from '@/lib/format';
import { makeStyles, space, useTheme } from '@/theme';

const PAGE = 40;

export default function Workouts() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const [shown, setShown] = useState(PAGE);
  const all = health.getWorkouts();
  // newest first, keeping each workout's index in the full list for the detail route
  const rows = all.map((w, i) => ({ w, i })).reverse();

  return (
    <DetailScreen title="Workouts">
      <AppText variant="small" muted style={{ marginBottom: space.md }}>
        {all.length} workouts recorded since {health.firstDay}
      </AppText>
      <View style={{ gap: space.sm }}>
        {rows.slice(0, shown).map(({ w, i }) => (
          <Card key={w.start} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: String(i) } })} style={styles.row}>
            <View style={styles.icon}>
              <Ionicons name={workoutIcon(w.type)} size={18} color={colors.onLime} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="h3">{workoutLabel(w.type)}</AppText>
              <AppText variant="small" muted>
                {dateLabel(w.start.slice(0, 10), health.lastDay)} · {fmtDuration(w.durationMin)} · {fmtNum(w.kcal)} kcal
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Card>
        ))}
      </View>
      {shown < rows.length ? (
        <Pressable onPress={() => setShown(shown + PAGE)} style={styles.more}>
          <AppText variant="small" lime>
            Show more
          </AppText>
        </Pressable>
      ) : null}
    </DetailScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  more: { alignItems: 'center', paddingVertical: space.lg },
}));
