// Streams data/tmp/export.xml (Apple Health export) and writes compact daily summaries to src/data/fixtures/,
// for the Node-only dev scripts (calibrate-metrics, demos). The app itself never reads these files: on the web it
// parses the user's own export.zip in the browser with the same parser (src/health/import/parse-core.ts).
// Raw data stays in data/ (git-ignored). Run: npm run parse-health
//
// Drop a fresh export at data/raw/export.zip and just run this: whenever the zip is newer than the extracted
// XML it is unpacked again first. Without that, a new zip is silently ignored and you re-parse the old data.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import readline from 'node:readline';

import { createParser } from '../src/health/import/parse-core.ts';

const ZIP = 'data/raw/export.zip';
const TMP_DIR = 'data/tmp';
const XML = `${TMP_DIR}/export.xml`;

/** Unpacks data/raw/export.zip into data/tmp/export.xml when the zip is new (or the XML is missing). */
function extractIfStale() {
  if (!fs.existsSync(ZIP)) return;
  // compared at whole-second resolution: writing a timestamp back loses the sub-millisecond part, which would
  // otherwise leave the copy looking fractionally older than its source and re-extract on every run
  const zipTime = Math.floor(fs.statSync(ZIP).mtimeMs / 1000);
  const xmlTime = fs.existsSync(XML) ? Math.floor(fs.statSync(XML).mtimeMs / 1000) : 0;
  if (xmlTime >= zipTime) return;
  console.log(fs.existsSync(XML) ? 'export.zip is newer than the extracted XML — unpacking it…' : 'No extracted XML yet — unpacking export.zip…');
  fs.mkdirSync(TMP_DIR, { recursive: true });
  // PowerShell is always present on Windows; `unzip` is not
  execFileSync(
    'powershell',
    ['-NoProfile', '-Command',
      `Add-Type -A System.IO.Compression.FileSystem;` +
      `$z=[IO.Compression.ZipFile]::OpenRead((Resolve-Path '${ZIP}'));` +
      `$e=$z.Entries | Where-Object { $_.FullName -like '*export.xml' -and $_.FullName -notlike '*cda*' } | Select-Object -First 1;` +
      `[IO.Compression.ZipFileExtensions]::ExtractToFile($e, (Join-Path (Resolve-Path '${TMP_DIR}') 'export.xml'), $true);` +
      `$z.Dispose()`],
    { stdio: 'inherit' }
  );
  fs.utimesSync(XML, new Date(), new Date(zipTime * 1000));
  console.log(`Unpacked ${(fs.statSync(XML).size / 1e6).toFixed(0)} MB.\n`);
}

if (!process.argv[2]) extractIfStale();

const INPUT = process.argv[2] ?? XML;
const OUT_DIR = 'src/data/fixtures';

const parser = createParser();
const rl = readline.createInterface({ input: fs.createReadStream(INPUT), crlfDelay: Infinity });
for await (const raw of rl) parser.line(raw);
const { generatedAt, firstDay, lastDay, days, hr, workouts, profile } = parser.finish();

// ---------- write ----------
fs.mkdirSync(OUT_DIR, { recursive: true });
const write = (name: string, obj: unknown) => {
  const p = `${OUT_DIR}/${name}`;
  fs.writeFileSync(p, JSON.stringify(obj));
  console.log(`${name}\t${(fs.statSync(p).size / 1024).toFixed(0)} KB`);
};
write('days.json', { generatedAt, firstDay, lastDay, days });
write('hr-recent.json', hr);
write('workouts.json', workouts);
write('profile.json', profile);

// ---------- data quality summary ----------
const list = Object.values(days);
const count = (f: (d: (typeof list)[number]) => unknown) => list.filter(f).length;
console.log(`\nlines read: ${parser.lines}`);
console.log(`days: ${list.length} (${firstDay} → ${lastDay})`);
console.log(`days with: steps ${count((d) => d.steps)}, HR ${count((d) => d.hr)}, sleep ${count((d) => d.sleep)}, ` +
  `overnight HRV ${count((d) => d.overnight.hrv != null)}, RHR ${count((d) => d.rhr != null)}, ` +
  `resp ${count((d) => d.overnight.resp != null)}, SpO2 ${count((d) => d.spo2 != null)}`);
console.log(`workouts: ${workouts.length}, with route: ${workouts.filter((w) => w.route).length}`);
console.log('profile:', profile);
