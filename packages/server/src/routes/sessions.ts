import { Router, type Router as ExpressRouter } from 'express';
import { createSessionSchema } from '@fableboard/shared';
import { z } from 'zod';
import * as sessionService from '../services/sessionService.js';
import { convexEnabled, convexQuery } from '../config/convex.js';
import * as canvasStore from '../store/canvasStore.js';
import { SocketEvents } from '@fableboard/shared';
import * as kanbanStore from '../store/kanbanStore.js';

const router: ExpressRouter = Router();

// After a restart a session may only exist in Convex: load it before any handler touches it.
router.param('id', async (_req, _res, next, id) => {
  await sessionService.ensureLoaded(id);
  next();
});

router.get('/sessions', async (req, res) => {
  const byId = new Map(sessionService.listForUser(req.user!.userId).map((s) => [s.id, s]));
  if (convexEnabled) {
    try {
      const rows = await convexQuery<Array<{ id: string; title: string; role: string; createdAt: string }>>(
        'listSessionsForUser',
        { userId: req.user!.userId },
      );
      // After a restart only Convex knows older sessions; memory wins for sessions it has.
      for (const row of rows) if (!byId.has(row.id)) byId.set(row.id, row as any);
    } catch (err) {
      console.error('Convex listSessionsForUser failed:', err instanceof Error ? err.message : err);
    }
  }
  const sessions = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ sessions });
});

router.post('/sessions', (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { title, ownerName } = parsed.data;
  const result = sessionService.createSession(title, ownerName, req.user!.userId);
  res.status(201).json(result);
});

router.get('/sessions/:id', (req, res) => {
  const session = sessionService.getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const participants = sessionService.getParticipants(req.params.id);
  res.json({ session, participants });
});

const joinSchema = z.object({
  displayName: z.string().min(1).max(50),
});

router.post('/sessions/:id/join', (req, res) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const participant = sessionService.addParticipant(req.params.id, parsed.data.displayName, req.user!.userId);
  if (!participant) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  res.status(201).json({ participant });
});

router.patch('/sessions/:id/participants/:participantId/role', (req, res) => {
  const { role } = req.body;
  if (!['owner', 'editor', 'viewer'].includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }

  const caller = sessionService.getParticipantByUserId(req.params.id, req.user!.userId);
  if (!caller || caller.role !== 'owner') {
    res.status(403).json({ error: 'Only the session owner can change roles' });
    return;
  }

  const updated = sessionService.updateParticipantRole(
    req.params.id,
    req.params.participantId,
    role,
  );
  if (!updated) {
    res.status(404).json({ error: 'Participant not found' });
    return;
  }

  req.app.get('io')?.to(req.params.id).emit(SocketEvents.PARTICIPANT_UPDATED, { participant: updated });
  res.json({ participant: updated });
});

router.delete('/sessions/:id', async (req, res) => {
  const caller = sessionService.getParticipantByUserId(req.params.id, req.user!.userId);
  if (!sessionService.getSession(req.params.id)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  if (!caller || caller.role !== 'owner') {
    res.status(403).json({ error: 'Only the session owner can delete the session' });
    return;
  }
  await canvasStore.clearSession(req.params.id);
  await kanbanStore.clearSession(req.params.id);
  sessionService.deleteSession(req.params.id);
  const io = req.app.get('io');
  io?.to(req.params.id).emit(SocketEvents.SESSION_DELETED, { sessionId: req.params.id });
  io?.in(req.params.id).socketsLeave(req.params.id);
  res.status(204).end();
});

router.get('/sessions/:id/export/json', async (req, res) => {
  const session = sessionService.getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const caller = sessionService.getParticipantByUserId(req.params.id, req.user!.userId);
  if (!caller || caller.role !== 'owner') {
    res.status(403).json({ error: 'Only the session owner can export' });
    return;
  }

  const elements = await canvasStore.getAllElements(req.params.id);
  const cards = await kanbanStore.getAllCards(req.params.id);
  const participants = sessionService.getParticipants(req.params.id);

  res.json({
    session,
    elements,
    cards,
    participants,
    exportedAt: new Date().toISOString(),
  });
});

export default router;
