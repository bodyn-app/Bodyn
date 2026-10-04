// Per-metric breakdown for the Fitness age page: a 30-day average against a longer personal baseline,
// for Sleep, Training and Fitness metrics. Each one is Bodyn's own simple, transparent estimate —
// a small, capped "years" nudge shown on its own card, never added into the headline VO2-based fitness age.
import { avgOver, datesWithData, METRIC, metricValue, type MetricKey } from '../coach/insights';
import type { Deps } from '../coach/types';
import { clamp } from './math';
import { fitnessAgeFromVo2 } from './fitness';

export const SHORT_DAYS = 30;
export const LONG_DAYS = 180;
/** how strongly a metric's own 30-day-vs-baseline shift moves its illustrative years (kept small and capped) */
const YEARS_PER_PCT = 0.06;
const YEARS_CAP = 1.2;
const DEAD_ZONE_YEARS = 0.1;

export type Tone = 'good' | 'neutral' | 'bad';
export type MetricProfile = { key: MetricKey; short: number; long: number; days: number; pct: number; years: number; tone: Tone };

/** Days of real history available, capped to `max`. */
function windowDays(d: Deps, endDate: string, max: number): number {
  const first = d.provider.firstDay;
  const span = Math.round((Date.parse(endDate) - Date.parse(first)) / 864e5) + 1;
  return clamp(span, 1, max);
}

/**
 * A metric's last 30 days against the longest personal baseline the data supports (up to 180 days),
 * with a small capped "years" reading of which direction it's pulling and by how much.
 */
export function metricProfile(d: Deps, key: MetricKey, endDate: string): MetricProfile | null {
  const short = avgOver(d, key, endDate, SHORT_DAYS);
  const longDays = windowDays(d, endDate, LONG_DAYS);
  const long = avgOver(d, key, endDate, longDays);
  if (short == null || long == null) return null;
  const higher = METRIC[key].higherIsBetter;
  // a metric that is legitimately 0 over the baseline (e.g. no zone 4–5 minutes) isn't "no data" —
  // treat any move away from a zero baseline as a full swing rather than dividing by zero
  const pct = long !== 0 ? ((short - long) / Math.abs(long)) * 100 : short !== 0 ? 100 : 0;
  const signed = higher === false ? -pct : pct;
  const years = clamp(signed * YEARS_PER_PCT, -YEARS_CAP, YEARS_CAP);
  const tone: Tone = years > DEAD_ZONE_YEARS ? 'good' : years < -DEAD_ZONE_YEARS ? 'bad' : 'neutral';
  return { key, short, long, days: longDays, pct, years: Math.round(years * 10) / 10, tone };
}

export type FitnessTrend = 'improving' | 'steady' | 'declining';
/**
 * The last few months of fitness age, from the monthly VO2 series: down = improving (younger),
 * up = declining, small moves = steady. Needs at least two months with a reading.
 */
export function fitnessTrend(d: Deps, sex: string | null | undefined): FitnessTrend | null {
  const dates = datesWithData(d);
  const byMonth = new Map<string, number[]>();
  for (const date of dates) {
    const v = metricValue(d, 'vo2', date);
    if (v != null) byMonth.set(date.slice(0, 7), [...(byMonth.get(date.slice(0, 7)) ?? []), v]);
  }
  const months = [...byMonth.keys()].sort();
  if (months.length < 2) return null;
  const ages = months.map((m) => {
    const vs = byMonth.get(m)!;
    return fitnessAgeFromVo2(vs.reduce((a, b) => a + b, 0) / vs.length, sex);
  });
  const span = Math.min(3, ages.length - 1);
  const diff = ages[ages.length - 1] - ages[ages.length - 1 - span];
  if (diff <= -0.3) return 'improving';
  if (diff >= 0.3) return 'declining';
  return 'steady';
}
