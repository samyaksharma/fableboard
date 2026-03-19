import type { Socket } from 'socket.io';
import type { AuthenticatedSocket } from '../index.js';
import * as sessionService from '../../services/sessionService.js';

export function canWrite(socket: Socket, sessionId: string): boolean {
  const user = (socket as AuthenticatedSocket).user;
  if (!user) return false;

  const participant = sessionService.getParticipantByUserId(sessionId, user.userId);
  if (!participant) return false;

  return participant.role === 'owner' || participant.role === 'editor';
}

export function isOwner(socket: Socket, sessionId: string): boolean {
  const user = (socket as AuthenticatedSocket).user;
  if (!user) return false;

  const participant = sessionService.getParticipantByUserId(sessionId, user.userId);
  if (!participant) return false;

  return participant.role === 'owner';
}
