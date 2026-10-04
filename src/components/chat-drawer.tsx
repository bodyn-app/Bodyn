import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTopInset } from '@/lib/safe-top';

import type { ChatThread } from '@/state/coach-chats';
import { makeStyles, radius, space, useTheme } from '@/theme';

import { AppText } from './ui';

/** "just now", "5 min ago", "3 h ago", "2 d ago", "1 mo ago" */
export function ago(ts: number, now = Date.now()) {
  const min = Math.max(0, Math.round((now - ts) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 1440) return `${Math.round(min / 60)} h ago`;
  if (min < 43200) return `${Math.round(min / 1440)} d ago`;
  return `${Math.round(min / 43200)} mo ago`;
}

/** Left panel with the chat history: start a new chat, reopen an old one or delete it. */
export function ChatDrawer({ visible, threads, activeId, onClose, onNew, onOpen, onDelete }: { visible: boolean; threads: ChatThread[]; activeId: string | null; onClose: () => void; onNew: () => void; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const top = useTopInset();
  const { width } = useWindowDimensions();
  const panelW = Math.min(320, width * 0.82);
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(t, { toValue: visible ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, t]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] }) }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close chat history" />
      </Animated.View>
      <Animated.View style={[styles.panel, { width: panelW, paddingTop: top + space.md, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-panelW, 0] }) }] }]}>
        <Pressable onPress={onNew} style={styles.newBtn} accessibilityLabel="New chat">
          <Ionicons name="create-outline" size={18} color={colors.text} />
          <AppText variant="h3">New chat</AppText>
        </Pressable>

        <AppText variant="small" muted style={{ marginTop: space.lg, marginBottom: space.sm, paddingHorizontal: space.lg }}>
          Recent
        </AppText>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {threads.length === 0 ? (
            <AppText variant="small" muted style={{ paddingHorizontal: space.lg }}>
              Your chats will show up here.
            </AppText>
          ) : null}
          {threads.map((c) => (
            <Pressable key={c.id} onPress={() => onOpen(c.id)} style={[styles.row, c.id === activeId && { backgroundColor: colors.surfaceAlt }]}>
              <View style={{ flex: 1 }}>
                <AppText numberOfLines={1} style={{ fontWeight: c.id === activeId ? '700' : '500' }}>
                  {c.title}
                </AppText>
                <AppText variant="small" muted>
                  {ago(c.updatedAt)}
                </AppText>
              </View>
              <Pressable onPress={() => onDelete(c.id)} hitSlop={10} accessibilityLabel={`Delete chat ${c.title}`}>
                <Ionicons name="trash-outline" size={17} color={colors.textDim} />
              </Pressable>
            </Pressable>
          ))}
        </ScrollView>
        <View style={{ height: insets.bottom + space.md }} />
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  panel: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.bg, borderRightWidth: 1, borderRightColor: colors.border },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, paddingHorizontal: space.md, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: 12 },
}));
