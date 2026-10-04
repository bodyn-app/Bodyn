// Your body clock for a day: when focus, the afternoon dip and the best time to be active are likely to fall.
// It is an estimate anchored on your usual wake time (median of recent nights), not a measurement, and it says so.
import { buildContext } from '../coach/context';
import { dailyAdvice } from '../coach/advice';
import { bedtimeSuggestion, clockMin } from '../coach/insights';
import type { Deps } from '../coach/types';
import type { DayModel, DayWindow } from './types';

const FOCUS_START = 120; // minutes after waking
const FOCUS_END = 270;
const DIP_START = 420;
const DIP_END = 540;
const ACTIVITY_START = 570;
const ACTIVITY_END = 720;
export const CAFFEINE_HOURS_BEFORE_BED = 9;
const EARLY_BED_SHIFT = 30; // minutes earlier on a day that calls for extra sleep

const hm = (s: string) => +s.slice(0, 2) * 60 + +s.slice(3, 5);

/** The hour (0–23) the user most often starts a workout, when there are enough workouts to say. */
export function usualWorkoutHour(d: Deps): number | null {
  const counts = new Map<number, number>();
  let n = 0;
  for (const w of d.provider.getWorkouts()) {
    if ((w.durationMin ?? 0) < 20) continue;
    const h = Math.round(clockMin(w.start) / 60) % 24;
    counts.set(h, (counts.get(h) ?? 0) + 1);
    n++;
  }
  if (n < 5) return null;
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * `dataDate` is the latest day with data; the model describes a typical day starting from it.
 * `adjust` lets that day's recovery shorten the focus window and move bedtime earlier; turn it off for days that haven't happened yet.
 */
export function dayModel(d: Deps, dataDate: string, adjust = true): DayModel {
  const b = bedtimeSuggestion(d, dataDate);
  const personal = !!b;
  const wake = b ? hm(b.wake) : 7 * 60;
  let bed = b ? hm(b.bed) : 23 * 60;
  if (bed < wake) bed += 1440;

  const ctx = buildContext(d, dataDate);
  const verdict = dailyAdvice(ctx).verdict;
  const low = adjust && (verdict === 'rest' || verdict === 'walk' || verdict === 'sleep');
  const early = adjust && (low || ctx.week.sleepDebtMin >= 180);
  const bedTonight = early ? bed - EARLY_BED_SHIFT : bed;

  // on a low-recovery day the peak is shorter and starts a little later
  const focus: DayWindow = low
    ? { key: 'focus', start: wake + FOCUS_START + 30, end: wake + FOCUS_END - 30 }
    : { key: 'focus', start: wake + FOCUS_START, end: wake + FOCUS_END };
  const dip: DayWindow = { key: 'dip', start: wake + DIP_START, end: wake + DIP_END };
  let activity: DayWindow = { key: 'activity', start: wake + ACTIVITY_START, end: wake + ACTIVITY_END };
  const hour = usualWorkoutHour(d);
  if (hour != null) {
    // your own habit, on the wake-time clock (a workout at 02:00 belongs to the same day, so it can pass 1440)
    let start = hour * 60;
    if (start < wake) start += 1440;
    if (start >= wake + 150 && start + 90 <= bed - 60) activity = { key: 'activity', start, end: start + 90 };
  }
  const winddown: DayWindow = { key: 'winddown', start: bedTonight - 60, end: bedTonight };

  const cutoff = bedTonight - CAFFEINE_HOURS_BEFORE_BED * 60;
  return {
    wake,
    bed: bedTonight,
    usualBed: bed,
    windows: [focus, dip, activity, winddown],
    caffeineCutoff: cutoff > wake + 60 ? cutoff : null,
    early,
    low,
    recovery: ctx.day.recovery?.score ?? null,
    personal,
  };
}

export const clockText = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
