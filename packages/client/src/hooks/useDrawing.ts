import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import { Canvas, PencilBrush, FabricObject } from 'fabric';
import { useCanvasStore } from '@/stores/canvasStore';
import { useSessionStore } from '@/stores/sessionStore';
import { generateId, nowISO, SocketEvents } from '@fableboard/shared';

export function useDrawing(
  fabricRef: React.RefObject<Canvas | null>,
  socket: Socket | null,
) {
  const activeTool = useCanvasStore((s) => s.activeTool);
  const brushColor = useCanvasStore((s) => s.brushColor);
  const brushWidth = useCanvasStore((s) => s.brushWidth);
  const addElement = useCanvasStore((s) => s.addElement);
  const session = useSessionStore((s) => s.session);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const isDrawing = activeTool === 'draw';
    canvas.isDrawingMode = isDrawing;

    if (isDrawing) {
      const brush = new PencilBrush(canvas);
      brush.color = brushColor;
      brush.width = brushWidth;
      canvas.freeDrawingBrush = brush;
    }
  }, [fabricRef, activeTool, brushColor, brushWidth]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handlePathCreated = (e: { path: FabricObject }) => {
      const path = e.path;
      if (!path) return;

      const elementId = generateId();
      (path as any).__elementId = elementId;

      const fabricData = (path.toObject as any)(['__elementId']);
      const sessionId = session?.id ?? '';
      const element = {
        id: elementId,
        sessionId,
        type: 'path' as const,
        position: { x: path.left ?? 0, y: path.top ?? 0 },
        size: { w: path.width ?? 0, h: path.height ?? 0 },
        content: '',
        style: {
          fill: 'transparent',
          stroke: brushColor,
          strokeWidth: brushWidth,
          opacity: 1,
        },
        fabricData,
        createdBy: '',
        updatedAt: nowISO(),
      };

      addElement(element);

      if (socket && sessionId) {
        socket.emit(SocketEvents.DRAW_STROKE, {
          elementId,
          sessionId,
          fabricData,
          updatedAt: element.updatedAt,
        });
      }
    };

    canvas.on('path:created', handlePathCreated as any);
    return () => {
      canvas.off('path:created', handlePathCreated as any);
    };
  }, [fabricRef, addElement, brushColor, brushWidth, socket, session]);
}
