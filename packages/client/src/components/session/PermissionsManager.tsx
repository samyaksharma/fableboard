import { useSessionStore } from '@/stores/sessionStore';
import { usePermissions } from '@/hooks/usePermissions';
import * as api from '@/services/api';
import type { Role } from '@fableboard/shared';

export function PermissionsManager() {
  const session = useSessionStore((s) => s.session);
  const participants = useSessionStore((s) => s.participants);
  const currentParticipant = useSessionStore((s) => s.currentParticipant);
  const { canManageUsers } = usePermissions();

  if (!canManageUsers || !session) return null;

  const handleRoleChange = async (participantId: string, newRole: Role) => {
    try {
      await api.updateParticipantRole(session.id, participantId, newRole);
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  return (
    <div className="p-4">
      <h3 className="font-semibold text-gray-800 mb-3">Manage Participants</h3>
      <div className="space-y-2">
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded"
          >
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-sm text-gray-700">
                {p.displayName}
                {p.id === currentParticipant?.id && (
                  <span className="text-xs text-gray-400 ml-1">(you)</span>
                )}
              </span>
            </div>
            {p.id !== currentParticipant?.id ? (
              <select
                value={p.role}
                onChange={(e) => handleRoleChange(p.id, e.target.value as Role)}
                className="text-xs border rounded px-2 py-1"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="owner">Owner</option>
              </select>
            ) : (
              <span className="text-xs text-gray-400 capitalize">{p.role}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
