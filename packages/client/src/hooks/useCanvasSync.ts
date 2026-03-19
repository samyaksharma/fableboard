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
} from '@fableboard/shared';

// Helper to enliven serialized fabric objects into live instances
async function enlivenFromData(data: unknown[]): Promise<FabricObject[]> {
  const { util } = await import('fabric');
  const result = await util.enlivenObjects(data as any[]);
  return result as unknown as FabricObject[];
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

  // Emit local canvas changes to server
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !socket || !session) return;

    const handleObjectModified = (e: { target?: FabricObject }) => {
      const obj = e.target;
      if (!obj || (obj as any).__skipEmit) return;
      const elementId = (obj as any).__elementId;
      if (!elementId) return;

      const payload: MoveElementPayload = {
        elementId,
        sessionId: session.id,
        position: { x: obj.left ?? 0, y: obj.top ?? 0 },
        fabricData: (obj.toObject as any)(['__elementId', '__stickyRole']),
        updatedAt: nowISO(),
      };
      socket.emit(SocketEvents.MOVE_ELEMENT, payload);
      updateElement(elementId, {
        position: payload.position,
        updatedAt: payload.updatedAt,
      });
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
    canvas.on('object:removed', handleObjectRemoved as any);

    return () => {
      canvas.off('object:modified', handleObjectModified as any);
      canvas.off('object:removed', handleObjectRemoved as any);
    };
  }, [fabricRef, socket, session, updateElement, removeElement]);

  // Listen for remote changes and apply to canvas
  useEffect(() => {
    if (!socket || !session) return;
    const canvas = fabricRef.current;
    if (!canvas) return;

    const handleSessionState = (payload: SessionStatePayload) => {
      setElements(payload.elements);
      payload.elements.forEach((el) => {
        const data = el.type === 'sticky_note' ? el.fabricData.bg : el.fabricData;
        enlivenFromData([data]).then((objects) => {
          objects.forEach((obj) => {
            (obj as any).__skipEmit = true;
            (obj as any).__elementId = el.id;
            canvas.add(obj);
            delete (obj as any).__skipEmit;
          });
          if (el.type === 'sticky_note' && el.fabricData.text) {
            enlivenFromData([el.fabricData.text]).then((textObjs) => {
              textObjs.forEach((obj) => {
                (obj as any).__skipEmit = true;
                (obj as any).__elementId = el.id;
                canvas.add(obj);
                delete (obj as any).__skipEmit;
              });
              canvas.renderAll();
            });
          } else {
            canvas.renderAll();
          }
        });
      });
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
      const el = payload.element;
      const dataItems =
        el.type === 'sticky_note'
          ? [el.fabricData.bg, el.fabricData.text].filter(Boolean)
          : [el.fabricData];
      enlivenFromData(dataItems).then((objects) => {
        objects.forEach((obj) => {
          (obj as any).__skipEmit = true;
          (obj as any).__elementId = el.id;
          canvas.add(obj);
          delete (obj as any).__skipEmit;
        });
        canvas.renderAll();
      });
    };

    const handleMoveElement = (payload: MoveElementPayload) => {
      updateElement(payload.elementId, {
        position: payload.position,
        updatedAt: payload.updatedAt,
      });
      const objects = canvas.getObjects();
      objects.forEach((obj) => {
        if ((obj as any).__elementId === payload.elementId) {
          (obj as any).__skipEmit = true;
          obj.set(payload.fabricData as any);
          obj.setCoords();
          delete (obj as any).__skipEmit;
        }
      });
      canvas.renderAll();
    };

    const handleUpdateElement = (payload: UpdateElementPayload) => {
      updateElement(payload.elementId, { updatedAt: payload.updatedAt });
      const objects = canvas.getObjects();
      objects.forEach((obj) => {
        if ((obj as any).__elementId === payload.elementId) {
          (obj as any).__skipEmit = true;
          obj.set(payload.fabricData as any);
          obj.setCoords();
          delete (obj as any).__skipEmit;
        }
      });
      canvas.renderAll();
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
