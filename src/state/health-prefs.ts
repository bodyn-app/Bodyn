import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'bodyn.healthPrefs';

export type ActivityStatus = 'active' | 'injury' | 'sickness' | 'rest';
/** The 4 interior boundaries (% of max HR) between zones 1–5 — e.g. [0.6, 0.7, 0.8, 0.9] matches the engine default. Zone 1 always starts at 0%, zone 5 has no upper cap. */
export type ZoneBands = [number, number, number, number];

type State = {
  /** minutes; null = use the engine default (480 min / 8h) */
  sleepGoalMin: number | null;
  hrMaxSource: 'auto' | 'manual';
  hrMaxManual: number | null;
  /** 'auto' = Apple's own daily resting HR, 'sleep' = your average heart rate across the night, 'manual' = a value you typed */
  hrRestSource: 'auto' | 'sleep' | 'manual';
  hrRestManual: number | null;
  /** "% of Max" is the only method the engine implements today; bands are still user-editable */
  zoneMethod: 'percentMax';
  zoneBands: ZoneBands | null;
  status: ActivityStatus;
  set: (patch: Partial<Omit<State, 'set'>>) => void;
};

const defaults: Omit<State, 'set'> = {
  sleepGoalMin: null,
  hrMaxSource: 'auto',
  hrMaxManual: null,
  hrRestSource: 'auto',
  hrRestManual: null,
  zoneMethod: 'percentMax',
  zoneBands: null,
  status: 'active',
};

export const useHealthPrefs = create<State>((set) => ({
  ...defaults,
  set: (patch) => set(patch),
}));

const persisted = (s: State) => ({
  sleepGoalMin: s.sleepGoalMin, hrMaxSource: s.hrMaxSource, hrMaxManual: s.hrMaxManual,
  hrRestSource: s.hrRestSource, hrRestManual: s.hrRestManual, zoneMethod: s.zoneMethod, zoneBands: s.zoneBands, status: s.status,
});

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (!v) return;
    useHealthPrefs.setState({ ...defaults, ...(JSON.parse(v) as Partial<State>) });
  })
  .catch(() => {})
  .finally(() => {
    useHealthPrefs.subscribe((s) => {
      AsyncStorage.setItem(KEY, JSON.stringify(persisted(s))).catch(() => {});
    });
  });
