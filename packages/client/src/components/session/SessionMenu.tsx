import { useEffect, useState } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { showToast } from '@/components/ui/Toast';
import { resetWorkspace } from '@/services/workspace';
import { openSession } from '@/services/sessions';
import * as api from '@/services/api';

const ROLE_STYLE: Record<string, string> = {
  owner: 'bg-amber-50 text-amber-700',
  editor: 'bg-blue-50 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
};

/** Fableboard menu: switch between your sessions or go back to the start screen. */
export function SessionMenu() {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<api.SessionSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const session = useSessionStore((s) => s.session);
  const me = useSessionStore((s) => s.currentParticipant);

  useEffect(() => {
    if (!open) return;
    setSessions(null);
    api
      .listSessions()
      .then((r) => setSessions(r.sessions))
      .catch(() => setSessions([]));
  }, [open]);

  const switchTo = async (id: string) => {
    if (id === session?.id || busy) return;
    setBusy(true);
    try {
      await openSession(id, me?.displayName ?? 'Guest');
      setOpen(false);
    } catch (err: any) {
      showToast(err.message || 'Could not open that session', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative mr-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 font-bold text-lg text-slate-800 hover:text-blue-600"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Fableboard
        <span className="text-xs text-gray-400">&#9662;</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 bg-white rounded-lg shadow-lg border z-50 w-80 max-w-[calc(100vw-1.5rem)]">
          <div className="px-4 py-3 border-b">
            <p className="text-xs text-gray-400">Current session</p>
            <p className="text-sm font-medium text-gray-800 truncate">{session?.title}</p>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Your sessions
            </p>
            {sessions === null && <p className="px-4 py-2 text-sm text-gray-400">Loading...</p>}
            {sessions?.length === 0 && (
              <p className="px-4 py-2 text-sm text-gray-400">No other sessions yet.</p>
            )}
            {sessions?.map((s) => (
              <button
                key={s.id}
                onClick={() => switchTo(s.id)}
                disabled={busy}
                className={`w-full text-left px-4 py-2 flex items-center justify-between gap-2 hover:bg-gray-50 ${
                  s.id === session?.id ? 'bg-blue-50/50' : ''
                }`}
              >
                <span className="text-sm text-gray-700 truncate">
                  {s.title}
                  {s.id === session?.id && <span className="text-xs text-blue-600 ml-1.5">current</span>}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${ROLE_STYLE[s.role] ?? ROLE_STYLE.viewer}`}>
                  {s.role}
                </span>
              </button>
            ))}
          </div>

          <div className="border-t p-2">
            <button
              onClick={() => {
                setOpen(false);
                resetWorkspace();
              }}
              className="w-full text-left px-2 py-2 text-sm text-blue-600 hover:bg-gray-50 rounded"
            >
              + New or join another session
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
