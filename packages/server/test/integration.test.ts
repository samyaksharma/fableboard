import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import { io as connect, type Socket } from 'socket.io-client';
import { SocketEvents, OTClient, nowISO, type CanvasElement, type KanbanCard } from '@fableboard/shared';
import { createSocketServer } from '../src/socket/index.js';
import * as authService from '../src/services/authService.js';
import * as sessionService from '../src/services/sessionService.js';

let http: HttpServer;
let url: string;
const open: Socket[] = [];

before(async () => {
  http = createServer();
  createSocketServer(http);
  await new Promise<void>((r) => http.listen(0, r));
  url = `http://localhost:${(http.address() as AddressInfo).port}`;
});

after(async () => {
  open.forEach((s) => s.disconnect());
  await new Promise((r) => http.close(r));
});

const once = <T = any>(s: Socket, ev: string) => new Promise<T>((r) => s.once(ev, r));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function makeUser(name: string) {
  return authService.findOrCreateUser({
    email: '', displayName: name, avatarUrl: '', provider: 'guest', providerId: `${name}-${Math.random()}`,
  });
}

async function join(sessionId: string, user: Awaited<ReturnType<typeof makeUser>>, participantId: string, name: string) {
  const s = connect(url, { auth: { token: authService.signToken(user) }, transports: ['websocket'] });
  open.push(s);
  await once(s, 'connect');
  const state = once(s, SocketEvents.SESSION_STATE);
  s.emit(SocketEvents.JOIN_SESSION, { sessionId, participantId, displayName: name, color: '#000' });
  return { socket: s, state: await state };
}

async function setup() {
  const [ua, ub, uv] = await Promise.all([makeUser('A'), makeUser('B'), makeUser('V')]);
  const { session, participant: pa } = sessionService.createSession('t', 'A', ua.id);
  const pb = sessionService.addParticipant(session.id, 'B', ub.id)!;
  const pv = sessionService.addParticipant(session.id, 'V', uv.id)!;
  sessionService.updateParticipantRole(session.id, pv.id, 'viewer');
  const a = await join(session.id, ua, pa.id, 'A');
  const b = await join(session.id, ub, pb.id, 'B');
  const v = await join(session.id, uv, pv.id, 'V');
  return { sid: session.id, a: a.socket, b: b.socket, v: v.socket, ua, pa, pb, pv };
}

const rect = (sid: string, id = 'r1', updatedAt = nowISO()): CanvasElement => ({
  id, sessionId: sid, type: 'rect', position: { x: 10, y: 10 }, size: { w: 50, h: 50 }, content: '',
  style: { fill: 'transparent', stroke: '#000', strokeWidth: 1, opacity: 1 },
  fabricData: { type: 'Rect', left: 10, top: 10 }, createdBy: '', updatedAt,
});

const sticky = (sid: string, id: string, content: string): CanvasElement => ({
  ...rect(sid, id), type: 'sticky_note', content,
  fabricData: { bg: { left: 0, top: 0 }, text: { text: content } },
});

test('multi-client sync: editor adds element, others receive it; viewer is rejected', async () => {
  const { sid, a, b, v } = await setup();
  const got = once(b, SocketEvents.ADD_ELEMENT);
  a.emit(SocketEvents.ADD_ELEMENT, { element: rect(sid) });
  assert.equal((await got).element.id, 'r1');

  const err = once(v, SocketEvents.ERROR);
  let leaked = false;
  a.once(SocketEvents.ADD_ELEMENT, () => (leaked = true));
  v.emit(SocketEvents.ADD_ELEMENT, { element: rect(sid, 'nope') });
  assert.match((await err).message, /Permission denied/);
  await wait(100);
  assert.equal(leaked, false);
});

test('reconnect/replay: a late joiner receives canvas + kanban state', async () => {
  const { sid, a, ua } = await setup();
  const card: KanbanCard = {
    id: 'c1', sessionId: sid, sourceElementId: 'r1', title: 'T', description: '', assignee: '',
    column: 'todo', order: 1, updatedAt: nowISO(),
  };
  a.emit(SocketEvents.ADD_ELEMENT, { element: rect(sid) });
  a.emit(SocketEvents.KANBAN_ADD_CARD, { card });
  await wait(150);

  const late = sessionService.addParticipant(sid, 'Late', (await makeUser('L')).id)!;
  const lateUser = await makeUser('L2');
  const p = sessionService.addParticipant(sid, 'Late2', lateUser.id)!;
  const { state } = await join(sid, lateUser, p.id, 'Late2');
  assert.equal(state.elements.length, 1);
  assert.equal(state.cards.length, 1);
  assert.ok(state.participants.length >= 4);
  void late; void ua;
});

test('drag-to-kanban: delete_element and card creation both broadcast', async () => {
  const { sid, a, b } = await setup();
  a.emit(SocketEvents.ADD_ELEMENT, { element: rect(sid) });
  await wait(100);
  const del = once(b, SocketEvents.DELETE_ELEMENT);
  const add = once(b, SocketEvents.KANBAN_ADD_CARD);
  a.emit(SocketEvents.DELETE_ELEMENT, { elementId: 'r1', sessionId: sid });
  a.emit(SocketEvents.KANBAN_ADD_CARD, {
    card: { id: 'c9', sessionId: sid, sourceElementId: 'r1', title: 'Rect', description: '', assignee: '',
      column: 'in_progress', order: 1, updatedAt: nowISO() },
  });
  assert.equal((await del).elementId, 'r1');
  const card = (await add).card;
  assert.deepEqual([card.sourceElementId, card.column], ['r1', 'in_progress']);
});

test('LWW: an older move loses and the sender is told the winning state', async () => {
  const { sid, a, b } = await setup();
  const t1 = '2026-01-01T00:00:01.000Z', t2 = '2026-01-01T00:00:02.000Z';
  a.emit(SocketEvents.ADD_ELEMENT, { element: rect(sid, 'r1', '2026-01-01T00:00:00.000Z') });
  await wait(100);
  const move = (x: number, updatedAt: string) => ({
    elementId: 'r1', sessionId: sid, position: { x, y: 0 }, fabricData: { left: x }, updatedAt,
  });
  a.emit(SocketEvents.MOVE_ELEMENT, move(200, t2));
  await wait(100);
  const correction = once(b, SocketEvents.MOVE_ELEMENT);
  b.emit(SocketEvents.MOVE_ELEMENT, move(5, t1));
  assert.equal((await correction).position.x, 200);
});

test('kanban conflict: server keeps the newer card state and corrects the stale sender', async () => {
  const { sid, a, b } = await setup();
  a.emit(SocketEvents.KANBAN_ADD_CARD, {
    card: { id: 'c1', sessionId: sid, sourceElementId: null, title: 'x', description: '', assignee: '',
      column: 'todo', order: 1, updatedAt: '2026-01-01T00:00:00.000Z' },
  });
  await wait(100);
  const mv = (column: string, updatedAt: string) =>
    ({ cardId: 'c1', sessionId: sid, column, order: 1, updatedAt });
  a.emit(SocketEvents.KANBAN_MOVE_CARD, mv('done', '2026-01-01T00:00:05.000Z'));
  await wait(100);
  const fix = once(b, SocketEvents.KANBAN_MOVE_CARD);
  b.emit(SocketEvents.KANBAN_MOVE_CARD, mv('in_progress', '2026-01-01T00:00:03.000Z'));
  assert.equal((await fix).column, 'done');
});

test('OT through the server: concurrent sticky-note edits converge on every client', async () => {
  const { sid, a, b } = await setup();
  a.emit(SocketEvents.ADD_ELEMENT, { element: sticky(sid, 's1', 'Note') });
  await wait(100);

  const make = (sock: Socket) => {
    const c = new OTClient('Note', 0);
    const send = (batch: ReturnType<OTClient['localEdit']>) =>
      batch && sock.emit(SocketEvents.TEXT_OP, { elementId: 's1', sessionId: sid, ...batch });
    sock.on(SocketEvents.TEXT_ACK, (p) => send(c.ack(p.version)));
    sock.on(SocketEvents.TEXT_OP, (p) => c.remote(p.ops, p.version));
    return { c, edit: (t: string) => send(c.localEdit(t)) };
  };
  const ca = make(a), cb = make(b);

  ca.edit('Note A');
  cb.edit('My Note');
  ca.edit('Note A!'); // buffered while the first batch is in flight
  await wait(400);

  assert.equal(ca.c.text, cb.c.text);
  assert.match(ca.c.text, /My/);
  assert.match(ca.c.text, /A!/);

  const lateUser = await makeUser('late');
  const p = sessionService.addParticipant(sid, 'late', lateUser.id)!;
  const { state } = await join(sid, lateUser, p.id, 'late');
  const el = state.elements.find((e: CanvasElement) => e.id === 's1');
  assert.equal(el.content, ca.c.text);
  assert.equal((el.fabricData as any).text.text, ca.c.text);
});

test('viewers cannot edit sticky-note text', async () => {
  const { sid, a, v } = await setup();
  a.emit(SocketEvents.ADD_ELEMENT, { element: sticky(sid, 's2', 'Note') });
  await wait(100);
  const err = once(v, SocketEvents.ERROR);
  v.emit(SocketEvents.TEXT_OP, {
    elementId: 's2', sessionId: sid, baseVersion: 0, ops: [{ type: 'insert', pos: 0, chars: 'x' }],
  });
  assert.match((await err).message, /Permission denied/);
});
