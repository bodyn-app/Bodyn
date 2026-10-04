import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'bodyn.defaultTab';

export type DefaultTab = 'index' | 'activity' | 'sleep' | 'profile';
export const DEFAULT_TABS: { tab: DefaultTab; label: string }[] = [
  { tab: 'index', label: 'Home' },
  { tab: 'activity', label: 'Activity' },
  { tab: 'sleep', label: 'Sleep' },
  { tab: 'profile', label: 'Account' },
];

type State = { tab: DefaultTab; hydrated: boolean; setTab: (t: DefaultTab) => void };

export const useDefaultTab = create<State>((set) => ({
  tab: 'index',
  hydrated: false,
  setTab: (tab) => set({ tab }),
}));

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === 'index' || v === 'activity' || v === 'sleep' || v === 'profile') useDefaultTab.setState({ tab: v });
  })
  .catch(() => {})
  .finally(() => {
    useDefaultTab.setState({ hydrated: true });
    useDefaultTab.subscribe((s) => {
      AsyncStorage.setItem(KEY, s.tab).catch(() => {});
    });
  });
