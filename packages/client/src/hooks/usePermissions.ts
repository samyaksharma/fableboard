import { useMemo } from 'react';
import { useSessionStore } from '@/stores/sessionStore';
import type { Role } from '@fableboard/shared';

interface Permissions {
  canDraw: boolean;
  canAddElements: boolean;
  canMoveElements: boolean;
  canDeleteElements: boolean;
  canManageCards: boolean;
  canExport: boolean;
  canManageUsers: boolean;
  canDeleteSession: boolean;
  role: Role | null;
}

const ROLE_PERMISSIONS: Record<Role, Omit<Permissions, 'role'>> = {
  viewer: {
    canDraw: false,
    canAddElements: false,
    canMoveElements: false,
    canDeleteElements: false,
    canManageCards: false,
    canExport: false,
    canManageUsers: false,
    canDeleteSession: false,
  },
  editor: {
    canDraw: true,
    canAddElements: true,
    canMoveElements: true,
    canDeleteElements: true,
    canManageCards: true,
    canExport: false,
    canManageUsers: false,
    canDeleteSession: false,
  },
  owner: {
    canDraw: true,
    canAddElements: true,
    canMoveElements: true,
    canDeleteElements: true,
    canManageCards: true,
    canExport: true,
    canManageUsers: true,
    canDeleteSession: true,
  },
};

export function usePermissions(): Permissions {
  const participant = useSessionStore((s) => s.currentParticipant);

  return useMemo(() => {
    const role = participant?.role as Role | undefined;
    if (!role) {
      return { ...ROLE_PERMISSIONS.viewer, role: null };
    }
    return { ...ROLE_PERMISSIONS[role], role };
  }, [participant]);
}
