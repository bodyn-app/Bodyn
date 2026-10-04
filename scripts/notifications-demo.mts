// Prints the notification plan the app would build from the real fixtures, for a chosen moment.
// Run: npx tsx scripts/notifications-demo.mts            (plan from "now")
//      npx tsx scripts/notifications-demo.mts 2026-09-21T09:00
import fs from 'node:fs';

import { addDays } from '../src/health/provider.ts';
import { clockText, dayModel } from '../src/notifications/circadian.ts';
import { buildPlan } from '../src/notifications/plan.ts';
import { DEFAULT_PREFS } from '../src/notifications/types.ts';
import { createMetrics } from '../src/metrics/engine.ts';

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

const now = process.argv[2] ? new Date(process.argv[2]) : new Date();
const m = dayModel(deps, provider.lastDay, true);
console.log(`Data day ${provider.lastDay}. Wake ${clockText(m.wake)}, usual bed ${clockText(m.usualBed)}, bed tonight ${clockText(m.bed)}${m.early ? ' (earlier tonight)' : ''}, recovery ${m.recovery ?? '–'}, low day ${m.low}`);
console.log('Windows:', m.windows.map((w) => `${w.key} ${clockText(w.start)}–${clockText(w.end)}`).join(' · '), '· caffeine cutoff', m.caffeineCutoff != null ? clockText(m.caffeineCutoff) : 'none');
console.log(`\nPlan from ${now.toString().slice(0, 21)}:`);
for (const p of buildPlan(deps, now, DEFAULT_PREFS)) {
  console.log(`${p.at.toString().slice(0, 21)}  [${p.category.padEnd(9)}] ${p.title}: ${p.body}`);
}
