import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, useWindowDimensions, View } from 'react-native';

import { makeStyles, radius, space, useTheme } from '@/theme';

import { AppText } from './ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // week starts on Monday, like the day strip
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Month-grid date picker. Tap the month/year title to jump straight to any month or year. Only days between min and max can be picked. */
export function CalendarModal({ visible, value, min, max, hasData, onSelect, onClose }: { visible: boolean; value: string; min: string; max: string; hasData?: (date: string) => boolean; onSelect: (date: string) => void; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [view, setView] = useState({ y: +value.slice(0, 4), m: +value.slice(5, 7) - 1 });
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (visible) {
      setView({ y: +value.slice(0, 4), m: +value.slice(5, 7) - 1 });
      setPicking(false);
    }
  }, [visible, value]);

  const minY = +min.slice(0, 4), minM = +min.slice(5, 7) - 1;
  const maxY = +max.slice(0, 4), maxM = +max.slice(5, 7) - 1;
  const monthIndex = (y: number, m: number) => y * 12 + m;
  const inRange = (y: number, m: number) => monthIndex(y, m) >= monthIndex(minY, minM) && monthIndex(y, m) <= monthIndex(maxY, maxM);
  const shift = (delta: number) => {
    const t = monthIndex(view.y, view.m) + delta;
    const y = Math.floor(t / 12), m = t % 12;
    if (inRange(y, m)) setView({ y, m });
  };

  // day cells for the visible month (Monday-first)
  const offset = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const cardWidth = Math.min(360, width - 32);
  const canPrev = inRange(view.y + Math.floor((view.m - 1) / 12), (view.m + 11) % 12);
  const canNext = inRange(view.y + Math.floor((view.m + 1) / 12), (view.m + 1) % 12);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* inner Pressable swallows taps so the card doesn't close itself */}
        <Pressable style={[styles.card, { width: cardWidth }]} onPress={() => {}}>
          <View style={styles.header}>
            <Pressable onPress={() => shift(-1)} disabled={picking || !canPrev} hitSlop={10} style={[styles.arrow, (picking || !canPrev) && { opacity: 0.3 }]}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Pressable onPress={() => setPicking(!picking)} style={styles.title} hitSlop={6}>
              <AppText variant="h3">
                {MONTHS[view.m]} {view.y}
              </AppText>
              <Ionicons name={picking ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </Pressable>
            <Pressable onPress={() => shift(1)} disabled={picking || !canNext} hitSlop={10} style={[styles.arrow, (picking || !canNext) && { opacity: 0.3 }]}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>

          {picking ? (
            <View style={{ gap: space.md }}>
              {/* year selector */}
              <View style={styles.yearRow}>
                {Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i).map((y) => (
                  <Pressable key={y} onPress={() => setView({ y, m: Math.min(Math.max(view.m, y === minY ? minM : 0), y === maxY ? maxM : 11) })} style={[styles.yearChip, y === view.y && styles.chipOn]}>
                    <AppText variant="small" style={{ color: y === view.y ? colors.onLime : colors.text, fontWeight: '600' }}>
                      {y}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              {/* month grid */}
              <View style={styles.monthGrid}>
                {MONTHS.map((name, m) => {
                  const ok = inRange(view.y, m);
                  const on = m === view.m;
                  return (
                    <Pressable
                      key={name}
                      disabled={!ok}
                      onPress={() => {
                        setView({ y: view.y, m });
                        setPicking(false);
                      }}
                      style={[styles.monthCell, on && styles.chipOn, !ok && { opacity: 0.3 }]}
                    >
                      <AppText variant="small" style={{ color: on ? colors.onLime : colors.text, fontWeight: '600' }}>
                        {name.slice(0, 3)}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <>
              <View style={styles.week}>
                {WEEKDAYS.map((w, i) => (
                  <AppText key={i} variant="tiny" muted style={styles.weekday}>
                    {w}
                  </AppText>
                ))}
              </View>
              {weeks.map((week, wi) => (
                <View key={wi} style={styles.week}>
                  {week.map((d, di) => {
                    if (d == null) return <View key={di} style={styles.day} />;
                    const date = iso(view.y, view.m, d);
                    const ok = date >= min && date <= max;
                    const on = date === value;
                    const data = hasData ? hasData(date) : true;
                    return (
                      <Pressable
                        key={di}
                        disabled={!ok}
                        onPress={() => {
                          onSelect(date);
                          onClose();
                        }}
                        style={[styles.day, on && styles.dayOn, date === max && !on && styles.dayToday, !ok && { opacity: 0.25 }]}
                      >
                        <AppText variant="body" style={{ color: on ? colors.onLime : data ? colors.text : colors.textDim, fontWeight: on ? '700' : '500' }}>
                          {d}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </>
          )}

          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                onSelect(max);
                onClose();
              }}
              hitSlop={8}
            >
              <AppText variant="small" lime style={{ fontWeight: '700' }}>
                Jump to latest
              </AppText>
            </Pressable>
            <Pressable onPress={onClose} hitSlop={8}>
              <AppText variant="small" muted style={{ fontWeight: '600' }}>
                Close
              </AppText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.border, gap: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  arrow: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6 },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: 4 },
  day: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, margin: 1 },
  dayOn: { backgroundColor: colors.lime },
  dayToday: { borderWidth: 1, borderColor: colors.lime },
  yearRow: { flexDirection: 'row', gap: space.sm, justifyContent: 'center' },
  yearChip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  chipOn: { backgroundColor: colors.lime },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
  monthCell: { width: '31%', alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
}));
