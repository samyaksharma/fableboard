import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrigin } from '../src/config/url.js';

test('trailing slash is removed (the CORS mismatch that blocked the browser)', () => {
  assert.equal(normalizeOrigin('https://fableboard.vercel.app/'), 'https://fableboard.vercel.app');
  assert.equal(normalizeOrigin('https://fableboard.vercel.app///'), 'https://fableboard.vercel.app');
});

test('bare host gets a scheme: https, or http for localhost', () => {
  assert.equal(normalizeOrigin('fableboard.vercel.app'), 'https://fableboard.vercel.app');
  assert.equal(normalizeOrigin('localhost:5173'), 'http://localhost:5173');
});

test('whitespace is trimmed; empty falls back', () => {
  assert.equal(normalizeOrigin('  https://a.app  '), 'https://a.app');
  assert.equal(normalizeOrigin('', 'http://localhost:5173'), 'http://localhost:5173');
  assert.equal(normalizeOrigin(undefined, 'http://localhost:3001'), 'http://localhost:3001');
});
