import { useState } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { useAuthStore } from '@/stores/authStore';
import * as api from '@/services/api';
import type { Session, Participant } from '@fableboard/shared';

export function JoinSession() {
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [title, setTitle] = useState('');
  const authUser = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [name, setName] = useState(authUser?.displayName ?? '');
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const setSession = useSessionStore((s) => s.setSession);
  const setCurrentParticipant = useSessionStore((s) => s.setCurrentParticipant);

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
    setLoading(true);
    setError('');
    try {
      const sessionData = await api.getSession(sessionId.trim());
      const joinResult = await api.joinSession(sessionId.trim(), name.trim());
      setSession(sessionData.session as Session);
      setCurrentParticipant(joinResult.participant as Participant);
    } catch (err: any) {
      setError(err.message || 'Failed to join session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-xl shadow-lg p-8 w-96">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {authUser?.avatarUrl && (
              <img
                src={authUser.avatarUrl}
                alt=""
                className="w-8 h-8 rounded-full"
              />
            )}
            <span className="text-sm text-gray-700 font-medium truncate max-w-[180px]">
              {authUser?.displayName}
            </span>
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 text-center mb-1">Fableboard</h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Sketch it. Sync it. Ship it.
        </p>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded mb-4">
            {error}
          </div>
        )}

        {mode === 'choose' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('create')}
              className="w-full py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              Create New Session
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Join Existing Session
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} className="space-y-4">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title"
              className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
              className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
              placeholder="Session ID"
              className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your display name"
              className="w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
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
  );
}
