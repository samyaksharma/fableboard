import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canvasElementSchema, kanbanCardSchema, userSchema } from '../src/index.js';

const element = {
  id: 'e1', sessionId: 's1', type: 'sticky_note', position: { x: 1, y: 2 }, size: { w: 200, h: 150 },
  content: 'hi', style: { fill: '#fff', stroke: '#000', strokeWidth: 1, opacity: 1 },
  fabricData: {}, createdBy: 'u1', updatedAt: '2026-01-01T00:00:00.000Z',
};
const card = {
  id: 'c1', sessionId: 's1', sourceElementId: 'e1', title: 't', description: '', assignee: '',
  column: 'todo', order: 1, updatedAt: '2026-01-01T00:00:00.000Z',
};

test('CanvasElement schema accepts a valid element and rejects bad ones', () => {
  assert.ok(canvasElementSchema.safeParse(element).success);
  assert.ok(!canvasElementSchema.safeParse({ ...element, type: 'hexagon' }).success);
  assert.ok(!canvasElementSchema.safeParse({ ...element, style: { ...element.style, opacity: 2 } }).success);
  assert.ok(!canvasElementSchema.safeParse({ ...element, size: { w: -1, h: 1 } }).success);
});

test('KanbanCard schema validates column and nullable source element', () => {
  assert.ok(kanbanCardSchema.safeParse(card).success);
  assert.ok(kanbanCardSchema.safeParse({ ...card, sourceElementId: null }).success);
  assert.ok(!kanbanCardSchema.safeParse({ ...card, column: 'blocked' }).success);
});

test('exported JSON shape round-trips through the schemas', () => {
  const exported = JSON.parse(JSON.stringify({ elements: [element], cards: [card] }));
  assert.ok(exported.elements.every((e: unknown) => canvasElementSchema.safeParse(e).success));
  assert.ok(exported.cards.every((c: unknown) => kanbanCardSchema.safeParse(c).success));
});

test('guest users (no email) are valid', () => {
  assert.ok(
    userSchema.safeParse({
      id: 'u', email: '', displayName: 'Guest', avatarUrl: '', provider: 'guest',
      providerId: 'x', createdAt: 't',
    }).success,
  );
});
