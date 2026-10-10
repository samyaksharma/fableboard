import { useRef, useEffect } from 'react';
import { Toolbar } from '@/components/canvas/Toolbar';
import { CanvasContainer } from '@/components/canvas/CanvasContainer';
import { KanbanPanel } from '@/components/kanban/KanbanPanel';
import { JoinSession } from '@/components/session/JoinSession';
import { LoginPage } from '@/components/auth/LoginPage';
import { AuthCallback } from '@/components/auth/AuthCallback';
import { ConnectionIndicator } from '@/components/ui/ConnectionIndicator';
import { ToastContainer } from '@/components/ui/Toast';
import { useSocket } from '@/hooks/useSocket';
import { useKanban } from '@/hooks/useKanban';
import { useUIStore } from '@/stores/uiStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useAuthStore } from '@/stores/authStore';

export default function App() {
  const session = useSessionStore((s) => s.session);
  const kanbanOpen = useUIStore((s) => s.kanbanOpen);
  const kanbanRef = useRef<HTMLDivElement>(null);
  const socket = useSocket();
  const { emitAddCard } = useKanban(socket);

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Handle OAuth callback route
  if (window.location.pathname === '/auth/callback') {
    return <AuthCallback />;
  }

  // Not authenticated — show login
  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    );
  }

  // Authenticated but no session — show join/create
  if (!session) {
    return (
      <>
        <JoinSession />
        <ToastContainer />
      </>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden relative">
        <CanvasContainer
          socket={socket}
          kanbanRef={kanbanRef}
          onDropToKanban={(elementId, title, column) => {
            emitAddCard(title, column, elementId);
          }}
        />
        {kanbanOpen && <KanbanPanel socket={socket} kanbanRef={kanbanRef} />}
      </div>
      <ConnectionIndicator />
      <ToastContainer />
    </div>
  );
}
