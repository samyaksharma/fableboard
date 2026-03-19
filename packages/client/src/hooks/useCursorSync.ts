import { useEffect, useRef, useCallback, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { useSessionStore } from '@/stores/sessionStore';
import { SocketEvents, type CursorPosition } from '@fableboard/shared';

const THROTTLE_MS = 50;

export function useCursorSync(
  containerRef: React.RefObject<HTMLDivElement | null>,
  socket: Socket | null,
) {
  const session = useSessionStore((s) => s.session);
  const currentParticipant = useSessionStore((s) => s.currentParticipant);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, CursorPosition>>(
    new Map(),
  );
  const lastEmit = useRef(0);

  // Broadcast local cursor
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!socket || !session || !currentParticipant || !containerRef.current) return;

      const now = Date.now();
      if (now - lastEmit.current < THROTTLE_MS) return;
      lastEmit.current = now;

      const rect = containerRef.current.getBoundingClientRect();
      socket.emit(SocketEvents.CURSOR_MOVE, {
        sessionId: session.id,
        cursor: {
          participantId: currentParticipant.id,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          displayName: currentParticipant.displayName,
          color: currentParticipant.color,
        },
      });
    },
    [socket, session, currentParticipant, containerRef],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('mousemove', handleMouseMove);
    return () => container.removeEventListener('mousemove', handleMouseMove);
  }, [containerRef, handleMouseMove]);

  // Listen for remote cursors
  useEffect(() => {
    if (!socket || !currentParticipant) return;

    const handleCursor = (payload: { cursor: CursorPosition }) => {
      if (payload.cursor.participantId === currentParticipant.id) return;
      setRemoteCursors((prev) => {
        const next = new Map(prev);
        next.set(payload.cursor.participantId, payload.cursor);
        return next;
      });
    };

    socket.on(SocketEvents.CURSOR_MOVE, handleCursor);
    return () => {
      socket.off(SocketEvents.CURSOR_MOVE, handleCursor);
    };
  }, [socket, currentParticipant]);

  // Clean stale cursors
  useEffect(() => {
    const interval = setInterval(() => {
      setRemoteCursors((prev) => {
        if (prev.size === 0) return prev;
        return new Map(prev);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return remoteCursors;
}
