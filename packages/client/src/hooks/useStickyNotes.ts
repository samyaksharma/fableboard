import { useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { Canvas, Rect, IText } from 'fabric';
import { useCanvasStore } from '@/stores/canvasStore';
import { useSessionStore } from '@/stores/sessionStore';
import { generateId, nowISO, CANVAS_DEFAULTS, DEFAULT_COLORS, SocketEvents } from '@fableboard/shared';

export function useStickyNotes(
  fabricRef: React.RefObject<Canvas | null>,
  socket: Socket | null,
) {
  const addElement = useCanvasStore((s) => s.addElement);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const session = useSessionStore((s) => s.session);

  const createStickyNote = useCallback(
    (x: number, y: number) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const elementId = generateId();
      const { STICKY_WIDTH, STICKY_HEIGHT, STICKY_FONT_SIZE } = CANVAS_DEFAULTS;

      const bg = new Rect({
        left: x - STICKY_WIDTH / 2,
        top: y - STICKY_HEIGHT / 2,
        width: STICKY_WIDTH,
        height: STICKY_HEIGHT,
        fill: DEFAULT_COLORS.STICKY_BG,
        stroke: '#d4a017',
        strokeWidth: 1,
        rx: 4,
        ry: 4,
        selectable: true,
        evented: true,
      });
      (bg as any).__elementId = elementId;
      (bg as any).__stickyRole = 'bg';

      const text = new IText('Note...', {
        left: (bg.left ?? 0) + 12,
        top: (bg.top ?? 0) + 12,
        fontSize: STICKY_FONT_SIZE,
        fill: DEFAULT_COLORS.STICKY_TEXT,
        fontFamily: 'sans-serif',
        width: STICKY_WIDTH - 24,
        editable: true,
        selectable: true,
        evented: true,
      });
      (text as any).__elementId = elementId;
      (text as any).__stickyRole = 'text';

      canvas.add(bg);
      canvas.add(text);
      canvas.setActiveObject(text);
      canvas.renderAll();

      bg.on('moving', () => {
        text.set({
          left: (bg.left ?? 0) + 12,
          top: (bg.top ?? 0) + 12,
        });
        text.setCoords();
      });

      const sessionId = session?.id ?? '';
      const element = {
        id: elementId,
        sessionId,
        type: 'sticky_note' as const,
        position: { x: bg.left ?? 0, y: bg.top ?? 0 },
        size: { w: STICKY_WIDTH, h: STICKY_HEIGHT },
        content: 'Note...',
        style: {
          fill: DEFAULT_COLORS.STICKY_BG,
          stroke: '#d4a017',
          strokeWidth: 1,
          opacity: 1,
        },
        fabricData: {
          bg: (bg.toObject as any)(['__elementId', '__stickyRole']),
          text: (text.toObject as any)(['__elementId', '__stickyRole']),
        },
        createdBy: '',
        updatedAt: nowISO(),
      };

      addElement(element);

      if (socket && sessionId) {
        socket.emit(SocketEvents.ADD_ELEMENT, { element });
      }

      setActiveTool('select');
    },
    [fabricRef, addElement, setActiveTool, socket, session],
  );

  return { createStickyNote };
}
