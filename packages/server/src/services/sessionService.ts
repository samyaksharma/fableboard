import {
  generateId,
  nowISO,
  getParticipantColor,
  type Session,
  type Participant,
  type Role,
} from '@fableboard/shared';

import { convexEnabled, convexQuery, convexWrite } from '../config/convex.js';
import * as canvasStore from '../store/canvasStore.js';
import * as kanbanStore from '../store/kanbanStore.js';

const sessions = new Map<string, Session>();
const participants = new Map<string, Participant[]>();

export function createSession(title: string, ownerName: string, userId?: string) {
  const sessionId = generateId();
  const ownerId = generateId();

  const session: Session = {
    id: sessionId,
    title,
    ownerId,
    createdAt: nowISO(),
    permissionsPolicy: { defaultRole: 'editor' },
  };

  const owner: Participant = {
    id: ownerId,
    displayName: ownerName,
    color: getParticipantColor(0),
    role: 'owner',
    sessionId,
    ...(userId && { userId }),
  };

  sessions.set(sessionId, session);
  participants.set(sessionId, [owner]);
  persistSession(session);
  persistParticipant(owner);

  return { session, participant: owner };
}

export function getSession(sessionId: string) {
  return sessions.get(sessionId) ?? null;
}

export function getParticipants(sessionId: string) {
  return participants.get(sessionId) ?? [];
}

export function addParticipant(sessionId: string, name: string, userId?: string): Participant | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const existing = participants.get(sessionId) ?? [];
  // Re-joining as the same user reuses the existing participant (keeps role/colour).
  if (userId) {
    const already = existing.find((p) => p.userId === userId);
    if (already) {
      already.displayName = name;
      persistParticipant(already);
      return already;
    }
  }
  const participant: Participant = {
    id: generateId(),
    displayName: name,
    color: getParticipantColor(existing.length),
    role: session.permissionsPolicy.defaultRole,
    sessionId,
    ...(userId && { userId }),
  };

  existing.push(participant);
  participants.set(sessionId, existing);
  persistParticipant(participant);
  return participant;
}

export function getParticipantByUserId(sessionId: string, userId: string): Participant | null {
  const existing = participants.get(sessionId) ?? [];
  return existing.find((p) => p.userId === userId) ?? null;
}

export function removeParticipant(sessionId: string, participantId: string) {
  const existing = participants.get(sessionId) ?? [];
  participants.set(
    sessionId,
    existing.filter((p) => p.id !== participantId),
  );
}

export function updateParticipantRole(
  sessionId: string,
  participantId: string,
  role: Role,
): Participant | null {
  const existing = participants.get(sessionId) ?? [];
  const participant = existing.find((p) => p.id === participantId);
  if (!participant) return null;

  participant.role = role;
  persistParticipant(participant);
  return participant;
}

export function deleteSession(sessionId: string) {
  sessions.delete(sessionId);
  participants.delete(sessionId);
  canvasStore.clearSession(sessionId);
  kanbanStore.clearSession(sessionId);
  if (convexEnabled) convexWrite('deleteSession', { sessionId });
}

function persistSession(session: Session) {
  if (!convexEnabled) return;
  convexWrite('upsertSession', {
    sessionId: session.id,
    title: session.title,
    ownerId: session.ownerId,
    createdAt: session.createdAt,
    defaultRole: session.permissionsPolicy.defaultRole,
  });
}

function persistParticipant(p: Participant) {
  if (!convexEnabled) return;
  convexWrite('upsertParticipant', {
    sessionId: p.sessionId,
    participantId: p.id,
    displayName: p.displayName,
    color: p.color,
    role: p.role,
    ...(p.userId && { userId: p.userId }),
  });
}

const loading = new Map<string, Promise<boolean>>();

/**
 * Make sure a session is in memory, loading it from Convex after a server restart.
 * Resolves false if the session does not exist. Call before the first sync access.
 */
export function ensureLoaded(sessionId: string): Promise<boolean> {
  if (sessions.has(sessionId)) return Promise.resolve(true);
  if (!convexEnabled) return Promise.resolve(false);

  let inflight = loading.get(sessionId);
  if (!inflight) {
    inflight = convexQuery('loadSession', { sessionId })
      .then((data) => {
        if (!data) return false;
        sessions.set(sessionId, data.session);
        participants.set(sessionId, data.participants);
        canvasStore.hydrate(sessionId, data.elements.map((d: string) => JSON.parse(d)));
        kanbanStore.hydrate(sessionId, data.cards.map((d: string) => JSON.parse(d)));
        return true;
      })
      .catch((err) => {
        console.error('Convex loadSession failed:', err instanceof Error ? err.message : err);
        return false;
      })
      .finally(() => loading.delete(sessionId));
    loading.set(sessionId, inflight);
  }
  return inflight;
}
