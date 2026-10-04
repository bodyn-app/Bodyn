import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ReorderList } from '@/components/reorder-list';
import { WIDGETS } from '@/components/home-widgets';
import { AppText, Card, DetailScreen, SectionHeader } from '@/components/ui';
import { useHomeLayout, visibleWidgets, type WidgetId } from '@/state/home-layout';
import { makeStyles, radius, space, useTheme } from '@/theme';

const ROW_HEIGHT = 68;

/** Reorder, hide and restore the cards on the home page. The date strip and the score rings aren't listed: they are fixed. */
export default function PreferencesHomeLayout() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { order, hidden, move, hide, show, reset } = useHomeLayout();
  const visible = visibleWidgets(order, hidden);
  // a vertical drag and a vertical scroll can't both own the gesture — the page freezes while a row is held
  const [dragging, setDragging] = useState(false);

  // the list shows only visible widgets, but the stored order includes hidden ones too — so translate indices
  const reorder = (from: number, to: number) => move(order.indexOf(visible[from]), order.indexOf(visible[to]));

  return (
    <DetailScreen title="Home Layout" scrollEnabled={!dragging}>
      <AppText variant="small" muted>
        Press and hold a card to pick it up, then drag it where you want. Tap the × to remove one. Your calendar and score rings stay at the top and can&apos;t be moved.
      </AppText>

      <SectionHeader title="On your home page" action="Reset" onAction={reset} />
      {visible.length ? (
        <ReorderList
          ids={visible}
          rowHeight={ROW_HEIGHT}
          gap={space.sm}
          onReorder={reorder}
          onDragChange={setDragging}
          renderRow={(id, rowDragging) => {
            const w = WIDGETS[id as WidgetId];
            return (
              <View style={[styles.row, rowDragging && { borderColor: colors.lime, backgroundColor: colors.surfaceAlt }]}>
                <Ionicons name={w.icon} size={20} color={colors.limeText} />
                <View style={{ flex: 1 }}>
                  <AppText variant="h3">{w.label}</AppText>
                  <AppText variant="tiny" muted numberOfLines={1}>
                    {w.hint}
                  </AppText>
                </View>
                <Pressable onPress={() => hide(id as WidgetId)} hitSlop={8} style={styles.iconBtn} accessibilityLabel={`Remove ${w.label}`}>
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            );
          }}
        />
      ) : (
        <Card>
          <AppText variant="small" muted>
            Every card is hidden. Add one back below.
          </AppText>
        </Card>
      )}

      <SectionHeader title="Add a card" />
      {hidden.length ? (
        <View style={{ gap: space.sm }}>
          {hidden.map((id) => {
            const w = WIDGETS[id];
            return (
              <View key={id} style={styles.row}>
                <Ionicons name={w.icon} size={20} color={colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <AppText variant="h3">{w.label}</AppText>
                  <AppText variant="tiny" muted numberOfLines={1}>
                    {w.hint}
                  </AppText>
                </View>
                <Pressable onPress={() => show(id)} hitSlop={8} style={[styles.iconBtn, { backgroundColor: colors.lime }]} accessibilityLabel={`Add ${w.label}`}>
                  <Ionicons name="add" size={18} color={colors.onLime} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : (
        <Card>
          <AppText variant="small" muted>
            Everything is already on your home page.
          </AppText>
        </Card>
      )}
    </DetailScreen>
  );
}

const useStyles = makeStyles((colors) => ({
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
}));
