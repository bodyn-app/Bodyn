// Keeps the user's imported health data on this device only: a deflated JSON snapshot in localStorage.
// localStorage is synchronous, so the data is ready before any screen module runs. That lets the provider
// (and everything that reads it at import time: metrics caches, the coach, the selected date) stay synchronous.
// 19 months of data is ~230 KB stored, well inside Safari's ~5 MB per-site budget.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';

import type { HealthData } from './import/parse-core';

export const HEALTH_KEY = 'bodyn.health.v1';
/** every key this app writes starts with this, so "Delete all data" can find them all */
export const KEY_PREFIX = 'bodyn.';

const store = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // some privacy modes throw on access
  }
};

/** True where imported data can be kept (the web app). Native builds have no import yet. */
export const canStoreHealthData = () => store() != null;

const toBase64 = (u8: Uint8Array) => {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromBase64 = (b64: string) => {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8;
};

export const encodeHealthData = (d: HealthData) => toBase64(deflateSync(strToU8(JSON.stringify(d)), { level: 6 }));
export const decodeHealthData = (s: string): HealthData | null => {
  try {
    const d = JSON.parse(strFromU8(inflateSync(fromBase64(s))));
    return isHealthData(d) ? d : null;
  } catch {
    return null;
  }
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Shape check before anything is saved or rendered, so a damaged or foreign snapshot can't crash the app. */
export function isHealthData(d: unknown): d is HealthData {
  if (!isObj(d)) return false;
  if (typeof d.firstDay !== 'string' || !DAY.test(d.firstDay) || typeof d.lastDay !== 'string' || !DAY.test(d.lastDay)) return false;
  if (d.firstDay > d.lastDay) return false;
  if (!isObj(d.days) || !isObj(d.hr) || !Array.isArray(d.workouts) || !isObj(d.profile)) return false;
  for (const [k, v] of Object.entries(d.days)) if (!DAY.test(k) || !isObj(v) || !isObj(v.hourly) || !isObj(v.overnight) || !Array.isArray(v.naps)) return false;
  for (const [k, v] of Object.entries(d.hr)) if (!DAY.test(k) || !Array.isArray(v)) return false;
  for (const w of d.workouts) if (!isObj(w) || typeof w.start !== 'string' || typeof w.end !== 'string' || typeof w.type !== 'string') return false;
  return true;
}

export function loadHealthData(): HealthData | null {
  const raw = store()?.getItem(HEALTH_KEY);
  return raw ? decodeHealthData(raw) : null;
}

export function saveHealthData(d: HealthData): void {
  const s = store();
  if (!s) throw new Error('This browser does not allow saving data. Turn off Private Browsing and try again.');
  if (!isHealthData(d)) throw new Error('The export could not be read into a valid dataset.');
  try {
    s.setItem(HEALTH_KEY, encodeHealthData(d));
  } catch {
    throw new Error('Not enough storage space on this device to keep the data.');
  }
  // ask the browser not to evict our storage under pressure (best effort; iOS home-screen apps usually grant it)
  void navigator.storage?.persist?.().catch(() => {});
}

/** Removes the health data and every preference, chat and log this app saved on this device. */
export async function clearAllLocalData(): Promise<void> {
  const s = store();
  if (s) for (const k of Object.keys(s)) if (k.startsWith(KEY_PREFIX)) s.removeItem(k);
  const keys = (await AsyncStorage.getAllKeys().catch(() => [] as readonly string[])).filter((k) => k.startsWith(KEY_PREFIX));
  if (keys.length) await AsyncStorage.multiRemove(keys).catch(() => {});
}
