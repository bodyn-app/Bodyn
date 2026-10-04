import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Switch, View } from 'react-native';

import { Chip, AppText, Card, DetailScreen, SectionHeader, Stepper } from '@/components/ui';
import { CATEGORIES, clockText, notifications, type NotifCategory } from '@/notifications';
import { categoryColor } from '@/notifications/colors';
import { type PermissionState, permissionState, previewSchedule, requestPermission, sendTest, syncSchedule } from '@/notifications/schedule';
import { useNotificationPrefs } from '@/state/notification-prefs';
import { makeStyles, radius, space, useTheme } from '@/theme';


const INFO: Record<NotifCategory, { title: string; text: string; icon: keyof typeof Ionicons.glyphMap }> = {
  bedtime: { title: 'Bedtime', text: 'A wind-down reminder before your bedtime, earlier on days that need more sleep.', icon: 'moon' },
  focus: { title: 'Best focus time', text: 'When your mind is likely at its sharpest today.', icon: 'bulb' },
  energy: { title: 'Energy', text: 'The afternoon dip, and the best times to be active or to rest.', icon: 'flash' },
  caffeine: { title: 'Caffeine cutoff', text: 'A last call so caffeine doesn\'t cut into your sleep.', icon: 'cafe' },
  hydration: { title: 'Water breaks', text: 'A few gentle reminders through the day, with one-tap logging.', icon: 'water' },
};

const NEXT = [
  ['Stress warnings', 'A heads-up when your stress stays high'],
  ['Overtraining alerts', 'When your load is too high for your recovery'],
  ['Body changes', 'HRV, resting heart rate, blood oxygen and breathing'],
  ['Health data updates', 'Weight, blood pressure and nutrition'],
  ['Monthly recap', 'Achievements, trends and tips'],
];

const hoursText = (min: number) => clockText(min);

export default function NotificationSettings() {
  const styles = useStyles();
  const { colors } = useTheme();
  const prefs = useNotificationPrefs();
  const [perm, setPerm] = useState<PermissionState>('undetermined');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    permissionState().then(setPerm);
  }, []);

  const day = useMemo(() => notifications.day(), []);
  const sleepWindow = `${clockText(day.bed)}–${clockText(day.wake)}`;
  const track = { false: colors.surfaceAlt, true: colors.lime };

  const toggleMaster = async (on: boolean) => {
    if (on) {
      const state = perm === 'granted' ? 'granted' : await requestPermission();
      setPerm(state);
      prefs.set({ enabled: true });
      if (state === 'denied') setMessage('iPhone notifications are blocked for Bodyn. Open Settings to allow them.');
      else setMessage(null);
    } else {
      prefs.set({ enabled: false });
      setMessage(null);
    }
  };

  const plan = () => notifications.plan(new Date(), useNotificationPrefs.getState());
  const test = async () => {
    if (perm !== 'granted') {
      const state = await requestPermission();
      setPerm(state);
      if (state !== 'granted') return setMessage(state === 'unsupported' ? 'System notifications are not available in the web preview. Try it on your iPhone.' : 'Allow notifications for Bodyn in iPhone Settings first.');
    }
    await sendTest();
    setMessage('A test notification will arrive in about 5 seconds. Lock your screen or switch apps to see it.');
  };
  const preview = async () => {
    if (perm !== 'granted') {
      const state = await requestPermission();
      setPerm(state);
      if (state !== 'granted') return setMessage(state === 'unsupported' ? 'System notifications are not available in the web preview. Try it on your iPhone.' : 'Allow notifications for Bodyn in iPhone Settings first.');
    }
    const n = await previewSchedule(plan());
    setMessage(n ? `${n} of your real notifications will arrive 1, 2 and 3 minutes from now. Your normal schedule comes back the next time you change a setting or reopen Bodyn.` : 'There is nothing to preview. Turn on at least one category.');
  };
  const resync = () => syncSchedule(prefs.enabled ? plan() : []).then(() => setMessage('Schedule refreshed.'));

  const permText =
    perm === 'granted' ? 'Allowed on this iPhone' : perm === 'denied' ? 'Blocked in iPhone Settings' : perm === 'unsupported' ? 'Not available in the web preview' : 'iPhone will ask the first time';

  return (
    <DetailScreen title="Notifications">
      <Card style={{ gap: space.sm }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <AppText variant="h3">Notifications</AppText>
            <AppText variant="small" muted>
              {permText}
            </AppText>
          </View>
          <Switch value={prefs.enabled} onValueChange={toggleMaster} trackColor={track} thumbColor="#fff" accessibilityLabel="Turn notifications on or off" />
        </View>
        {perm === 'denied' ? (
          <Pressable onPress={() => Linking.openSettings()} style={styles.link}>
            <AppText variant="small" lime style={{ fontWeight: '600' }}>
              Open iPhone Settings
            </AppText>
          </Pressable>
        ) : null}
      </Card>

      <SectionHeader title="What to send" />
      <View style={{ gap: space.md }}>
        {CATEGORIES.map((c) => (
          <Card key={c} style={{ gap: space.md, opacity: prefs.enabled ? 1 : 0.5 }}>
            <View style={styles.row}>
              <View style={styles.badge}>
                <Ionicons name={INFO[c].icon} size={18} color={categoryColor(colors, c)} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="h3">{INFO[c].title}</AppText>
                <AppText variant="small" muted>
                  {INFO[c].text}
                </AppText>
              </View>
              <Switch value={prefs.categories[c]} onValueChange={(on) => prefs.setCategory(c, on)} disabled={!prefs.enabled} trackColor={track} thumbColor="#fff" accessibilityLabel={`${INFO[c].title} notifications`} />
            </View>
            {c === 'bedtime' && prefs.categories.bedtime ? (
              <View style={styles.chips}>
                <AppText variant="small" muted style={{ marginRight: 4 }}>
                  Remind me
                </AppText>
                {[30, 45, 60].map((m) => (
                  <Chip key={m} label={`${m} min before`} active={prefs.bedtimeLeadMin === m} onPress={() => prefs.set({ bedtimeLeadMin: m })} />
                ))}
              </View>
            ) : null}
            {c === 'hydration' && prefs.categories.hydration ? (
              <View style={styles.chips}>
                <AppText variant="small" muted style={{ marginRight: 4 }}>
                  Per day
                </AppText>
                {[3, 4, 5, 6].map((n) => (
                  <Chip key={n} label={String(n)} active={prefs.hydrationCount === n} onPress={() => prefs.set({ hydrationCount: n })} />
                ))}
              </View>
            ) : null}
          </Card>
        ))}
      </View>

      <SectionHeader title="Keep it calm" />
      <Card style={{ gap: space.lg, opacity: prefs.enabled ? 1 : 0.5 }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <AppText variant="h3">Quiet hours</AppText>
            <AppText variant="small" muted>
              {prefs.quietMode === 'auto' ? `While you should be asleep (${sleepWindow}). Bedtime reminders still arrive.` : 'Choose your own quiet hours.'}
            </AppText>
          </View>
          <Switch
            value={prefs.quietMode === 'auto'}
            onValueChange={(on) => prefs.set({ quietMode: on ? 'auto' : 'custom' })}
            disabled={!prefs.enabled}
            trackColor={track}
            thumbColor="#fff"
            accessibilityLabel="Match quiet hours to my sleep"
          />
        </View>
        {prefs.quietMode === 'custom' ? (
          <View style={{ gap: space.md }}>
            <View style={styles.row}>
              <AppText style={{ flex: 1 }}>From</AppText>
              <Stepper value={prefs.quietStart} onChange={(v) => prefs.set({ quietStart: v })} min={0} max={23 * 60 + 30} step={30} format={hoursText} />
            </View>
            <View style={styles.row}>
              <AppText style={{ flex: 1 }}>Until</AppText>
              <Stepper value={prefs.quietEnd} onChange={(v) => prefs.set({ quietEnd: v })} min={0} max={23 * 60 + 30} step={30} format={hoursText} />
            </View>
          </View>
        ) : null}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <AppText variant="h3">Most per day</AppText>
            <AppText variant="small" muted>
              Bodyn keeps the most useful ones and leaves 20 minutes between them.
            </AppText>
          </View>
          <Stepper value={prefs.dailyCap} onChange={(v) => prefs.set({ dailyCap: v })} min={3} max={8} step={1} format={(v) => String(v)} />
        </View>
      </Card>

      <SectionHeader title="Try it on your phone" />
      <Card style={{ gap: space.md }}>
        <Pressable onPress={test} style={styles.btn} accessibilityLabel="Send a test notification">
          <Ionicons name="paper-plane" size={18} color={colors.onLime} />
          <AppText variant="h3" style={{ color: colors.onLime }}>
            Send a test notification
          </AppText>
        </Pressable>
        <Pressable onPress={preview} style={[styles.btn, { backgroundColor: colors.surfaceAlt }]} accessibilityLabel="Preview my next notifications">
          <Ionicons name="time" size={18} color={colors.text} />
          <AppText variant="h3">Preview my next 3 in 3 minutes</AppText>
        </Pressable>
        <Pressable onPress={resync} hitSlop={8} accessibilityLabel="Refresh the schedule">
          <AppText variant="small" lime style={{ fontWeight: '600', textAlign: 'center' }}>
            Refresh the schedule
          </AppText>
        </Pressable>
        {message ? (
          <AppText variant="small" muted>
            {message}
          </AppText>
        ) : null}
      </Card>

      <SectionHeader title="Coming next" />
      <Card style={{ gap: space.md }}>
        {NEXT.map(([t, d]) => (
          <View key={t} style={styles.row}>
            <Ionicons name="time-outline" size={16} color={colors.textDim} />
            <View style={{ flex: 1 }}>
              <AppText>{t}</AppText>
              <AppText variant="tiny" muted>
                {d}
              </AppText>
            </View>
          </View>
        ))}
        <AppText variant="tiny" muted>
          These need live data from Apple Health, which arrives when Bodyn goes live on your iPhone.
        </AppText>
      </Card>
    </DetailScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  link: { paddingVertical: 4 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 46, borderRadius: radius.pill, backgroundColor: colors.lime },
}));
