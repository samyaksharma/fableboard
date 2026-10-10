import { Server, Socket } from 'socket.io';
import { SocketEvents, OTServerDoc } from '@fableboard/shared';
import type {
  DrawStrokePayload,
  AddElementPayload,
  MoveElementPayload,
  UpdateElementPayload,
  DeleteElementPayload,
  CursorMovePayload,
  TextOpPayload,
} from '@fableboard/shared';
import * as canvasStore from '../../store/canvasStore.js';
import { canWrite } from '../helpers/permissions.js';

// Live OT state per sticky note, created lazily from the stored element.
const textDocs = new Map<string, OTServerDoc>();

export function registerCanvasHandlers(io: Server, socket: Socket) {
  socket.on(SocketEvents.DRAW_STROKE, async (payload: DrawStrokePayload) => {
    if (!canWrite(socket, payload.sessionId)) {
      socket.emit(SocketEvents.ERROR, { message: 'Permission denied: viewers cannot draw' });
      return;
    }
    await canvasStore.setElement(payload.sessionId, {
      id: payload.elementId,
      sessionId: payload.sessionId,
      type: 'path',
      position: { x: 0, y: 0 },
      size: { w: 0, h: 0 },
      content: '',
      style: { fill: 'transparent', stroke: '#000', strokeWidth: 2, opacity: 1 },
      fabricData: payload.fabricData,
      createdBy: '',
      updatedAt: payload.updatedAt,
    });
    socket.to(payload.sessionId).emit(SocketEvents.DRAW_STROKE, payload);
  });

  socket.on(SocketEvents.ADD_ELEMENT, async (payload: AddElementPayload) => {
    if (!canWrite(socket, payload.element.sessionId)) {
      socket.emit(SocketEvents.ERROR, { message: 'Permission denied: viewers cannot add elements' });
      return;
    }
    await canvasStore.setElement(payload.element.sessionId, payload.element);
    socket.to(payload.element.sessionId).emit(SocketEvents.ADD_ELEMENT, payload);
  });

  socket.on(SocketEvents.MOVE_ELEMENT, async (payload: MoveElementPayload) => {
    if (!canWrite(socket, payload.sessionId)) {
      socket.emit(SocketEvents.ERROR, { message: 'Permission denied: viewers cannot move elements' });
      return;
    }
    // Sticky-note text is owned by the OT doc; never let a move overwrite it.
    let fabricData = payload.fabricData as Record<string, any>;
    const existing = await canvasStore.getElement(payload.sessionId, payload.elementId);
    if (existing?.type === 'sticky_note' && fabricData.text) {
      fabricData = { ...fabricData, text: { ...fabricData.text, text: existing.content } };
    }
    const result = await canvasStore.updateElementPosition(
      payload.sessionId,
      payload.elementId,
      payload.position,
      fabricData,
      payload.updatedAt,
    );
    if (result && result.updatedAt !== payload.updatedAt) {
      // Lost the LWW race: tell the sender what the server kept.
      socket.emit(SocketEvents.MOVE_ELEMENT, {
        elementId: result.id,
        sessionId: payload.sessionId,
        position: result.position,
        fabricData: result.fabricData,
        updatedAt: result.updatedAt,
      });
      return;
    }
    socket.to(payload.sessionId).emit(SocketEvents.MOVE_ELEMENT, { ...payload, fabricData });
  });

  socket.on(SocketEvents.UPDATE_ELEMENT, async (payload: UpdateElementPayload) => {
    if (!canWrite(socket, payload.sessionId)) {
      socket.emit(SocketEvents.ERROR, { message: 'Permission denied: viewers cannot update elements' });
      return;
    }
    const existing = await canvasStore.getElement(payload.sessionId, payload.elementId);
    if (existing) {
      await canvasStore.setElement(payload.sessionId, {
        ...existing,
        fabricData: payload.fabricData,
        updatedAt: payload.updatedAt,
      });
    }
    socket.to(payload.sessionId).emit(SocketEvents.UPDATE_ELEMENT, payload);
  });

  socket.on(SocketEvents.TEXT_OP, async (payload: TextOpPayload) => {
    const { sessionId, elementId } = payload;
    if (!canWrite(socket, sessionId)) {
      socket.emit(SocketEvents.ERROR, { message: 'Permission denied: viewers cannot edit text' });
      return;
    }
    const element = await canvasStore.getElement(sessionId, elementId);
    if (!element || element.type !== 'sticky_note') return;

    const key = `${sessionId}:${elementId}`;
    let doc = textDocs.get(key);
    if (!doc) {
      doc = new OTServerDoc(element.content, element.textVersion ?? 0);
      textDocs.set(key, doc);
    }

    const result = doc.receive(payload.baseVersion, payload.ops);
    if (!result) {
      socket.emit(SocketEvents.TEXT_RESYNC, { elementId, text: doc.text, version: doc.version });
      return;
    }

    const textData = (element.fabricData as any).text;
    await canvasStore.setElement(sessionId, {
      ...element,
      content: doc.text,
      textVersion: doc.version,
      fabricData: textData
        ? { ...element.fabricData, text: { ...textData, text: doc.text } }
        : element.fabricData,
    });

    socket.emit(SocketEvents.TEXT_ACK, { elementId, version: result.version });
    socket.to(sessionId).emit(SocketEvents.TEXT_OP, {
      elementId,
      ops: result.ops,
      version: result.version,
    });
  });

  socket.on(SocketEvents.DELETE_ELEMENT, async (payload: DeleteElementPayload) => {
    if (!canWrite(socket, payload.sessionId)) {
      socket.emit(SocketEvents.ERROR, { message: 'Permission denied: viewers cannot delete elements' });
      return;
    }
    textDocs.delete(`${payload.sessionId}:${payload.elementId}`);
    await canvasStore.deleteElement(payload.sessionId, payload.elementId);
    socket.to(payload.sessionId).emit(SocketEvents.DELETE_ELEMENT, payload);
  });

  socket.on(SocketEvents.CURSOR_MOVE, (payload: CursorMovePayload) => {
    socket.to(payload.sessionId).emit(SocketEvents.CURSOR_MOVE, payload);
  });
}
