import { describe, expect, it } from 'vitest';

import type { DaySummary, SleepSession, Workout } from '../data/types';
import { addDays, type HealthProvider } from '../health/provider';
import { createMetrics, type RecoveryBand } from '../metrics/engine';
import { dailyAdvice } from './advice';
import { createChat } from './chat';
import { buildContext } from './context';
import { bedtimeSuggestion, lateWorkout, records, weekdayPattern } from './insights';
import { parse } from './understand';
import type { Ctx, Deps, Parsed } from './types';
import { weekPlan } from './week';

// ---------- a small synthetic history ----------
const emptyDay = (over: Partial<DaySummary> = {}): DaySummary => ({
  steps: 5000, distanceKm: 3, activeKcal: 300, basalKcal: 1700, exerciseMin: 20, standHours: 10, goals: null,
  hourly: { steps: null, activeKcal: null, hr: null }, hr: null, rhr: 60, hrvAvg: 50, hrvSamples: 3,
  spo2: null, respAvg: 14, vo2max: null, weightKg: null, bodyFatPct: null, sleep: null, naps: [], overnight: {},
  ...over,
});
const night = (wakeDate: string, asleepMin = 450, wake = '07:30:00'): SleepSession => ({
  start: `${addDays(wakeDate, -1)} 23:30:00 +0200`, end: `${wakeDate} ${wake} +0200`,
  asleepMin, inBedMin: asleepMin + 30, awakeMin: 30, coreMin: 250, deepMin: 90, remMin: 110, efficiency: 94, stages: [],
});
const workout = (date: string, startClock: string, endClock: string): Workout => ({
  type: 'Running', start: `${date} ${startClock}:00 +0200`, end: `${date} ${endClock}:00 +0200`, durationMin: 45, distanceKm: 6, kcal: 400, kcalRest: 60,
  source: 'Apple Watch', hrAvg: 150, hrMin: 90, hrMax: 178, route: null,
});
function history(workouts: Workout[] = []) {
  const days: Record<string, DaySummary> = {};
  for (let i = 0; i < 60; i++) {
    const d = addDays('2026-01-01', i);
    days[d] = emptyDay({ sleep: night(d, 400 + (i % 7) * 15), hrvAvg: 50 + (i % 5), rhr: 58 + (i % 4) });
  }
  const keys = Object.keys(days).sort();
  const provider: HealthProvider = {
    firstDay: keys[0], lastDay: keys[keys.length - 1],
    getDay: (d) => days[d],
    getRange: (from, to) => { const out: { date: string; day: DaySummary | undefined }[] = []; for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, day: days[d] }); return out; },
    getWorkouts: (from, to) => workouts.filter((w) => (!from || w.start.slice(0, 10) >= from) && (!to || w.start.slice(0, 10) <= to)),
    getHrSamples: () => [],
    getProfile: () => ({ age: 30, sex: 'male', heightCm: 180, weightKg: 75, bodyFatPct: null }),
  };
  const deps: Deps = { provider, metrics: createMetrics(provider) };
  return { days, provider, deps };
}

// ---------- hand-made contexts for the advice rules ----------
const rec = (score: number) => ({ score, band: (score >= 67 ? 'green' : score >= 34 ? 'yellow' : 'red') as RecoveryBand, z: 0, contributors: [] });
function ctxOf(o: { score?: number | null; sleepMin?: number | null; prevStrain?: number | null; stress?: number | null; streak?: number; isToday?: boolean } = {}): Ctx {
  const has = (k: keyof typeof o) => k in o;
  return {
    day: {
      date: '2026-03-01', isToday: o.isToday ?? true,
      recovery: o.score === null ? null : rec(o.score ?? 75),
      sleep: { score: 80, needMin: 490, components: [] },
      sleepMin: has('sleepMin') ? o.sleepMin ?? null : 460, needMin: 490,
      strain: 2, prevStrain: has('prevStrain') ? o.prevStrain ?? null : 8,
      stress: o.stress != null ? ({ level: o.stress, label: 'Low', hours: [], highHours: 0, baselineHr: 70, baselineSd: 4, awakeHours: 8 } as never) : null,
      bedtime: '22:45',
    },
    week: { avgRecovery: 60, avgSleepMin: 440, totalStrain: 40, workouts: 3, hardDays: 1, consecutiveHard: o.streak ?? 0, daysSinceRest: 2, recoveryTrend: 0, sleepDebtMin: 60 },
  };
}

describe('daily advice', () => {
  it('green and rested → push', () => expect(dailyAdvice(ctxOf({ score: 80 })).verdict).toBe('push'));
  it('green after a very big day → train, not push', () => expect(dailyAdvice(ctxOf({ score: 80, prevStrain: 17 })).verdict).toBe('train'));
  it('green with three hard days in a row → train', () => expect(dailyAdvice(ctxOf({ score: 80, streak: 3 })).verdict).toBe('train'));
  it('green but high stress caps at train', () => expect(dailyAdvice(ctxOf({ score: 80, stress: 2.4 })).verdict).toBe('train'));
  it('yellow → train smart', () => expect(dailyAdvice(ctxOf({ score: 50 })).verdict).toBe('train'));
  it('yellow after three hard days → easy', () => expect(dailyAdvice(ctxOf({ score: 50, streak: 3 })).verdict).toBe('easy'));
  it('red → walk, very low red → rest', () => {
    expect(dailyAdvice(ctxOf({ score: 30 })).verdict).toBe('walk');
    expect(dailyAdvice(ctxOf({ score: 12 })).verdict).toBe('rest');
  });
  it('short sleep with non-green recovery → sleep first', () => expect(dailyAdvice(ctxOf({ score: 45, sleepMin: 300 })).verdict).toBe('sleep'));
  it('short sleep does not stop a green day', () => expect(dailyAdvice(ctxOf({ score: 80, sleepMin: 340 })).verdict).toBe('push'));
  it('no recovery → no data, with no invented advice', () => {
    const a = dailyAdvice(ctxOf({ score: null }));
    expect(a.verdict).toBe('nodata');
    expect(a.actions).toEqual([]);
  });
  it('past days are worded in the past tense', () => {
    const now = dailyAdvice(ctxOf({ score: 80 }));
    const past = dailyAdvice(ctxOf({ score: 80, isToday: false }));
    expect(now.body).toContain('Recovery is 80%');
    expect(past.body).toContain('Recovery was 80%');
    expect(past.headline).not.toBe(now.headline);
  });
  it('gives targets that match the verdict', () => {
    expect(dailyAdvice(ctxOf({ score: 80 })).target).toEqual([14, 18]);
    expect(dailyAdvice(ctxOf({ score: 50 })).target).toEqual([10, 14]);
  });
});

describe('week plan', () => {
  it('has 7 days, starts with the real verdict, never more than 2 hard days in a row and includes an easier day', () => {
    for (const score of [15, 45, 85]) {
      for (const streak of [0, 1, 2]) {
        const ctx = ctxOf({ score, streak });
        const plan = weekPlan(ctx);
        expect(plan).toHaveLength(7);
        expect(plan[0].verdict).toBe(dailyAdvice(ctx).verdict);
        let run = plan[0].verdict === 'push' ? streak + 1 : 0;
        for (const p of plan.slice(1)) {
          run = p.verdict === 'push' ? run + 1 : 0;
          expect(run).toBeLessThanOrEqual(2);
        }
        expect(plan.some((p) => ['rest', 'walk', 'easy'].includes(p.verdict))).toBe(true);
      }
    }
  });
});

describe('insights', () => {
  it('records finds the highest and lowest values with their dates', () => {
    const { deps, days } = history();
    days['2026-01-20'].sleep = night('2026-01-20', 600);
    days['2026-02-10'].sleep = night('2026-02-10', 200);
    const r = records(deps, 'sleepMin')!;
    expect(r.high).toEqual({ date: '2026-01-20', value: 600 });
    expect(r.low).toEqual({ date: '2026-02-10', value: 200 });
  });
  it('weekday pattern names the bed-time evening for sleep', () => {
    const { deps, days } = history();
    // the night before every Sunday (= wake date Sunday → went to bed Saturday) is long
    for (const d of Object.keys(days)) if (new Date(`${d}T00:00:00Z`).getUTCDay() === 0) days[d].sleep = night(d, 600);
    const w = weekdayPattern(deps, 'sleepMin')!;
    expect(w.night).toBe(true);
    expect(w.high.name).toBe('Saturday');
  });
  it('bedtime = usual wake − sleep need − 15 min buffer', () => {
    const { deps } = history();
    const b = bedtimeSuggestion(deps, '2026-02-20')!;
    expect(b.wake).toBe('07:30');
    expect(b.needMin).toBeGreaterThanOrEqual(480);
    expect(b.needMin).toBeLessThanOrEqual(510);
    const [h, m] = b.bed.split(':').map(Number);
    expect(((h * 60 + m + b.needMin + 15) % 1440)).toBe(7 * 60 + 30);
  });
  it('flags a workout that ended after 20:00 the day before', () => {
    const { deps } = history([workout('2026-02-19', '19:30', '20:40'), workout('2026-02-10', '07:00', '07:50')]);
    expect(lateWorkout(deps, '2026-02-20')!.late).toBe(true);
    expect(lateWorkout(deps, '2026-02-11')!.late).toBe(false);
    expect(lateWorkout(deps, '2026-02-15')).toBeNull();
  });
});

describe('buildContext', () => {
  it('counts hard-day streaks and workouts from the days before', () => {
    const { deps } = history();
    const ctx = buildContext(deps, '2026-02-20');
    expect(ctx.day.isToday).toBe(false);
    expect(ctx.week.consecutiveHard).toBeGreaterThanOrEqual(0);
    expect(ctx.week.sleepDebtMin).toBeGreaterThanOrEqual(0);
  });
});

// ---------- understanding questions, however they are worded ----------
type Expect = Partial<Pick<Parsed, 'topic' | 'ask' | 'when' | 'aspect' | 'term' | 'deferred' | 'smalltalk' | 'weekday'>> & { number?: number; topicIn?: string[]; understood?: boolean };
const CASES: [string, Expect][] = [
  // 1. explaining metrics and status
  ['what is HRV', { topic: 'hrv', ask: 'define', term: 'hrv' }],
  ['HRV?', { ask: 'define', term: 'hrv' }],
  ['what is zone 2', { topic: 'zones', ask: 'define', term: 'zone2' }],
  ['Zone two?', { ask: 'define', term: 'zone2' }],
  ["what's zone 1", { ask: 'define', term: 'zone1' }],
  ['tell me about zone 4', { ask: 'define', term: 'zone4' }],
  ['what does restorative sleep mean', { ask: 'define', term: 'restorative' }],
  ['what is my recovery score', { topic: 'recovery', ask: 'define' }],
  ['why was my recovery low yesterday', { topic: 'recovery', ask: 'why', when: 'yesterday' }],
  ['why is my recovery so low', { topic: 'recovery', ask: 'why' }],
  ["what's impacting my recovery right now", { topic: 'recovery', ask: 'why' }],
  ['what does 72% recovery mean', { topic: 'recovery', ask: 'define', number: 72 }],
  ['why so tired', { topic: 'fatigue', ask: 'why' }],
  ['why am I so tired today', { topic: 'fatigue', ask: 'why' }],
  ['I feel wiped out', { topic: 'fatigue' }],
  ['am I overtraining', { topic: 'fatigue' }],
  ['how does my sleep compare to my average', { topic: 'sleep', ask: 'compare' }],
  ["how's my hrv compared to usual", { topic: 'hrv', ask: 'compare' }],
  // 2. training and readiness
  ['how hard should I train today', { topic: 'strain', ask: 'advice' }],
  ['should I do a hard workout', { ask: 'advice', topicIn: ['workout', 'strain'] }],
  ['how can I hit my optimal strain today', { ask: 'advice' }],
  ['what should I do today', { topic: 'strain', ask: 'advice' }],
  ['what should I do this week', { topic: 'strain', ask: 'advice', when: 'week' }],
  ['am I ready to train', { topicIn: ['recovery', 'strain'] }],
  ['did I work out too late yesterday', { topic: 'sleep', aspect: 'lateworkout' }],
  ['did a late workout hurt my sleep', { topic: 'sleep', aspect: 'lateworkout' }],
  ['should I just walk today', { ask: 'advice', topicIn: ['workout', 'strain'] }],
  // 3. sleep
  ['did I sleep better today', { topic: 'sleep', ask: 'compare' }],
  ['how did I sleep', { topic: 'sleep', ask: 'status' }],
  ["how'd I sleep last night", { topic: 'sleep', ask: 'status' }],
  ['why did I sleep poorly', { topic: 'sleep', ask: 'why' }],
  ['why did i sleeep badly', { topic: 'sleep', ask: 'why' }],
  ['how can I improve my sleep', { topic: 'sleep', ask: 'advice' }],
  ['how can I get more deep sleep', { topic: 'sleep', ask: 'advice', aspect: 'deep' }],
  ['what day do I usually sleep best', { topic: 'sleep', aspect: 'weekday' }],
  ['what time should I go to bed', { topic: 'sleep', aspect: 'bedtime' }],
  ['how much deep sleep did I get', { topic: 'sleep', aspect: 'deep' }],
  ['how was my REM', { topic: 'sleep', aspect: 'rem' }],
  // 4. trends, records, patterns
  ['when was my lowest recovery', { topic: 'recovery', ask: 'record', when: 'all' }],
  ['best recovery ever', { topic: 'recovery', ask: 'record' }],
  ['what was my highest strain', { topic: 'strain', ask: 'record' }],
  ['how was my week', { topic: 'general', when: 'week' }],
  ['any patterns I should know about', { topic: 'general', ask: 'trend' }],
  ['what contributed to my green recoveries', { topic: 'recovery', ask: 'why' }],
  ['is my hrv trending up', { topic: 'hrv', ask: 'trend' }],
  ["what's driving my resting heart rate trend", { topic: 'rhr', ask: 'why' }],
  ['how did my workout compare to last month', { topic: 'workout', ask: 'compare' }],
  ['plan my week', { ask: 'plan' }],
  // 5. recommendations
  ['how can I improve my recovery', { topic: 'recovery', ask: 'advice' }],
  ['what action can I take to get better recovery', { topic: 'recovery', ask: 'advice' }],
  ['how do I recover faster', { topic: 'recovery', ask: 'advice' }],
  ['how can I lower my stress', { topic: 'stress', ask: 'advice' }],
  ['how can I improve my fitness', { topic: 'fitness', ask: 'advice' }],
  // misc topics and typos
  ['how is my stress', { topic: 'stress', ask: 'status' }],
  ["what's my resting heart rate", { topic: 'rhr' }],
  ['how many steps did I take yesterday', { topic: 'steps', when: 'yesterday' }],
  ['whats my recovey', { topic: 'recovery' }],
  ["how's my fitness age", { topic: 'fitness' }],
  // things for the future AI agent
  ['how does my sleep compare to people like me', { deferred: 'peers' }],
  ['does alcohol affect my recovery', { deferred: 'correlation' }],
  ['did late meals ruin my sleep', { deferred: 'correlation' }],
  ['i just had a baby how do i keep fit', { deferred: 'life' }],
  ['i am travelling next week, what should I do', { deferred: 'life' }],
  ['i have chest pain', { deferred: 'medical' }],
  // small talk and gibberish
  ['hello', { smalltalk: 'greet' }],
  ['thanks!', { smalltalk: 'thanks' }],
  ['asdf qwerty', { understood: false }],
];

describe('understanding questions', () => {
  it.each(CASES)('%s', (text, want) => {
    const p = parse(text);
    if (want.topicIn) expect(want.topicIn).toContain(p.topic);
    for (const [k, v] of Object.entries(want)) {
      if (k === 'topicIn') continue;
      expect(p[k as keyof Parsed], `${k} of "${text}"`).toEqual(v);
    }
  });

  it('carries the topic and time into follow-ups', () => {
    const a = parse('how did I sleep');
    const b = parse('and yesterday?', a);
    expect(b).toMatchObject({ topic: 'sleep', when: 'yesterday', followUp: true });
    const c = parse('why?', a);
    expect(c).toMatchObject({ topic: 'sleep', ask: 'why', followUp: true });
    const dd = parse('what about deep sleep?', a);
    expect(dd).toMatchObject({ topic: 'sleep', aspect: 'deep' });
  });

  it('does not let an old topic hijack a new, self-contained question', () => {
    const prev = parse('how is my stress');
    expect(parse('how was my week', prev).topic).toBe('general');
    expect(parse('plan my week', prev).ask).toBe('plan');
    expect(parse('what should I do today', prev).topic).toBe('strain');
    expect(parse('asdf qwerty', prev).understood).toBe(false);
  });

  it('never mistakes "sleep" for the typo of another word', () => {
    expect(parse('did I sleep well').topic).toBe('sleep');
  });
});

// ---------- end to end on the synthetic history ----------
describe('chat answers', () => {
  const { deps } = history([workout('2026-02-19', '19:30', '20:40')]);
  const chat = createChat(deps);
  const ref = '2026-02-20';
  const QUESTIONS = [
    'What should I do today?', 'Why is my recovery low?', 'did I sleep better today', 'what is zone 2', 'why so wiped out', 'best recovery ever',
    'how was my week', 'which day do I sleep best', 'plan my week', 'did I work out too late yesterday', 'what contributed to my green recoveries',
    'how can I improve my sleep', 'is my hrv trending up', 'what time should I go to bed', 'how is my stress', 'how many steps this week', 'what is HRV',
    'what does 72% recovery mean', 'how did my run compare to earlier', "what's my fitness age", 'am I overtraining', 'how many calories did I burn',
  ];
  it.each(QUESTIONS)('answers "%s" with real text and never throws', (q) => {
    const { reply } = chat.answer(q, ref);
    expect(reply.kind).toBe('answer');
    expect(reply.text.length).toBeGreaterThan(10);
    expect(reply.text).not.toMatch(/undefined|NaN|null/);
    for (const b of reply.bullets ?? []) expect(b).not.toMatch(/undefined|NaN|null/);
  });
  it('sends what needs a real AI to an honest "later" reply, without inventing an answer', () => {
    for (const q of ['does coffee ruin my sleep', 'compare me to people like me', 'I have a newborn', 'I feel dizzy and have chest pain']) {
      const { reply } = chat.answer(q, ref);
      expect(reply.kind).toBe('deferred');
    }
  });
  it('says so when it does not understand', () => expect(chat.answer('asdf qwerty', ref).reply.kind).toBe('unknown'));
  it('never names another product', () => {
    for (const q of QUESTIONS) {
      const { reply } = chat.answer(q, ref);
      expect(JSON.stringify(reply)).not.toMatch(/whoop|athlytic|garmin|oura|fitbit|strava|livity/i);
    }
  });
});
