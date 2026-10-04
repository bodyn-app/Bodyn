import { useRef, useState, type ReactNode } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { type Colors, useTheme } from '@/theme';

import { AppText } from './ui';

/** Width reserved on the left for y-axis value labels. */
const PAD_L = 36;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Renders children with the measured width of its container. */
function Measure({ height, onWidth, children }: { height: number; onWidth?: (w: number) => void; children: (w: number) => ReactNode }) {
  const [w, setW] = useState(0);
  return (
    <View
      style={{ height, width: '100%' }}
      onLayout={(e) => {
        const next = Math.round(e.nativeEvent.layout.width);
        setW(next);
        onWidth?.(next);
      }}
    >
      {w > 0 ? children(w) : null}
    </View>
  );
}

type Pt = { x: number; y: number };
const smoothPath = (pts: Pt[]) => {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    d += ` C${p1.x + (p2.x - p0.x) / 6},${p1.y + (p2.y - p0.y) / 6} ${p2.x - (p3.x - p1.x) / 6},${p2.y - (p3.y - p1.y) / 6} ${p2.x},${p2.y}`;
  }
  return d;
};

/** "Nice" axis: rounds the range out to a friendly step and returns the tick values. */
export function niceScale(min: number, max: number, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { lo: 0, hi: 1, ticks: [0, 1] };
  if (max === min) max = min + 1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { lo, hi, ticks };
}

const defaultFormat = (v: number) => {
  const a = Math.abs(v);
  if (a >= 10000) return `${Math.round(v / 1000)}k`;
  if (a >= 1000) return `${(v / 1000).toFixed(v % 1000 ? 1 : 0)}k`;
  return String(Math.round(v * 10) / 10);
};

/** Horizontal gridlines with value labels on the left. */
function Grid({ ticks, y, width, format = defaultFormat }: { ticks: number[]; y: (v: number) => number; width: number; format?: (v: number) => string }) {
  const { colors } = useTheme();
  return (
    <G>
      {ticks.map((t) => (
        <G key={t}>
          <Line x1={PAD_L} x2={width} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
          <SvgText x={PAD_L - 6} y={y(t) + 3} fill={colors.textDim} fontSize={9} textAnchor="end">
            {format(t)}
          </SvgText>
        </G>
      ))}
    </G>
  );
}

const nums = (a: (number | null | undefined)[]) => a.filter((v): v is number => v != null);

/**
 * Labels under a chart, one per bar/point. Each visible one is centred on its own bar in an unconstrained box
 * (not an equal flex share of the row), so with many points a wide two-digit label never gets clipped down to
 * a single digit — it just needs `every` set high enough that neighbours don't touch.
 * The set of days shown is fixed by `every` alone: it does not shift as you touch/scrub, so the surrounding
 * dates never vanish while you're reading a value — only the shown label nearest `hi` changes colour.
 */
function XLabels({ labels, left, hi, every = 1 }: { labels: string[]; left: number; hi?: number; every?: number }) {
  const { colors } = useTheme();
  const [w, setW] = useState(0);
  const n = labels.length;
  const slot = n ? (w - left) / n : 0;
  const cxOf = (i: number) => left + slot * (i + 0.5);
  const boxW = 40;
  // whichever shown day sits closest to `hi` reads as "current"; the set of shown days itself never changes
  const maxShown = n ? Math.floor((n - 1) / every) * every : 0;
  const nearest = hi != null ? clamp(Math.round(hi / every) * every, 0, maxShown) : null;
  return (
    <View style={styles.labelRow} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0
        ? labels.map((l, i) => {
            if (i % every !== 0) return null;
            const cx = cxOf(i);
            return (
              <AppText key={i} variant="tiny" numberOfLines={1} style={{ position: 'absolute', left: cx - boxW / 2, width: boxW, textAlign: 'center', color: i === nearest ? colors.text : colors.textDim }}>
                {l}
              </AppText>
            );
          })
        : null}
    </View>
  );
}

/** Evenly spaced captions under a continuous chart (e.g. 00:00 … 24:00). */
function Captions({ labels, left }: { labels: string[]; left: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.captionRow, { paddingLeft: left }]}>
      {labels.map((l) => (
        <AppText key={l} variant="tiny" style={{ color: colors.textDim }}>
          {l}
        </AppText>
      ))}
    </View>
  );
}

type ScaleProps = { showScale?: boolean; format?: (v: number) => string };
/** What to show when the user touches / hovers a point: a small caption and the value. */
export type Tip = { title: string; value: string };

/** Touch / drag / click on a chart → index of the slot under the finger. Selection stays after release. */
function useScrub(count: number, left: number, width: number) {
  const [active, setActive] = useState<number | null>(null);
  const cfg = useRef({ count, left, width });
  cfg.current = { count, left, width };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => setActive(indexAt(e.nativeEvent.locationX, cfg.current)),
      onPanResponderMove: (e) => setActive(indexAt(e.nativeEvent.locationX, cfg.current)),
    })
  ).current;
  return { active: active != null && active < count ? active : null, handlers: pan.panHandlers };
}
const indexAt = (x: number, c: { count: number; left: number; width: number }) => clamp(Math.floor((x - c.left) / ((c.width - c.left) / c.count)), 0, c.count - 1);

function TipBubble({ tip, x, y, width, left }: { tip: Tip; x: number; y: number; width: number; left: number }) {
  const { colors } = useTheme();
  const w = 116;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: w,
        left: clamp(x - w / 2, left, Math.max(left, width - w)),
        top: clamp(y - 50, 0, 1000),
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: colors.limeDim,
      }}
    >
      <AppText variant="tiny" muted>
        {tip.title}
      </AppText>
      <AppText variant="small" style={{ color: colors.limeText, fontWeight: '700' }}>
        {tip.value}
      </AppText>
    </View>
  );
}

let gradSeq = 0;
/** A React-stable id, unique per chart instance, for elements (like gradients) referenced by `url(#id)`. */
function useGradId(prefix: string) {
  const ref = useRef<string | null>(null);
  if (!ref.current) ref.current = `${prefix}${++gradSeq}`;
  return ref.current;
}

/**
 * Smooth line. Touch or drag anywhere on it to read the value at that point (needs `tips`).
 * `glow`: a filled, softly-glowing look (same chart type as the heart-rate charts) instead of a plain line.
 */
export function LineChart({ values, labels, height = 120, highlight, tips, labelEvery = 1, showScale, format, zeroBase, glow }: { values: (number | null)[]; labels: string[]; height?: number; highlight?: number; tips?: Tip[]; labelEvery?: number; zeroBase?: boolean; glow?: boolean } & ScaleProps) {
  const { colors } = useTheme();
  const gradId = useGradId('lc');
  const left = showScale ? PAD_L : 0;
  const [width, setWidth] = useState(0);
  const scrub = useScrub(values.length, left, width);
  const TOP = tips ? 46 : 14; // room above the line for the tooltip
  const total = height + TOP;
  const best = values.reduce<number>((b, v, i) => ((v ?? -Infinity) > (values[b] ?? -Infinity) ? i : b), 0);
  const hi = scrub.active ?? highlight ?? best;
  return (
    <View>
      <Measure height={total} onWidth={setWidth}>
        {(w) => {
          const n = nums(values);
          if (!n.length) return null;
          const sc = niceScale(zeroBase ? Math.min(0, ...n) : Math.min(...n), Math.max(...n));
          const top = TOP, bottom = 6;
          const y = (v: number) => top + (total - top - bottom) * (1 - (v - sc.lo) / (sc.hi - sc.lo));
          const step = (w - left) / values.length;
          const x = (i: number) => left + step * (i + 0.5);
          const pts = values.map((v, i) => (v == null ? null : { x: x(i), y: y(v) })).filter((p): p is Pt => !!p);
          const v = values[hi];
          const hp = { x: x(hi), y: v != null ? y(v) : top + (total - top - bottom) / 2 };
          const tip = tips?.[hi];
          const line = smoothPath(pts);
          const area = glow && pts.length > 1 ? `${line} L${pts[pts.length - 1].x},${total - bottom} L${pts[0].x},${total - bottom} Z` : null;
          return (
            <>
              <Svg width={w} height={total}>
                {glow ? (
                  <Defs>
                    <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={colors.lime} stopOpacity={0.5} />
                      <Stop offset="1" stopColor={colors.lime} stopOpacity={0.03} />
                    </LinearGradient>
                  </Defs>
                ) : null}
                {showScale ? <Grid ticks={sc.ticks} y={y} width={w} format={format} /> : null}
                {scrub.active != null ? <Line x1={hp.x} x2={hp.x} y1={top - 6} y2={total - bottom} stroke={colors.textDim} strokeWidth={1} strokeDasharray="3 3" /> : null}
                {area ? <Path d={area} fill={`url(#${gradId})`} /> : null}
                {glow ? <Path d={line} stroke={colors.lime} strokeWidth={7} strokeOpacity={0.18} fill="none" strokeLinecap="round" strokeLinejoin="round" /> : null}
                <Path d={line} stroke={colors.lime} strokeWidth={2.5} fill="none" strokeLinecap="round" />
                {v != null ? <Circle cx={hp.x} cy={hp.y} r={6} fill={colors.bg} stroke={colors.text} strokeWidth={2} /> : null}
              </Svg>
              {tip ? <TipBubble tip={tip} x={hp.x} y={hp.y} width={w} left={left} /> : null}
              <View style={StyleSheet.absoluteFill} {...scrub.handlers} />
            </>
          );
        }}
      </Measure>
      <XLabels labels={labels} left={left} hi={hi} every={labelEvery} />
    </View>
  );
}

// Average glyph width of the label digits, as a fraction of font size — used to shrink labels to fit their slot.
const LABEL_CHAR_W = 0.62;

/**
 * Column chart: one bold, rounded-top bar per point, with its value printed above the bar.
 * Bars are the app's lime, and the highlighted one (the most recent day, or whichever bar is touched) turns blue.
 * Every bar keeps its label: the font shrinks, evenly across the whole chart, just enough that the widest label
 * fits its own slot, so nothing overlaps and nothing looks bigger or smaller than its neighbours.
 * With more than 14 bars there is no room for labels at any readable size, so only the touched/highlighted bar
 * gets a tip instead.
 */
export function ColumnChart({ values, labels, height = 190, highlight, tips, labelEvery = 1, showScale, format, zeroBase, color, refs }: { values: (number | null)[]; labels: string[]; height?: number; highlight?: number; tips?: Tip[]; labelEvery?: number; zeroBase?: boolean; color?: string; refs?: RefLine[] } & ScaleProps) {
  const { colors } = useTheme();
  const barColor = color ?? colors.lime;
  const hiColor = color ?? colors.core;
  const labelColor = color ?? colors.limeText;
  const left = showScale ? PAD_L : 0;
  const [width, setWidth] = useState(0);
  const scrub = useScrub(values.length, left, width);
  const dense = values.length > 14;
  const TOP = dense && tips ? 44 : 26; // room for either the touch tip or the always-on value labels
  const total = height + TOP;
  const lastReal = values.reduce<number>((b, v, i) => (v != null ? i : b), highlight ?? values.length - 1);
  const hi = scrub.active ?? highlight ?? lastReal;
  return (
    <View>
      <Measure height={total} onWidth={setWidth}>
        {(w) => {
          const n = nums(values);
          if (!n.length && !refs?.length) return null;
          const sc = niceScale(zeroBase ? Math.min(0, ...n) : 0, Math.max(0, ...n, ...(refs ?? []).map((r) => r.value)));
          const top = TOP, bottom = 4;
          const y = (v: number) => top + (total - top - bottom) * (1 - v / sc.hi);
          const slot = (w - left) / values.length;
          const bw = Math.min(slot * 0.58, 34);
          const texts = dense ? [] : values.map((v) => (v == null ? '' : (format ?? defaultFormat)(v)));
          const maxLen = Math.max(1, ...texts.map((t) => t.length));
          // one font size for the whole chart, shrunk just enough that the widest label fits its own slot
          const fontSize = dense ? 11 : clamp((slot - 4) / (maxLen * LABEL_CHAR_W), 8, 11);
          const labelGap = Math.max(6, fontSize * 0.85);
          return (
            <>
              <Svg width={w} height={total}>
                {showScale ? <Grid ticks={sc.ticks} y={y} width={w} format={format} /> : null}
                {refs?.map((r) => (
                  <G key={r.label}>
                    <Line x1={left} x2={w} y1={y(r.value)} y2={y(r.value)} stroke={r.color} strokeWidth={1} strokeDasharray="4 4" opacity={0.8} />
                    <SvgText x={r.align === 'left' ? left + 2 : w - 2} y={y(r.value) - 4} fill={r.color} fontSize={9} fontWeight="600" textAnchor={r.align === 'left' ? 'start' : 'end'}>
                      {r.label}
                    </SvgText>
                  </G>
                ))}
                {values.map((v, i) => {
                  if (v == null) return null;
                  const on = i === hi;
                  const h = Math.max(4, y(0) - y(v));
                  const x = left + slot * i + (slot - bw) / 2;
                  return (
                    <G key={i}>
                      <Rect x={x} y={y(v)} width={bw} height={h} rx={Math.min(bw / 2, 8)} fill={on ? hiColor : barColor} opacity={on ? 1 : color ? 0.55 : 0.85} />
                      {!dense ? (
                        <SvgText x={x + bw / 2} y={y(v) - labelGap} fill={on ? hiColor : labelColor} fontSize={fontSize} fontWeight={on ? '700' : '600'} textAnchor="middle">
                          {texts[i]}
                        </SvgText>
                      ) : null}
                    </G>
                  );
                })}
              </Svg>
              {dense && tips?.[hi] ? <TipBubble tip={tips[hi]} x={left + slot * (hi + 0.5)} y={values[hi] != null ? y(values[hi]!) : top} width={w} left={left} /> : null}
              <View style={StyleSheet.absoluteFill} {...scrub.handlers} />
            </>
          );
        }}
      </Measure>
      <XLabels labels={labels} left={left} hi={hi} every={labelEvery} />
    </View>
  );
}

/** A dashed horizontal reference line across a chart (a goal, an average), labelled at one end. */
export type RefLine = { value: number; label: string; color: string; align?: 'left' | 'right' };

/** Two stacked segments per bar (e.g. active + rest calories per day). Touch a bar to read it. */
export function StackedBars({ values, labels, height = 130, colorA, colorB, highlight, showScale, format, tips }: { values: { a: number; b: number }[]; labels: string[]; height?: number; colorA?: string; colorB?: string; highlight?: number; tips?: Tip[] } & ScaleProps) {
  const { colors } = useTheme();
  const cA = colorA ?? colors.lime;
  const cB = colorB ?? colors.rest;
  const left = showScale ? PAD_L : 0;
  const [width, setWidth] = useState(0);
  const scrub = useScrub(values.length, left, width);
  const hi = scrub.active ?? highlight;
  return (
    <View>
      <Measure height={height + (tips ? 44 : 0)} onWidth={setWidth}>
        {(w) => {
          const top = tips ? 44 : 0;
          const sc = niceScale(0, Math.max(...values.map((v) => v.a + v.b), 1));
          const y = (v: number) => top + 4 + (height - 8) * (1 - v / sc.hi);
          const slot = (w - left) / values.length;
          const bw = Math.min(slot * 0.6, 30);
          return (
            <>
              <Svg width={w} height={height + top}>
                {showScale ? <Grid ticks={sc.ticks} y={y} width={w} format={format} /> : null}
                {values.map((v, i) => {
                  const x = left + slot * i + (slot - bw) / 2;
                  const dim = hi != null && i !== hi ? 0.45 : 1;
                  return (
                    <G key={i}>
                      <Rect x={x} y={y(v.b)} width={bw} height={Math.max(0, y(0) - y(v.b))} rx={4} fill={cB} opacity={dim} />
                      <Rect x={x} y={y(v.a + v.b)} width={bw} height={Math.max(0, y(v.b) - y(v.a + v.b))} rx={4} fill={cA} opacity={dim} />
                    </G>
                  );
                })}
              </Svg>
              {tips && hi != null && tips[hi] ? <TipBubble tip={tips[hi]} x={left + slot * (hi + 0.5)} y={y(values[hi].a + values[hi].b) + 12} width={w} left={left} /> : null}
              <View style={StyleSheet.absoluteFill} {...scrub.handlers} />
            </>
          );
        }}
      </Measure>
      <XLabels labels={labels} left={left} hi={hi} />
    </View>
  );
}

/** Tall rounded "pill" bars; the highlighted one is lime. Touch a bar to read its value (needs `tips`). */
export function PillBars({ values, labels, height = 150, highlight, showScale, format, goal, tips }: { values: number[]; labels: string[]; height?: number; highlight?: number; goal?: number; tips?: Tip[] } & ScaleProps) {
  const { colors } = useTheme();
  const max = Math.max(...values, goal ?? 0, 1);
  const left = showScale ? PAD_L : 0;
  const [width, setWidth] = useState(0);
  const scrub = useScrub(values.length, left, width);
  const hi = scrub.active ?? highlight ?? values.indexOf(Math.max(...values, 1));
  return (
    <View>
      <Measure height={height + (tips ? 44 : 0)} onWidth={setWidth}>
        {(w) => {
          const top = tips ? 44 : 0;
          const sc = niceScale(0, max);
          const y = (v: number) => top + 4 + (height - 8) * (1 - v / sc.hi);
          const slot = (w - left) / values.length;
          const bw = Math.min(slot * 0.62, 34);
          return (
            <>
              <Svg width={w} height={height + top}>
                {showScale ? <Grid ticks={sc.ticks} y={y} width={w} format={format} /> : null}
                {goal != null ? <Line x1={left} x2={w} y1={y(goal)} y2={y(goal)} stroke={colors.lime} strokeWidth={1} strokeDasharray="4 4" opacity={0.7} /> : null}
                {values.map((v, i) => {
                  const h = Math.max(bw, y(0) - y(v));
                  return <Rect key={i} x={left + slot * i + (slot - bw) / 2} y={y(0) - h} width={bw} height={h} rx={bw / 2} fill={i === hi ? colors.lime : colors.barIdle} />;
                })}
              </Svg>
              {tips && scrub.active != null && tips[scrub.active] ? (
                <TipBubble tip={tips[scrub.active]} x={left + slot * (scrub.active + 0.5)} y={y(0) - Math.max(bw, y(0) - y(values[scrub.active])) + 8} width={w} left={left} />
              ) : null}
              <View style={StyleSheet.absoluteFill} {...scrub.handlers} />
            </>
          );
        }}
      </Measure>
      <XLabels labels={labels} left={left} hi={hi} />
    </View>
  );
}

/** One bar per slot with its own colour. `value: null` draws a small stub (e.g. asleep / exercising hours). Touch a bar to read it. */
export type LevelBar = { value: number | null; color: string };
export function LevelBars({ bars, labels, captions, height = 140, max = 3, showScale, format, tips }: { bars: LevelBar[]; labels?: string[]; captions?: string[]; height?: number; max?: number; tips?: Tip[] } & ScaleProps) {
  const left = showScale ? PAD_L : 0;
  const [width, setWidth] = useState(0);
  const scrub = useScrub(bars.length, left, width);
  const active = tips ? scrub.active : null;
  return (
    <View>
      <Measure height={height + (tips ? 44 : 0)} onWidth={setWidth}>
        {(w) => {
          const top = tips ? 44 : 0;
          const sc = niceScale(0, max, max);
          const y = (v: number) => top + 4 + (height - 8) * (1 - v / sc.hi);
          const slot = (w - left) / bars.length;
          const bw = Math.min(slot * 0.66, 16);
          return (
            <>
              <Svg width={w} height={height + top}>
                {showScale ? <Grid ticks={sc.ticks} y={y} width={w} format={format} /> : null}
                {bars.map((b, i) => {
                  const h = b.value == null ? 4 : Math.max(4, y(0) - y(clamp(b.value, 0, sc.hi)));
                  return <Rect key={i} x={left + slot * i + (slot - bw) / 2} y={y(0) - h} width={bw} height={h} rx={Math.min(bw / 2, 4)} fill={b.color} opacity={active != null && i !== active ? 0.55 : 1} />;
                })}
              </Svg>
              {tips && active != null && tips[active] ? (
                <TipBubble tip={tips[active]} x={left + slot * (active + 0.5)} y={y(0) - (bars[active].value == null ? 4 : Math.max(4, y(0) - y(clamp(bars[active].value!, 0, sc.hi)))) + 8} width={w} left={left} />
              ) : null}
              {tips ? <View style={StyleSheet.absoluteFill} {...scrub.handlers} /> : null}
            </>
          );
        }}
      </Measure>
      {labels ? <XLabels labels={labels} left={left} hi={active ?? undefined} every={3} /> : null}
      {captions ? <Captions labels={captions} left={left} /> : null}
    </View>
  );
}

/** Dense thin bars (hourly histograms). */
export function MiniBars({ values, height = 44, showScale, format, xLabels }: { values: number[]; height?: number; xLabels?: string[] } & ScaleProps) {
  const { colors } = useTheme();
  const left = showScale ? PAD_L : 0;
  const max = Math.max(...values, 1);
  return (
    <View>
      <Measure height={height}>
        {(w) => {
          const sc = niceScale(0, max);
          const top = showScale ? 6 : 0;
          const y = (v: number) => top + (height - top) * (1 - v / (showScale ? sc.hi : max));
          const slot = (w - left) / values.length;
          const bw = Math.max(1.5, slot * 0.55);
          return (
            <Svg width={w} height={height}>
              {showScale ? <Grid ticks={sc.ticks} y={y} width={w} format={format} /> : null}
              {values.map((v, i) => {
                const h = Math.max(2, y(0) - y(v));
                return <Rect key={i} x={left + slot * i + (slot - bw) / 2} y={y(0) - h} width={bw} height={h} rx={bw / 2} fill={v > max * 0.6 ? colors.lime : colors.limeDim} />;
              })}
            </Svg>
          );
        }}
      </Measure>
      {xLabels ? <Captions labels={xLabels} left={left} /> : null}
    </View>
  );
}

/** Smooth glowing area chart, for heart rate. Only the first and last caption are printed, at the two ends. */
export function AreaChart({ values, height = 90, showScale, format, xLabels }: { values: (number | null)[]; height?: number; xLabels?: string[] } & ScaleProps) {
  const { colors } = useTheme();
  const gradId = useGradId('area');
  const left = showScale ? PAD_L : 0;
  const endsOnly = xLabels && xLabels.length > 2 ? [xLabels[0], xLabels[xLabels.length - 1]] : xLabels;
  return (
    <View>
      <Measure height={height}>
        {(w) => {
          const n = nums(values);
          if (n.length < 2) return null;
          const sc = niceScale(Math.min(...n), Math.max(...n));
          const top = 8, bottom = 4;
          const y = (v: number) => top + (height - top - bottom) * (1 - (v - sc.lo) / (sc.hi - sc.lo));
          const step = (w - left) / Math.max(values.length - 1, 1);
          const pts = values.map((v, i) => (v == null ? null : { x: left + step * i, y: y(v) })).filter((p): p is Pt => !!p);
          const line = smoothPath(pts);
          const area = `${line} L${pts[pts.length - 1].x},${height} L${pts[0].x},${height} Z`;
          return (
            <Svg width={w} height={height}>
              <Defs>
                <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.lime} stopOpacity={0.5} />
                  <Stop offset="1" stopColor={colors.lime} stopOpacity={0.03} />
                </LinearGradient>
              </Defs>
              {showScale ? <Grid ticks={sc.ticks} y={y} width={w} format={format} /> : null}
              <Path d={area} fill={`url(#${gradId})`} />
              {/* a soft, wide, faint stroke behind the crisp line stands in for a glow */}
              <Path d={line} stroke={colors.lime} strokeWidth={7} strokeOpacity={0.18} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <Path d={line} stroke={colors.lime} strokeWidth={2.25} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          );
        }}
      </Measure>
      {endsOnly ? <Captions labels={endsOnly} left={left} /> : null}
    </View>
  );
}

type Stage = 0 | 1 | 2 | 3;
const STAGE_ROW = { 0: 0, 3: 1, 1: 2, 2: 3 } as const; // awake, rem, core, deep from top to bottom
const STAGE_NAME = ['Awake', 'REM', 'Core', 'Deep'];
export const stageName = (code: number) => ['Awake', 'Core', 'Deep', 'REM'][code] ?? '';
export const stageColor = (c: Colors, code: number) => ({ 0: c.awake, 1: c.core, 2: c.deep, 3: c.rem })[code as Stage] ?? c.textDim;

/**
 * Sleep hypnogram: one row per stage, blocks placed by real clock time, with an hourly time axis.
 * startClockMin = minute of day at which the night starts (e.g. 02:51 → 171).
 */
export function Hypnogram({ stages, totalMin, startClockMin, height = 150, selected }: { stages: [number, number, number][]; totalMin: number; startClockMin: number; height?: number; selected?: number | null }) {
  const { colors } = useTheme();
  return (
    <Measure height={height}>
      {(w) => {
        const left = 44;
        const axisH = 20;
        const plotH = height - axisH;
        const rowH = plotH / 4;
        const x = (t: number) => left + (t / totalMin) * (w - left);
        // hour ticks: every hour for short nights, every 2 h for long ones
        const stepMin = totalMin > 6 * 60 ? 120 : 60;
        const tickAt: number[] = [];
        for (let t = (stepMin - (startClockMin % stepMin)) % stepMin; t <= totalMin; t += stepMin) tickAt.push(t);
        const hh = (t: number) => `${String(Math.floor(((startClockMin + t) % 1440) / 60)).padStart(2, '0')}:00`;
        return (
          <Svg width={w} height={height}>
            {STAGE_NAME.map((name, r) => (
              <G key={name}>
                <Line x1={left} x2={w} y1={r * rowH + rowH / 2} y2={r * rowH + rowH / 2} stroke={colors.border} strokeWidth={1} />
                <SvgText x={0} y={r * rowH + rowH / 2 + 3} fill={colors.textMuted} fontSize={10}>
                  {name}
                </SvgText>
              </G>
            ))}
            {tickAt.map((t) => (
              <G key={t}>
                <Line x1={x(t)} x2={x(t)} y1={0} y2={plotH} stroke={colors.border} strokeWidth={1} strokeDasharray="2 4" />
                <SvgText x={x(t)} y={height - 6} fill={colors.textDim} fontSize={9} textAnchor="middle">
                  {hh(t)}
                </SvgText>
              </G>
            ))}
            {stages.map(([s, e, code], i) => {
              const row = STAGE_ROW[code as Stage];
              const on = selected == null || selected === i;
              return (
                <Rect
                  key={i}
                  x={x(s)}
                  y={row * rowH + 4}
                  width={Math.max(2, x(e) - x(s))}
                  height={rowH - 8}
                  rx={4}
                  fill={stageColor(colors, code)}
                  opacity={on ? 1 : 0.25}
                  stroke={selected === i ? colors.text : undefined}
                  strokeWidth={selected === i ? 1.5 : 0}
                />
              );
            })}
          </Svg>
        );
      }}
    </Measure>
  );
}

/** Circular progress ring with a centered value. */
export function Ring({ size = 96, stroke = 9, progress, color, children }: { size?: number; stroke?: number; progress: number | null; color: string; children?: ReactNode }) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress ?? 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        {progress != null ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * p} ${c}`}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: { position: 'relative', height: 16, marginTop: 8 },
  captionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
});
