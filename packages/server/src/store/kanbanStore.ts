import type { KanbanCard } from '@fableboard/shared';
import { convexEnabled, convexWrite } from '../config/convex.js';
import { persistLater, cancelPersist } from './persist.js';

// In-memory copy per session; Convex is the durable store (see hydrate / persistLater).
const memoryStore = new Map<string, Map<string, KanbanCard>>();

function getSessionCards(sessionId: string): Map<string, KanbanCard> {
  if (!memoryStore.has(sessionId)) {
    memoryStore.set(sessionId, new Map());
  }
  return memoryStore.get(sessionId)!;
}

export function hydrate(sessionId: string, cards: KanbanCard[]) {
  memoryStore.set(sessionId, new Map(cards.map((c) => [c.id, c])));
}

export async function setCard(
  sessionId: string,
  card: KanbanCard,
): Promise<void> {
  getSessionCards(sessionId).set(card.id, card);
  persistLater(`card:${sessionId}:${card.id}`, 'upsertCard', {
    sessionId,
    cardId: card.id,
    doc: JSON.stringify(card),
  });
}

export async function getCard(
  sessionId: string,
  cardId: string,
): Promise<KanbanCard | null> {
  return getSessionCards(sessionId).get(cardId) ?? null;
}

export async function deleteCard(
  sessionId: string,
  cardId: string,
): Promise<void> {
  getSessionCards(sessionId).delete(cardId);
  cancelPersist(`card:${sessionId}:${cardId}`);
  if (convexEnabled) convexWrite('deleteCard', { sessionId, cardId });
}

export async function getAllCards(
  sessionId: string,
): Promise<KanbanCard[]> {
  return Array.from(getSessionCards(sessionId).values());
}

/** Drop a session from memory and cancel its queued writes (Convex rows are deleted separately). */
export function clearSession(sessionId: string) {
  memoryStore.delete(sessionId);
  cancelPersist(`card:${sessionId}:`);
}
