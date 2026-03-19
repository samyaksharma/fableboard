import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { connectSocket, disconnectSocket } from '@/services/socketClient';
import { useSessionStore } from '@/stores/sessionStore';

export function useSocket(): Socket | null {
  const socketRef = useRef<Socket | null>(null);
  const session = useSessionStore((s) => s.session);
  const currentParticipant = useSessionStore((s) => s.currentParticipant);
  const setConnected = useSessionStore((s) => s.setConnected);

  useEffect(() => {
    if (!session || !currentParticipant) return;

    const socket = connectSocket();
    socketRef.current = socket;

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

    return () => {
      disconnectSocket();
      socketRef.current = null;
      setConnected(false);
    };
  }, [session, currentParticipant, setConnected]);

  return socketRef.current;
}
