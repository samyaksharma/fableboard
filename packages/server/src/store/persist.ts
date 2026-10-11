import { convexEnabled, convexWrite } from '../config/convex.js';

// Moves and text edits can fire many times a second; only the latest value per key
// needs to reach Convex, so writes are debounced per key.
const DELAY_MS = 300;
const pending = new Map<string, { timer: NodeJS.Timeout; fn: string; args: Record<string, unknown> }>();

export function persistLater(key: string, fn: string, args: Record<string, unknown>) {
  if (!convexEnabled) return;
  const existing = pending.get(key);
  if (existing) clearTimeout(existing.timer);
  const timer = setTimeout(() => {
    pending.delete(key);
    convexWrite(fn, args);
  }, DELAY_MS);
  pending.set(key, { timer, fn, args });
}

export function cancelPersist(prefix: string) {
  for (const [key, p] of pending) {
    if (key.startsWith(prefix)) {
      clearTimeout(p.timer);
      pending.delete(key);
    }
  }
}

export function flushPersist() {
  for (const [key, p] of pending) {
    clearTimeout(p.timer);
    pending.delete(key);
    convexWrite(p.fn, p.args);
  }
}
