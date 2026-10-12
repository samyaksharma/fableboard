import { useState } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import { usePermissions } from '@/hooks/usePermissions';
import { PermissionsManager } from './PermissionsManager';
import { showToast } from '@/components/ui/Toast';
import { useAuthStore } from '@/stores/authStore';
import { resetWorkspace } from '@/services/workspace';
import { inviteLink } from '@/services/sessions';
import * as api from '@/services/api';

export function PeopleMenu() {
  const [open, setOpen] = useState(false);
  const session = useSessionStore((s) => s.session);
  const participants = useSessionStore((s) => s.participants);
  const logout = useAuthStore((s) => s.logout);
  const { canManageUsers, canDeleteSession, role } = usePermissions();

  if (!session) return null;

  const copyId = () => {
    navigator.clipboard?.writeText(session.id).then(
      () => showToast('Session ID copied', 'success'),
      () => showToast(session.id, 'info'),
    );
  };

  const copyInvite = () => {
    navigator.clipboard?.writeText(inviteLink(session.id)).then(
      () => showToast('Invite link copied', 'success'),
      () => showToast(inviteLink(session.id), 'info'),
    );
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this session for everyone? This cannot be undone.')) return;
    try {
      await api.deleteSession(session.id);
      resetWorkspace();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete session', 'error');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-2 sm:px-3 py-1.5 rounded text-xs sm:text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
      >
        People<span className="hidden sm:inline"> ({participants.length})</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border z-50 w-72 max-w-[calc(100vw-1.5rem)]">
          <div className="p-3 border-b flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs text-gray-400">Session code (share to invite)</p>
              <p className="text-sm font-mono truncate">{session.id}</p>
            </div>
            <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
              <button onClick={copyInvite} className="text-xs text-blue-600 hover:underline">
                Copy invite link
              </button>
              <button onClick={copyId} className="text-xs text-gray-500 hover:underline">
                Copy code
              </button>
            </div>
          </div>
          {canManageUsers ? (
            <PermissionsManager />
          ) : (
            <ul className="p-3 space-y-1">
              {participants.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.displayName}
                  <span className="text-xs text-gray-400 ml-auto">{p.role}</span>
                </li>
              ))}
            </ul>
          )}
          {canDeleteSession && (
            <div className="p-3 border-t">
              <button onClick={handleDelete} className="text-xs text-red-600 hover:underline">
                Delete session
              </button>
            </div>
          )}
          <div className="p-3 border-t">
            <button
              onClick={() => {
                resetWorkspace();
                logout();
              }}
              className="text-xs text-gray-600 hover:underline"
            >
              Sign out
            </button>
          </div>
          {role === 'viewer' && (
            <p className="px-3 pb-3 text-xs text-gray-400">You have view-only access.</p>
          )}
        </div>
      )}
    </div>
  );
}
