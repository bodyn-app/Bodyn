// Prints the Fitness age page's numbers on the real fixtures, for a sanity check before touching the UI.
// Run: npx tsx scripts/fitness-demo.mts
import fs from 'node:fs';

import { addDays } from '../src/health/provider.ts';
import { createMetrics } from '../src/metrics/engine.ts';
import { fitnessBand } from '../src/metrics/fitness.ts';
import { fitnessTrend, metricProfile } from '../src/metrics/fitness-profile.ts';

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
const deps = { provider: provider as never, metrics: createMetrics(provider as never) };
const date = provider.lastDay;

const f = deps.metrics.fitness();
if (!f) { console.log('No fitness result.'); process.exit(0); }
console.log(`Headline: fitness age ${f.fitnessAge} vs real age ${f.age} → ${fitnessBand(f.fitnessAge, f.age)} (delta ${f.delta})`);
console.log(`VO2 ${f.vo2.toFixed(1)} (typical ${f.typical.toFixed(1)}), category ${f.category}, ${f.readings} readings, last ${f.latestDate}`);
console.log('Fitness trend:', fitnessTrend(deps, profile.sex));

const KEYS = ['sleepConsistency', 'sleepMin', 'hrZone13', 'hrZone45', 'strengthMin', 'steps', 'vo2', 'rhr', 'leanMass'] as const;
for (const k of KEYS) {
  const p = metricProfile(deps, k, date);
  console.log(p ? `${k.padEnd(16)} short ${p.short.toFixed(1).padStart(8)}  long(${p.days}d) ${p.long.toFixed(1).padStart(8)}  pct ${p.pct.toFixed(0).padStart(5)}%  years ${p.years.toFixed(1).padStart(5)}  ${p.tone}` : `${k.padEnd(16)} no data`);
}
