import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Card, DetailScreen, SectionHeader } from '@/components/ui';
import { clockText, localDay, notifications, type PlannedNotification } from '@/notifications';
import { categoryColor } from '@/notifications/colors';
import { useNotificationPrefs } from '@/state/notification-prefs';
import { makeStyles, radius, space, useTheme } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const ICON: Record<string, IconName> = { winddown: 'moon', early: 'moon', focus: 'bulb', dip: 'battery-half', activity: 'walk', lastcall: 'cafe' };
const iconFor = (p: PlannedNotification): IconName => ICON[p.kind] ?? (p.category === 'hydration' ? 'water' : 'notifications');

const time = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** One row per moment of the day, with a bar showing where they sit between waking and bedtime. */
function DayTimeline() {
  const { colors } = useTheme();
  const m = useMemo(() => notifications.day(), []);
  const segs: { key: string; from: number; to: number; color: string; label: string }[] = [
    { key: 'focus', from: m.windows[0].start, to: m.windows[0].end, color: colors.core, label: m.low ? 'Light focus' : 'Best focus' },
    { key: 'dip', from: m.windows[1].start, to: m.windows[1].end, color: colors.warn, label: 'Afternoon dip' },
    { key: 'activity', from: m.windows[2].start, to: m.windows[2].end, color: colors.good, label: m.low ? 'Gentle movement' : 'Best time to be active' },
    { key: 'winddown', from: m.windows[3].start, to: m.windows[3].end, color: colors.rem, label: 'Wind down' },
  ];
  // bar pieces, including the gaps between windows
  const pieces: { flex: number; color: string }[] = [];
  let cursor = m.wake;
  for (const s of segs) {
    if (s.from > cursor) pieces.push({ flex: s.from - cursor, color: colors.surfaceAlt });
    pieces.push({ flex: Math.max(1, Math.min(s.to, m.bed) - s.from), color: s.color });
    cursor = Math.min(s.to, m.bed);
  }
  if (cursor < m.bed) pieces.push({ flex: m.bed - cursor, color: colors.surfaceAlt });

  return (
    <Card style={{ gap: space.md }}>
      <View>
        <AppText variant="h3">Your day</AppText>
        <AppText variant="tiny" muted>
          {m.personal ? `Estimated from your usual wake time, ${clockText(m.wake)}` : 'Estimated from a typical 07:00 wake time until we have a few of your nights'}
        </AppText>
      </View>
      <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 }}>
        {pieces.map((p, i) => (
          <View key={i} style={{ flex: p.flex, backgroundColor: p.color }} />
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <Row dot={colors.textDim} label="Wake" value={clockText(m.wake)} />
        {segs.map((s) => (
          <Row key={s.key} dot={s.color} label={s.label} value={`${clockText(s.from)}–${clockText(s.to)}`} />
        ))}
        {m.caffeineCutoff != null ? <Row dot={colors.warn} label="Last caffeine" value={`before ${clockText(m.caffeineCutoff)}`} hollow /> : null}
        <Row dot={colors.textDim} label={m.early ? 'Bed tonight (earlier than usual)' : 'Bed'} value={clockText(m.bed)} />
      </View>
    </Card>
  );
}

function Row({ dot, label, value, hollow }: { dot: string; label: string; value: string; hollow?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: hollow ? 'transparent' : dot, borderWidth: hollow ? 2 : 0, borderColor: dot }} />
      <AppText style={{ flex: 1 }}>{label}</AppText>
      <AppText variant="h3" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </AppText>
    </View>
  );
}

function Item({ p, today, onPress }: { p: PlannedNotification; today: string; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const c = categoryColor(colors, p.category);
  const tomorrow = localDay(p.at) !== today;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}>
      <View style={[styles.badge, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={iconFor(p)} size={18} color={c} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
          <AppText variant="h3" style={{ flex: 1 }}>
            {p.title}
          </AppText>
          <AppText variant="small" muted>
            {tomorrow ? 'Tomorrow ' : ''}
            {time(p.at)}
          </AppText>
        </View>
        <AppText variant="small" muted>
          {p.body}
        </AppText>
      </View>
    </Pressable>
  );
}

export default function Notifications() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const prefs = useNotificationPrefs();
  const markSeen = useNotificationPrefs((s) => s.markSeen);
  const now = new Date();
  const today = localDay(now);

  const plan = useMemo(() => notifications.plan(new Date(), prefs), [prefs]);
  const sofar = plan.filter((p) => p.at.getTime() <= now.getTime() && localDay(p.at) === today);
  const ahead = plan.filter((p) => p.at.getTime() > now.getTime());

  // opening the inbox clears the bell
  useEffect(() => {
    const t = setTimeout(markSeen, 600);
    return () => clearTimeout(t);
  }, [markSeen]);

  const gear = (
    <Pressable onPress={() => router.push('/profile/notification-settings')} hitSlop={12} style={styles.roundBtn} accessibilityLabel="Notification settings">
      <Ionicons name="settings-outline" size={20} color={colors.text} />
    </Pressable>
  );

  return (
    <DetailScreen title="Notifications" headerRight={gear}>
      {!prefs.enabled ? (
        <Card style={{ gap: space.sm, marginBottom: space.lg }} onPress={() => router.push('/profile/notification-settings')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Ionicons name="notifications-off-outline" size={18} color={colors.warn} />
            <AppText variant="h3" style={{ flex: 1 }}>
              Notifications are off
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </View>
          <AppText variant="small" muted>
            Turn them on in settings to get bedtime, focus, energy, caffeine and water reminders.
          </AppText>
        </Card>
      ) : null}

      <DayTimeline />

      {prefs.enabled ? (
        <>
          <SectionHeader title="Today so far" />
          {sofar.length ? (
            <View style={{ gap: space.md }}>
              {sofar.map((p) => (
                <Item key={p.id} p={p} today={today} onPress={() => router.navigate(p.url as never)} />
              ))}
            </View>
          ) : (
            <AppText variant="small" muted>
              Nothing has come due yet today.
            </AppText>
          )}

          <SectionHeader title="Coming up" />
          {ahead.length ? (
            <View style={{ gap: space.md }}>
              {ahead.map((p) => (
                <Item key={p.id} p={p} today={today} onPress={() => router.navigate(p.url as never)} />
              ))}
            </View>
          ) : (
            <AppText variant="small" muted>
              Nothing else is planned. Check the categories in settings.
            </AppText>
          )}
        </>
      ) : null}

      <AppText variant="tiny" muted style={{ marginTop: space.xl }}>
        Times are estimates from your recent nights and workouts, and the text is refreshed each time you open Bodyn. They are suggestions, not medical advice.
      </AppText>
    </DetailScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  roundBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', gap: space.md, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  badge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
}));
