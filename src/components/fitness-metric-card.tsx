import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { METRIC, type MetricKey } from '@/coach/insights';
import { fmtMin } from '@/metrics/engine';
import { fitnessProfile, type ProfileTone } from '@/metrics';
import { makeStyles, radius, space, useTheme } from '@/theme';
import { ALL_TREND_KEYS, type TrendKey } from '@/lib/trends';

import { AppText, Card } from './ui';
import { TrendSheet } from './trend-sheet';

const clampPct = (v: number, lo: number, hi: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// the two vocabularies mostly line up 1:1; the one place they don't is sleep minutes ("sleepMin" vs "sleep")
const TREND_KEY_MAP: Partial<Record<MetricKey, TrendKey>> = { sleepMin: 'sleep' };

/** Sentence explaining what the 30-day-vs-baseline shift means for this metric, in plain terms. */
function insight(label: string, tone: ProfileTone, higherIsBetter: boolean | null) {
  if (tone === 'neutral') return `Your recent ${label} is close to your own usual range.`;
  const up = tone === 'good';
  const dir = up ? 'above' : 'below';
  const verdict = up ? 'a small plus for your fitness age' : 'worth keeping an eye on';
  const goodWord = higherIsBetter === false ? (up ? 'lower' : 'higher') : up ? 'higher' : 'lower';
  return `Your recent ${label} is ${goodWord}, ${dir} your own longer-term average — ${verdict}.`;
}

const toneColor = (c: ReturnType<typeof useTheme>['colors'], tone: ProfileTone) => (tone === 'good' ? c.good : tone === 'bad' ? c.bad : c.core);

/**
 * One metric on the Fitness age page: a gradient track with two markers (your last 30 days, and your own
 * longer-term average), a small illustrative years chip, a plain-language line, and a link to the full trend.
 */
export function MetricSlider({
  metricKey, date, min, max, weekly, label,
}: { metricKey: MetricKey; date: string; min: number; max: number; /** the underlying value is a daily average; show ×7 as a weekly figure (for HR zones and strength time) */ weekly?: boolean; label?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [trendOpen, setTrendOpen] = useState(false);
  const info = METRIC[metricKey];
  const name = label ?? info.label;
  const title = cap(name);
  const p = fitnessProfile(metricKey, date);
  const trendKey = TREND_KEY_MAP[metricKey] ?? (metricKey as unknown as TrendKey);
  const hasTrend = ALL_TREND_KEYS.includes(trendKey);

  if (!p)
    return (
      <Card style={{ gap: 6 }}>
        <AppText variant="h3">{title}</AppText>
        <AppText variant="small" muted>
          Not enough data yet.
        </AppText>
      </Card>
    );

  const tone = toneColor(colors, p.tone);
  const scaled = (v: number) => (weekly ? v * 7 : v);
  // lower-is-better metrics (resting heart rate) read right-to-left: a low value sits on the green side
  const invert = info.higherIsBetter === false;
  const toPct = (v: number) => {
    const p2 = clampPct(scaled(v), min, max);
    return invert ? 100 - p2 : p2;
  };
  const shortPct = toPct(p.short);
  const longPct = toPct(p.long);
  // the marker labels sit in a narrow, fixed-width box, so a long unit like "mL/kg/min" is dropped there —
  // the card's own title already says what the metric is
  const compactUnit = info.unit === '/100' ? '%' : info.unit.length <= 4 ? ` ${info.unit}` : '';
  const fmt = (v: number) => (weekly ? fmtMin(scaled(v)) : `${info.fmt(v)}${compactUnit}`);
  const longLabel = `${p.days}-day`;

  return (
    <Card style={{ gap: space.md }} onPress={hasTrend ? () => setTrendOpen(true) : undefined}>
      <View style={styles.row}>
        <AppText variant="h3" style={{ flex: 1 }}>
          {title}
        </AppText>
        <View style={[styles.chip, { backgroundColor: colors.surfaceAlt }]}>
          <AppText variant="tiny" style={{ color: tone, fontWeight: '700' }}>
            {p.years > 0 ? '+' : p.years < 0 ? '−' : '±'}
            {Math.abs(p.years).toFixed(1)} yrs
          </AppText>
        </View>
      </View>

      <View style={styles.markers}>
        <MarkerLabel pct={shortPct} value={fmt(p.short)} caption="30-day" tone={tone} />
        {Math.abs(shortPct - longPct) > 12 ? <MarkerLabel pct={longPct} value={fmt(p.long)} caption={longLabel} tone={colors.textMuted} light /> : null}
      </View>
      <View style={styles.track}>
        <View style={[styles.trackFill, { backgroundColor: colors.bad, flex: 1 }]} />
        <View style={[styles.trackFill, { backgroundColor: colors.textDim, flex: 1 }]} />
        <View style={[styles.trackFill, { backgroundColor: colors.good, flex: 1 }]} />
        <Marker pct={longPct} color={colors.textMuted} up={false} />
        <Marker pct={shortPct} color={tone} up />
      </View>

      <AppText variant="small" muted>
        {insight(name, p.tone, info.higherIsBetter)}
      </AppText>

      {hasTrend ? (
        <Pressable onPress={() => setTrendOpen(true)} hitSlop={8} style={styles.link}>
          <AppText variant="small" lime style={{ fontWeight: '600' }}>
            View trend
          </AppText>
          <Ionicons name="arrow-forward" size={13} color={colors.limeText} />
        </Pressable>
      ) : null}

      {hasTrend ? <TrendSheet visible={trendOpen} metricKey={trendKey} onClose={() => setTrendOpen(false)} /> : null}
    </Card>
  );
}

function Marker({ pct, color, up }: { pct: number; color: string; up: boolean }) {
  const tri = up
    ? { borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }
    : { borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: color };
  return (
    <View style={{ position: 'absolute', left: `${pct}%`, top: up ? -8 : 12, transform: [{ translateX: -6 }] }}>
      <View style={{ width: 0, height: 0, ...tri }} />
    </View>
  );
}

function MarkerLabel({ pct, value, caption, tone, light }: { pct: number; value: string; caption: string; tone: string; light?: boolean }) {
  return (
    <View style={{ position: 'absolute', left: `${pct}%`, transform: [{ translateX: -28 }], width: 56, alignItems: 'center' }}>
      <AppText variant="small" style={{ color: tone, fontWeight: light ? '500' : '700' }} numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="tiny" muted numberOfLines={1}>
        {caption}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  markers: { height: 34, marginTop: space.md },
  track: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'visible', marginTop: 2 },
  trackFill: { height: 8 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
}));
