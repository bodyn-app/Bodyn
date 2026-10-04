import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from 'react-native';

import { ColumnChart } from '@/components/charts';
import { AppText, Card, DetailScreen, SectionHeader } from '@/components/ui';
import { WaterCircle } from '@/components/water-circle';
import { clockText, notifications } from '@/notifications';
import { dailyWaterMl, DEFAULT_GLASS_ML, entriesOnDay, useIntakeLog } from '@/state/intake-log';
import { makeStyles, radius, space, useTheme } from '@/theme';

/** One-tap water sizes: a glass, a can/small bottle, a large bottle. */
const WATER_SIZES_ML = [250, 330, 500];
const GOAL_ML = 2000;
/** Upper bound for one custom entry, to catch typos like 25000. */
const MAX_CUSTOM_ML = 3000;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtMl = (v: number) => Math.round(v).toLocaleString('en-US');

const time = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Bottom sheet to log any amount of water, typed in ml. */
function CustomWaterSheet({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (ml: number) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const ml = parseInt(text, 10) || 0;
  const valid = ml > 0 && ml <= MAX_CUSTOM_ML;
  const close = () => {
    setText('');
    onClose();
  };
  const submit = () => {
    if (!valid) return;
    onAdd(ml);
    close();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" />
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Ionicons name="water" size={28} color={colors.rest} style={{ alignSelf: 'center' }} />
          <AppText variant="h2" style={{ textAlign: 'center' }}>
            Add water
          </AppText>
          <View style={[styles.inputBox, { borderColor: valid || !text ? colors.border : colors.bad }]}>
            <TextInput
              value={text}
              onChangeText={(t) => setText(t.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              autoFocus
              placeholder="0"
              placeholderTextColor={colors.textDim}
              onSubmitEditing={submit}
              style={styles.input}
              accessibilityLabel="Amount of water in millilitres"
            />
            <AppText variant="h3" muted>
              ml
            </AppText>
          </View>
          {ml > MAX_CUSTOM_ML ? (
            <AppText variant="small" style={{ color: colors.bad, textAlign: 'center' }}>
              That&apos;s a lot for one go. Log up to {fmtMl(MAX_CUSTOM_ML)} ml at a time.
            </AppText>
          ) : null}
          <Pressable onPress={submit} disabled={!valid} style={[styles.addBtn, { backgroundColor: valid ? colors.rest : colors.rest + '33' }]} accessibilityLabel="Add water">
            <Ionicons name="add" size={20} color={valid ? '#FFFFFF' : colors.textMuted} />
            <AppText variant="h3" style={{ color: valid ? '#FFFFFF' : colors.textMuted }}>
              Add{valid ? ` ${fmtMl(ml)} ml` : ''}
            </AppText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Where the water and caffeine reminders lead: log water or a coffee in one tap. */
export default function QuickLog() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { entries, add, remove } = useIntakeLog();
  const [customOpen, setCustomOpen] = useState(false);
  const today = useMemo(() => entriesOnDay(entries), [entries]);
  const week = useMemo(() => dailyWaterMl(entries, 7), [entries]);
  const water = today.filter((e) => e.kind === 'water');
  const caffeine = today.filter((e) => e.kind === 'caffeine');
  const ml = water.reduce((t, e) => t + (e.ml ?? DEFAULT_GLASS_ML), 0);
  const loggedDays = week.filter((d) => d.ml > 0);
  const avg = loggedDays.length ? loggedDays.reduce((t, d) => t + d.ml, 0) / loggedDays.length : 0;
  const cutoff = notifications.day().caffeineCutoff;
  const lastCaffeine = caffeine[caffeine.length - 1];
  const lastMin = lastCaffeine ? new Date(lastCaffeine.at).getHours() * 60 + new Date(lastCaffeine.at).getMinutes() : null;
  // the cutoff can sit after midnight-anchored minutes; compare on the same clock as the wake time
  const cutoffMin = cutoff != null ? cutoff % 1440 : null;
  const late = lastMin != null && cutoffMin != null && lastMin > cutoffMin && lastMin < cutoffMin + 6 * 60;

  return (
    <DetailScreen title="Water & caffeine">
      <WaterCircle ml={ml} goal={GOAL_ML} />

      <SectionHeader title="Quick add" />
      <View style={styles.row}>
        {WATER_SIZES_ML.map((size) => (
          <Pressable key={size} onPress={() => add('water', size)} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.6 }]} accessibilityLabel={`Log ${size} ml of water`}>
            <AppText variant="h2">{size}</AppText>
            <AppText variant="tiny" muted>
              ml
            </AppText>
          </Pressable>
        ))}
        <Pressable onPress={() => setCustomOpen(true)} style={({ pressed }) => [styles.tile, styles.customTile, pressed && { opacity: 0.6 }]} accessibilityLabel="Log a custom amount of water">
          <Ionicons name="options-outline" size={22} color={colors.rest} />
          <AppText variant="tiny" muted>
            Custom
          </AppText>
        </Pressable>
      </View>
      <CustomWaterSheet visible={customOpen} onClose={() => setCustomOpen(false)} onAdd={(v) => add('water', v)} />

      <Card style={{ gap: space.md, marginTop: space.xl }}>
        <View style={styles.row}>
          <Ionicons name="cafe" size={20} color={colors.warn} />
          <AppText variant="h3" style={{ flex: 1 }}>
            Caffeine today
          </AppText>
          <AppText variant="h3">{caffeine.length}</AppText>
        </View>
        {cutoff != null ? (
          <AppText variant="small" muted>
            Last call is {clockText(cutoff)}, about 9 hours before your bedtime, so it doesn&apos;t cut into your sleep.
          </AppText>
        ) : null}
        {late ? (
          <AppText variant="small" style={{ color: colors.warn, fontWeight: '600' }}>
            Your last one was at {time(lastCaffeine.at)}, after the cutoff. Skip the next one and you should still sleep well.
          </AppText>
        ) : null}
        <Pressable onPress={() => add('caffeine')} style={[styles.btn, { backgroundColor: colors.surfaceAlt }]} accessibilityLabel="Log caffeine">
          <Ionicons name="add" size={20} color={colors.text} />
          <AppText variant="h3">Log a coffee or tea</AppText>
        </Pressable>
      </Card>

      <SectionHeader title="Logged today" />
      {today.length === 0 ? (
        <AppText variant="small" muted>
          Nothing logged yet today.
        </AppText>
      ) : (
        <View style={{ gap: space.sm }}>
          {[...today].reverse().map((e) => (
            <View key={e.id} style={styles.entry}>
              <Ionicons name={e.kind === 'water' ? 'water' : 'cafe'} size={16} color={e.kind === 'water' ? colors.rest : colors.warn} />
              <AppText style={{ flex: 1 }}>{e.kind === 'water' ? `${fmtMl(e.ml ?? DEFAULT_GLASS_ML)} ml water` : 'Caffeine'}</AppText>
              <AppText variant="small" muted>
                {time(e.at)}
              </AppText>
              <Pressable onPress={() => remove(e.id)} hitSlop={10} accessibilityLabel="Remove entry">
                <Ionicons name="close-circle-outline" size={18} color={colors.textDim} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <SectionHeader title="Last 7 days" />
      <Card>
        <ColumnChart
          values={week.map((d) => (d.ml > 0 ? d.ml : null))}
          labels={week.map((d) => DOW[d.day.getDay()])}
          highlight={week.length - 1}
          color={colors.rest}
          format={fmtMl}
          showScale
          height={170}
          refs={[
            { value: GOAL_ML, label: `Goal ${fmtMl(GOAL_ML)} ml`, color: colors.rest },
            ...(avg > 0 ? [{ value: avg, label: `Avg ${fmtMl(avg)} ml`, color: colors.textMuted, align: 'left' as const }] : []),
          ]}
        />
      </Card>
    </DetailScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tile: { flex: 1, height: 72, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: radius.md, backgroundColor: colors.rest + '1F', borderWidth: 1, borderColor: colors.rest + '55' },
  customTile: { borderStyle: 'dashed', backgroundColor: colors.rest + '12' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 46, borderRadius: radius.pill, backgroundColor: colors.lime },
  entry: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  backdrop: { flex: 1, backgroundColor: '#00000066' },
  sheet: { gap: space.md, padding: space.xl, paddingBottom: space.xxl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surface },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: space.sm },
  inputBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 72, borderRadius: radius.md, borderWidth: 1, backgroundColor: colors.surfaceAlt },
  input: { minWidth: 60, textAlign: 'right', fontSize: 36, fontWeight: '800', color: colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 50, borderRadius: radius.pill },
}));
