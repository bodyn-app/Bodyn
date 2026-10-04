import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Animated, PanResponder, type PanResponderInstance, View } from 'react-native';

type Drag = { id: string; from: number; to: number };

/** press and hold this long, anywhere on a row, to pick it up */
const HOLD_MS = 220;
/** moving more than this before the hold completes means the user is scrolling, not reordering */
const MOVE_CANCEL_PX = 10;

/**
 * A vertical drag-to-reorder list, built on PanResponder + Animated (both part of React Native, so this needs
 * no extra dependency and no new-architecture compatibility risk).
 *
 * Rows are a fixed `rowHeight`, which keeps the maths simple: the dragged row follows the finger via an
 * Animated value (no re-render per frame), and the others slide out of its way whenever the target index
 * changes.
 *
 * A row is picked up by pressing and holding anywhere on it. That hold is what resolves the conflict with the
 * page's own vertical scrolling: until it completes we stay interruptible (`onPanResponderTerminationRequest`
 * returns true, so a scroll can take the gesture, and any real movement stands us down), and once it completes
 * we refuse to be terminated and `onDragChange` tells the screen to freeze the page. Buttons inside a row still
 * work, because a deeper Pressable claims the touch before these bubbling handlers are ever asked.
 */
export function ReorderList({
  ids,
  rowHeight,
  gap = 0,
  onReorder,
  onDragChange,
  renderRow,
}: {
  ids: string[];
  rowHeight: number;
  gap?: number;
  onReorder: (from: number, to: number) => void;
  onDragChange?: (active: boolean) => void;
  renderRow: (id: string, dragging: boolean) => ReactNode;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const panY = useRef(new Animated.Value(0)).current;
  const step = rowHeight + gap;

  // handlers are created once per row id, so they must read their inputs from this ref rather than capturing
  // the values of the render they were created in
  const latest = useRef({ ids, step, onReorder, onDragChange });
  latest.current = { ids, step, onReorder, onDragChange };
  // the authoritative drag state: a ref, so a move event that arrives before React re-renders still works
  const dragRef = useRef<Drag | null>(null);
  const active = useRef(false);

  const end = (commit: boolean) => {
    const d = dragRef.current;
    const wasActive = active.current;
    dragRef.current = null;
    active.current = false;
    if (commit && d && d.to !== d.from) latest.current.onReorder(d.from, d.to);
    panY.setValue(0);
    setDrag(null);
    if (wasActive) latest.current.onDragChange?.(false);
  };

  const responders = useRef<Record<string, PanResponderInstance>>({});
  const rowHandlers = (id: string) => {
    if (!responders.current[id]) {
      let hold: ReturnType<typeof setTimeout> | null = null;
      const clearHold = () => {
        if (hold) clearTimeout(hold);
        hold = null;
      };
      responders.current[id] = PanResponder.create({
        // claim on touch-down so the hold can be timed, but stay giveable-back until it completes
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => active.current,
        onPanResponderTerminationRequest: () => !active.current,
        onShouldBlockNativeResponder: () => active.current,
        onPanResponderGrant: () => {
          const from = latest.current.ids.indexOf(id);
          if (from < 0) return;
          clearHold();
          hold = setTimeout(() => {
            hold = null;
            active.current = true;
            panY.setValue(0);
            dragRef.current = { id, from, to: from };
            setDrag(dragRef.current);
            latest.current.onDragChange?.(true);
          }, HOLD_MS);
        },
        onPanResponderMove: (_e, g) => {
          if (!active.current) {
            // still waiting on the hold: real movement means this is a scroll, so stand down
            if (Math.abs(g.dy) > MOVE_CANCEL_PX || Math.abs(g.dx) > MOVE_CANCEL_PX) clearHold();
            return;
          }
          const d = dragRef.current;
          if (!d) return;
          panY.setValue(g.dy);
          const to = Math.min(latest.current.ids.length - 1, Math.max(0, d.from + Math.round(g.dy / latest.current.step)));
          if (to !== d.to) {
            dragRef.current = { ...d, to };
            setDrag(dragRef.current);
          }
        },
        onPanResponderRelease: () => {
          clearHold();
          end(true);
        },
        onPanResponderTerminate: () => {
          clearHold();
          end(false);
        },
      });
    }
    return responders.current[id].panHandlers;
  };

  /** how far a row that is NOT being dragged slides, to open a gap at the drag's target index */
  const shiftFor = (index: number) => {
    if (!drag || drag.from === drag.to) return 0;
    const { from, to } = drag;
    if (from < to) return index > from && index <= to ? -step : 0;
    return index >= to && index < from ? step : 0;
  };

  return (
    <View style={{ gap }}>
      {ids.map((id, index) => {
        const isDragging = drag?.id === id;
        return (
          <Animated.View
            key={id}
            {...rowHandlers(id)}
            style={[
              { height: rowHeight, zIndex: isDragging ? 2 : 1 },
              isDragging
                ? { transform: [{ translateY: panY }, { scale: 1.03 }], shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 8 }
                : { transform: [{ translateY: shiftFor(index) }] },
            ]}
          >
            {renderRow(id, isDragging)}
          </Animated.View>
        );
      })}
    </View>
  );
}
