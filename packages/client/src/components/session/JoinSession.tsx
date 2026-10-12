import { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useAuthStore } from '@/stores/authStore';
import { openSession } from '@/services/sessions';
import * as api from '@/services/api';
import type { Session, Participant } from '@fableboard/shared';

const ROLE_STYLE: Record<string, string> = {
  owner: 'bg-amber-50 text-amber-700',
  editor: 'bg-blue-50 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
};

function SessionList({
  title,
  empty,
  sessions,
  onOpen,
  disabled,
}: {
  title: string;
  empty: string;
  sessions: api.SessionSummary[] | null;
  onOpen: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1.5">{title}</h2>
      {sessions === null ? (
        <p className="text-sm text-gray-400 py-2">Loading...</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">{empty}</p>
      ) : (
        <ul className="rounded-lg border divide-y max-h-44 overflow-y-auto">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onOpen(s.id)}
                disabled={disabled}
                className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-gray-50 disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-800 truncate">{s.title}</span>
                  <span className="block text-xs text-gray-400 font-mono truncate">{s.id}</span>
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${ROLE_STYLE[s.role] ?? ROLE_STYLE.viewer}`}>
                  {s.role}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function JoinSession() {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [title, setTitle] = useState('');
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [name, setName] = useState(authUser?.displayName ?? '');
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<api.SessionSummary[] | null>(null);
  const invited = useRef(false);

  const setSession = useSessionStore((s) => s.setSession);
  const setCurrentParticipant = useSessionStore((s) => s.setCurrentParticipant);

  useEffect(() => {
    api
      .listSessions()
      .then((r) => setSessions(r.sessions))
      .catch(() => setSessions([]));
  }, []);

  const open = async (id: string, displayName = name.trim() || authUser?.displayName || 'Guest') => {
    setLoading(true);
    setError('');
    try {
      await openSession(id, displayName);
    } catch (err: any) {
      setError(err.message || 'Failed to open session');
      setLoading(false);
      return false;
    }
    return true;
  };

  // An invite link (/?join=CODE) opens that board straight away once signed in.
  useEffect(() => {
    if (invited.current) return;
    const code = new URLSearchParams(window.location.search).get('join');
    if (!code) return;
    invited.current = true;
    window.history.replaceState({}, '', window.location.pathname);
    setSessionId(code);
    open(code).then((ok) => {
      if (!ok) setMode('join');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.createSession(title.trim(), name.trim());
      setSession(result.session as Session);
      setCurrentParticipant(result.participant as Participant);
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId.trim() || !name.trim()) return;
    await open(sessionId, name.trim());
  };

  const owned = sessions?.filter((s) => s.role === 'owner') ?? null;
  const shared = sessions?.filter((s) => s.role !== 'owner') ?? null;
  const inputClass =
    'w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-5 sm:p-8 w-full max-w-md">
          <div className="flex items-center justify-between mb-4 gap-2">
            <span className="text-sm text-gray-700 font-medium truncate">{authUser?.displayName}</span>
            <button onClick={logout} className="text-xs text-gray-500 hover:text-gray-700 shrink-0 py-1">
              Sign out
            </button>
          </div>

          <h1 className="text-2xl font-bold text-gray-800 text-center mb-1">Fableboard</h1>
          <p className="text-sm text-gray-500 text-center mb-5">Sketch it. Sync it. Ship it.</p>

          {error && <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded mb-4">{error}</div>}

          {mode === 'choose' && (
            <div className="space-y-5">
              <SessionList
                title="Your boards"
                empty="You haven't created a board yet."
                sessions={owned}
                onOpen={(id) => open(id)}
                disabled={loading}
              />
              <SessionList
                title="Shared with you"
                empty="Boards you join with a code appear here."
                sessions={shared}
                onOpen={(id) => open(id)}
                disabled={loading}
              />
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => setMode('create')}
                  className="py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
                >
                  New board
                </button>
                <button
                  onClick={() => setMode('join')}
                  className="py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Join with code
                </button>
              </div>
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Session title"
                className={inputClass}
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your display name"
                className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('choose')}
                  className="flex-1 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={handleJoin} className="space-y-4">
              <input
                autoFocus
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                placeholder="Session code"
                autoCapitalize="off"
                autoCorrect="off"
                className={inputClass}
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your display name"
                className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('choose')}
                  className="flex-1 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? 'Joining...' : 'Join'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
