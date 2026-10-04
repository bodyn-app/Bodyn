import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Hypnogram, stageColor, stageName } from '@/components/charts';
import { AppText, Card, DetailScreen, SectionHeader } from '@/components/ui';
import { health } from '@/health';
import { clockAt, clockMinutes, dateLong, shortDuration } from '@/lib/format';
import { useSelectedDate } from '@/state/selected-date';
import { makeStyles, radius, space, useTheme } from '@/theme';

// display order: same as the chart rows
const ORDER = [0, 3, 1, 2];

export default function SleepStages() {
  const styles = useStyles();
  const { colors } = useTheme();
  const date = useSelectedDate((s) => s.date);
  const s = health.getDay(date)?.sleep;
  const [sel, setSel] = useState<number | null>(null);

  if (!s)
    return (
      <DetailScreen title="Sleep stages">
        <AppText muted>No sleep recorded for {dateLong(date)}.</AppText>
      </DetailScreen>
    );

  const total = s.stages[s.stages.length - 1][1];
  const at = (rel: number) => clockAt(s.start, rel);
  const asleep = s.asleepMin || 1;

  // per-stage summary
  const summary = ORDER.map((code) => {
    const segs = s.stages.filter((x) => x[2] === code);
    const min = segs.reduce((t, x) => t + (x[1] - x[0]), 0);
    return { code, count: segs.length, min, first: segs[0], last: segs[segs.length - 1] };
  });
  const awakenings = s.stages.filter((x) => x[2] === 0).length;

  return (
    <DetailScreen title="Sleep stages">
      <AppText variant="small" muted style={{ textAlign: 'center' }}>
        {dateLong(date)} · {at(0)} → {at(total)}
      </AppText>

      <Card style={{ marginTop: space.md }}>
        <Hypnogram stages={s.stages} totalMin={total} startClockMin={clockMinutes(s.start)} height={190} selected={sel} />
        <AppText variant="tiny" muted style={{ marginTop: space.sm }}>
          Tap a row below to highlight it on the chart.
        </AppText>
      </Card>

      <SectionHeader title="Summary" />
      <View style={{ gap: space.sm }}>
        {summary.map((x) => (
          <Card key={x.code} style={styles.sumRow}>
            <View style={[styles.dot, { backgroundColor: stageColor(colors, x.code) }]} />
            <View style={{ flex: 1 }}>
              <AppText variant="h3">{x.code === 0 ? 'Awake' : stageName(x.code)}</AppText>
              <AppText variant="tiny" muted>
                {x.count ? `${x.count}× · first ${at(x.first[0])} · last ${at(x.last[0])}` : 'none'}
              </AppText>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="h3">{shortDuration(x.min)}</AppText>
              {x.code !== 0 ? (
                <AppText variant="tiny" muted>
                  {Math.round((x.min / asleep) * 100)}% of sleep
                </AppText>
              ) : (
                <AppText variant="tiny" muted>
                  {awakenings} awakening{awakenings === 1 ? '' : 's'}
                </AppText>
              )}
            </View>
          </Card>
        ))}
      </View>

      <SectionHeader title="Timeline" />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {s.stages.map(([a, b, code], i) => (
          <Pressable key={i} onPress={() => setSel(sel === i ? null : i)} style={[styles.row, sel === i && { backgroundColor: colors.surfaceAlt }, i > 0 && styles.rowBorder]}>
            <View style={[styles.dot, { backgroundColor: stageColor(colors, code) }]} />
            <AppText variant="body" style={{ width: 118 }}>
              {at(a)} – {at(b)}
            </AppText>
            <AppText variant="body" style={{ flex: 1, color: code === 0 ? colors.awake : colors.text, fontWeight: code === 0 ? '700' : '400' }}>
              {stageName(code)}
            </AppText>
            <AppText variant="small" muted>
              {shortDuration(b - a)}
            </AppText>
          </Pressable>
        ))}
      </Card>
      <AppText variant="tiny" muted style={{ marginTop: space.md }}>
        Times come from your Apple Watch sleep stages and are shown in the time zone they were recorded in.
      </AppText>
    </DetailScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: 11 },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  dot: { width: 10, height: 10, borderRadius: 5 },
}));
