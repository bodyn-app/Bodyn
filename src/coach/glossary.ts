// Plain-language definitions of the terms the app uses. Personalised where it helps (heart-rate zones use your max HR).
import { zoneRanges } from './insights';

export type GlossEnv = { hrMax: number | null };
export type Def = { title: string; text: string; bullets?: string[] };
export type GlossEntry = { id: string; aliases: string[]; def: (env: GlossEnv) => Def };

const zoneDef = (z: 1 | 2 | 3 | 4 | 5): GlossEntry['def'] => (env) => {
  const pct = ['under 60%', '60–70%', '70–80%', '80–90%', '90–100%'][z - 1];
  const range = env.hrMax ? zoneRanges(env.hrMax).find((r) => r.zone === z)! : null;
  const bpm = range ? (z === 1 ? `For you that is under ${range.hi} bpm.` : `For you that is about ${range.lo}–${range.hi} bpm.`) : '';
  const what = [
    'Very light effort: warm-ups, cool-downs, easy walking and recovery days. You can chat without effort.',
    'Easy, steady effort where you can still hold a full conversation. This is the aerobic base zone: it builds endurance and the ability to burn fat, with little fatigue, so it can fill most of your training time.',
    'A comfortably hard "tempo" effort. You can speak in short sentences. Good for building stamina, but it tires you more than zone 2.',
    'Hard effort near your threshold. You can only say a few words at a time. Used for intervals and races; needs good recovery afterwards.',
    'All-out effort, close to your maximum. Only sustainable for seconds to a couple of minutes. Use sparingly.',
  ][z - 1];
  return { title: `Zone ${z}`, text: `Zone ${z} is ${pct} of your maximum heart rate. ${bpm} ${what}`.replace(/\s+/g, ' ').trim() };
};

export const GLOSSARY: GlossEntry[] = [
  { id: 'zone1', aliases: ['zone 1', 'z1'], def: zoneDef(1) },
  { id: 'zone2', aliases: ['zone 2', 'z2'], def: zoneDef(2) },
  { id: 'zone3', aliases: ['zone 3', 'z3'], def: zoneDef(3) },
  { id: 'zone4', aliases: ['zone 4', 'z4'], def: zoneDef(4) },
  { id: 'zone5', aliases: ['zone 5', 'z5'], def: zoneDef(5) },
  {
    id: 'zones',
    aliases: ['heart rate zones', 'hr zones', 'zones', 'zone training', 'training zones'],
    def: (env) => ({
      title: 'Heart-rate zones',
      text: `Zones split your effort into five bands by percentage of your maximum heart rate${env.hrMax ? ` (about ${Math.round(env.hrMax)} bpm for you)` : ''}. Bodyn uses them to work out your strain.`,
      bullets: [1, 2, 3, 4, 5].map((z) => {
        const r = env.hrMax ? zoneRanges(env.hrMax).find((x) => x.zone === z)! : null;
        const name = ['Zone 1: very light', 'Zone 2: easy, conversational', 'Zone 3: tempo', 'Zone 4: hard', 'Zone 5: all out'][z - 1];
        return r ? `${name} (${z === 1 ? `under ${r.hi}` : `${r.lo}–${r.hi}`} bpm)` : name;
      }),
    }),
  },
  {
    id: 'hrv',
    aliases: ['heart rate variability', 'hrv', 'sdnn'],
    def: () => ({
      title: 'Heart rate variability (HRV)',
      text: 'HRV is the small variation in the time between heartbeats. A higher HRV generally means your body is relaxed and recovered; a lower one often follows hard training, short sleep, stress, illness or alcohol. Your Apple Watch measures it as SDNN, in milliseconds. It differs a lot from person to person, so compare it with your own usual level rather than with other people.',
    }),
  },
  {
    id: 'rhr',
    aliases: ['resting heart rate', 'resting hr', 'rhr'],
    def: () => ({
      title: 'Resting heart rate',
      text: 'Your heart rate when you are calm and still. It tends to fall as you get fitter. A rise of several beats above your usual can be a sign of fatigue, stress, poor sleep, heat or illness, which is why it is one of the inputs to your recovery score.',
    }),
  },
  {
    id: 'recovery',
    aliases: ['recovery score', 'recovery', 'readiness', 'green recovery', 'red recovery', 'yellow recovery'],
    def: () => ({
      title: 'Recovery score',
      text: "Recovery (0–100%) estimates how ready your body is today. It compares last night's HRV, resting heart rate, respiratory rate and sleep with your own 30-day baseline.",
      bullets: ['67% and above (green): well recovered, ready for a hard day', '34–66% (yellow): moderate, train but stay in control', 'Below 34% (red): low, favour rest, sleep or an easy walk'],
    }),
  },
  {
    id: 'strain',
    aliases: ['strain', 'day strain', 'strain score', 'optimal strain', 'target strain'],
    def: () => ({
      title: 'Strain',
      text: 'Strain (0–21) is the cardiovascular load you put on your body during the day, worked out from how long your heart rate stays elevated. The scale is logarithmic: going from 14 to 18 takes far more effort than going from 6 to 10.',
      bullets: ['Light: under 10', 'Moderate: 10–14', 'High: 14–18', 'All out: 18 and above'],
    }),
  },
  {
    id: 'stress',
    aliases: ['stress level', 'stress score', 'stress'],
    def: () => ({
      title: 'Stress',
      text: 'Stress (0–3) shows how far your heart rate sits above your usual level while you are awake and still. Sleeping, walking and workout hours are left out so movement does not look like stress. Under 1 is Low, 1–2 Moderate, 2 and above High.',
    }),
  },
  {
    id: 'sleepscore',
    aliases: ['sleep score', 'sleep performance', 'sleep quality'],
    def: () => ({
      title: 'Sleep score',
      text: 'Your sleep score (0–100) combines four things.',
      bullets: ['Duration against the sleep you need (50%)', 'Restorative sleep: deep + REM, goal 40% of the night (20%)', 'Efficiency: time asleep out of time in bed (15%)', 'Consistency: bed and wake times against your recent nights (15%)'],
    }),
  },
  {
    id: 'sleepneed',
    aliases: ['sleep need', 'sleep needed', 'how much sleep', 'sleep goal'],
    def: () => ({ title: 'Sleep need', text: 'Bodyn assumes a base of 8 hours and adds up to 30 minutes after a very high-strain day, because harder days need more recovery. It shows on your sleep page as the time you needed.' }),
  },
  {
    id: 'sleepdebt',
    aliases: ['sleep debt'],
    def: () => ({ title: 'Sleep debt', text: 'Sleep debt is the total time you slept below your need over recent nights. It builds up when you regularly fall short, and it takes several longer nights to pay back.' }),
  },
  {
    id: 'restorative',
    aliases: ['restorative sleep', 'restorative'],
    def: () => ({ title: 'Restorative sleep', text: 'Restorative sleep is your deep sleep plus REM sleep. Together they usually make up about 40% or more of a night, and they are the stages most linked to physical repair, memory and mood. Bodyn scores this share as part of your sleep score.' }),
  },
  {
    id: 'deep',
    aliases: ['deep sleep', 'slow wave sleep', 'deep'],
    def: () => ({ title: 'Deep sleep', text: 'Deep sleep is the heaviest stage, mostly in the first half of the night. Your body does much of its physical repair here, and your heart rate and breathing are at their lowest and steadiest. Around 13–23% of the night is typical for adults.' }),
  },
  {
    id: 'rem',
    aliases: ['rem sleep', 'rem', 'dream sleep'],
    def: () => ({ title: 'REM sleep', text: 'REM (rapid eye movement) sleep is when most dreaming happens. It is more common in the second half of the night and supports memory and mood. About 20–25% of an adult night is typical. Alcohol and cutting the night short reduce it.' }),
  },
  {
    id: 'core',
    aliases: ['core sleep', 'light sleep', 'core'],
    def: () => ({ title: 'Core (light) sleep', text: 'Core sleep is the light-to-moderate stage that makes up roughly half the night. It is the bridge between the other stages and is where your body spends most of its time.' }),
  },
  {
    id: 'efficiency',
    aliases: ['sleep efficiency', 'efficiency'],
    def: () => ({ title: 'Sleep efficiency', text: 'Sleep efficiency is the share of your time in bed that you actually spend asleep. 85–95% is typical; lower usually means long spells awake in the night or a long time to fall asleep.' }),
  },
  {
    id: 'consistency',
    aliases: ['sleep consistency', 'sleep schedule', 'consistency'],
    def: () => ({ title: 'Sleep consistency', text: 'Consistency measures how close tonight’s bed and wake times are to your recent nights. A steady schedule helps you fall asleep faster and sleep more soundly.' }),
  },
  {
    id: 'vo2max',
    aliases: ['vo2 max', 'vo2max', 'vo2', 'cardio fitness'],
    def: () => ({ title: 'VO2 max', text: 'VO2 max is the most oxygen your body can use per kilo of body weight per minute (mL/kg/min). It is a standard measure of cardio fitness. Your Apple Watch estimates it from outdoor walks, runs and hikes, so it is not a lab test.' }),
  },
  {
    id: 'fitnessage',
    aliases: ['fitness age'],
    def: () => ({ title: 'Fitness age', text: 'Fitness age is the age at which a typical person of your sex has the same VO2 max as you. It is an estimate: a fitness age below your real age means your cardio fitness is better than typical for your age.' }),
  },
  {
    id: 'resp',
    aliases: ['respiratory rate', 'breathing rate', 'breaths per minute'],
    def: () => ({ title: 'Respiratory rate', text: 'How many breaths you take per minute, measured overnight. It is very steady from night to night, so a noticeable rise can be an early sign of illness or heavy fatigue.' }),
  },
  {
    id: 'spo2',
    aliases: ['spo2', 'blood oxygen', 'oxygen saturation'],
    def: () => ({ title: 'Blood oxygen (SpO2)', text: 'The share of your blood carrying oxygen. Healthy readings are typically 95–100%. Bodyn shows it for information only; it is not used in your scores.' }),
  },
  {
    id: 'maxhr',
    aliases: ['max heart rate', 'maximum heart rate', 'max hr', 'hrmax'],
    def: (env) => ({ title: 'Max heart rate', text: `Your maximum heart rate sets the edges of your zones. Bodyn estimates it as 220 minus your age, raised up to 10 bpm if your Watch has recorded higher${env.hrMax ? `. For you it is about ${Math.round(env.hrMax)} bpm` : ''}.` }),
  },
  {
    id: 'kcal',
    aliases: ['active calories', 'resting calories', 'basal calories', 'active energy', 'active kcal'],
    def: () => ({ title: 'Active and resting calories', text: 'Resting (basal) calories are what your body burns just to stay alive. Active calories are the extra energy you burn by moving and exercising. Total = active + resting.' }),
  },
];

/** The glossary entry named in `norm` (a normalised lower-case question); the longest matching alias wins. */
export function findTerm(norm: string): GlossEntry | null {
  const hay = ` ${norm} `;
  let best: { e: GlossEntry; len: number } | null = null;
  for (const e of GLOSSARY)
    for (const a of e.aliases) if (hay.includes(` ${a} `) && (!best || a.length > best.len)) best = { e, len: a.length };
  return best?.e ?? null;
}
export const termById = (id: string) => GLOSSARY.find((e) => e.id === id) ?? null;
