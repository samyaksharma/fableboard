import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lwwResolve, isNewer } from '../src/index.js';

test('LWW keeps the newer write', () => {
  const older = { x: 1, updatedAt: '2026-01-01T00:00:00.000Z' };
  const newer = { x: 2, updatedAt: '2026-01-01T00:00:01.000Z' };
  assert.equal(lwwResolve(older, newer), newer);
  assert.equal(lwwResolve(newer, older), newer);
  assert.ok(isNewer(newer, older));
});

test('LWW keeps existing on equal timestamps', () => {
  const a = { x: 1, updatedAt: 't' };
  const b = { x: 2, updatedAt: 't' };
  assert.equal(lwwResolve(a, b), b);
});
