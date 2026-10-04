// Streams data/tmp/export.xml and prints which record types exist, counts, date ranges and sources.
import fs from 'node:fs';
import readline from 'node:readline';

const file = process.argv[2] ?? 'data/tmp/export.xml';
const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });

const attr = (line, name) => {
  const m = line.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : undefined;
};

const stats = new Map();
const workouts = new Map();
let activitySummaries = 0;

for await (const raw of rl) {
  const line = raw.trimStart();
  if (line.startsWith('<Record ')) {
    const type = attr(line, 'type');
    const start = attr(line, 'startDate')?.slice(0, 10);
    const source = attr(line, 'sourceName');
    let s = stats.get(type);
    if (!s) stats.set(type, (s = { n: 0, min: start, max: start, sources: new Set(), unit: attr(line, 'unit') }));
    s.n++;
    if (start < s.min) s.min = start;
    if (start > s.max) s.max = start;
    s.sources.add(source);
  } else if (line.startsWith('<Workout ')) {
    const t = attr(line, 'workoutActivityType');
    workouts.set(t, (workouts.get(t) ?? 0) + 1);
  } else if (line.startsWith('<ActivitySummary ')) {
    activitySummaries++;
  }
}

console.log('--- Record types ---');
[...stats.entries()]
  .sort((a, b) => b[1].n - a[1].n)
  .forEach(([t, s]) =>
    console.log(`${t.replace('HKQuantityTypeIdentifier', '').replace('HKCategoryTypeIdentifier', 'Cat:')}\t${s.n}\t${s.min}..${s.max}\t${s.unit ?? ''}\t[${[...s.sources].slice(0, 3).join(' | ')}]`)
  );
console.log('--- Workouts ---');
console.log([...workouts.entries()].sort((a, b) => b[1] - a[1]));
console.log('ActivitySummary days:', activitySummaries);

