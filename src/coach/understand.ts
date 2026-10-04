// Turns free text into a small structured request: what it is about (topic), what the person wants to know (ask),
// and for which time (when). Nothing here matches whole sentences, so the wording can vary from person to person.
import { findTerm } from './glossary';
import type { Ask, Aspect, Deferred, Parsed, Topic, When } from './types';

// ---------- normalising ----------
const NUM_WORD: Record<string, string> = { one: '1', two: '2', three: '3', four: '4', five: '5' };

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/\b(what|how|who|where|when|why|that|there|it|here)'s\b/g, '$1 is')
    .replace(/\bhow'd\b/g, 'how did')
    .replace(/\bwhats\b/g, 'what is')
    .replace(/\bhows\b/g, 'how is')
    .replace(/\bcan't\b/g, 'can not')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/n't\b/g, ' not')
    .replace(/'m\b/g, ' am')
    .replace(/'ve\b/g, ' have')
    .replace(/'ll\b/g, ' will')
    .replace(/'re\b/g, ' are')
    .replace(/'d\b/g, ' would')
    .replace(/\bzone ?(one|two|three|four|five)\b/g, (_, w: string) => `zone ${NUM_WORD[w]}`)
    .replace(/\bzone ?([1-5])\b/g, 'zone $1')
    .replace(/\bvo ?2 ?max\b/g, 'vo2 max')
    .replace(/[^a-z0-9%\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- matching words with a little tolerance for typos ----------
const lev1 = (a: string, b: string): boolean => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : b.slice(i + 1) === a.slice(i);
};
/** exact word, a longer form of it ("recover" → "recovery"), or a one-letter typo of a word of 5+ letters */
const wordHits = (tok: string, entry: string) =>
  tok === entry ||
  (entry.length >= 5 &&
    (tok.startsWith(entry) || (tok.length >= 5 && tok[0] === entry[0] && !KNOWN.has(tok) && (lev1(tok, entry) || lev1(tok.slice(0, entry.length), entry)))));

/** index of the first token that matches any entry (phrases match consecutive tokens), or -1 */
function firstHit(tokens: string[], entries: string[]): number {
  let best = -1;
  for (const e of entries) {
    let at = -1;
    if (e.includes(' ')) {
      const parts = e.split(' ');
      for (let i = 0; i + parts.length <= tokens.length; i++) if (parts.every((p, j) => tokens[i + j] === p)) { at = i; break; }
    } else at = tokens.findIndex((t) => wordHits(t, e));
    if (at >= 0 && (best < 0 || at < best)) best = at;
  }
  return best;
}
const exactHit = (tokens: string[], entries: string[]): boolean => {
  const hay = ` ${tokens.join(' ')} `;
  return entries.some((e) => hay.includes(` ${e} `));
};

// ---------- vocabulary ----------
const TOPICS: Record<Exclude<Topic, 'general'>, string[]> = {
  fatigue: ['tired', 'exhausted', 'exhaustion', 'wiped', 'drained', 'fatigue', 'fatigued', 'sluggish', 'lethargic', 'sore', 'soreness', 'knackered', 'sleepy', 'groggy', 'overtrain', 'overtraining', 'overtrained', 'overreaching', 'run down', 'worn out', 'low energy', 'no energy', 'burnt out', 'burned out', 'feel rough', 'feel off', 'feel bad', 'feel weak'],
  zones: ['zone', 'zones', 'aerobic', 'anaerobic'],
  hrv: ['hrv', 'variability', 'sdnn'],
  recovery: ['recover', 'readiness', 'ready', 'recharge', 'rebound'],
  sleep: ['sleep', 'slept', 'asleep', 'bedtime', 'bed', 'nap', 'naps', 'insomnia', 'wake', 'woke', 'waking', 'snore', 'rested', 'night', 'nights', 'deep', 'rem', 'dream'],
  strain: ['strain', 'train', 'training', 'trained', 'load', 'effort', 'intensity', 'intense', 'exertion'],
  stress: ['stress', 'anxious', 'anxiety', 'tense', 'tension', 'calm', 'relax', 'overwhelm', 'burnout', 'nervous'],
  rhr: ['rhr', 'resting', 'heart', 'pulse', 'bpm'],
  steps: ['step', 'steps', 'distance', 'stride', 'pedometer'],
  calories: ['calorie', 'calories', 'kcal', 'burn', 'burned'],
  fitness: ['vo2', 'fitness', 'endurance', 'stamina'],
  workout: ['workout', 'workouts', 'exercise', 'exercises', 'exercised', 'session', 'gym', 'lift', 'lifting', 'run', 'runs', 'running', 'ran', 'ride', 'cycling', 'swim', 'swimming', 'walk', 'walks', 'walking', 'hike', 'hiking', 'jog', 'jogging', 'cardio', 'strength', 'activity', 'activities', 'work out', 'worked out', 'working out'],
};
const TOPIC_ORDER: (keyof typeof TOPICS)[] = ['fatigue', 'zones', 'hrv', 'recovery', 'sleep', 'strain', 'stress', 'rhr', 'steps', 'calories', 'fitness', 'workout'];
const PRIORITY: Topic[] = ['fatigue', 'zones', 'hrv'];

const DEFER: Record<Deferred, string[]> = {
  correlation: ['alcohol', 'beer', 'wine', 'drink', 'drinks', 'drinking', 'drank', 'caffeine', 'coffee', 'tea', 'supplement', 'supplements', 'creatine', 'magnesium', 'melatonin', 'diet', 'food', 'meal', 'meals', 'ate', 'eating', 'sugar', 'sauna', 'ice bath', 'cold plunge', 'hydration', 'water', 'protein', 'vitamin', 'vitamins', 'weed', 'smoking', 'vape'],
  peers: ['people like me', 'other people', 'others', 'other users', 'other athletes', 'my age group', 'average person', 'my peers', 'people my age', 'everyone else', 'same age', 'same gender', 'my demographic', 'similar people', 'similar to me'],
  life: ['newborn', 'baby', 'toddler', 'kids', 'child', 'children', 'busy', 'travel', 'travelling', 'traveling', 'jetlag', 'jet lag', 'shift work', 'night shift', 'pregnant', 'pregnancy', 'injury', 'injured', 'surgery', 'deadline', 'exam', 'exams', 'wedding', 'holiday', 'vacation', 'ramadan', 'no time', 'little time', 'time poor'],
  medical: ['sick', 'ill', 'illness', 'fever', 'flu', 'covid', 'pain', 'chest', 'dizzy', 'faint', 'fainting', 'palpitations', 'doctor', 'medical', 'medication', 'medications', 'diagnose', 'diagnosis', 'disease', 'arrhythmia', 'afib', 'cholesterol', 'blood pressure', 'symptom', 'symptoms', 'hurts', 'cancer', 'diabetes', 'infection'],
};
const DEFER_ORDER: Deferred[] = ['medical', 'peers', 'life', 'correlation'];

const DOW_WORDS: [string[], number][] = [
  [['sunday', 'sundays', 'sun'], 0], [['monday', 'mondays', 'mon'], 1], [['tuesday', 'tuesdays', 'tue', 'tues'], 2], [['wednesday', 'wednesdays', 'wed'], 3],
  [['thursday', 'thursdays', 'thu', 'thur', 'thurs'], 4], [['friday', 'fridays', 'fri'], 5], [['saturday', 'saturdays', 'sat'], 6],
];

const ADVICE = ['how can i', 'how do i', 'how to', 'how should i', 'what should i', 'should i', 'can i', 'could i', 'need to', 'tips', 'tip', 'improve', 'improving', 'boost', 'increase', 'raise', 'lift my', 'get more', 'get better', 'recommend', 'suggest', 'suggestion', 'advice', 'what can i do', 'what do i do', 'what to do', 'ought to', 'help me', 'optimal', 'optimize', 'optimise', 'best way', 'hit my', 'reach my', 'fix'];
const DEFINE = ['what is', 'what are', 'what does', 'what do', 'explain', 'meaning', 'mean', 'means', 'define', 'definition', 'tell me about', 'what exactly', 'stand for', 'difference between'];
const WHY = ['why', 'reason', 'cause', 'causing', 'caused', 'because', 'how come', 'what is impacting', 'what is affecting', 'what is driving', 'what is behind', 'what affected', 'what impacted', 'what contributed', 'contributed', 'contributing', 'what led'];
const RECORD = ['best', 'worst', 'highest', 'lowest', 'most', 'least', 'max', 'maximum', 'minimum', 'peak', 'record', 'records', 'top', 'biggest', 'longest', 'shortest', 'ever', 'personal best', 'lowest ever', 'when did i have'];
const COMPARE = ['better', 'worse', 'than', 'compare', 'compared', 'comparison', 'versus', 'vs', 'against', 'average', 'avg', 'usual', 'normal', 'typical', 'baseline', 'stack up', 'stacks up', 'improved', 'declined', 'dropped', 'higher', 'lower', 'more than', 'less than', 'difference'];
const TREND = ['trend', 'trends', 'trending', 'trended', 'pattern', 'patterns', 'over time', 'changing', 'changed', 'going up', 'going down', 'progress', 'progressing', 'rising', 'falling', 'dropping', 'increasing', 'decreasing', 'lately', 'recently', 'consistent', 'history', 'over the last', 'past few'];
const PLAN = ['plan', 'schedule', 'program', 'programme', 'routine', 'roadmap', 'split', 'timetable'];
const AVG_WORDS = ['average', 'avg', 'usual', 'normal', 'typical', 'baseline', 'norm'];

/** every single word the parser knows, so a real word is never mistaken for a typo of another one */
const KNOWN = new Set<string>([...Object.values(TOPICS).flat(), ...Object.values(DEFER).flat(), ...ADVICE, ...DEFINE, ...WHY, ...RECORD, ...COMPARE, ...TREND, ...PLAN].filter((e) => !e.includes(' ')));

const has = (tokens: string[], entries: string[]) => exactHit(tokens, entries);
const PRONOUNS = ['it', 'that', 'this', 'those', 'them'];
const GENERAL = ['doing', 'overall', 'summary', 'summarize', 'progress', 'insight', 'insights'];

function detectAsk(tokens: string[], hadTerm: boolean): { ask: Ask; explicit: boolean } {
  const wantsPlan = has(tokens, PLAN) && (has(tokens, ['my', 'me', 'a', 'the', 'week', 'training', 'workout', 'workouts', 'this', 'next']) || tokens.length <= 3);
  if (wantsPlan) return { ask: 'plan', explicit: true };
  if (has(tokens, ADVICE)) return { ask: 'advice', explicit: true };
  if (has(tokens, WHY)) return { ask: 'why', explicit: true };
  if (has(tokens, DEFINE) && (hadTerm || !has(tokens, ['my', 'today', 'yesterday', 'i']))) return { ask: 'define', explicit: true };
  if (has(tokens, RECORD)) return { ask: 'record', explicit: true };
  if (has(tokens, COMPARE)) return { ask: 'compare', explicit: true };
  if (has(tokens, TREND)) return { ask: 'trend', explicit: true };
  if (has(tokens, DEFINE)) return { ask: 'define', explicit: true };
  return { ask: 'status', explicit: false };
}

function detectWhen(tokens: string[], text: string, ask: Ask): When {
  if (has(tokens, ['tomorrow'])) return 'tomorrow';
  if (text.includes('last week') || text.includes('previous week')) return 'lastweek';
  if (has(tokens, ['yesterday'])) return 'yesterday';
  if (has(tokens, ['month', 'months', '30 days', 'thirty days'])) return 'month';
  if (has(tokens, ['ever', 'all time', 'history', 'since i started', 'overall', 'lifetime']) || (ask === 'record' && !has(tokens, ['week', 'today', 'yesterday', 'night']))) return 'all';
  if (has(tokens, ['week', 'weeks', 'weekly', '7 days', 'seven days', 'lately', 'recently', 'recent', 'past few days', 'last few days', 'this week', 'past week'])) return 'week';
  return 'ref';
}

function detectAspect(tokens: string[], topics: Topic[]): Aspect | null {
  if (topics.includes('workout') && topics.includes('sleep') && has(tokens, ['late', 'evening', 'night', 'impact', 'affect', 'affected', 'effect', 'ruin', 'ruined', 'hurt', 'before bed', 'disturb'])) return 'lateworkout';
  if (topics.includes('workout') && has(tokens, ['late', 'evening']) && !topics.includes('recovery')) return 'lateworkout';
  if (!topics.includes('sleep')) return null;
  if (has(tokens, ['which day', 'what day', 'weekday', 'weekdays', 'days of the week', 'day of the week', 'which night', 'what night'])) return 'weekday';
  if (has(tokens, ['bedtime', 'go to bed', 'bed by', 'what time', 'when should i sleep', 'when should i go', 'lights out', 'optimal bedtime'])) return 'bedtime';
  if (has(tokens, ['deep'])) return 'deep';
  if (has(tokens, ['rem', 'dream', 'dreaming'])) return 'rem';
  if (has(tokens, ['light', 'core'])) return 'light';
  if (has(tokens, ['efficiency', 'efficient', 'awake', 'restless', 'toss', 'tossing', 'wake up', 'woke up'])) return 'efficiency';
  if (has(tokens, ['consistency', 'consistent', 'schedule', 'regular', 'routine'])) return 'consistency';
  if (has(tokens, ['hours', 'long', 'duration', 'enough', 'much'])) return 'duration';
  return null;
}

const weekdayIn = (tokens: string[]): number | null => DOW_WORDS.find(([w]) => has(tokens, w))?.[1] ?? null;

// ---------- parse ----------
export function parse(raw: string, prev: Parsed | null = null): Parsed {
  const text = normalize(raw);
  const tokens = text ? text.split(' ') : [];
  const empty: Parsed = { text: raw, topics: [], topic: null, ask: 'status', when: 'ref', term: null, aspect: null, versus: null, number: null, weekday: null, personal: false, deferred: null, smalltalk: null, followUp: false, understood: false };
  if (!tokens.length) return empty;

  // small talk
  if (tokens.length <= 5 && has(tokens, ['hi', 'hello', 'hey', 'yo', 'hiya', 'good morning', 'good evening', 'good afternoon', 'sup'])) return { ...empty, smalltalk: 'greet', understood: true };
  if (tokens.length <= 6 && has(tokens, ['thanks', 'thank', 'thx', 'cheers', 'appreciate', 'awesome', 'perfect', 'nice one'])) return { ...empty, smalltalk: 'thanks', understood: true };

  // things that need a bigger coach: found first so they are not answered with a wrong data answer
  let deferred: Deferred | null = null;
  for (const k of DEFER_ORDER) if (has(tokens, DEFER[k])) { deferred = k; break; }

  // topics, in the order they are mentioned (feelings, zones and HRV take priority over the words they contain)
  const found: { t: Topic; pos: number }[] = [];
  for (const t of TOPIC_ORDER) {
    const pos = firstHit(tokens, TOPICS[t]);
    if (pos >= 0) found.push({ t, pos });
  }
  found.sort((a, b) => (PRIORITY.includes(a.t) !== PRIORITY.includes(b.t) ? (PRIORITY.includes(a.t) ? -1 : 1) : a.pos - b.pos));
  let topics = found.map((f) => f.t);
  if (topics.includes('zones') && topics.includes('rhr')) topics = topics.filter((t) => t !== 'rhr');
  if (topics.includes('rhr') && topics.includes('hrv')) topics = topics.filter((t) => t !== 'rhr');

  const term = findTerm(text);
  const hadTerm = !!term;
  const aspect = detectAspect(tokens, topics);
  if (aspect === 'lateworkout') topics = ['sleep', ...topics.filter((t) => t !== 'sleep')];
  let topic: Topic | null = topics[0] ?? null;

  let { ask, explicit } = detectAsk(tokens, hadTerm);
  let when = detectWhen(tokens, text, ask);
  // a bare term ("zone 2", "HRV?") is a request for its meaning
  if (term && tokens.length <= 3 && !explicit) { ask = 'define'; explicit = true; }
  if (aspect === 'weekday' && ask !== 'advice') ask = ask === 'status' ? 'record' : ask;

  // follow-ups ("and yesterday?", "why?", "what about deep sleep?") reuse what was being talked about
  let followUp = false;
  if (prev?.topic && !topic && !term && tokens.length <= 8) {
    const leader = ['and', 'also', 'or', 'then'].includes(tokens[0]) || text.startsWith('what about') || text.startsWith('how about');
    const pronoun = has(tokens, PRONOUNS);
    const general = has(tokens, GENERAL) || (has(tokens, ['week', 'month']) && has(tokens, ['my', 'was', 'been', 'how']) && !leader);
    const carries = ask === 'plan' || ask === 'advice' ? pronoun : leader || pronoun || (!general && (explicit || when !== 'ref' || weekdayIn(tokens) != null));
    if (carries) {
      topic = prev.topic;
      topics = [prev.topic];
      if (!explicit) ask = prev.ask;
      if (when === 'ref' && prev.when !== 'ref' && !has(tokens, ['today'])) when = prev.when;
      followUp = true;
    }
  }

  // no topic named: infer from the kind of question
  if (!topic) {
    if (ask === 'plan' || ask === 'advice') topic = 'strain';
    else if (has(tokens, [...GENERAL, 'week', 'month', 'lately', 'day', 'today', 'going', 'status', 'patterns', 'pattern', 'trend', 'trends'])) topic = 'general';
    if (topic) topics = [topic];
  }

  const weekday = weekdayIn(tokens);
  const numMatch = text.replace(/zone \d/g, '').match(/\b(\d{1,3})\s*%?/);
  const number = numMatch && (text.includes('%') || has(tokens, ['score', 'mean', 'means', 'percent', 'scored', 'got'])) ? +numMatch[1] : null;
  const versus = has(tokens, AVG_WORDS) ? 'avg' : ask === 'compare' ? 'prev' : null;

  return {
    text: raw,
    topics,
    topic,
    ask,
    when,
    term: term?.id ?? null,
    aspect,
    versus,
    number,
    weekday,
    personal: has(tokens, ['my', 'me', 'i', 'am', 'today', 'yesterday', 'night']) || number != null,
    deferred: deferred && !(deferred === 'peers' && topic === 'fitness') ? deferred : null,
    smalltalk: null,
    followUp,
    understood: !!topic || !!term || !!deferred,
  };
}
