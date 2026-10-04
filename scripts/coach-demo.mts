// Checks the rule-based coach on the real fixtures: the spread of daily verdicts, and answers to sample questions.
// Run: npx tsx scripts/coach-demo.mts            (verdict distribution + a default set of questions)
//      npx tsx scripts/coach-demo.mts "why did i sleep badly" "what is zone 2"   (your own questions)
import fs from 'node:fs';

import { dailyAdvice } from '../src/coach/advice.ts';
import { createChat, quickPrompts } from '../src/coach/chat.ts';
import { buildContext } from '../src/coach/context.ts';
import { weekPlan } from '../src/coach/week.ts';
import { addDays } from '../src/health/provider.ts';
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
const chat = createChat(deps);

const ref = provider.lastDay;
const args = process.argv.slice(2);

if (!args.length) {
  const count: Record<string, number> = {};
  let n = 0;
  for (let d = provider.firstDay; d <= provider.lastDay; d = addDays(d, 1)) {
    if (!days[d]) continue;
    const a = dailyAdvice(buildContext(deps, d));
    count[a.verdict] = (count[a.verdict] ?? 0) + 1;
    n++;
  }
  console.log(`Verdicts over ${n} days:`, Object.entries(count).map(([k, v]) => `${k} ${v} (${Math.round((v / n) * 100)}%)`).join(', '));
  for (const d of [ref, addDays(ref, -3), '2026-09-17']) {
    const ctx = buildContext(deps, d);
    const a = dailyAdvice(ctx);
    console.log(`\n== ${d}: ${a.verdict} · ${a.headline}\n${a.body}\n - ${a.actions.join('\n - ')}`);
    console.log('week:', weekPlan(ctx, a).map((x) => `${x.label}:${x.verdict}`).join(' '));
  }
  console.log('\nquick prompts:', quickPrompts(buildContext(deps, ref)));
}

const questions = args.length
  ? args
  : [
      'What should I do today?', 'Why is my recovery low?', 'did I sleep better today?', 'What is zone 2?', 'why so wiped out', 'best recovery ever',
      'how was my week', 'Which day do I sleep best?', 'How hard should I train today?', 'What does 72% recovery mean', 'plan my week',
      'did I work out too late yesterday?', 'what contributed to my green recoveries', 'how can I improve my sleep', 'is my hrv trending up',
      'why did i sleep poorly', 'what time should i go to bed', 'how is my stress', 'does alcohol affect my recovery', 'compare me to people like me',
      'i have a newborn how do i keep fit', 'i have chest pain', 'asdf qwerty',
    ];
let prev = null;
for (const q of questions) {
  const { reply, parsed } = chat.answer(q, ref, prev);
  if (reply.kind === 'answer') prev = parsed;
  console.log(`\n> ${q}   [topic=${parsed.topic} ask=${parsed.ask} when=${parsed.when}${parsed.aspect ? ` aspect=${parsed.aspect}` : ''}${parsed.term ? ` term=${parsed.term}` : ''}]`);
  console.log(reply.text);
  for (const b of reply.bullets ?? []) console.log('  •', b);
}
