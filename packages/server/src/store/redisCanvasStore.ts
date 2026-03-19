import { getRedis, isRedisAvailable } from '../config/redis.js';
import type { CanvasElement } from '@fableboard/shared';

// In-memory fallback when Redis is unavailable
const memoryStore = new Map<string, Map<string, CanvasElement>>();

function getSessionElements(sessionId: string): Map<string, CanvasElement> {
  if (!memoryStore.has(sessionId)) {
    memoryStore.set(sessionId, new Map());
  }
  return memoryStore.get(sessionId)!;
}

export async function setElement(
  sessionId: string,
  element: CanvasElement,
): Promise<void> {
  if (isRedisAvailable()) {
    const redis = getRedis();
    await redis.hset(
      `session:${sessionId}:elements`,
      element.id,
      JSON.stringify(element),
    );
  } else {
    getSessionElements(sessionId).set(element.id, element);
  }
}

export async function getElement(
  sessionId: string,
  elementId: string,
): Promise<CanvasElement | null> {
  if (isRedisAvailable()) {
    const redis = getRedis();
    const data = await redis.hget(`session:${sessionId}:elements`, elementId);
    return data ? JSON.parse(data) : null;
  }
  return getSessionElements(sessionId).get(elementId) ?? null;
}

export async function deleteElement(
  sessionId: string,
  elementId: string,
): Promise<void> {
  if (isRedisAvailable()) {
    const redis = getRedis();
    await redis.hdel(`session:${sessionId}:elements`, elementId);
  } else {
    getSessionElements(sessionId).delete(elementId);
  }
}

export async function getAllElements(
  sessionId: string,
): Promise<CanvasElement[]> {
  if (isRedisAvailable()) {
    const redis = getRedis();
    const data = await redis.hgetall(`session:${sessionId}:elements`);
    return Object.values(data).map((v) => JSON.parse(v));
  }
  return Array.from(getSessionElements(sessionId).values());
}

export async function updateElementPosition(
  sessionId: string,
  elementId: string,
  position: { x: number; y: number },
  fabricData: Record<string, unknown>,
  updatedAt: string,
): Promise<CanvasElement | null> {
  const element = await getElement(sessionId, elementId);
  if (!element) return null;

  const updated = { ...element, position, fabricData, updatedAt };
  await setElement(sessionId, updated);
  return updated;
}
