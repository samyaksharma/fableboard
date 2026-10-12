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

import { normalizeConvexUrl, cleanEnvValue } from '../src/config/url.js';

test('convex url: every realistic paste mistake normalises to the bare origin', () => {
  const want = 'https://steady-llama-322.convex.cloud';
  for (const raw of [
    want,
    `${want}/`,
    `${want}/api`,
    ` ${want} `,
    `"${want}"`,
    `'${want}'`,
    'steady-llama-322.convex.cloud',
    'http://steady-llama-322.convex.cloud',
    `${want}\n`,
  ]) {
    assert.equal(normalizeConvexUrl(raw), want, JSON.stringify(raw));
  }
  assert.equal(normalizeConvexUrl(''), '');
  assert.equal(normalizeConvexUrl(undefined), '');
});

test('env values: surrounding whitespace and quotes are removed, inner content kept', () => {
  assert.equal(cleanEnvValue('  abc123  '), 'abc123');
  assert.equal(cleanEnvValue('"abc123"'), 'abc123');
  assert.equal(cleanEnvValue('abc"123'), 'abc"123');
  assert.equal(cleanEnvValue(undefined), '');
});
