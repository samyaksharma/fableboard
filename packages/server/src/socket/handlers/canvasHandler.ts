import { Server, Socket } from 'socket.io';
import { SocketEvents } from '@fableboard/shared';
import type {
  DrawStrokePayload,
  AddElementPayload,
  MoveElementPayload,
  UpdateElementPayload,
  DeleteElementPayload,
  CursorMovePayload,
} from '@fableboard/shared';
import * as canvasStore from '../../store/redisCanvasStore.js';
import { canWrite } from '../helpers/permissions.js';

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
    await canvasStore.updateElementPosition(
      payload.sessionId,
      payload.elementId,
      payload.position,
      payload.fabricData,
      payload.updatedAt,
    );
    socket.to(payload.sessionId).emit(SocketEvents.MOVE_ELEMENT, payload);
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

  socket.on(SocketEvents.DELETE_ELEMENT, async (payload: DeleteElementPayload) => {
    if (!canWrite(socket, payload.sessionId)) {
      socket.emit(SocketEvents.ERROR, { message: 'Permission denied: viewers cannot delete elements' });
      return;
    }
    await canvasStore.deleteElement(payload.sessionId, payload.elementId);
    socket.to(payload.sessionId).emit(SocketEvents.DELETE_ELEMENT, payload);
  });

  socket.on(SocketEvents.CURSOR_MOVE, (payload: CursorMovePayload) => {
    socket.to(payload.sessionId).emit(SocketEvents.CURSOR_MOVE, payload);
  });
}
