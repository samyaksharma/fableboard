import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeServerUrl } from '../src/services/serverUrl.js';

test('a bare host gets https:// (the bug: it was treated as a relative path)', () => {
  assert.equal(
    normalizeServerUrl('fableboard-production.up.railway.app'),
    'https://fableboard-production.up.railway.app',
  );
});

test('a complete URL is left alone; trailing slash and /api are stripped', () => {
  assert.equal(normalizeServerUrl('https://x.up.railway.app'), 'https://x.up.railway.app');
  assert.equal(normalizeServerUrl('https://x.up.railway.app/'), 'https://x.up.railway.app');
  assert.equal(normalizeServerUrl('https://x.up.railway.app/api'), 'https://x.up.railway.app');
  assert.equal(normalizeServerUrl('x.up.railway.app/api/'), 'https://x.up.railway.app');
});

test('http is kept for local use; empty/undefined mean same-origin', () => {
  assert.equal(normalizeServerUrl('http://localhost:3001'), 'http://localhost:3001');
  assert.equal(normalizeServerUrl(''), '');
  assert.equal(normalizeServerUrl(undefined), '');
  assert.equal(normalizeServerUrl('   '), '');
});
