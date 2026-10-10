import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useKanbanStore } from '../src/stores/kanbanStore.js';
import type { KanbanCard } from '@fableboard/shared';

const mk = (id: string, column: KanbanCard['column'], order: number): KanbanCard => ({
  id, sessionId: 's', sourceElementId: null, title: id, description: '', assignee: '',
  column, order, updatedAt: '2026-01-01T00:00:00.000Z',
});

beforeEach(() => useKanbanStore.getState().setCards([]));

test('card moves todo -> in_progress -> done and keeps its data', () => {
  const s = useKanbanStore.getState();
  s.addCard(mk('a', 'todo', 1));
  s.moveCard('a', 'in_progress', 2);
  assert.equal(useKanbanStore.getState().cards.a.column, 'in_progress');
  s.moveCard('a', 'done', 3);
  const c = useKanbanStore.getState().cards.a;
  assert.deepEqual([c.column, c.order, c.title], ['done', 3, 'a']);
});

test('getCardsByColumn filters and orders', () => {
  const s = useKanbanStore.getState();
  s.setCards([mk('b', 'todo', 2), mk('a', 'todo', 1), mk('c', 'done', 1)]);
  assert.deepEqual(useKanbanStore.getState().getCardsByColumn('todo').map((c) => c.id), ['a', 'b']);
  assert.deepEqual(useKanbanStore.getState().getCardsByColumn('done').map((c) => c.id), ['c']);
});

test('moving or updating an unknown card is a no-op; delete removes', () => {
  const s = useKanbanStore.getState();
  s.moveCard('ghost', 'done', 1);
  s.updateCard('ghost', { title: 'x' });
  assert.deepEqual(useKanbanStore.getState().cards, {});
  s.addCard(mk('a', 'todo', 1));
  s.removeCard('a');
  assert.deepEqual(useKanbanStore.getState().cards, {});
});
