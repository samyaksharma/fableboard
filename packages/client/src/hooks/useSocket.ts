import { useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket } from '@/services/socketClient';
import { SocketEvents, type Participant, type SessionStatePayload } from '@fableboard/shared';
import { useSessionStore } from '@/stores/sessionStore';
import { showToast } from '@/components/ui/Toast';

export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);
  const session = useSessionStore((s) => s.session);
  const currentParticipant = useSessionStore((s) => s.currentParticipant);
  const setConnected = useSessionStore((s) => s.setConnected);
  const setParticipants = useSessionStore((s) => s.setParticipants);
  const addParticipant = useSessionStore((s) => s.addParticipant);
  const removeParticipant = useSessionStore((s) => s.removeParticipant);

  useEffect(() => {
    if (!session || !currentParticipant) return;

    const socket = connectSocket();
    setSocket(socket);

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_session', {
        sessionId: session.id,
        participantId: currentParticipant.id,
        displayName: currentParticipant.displayName,
        color: currentParticipant.color,
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    const onUpdated = (p: { participant: Participant }) => {
      addParticipant(p.participant);
      const me = useSessionStore.getState().currentParticipant;
      if (me && me.id === p.participant.id) {
        useSessionStore.getState().setCurrentParticipant(p.participant);
        showToast(`Your role is now ${p.participant.role}`, 'info');
      }
    };
    const onDeleted = () => {
      showToast('The owner deleted this session', 'error');
      useSessionStore.getState().reset();
    };
    const onError = (p: { message: string }) => showToast(p.message, 'error');
    const onState = (p: SessionStatePayload) => setParticipants(p.participants);
    const onJoined = (p: { participant: Participant }) => addParticipant(p.participant);
    const onLeft = (p: { participantId: string }) => removeParticipant(p.participantId);
    socket.on(SocketEvents.SESSION_STATE, onState);
    socket.on(SocketEvents.PARTICIPANT_JOINED, onJoined);
    socket.on(SocketEvents.PARTICIPANT_LEFT, onLeft);
    socket.on(SocketEvents.PARTICIPANT_UPDATED, onUpdated);
    socket.on(SocketEvents.SESSION_DELETED, onDeleted);
    socket.on(SocketEvents.ERROR, onError);

    return () => {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
    };
  }, [session, currentParticipant, setConnected, setParticipants, addParticipant, removeParticipant]);

  return socket;
}
