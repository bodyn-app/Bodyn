// Finishes `expo export -p web` for GitHub Pages and refuses to ship a build that could leak health data.
// Run: npm run build:web   (CI runs the same thing before every deploy)
//
// 1. injects a Content-Security-Policy so the page can't send anything to another server
// 2. 404.html = index.html, so deep links like /Bodyn/sleep load the app on GitHub Pages
// 3. .nojekyll, because Expo's output has folders starting with "_"
// 4. leak guard: fails if the output contains personal data files or date-keyed health records
import fs from 'node:fs';
import path from 'node:path';

const DIST = process.argv[2] ?? 'dist';
const MAX_BUNDLE_BYTES = 8 * 1024 ** 2; // the app is ~3.6 MB; a jump past this usually means data got bundled
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // react-native-web writes its styles into <style> tags at runtime
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // nothing may be sent anywhere except this site (and the app itself never sends health data even here)
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const fail = (msg) => {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
};

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });

if (!fs.existsSync(path.join(DIST, 'index.html'))) fail(`${DIST}/index.html not found. Run \`npx expo export -p web\` first.`);

// ---------- leak guard ----------
const files = walk(DIST);
const rel = (f) => path.relative(DIST, f).replaceAll('\\', '/');

const dataFiles = files.filter((f) => /\.(zip|xml|gpx|csv)$/i.test(f) || /(^|\/)(fixtures|raw|tmp)\//.test(rel(f)) || /export(_cda)?\.xml/i.test(f));
if (dataFiles.length) fail(`Personal data files in the build:\n  ${dataFiles.map(rel).join('\n  ')}`);

// imported health data is a big object keyed by date ("2025-03-01":{...}); app code never contains that shape
const DATE_KEYED = /["']?\b20\d\d-[01]\d-[0-3]\d["']?\s*:\s*[{[]/g;
for (const f of files.filter((x) => /\.(js|html|json|map)$/.test(x))) {
  const text = fs.readFileSync(f, 'utf8');
  const hits = text.match(DATE_KEYED)?.length ?? 0;
  if (hits > 3) fail(`${rel(f)} contains ${hits} date-keyed records. Health data has been bundled into the app — do not deploy this.`);
}
const bundleBytes = files.filter((f) => f.endsWith('.js')).reduce((n, f) => n + fs.statSync(f).size, 0);
if (bundleBytes > MAX_BUNDLE_BYTES) fail(`JavaScript is ${(bundleBytes / 1024 ** 2).toFixed(1)} MB (limit ${MAX_BUNDLE_BYTES / 1024 ** 2} MB). Check nothing like a data file got bundled.`);

// ---------- index.html: CSP, no external resources ----------
const indexPath = path.join(DIST, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
if (!html.includes('http-equiv="Content-Security-Policy"'))
  html = html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
if (!html.includes('Content-Security-Policy')) fail('Could not inject the Content-Security-Policy into index.html.');
const external = [...html.matchAll(/\b(?:src|href)\s*=\s*["'](https?:)?\/\/[^"']+/gi)].map((m) => m[0]);
if (external.length) fail(`index.html loads resources from other servers:\n  ${external.join('\n  ')}`);
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fail('index.html has an inline <script>, which the CSP would block.');
fs.writeFileSync(indexPath, html);

// ---------- GitHub Pages ----------
fs.writeFileSync(path.join(DIST, '404.html'), html);
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

console.log(`✓ ${DIST}: CSP injected, 404.html + .nojekyll written, no health data found (${files.length} files, JS ${(bundleBytes / 1024 ** 2).toFixed(1)} MB)`);
