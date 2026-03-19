import { useSessionStore } from '@/stores/sessionStore';

export function ConnectionIndicator() {
  const connected = useSessionStore((s) => s.connected);
  const session = useSessionStore((s) => s.session);
  const participants = useSessionStore((s) => s.participants);

  if (!session) return null;

  return (
    <div className="fixed bottom-3 left-3 flex items-center gap-2 bg-white/90 backdrop-blur rounded-lg shadow px-3 py-1.5 text-xs z-40">
      <span
        className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
      />
      <span className="text-gray-600">
        {connected ? 'Connected' : 'Reconnecting...'}
      </span>
      <span className="text-gray-400">|</span>
      <span className="text-gray-500">
        {participants.length} online
      </span>
      <span className="text-gray-400">|</span>
      <span className="text-gray-400 font-mono" title="Session ID">
        {session.id}
      </span>
    </div>
  );
}
