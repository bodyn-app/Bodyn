// Prints the distribution of Sleep / Recovery / Strain over the real fixtures, to sanity-check calibration.
// Run: npx tsx scripts/calibrate-metrics.mts
import fs from 'node:fs';

import { createMetrics } from '../src/metrics/engine.ts';
import { addDays } from '../src/health/provider.ts';

const file = JSON.parse(fs.readFileSync('src/data/fixtures/days.json', 'utf8'));
const profile = JSON.parse(fs.readFileSync('src/data/fixtures/profile.json', 'utf8'));
const workouts = JSON.parse(fs.readFileSync('src/data/fixtures/workouts.json', 'utf8'));
const days = file.days;

const provider = {
  firstDay: file.firstDay,
  lastDay: file.lastDay,
  getDay: (d: string) => days[d],
  getRange: (from: string, to: string) => {
    const out = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push({ date: d, day: days[d] });
    return out;
  },
  getWorkouts: (from?: string, to?: string) => workouts.filter((w: { start: string }) => (!from || w.start.slice(0, 10) >= from) && (!to || w.start.slice(0, 10) <= to)),
  getHrSamples: () => [],
  getProfile: () => profile,
};
const m = createMetrics(provider as never);

const q = (a: number[], p: number) => a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))];
const summarize = (name: string, a: number[]) =>
  console.log(`${name.padEnd(9)} n=${String(a.length).padStart(3)}  min ${q(a, 0).toFixed(1)}  p10 ${q(a, 0.1).toFixed(1)}  p25 ${q(a, 0.25).toFixed(1)}  med ${q(a, 0.5).toFixed(1)}  p75 ${q(a, 0.75).toFixed(1)}  p90 ${q(a, 0.9).toFixed(1)}  max ${q(a, 1).toFixed(1)}`);

const dates = Object.keys(days).sort();
const strains: number[] = [], trimps: number[] = [], sleeps: number[] = [], recs: number[] = [];
const workoutDays = new Set(workouts.map((w: { start: string }) => w.start.slice(0, 10)));
const strainW: number[] = [], strainNW: number[] = [];
for (const d of dates) {
  const s = m.strain(d);
  if (s && d < file.lastDay) {
    strains.push(s.strain);
    trimps.push(s.trimp);
    (workoutDays.has(d) ? strainW : strainNW).push(s.strain);
  }
  const sl = m.sleep(d);
  if (sl) sleeps.push(sl.score);
  const r = m.recovery(d);
  if (r) recs.push(r.score);
}
summarize('TRIMP', trimps);
summarize('Strain', strains);
summarize('  workout', strainW);
summarize('  no wkt', strainNW);
summarize('Sleep', sleeps);
summarize('Recovery', recs);
const bands = { red: 0, yellow: 0, green: 0 } as Record<string, number>;
for (const d of dates) { const r = m.recovery(d); if (r) bands[r.band]++; }
console.log('recovery bands', bands);
console.log('last 5 days:');
for (const d of dates.slice(-5)) console.log(d, 'sleep', m.sleep(d)?.score ?? '-', 'recovery', m.recovery(d)?.score ?? '-', 'strain', m.strain(d)?.strain ?? '-', 'trimp', m.strain(d)?.trimp ?? '-');
const top = dates.map((d) => [d, m.strain(d)?.strain ?? 0] as const).sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log('top strain days', top);

// ---- stress & fitness age ----
const stressVals: number[] = [], highHrs: number[] = [], awakeHrs: number[] = [];
const bandCount = { Low: 0, Moderate: 0, High: 0 } as Record<string, number>;
for (const d of dates) {
  const s = m.stress(d);
  if (s && d < file.lastDay) { stressVals.push(s.level); highHrs.push(s.highHours); awakeHrs.push(s.awakeHours); bandCount[s.label]++; }
}
summarize('Stress', stressVals);
summarize('  highHrs', highHrs);
summarize('  awakeHrs', awakeHrs);
console.log('stress bands', bandCount);
const sl = m.stress(dates[dates.length - 2]);
console.log('sample day', dates[dates.length - 2], sl && { level: sl.level, label: sl.label, baselineHr: Math.round(sl.baselineHr), sd: Math.round(sl.baselineSd), hours: sl.hours.map((h) => h.state[0] + (h.level != null ? h.level.toFixed(1) : '')).join(' ') });
const fit = m.fitness();
console.log('fitness', fit && { ...fit, monthly: fit.monthly.length + ' months' });
