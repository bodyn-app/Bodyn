// Renders the icon SVGs to 1024 px PNGs and builds a contact sheet, using headless Edge (no extra dependencies).
// Run: node design/app-icons/render.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PROFILE = path.join(process.env.TEMP ?? DIR, 'bodyn-icon-render-profile');
const ICONS = [
  ['icon-1-geometric-b', 'Geometric B'],
  ['icon-2-pulse-b', 'Pulse B'],
  ['icon-3-wordmark', 'bodyn wordmark'],
  ['icon-4-orb-b', 'Orb B'],
  ['icon-5-pastel-b', 'Pastel B (light)'],
  ['icon-6-ring-b', 'Ring B'],
  ['icon-7-aurora-b', 'Aurora glass B'],
  ['icon-8-lime-field-b', 'Lime field B'],
  ['icon-9-ring-b-light', 'Lowercase b (light)'],
  ['icon-10-night-b', 'Night B'],
];

const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=9340', `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(p) { for (let i = 0; i < 60; i++) { try { return await (await fetch(`http://127.0.0.1:9340${p}`)).json(); } catch { await sleep(250); } } throw new Error('no devtools'); }
const page = (await getJson('/json/list')).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
const save = async (file, clip) => {
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true });
  fs.writeFileSync(path.join(DIR, file), Buffer.from(r.result.data, 'base64'));
  console.log('wrote', file);
};

await send('Page.enable');

// 1) each SVG → 1024 px PNG
await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 1024, deviceScaleFactor: 1, mobile: false });
for (const [file] of ICONS) {
  await send('Page.navigate', { url: pathToFileURL(path.join(DIR, `${file}.svg`)).href });
  await sleep(700);
  await save(`${file}.png`, { x: 0, y: 0, width: 1024, height: 1024 });
}

// 2) contact sheet
const url = (f) => pathToFileURL(path.join(DIR, `${f}.png`)).href;
const neighbours = [['#5B8DEF', 'circle'], ['#F0A45D', 'ring'], ['#8FA0B5', 'bars'], ['#6CC58B', 'dot']];
const glyph = (k) =>
  k === 'circle' ? '<i style="width:46%;height:46%;border-radius:50%;background:#fff;opacity:.9"></i>'
  : k === 'ring' ? '<i style="width:46%;height:46%;border-radius:50%;border:4px solid #fff;opacity:.9;box-sizing:border-box"></i>'
  : k === 'bars' ? '<i style="width:46%;height:40%;background:linear-gradient(#fff 0 22%,transparent 22% 39%,#fff 39% 61%,transparent 61% 78%,#fff 78%);opacity:.9;border-radius:3px"></i>'
  : '<i style="width:30%;height:30%;border-radius:50%;background:#fff;opacity:.9"></i>';
const sq = (size, bg, inner) => `<div style="width:${size}px;height:${size}px;border-radius:${size * 0.2237}px;background:${bg};display:flex;align-items:center;justify-content:center;overflow:hidden;flex:none">${inner}</div>`;
const img = (file, size) => `<img src="${url(file)}" style="width:${size}px;height:${size}px;border-radius:${size * 0.2237}px;display:block;flex:none">`;
const strip = (file, wall, size = 60) =>
  `<div style="background:${wall};border-radius:22px;padding:14px;display:flex;gap:12px;align-items:center;justify-content:center">${[neighbours[0], neighbours[1], null, neighbours[2]].map((n) => (n ? sq(size, n[0], glyph(n[1])) : img(file, size))).join('')}</div>`;

const cols = ICONS.map(([file, label], i) => `
  <div class="col">
    <div class="num">${i + 1}</div>
    ${img(file, 230)}
    <div class="label">${label}</div>
    ${strip(file, 'linear-gradient(160deg,#2B3350,#141726)')}
    ${strip(file, 'linear-gradient(160deg,#E9EEF8,#C9D6EA)')}
    <div class="small">${img(file, 40)}${img(file, 29)}<span>40 / 29 px</span></div>
  </div>`).join('');
const html = `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;background:#EEF0EA;font-family:'Segoe UI',Arial,sans-serif;color:#1c2418}
  h1{font-size:26px;margin:0}.wrap{padding:36px 40px 44px}.sub{color:#5d6857;margin:6px 0 28px;font-size:15px}
  .row{display:flex;flex-wrap:wrap;gap:36px 22px}.col{width:304px;display:flex;flex-direction:column;align-items:center;gap:14px}
  .num{font-weight:700;font-size:15px;color:#4a7d00}.label{font-weight:600;font-size:16px;margin-bottom:4px}
  .small{display:flex;gap:12px;align-items:center;color:#6b7666;font-size:13px}
</style><div class="wrap"><h1>Bodyn app icons</h1><div class="sub">Full size, then on a dark and a light home screen at 60 px next to other apps, then at Spotlight and Settings sizes.</div><div class="row">${cols}</div></div>`;
fs.writeFileSync(path.join(DIR, 'contact-sheet.html'), html);

await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: pathToFileURL(path.join(DIR, 'contact-sheet.html')).href });
await sleep(1500);
const h = await ev('document.documentElement.scrollHeight');
await save('contact-sheet.png', { x: 0, y: 0, width: 1700, height: h });

ws.close(); proc.kill();
process.exit(0);
