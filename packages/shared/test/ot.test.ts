import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOperation, applyOperations, computeOps, transformOps, OTClient, OTServerDoc, type OTOp,
} from '../src/index.js';

const ins = (pos: number, chars: string): OTOp => ({ type: 'insert', pos, chars });
const del = (pos: number, count: number): OTOp => ({ type: 'delete', pos, count });

test('applyOperation inserts and deletes', () => {
  assert.equal(applyOperation('abc', ins(1, 'XY')), 'aXYbc');
  assert.equal(applyOperation('abcdef', del(1, 3)), 'aef');
});

test('computeOps produces ops that rebuild the new text', () => {
  const cases: [string, string][] = [
    ['', 'hello'], ['hello', ''], ['hello', 'help'], ['abc', 'aXc'], ['aaa', 'aaaa'], ['Note...', 'Fix login'],
  ];
  for (const [a, b] of cases) assert.equal(applyOperations(a, computeOps(a, b)), b);
});

test('same-position inserts converge with a consistent tie-break', () => {
  const [a2, b2] = transformOps([ins(1, 'A')], [ins(1, 'B')], true);
  const viaA = applyOperations(applyOperations('xy', [ins(1, 'A')]), b2);
  const viaB = applyOperations(applyOperations('xy', [ins(1, 'B')]), a2);
  assert.equal(viaA, viaB);
  assert.equal(viaA, 'xABy');
});

test('insert inside a concurrent delete range converges and keeps the insert', () => {
  const doc = 'abcdef';
  const a = [del(1, 4)];
  const b = [ins(3, 'Z')];
  const [a2, b2] = transformOps(a, b, true);
  const left = applyOperations(applyOperations(doc, a), b2);
  const right = applyOperations(applyOperations(doc, b), a2);
  assert.equal(left, right);
  assert.equal(left, 'aZf');
});

test('overlapping deletes converge', () => {
  const doc = 'abcdefgh';
  const [a2, b2] = transformOps([del(1, 4)], [del(3, 4)], false);
  assert.equal(
    applyOperations(applyOperations(doc, [del(1, 4)]), b2),
    applyOperations(applyOperations(doc, [del(3, 4)]), a2),
  );
  assert.equal(applyOperations(applyOperations(doc, [del(1, 4)]), b2), 'ah');
});

test('randomised concurrent edits always converge', () => {
  let seed = 42;
  const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
  const randOps = (text: string): OTOp[] => {
    const ops: OTOp[] = [];
    let cur = text;
    for (let i = 0; i < 1 + rnd(3); i++) {
      const op: OTOp =
        cur.length === 0 || rnd(2)
          ? ins(rnd(cur.length + 1), 'abc'.slice(0, 1 + rnd(3)))
          : del(rnd(cur.length), 1 + rnd(2));
      if (op.type === 'delete') op.count = Math.min(op.count, cur.length - op.pos);
      ops.push(op);
      cur = applyOperation(cur, op);
    }
    return ops;
  };
  for (let i = 0; i < 500; i++) {
    const doc = 'hello world'.slice(0, rnd(12));
    const a = randOps(doc), b = randOps(doc);
    const [a2, b2] = transformOps(a, b, true);
    assert.equal(
      applyOperations(applyOperations(doc, a), b2),
      applyOperations(applyOperations(doc, b), a2),
    );
  }
});

test('two clients + server converge on concurrent typing', () => {
  const server = new OTServerDoc('Note', 0);
  const a = new OTClient('Note', 0);
  const b = new OTClient('Note', 0);

  const sendA = a.localEdit('Note A');
  const sendB = b.localEdit('My Note');
  // Server receives A first, then B
  const accA = server.receive(sendA!.baseVersion, sendA!.ops)!;
  const accB = server.receive(sendB!.baseVersion, sendB!.ops)!;
  // Deliver: A gets ack(1) then B's op; B gets A's op then ack(2)
  a.ack(accA.version);
  a.remote(accB.ops, accB.version);
  b.remote(accA.ops, accA.version);
  b.ack(accB.version);

  assert.equal(a.text, server.text);
  assert.equal(b.text, server.text);
  assert.equal(server.text, 'My Note A');
});

test('buffered edits while one batch is in flight still converge', () => {
  const server = new OTServerDoc('', 0);
  const a = new OTClient('', 0);
  const b = new OTClient('', 0);
  const first = a.localEdit('h')!;
  assert.equal(a.localEdit('hi'), null); // buffered
  const bSend = b.localEdit('yo')!;

  const r1 = server.receive(first.baseVersion, first.ops)!;
  const r2 = server.receive(bSend.baseVersion, bSend.ops)!;
  const next = a.ack(r1.version)!; // flushes buffer
  a.remote(r2.ops, r2.version);
  const r3 = server.receive(next.baseVersion + 0, next.ops);
  // next.baseVersion was r1.version (1) but the server is at 2: it must transform over r2
  assert.ok(r3);
  b.remote(r1.ops, r1.version);
  b.ack(r2.version);
  b.remote(r3!.ops, r3!.version);
  a.ack(r3!.version);
  assert.equal(a.text, server.text);
  assert.equal(b.text, server.text);
});

test('server asks for resync on unknown base version', () => {
  const server = new OTServerDoc('x', 5);
  assert.equal(server.receive(1, [ins(0, 'a')]), null);
});
