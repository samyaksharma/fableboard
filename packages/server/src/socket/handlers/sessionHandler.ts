import { Server, Socket } from 'socket.io';
import { SocketEvents } from '@fableboard/shared';
import * as sessionService from '../../services/sessionService.js';
import * as canvasStore from '../../store/canvasStore.js';
import * as kanbanStore from '../../store/kanbanStore.js';

interface JoinPayload {
  sessionId: string;
  participantId: string;
  displayName: string;
  color: string;
}

export function registerSessionHandlers(io: Server, socket: Socket) {
  socket.on(SocketEvents.JOIN_SESSION, async (payload: JoinPayload) => {
    const { sessionId, participantId, displayName, color } = payload;
    await sessionService.ensureLoaded(sessionId);
    socket.join(sessionId);
    (socket as any).__sessionId = sessionId;
    (socket as any).__participantId = participantId;

    console.log(`${displayName} joined session ${sessionId}`);

    // Send full state snapshot for reconnect replay
    const session = sessionService.getSession(sessionId);
    if (session) {
      const elements = await canvasStore.getAllElements(sessionId);
      const cards = await kanbanStore.getAllCards(sessionId);
      const onlineIds = new Set(
        (await io.in(sessionId).fetchSockets()).map((s) => (s as any).__participantId),
      );
      const participants = sessionService
        .getParticipants(sessionId)
        .filter((p) => onlineIds.has(p.id));

      socket.emit(SocketEvents.SESSION_STATE, {
        session,
        elements,
        cards,
        participants,
      });
    }

    const participant = sessionService
      .getParticipants(sessionId)
      .find((p) => p.id === participantId);
    if (participant) {
      socket.to(sessionId).emit(SocketEvents.PARTICIPANT_JOINED, { participant });
    }
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
