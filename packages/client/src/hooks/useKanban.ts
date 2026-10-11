import { useEffect, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { useKanbanStore } from '@/stores/kanbanStore';
import { useSessionStore } from '@/stores/sessionStore';
import {
  SocketEvents,
  generateId,
  nowISO,
  type KanbanCard,
  type KanbanColumn,
  type KanbanAddCardPayload,
  type KanbanMoveCardPayload,
  type KanbanUpdateCardPayload,
  type KanbanDeleteCardPayload,
  type SessionStatePayload,
} from '@fableboard/shared';

export function useKanban(socket: Socket | null) {
  const session = useSessionStore((s) => s.session);
  const addCard = useKanbanStore((s) => s.addCard);
  const updateCard = useKanbanStore((s) => s.updateCard);
  const moveCard = useKanbanStore((s) => s.moveCard);
  const removeCard = useKanbanStore((s) => s.removeCard);
  const setCards = useKanbanStore((s) => s.setCards);

  useEffect(() => {
    if (!socket) return;

    const handleAdd = (payload: KanbanAddCardPayload) => {
      addCard(payload.card);
    };
    const handleMove = (payload: KanbanMoveCardPayload) => {
      moveCard(payload.cardId, payload.column, payload.order);
    };
    const handleUpdate = (payload: KanbanUpdateCardPayload) => {
      updateCard(payload.cardId, {
        ...(payload.title !== undefined && { title: payload.title }),
        ...(payload.description !== undefined && { description: payload.description }),
        ...(payload.assignee !== undefined && { assignee: payload.assignee }),
        updatedAt: payload.updatedAt,
      });
    };
    const handleDelete = (payload: KanbanDeleteCardPayload) => {
      removeCard(payload.cardId);
    };

    const handleState = (payload: SessionStatePayload) => setCards(payload.cards);

    socket.on(SocketEvents.SESSION_STATE, handleState);
    socket.on(SocketEvents.KANBAN_ADD_CARD, handleAdd);
    socket.on(SocketEvents.KANBAN_MOVE_CARD, handleMove);
    socket.on(SocketEvents.KANBAN_UPDATE_CARD, handleUpdate);
    socket.on(SocketEvents.KANBAN_DELETE_CARD, handleDelete);

    return () => {
      socket.off(SocketEvents.SESSION_STATE, handleState);
      socket.off(SocketEvents.KANBAN_ADD_CARD, handleAdd);
      socket.off(SocketEvents.KANBAN_MOVE_CARD, handleMove);
      socket.off(SocketEvents.KANBAN_UPDATE_CARD, handleUpdate);
      socket.off(SocketEvents.KANBAN_DELETE_CARD, handleDelete);
    };
  }, [socket, addCard, updateCard, moveCard, removeCard, setCards]);

  const emitAddCard = useCallback(
    (
      title: string,
      column: KanbanColumn = 'todo',
      sourceElementId: string | null = null,
      snapshot?: string,
    ) => {
      if (!session) return null;
      const card: KanbanCard = {
        id: generateId(),
        sessionId: session.id,
        sourceElementId,
        title,
        description: '',
        assignee: '',
        column,
        order: Date.now(),
        ...(snapshot && { snapshot }),
        updatedAt: nowISO(),
      };
      addCard(card);
      socket?.emit(SocketEvents.KANBAN_ADD_CARD, { card });
      return card;
    },
    [socket, session, addCard],
  );

  const emitMoveCard = useCallback(
    (cardId: string, column: KanbanColumn, order: number) => {
      if (!session) return;
      moveCard(cardId, column, order);
      socket?.emit(SocketEvents.KANBAN_MOVE_CARD, {
        cardId,
        sessionId: session.id,
        column,
        order,
        updatedAt: nowISO(),
      });
    },
    [socket, session, moveCard],
  );

  const emitUpdateCard = useCallback(
    (cardId: string, updates: { title?: string; description?: string; assignee?: string }) => {
      if (!session) return;
      const updatedAt = nowISO();
      updateCard(cardId, { ...updates, updatedAt });
      socket?.emit(SocketEvents.KANBAN_UPDATE_CARD, {
        cardId,
        sessionId: session.id,
        ...updates,
        updatedAt,
      });
    },
    [socket, session, updateCard],
  );

  const emitDeleteCard = useCallback(
    (cardId: string) => {
      if (!session) return;
      removeCard(cardId);
      socket?.emit(SocketEvents.KANBAN_DELETE_CARD, {
        cardId,
        sessionId: session.id,
      });
    },
    [socket, session, removeCard],
  );

  return { emitAddCard, emitMoveCard, emitUpdateCard, emitDeleteCard };
}
