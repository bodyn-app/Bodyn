import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

export type IntakeKind = 'water' | 'caffeine';
export type IntakeEntry = { id: number; kind: IntakeKind; at: number; ml?: number };

const KEY = 'bodyn.intake';
/** Water entries saved before sizes were selectable had no `ml`; they were all one glass. */
export const DEFAULT_GLASS_ML = 250;
const KEEP_DAYS = 14;

type State = {
  entries: IntakeEntry[];
  add: (kind: IntakeKind, ml?: number) => void;
  remove: (id: number) => void;
};

export const useIntakeLog = create<State>((set) => ({
  entries: [],
  add: (kind, ml) => set((s) => ({ entries: [...s.entries, { id: Date.now(), kind, at: Date.now(), ml }] })),
  remove: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),
}));

/** entries from the calendar day of `now`, oldest first */
export const entriesOnDay = (entries: IntakeEntry[], now = new Date()) => {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return entries.filter((e) => e.at >= start && e.at < start + 864e5).sort((a, b) => a.at - b.at);
};

/** Total water (ml) for each of the `days` calendar days ending on `now`'s day, oldest first. */
export const dailyWaterMl = (entries: IntakeEntry[], days = 7, now = new Date()) =>
  Array.from({ length: days }, (_, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - i));
    const ml = entriesOnDay(entries, day)
      .filter((e) => e.kind === 'water')
      .reduce((t, e) => t + (e.ml ?? DEFAULT_GLASS_ML), 0);
    return { day, ml };
  });

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v) useIntakeLog.setState({ entries: (JSON.parse(v) as IntakeEntry[]).filter((e) => e.at > Date.now() - KEEP_DAYS * 864e5) });
  })
  .catch(() => {})
  .finally(() => {
    useIntakeLog.subscribe((s) => {
      AsyncStorage.setItem(KEY, JSON.stringify(s.entries)).catch(() => {});
    });
  });
