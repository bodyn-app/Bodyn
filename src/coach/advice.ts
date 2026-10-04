// Rule-based daily guidance. Every rule is explainable from the numbers on screen.
import { fmtMin } from '../metrics/engine';
import type { Advice, Ctx, IconName, Tone, Verdict } from './types';

export const TARGETS: Record<Verdict, [number, number] | null> = {
  push: [14, 18],
  train: [10, 14],
  easy: [6, 10],
  walk: [2, 6],
  rest: [0, 4],
  sleep: [0, 8],
  nodata: null,
};

const META: Record<Verdict, { tone: Tone; icon: IconName; title: string; now: string; past: string }> = {
  push: { tone: 'good', icon: 'flash', title: 'Push day', now: 'Green light: go hard today', past: 'A green-light day' },
  train: { tone: 'good', icon: 'barbell', title: 'Train smart', now: 'Train smart today', past: 'A day for a controlled session' },
  easy: { tone: 'warn', icon: 'leaf', title: 'Take it easy', now: 'Keep it easy today', past: 'A day for keeping it easy' },
  walk: { tone: 'warn', icon: 'walk', title: 'Easy walk', now: 'Take a slow walk today', past: 'A day for a slow walk' },
  rest: { tone: 'bad', icon: 'bed', title: 'Rest day', now: 'Rest and recover today', past: 'A day for rest' },
  sleep: { tone: 'info', icon: 'moon', title: 'Sleep first', now: 'Sleep is the priority', past: 'A day where sleep came first' },
  nodata: { tone: 'muted', icon: 'help-circle-outline', title: 'No data yet', now: 'Not enough data yet', past: 'Not enough data' },
};
export const verdictMeta = (v: Verdict) => META[v];

const BAND_WORD = { green: 'well recovered', yellow: 'moderate', red: 'low' } as const;

export function dailyAdvice(ctx: Ctx): Advice {
  const { day, week } = ctx;
  const now = day.isToday;
  const rec = day.recovery;
  const build = (verdict: Verdict, body: string, actions: string[]): Advice => ({
    verdict,
    tone: META[verdict].tone,
    icon: META[verdict].icon,
    title: META[verdict].title,
    headline: now ? META[verdict].now : META[verdict].past,
    body,
    actions,
    target: TARGETS[verdict],
  });

  if (!rec)
    return build(
      'nodata',
      now
        ? "Bodyn needs last night's sleep and heart data to give you guidance. Wear your Watch to bed and check back once it has synced."
        : "There wasn't enough recorded data on this day to give guidance.",
      []
    );

  const score = rec.score;
  const band = rec.band;
  const shortSleep = day.sleepMin != null && (day.sleepMin < 360 || (day.sleep != null && day.sleep.score < 50));
  const stressHigh = (day.stress?.level ?? 0) >= 2;
  const streak = week.consecutiveHard;
  const bigYesterday = (day.prevStrain ?? 0) >= 16;

  let verdict: Verdict;
  if (band !== 'green' && shortSleep) verdict = 'sleep';
  else if (band === 'red') verdict = score < 25 ? 'rest' : 'walk';
  else if (band === 'yellow') verdict = streak >= 3 || bigYesterday ? 'easy' : 'train';
  else verdict = streak >= 3 || bigYesterday || stressHigh ? 'train' : 'push';

  // the numbers behind the call
  const is = now ? 'is' : 'was';
  const before = now ? 'yesterday' : 'the day before';
  const parts = [`Recovery ${is} ${score}% (${BAND_WORD[band]})`];
  if (day.sleepMin != null) parts[0] += `${day.needMin != null && day.sleepMin < day.needMin - 30 ? `, and you slept ${fmtMin(day.sleepMin)} of the ${fmtMin(day.needMin)} you need` : ` after ${fmtMin(day.sleepMin)} of sleep`}`;
  const sentences = [`${parts[0]}.`];
  const prev = day.prevStrain != null ? day.prevStrain.toFixed(1) : null;
  if (verdict === 'push') sentences.push(prev ? `Strain ${before} was ${prev}, so there is room for a hard session.` : 'Your body is ready for a hard session.');
  else if (verdict === 'train') {
    if (bigYesterday) sentences.push(`Strain ${before} was ${prev}, a big day, so keep this one controlled.`);
    else if (streak >= 3) sentences.push(`That is ${streak} hard days in a row, so keep this one controlled.`);
    else if (stressHigh) sentences.push('Stress is running high, so keep the effort moderate.');
    else sentences.push('A solid, not maximal, session fits.');
  } else if (verdict === 'easy') sentences.push(streak >= 3 ? `That is ${streak} hard days in a row: time to absorb the work.` : `Strain ${before} was ${prev}, so give your body a lighter day.`);
  else if (verdict === 'walk' || verdict === 'rest') sentences.push('Your body is asking for a lighter day, and hard training would dig the hole deeper.');
  else if (verdict === 'sleep') sentences.push('Sleep was short, so the best training you can do is an early night.');
  if (stressHigh && verdict !== 'train') sentences.push('Stress is also high today.');

  const bed = day.bedtime ? `Be in bed by ${day.bedtime}` : 'Get to bed early tonight';
  const t = TARGETS[verdict]!;
  const strainLine = `Aim for a strain of ${t[0]}–${t[1]}`;
  const actions: string[] = [];
  if (verdict === 'push') actions.push(strainLine, 'A good day for intervals, a long session or heavy lifting', streak >= 1 ? 'Plan an easier day after this one' : bed);
  else if (verdict === 'train') actions.push(strainLine, 'Moderate effort: you should still be able to talk', 'Stop while you still feel fresh');
  else if (verdict === 'easy') actions.push(`Keep strain under ${t[1]}`, 'Light cardio, mobility or a walk only', bed);
  else if (verdict === 'walk') actions.push('An easy 20–40 minute walk', 'Skip hard intervals and heavy lifting', bed);
  else if (verdict === 'rest') actions.push('Skip structured training', 'Gentle stretching or a short walk is fine', bed);
  else actions.push(bed, `Keep today's effort light (strain under ${t[1]})`, 'Cut caffeine after midday and dim screens in the evening');
  if (stressHigh) actions.push('Try 5 minutes of slow breathing to bring stress down');

  return build(verdict, sentences.join(' '), actions.slice(0, 4));
}
