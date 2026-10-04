import { addDays } from '../health/provider';
import { mean } from '../metrics/math';
import { bedtimeSuggestion } from './insights';
import type { Ctx, Deps } from './types';

export const HARD_STRAIN = 14;
export const EASY_STRAIN = 6;

/** One plain object with the day's numbers and the previous week's load, for advice and chat. */
export function buildContext(d: Deps, date: string): Ctx {
  const { provider, metrics } = d;
  const strainOf = (x: string) => metrics.strain(x)?.strain ?? null;
  const day = provider.getDay(date);
  const sleep = metrics.sleep(date);

  // the seven complete days before `date`, newest first
  const prior = Array.from({ length: 7 }, (_, i) => addDays(date, -(i + 1)));
  const strains = prior.map(strainOf);
  const recs = prior.map((x) => metrics.recovery(x)?.score ?? null);
  const sleeps = prior.map((x) => provider.getDay(x)?.sleep?.asleepMin ?? null);
  const present = (v: (number | null)[]) => v.filter((x): x is number => x != null);

  let consecutiveHard = 0;
  for (const s of strains) {
    if (s != null && s >= HARD_STRAIN) consecutiveHard++;
    else break;
  }
  const restIdx = strains.findIndex((s) => s != null && s < EASY_STRAIN);
  const recent = present(recs.slice(0, 3));
  const older = present(recs.slice(3));
  const debt = prior.reduce((t, x, i) => {
    const need = metrics.sleep(x)?.needMin;
    const got = sleeps[i];
    return need != null && got != null ? t + Math.max(0, need - got) : t;
  }, 0);

  return {
    day: {
      date,
      isToday: date === provider.lastDay,
      recovery: metrics.recovery(date),
      sleep,
      sleepMin: day?.sleep?.asleepMin ?? null,
      needMin: sleep?.needMin ?? null,
      strain: strainOf(date),
      prevStrain: strainOf(addDays(date, -1)),
      stress: metrics.stress(date),
      bedtime: bedtimeSuggestion(d, date)?.bed ?? null,
    },
    week: {
      avgRecovery: present(recs).length ? mean(present(recs)) : null,
      avgSleepMin: present(sleeps).length ? mean(present(sleeps)) : null,
      totalStrain: present(strains).reduce((a, b) => a + b, 0),
      workouts: provider.getWorkouts(prior[6], prior[0]).filter((w) => (w.durationMin ?? 0) >= 10).length,
      hardDays: present(strains).filter((s) => s >= HARD_STRAIN).length,
      consecutiveHard,
      daysSinceRest: present(strains).length ? (restIdx >= 0 ? restIdx : 7) : null,
      recoveryTrend: recent.length >= 2 && older.length >= 2 ? mean(recent) - mean(older) : null,
      sleepDebtMin: Math.round(debt),
    },
  };
}
