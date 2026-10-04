import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { Parsed } from '@/coach';

export type ChatMsg = { id: number; from: 'me' | 'coach'; text: string; bullets?: string[]; chips?: string[]; greeting?: boolean };
export type ChatThread = { id: string; title: string; updatedAt: number; messages: ChatMsg[]; parsed: Parsed | null };

const KEY = 'bodyn.coach.chats';
const MAX_THREADS = 40;
const MAX_MESSAGES = 200;

type State = {
  threads: ChatThread[];
  /** the chat on screen; null = a fresh chat that is saved once the first question is asked */
  activeId: string | null;
  hydrated: boolean;
  startNew: () => void;
  open: (id: string) => void;
  remove: (id: string) => void;
  /** the active chat's id, creating the chat (with `seed` as its first messages) when there is none yet */
  ensure: (seed: ChatMsg[]) => string;
  append: (id: string, msgs: ChatMsg[], parsed?: Parsed | null) => void;
};

const titleOf = (text: string) => {
  const t = text.trim().replace(/\s+/g, ' ');
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return cap.length > 44 ? `${cap.slice(0, 43)}…` : cap;
};

export const useCoachChats = create<State>((set, get) => ({
  threads: [],
  activeId: null,
  hydrated: false,
  startNew: () => set({ activeId: null }),
  open: (id) => set({ activeId: id }),
  remove: (id) => set((s) => ({ threads: s.threads.filter((t) => t.id !== id), activeId: s.activeId === id ? null : s.activeId })),
  ensure: (seed) => {
    const cur = get().activeId;
    if (cur && get().threads.some((t) => t.id === cur)) return cur;
    const id = `c${Date.now()}`;
    set((s) => ({ activeId: id, threads: [{ id, title: 'New chat', updatedAt: Date.now(), messages: seed, parsed: null }, ...s.threads].slice(0, MAX_THREADS) }));
    return id;
  },
  append: (id, msgs, parsed) =>
    set((s) => ({
      threads: s.threads
        .map((t) => {
          if (t.id !== id) return t;
          const firstQuestion = t.messages.every((m) => m.from !== 'me') ? msgs.find((m) => m.from === 'me') : undefined;
          return {
            ...t,
            title: firstQuestion ? titleOf(firstQuestion.text) : t.title,
            updatedAt: Date.now(),
            messages: [...t.messages, ...msgs].slice(-MAX_MESSAGES),
            parsed: parsed === undefined ? t.parsed : parsed,
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt),
    })),
}));

// remember chats between launches
AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v) {
      const saved = JSON.parse(v) as { threads: ChatThread[]; activeId: string | null };
      const merged = useCoachChats.getState().threads;
      useCoachChats.setState({ threads: [...merged, ...saved.threads.filter((t) => !merged.some((m) => m.id === t.id))], activeId: useCoachChats.getState().activeId ?? saved.activeId });
    }
  })
  .catch(() => {})
  .finally(() => {
    useCoachChats.setState({ hydrated: true });
    useCoachChats.subscribe((s) => {
      AsyncStorage.setItem(KEY, JSON.stringify({ threads: s.threads, activeId: s.activeId })).catch(() => {});
    });
  });
