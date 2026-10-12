import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import { Line, Path, type Canvas } from 'fabric';
import { SocketEvents, generateId, nowISO } from '@fableboard/shared';
import { useCanvasStore } from '@/stores/canvasStore';
import { useSessionStore } from '@/stores/sessionStore';

const MIN_LENGTH = 6;

// A line is one path; an arrow adds two short strokes at the end, so it stays a single element.
function pathFor(tool: 'line' | 'arrow', x1: number, y1: number, x2: number, y2: number, width: number) {
  let d = `M ${x1} ${y1} L ${x2} ${y2}`;
  if (tool === 'arrow') {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = Math.max(14, width * 4.5);
    const spread = Math.PI / 6;
    for (const sign of [-1, 1]) {
      const hx = x2 - head * Math.cos(angle + sign * spread);
      const hy = y2 - head * Math.sin(angle + sign * spread);
      d += ` M ${hx} ${hy} L ${x2} ${y2}`;
    }
  }
  return d;
}

/** Click-and-drag line and arrow tools. */
export function useLines(fabricRef: React.RefObject<Canvas | null>, socket: Socket | null, enabled: boolean) {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const session = useSessionStore((s) => s.session);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !enabled || (activeTool !== 'line' && activeTool !== 'arrow')) return;
    const tool = activeTool;

    let start: { x: number; y: number } | null = null;
    let preview: Line | null = null;
    const previous = {
      selection: canvas.selection,
      skip: canvas.skipTargetFind,
      cursor: canvas.defaultCursor,
    };
    canvas.discardActiveObject();
    canvas.selection = false;
    canvas.skipTargetFind = true; // dragging must not grab existing objects
    canvas.defaultCursor = 'crosshair';
    canvas.renderAll();

    const down = (e: { e: Event }) => {
      const p = canvas.getScenePoint(e.e as any);
      const { strokeColor, brushWidth } = useCanvasStore.getState();
      start = { x: p.x, y: p.y };
      preview = new Line([p.x, p.y, p.x, p.y], {
        stroke: strokeColor,
        strokeWidth: brushWidth,
        strokeLineCap: 'round',
        selectable: false,
        evented: false,
      });
      (preview as any).__skipEmit = true;
      canvas.add(preview);
    };

    const move = (e: { e: Event }) => {
      if (!preview || !start) return;
      const p = canvas.getScenePoint(e.e as any);
      preview.set({ x2: p.x, y2: p.y });
      canvas.requestRenderAll();
    };

    const up = (e: { e: Event }) => {
      if (!preview || !start) return;
      const p = canvas.getScenePoint(e.e as any);
      canvas.remove(preview);
      preview = null;
      const from = start;
      start = null;
      if (Math.hypot(p.x - from.x, p.y - from.y) < MIN_LENGTH) return;

      const { strokeColor, brushWidth, addElement, setActiveTool } = useCanvasStore.getState();
      const elementId = generateId();
      const path = new Path(pathFor(tool, from.x, from.y, p.x, p.y, brushWidth), {
        stroke: strokeColor,
        strokeWidth: brushWidth,
        fill: '',
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
      });
      (path as any).__elementId = elementId;
      canvas.add(path);
      canvas.renderAll();

      const sessionId = session?.id ?? '';
      const element = {
        id: elementId,
        sessionId,
        type: tool,
        position: { x: path.left ?? 0, y: path.top ?? 0 },
        size: { w: path.width ?? 0, h: path.height ?? 0 },
        content: '',
        style: { fill: 'transparent', stroke: strokeColor, strokeWidth: brushWidth, opacity: 1 },
        fabricData: (path.toObject as any)(['__elementId']),
        createdBy: '',
        updatedAt: nowISO(),
      };
      addElement(element);
      if (socket && sessionId) socket.emit(SocketEvents.ADD_ELEMENT, { element });
      setActiveTool('select');
    };

    canvas.on('mouse:down', down as any);
    canvas.on('mouse:move', move as any);
    canvas.on('mouse:up', up as any);
    return () => {
      canvas.off('mouse:down', down as any);
      canvas.off('mouse:move', move as any);
      canvas.off('mouse:up', up as any);
      if (preview) canvas.remove(preview);
      canvas.selection = previous.selection;
      canvas.skipTargetFind = previous.skip;
      canvas.defaultCursor = previous.cursor;
    };
  }, [fabricRef, socket, session, enabled, activeTool]);
}
