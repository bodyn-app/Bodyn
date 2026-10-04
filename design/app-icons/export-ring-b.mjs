// Exports the chosen icon (Ring B) into every asset the app needs, using headless Edge (no extra dependencies).
// Run: node design/app-icons/export-ring-b.mjs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(DIR, '..', '..', 'assets', 'images');
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bodyn-ringb-'));

const BG = '#122217'; // Android adaptive background / splash colour: the middle of the icon's deep green

// ---- the artwork, one definition, several finishes ----
const RING = '<circle cx="512" cy="512" r="300" stroke-dasharray="1500 385" transform="rotate(-13 512 512)"/>';
const LETTER = 'M440 372 V652 M440 372 H510 A70 70 0 0 1 510 512 H440 M440 512 H522 A70 70 0 0 1 522 652 H440';
const defs = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B3022"/><stop offset="1" stop-color="#0E1A12"/></linearGradient>
  <radialGradient id="halo" cx="50%" cy="50%" r="52%"><stop offset="0" stop-color="#B8F53D" stop-opacity="0.13"/><stop offset="1" stop-color="#B8F53D" stop-opacity="0"/></radialGradient>
  <linearGradient id="ring" gradientUnits="userSpaceOnUse" x1="200" y1="200" x2="820" y2="840"><stop offset="0" stop-color="#DDF9A2"/><stop offset="1" stop-color="#8FCB3A"/></linearGradient>
  <linearGradient id="letter" gradientUnits="userSpaceOnUse" x1="0" y1="340" x2="0" y2="690"><stop offset="0" stop-color="#EEFBCF"/><stop offset="1" stop-color="#BCE57A"/></linearGradient>
  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter>`;
/** the ring and B; `scale` shrinks it around the centre, `flat` = a single colour with no gradient or glow (for the Android themed icon) */
const mark = ({ scale = 1, flat = false, glow = true } = {}) => `
  <g fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(512 512) scale(${scale}) translate(-512 -512)">
    ${flat ? '' : glow ? `<g stroke="#B8F53D" stroke-width="60" opacity="0.32" filter="url(#glow)">${RING}</g>` : ''}
    <g stroke="${flat ? '#fff' : 'url(#ring)'}" stroke-width="60">${RING}</g>
    <path d="${LETTER}" stroke="${flat ? '#fff' : 'url(#letter)'}" stroke-width="62"/>
  </g>`;
const background = `<rect width="1024" height="1024" fill="url(#bg)"/><rect width="1024" height="1024" fill="url(#halo)"/>`;
const svg = (body, viewBox = '0 0 1024 1024') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%"><defs>${defs}</defs>${body}</svg>`;

const JOBS = [
  { file: 'icon.png', size: 1024, transparent: false, svg: svg(background + mark()) }, // iOS: opaque, square, no alpha
  { file: 'splash-icon.png', size: 512, transparent: true, svg: svg(mark(), '162 162 700 700') }, // just the ring and B, cropped
  { file: 'android-icon-foreground.png', size: 512, transparent: true, svg: svg(mark({ scale: 0.9 })) },
  { file: 'android-icon-background.png', size: 512, transparent: false, svg: svg(background) },
  { file: 'android-icon-monochrome.png', size: 432, transparent: true, svg: svg(mark({ scale: 0.9, flat: true })) },
  { file: 'favicon.png', size: 48, transparent: false, svg: svg(background + mark({ glow: false })) },
];

const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--remote-debugging-port=9341', `--user-data-dir=${path.join(TMP, 'profile')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(p) { for (let i = 0; i < 60; i++) { try { return await (await fetch(`http://127.0.0.1:9341${p}`)).json(); } catch { await sleep(250); } } throw new Error('no devtools'); }
const page = (await getJson('/json/list')).find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');

for (const j of JOBS) {
  const html = path.join(TMP, `${j.file}.html`);
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent;width:${j.size}px;height:${j.size}px;overflow:hidden}svg{display:block}</style>${j.svg}`);
  await send('Emulation.setDeviceMetricsOverride', { width: j.size, height: j.size, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setDefaultBackgroundColorOverride', { color: j.transparent ? { r: 0, g: 0, b: 0, a: 0 } : { r: 18, g: 34, b: 23, a: 1 } });
  await send('Page.navigate', { url: pathToFileURL(html).href });
  await sleep(700);
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: j.size, height: j.size, scale: 1 }, fromSurface: true });
  fs.writeFileSync(path.join(OUT, j.file), Buffer.from(r.result.data, 'base64'));
  console.log('wrote', j.file, `${j.size}x${j.size}`);
}
ws.close(); proc.kill();
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* Edge may still hold its profile folder; the temp folder is harmless */ }
process.exit(0);
