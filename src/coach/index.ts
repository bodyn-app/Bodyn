import { health } from '@/health';
import { metrics } from '@/metrics';
import { useHealthPrefs } from '@/state/health-prefs';
import { firstName, useUserName } from '@/state/user-name';

import { dailyAdvice } from './advice';
import { createChat, quickPrompts } from './chat';
import { buildContext } from './context';
import type { Ctx, Deps } from './types';
import { weekPlan } from './week';

export * from './types';
export { verdictMeta } from './advice';

const deps: Deps = { provider: health, metrics, userName: () => firstName(useUserName.getState().name) };
const chat = createChat(deps);

const STATUS_NOTE: Record<'injury' | 'sickness' | 'rest', string> = {
  injury: "You've marked yourself as recovering from an injury — skip anything that loads it, whatever today's numbers say.",
  sickness: "You've marked yourself as recovering from sickness — training adds load your body can't spare right now, so rest until symptoms clear.",
  rest: "You've marked yourself as resting — treat this as a deliberate day off, not a lapse.",
};

/** Prepends a plain-language note when the user has flagged themselves injured, sick or resting in Preferences. Cosmetic only — it doesn't change the underlying score or verdict. */
function withStatus(a: ReturnType<typeof dailyAdvice>) {
  const status = useHealthPrefs.getState().status;
  if (status === 'active') return a;
  return { ...a, body: `${STATUS_NOTE[status]} ${a.body}` };
}

/** The coach the app uses. A future LLM-backed coach can replace `reply` and keep the same shape. */
export const coach = {
  context: (date: string): Ctx => buildContext(deps, date),
  advice: (date: string) => withStatus(dailyAdvice(buildContext(deps, date))),
  week: (date: string) => {
    const ctx = buildContext(deps, date);
    return weekPlan(ctx, dailyAdvice(ctx));
  },
  quickPrompts: (date: string) => quickPrompts(buildContext(deps, date)),
  reply: chat.answer,
};
