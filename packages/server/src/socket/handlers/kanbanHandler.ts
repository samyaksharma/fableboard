import { Server, Socket } from 'socket.io';
import { SocketEvents } from '@fableboard/shared';
import type {
  KanbanAddCardPayload,
  KanbanMoveCardPayload,
  KanbanUpdateCardPayload,
  KanbanDeleteCardPayload,
} from '@fableboard/shared';
import * as kanbanStore from '../../store/redisKanbanStore.js';
import { canWrite } from '../helpers/permissions.js';

export function registerKanbanHandlers(io: Server, socket: Socket) {
  socket.on(SocketEvents.KANBAN_ADD_CARD, async (payload: KanbanAddCardPayload) => {
    if (!canWrite(socket, payload.card.sessionId)) {
      socket.emit(SocketEvents.ERROR, { message: 'Permission denied: viewers cannot add cards' });
      return;
    }
    await kanbanStore.setCard(payload.card.sessionId, payload.card);
    socket.to(payload.card.sessionId).emit(SocketEvents.KANBAN_ADD_CARD, payload);
  });

  socket.on(SocketEvents.KANBAN_MOVE_CARD, async (payload: KanbanMoveCardPayload) => {
    if (!canWrite(socket, payload.sessionId)) {
      socket.emit(SocketEvents.ERROR, { message: 'Permission denied: viewers cannot move cards' });
      return;
    }
    const card = await kanbanStore.getCard(payload.sessionId, payload.cardId);
    if (card) {
      await kanbanStore.setCard(payload.sessionId, {
        ...card,
        column: payload.column,
        order: payload.order,
        updatedAt: payload.updatedAt,
      });
    }
    socket.to(payload.sessionId).emit(SocketEvents.KANBAN_MOVE_CARD, payload);
  });

  socket.on(SocketEvents.KANBAN_UPDATE_CARD, async (payload: KanbanUpdateCardPayload) => {
    if (!canWrite(socket, payload.sessionId)) {
      socket.emit(SocketEvents.ERROR, { message: 'Permission denied: viewers cannot update cards' });
      return;
    }
    const card = await kanbanStore.getCard(payload.sessionId, payload.cardId);
    if (card) {
      await kanbanStore.setCard(payload.sessionId, {
        ...card,
        ...(payload.title !== undefined && { title: payload.title }),
        ...(payload.description !== undefined && { description: payload.description }),
        ...(payload.assignee !== undefined && { assignee: payload.assignee }),
        updatedAt: payload.updatedAt,
      });
    }
    socket.to(payload.sessionId).emit(SocketEvents.KANBAN_UPDATE_CARD, payload);
  });

  socket.on(SocketEvents.KANBAN_DELETE_CARD, async (payload: KanbanDeleteCardPayload) => {
    if (!canWrite(socket, payload.sessionId)) {
      socket.emit(SocketEvents.ERROR, { message: 'Permission denied: viewers cannot delete cards' });
      return;
    }
    await kanbanStore.deleteCard(payload.sessionId, payload.cardId);
    socket.to(payload.sessionId).emit(SocketEvents.KANBAN_DELETE_CARD, payload);
  });
}
