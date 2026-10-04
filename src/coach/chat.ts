// Builds an answer from a parsed question and the user's own numbers. Every sentence comes from real data or a
// short piece of general guidance; nothing here is a stored answer to a stored question.
import { addDays } from '../health/provider';
import { dateLabel, workoutLabel } from '../lib/format';
import { fmtMin } from '../metrics/engine';
import { dailyAdvice } from './advice';
import { buildContext } from './context';
import { GLOSSARY, termById, type GlossEnv } from './glossary';
import {
  avgOver, bedtimeSuggestion, fmtMetric, greenVsRed, hhmm, lateWorkout, METRIC, metricValue, records, recoveryDrivers, sameTypeCompare, trendDirection,
  vsOwnAverage, weakestSleepPart, weekdayName, weekdayPattern, workoutStrainProfile, zoneRanges, type MetricKey,
} from './insights';
import { parse } from './understand';
import type { CoachReply, Ctx, Deps, Parsed, Topic } from './types';
import { weekPlan } from './week';

type Body = { text: string; bullets?: string[] };

const round = (v: number, d = 0) => (d ? v.toFixed(d) : String(Math.round(v)));
const signed = (v: number, d = 0) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(d)}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** lower-case a label, but keep acronyms such as HRV (SDNN) as they are */
const lc = (s: string) => (/^[A-Z]{2,}/.test(s) ? s : s.toLowerCase());

export function quickPrompts(ctx: Ctx): string[] {
  const band = ctx.day.recovery?.band;
  return [
    'What should I do today?',
    band === 'green' ? 'Why is my recovery high?' : 'Why is my recovery low?',
    'Plan my week',
    'How did I sleep?',
    'Which day do I sleep best?',
    'When was my lowest recovery?',
    'What is HRV?',
    'How can I improve my recovery?',
  ];
}

const CHIPS: Record<Topic, string[]> = {
  recovery: ['Why is my recovery like this?', 'How can I improve my recovery?', 'What should I do today?'],
  sleep: ['How can I improve my sleep?', 'Which day do I sleep best?', 'What time should I go to bed?'],
  strain: ['Plan my week', 'What is strain?', 'How is my recovery?'],
  stress: ['How can I lower my stress?', 'How was my stress this week?', 'What is stress level?'],
  hrv: ['What is HRV?', 'How is my HRV trending?', 'How can I improve my recovery?'],
  rhr: ['How is my resting heart rate trending?', 'Why is my recovery like this?', 'What is resting heart rate?'],
  zones: ['What is zone 2?', 'What is zone 4?', 'How hard should I train today?'],
  steps: ['How were my steps this week?', 'What is my best day for steps?', 'What should I do today?'],
  calories: ['How many calories did I burn this week?', 'What should I do today?', 'How was my week?'],
  fitness: ['What is VO2 max?', 'How can I improve my fitness?', 'What is fitness age?'],
  workout: ['How was my week?', 'How hard should I train today?', 'Plan my week'],
  fatigue: ['Why is my recovery like this?', 'How did I sleep?', 'What should I do today?'],
  general: ['What should I do today?', 'Plan my week', 'When was my lowest recovery?'],
};

export function createChat(d: Deps) {
  const { provider, metrics } = d;
  const today = provider.lastDay;
  const yesterday = addDays(today, -1);

  const named = (date: string) => (date === today ? 'today' : date === yesterday ? 'yesterday' : `on ${dateLabel(date, today)}`);
  const night = (date: string) => (date === today ? 'last night' : date === yesterday ? 'the night before last' : `the night into ${dateLabel(date, today)}`);
  const was = (date: string) => (date === today ? 'is' : 'was');
  const dateOf = (p: Parsed, ref: string) => (p.when === 'yesterday' ? addDays(ref, -1) : ref);
  const noData = (what: string, date: string, key?: MetricKey): Body => ({
    text: date === today && (key === 'strain' || key === 'steps' || key === 'kcal' || key === 'stress')
      ? `I don't have enough ${what} data for today yet.`
      : `I don't have ${what} data ${named(date)}.`,
  });
  const glossEnv = (date: string): GlossEnv => ({ hrMax: metrics.hrProfile(date).hrMax });

  // ---------- shared building blocks ----------
  function cmpLine(key: MetricKey, a: number, b: number, aName: string, bName: string): string {
    const info = METRIC[key];
    const diff = a - b;
    const rel = b ? Math.abs(diff) / Math.abs(b) : 0;
    const same = rel < 0.02 || (key === 'stress' && Math.abs(diff) < 0.1);
    const word = same ? 'about the same as' : diff > 0 ? 'higher than' : 'lower than';
    const good = info.higherIsBetter == null || same ? '' : (diff > 0) === info.higherIsBetter ? ', which is better' : ', which is worse';
    return `${cap(info.label)} ${aName} ${fmtMetric(key, a)}: ${word} ${bName} (${fmtMetric(key, b)})${good}.`;
  }

  function compareLines(key: MetricKey, date: string, p: Parsed): string[] {
    const v = metricValue(d, key, date);
    if (v == null) return [];
    const out: string[] = [];
    const pv = metricValue(d, key, addDays(date, -1));
    const avg = vsOwnAverage(d, key, date);
    const prevLine = pv != null ? cmpLine(key, v, pv, named(date), date === today ? 'the day before' : 'the day before') : null;
    const avgLine = avg ? cmpLine(key, v, avg.avg, named(date), `your ${avg.n}-day average`) : null;
    if (p.versus === 'avg') out.push(...[avgLine, prevLine].filter((x): x is string => !!x));
    else out.push(...[prevLine, avgLine].filter((x): x is string => !!x));
    return out;
  }

  function recordBody(key: MetricKey): Body {
    const r = records(d, key);
    if (!r) return { text: `I don't have enough ${METRIC[key].label} history yet.` };
    const at = (e: { date: string; value: number }) => `${fmtMetric(key, e.value)} on ${dateLabel(e.date, today)} ${e.date.slice(0, 4)}`;
    return { text: `Across ${r.n} days of data, your highest ${METRIC[key].label} was ${at(r.high)}.`, bullets: [`Highest: ${at(r.high)}`, `Lowest: ${at(r.low)}`] };
  }

  function trendBody(key: MetricKey, date: string): Body {
    const w = trendDirection(d, key, date, 7);
    const m = trendDirection(d, key, date, 30);
    if (!w && !m) return { text: `I don't have enough ${METRIC[key].label} data to see a trend yet.` };
    const line = (t: NonNullable<typeof w>, span: string) =>
      t.dir === 'flat'
        ? `Over the last ${span} your ${METRIC[key].label} has been steady at about ${fmtMetric(key, t.recent)}.`
        : `Over the last ${span} your ${METRIC[key].label} averaged ${fmtMetric(key, t.recent)}, ${t.dir} ${Math.abs(Math.round(t.pct))}% from the ${span} before (${fmtMetric(key, t.before)}).`;
    const lines = [w && line(w, '7 days'), m && line(m, '30 days')].filter((x): x is string => !!x);
    return { text: lines[0], bullets: lines.slice(1) };
  }

  function statusBody(key: MetricKey, date: string, lead?: string): Body {
    const v = metricValue(d, key, date);
    if (v == null) return noData(METRIC[key].label, date, key);
    const avg = vsOwnAverage(d, key, date);
    const rel = avg ? (Math.abs(avg.pct) < 3 ? 'right on your usual level' : `${Math.abs(Math.round(avg.pct))}% ${avg.diff > 0 ? 'above' : 'below'} your ${avg.n}-day average of ${fmtMetric(key, avg.avg)}`) : null;
    return { text: `${lead ?? `Your ${METRIC[key].label} ${was(date)}`} ${fmtMetric(key, v)}${lead ? '' : ` ${named(date)}`}${rel ? `, ${rel}` : ''}.` };
  }

  function weekdayBody(key: MetricKey): Body {
    const w = weekdayPattern(d, key);
    if (!w) return { text: `I don't have enough ${METRIC[key].label} history to see a weekday pattern yet.` };
    const nm = (r: { name: string }) => (w.night ? `${r.name} night` : `${r.name}s`);
    const info = METRIC[key];
    const bestIsHigh = info.higherIsBetter !== false;
    const best = bestIsHigh ? w.high : w.low;
    const worst = bestIsHigh ? w.low : w.high;
    return {
      text: info.higherIsBetter === null ? `Your ${info.label} is highest on ${nm(w.high)}s and lowest on ${nm(w.low)}s.` : `Your best ${info.label} comes on ${nm(best)} (${fmtMetric(key, best.avg)} on average), and your weakest on ${nm(worst)} (${fmtMetric(key, worst.avg)}).`,
      bullets: w.rows.map((r) => `${r.name}${w.night ? ' night' : ''}: ${fmtMetric(key, r.avg)}`),
    };
  }

  // ---------- topics ----------
  function recoveryBody(p: Parsed, date: string, ctx: Ctx): Body {
    const drivers = recoveryDrivers(d, date);
    const bandWord = (b: string) => (b === 'green' ? 'green, well recovered' : b === 'yellow' ? 'yellow, moderate' : 'red, low');

    if (p.ask === 'define' && p.number != null) {
      const n = p.number;
      const band = n >= 67 ? 'green' : n >= 34 ? 'yellow' : 'red';
      const meaning = { green: 'Your body is well recovered and ready for a hard day of training.', yellow: 'A moderate recovery: train, but stay in control and avoid going all out.', red: 'Your body is under-recovered: favour rest, sleep or an easy walk today.' }[band];
      return { text: `A recovery of ${n}% is in the ${bandWord(band)} band. ${meaning}` };
    }
    if (p.ask === 'define' && !p.personal) return glossBody('recovery', date);
    if (!drivers) return noData('recovery', date);

    if (p.ask === 'define') return { text: `Your recovery ${was(date)} ${drivers.score}% (${bandWord(drivers.band)}), ${drivers.band === 'green' ? 'so your body is ready for a hard day' : drivers.band === 'yellow' ? 'so train, but stay in control' : 'so favour rest, sleep or an easy walk'}.`, bullets: drivers.ranked.map((x) => x.text) };

    if (p.ask === 'why' && (p.when !== 'ref' || /\b(green|red|yellow)\b/i.test(p.text))) {
      const g = greenVsRed(d);
      if (g) {
        const l = (label: string, gv: number | null, rv: number | null, f: (v: number) => string) => (gv != null && rv != null ? `${label}: ${f(gv)} on green days, ${f(rv)} on red days` : null);
        return {
          text: 'Looking at all your history, here is what tends to come with your green recoveries compared with your red ones.',
          bullets: [
            l('Sleep time', g.green.sleepMin, g.red.sleepMin, fmtMin),
            l('Sleep score', g.green.sleepScore, g.red.sleepScore, (v) => round(v)),
            l("Previous day's strain", g.green.prevStrain, g.red.prevStrain, (v) => round(v, 1)),
            `Based on ${g.green.n} green and ${g.red.n} red days`,
          ].filter((x): x is string => !!x),
        };
      }
    }
    if (p.ask === 'why') {
      const lines = drivers.ranked.map((x) => `${x.c.z > 0.3 ? '↑' : x.c.z < -0.3 ? '↓' : '→'} ${x.text}`);
      const lead = `Your recovery ${was(date)} ${drivers.score}% (${bandWord(drivers.band)}).`;
      const why = drivers.band === 'green'
        ? drivers.best ? ` The biggest help was ${lc(drivers.best.c.label)}.` : ''
        : drivers.worst ? ` The biggest drag was ${lc(drivers.worst.c.label)}.` : ' Nothing stands out on its own: it is a mix of small things.';
      const extra: string[] = [];
      if (date === ctx.day.date && ctx.day.prevStrain != null && ctx.day.prevStrain >= 14) extra.push(`Strain ${date === today ? 'yesterday' : 'the day before'} was ${round(ctx.day.prevStrain, 1)}, which can weigh on the next morning.`);
      if (date === ctx.day.date && (ctx.day.stress?.level ?? 0) >= 2) extra.push('Stress has been high, which also lowers recovery.');
      return { text: lead + why, bullets: [...lines, ...extra] };
    }
    if (p.ask === 'compare') return { text: compareLines('recovery', date, p)[0] ?? `I can't compare: no recovery data ${named(date)}.`, bullets: compareLines('recovery', date, p).slice(1) };
    if (p.ask === 'record') return recordBody('recovery');
    if (p.ask === 'trend') return trendBody('recovery', date);
    if (p.ask === 'advice') {
      const tips: Record<string, string> = {
        hrv: 'HRV is your biggest lever: it rises with good sleep, steady routines and easy days, and drops with stress, alcohol and back-to-back hard sessions',
        rhr: 'A high resting heart rate usually eases with rest days and easy aerobic work (zone 2); stay hydrated and avoid heavy late meals',
        resp: 'Respiratory rate climbs with illness or heavy fatigue: if it stays up, take it easy',
        sleep: `Sleep was the weakest link: aim to be in bed by ${bedtimeSuggestion(d, date)?.bed ?? 'an earlier time'} and keep a steady schedule`,
      };
      const worstKey = drivers.worst?.c.key;
      const bullets = [worstKey ? tips[worstKey] : null, 'Follow a hard day with an easy one: recovery is built on the easy days', 'Keep bed and wake times steady, even at weekends', 'Wind down for 30 minutes before bed: dim lights, no hard training late in the evening'].filter((x): x is string => !!x);
      return { text: drivers.worst ? `The thing dragging your recovery most right now is ${lc(drivers.worst.c.label)}, so start there.` : 'To lift your recovery, protect the basics.', bullets: bullets.slice(0, 4) };
    }
    return {
      text: `Recovery ${named(date)} ${was(date)} ${drivers.score}% (${bandWord(drivers.band)}).`,
      bullets: [...drivers.ranked.slice().reverse().map((x) => x.text), ...(compareLines('recovery', date, p)[1] ? [compareLines('recovery', date, p)[1]] : [])],
    };
  }

  function sleepBody(p: Parsed, date: string, ctx: Ctx): Body {
    const day = provider.getDay(date);
    const s = day?.sleep;
    const score = metrics.sleep(date);
    const asp = p.aspect;

    if (asp === 'weekday' || p.weekday != null && (p.ask === 'record' || p.ask === 'trend')) return weekdayBody(p.ask === 'record' && /score|quality|well|best|worst/.test(p.text) ? 'sleepScore' : 'sleepScore');
    if (asp === 'bedtime') {
      const b = bedtimeSuggestion(d, date);
      if (!b) return { text: "I need at least three recent nights of sleep to suggest a bedtime." };
      return { text: `To get the ${fmtMin(b.needMin)} you need after ${date === today ? "today's" : 'that'} strain and wake around ${b.wake}, aim to be in bed by ${b.bed}.`, bullets: ['This uses your usual wake time from the last two weeks and a 15 minute buffer to fall asleep', 'Harder days raise your sleep need by up to 30 minutes'] };
    }
    if (asp === 'lateworkout') {
      const lw = lateWorkout(d, date);
      if (!lw) return { text: `I don't see a workout the day before ${date === today ? 'today' : dateLabel(date, today)}, so nothing late to blame for ${night(date)}.` };
      const w = lw.workout;
      const base = `${workoutLabel(w.type)} ended at ${lw.endClock}${lw.late ? ', which is late in the evening' : ', which is early enough not to interfere much'}.`;
      const sl = lw.sleepScore != null && lw.avgSleepScore != null ? `Your sleep score for ${night(date)} was ${lw.sleepScore}, against your usual ${round(lw.avgSleepScore)}.` : 'I have no sleep score for that night.';
      const hint = lw.late && lw.sleepScore != null && lw.avgSleepScore != null && lw.sleepScore < lw.avgSleepScore - 5 ? 'Sleep was below your usual after a late session, which fits the idea that late hard efforts can delay sleep, but one night is not proof.' : 'This is just an observation from one night; many things affect sleep.';
      return { text: `${base} ${sl}`, bullets: [hint, 'If you notice this pattern often, try finishing hard sessions at least 3 hours before bed'] };
    }
    if (!s) return { text: date === today ? "I don't see any sleep recorded for last night yet." : `I don't have any sleep recorded ${night(date)}.` };
    const pct = (m: number) => Math.round((m / Math.max(s.asleepMin, 1)) * 100);
    const scoreTxt = score ? ` (sleep score ${score.score})` : '';

    if (p.ask === 'define' && !p.personal) return glossBody(asp === 'deep' ? 'deep' : asp === 'rem' ? 'rem' : asp === 'light' ? 'core' : 'sleepscore', date);
    if (asp && p.ask !== 'compare' && p.ask !== 'why' && p.ask !== 'advice') {
      const avg = (k: MetricKey) => vsOwnAverage(d, k, date);
      if (asp === 'deep') { const a = avg('deep'); return { text: `You had ${fmtMin(s.deepMin)} of deep sleep ${night(date)}, ${pct(s.deepMin)}% of the night (typical is 13–23%).`, bullets: a ? [`Your usual is about ${fmtMin(a.avg)}`] : undefined }; }
      if (asp === 'rem') { const a = avg('rem'); return { text: `You had ${fmtMin(s.remMin)} of REM sleep ${night(date)}, ${pct(s.remMin)}% of the night (typical is 20–25%).`, bullets: a ? [`Your usual is about ${fmtMin(a.avg)}`] : undefined }; }
      if (asp === 'light') return { text: `You had ${fmtMin(s.coreMin)} of core (light) sleep ${night(date)}, ${pct(s.coreMin)}% of the night. Around half is typical.` };
      if (asp === 'efficiency') return { text: `Sleep efficiency ${night(date)} was ${s.efficiency}%: ${fmtMin(s.awakeMin)} awake out of ${fmtMin(s.inBedMin)} in bed.`, bullets: ['85–95% is typical'] };
      if (asp === 'consistency') { const c = score?.components.find((x) => x.key === 'consistency'); return { text: c?.score != null ? `Consistency ${night(date)} scored ${round(c.score)}/100: ${c.detail}.` : 'I need three or more previous nights to judge consistency.' }; }
      if (asp === 'duration') return { text: `You slept ${fmtMin(s.asleepMin)} ${night(date)}${score ? ` against a need of ${fmtMin(score.needMin)}` : ''}.`, bullets: statusExtras(date) };
    }

    if (p.ask === 'compare') {
      const sc = metricValue(d, 'sleepScore', date);
      const prevDate = addDays(date, -1);
      const psc = metricValue(d, 'sleepScore', prevDate);
      const avgS = vsOwnAverage(d, 'sleepScore', date);
      const avgT = vsOwnAverage(d, 'sleepMin', date);
      const pmin = metricValue(d, 'sleepMin', prevDate);
      const ref = p.versus === 'avg' || psc == null ? avgS?.avg ?? null : psc;
      if (sc == null || ref == null) return { text: `I don't have another night to compare ${night(date)} with.` };
      const word = Math.abs(sc - ref) < 3 ? 'about the same' : sc > ref ? 'better' : 'worse';
      const against = p.versus === 'avg' || psc == null ? `your ${avgS!.n}-night average of ${round(ref)}` : `${round(ref)} the night before`;
      const bullets = [
        pmin != null ? `Time asleep: ${fmtMin(s.asleepMin)} against ${fmtMin(pmin)} the night before` : null,
        avgT ? `Your ${avgT.n}-night average is ${fmtMin(avgT.avg)} asleep${avgS ? ` and a score of ${round(avgS.avg)}` : ''}` : null,
      ].filter((x): x is string => !!x);
      const yesNo = /better|worse/i.test(p.text);
      const asksWorse = /worse/i.test(p.text) && !/better/i.test(p.text);
      const lead = word === 'about the same' ? 'About the same' : yesNo ? (asksWorse ? (word === 'worse' ? 'Yes, worse' : 'No, it was better') : word === 'better' ? 'Yes, better' : 'No, a bit worse') : cap(word);
      return { text: `${lead}: ${night(date)} scored ${round(sc)}, against ${against}.`, bullets };
    }
    if (p.ask === 'why') {
      const w = weakestSleepPart(d, date);
      if (!w) return { text: `I can't score ${night(date)}.` };
      if (w.score >= 80) return { text: `Actually ${night(date)} looked good: ${fmtMin(s.asleepMin)} asleep and a score of ${w.score}. Nothing dragged it down.`, bullets: w.ranked.map((c) => `${c.label}: ${round(c.score!)}/100 (${c.detail})`) };
      const lw = lateWorkout(d, date);
      const extras: string[] = [];
      if (lw?.late) extras.push(`A workout ended at ${lw.endClock} the evening before, which may have kept you wired`);
      if (ctx.day.prevStrain != null && date === ctx.day.date && ctx.day.prevStrain >= 14) extras.push(`Strain the day before was ${round(ctx.day.prevStrain, 1)}, a heavy day`);
      return {
        text: `${cap(night(date))} scored ${w.score}. The weakest part was ${lc(w.weakest!.label)} (${round(w.weakest!.score!)}/100): ${w.weakest!.detail}.`,
        bullets: [...w.ranked.map((c) => `${c.label}: ${round(c.score!)}/100 (${c.detail})`), ...extras],
      };
    }
    if (p.ask === 'advice') {
      const w = weakestSleepPart(d, date);
      const b = bedtimeSuggestion(d, date);
      const tips: Record<string, string> = {
        duration: `Add time in bed: aim to be in bed by ${b?.bed ?? 'an earlier time'} to reach your ${fmtMin(w?.needMin ?? 480)} need`,
        efficiency: 'Keep the bed for sleep, and if you are awake for 20 minutes get up and do something calm until you feel sleepy',
        restorative: 'Deep and REM shrink when the night is cut short or broken: protect the full night and limit alcohol close to bedtime, which suppresses REM',
        consistency: 'Pick a fixed wake time (weekends too) and build your bedtime around it',
      };
      const bullets = [w?.weakest ? tips[w.weakest.key] : null, 'Keep the room cool, dark and quiet', 'No caffeine after early afternoon and dim screens for the last hour', 'Finish hard training at least 3 hours before bed'].filter((x): x is string => !!x);
      return { text: w?.weakest ? `Your weakest sleep area ${night(date)} was ${lc(w.weakest.label)}, so start there.` : 'Small routines make the biggest difference to sleep.', bullets: bullets.slice(0, 4) };
    }
    if (p.ask === 'record') { const a = recordBody('sleepScore'); const b = recordBody('sleepMin'); return { text: a.text, bullets: [...(a.bullets ?? []).map((x) => `Sleep score · ${x}`), ...(b.bullets ?? []).map((x) => `Time asleep · ${x}`)] }; }
    if (p.ask === 'trend') { const a = trendBody('sleepScore', date); const b = trendBody('sleepMin', date); return { text: a.text, bullets: [...(a.bullets ?? []), b.text] }; }

    return { text: `You slept ${fmtMin(s.asleepMin)} ${night(date)}${scoreTxt}.`, bullets: [`Deep ${fmtMin(s.deepMin)} · REM ${fmtMin(s.remMin)} · Core ${fmtMin(s.coreMin)}`, `Efficiency ${s.efficiency}%${score ? ` · needed ${fmtMin(score.needMin)}` : ''}`, ...statusExtras(date)] };
  }
  const statusExtras = (date: string) => {
    const a = vsOwnAverage(d, 'sleepMin', date);
    return a ? [`Your ${a.n}-night average is ${fmtMin(a.avg)}`] : [];
  };

  function strainBody(p: Parsed, date: string, ctx: Ctx): Body {
    const st = metrics.strain(date);
    const advice = dailyAdvice(ctx);
    if (p.ask === 'define' && !p.personal) return glossBody('strain', date);
    if (p.ask === 'plan' || p.when === 'week' && p.ask === 'advice') return planBody(ctx);
    if (p.when === 'tomorrow') {
      const t = weekPlan(ctx, advice)[1];
      return { text: t ? `Tomorrow looks like a ${t.verdict === 'push' ? 'hard' : t.verdict === 'train' ? 'moderate' : t.verdict === 'rest' ? 'rest' : 'light'} day${t.target ? ` (strain ${t.target[0]}–${t.target[1]})` : ''}. It will be updated with tomorrow's recovery once you wake up.` : 'I can plan tomorrow once I have your latest recovery.' };
    }
    if (p.ask === 'advice' || (p.ask === 'status' && p.topics.includes('recovery'))) {
      const bullets = [...advice.actions];
      const t = advice.target;
      if (date === today && st && t) {
        const left = t[1] - st.strain;
        bullets.push(st.strain >= t[1] ? `Strain so far is ${round(st.strain, 1)}, already at the top of your ${t[0]}–${t[1]} range` : `Strain so far is ${round(st.strain, 1)}, about ${round(Math.max(left, 0), 1)} left before the top of the range`);
      }
      const prof = workoutStrainProfile(d);
      if (prof && t && t[1] > 6) bullets.push(`For reference, on your workout days (about ${Math.round(prof.avgWorkoutMin)} min) strain is usually around ${round(prof.workoutDayMedian, 1)}, against ${round(prof.restDayMedian, 1)} on other days`);
      return { text: `${advice.headline}. ${advice.body}`, bullets };
    }
    if (p.ask === 'compare') { const l = compareLines('strain', date, p); return l.length ? { text: l[0], bullets: l.slice(1) } : noData('strain', date, 'strain'); }
    if (p.ask === 'record') return recordBody('strain');
    if (p.ask === 'trend') return trendBody('strain', date);
    if (!st) return noData('strain', date, 'strain');
    const zoneTxt = st.zones.map((m, i) => (m >= 1 ? `Zone ${i + 1}: ${fmtMin(m)}` : null)).filter((x): x is string => !!x);
    if (p.ask === 'why') return { text: `Your strain ${was(date)} ${round(st.strain, 1)} (${st.label}), built from the time your heart rate spent above resting.`, bullets: zoneTxt.length ? zoneTxt : ['Mostly resting heart rate, so very little load'] };
    return { text: `Strain ${named(date)} ${was(date)} ${round(st.strain, 1)} out of 21 (${st.label}).`, bullets: [...zoneTxt, ...(advice.target ? [`Suggested range for a day like this: ${advice.target[0]}–${advice.target[1]}`] : [])] };
  }

  function stressBody(p: Parsed, date: string): Body {
    const s = metrics.stress(date);
    if (p.ask === 'define' && !p.personal) return glossBody('stress', date);
    if (p.ask === 'compare') { const l = compareLines('stress', date, p); return l.length ? { text: l[0], bullets: l.slice(1) } : noData('stress', date, 'stress'); }
    if (p.ask === 'record') return recordBody('stress');
    if (p.ask === 'trend' || p.when === 'week' || p.when === 'month') return trendBody('stress', date);
    if (p.ask === 'advice')
      return { text: 'A few things reliably bring daytime stress down.', bullets: ['Try 5 minutes of slow breathing: in for 4, out for 6', 'Take a short walk outside between tasks', 'Keep caffeine to the morning and avoid skipping meals', 'Protect your sleep, since poor nights raise next-day stress', ...(s && s.highHours >= 2 ? [`Your stress was high for ${s.highHours} hours ${named(date)}: schedule a short break in those windows`] : [])] };
    if (!s) return { text: `I don't have enough daytime heart-rate data for stress ${named(date)}.` };
    const hard = s.hours.filter((h) => h.level != null).sort((a, b) => b.level! - a.level!).slice(0, 2);
    const hrs = hard.map((h) => `${hhmm(h.hour * 60)}–${hhmm(h.hour * 60 + 60)} (${round(h.level!, 1)}, ${round(h.hr ?? 0)} bpm)`);
    if (p.ask === 'why') return { text: `Your stress ${was(date)} ${round(s.level, 1)}/3 (${s.label}). It compares your heart rate in awake, still hours with your usual ${round(s.baselineHr)} bpm.`, bullets: [...(hrs.length ? [`Highest hours: ${hrs.join(', ')}`] : []), `${s.awakeHours} awake, still hours counted`, 'Poor sleep, caffeine, illness and hard days can all lift heart rate at rest'] };
    return { text: `Stress ${named(date)} ${was(date)} ${round(s.level, 1)} out of 3 (${s.label}).`, bullets: [...(hrs.length ? [`Highest hours: ${hrs.join(', ')}`] : []), `${s.awakeHours} awake, still hours counted`] };
  }

  function vitalBody(p: Parsed, date: string, topic: 'hrv' | 'rhr'): Body {
    const key: MetricKey = topic;
    if (p.ask === 'define' && !p.personal) return glossBody(topic, date);
    if (p.ask === 'compare') { const l = compareLines(key, date, p); return l.length ? { text: l[0], bullets: l.slice(1) } : noData(METRIC[key].label, date); }
    if (p.ask === 'record') return recordBody(key);
    if (p.ask === 'trend' || p.when === 'week' || p.when === 'month') return trendBody(key, date);
    if (p.ask === 'why') {
      const dr = recoveryDrivers(d, date);
      const c = dr?.ranked.find((x) => x.c.key === topic);
      const extra = trendBody(key, date);
      return { text: c ? `${c.text}. ${c.c.z < -0.3 ? 'That is worse than usual and pulls your recovery down.' : c.c.z > 0.3 ? 'That is better than usual and helps your recovery.' : 'That is close to your usual.'}` : `I don't have a ${METRIC[key].label} reading ${named(date)} to explain.`, bullets: [extra.text] };
    }
    if (p.ask === 'advice')
      return { text: topic === 'hrv' ? 'HRV responds to the basics, so build them consistently.' : 'Resting heart rate falls slowly as fitness improves and rises when you are run down.', bullets: topic === 'hrv' ? ['Sleep 7–9 hours on a steady schedule', 'Alternate hard and easy days', 'Manage stress: slow breathing, walks, breaks', 'Limit alcohol, especially in the evening'] : ['Build easy aerobic base work (zone 2) a few times a week', 'Rest properly after hard days', 'Stay hydrated and sleep enough', 'A sudden rise of 5+ bpm can mean fatigue or illness: take it easy'] };
    return statusBody(key, date);
  }

  function zonesBody(p: Parsed, date: string): Body {
    if (p.term?.startsWith('zone') || p.ask === 'define') return glossBody(p.term ?? 'zones', date);
    const env = glossEnv(date);
    const st = metrics.strain(date);
    if (p.ask === 'advice')
      return { text: 'Most of your training should be easy, with a little hard work on top.', bullets: ['Zone 2 (easy, conversational) for most of your cardio', 'A small amount in zones 4–5 (hard intervals) once or twice a week, when recovery is green', 'Use the strain target on your guidance card to decide how hard to go', ...(env.hrMax ? [`Your zone 2 is about ${zoneRanges(env.hrMax)[1].lo}–${zoneRanges(env.hrMax)[1].hi} bpm`] : [])] };
    if (!st) return noData('heart-rate zone', date);
    return { text: `Time in each heart-rate zone ${named(date)}:`, bullets: st.zones.map((m, i) => { const r = zoneRanges(st.hrMax)[i]; return `Zone ${i + 1} (${i === 0 ? `under ${r.hi}` : `${r.lo}–${r.hi}`} bpm): ${fmtMin(m)}`; }) };
  }

  function stepsCalBody(p: Parsed, date: string, topic: 'steps' | 'calories'): Body {
    const key: MetricKey = topic === 'steps' ? 'steps' : 'kcal';
    if (p.ask === 'define') return topic === 'calories' ? glossBody('kcal', date) : { text: 'Steps are counted by your iPhone and Watch as you move through the day. They are a simple gauge of everyday activity.' };
    if (p.ask === 'compare') { const l = compareLines(key, date, p); return l.length ? { text: l[0], bullets: l.slice(1) } : noData(METRIC[key].label, date, key); }
    if (p.ask === 'record') return recordBody(key);
    if (p.when === 'week' || p.when === 'month' || p.ask === 'trend') {
      const days = p.when === 'month' ? 30 : 7;
      const total = Array.from({ length: days }, (_, i) => metricValue(d, key, addDays(date, -i)) ?? 0).reduce((a, b) => a + b, 0);
      const t = trendBody(key, date);
      return { text: `Over the last ${days} days you logged ${fmtMetric(key, total)}.`, bullets: [t.text] };
    }
    if (p.ask === 'advice') return { text: topic === 'steps' ? 'Small habits add up.' : 'Active calories come from movement.', bullets: ['Take a 10 minute walk after meals', 'Use stairs and walk during calls', 'Add one easy session on lighter days'] };
    return statusBody(key, date);
  }

  function fitnessBody(p: Parsed, date: string): Body {
    if (p.ask === 'define') return glossBody(p.term === 'fitnessage' ? 'fitnessage' : 'vo2max', date);
    const f = metrics.fitness();
    if (!f) return { text: 'I need VO2 max readings from your Watch (outdoor walks, runs or hikes) to work out your fitness age.' };
    const younger = f.delta <= 0;
    if (p.ask === 'advice') return { text: `Your VO2 max is ${f.vo2.toFixed(1)}. To lift it, mix steady and hard cardio.`, bullets: ['Two or three zone 2 sessions a week of 30–60 minutes', 'One interval session a week (for example 4 × 4 minutes hard) when recovery is green', 'Add outdoor walks, runs or hikes, since your Watch estimates VO2 max from them', 'Keep at it: VO2 max moves slowly, over weeks and months'] };
    const first = f.monthly.find((m) => m.vo2 != null);
    const last = [...f.monthly].reverse().find((m) => m.vo2 != null);
    const trend = first && last && first !== last ? `Since ${first.month} your monthly VO2 max went from ${first.vo2!.toFixed(1)} to ${last.vo2!.toFixed(1)}.` : null;
    return { text: `Your fitness age is ${f.fitnessAge}, ${f.delta === 0 ? 'the same as' : `${Math.abs(f.delta)} year${Math.abs(f.delta) === 1 ? '' : 's'} ${younger ? 'younger' : 'older'} than`} your real age of ${f.age}. VO2 max ${f.vo2.toFixed(1)} rates as ${f.category}.`, bullets: trend ? [trend] : undefined };
  }

  function workoutBody(p: Parsed, date: string): Body {
    const all = provider.getWorkouts();
    const list = provider.getWorkouts(date, date).filter((w) => (w.durationMin ?? 0) >= 1);
    if (p.ask === 'plan') return { text: 'See the weekly plan below.' };
    const target = list.length ? list[list.length - 1] : null;
    if (p.ask === 'compare' && (target ?? all[all.length - 1])) {
      const w = target ?? all.filter((x) => x.start.slice(0, 10) <= date).pop()!;
      const c = sameTypeCompare(d, w);
      if (!c) return { text: `This is your first recorded ${workoutLabel(w.type).toLowerCase()}, so there is nothing earlier to compare it with.` };
      const dur = w.durationMin != null && c.avgDur != null ? `${Math.round(w.durationMin)} min against a recent average of ${Math.round(c.avgDur)}` : null;
      const kc = w.kcal != null && c.avgKcal != null ? `${Math.round(w.kcal)} kcal against ${Math.round(c.avgKcal)}` : null;
      const hr = w.hrAvg != null && c.avgHr != null ? `average heart rate ${Math.round(w.hrAvg)} against ${Math.round(c.avgHr)} bpm` : null;
      return { text: `Comparing your ${workoutLabel(w.type).toLowerCase()} on ${dateLabel(w.start.slice(0, 10), today)} with your last ${Math.min(5, c.count)} similar sessions:`, bullets: [dur && `Duration: ${dur}`, kc && `Energy: ${kc}`, hr && `Effort: ${hr}`].filter((x): x is string => !!x) };
    }
    if (p.when === 'week' || p.when === 'month' || p.ask === 'trend') {
      const days = p.when === 'month' ? 30 : 7;
      const ws = provider.getWorkouts(addDays(date, -(days - 1)), date).filter((w) => (w.durationMin ?? 0) >= 10);
      const mins = ws.reduce((t, w) => t + (w.durationMin ?? 0), 0);
      return { text: ws.length ? `In the last ${days} days you did ${ws.length} workout${ws.length === 1 ? '' : 's'} totalling ${fmtMin(mins)}.` : `I don't see any workouts in the last ${days} days.`, bullets: ws.slice(-5).map((w) => `${dateLabel(w.start.slice(0, 10), today)}: ${workoutLabel(w.type)}, ${Math.round(w.durationMin ?? 0)} min${w.kcal ? `, ${Math.round(w.kcal)} kcal` : ''}`) };
    }
    if (!list.length) return { text: `I don't see a workout ${named(date)}.`, bullets: all.length ? [`Your latest was ${workoutLabel(all[all.length - 1].type)} on ${dateLabel(all[all.length - 1].start.slice(0, 10), today)}`] : undefined };
    return { text: `${named(date) === 'today' ? 'Today' : cap(named(date))} you did ${list.map((w) => `${workoutLabel(w.type)} (${Math.round(w.durationMin ?? 0)} min${w.kcal ? `, ${Math.round(w.kcal)} kcal` : ''})`).join(' and ')}.` };
  }

  function fatigueBody(p: Parsed, date: string, ctx: Ctx): Body {
    const { day, week } = ctx;
    const obs: string[] = [];
    if (day.sleepMin != null && day.needMin != null && day.sleepMin < day.needMin - 45) obs.push(`You slept ${fmtMin(day.sleepMin)} ${night(date)}, ${fmtMin(day.needMin - day.sleepMin)} short of your need`);
    if (week.sleepDebtMin >= 180) obs.push(`Over the last week you are about ${fmtMin(week.sleepDebtMin)} short on sleep in total`);
    if (week.consecutiveHard >= 2) obs.push(`You had ${week.consecutiveHard} hard days in a row before ${date === today ? 'today' : 'this day'}`);
    if (day.recovery && day.recovery.score < 34) obs.push(`Recovery is low at ${day.recovery.score}%`);
    const dr = recoveryDrivers(d, date);
    if (dr?.worst && (dr.worst.c.key === 'hrv' || dr.worst.c.key === 'rhr' || dr.worst.c.key === 'resp')) obs.push(dr.worst.text + ', worse than usual');
    if ((day.stress?.level ?? 0) >= 2) obs.push(`Stress is high (${round(day.stress!.level, 1)}/3)`);
    const adv = dailyAdvice(ctx);
    if (!obs.length)
      return { text: 'Your numbers look fine, so nothing in your data explains it.', bullets: ['Illness, diet, hydration and life stress are invisible to the app', 'If you feel unusually tired for more than a few days, speak to a doctor', ...(adv.verdict !== 'nodata' ? [`Suggested today: ${adv.headline}`] : [])] };
    return { text: 'Here is what your data shows that could explain it:', bullets: [...obs, `Suggested today: ${adv.headline}`, 'This is an observation from your numbers, not a diagnosis'] };
  }

  function planBody(ctx: Ctx): Body {
    const plan = weekPlan(ctx);
    const word: Record<string, string> = { push: 'hard session', train: 'moderate session', easy: 'easy day', walk: 'easy walk', rest: 'rest day', sleep: 'sleep first', nodata: 'easy day' };
    return { text: 'Here is a suggested week. Today comes from your real recovery; the rest follows your recent load and adapts as new data arrives.', bullets: plan.map((x) => `${x.label}: ${word[x.verdict]}${x.target && x.target[1] > 4 ? ` (strain ${x.target[0]}–${x.target[1]})` : ''}`) };
  }

  function generalBody(p: Parsed, date: string, ctx: Ctx): Body {
    if (p.ask === 'plan') return planBody(ctx);
    if (p.ask === 'record' && p.when === 'all') return recordBody('recovery');
    if (p.when === 'all') {
      const r = recordBody('recovery');
      return { text: 'Here are your records so far.', bullets: [`Recovery · ${r.bullets?.[0]}`, `Sleep score · ${recordBody('sleepScore').bullets?.[0]}`, `Strain · ${recordBody('strain').bullets?.[0]}`] };
    }
    if (p.when === 'week' || p.when === 'month' || p.when === 'lastweek' || p.ask === 'trend') {
      const days = p.when === 'month' ? 30 : 7;
      const end = p.when === 'lastweek' ? addDays(date, -7) : date;
      const avg = (k: MetricKey) => avgOver(d, k, end, days);
      const rec = avg('recovery'); const sl = avg('sleepMin'); const ss = avg('sleepScore'); const str = avg('strain'); const stress = avg('stress');
      const ws = provider.getWorkouts(addDays(end, -(days - 1)), end).filter((w) => (w.durationMin ?? 0) >= 10);
      const t = trendDirection(d, 'recovery', end, days);
      const span = p.when === 'month' ? 'the last 30 days' : p.when === 'lastweek' ? 'last week' : 'the last 7 days';
      const bullets = [rec != null && `Recovery averaged ${round(rec)}%`, sl != null && `Sleep averaged ${fmtMin(sl)}${ss != null ? ` (score ${round(ss)})` : ''}`, str != null && `Strain averaged ${round(str, 1)}`, stress != null && `Stress averaged ${round(stress, 1)}/3`, `${ws.length} workout${ws.length === 1 ? '' : 's'}`, t && t.dir !== 'flat' ? `Recovery is ${t.dir} ${Math.abs(Math.round(t.pct))}% on the previous ${days} days` : null].filter((x): x is string => !!x);
      const wp = weekdayPattern(d, 'recovery');
      if (wp && days === 7) bullets.push(`Pattern: your recovery tends to be best on ${wp.high.name}s and lowest on ${wp.low.name}s`);
      return { text: `Here is ${span}.`, bullets };
    }
    const adv = dailyAdvice(ctx);
    const { day } = ctx;
    const parts = [day.recovery && `Recovery ${day.recovery.score}%`, day.sleep && `Sleep ${day.sleep.score}`, day.strain != null && `Strain ${round(day.strain, 1)}`, day.stress && `Stress ${round(day.stress.level, 1)}/3`].filter((x): x is string => !!x);
    return { text: parts.length ? `${cap(named(date))}: ${parts.join(', ')}.` : `I don't have much data ${named(date)}.`, bullets: adv.verdict === 'nodata' ? undefined : [`${adv.headline}. ${adv.body}`] };
  }

  function glossBody(id: string, date: string): Body {
    const e = termById(id) ?? GLOSSARY[0];
    const def = e.def(glossEnv(date));
    return { text: def.text, bullets: def.bullets };
  }

  // ---------- routing ----------
  const deferredReply = (kind: NonNullable<Parsed['deferred']>): CoachReply => {
    const t = {
      correlation: ["Linking things like alcohol, caffeine, food or supplements to your recovery needs you to log them, and Bodyn does not have that data yet. This is exactly what the smarter coach we are building will be able to explore. For now I can show what came with your best recoveries.", ['What came with my green recoveries?', 'Why is my recovery low?']],
      peers: ["Right now I only compare you with your own history, since Bodyn has no data on other people (fitness age is the one exception). Comparing you with your own averages is available.", ['How does my sleep compare to my average?', 'How is my recovery trending?']],
      life: ["Planning around things like a newborn, travel, injury or a very busy stretch needs context I do not have yet. The smarter coach will be able to handle that. For now I can build a week from your recovery and recent load.", ['Plan my week', 'What should I do today?']],
      medical: ["I can not diagnose or give medical advice. If you feel unwell, or have chest pain, dizziness, fainting or anything worrying, please talk to a doctor. I can show how your recovery, resting heart rate and sleep have been changing.", ['How is my resting heart rate trending?', 'How is my recovery trending?']],
    }[kind] as [string, string[]];
    return { text: t[0], chips: t[1], kind: 'deferred' };
  };

  const UNKNOWN: CoachReply = {
    text: "I'm not sure I understood that. I can help with today's training, your week, sleep, recovery, stress, heart-rate zones, and what any of the numbers mean.",
    chips: ['What should I do today?', 'How did I sleep?', 'Why is my recovery like this?'],
    kind: 'unknown',
  };

  function answer(text: string, ref: string, prev: Parsed | null = null): { reply: CoachReply; parsed: Parsed } {
    const p = parse(text, prev);
    const done = (body: Body, chips?: string[]): { reply: CoachReply; parsed: Parsed } => ({ reply: { text: body.text, bullets: body.bullets?.length ? body.bullets : undefined, chips: chips ?? CHIPS[p.topic ?? 'general'], kind: 'answer' }, parsed: p });
    const skip = (reply: CoachReply) => ({ reply, parsed: prev ?? p });

    if (p.smalltalk === 'greet') return skip({ text: `Hi${d.userName?.() ? ` ${d.userName()}` : ''}. Ask me about your day, your week, your sleep or recovery, or what any of the numbers mean.`, chips: ['What should I do today?', 'How did I sleep?', 'Plan my week'], kind: 'smalltalk' });
    if (p.smalltalk === 'thanks') return skip({ text: "You're welcome. Ask me anything else about your training, sleep or recovery.", chips: ['Plan my week', 'What should I do today?'], kind: 'smalltalk' });
    if (p.deferred) return skip(deferredReply(p.deferred));

    // "did I work out too late yesterday?": the sleep in question is the night after that workout, i.e. the reference day's
    const date = p.aspect === 'lateworkout' ? ref : dateOf(p, ref);
    const ctx = buildContext(d, date);

    // a plain definition ("what is zone 2", "HRV?") works without a topic
    if (p.term && p.ask === 'define' && !(p.personal && p.topic && p.topic !== 'zones')) return done(glossBody(p.term, date), p.topic ? CHIPS[p.topic] : ['What should I do today?', 'How did I sleep?']);
    if (!p.topic) return skip(UNKNOWN);

    const t = p.topic;
    let body: Body;
    if (t === 'recovery' && p.topics.includes('strain') && p.ask !== 'why' && p.ask !== 'define') body = strainBody({ ...p, ask: 'advice' }, date, ctx);
    else if (t === 'recovery') body = recoveryBody(p, date, ctx);
    else if (t === 'sleep') body = sleepBody(p, date, ctx);
    else if (t === 'strain') body = strainBody(p, date, ctx);
    else if (t === 'workout') body = p.ask === 'advice' || p.ask === 'status' && p.topics.includes('recovery') ? strainBody({ ...p, ask: 'advice' }, date, ctx) : workoutBody(p, date);
    else if (t === 'stress') body = stressBody(p, date);
    else if (t === 'hrv' || t === 'rhr') body = vitalBody(p, date, t);
    else if (t === 'zones') body = zonesBody(p, date);
    else if (t === 'steps' || t === 'calories') body = stepsCalBody(p, date, t);
    else if (t === 'fitness') body = fitnessBody(p, date);
    else if (t === 'fatigue') body = fatigueBody(p, date, ctx);
    else body = generalBody(p, date, ctx);
    return done(body);
  }

  return { answer, parse };
}

export type Chat = ReturnType<typeof createChat>;
