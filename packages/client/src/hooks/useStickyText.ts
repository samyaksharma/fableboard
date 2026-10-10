import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import type { Canvas, FabricObject, IText } from 'fabric';
import {
  OTClient,
  computeOps,
  SocketEvents,
  type SessionStatePayload,
  type TextAckPayload,
  type TextOpBroadcast,
  type TextResyncPayload,
} from '@fableboard/shared';
import { useCanvasStore } from '@/stores/canvasStore';
import { useSessionStore } from '@/stores/sessionStore';

function findText(canvas: Canvas, elementId: string): IText | undefined {
  return canvas
    .getObjects()
    .find((o) => (o as any).__elementId === elementId && (o as any).__stickyRole === 'text') as
    | IText
    | undefined;
}

/**
 * Sticky-note text sync: local edits are diffed into OT ops and sent to the
 * server; remote ops are transformed against anything still in flight.
 */
export function useStickyText(fabricRef: React.RefObject<Canvas | null>, socket: Socket | null) {
  const session = useSessionStore((s) => s.session);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !socket || !session) return;

    const clients = new Map<string, OTClient>();
    const getClient = (id: string) => {
      let c = clients.get(id);
      if (!c) {
        const el = useCanvasStore.getState().elements[id];
        c = new OTClient(el?.content ?? '', el?.textVersion ?? 0);
        clients.set(id, c);
      }
      return c;
    };
    const setStoreText = (id: string, text: string, version: number) =>
      useCanvasStore.getState().updateElement(id, { content: text, textVersion: version });
    const send = (elementId: string, batch: { baseVersion: number; ops: unknown[] } | null) => {
      if (batch) socket.emit(SocketEvents.TEXT_OP, { elementId, sessionId: session.id, ...batch });
    };

    const onTextChanged = (e: { target?: FabricObject }) => {
      const obj = e.target as IText | undefined;
      if (!obj || (obj as any).__stickyRole !== 'text') return;
      const id = (obj as any).__elementId as string;
      const client = getClient(id);
      send(id, client.localEdit(obj.text ?? ''));
      setStoreText(id, client.text, client.version);
    };

    // Double-click anywhere on a note to edit it.
    const onDblClick = (e: { target?: FabricObject }) => {
      const role = (e.target as any)?.__stickyRole;
      if (role !== 'bg') return;
      const text = findText(canvas, (e.target as any).__elementId);
      if (!text) return;
      canvas.setActiveObject(text);
      text.enterEditing();
      text.selectAll();
      canvas.renderAll();
    };

    const onState = (p: SessionStatePayload) => {
      clients.clear();
      p.elements.forEach((el) => {
        if (el.type === 'sticky_note') clients.set(el.id, new OTClient(el.content, el.textVersion ?? 0));
      });
    };

    // Move a caret through the edits that turned `before` into `after`.
    const shiftCaret = (caret: number, before: string, after: string) => {
      for (const op of computeOps(before, after)) {
        if (op.type === 'insert' && op.pos <= caret) caret += op.chars.length;
        else if (op.type === 'delete' && op.pos < caret) caret -= Math.min(op.count, caret - op.pos);
      }
      return Math.max(0, Math.min(caret, after.length));
    };

    const setRemoteText = (id: string, text: string) => {
      const obj = findText(canvas, id);
      if (!obj) return;
      const before = obj.text ?? '';
      const caret = shiftCaret(obj.selectionStart ?? 0, before, text);
      obj.set('text', text);
      if (obj.isEditing) {
        // While editing, fabric reads the user's next keystroke from its hidden textarea.
        // If that still holds the old text, the keystroke would silently undo the remote edit.
        const area = (obj as any).hiddenTextarea as HTMLTextAreaElement | undefined;
        if (area) {
          area.value = text;
          area.selectionStart = area.selectionEnd = caret;
        }
        obj.selectionStart = obj.selectionEnd = caret;
      }
      canvas.renderAll();
    };

    const onRemoteOp = (p: TextOpBroadcast) => {
      const client = getClient(p.elementId);
      const text = client.remote(p.ops, p.version);
      setStoreText(p.elementId, text, p.version);
      setRemoteText(p.elementId, text);
    };

    const onAck = (p: TextAckPayload) => send(p.elementId, getClient(p.elementId).ack(p.version));

    const onResync = (p: TextResyncPayload) => {
      clients.set(p.elementId, new OTClient(p.text, p.version));
      setStoreText(p.elementId, p.text, p.version);
      setRemoteText(p.elementId, p.text);
    };

    canvas.on('text:changed', onTextChanged as any);
    canvas.on('mouse:dblclick', onDblClick as any);
    socket.on(SocketEvents.SESSION_STATE, onState);
    socket.on(SocketEvents.TEXT_OP, onRemoteOp);
    socket.on(SocketEvents.TEXT_ACK, onAck);
    socket.on(SocketEvents.TEXT_RESYNC, onResync);
    return () => {
      canvas.off('text:changed', onTextChanged as any);
      canvas.off('mouse:dblclick', onDblClick as any);
      socket.off(SocketEvents.SESSION_STATE, onState);
      socket.off(SocketEvents.TEXT_OP, onRemoteOp);
      socket.off(SocketEvents.TEXT_ACK, onAck);
      socket.off(SocketEvents.TEXT_RESYNC, onResync);
    };
  }, [fabricRef, socket, session]);
}
