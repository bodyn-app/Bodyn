# Bodyn notifications — plan

Saved 2026-09-21 so we can pick it up later. Round 1 is built. Round 2 is planned below and **not built yet**: it needs the user's go-ahead first.

## Status

| Round | What | State |
|---|---|---|
| 1 | Foundation and time-based recommendations: bedtime, best focus time, energy (afternoon dip, best time to be active), caffeine cutoff, water breaks. Inbox on the Home bell, settings under Account → Notifications, quick log for water and caffeine. | **Built** (2026-09-21) |
| 2 | Alerts computed from the user's own data: stress warning, overtraining alert, body-change alerts, health-data updates, monthly recap. | **Planned** (this file) |

### What Round 1 left in the code (reuse it)
- `src/notifications/plan.ts`: `buildPlan` keeps notifications few (quiet hours, daily cap, at least 20 minutes apart, at most 60 scheduled).
- `src/notifications/circadian.ts`, `copy.ts`: the day model and all wording (one place for wording).
- `src/notifications/schedule.ts` (+ `schedule.web.ts`), `use-setup.ts`: expo-notifications wrapper, mounted in `src/app/_layout.tsx`. Local notifications work in Expo Go on iOS.
- `src/state/notification-prefs.ts` (settings, `seenUntil`), `src/state/intake-log.ts` (water and caffeine log).
- Screens: `/notifications` (inbox), `/notification-settings`, `/quick-log`.
- `npx tsx scripts/notifications-demo.mts` prints a sample day from the real data.
- Limits that still apply: notification text is fixed when it is scheduled (rebuilt on every app open); iOS keeps at most 64 pending; live triggers need the HealthKit development build.

## Round 2 principles
- **Use only the data we really have.** The user's Apple Health export has no blood pressure and no wrist temperature, so nothing in Round 2 depends on them. They come later, when Apple Health has readings (see "Not now").
- **Stress and overtraining are measured from what we have:** hourly heart rate (stress), and heart-rate strain against the recovery score and sleep (overtraining). Both already exist in the metrics engine.
- **Few, calm, useful.** Every alert has a cool-down, a once-a-day limit and a sensitivity setting; each rule is calibrated on the user's 597 days so it does not fire all the time.
- **Observations, not diagnoses.** Wording says what changed and what to do (rest, ease off, re-check tomorrow). It never claims a cause or a condition, and it points to a doctor only for "if you feel unwell". No other product is named anywhere in the app.

## What the data supports

| Signal | In the export? | Used for |
|---|---|---|
| Hourly heart rate, steps, active energy, sleep sessions | Yes | Stress (already in `src/metrics/stress.ts`), strain |
| Recovery contributors: overnight HRV, resting HR, respiratory rate vs the 30-day baseline (z-scores) | Yes | Body-change alerts, overtraining |
| Blood oxygen (SpO2), daily mean | Yes (3,486 readings, Watch spot checks: sparse and noisy) | Body-change alert, with a cautious threshold |
| Weight | Yes (232 readings) | Weekly weight summary and "log your weight" prompt |
| Water and nutrition from Apple Health | Almost none: 12 water and 22 meal entries, all between 5 and 18 Aug 2026 | Not enough for summaries. Use Bodyn's own quick log for water instead |
| Blood pressure | **No** | Not now |
| Wrist temperature | **No** | Not now |

## The rules

All thresholds below are **starting points**. The first step of the build is a calibration script (`scripts/alerts-demo.mts`, like the coach and notification demos) that replays each rule over all days and prints how often it fires and on which days. Tune until each rule fires about as often as the target in the last column.

| Alert | Rule (from current data) | Cool-down and limits | Target frequency |
|---|---|---|---|
| **Stress warning** | `metrics.stress(date)`: two or more consecutive awake, still hours with an hour level of 2.0 or more (High), or a day level of 1.6 or more. Wording: "Your stress has been high for N hours. Take a 5 minute break, a slow breath or a short walk." | 3 hours between stress alerts, at most 1 a day, none during quiet hours | About 1 to 3 a month (the user's data has High on about 2% of days, Moderate on about 26%) |
| **Overtraining** | A: the day's strain is 2 or more above the top of the range for the day's recovery band (`targetStrain(band)[1]` from `src/metrics/engine.ts`). B: three hard days in a row (strain 14 or more) and recovery falling by 10 points or more, or the 3-day recovery average below 50. C: strain high while resting heart rate is 5 bpm above baseline. Wording: "You are pushing hard for your recovery. An easy day protects your progress." | At most 1 a day; A and B are not repeated for 2 days | About 1 to 2 a month |
| **Body changes** (one combined notification, "worth watching") | HRV z-score of −1.5 or lower, or −1.0 or lower two days in a row. Resting heart rate 5 or more bpm above the 30-day median. Respiratory rate 1.5 or more breaths per minute above baseline. SpO2 daily mean below 92%, or 3 or more points under the 30-day mean. Several signals together are one message ("2 of your body signals changed"). | At most 1 a day, and not again for the same signal for 2 days | About 1 to 3 a month |
| **Health data updates** | Weekly weight summary (chosen weekday, default Sunday 09:00): latest weight, change since last week and the 30-day trend. A prompt to log weight when there is no reading for 7 days or more. Evening water summary only from Bodyn's own log. | Weekly; the prompt at most once a week | 1 a week |
| **Monthly recap** | On the 1st at 09:00 (changeable): the last full month with averages for recovery, sleep, strain and stress, the best and hardest day, workouts and minutes, and the change from the month before. 1 to 3 achievements (best month for sleep, longest run of green days, best HRV) and 2 personal tips from the coach insights (the weakest sleep part, the best weekday). A `/recap` screen shows the full recap. | Monthly | 1 a month |

Sensitivity setting (Relaxed / Balanced / Sensitive, default Balanced) moves the thresholds: for example stress at 2 or 3 hours, HRV at −1.5 or −1.0.

## How it works

### Engine (pure TypeScript, unit-tested, no expo imports)
- `src/notifications/alerts/{stress,overtraining,biometric,healthdata,recap}.ts`: each takes the deps, a date and the settings and returns `Alert[]` with `{ id, category, severity, title, body, at, url, evidence }`. The `evidence` (the numbers behind the alert) is shown in the inbox so nothing feels like a black box.
- `src/notifications/alerts/index.ts`: `evaluateAlerts(deps, date, prefs, state)` applies cool-downs and limits. The cool-down state (last time each rule fired) is stored in `src/state/alert-state.ts` (zustand + AsyncStorage, like the other stores).
- Reuse: `metrics.stress/recovery/strain`, `targetStrain` (`src/metrics/engine.ts`), `buildContext` and `recoveryDrivers` (`src/coach/`), `records`, `weekdayPattern`, `weakestSleepPart`, `trendDirection` (`src/coach/insights.ts`), and the parser output for weight (`src/data/types.ts`, `weightKg`, `spo2`).
- Settings: extend `NotifCategory` and `Prefs` in `src/notifications/types.ts` with `stress`, `overtraining`, `biometrics`, `healthdata`, `recap`, a sensitivity level and the recap and weight days.

### Delivery
- **Time-based ones** (weekly weight summary, monthly recap): scheduled ahead like the Round 1 notifications, and rebuilt on every app open.
- **Data-based ones** (stress, overtraining, body changes): in the POC the data is a fixed export, so they are **evaluated for the selected day** (default: the latest day) each time the app opens or the day changes. A new alert shows in the inbox under "Alerts" and fires as an immediate local notification, with a stable id per rule and day so it never repeats.
- **Demo:** every alert row has "Send as a demo notification" (arrives in 5 seconds), and a "Replay a day" picker on the settings screen so the user can feel each type without waiting for a bad day.
- **Real time (later, HealthKit development build):** HealthKit background delivery can wake the app when new heart-rate, HRV or SpO2 samples arrive, and the same engine runs on them. iOS decides how often it wakes us, so some alerts can arrive late or not at all; the app should say so honestly in settings.

### UI
- Inbox (`/notifications`): a new **Alerts** section above "Today so far", each row with a severity dot, the message, and "Why?" that expands the evidence (for example "HRV 21 ms against your usual 43").
- Settings: the "Coming next" card becomes real switches (Stress warnings, Overtraining alerts, Body changes, Health data updates, Monthly recap), the sensitivity setting, and the recap and weight-summary days.
- New `/recap` screen (`src/app/recap.tsx`), opened from the recap notification and from the inbox.

## Build order (when we start)
1. Calibration script and thresholds (no UI): replay each rule over all days, choose the thresholds, record the results in this file.
2. Alert engine, cool-down store, extended settings, unit tests.
3. Inbox "Alerts" section, evidence, demo button, replay picker, settings switches.
4. Recap screen and the scheduled weekly and monthly notifications.
5. Web export check in light and dark, then a phone test in Expo Go with the demo buttons.

## Tests and checks
- Unit tests: each rule fires on a hand-made scenario and stays quiet on a normal one; cool-down and once-a-day limits; sensitivity moves the thresholds; combined body-change message; nothing depends on blood pressure or wrist temperature; wording contains no other product's name and no diagnosis words.
- Calibration report: number of alerts per month for each rule on the 597 real days, kept under the targets above.
- Phone test steps (the user): turn on each new type, use "Send as a demo notification", "Replay a day" on a known high-stress day and a known heavy-training day, tap a notification and confirm it opens the right screen.

## Not now (kept for later)
- **Blood pressure** and **wrist temperature**: add when Apple Health has readings. Blood pressure needs `BloodPressureSystolic` and `BloodPressureDiastolic` parsed into the fixtures and later read through HealthKit; wrist temperature needs `AppleSleepingWristTemperature`. Their switches stay hidden until data exists.
- **Nutrition summaries** from Apple Health: only about two weeks of entries exist. Extend `src/health/import/parse-core.ts` (dietary water, energy, protein, carbohydrates, caffeine) if the user starts logging regularly.
- Time-sensitive delivery (breaks through Focus modes): needs an entitlement that only a real build can have.
- Automatic background refresh of scheduled text (`expo-background-task`), remote push, and coach-style wording written by the future AI agent.

## Open choices to confirm before Round 2
- Default sensitivity (proposed: Balanced).
- Day and time for the weekly weight summary (proposed: Sunday 09:00) and the monthly recap (proposed: the 1st at 09:00).
