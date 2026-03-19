import {
  generateId,
  nowISO,
  getParticipantColor,
  type Session,
  type Participant,
  type Role,
} from '@fableboard/shared';

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
  return participant;
}
