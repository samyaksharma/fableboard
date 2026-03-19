import { useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { Canvas, Rect, Circle, Triangle } from 'fabric';
import { useCanvasStore, ToolType } from '@/stores/canvasStore';
import { useSessionStore } from '@/stores/sessionStore';
import { generateId, nowISO, CANVAS_DEFAULTS, SocketEvents } from '@fableboard/shared';

export function useShapes(
  fabricRef: React.RefObject<Canvas | null>,
  socket: Socket | null,
) {
  const fillColor = useCanvasStore((s) => s.fillColor);
  const strokeColor = useCanvasStore((s) => s.strokeColor);
  const addElement = useCanvasStore((s) => s.addElement);
  const setActiveTool = useCanvasStore((s) => s.setActiveTool);
  const session = useSessionStore((s) => s.session);

  const createShape = useCallback(
    (tool: ToolType, x: number, y: number) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      const elementId = generateId();
      const size = CANVAS_DEFAULTS.SHAPE_SIZE;
      let shape;

      switch (tool) {
        case 'rect':
          shape = new Rect({
            left: x - size / 2,
            top: y - size / 2,
            width: size,
            height: size,
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: 2,
          });
          break;
        case 'circle':
          shape = new Circle({
            left: x - size / 2,
            top: y - size / 2,
            radius: size / 2,
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: 2,
          });
          break;
        case 'triangle':
          shape = new Triangle({
            left: x - size / 2,
            top: y - size / 2,
            width: size,
            height: size,
            fill: fillColor,
            stroke: strokeColor,
            strokeWidth: 2,
          });
          break;
        default:
          return;
      }

      (shape as any).__elementId = elementId;
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();

      const fabricData = (shape.toObject as any)(['__elementId']);
      const sessionId = session?.id ?? '';
      const element = {
        id: elementId,
        sessionId,
        type: tool as any,
        position: { x: shape.left ?? 0, y: shape.top ?? 0 },
        size: { w: shape.width ?? size, h: shape.height ?? size },
        content: '',
        style: {
          fill: fillColor,
          stroke: strokeColor,
          strokeWidth: 2,
          opacity: 1,
        },
        fabricData,
        createdBy: '',
        updatedAt: nowISO(),
      };

      addElement(element);

      if (socket && sessionId) {
        socket.emit(SocketEvents.ADD_ELEMENT, { element });
      }

      setActiveTool('select');
    },
    [fabricRef, fillColor, strokeColor, addElement, setActiveTool, socket, session],
  );

  return { createShape };
}
