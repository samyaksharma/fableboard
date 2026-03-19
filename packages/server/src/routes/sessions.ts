import { Router } from 'express';
import { createSessionSchema } from '@fableboard/shared';
import { z } from 'zod';
import * as sessionService from '../services/sessionService.js';
import * as canvasStore from '../store/redisCanvasStore.js';
import * as kanbanStore from '../store/redisKanbanStore.js';

const router = Router();

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

  // Only session owner can change roles
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

  res.json({ participant: updated });
});

router.get('/sessions/:id/export/json', async (req, res) => {
  const session = sessionService.getSession(req.params.id);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
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
