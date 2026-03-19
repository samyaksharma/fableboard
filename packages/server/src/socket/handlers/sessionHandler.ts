import { Server, Socket } from 'socket.io';
import { SocketEvents } from '@fableboard/shared';
import * as sessionService from '../../services/sessionService.js';
import * as canvasStore from '../../store/redisCanvasStore.js';
import * as kanbanStore from '../../store/redisKanbanStore.js';

interface JoinPayload {
  sessionId: string;
  participantId: string;
  displayName: string;
  color: string;
}

export function registerSessionHandlers(io: Server, socket: Socket) {
  socket.on(SocketEvents.JOIN_SESSION, async (payload: JoinPayload) => {
    const { sessionId, participantId, displayName, color } = payload;
    socket.join(sessionId);
    (socket as any).__sessionId = sessionId;
    (socket as any).__participantId = participantId;

    console.log(`${displayName} joined session ${sessionId}`);

    // Send full state snapshot for reconnect replay
    const session = sessionService.getSession(sessionId);
    if (session) {
      const elements = await canvasStore.getAllElements(sessionId);
      const cards = await kanbanStore.getAllCards(sessionId);
      const participants = sessionService.getParticipants(sessionId);

      socket.emit(SocketEvents.SESSION_STATE, {
        session,
        elements,
        cards,
        participants,
      });
    }

    socket.to(sessionId).emit(SocketEvents.PARTICIPANT_JOINED, {
      participantId,
      displayName,
      color,
    });
  });

  socket.on('disconnect', () => {
    const sessionId = (socket as any).__sessionId;
    const participantId = (socket as any).__participantId;

    if (sessionId && participantId) {
      socket.to(sessionId).emit(SocketEvents.PARTICIPANT_LEFT, {
        participantId,
      });
      console.log(`Participant ${participantId} left session ${sessionId}`);
    }
  });
}
