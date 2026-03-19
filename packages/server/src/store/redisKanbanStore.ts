import { getRedis, isRedisAvailable } from '../config/redis.js';
import type { KanbanCard } from '@fableboard/shared';

const memoryStore = new Map<string, Map<string, KanbanCard>>();

function getSessionCards(sessionId: string): Map<string, KanbanCard> {
  if (!memoryStore.has(sessionId)) {
    memoryStore.set(sessionId, new Map());
  }
  return memoryStore.get(sessionId)!;
}

export async function setCard(
  sessionId: string,
  card: KanbanCard,
): Promise<void> {
  if (isRedisAvailable()) {
    const redis = getRedis();
    await redis.hset(
      `session:${sessionId}:cards`,
      card.id,
      JSON.stringify(card),
    );
  } else {
    getSessionCards(sessionId).set(card.id, card);
  }
}

export async function getCard(
  sessionId: string,
  cardId: string,
): Promise<KanbanCard | null> {
  if (isRedisAvailable()) {
    const redis = getRedis();
    const data = await redis.hget(`session:${sessionId}:cards`, cardId);
    return data ? JSON.parse(data) : null;
  }
  return getSessionCards(sessionId).get(cardId) ?? null;
}

export async function deleteCard(
  sessionId: string,
  cardId: string,
): Promise<void> {
  if (isRedisAvailable()) {
    const redis = getRedis();
    await redis.hdel(`session:${sessionId}:cards`, cardId);
  } else {
    getSessionCards(sessionId).delete(cardId);
  }
}

export async function getAllCards(
  sessionId: string,
): Promise<KanbanCard[]> {
  if (isRedisAvailable()) {
    const redis = getRedis();
    const data = await redis.hgetall(`session:${sessionId}:cards`);
    return Object.values(data).map((v) => JSON.parse(v));
  }
  return Array.from(getSessionCards(sessionId).values());
}
