import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { DEFAULT_PREFS, type NotifCategory, type Prefs } from '@/notifications/types';

const KEY = 'bodyn.notifications';

type State = Prefs & {
  hydrated: boolean;
  /** when the inbox was last opened, so the bell can show what is new */
  seenUntil: number;
  set: (patch: Partial<Prefs>) => void;
  setCategory: (c: NotifCategory, on: boolean) => void;
  markSeen: () => void;
};

export const useNotificationPrefs = create<State>((set, get) => ({
  ...DEFAULT_PREFS,
  hydrated: false,
  seenUntil: 0,
  set: (patch) => set(patch),
  setCategory: (c, on) => set({ categories: { ...get().categories, [c]: on } }),
  markSeen: () => set({ seenUntil: Date.now() }),
}));

/** the part of the state that is remembered between launches */
const persisted = (s: State) => ({
  enabled: s.enabled, categories: s.categories, bedtimeLeadMin: s.bedtimeLeadMin, hydrationCount: s.hydrationCount,
  quietMode: s.quietMode, quietStart: s.quietStart, quietEnd: s.quietEnd, dailyCap: s.dailyCap, seenUntil: s.seenUntil,
});

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (!v) return;
    const saved = JSON.parse(v) as Partial<Prefs> & { seenUntil?: number };
    useNotificationPrefs.setState({ ...saved, categories: { ...DEFAULT_PREFS.categories, ...saved.categories } });
  })
  .catch(() => {})
  .finally(() => {
    useNotificationPrefs.setState({ hydrated: true });
    useNotificationPrefs.subscribe((s) => {
      AsyncStorage.setItem(KEY, JSON.stringify(persisted(s))).catch(() => {});
    });
  });
