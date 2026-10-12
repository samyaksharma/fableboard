import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import type { Canvas, FabricObject } from 'fabric';
import { useCanvasStore } from '@/stores/canvasStore';
import { useSessionStore } from '@/stores/sessionStore';
import {
  SocketEvents,
  nowISO,
  type AddElementPayload,
  type MoveElementPayload,
  type DeleteElementPayload,
  type DrawStrokePayload,
  type UpdateElementPayload,
  type SessionStatePayload,
  type CanvasElement,
} from '@fableboard/shared';

async function enlivenFromData(data: unknown[]): Promise<FabricObject[]> {
  const { util } = await import('fabric');
  const result = await util.enlivenObjects(data as any[]);
  return result as unknown as FabricObject[];
}

// `type` (and a few others) are read-only on live fabric objects.
export function settable(data: Record<string, unknown>) {
  const { type: _t, version: _v, ...rest } = data;
  return rest;
}

export const EXTRA_PROPS = ['__elementId', '__stickyRole'];

export function objectsFor(canvas: Canvas, elementId: string): FabricObject[] {
  return canvas.getObjects().filter((o) => (o as any).__elementId === elementId);
}

export function stickyData(canvas: Canvas, elementId: string) {
  const objs = objectsFor(canvas, elementId);
  const bg = objs.find((o) => (o as any).__stickyRole === 'bg');
  const text = objs.find((o) => (o as any).__stickyRole === 'text');
  return { bg, text };
}

function syncStickyText(canvas: Canvas, elementId: string) {
  const { bg, text } = stickyData(canvas, elementId);
  if (!bg || !text) return;
  text.set({ left: (bg.left ?? 0) + 12, top: (bg.top ?? 0) + 12 });
  text.setCoords();
}

export async function addElementToCanvas(canvas: Canvas, el: CanvasElement) {
  const parts: [string, any][] =
    el.type === 'sticky_note'
      ? [['bg', el.fabricData.bg], ['text', el.fabricData.text]]
      : [['', el.fabricData]];
  for (const [role, data] of parts) {
    if (!data) continue;
    const [obj] = await enlivenFromData([data]);
    (obj as any).__skipEmit = true;
    (obj as any).__elementId = el.id;
    if (role) (obj as any).__stickyRole = role;
    if (role === 'text') {
      obj.set({ lockMovementX: true, lockMovementY: true, hasControls: false });
      (obj as any).set('text', el.content);
    }
    canvas.add(obj);
    delete (obj as any).__skipEmit;
  }
  canvas.renderAll();
}

/** The move_element payload for an element's current on-canvas state (a sticky note is bg + text). */
export function buildMovePayload(
  canvas: Canvas,
  sessionId: string,
  elementId: string,
): MoveElementPayload | null {
  const { bg, text } = stickyData(canvas, elementId);
  const source = bg ?? objectsFor(canvas, elementId)[0];
  if (!source) return null;
  return {
    elementId,
    sessionId,
    position: { x: source.left ?? 0, y: source.top ?? 0 },
    fabricData: bg
      ? {
          bg: (bg.toObject as any)(EXTRA_PROPS),
          text: text ? (text.toObject as any)(EXTRA_PROPS) : undefined,
        }
      : (source.toObject as any)(EXTRA_PROPS),
    updatedAt: nowISO(),
  };
}

export function useCanvasSync(
  fabricRef: React.RefObject<Canvas | null>,
  socket: Socket | null,
) {
  const session = useSessionStore((s) => s.session);
  const addElement = useCanvasStore((s) => s.addElement);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const removeElement = useCanvasStore((s) => s.removeElement);
  const setElements = useCanvasStore((s) => s.setElements);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !socket || !session) return;

    const handleObjectModified = (e: { target?: FabricObject }) => {
      const obj = e.target;
      if (!obj || (obj as any).__skipEmit) return;
      const elementId = (obj as any).__elementId;
      if (!elementId) return;
      if ((obj as any).__stickyRole === 'text') return; // text edits go through OT

      const payload = buildMovePayload(canvas, session.id, elementId);
      if (!payload) return;
      socket.emit(SocketEvents.MOVE_ELEMENT, payload);
      updateElement(elementId, {
        position: payload.position,
        updatedAt: payload.updatedAt,
      });
    };

    const handleObjectMoving = (e: { target?: FabricObject }) => {
      const obj = e.target as any;
      if (obj?.__stickyRole === 'bg') {
        syncStickyText(canvas, obj.__elementId);
      }
    };

    const handleObjectRemoved = (e: { target?: FabricObject }) => {
      const obj = e.target;
      if (!obj || (obj as any).__skipEmit) return;
      const elementId = (obj as any).__elementId;
      if (!elementId) return;

      const payload: DeleteElementPayload = {
        elementId,
        sessionId: session.id,
      };
      socket.emit(SocketEvents.DELETE_ELEMENT, payload);
      removeElement(elementId);
    };

    canvas.on('object:modified', handleObjectModified as any);
    canvas.on('object:moving', handleObjectMoving as any);
    canvas.on('object:removed', handleObjectRemoved as any);

    return () => {
      canvas.off('object:modified', handleObjectModified as any);
      canvas.off('object:moving', handleObjectMoving as any);
      canvas.off('object:removed', handleObjectRemoved as any);
    };
  }, [fabricRef, socket, session, updateElement, removeElement]);

  useEffect(() => {
    if (!socket || !session) return;
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handleSessionState = async (payload: SessionStatePayload) => {
      // Full replay (first join or reconnect): start from a clean canvas.
      canvas.getObjects().forEach((o) => {
        (o as any).__skipEmit = true;
        canvas.remove(o);
      });
      setElements(payload.elements);
      for (const el of payload.elements) await addElementToCanvas(canvas, el);
    };

    const handleDrawStroke = (payload: DrawStrokePayload) => {
      enlivenFromData([payload.fabricData]).then((objects) => {
        objects.forEach((obj) => {
          (obj as any).__skipEmit = true;
          (obj as any).__elementId = payload.elementId;
          canvas.add(obj);
          delete (obj as any).__skipEmit;
        });
        canvas.renderAll();
      });
    };

    const handleAddElement = (payload: AddElementPayload) => {
      addElement(payload.element);
      addElementToCanvas(canvas, payload.element);
    };

    const applyFabricData = (elementId: string, fabricData: Record<string, any>) => {
      const { bg, text } = stickyData(canvas, elementId);
      if (bg) {
        // Sticky note: text content is owned by OT, so never overwrite it here.
        const { text: _ignored, ...textProps } = (fabricData.text ?? {}) as Record<string, unknown>;
        const parts: [FabricObject | undefined, Record<string, unknown> | undefined][] = [
          [bg, fabricData.bg],
          [text, textProps],
        ];
        parts.forEach(([obj, data]) => {
          if (!obj || !data) return;
          (obj as any).__skipEmit = true;
          obj.set(settable(data) as any);
          obj.setCoords();
          delete (obj as any).__skipEmit;
        });
        syncStickyText(canvas, elementId);
      } else {
        objectsFor(canvas, elementId).forEach((obj) => {
          (obj as any).__skipEmit = true;
          obj.set(settable(fabricData) as any);
          obj.setCoords();
          delete (obj as any).__skipEmit;
        });
      }
      canvas.renderAll();
    };

    const handleMoveElement = (payload: MoveElementPayload) => {
      updateElement(payload.elementId, {
        position: payload.position,
        updatedAt: payload.updatedAt,
      });
      applyFabricData(payload.elementId, payload.fabricData);
    };

    const handleUpdateElement = (payload: UpdateElementPayload) => {
      updateElement(payload.elementId, { updatedAt: payload.updatedAt });
      applyFabricData(payload.elementId, payload.fabricData);
    };

    const handleDeleteElement = (payload: DeleteElementPayload) => {
      removeElement(payload.elementId);
      const objects = canvas.getObjects();
      const toRemove = objects.filter(
        (obj) => (obj as any).__elementId === payload.elementId,
      );
      toRemove.forEach((obj) => {
        (obj as any).__skipEmit = true;
        canvas.remove(obj);
      });
      canvas.renderAll();
    };

    socket.on(SocketEvents.SESSION_STATE, handleSessionState);
    socket.on(SocketEvents.DRAW_STROKE, handleDrawStroke);
    socket.on(SocketEvents.ADD_ELEMENT, handleAddElement);
    socket.on(SocketEvents.MOVE_ELEMENT, handleMoveElement);
    socket.on(SocketEvents.UPDATE_ELEMENT, handleUpdateElement);
    socket.on(SocketEvents.DELETE_ELEMENT, handleDeleteElement);

    return () => {
      socket.off(SocketEvents.SESSION_STATE, handleSessionState);
      socket.off(SocketEvents.DRAW_STROKE, handleDrawStroke);
      socket.off(SocketEvents.ADD_ELEMENT, handleAddElement);
      socket.off(SocketEvents.MOVE_ELEMENT, handleMoveElement);
      socket.off(SocketEvents.UPDATE_ELEMENT, handleUpdateElement);
      socket.off(SocketEvents.DELETE_ELEMENT, handleDeleteElement);
    };
  }, [fabricRef, socket, session, addElement, updateElement, removeElement, setElements]);
}
