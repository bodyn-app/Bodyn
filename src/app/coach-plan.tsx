import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { coach, verdictMeta } from '@/coach';
import { toneColor } from '@/components/guidance-card';
import { AppText, Card, DetailScreen, SectionHeader } from '@/components/ui';
import { health } from '@/health';
import { dateLabel } from '@/lib/format';
import { metrics } from '@/metrics';
import { useSelectedDate } from '@/state/selected-date';
import { makeStyles, radius, space, useTheme } from '@/theme';

/** Where the day's strain sits against the suggested range, on the 0–21 scale. */
function TargetBar({ target, strain, color }: { target: [number, number]; strain: number | null; color: string }) {
  const { colors } = useTheme();
  const pct = (v: number) => `${Math.min(100, (v / 21) * 100)}%` as const;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: pct(target[0]), width: `${((target[1] - target[0]) / 21) * 100}%`, top: 0, bottom: 0, backgroundColor: color, opacity: 0.35 }} />
        {strain != null ? <View style={{ position: 'absolute', left: 0, width: pct(strain), top: 0, bottom: 0, backgroundColor: color, borderRadius: 5 }} /> : null}
      </View>
      <AppText variant="tiny" muted>
        Suggested strain {target[0]}–{target[1]}
        {strain != null ? ` · so far ${strain.toFixed(1)}` : ''}
      </AppText>
    </View>
  );
}

/** The coach's call for the selected day and a suggested week. The chat itself lives on /coach. */
export default function CoachPlan() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const date = useSelectedDate((s) => s.date);
  const advice = useMemo(() => coach.advice(date), [date]);
  const plan = useMemo(() => coach.week(date), [date]);
  const strain = metrics.strain(date)?.strain ?? null;
  const tone = toneColor(colors, advice.tone);

  return (
    <DetailScreen title="Today's plan">
      <AppText variant="small" muted>
        {date === health.lastDay ? 'Guidance for today' : `Guidance for ${dateLabel(date, health.lastDay)} ${date.slice(0, 4)}`}
      </AppText>

      <Card style={{ marginTop: space.md, gap: space.md }}>
        <View style={styles.row}>
          <View style={styles.badge}>
            <Ionicons name={advice.icon} size={22} color={tone} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="tiny" style={{ color: tone, fontWeight: '700', letterSpacing: 0.6 }}>
              {advice.title.toUpperCase()}
            </AppText>
            <AppText variant="h3">{advice.headline}</AppText>
          </View>
        </View>
        <AppText variant="small" muted>
          {advice.body}
        </AppText>
        {advice.actions.map((t) => (
          <View key={t} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tone, marginTop: 7 }} />
            <AppText style={{ flex: 1 }}>{t}</AppText>
          </View>
        ))}
        {advice.target ? <TargetBar target={advice.target} strain={strain} color={tone} /> : null}
      </Card>

      <SectionHeader title="Your week" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {plan.map((p) => {
          const m = verdictMeta(p.verdict);
          const c = toneColor(colors, m.tone);
          return (
            <View key={p.date} style={[styles.dayCell, p.isToday && { borderColor: colors.lime }]}>
              <AppText variant="small" muted>
                {p.label}
              </AppText>
              <Ionicons name={m.icon} size={20} color={c} />
              <AppText variant="tiny" style={{ color: c, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
                {m.title}
              </AppText>
              <AppText variant="tiny" muted>
                {p.target && p.target[1] > 4 ? `${p.target[0]}–${p.target[1]}` : '–'}
              </AppText>
            </View>
          );
        })}
      </ScrollView>
      <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
        Suggested. Today comes from your recovery; the other days follow your recent load and update as new data arrives.
      </AppText>

      <Pressable onPress={() => router.push('/coach')} style={styles.askBtn} accessibilityLabel="Ask your coach">
        <Ionicons name="sparkles" size={18} color={colors.onLime} />
        <AppText variant="h3" style={{ color: colors.onLime }}>
          Ask your coach
        </AppText>
      </Pressable>
      <AppText variant="tiny" muted style={{ textAlign: 'center', marginTop: space.md }}>
        General guidance from your data, not medical advice.
      </AppText>
    </DetailScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  dayCell: { width: 76, alignItems: 'center', gap: 6, paddingVertical: space.md, paddingHorizontal: 6, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  askBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, marginTop: space.xl, height: 50, borderRadius: radius.pill, backgroundColor: colors.lime },
}));
