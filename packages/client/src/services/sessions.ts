import type { Participant, Session } from '@fableboard/shared';
import { useSessionStore } from '@/stores/sessionStore';
import { resetWorkspace } from './workspace';
import * as api from './api';

/** Join (or re-join) a session by its code and make it the active board. */
export async function openSession(sessionId: string, displayName: string) {
  const code = sessionId.trim();
  const [data, joined] = await Promise.all([api.getSession(code), api.joinSession(code, displayName)]);
  resetWorkspace();
  const store = useSessionStore.getState();
  store.setSession(data.session as Session);
  store.setCurrentParticipant(joined.participant as Participant);
}

export function inviteLink(sessionId: string): string {
  return `${window.location.origin}/?join=${encodeURIComponent(sessionId)}`;
}
