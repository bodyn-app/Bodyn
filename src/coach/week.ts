import { addDays } from '../health/provider';
import { dowShort } from '../lib/format';
import { dailyAdvice, TARGETS } from './advice';
import type { Ctx, PlanDay, Verdict } from './types';

const PATTERNS: Record<'high' | 'mid' | 'low', Verdict[]> = {
  high: ['train', 'push', 'easy', 'push', 'rest', 'train'],
  mid: ['easy', 'train', 'easy', 'train', 'rest', 'easy'],
  low: ['walk', 'easy', 'walk', 'train', 'rest', 'easy'],
};
const isHard = (v: Verdict) => v === 'push';

/**
 * A suggested seven days: today's call comes from real data, the days after follow a pattern
 * chosen by your recent recovery, with never more than two hard days in a row and a rest day inside the week.
 */
export function weekPlan(ctx: Ctx, today = dailyAdvice(ctx)): PlanDay[] {
  const { day, week } = ctx;
  const score = day.recovery ? (week.avgRecovery != null ? (day.recovery.score + week.avgRecovery) / 2 : day.recovery.score) : week.avgRecovery ?? 50;
  const pattern = PATTERNS[score >= 67 ? 'high' : score >= 34 ? 'mid' : 'low'];

  const verdicts: Verdict[] = [today.verdict === 'nodata' ? 'easy' : today.verdict];
  let run = isHard(verdicts[0]) ? week.consecutiveHard + 1 : 0;
  for (let i = 0; i < 6; i++) {
    let v = pattern[i];
    if (isHard(v) && run >= 2) v = 'train';
    run = isHard(v) ? run + 1 : 0;
    verdicts.push(v);
  }
  // a week with no rest day gets one on day 6
  if (!verdicts.some((v) => v === 'rest' || v === 'walk' || v === 'easy')) verdicts[5] = 'rest';

  return verdicts.map((v, i) => {
    const date = addDays(day.date, i);
    return { date, label: i === 0 ? (day.isToday ? 'Today' : dowShort(date)) : dowShort(date), verdict: v, target: TARGETS[v], isToday: i === 0 };
  });
}
