import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { addDays, health } from '@/health';
import { dateLabel, dayNum, dowShort } from '@/lib/format';
import { useSelectedDate } from '@/state/selected-date';
import { makeStyles, radius, space, useTheme } from '@/theme';

import { CalendarModal } from './calendar-modal';
import { AppText } from './ui';

const PILL = 46;
const GAP = 8;
const ITEM = PILL + GAP;

/** Day picker: scrolls through the whole history, and a calendar button jumps to any date. */
export function DayStrip() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { date, setDate } = useSelectedDate();
  const router = useRouter();
  const [calendar, setCalendar] = useState(false);
  const [ready, setReady] = useState(false);
  const list = useRef<FlatList<string>>(null);

  const dates = useMemo(() => {
    const out: string[] = [];
    for (let d = health.firstDay; d <= health.lastDay; d = addDays(d, 1)) out.push(d);
    return out;
  }, []);
  const index = dates.indexOf(date);

  // keep the selected day centred whenever it changes (calendar jump, tab switch, tap)
  useEffect(() => {
    if (!ready || index < 0) return;
    try {
      list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    } catch {
      /* list not laid out yet */
    }
  }, [index, ready]);

  return (
    <View style={{ marginTop: space.md }}>
      <View style={styles.labelRow}>
        <View>
          <AppText variant="small" muted>
            {dateLabel(date, health.lastDay)}
          </AppText>
          <AppText variant="tiny" muted>
            {date.slice(0, 4)}
          </AppText>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Pressable onPress={() => router.push('/coach')} hitSlop={8} style={styles.calBtn} accessibilityLabel="Open coach">
            <Ionicons name="sparkles" size={20} color={colors.limeText} />
          </Pressable>
          <Pressable onPress={() => setCalendar(true)} hitSlop={8} style={styles.calBtn} accessibilityLabel="Open calendar">
            <Ionicons name="calendar-outline" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <FlatList
        ref={list}
        horizontal
        data={dates}
        keyExtractor={(d) => d}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: ITEM, offset: ITEM * i, index: i })}
        initialScrollIndex={Math.max(0, index - 3)}
        initialNumToRender={14}
        windowSize={9}
        onLayout={() => setReady(true)}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item: d }) => {
          const on = d === date;
          const hasData = !!health.getDay(d);
          const firstOfMonth = d.endsWith('-01');
          return (
            <Pressable onPress={() => setDate(d)} style={[styles.pill, on && { backgroundColor: colors.lime }]}>
              <AppText variant="tiny" style={{ color: on ? colors.onLime : colors.textMuted }}>
                {firstOfMonth ? new Date(`${d}T00:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase() : dowShort(d).toUpperCase()}
              </AppText>
              <AppText variant="h3" style={{ color: on ? colors.onLime : hasData ? colors.text : colors.textDim }}>
                {dayNum(d)}
              </AppText>
            </Pressable>
          );
        }}
      />

      <CalendarModal
        visible={calendar}
        value={date}
        min={health.firstDay}
        max={health.lastDay}
        hasData={(d) => !!health.getDay(d)}
        onSelect={setDate}
        onClose={() => setCalendar(false)}
      />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  calBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  pill: { alignItems: 'center', gap: 2, paddingVertical: 8, width: PILL, marginRight: GAP, borderRadius: radius.lg, backgroundColor: colors.surface },
}));
