import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const KEY = 'bodyn.name';

/** What the app calls the user. Kept on this device only, never in the code. Empty = a neutral greeting. */
export const useUserName = create<{ name: string; setName: (name: string) => void }>((set) => ({
  name: '',
  setName: (name) => set({ name: name.slice(0, 40) }),
}));

AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v) useUserName.setState({ name: v });
  })
  .catch(() => {})
  .finally(() => {
    useUserName.subscribe((s) => {
      AsyncStorage.setItem(KEY, s.name.trim()).catch(() => {});
    });
  });

/** First name for greetings, or null when the user hasn't set one. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || null;
