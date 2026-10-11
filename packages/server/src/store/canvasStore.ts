import { isNewer, type CanvasElement } from '@fableboard/shared';
import { convexEnabled, convexWrite } from '../config/convex.js';
import { persistLater, cancelPersist } from './persist.js';

// In-memory copy per session; Convex is the durable store (see hydrate / persistLater).
const memoryStore = new Map<string, Map<string, CanvasElement>>();

function getSessionElements(sessionId: string): Map<string, CanvasElement> {
  if (!memoryStore.has(sessionId)) {
    memoryStore.set(sessionId, new Map());
  }
  return memoryStore.get(sessionId)!;
}

export function hydrate(sessionId: string, elements: CanvasElement[]) {
  memoryStore.set(sessionId, new Map(elements.map((e) => [e.id, e])));
}

export async function setElement(
  sessionId: string,
  element: CanvasElement,
): Promise<void> {
  getSessionElements(sessionId).set(element.id, element);
  persistLater(`el:${sessionId}:${element.id}`, 'upsertElement', {
    sessionId,
    elementId: element.id,
    doc: JSON.stringify(element),
  });
}

export async function getElement(
  sessionId: string,
  elementId: string,
): Promise<CanvasElement | null> {
  return getSessionElements(sessionId).get(elementId) ?? null;
}

export async function deleteElement(
  sessionId: string,
  elementId: string,
): Promise<void> {
  getSessionElements(sessionId).delete(elementId);
  cancelPersist(`el:${sessionId}:${elementId}`);
  if (convexEnabled) convexWrite('deleteElement', { sessionId, elementId });
}

export async function getAllElements(
  sessionId: string,
): Promise<CanvasElement[]> {
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
  if (!isNewer({ updatedAt }, element)) return element; // LWW: older write loses

  const updated = { ...element, position, fabricData, updatedAt };
  await setElement(sessionId, updated);
  return updated;
}

/** Drop a session from memory and cancel its queued writes (Convex rows are deleted separately). */
export function clearSession(sessionId: string) {
  memoryStore.delete(sessionId);
  cancelPersist(`el:${sessionId}:`);
}
