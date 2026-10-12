import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, type Browser } from 'playwright';
import {
  startStack, newUser, createSession, joinSession, regionHasInk, expectEventually, APP_URL,
} from './helpers.js';

let stop: () => Promise<void>;
let browser: Browser;

before(async () => {
  stop = await startStack();
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await stop?.();
});

// A rectangle created by a click is 80x80 and centred on the click; its fill is transparent,
// so look for ink along its top edge rather than at its centre.
const rectEdge = (page: any, cx: number, cy: number) => () => regionHasInk(page, cx - 30, cy - 42, 60, 4);
const strokeAt = (page: any, x: number, y: number) => () => regionHasInk(page, x - 20, y - 4, 40, 8);

test('two browsers: a shape and a stroke drawn by one appear for the other', async () => {
  const alice = await newUser(browser, 'Alice');
  const id = await createSession(alice.page, 'Sync');
  const bob = await newUser(browser, 'Bob');
  await joinSession(bob.page, id);

  await alice.page.click('button[title="Rectangle"]');
  await alice.page.mouse.click(300, 300);
  await alice.page.click('button[title="Draw"]');
  await alice.page.mouse.move(400, 500);
  await alice.page.mouse.down();
  await alice.page.mouse.move(700, 500, { steps: 12 });
  await alice.page.mouse.up();

  await expectEventually(strokeAt(bob.page, 550, 500), "Bob sees Alice's stroke");
  await expectEventually(rectEdge(bob.page, 300, 300), "Bob sees Alice's rectangle");
  assert.ok(await strokeAt(alice.page, 550, 500)(), 'Alice sees her own stroke');

  await expectEventually(async () => (await bob.page.locator('text=2 online').count()) === 1, 'presence count');
  await alice.context.close();
  await bob.context.close();
});

test('sticky note: concurrent edits from two users merge instead of overwriting', async () => {
  const alice = await newUser(browser, 'Alice');
  const id = await createSession(alice.page, 'OT');
  const bob = await newUser(browser, 'Bob');
  await joinSession(bob.page, id);

  await alice.page.click('button[title="Sticky Note"]');
  await alice.page.mouse.click(500, 300);
  await alice.page.waitForTimeout(400);
  await alice.page.mouse.dblclick(500, 330);
  await alice.page.keyboard.press('Control+A');
  await alice.page.keyboard.type('Fix login bug');
  await expectEventually(async () => {
    await bob.page.mouse.dblclick(500, 330);
    await bob.page.keyboard.press('Home');
    return true;
  }, 'Bob enters edit mode');
  await Promise.all([
    alice.page.keyboard.type(' now', { delay: 40 }),
    bob.page.keyboard.type('(urgent) ', { delay: 40 }),
  ]);
  await alice.page.mouse.click(900, 600);
  await bob.page.mouse.click(900, 600);
  await alice.page.waitForTimeout(800);

  // Turn the note into a card on Alice's side and read the merged text from the card title.
  await alice.page.click('button:has-text("Kanban")');
  const todo = await alice.page.locator('[data-column="todo"]').boundingBox();
  await alice.page.mouse.move(500, 360);
  await alice.page.mouse.down();
  await alice.page.mouse.move(todo!.x + 60, todo!.y + 40, { steps: 10 });
  await alice.page.mouse.up();
  const column = alice.page.locator('[data-column="todo"]');
  await expectEventually(async () => (await column.innerText()).includes('Fix login bug'), 'card created');
  assert.match(await column.innerText(), /\(urgent\) Fix login bug now/);
  await alice.context.close();
  await bob.context.close();
});

test('drag-to-kanban: element leaves the canvas for everyone and lands in the chosen column', async () => {
  const alice = await newUser(browser, 'Alice');
  const id = await createSession(alice.page, 'Kanban');
  const bob = await newUser(browser, 'Bob');
  await joinSession(bob.page, id);
  await bob.page.click('button:has-text("Kanban")');
  await alice.page.click('button:has-text("Kanban")');

  await alice.page.click('button[title="Rectangle"]');
  await alice.page.mouse.click(300, 300);
  await expectEventually(rectEdge(bob.page, 300, 300), 'rect visible to Bob');
  const done = await alice.page.locator('[data-column="done"]').boundingBox();
  await alice.page.mouse.move(300, 300);
  await alice.page.mouse.down();
  await alice.page.mouse.move(done!.x + 60, done!.y + 30, { steps: 10 });
  await alice.page.mouse.up();

  const bobDone = bob.page.locator('[data-column="done"]');
  await expectEventually(async () => (await bobDone.innerText()).includes('Rect'), 'card in Done for Bob');
  await expectEventually(async () => !(await rectEdge(bob.page, 300, 300)()), 'rect removed from Bob canvas');
  await alice.context.close();
  await bob.context.close();
});

test('permissions: owner can demote an editor to viewer, who is then locked out', async () => {
  const alice = await newUser(browser, 'Alice');
  const id = await createSession(alice.page, 'Roles');
  const bob = await newUser(browser, 'Bob');
  await joinSession(bob.page, id);

  assert.equal(await bob.page.locator('button[title="Draw"]').count(), 1, 'editors get tools');
  assert.equal(await bob.page.locator('button:has-text("Export")').count(), 0, 'export is owner-only');

  await alice.page.click('button:has-text("People")');
  await alice.page.selectOption('select', 'viewer');
  await expectEventually(async () => (await bob.page.locator('text=View only').count()) === 1, 'Bob sees View only');
  assert.equal(await bob.page.locator('button[title="Draw"]').count(), 0);

  await bob.page.click('button:has-text("Kanban")');
  assert.equal(await bob.page.locator('text=+ Add card').count(), 0, 'viewers cannot add cards');
  assert.equal(await bob.page.locator('button:has-text("Save board")').count(), 0, 'viewers cannot save snapshots');
  await alice.context.close();
  await bob.context.close();
});

test('export: owner gets JSON with the board data and a 2-page PDF (canvas + kanban)', async () => {
  const alice = await newUser(browser, 'Alice');
  await createSession(alice.page, 'Export me');
  await alice.page.click('button:has-text("Kanban")');
  await alice.page.click('[data-column="todo"] >> text=+ Add card');
  await alice.page.fill('input[placeholder="Card title..."]', 'Write the report');
  await alice.page.keyboard.press('Enter');
  await alice.page.click('button[title="Rectangle"]');
  await alice.page.mouse.click(300, 300);

  await alice.page.click('button:has-text("Export")');
  const [json] = await Promise.all([alice.page.waitForEvent('download'), alice.page.click('text=Export JSON')]);
  const data = JSON.parse(fs.readFileSync((await json.path())!, 'utf8'));
  assert.equal(data.session.title, 'Export me');
  assert.equal(data.elements.length, 1, `elements in export: ${JSON.stringify(data.elements.map((e: any) => e.type))}`);
  assert.equal(data.cards[0].title, 'Write the report');

  await alice.page.click('button:has-text("Export")');
  const [pdf] = await Promise.all([alice.page.waitForEvent('download'), alice.page.click('text=Export PDF')]);
  const raw = fs.readFileSync((await pdf.path())!).toString('latin1');
  assert.equal((raw.match(/\/Type \/Page\b/g) ?? []).length, 2);
  await alice.context.close();
});

test('save board: the whole page becomes a snapshot card, canvas untouched, visible to others', async () => {
  const alice = await newUser(browser, 'Alice');
  const id = await createSession(alice.page, 'Snapshots');
  const bob = await newUser(browser, 'Bob');
  await joinSession(bob.page, id);
  await alice.page.click('button:has-text("Kanban")');
  await bob.page.click('button:has-text("Kanban")');

  await alice.page.click('button[title="Rectangle"]');
  await alice.page.mouse.click(300, 300);
  await alice.page.click('button[title="Draw"]');
  await alice.page.mouse.move(400, 450);
  await alice.page.mouse.down();
  await alice.page.mouse.move(700, 450, { steps: 10 });
  await alice.page.mouse.up();
  await expectEventually(rectEdge(bob.page, 300, 300), 'Bob sees the rectangle');

  await alice.page.click('button:has-text("Save board")');

  for (const [name, page] of [['Alice', alice.page], ['Bob', bob.page]] as const) {
    const img = page.locator('[data-column="todo"] img');
    await expectEventually(async () => (await img.count()) === 1, `${name} sees the snapshot card`);
    const loaded = await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 100);
    assert.ok(loaded, `${name}'s snapshot image decodes`);
  }
  assert.ok(await rectEdge(alice.page, 300, 300)(), 'canvas untouched for Alice');
  assert.ok(await rectEdge(bob.page, 300, 300)(), 'canvas untouched for Bob');
  await alice.context.close();
  await bob.context.close();
});

test('accounts: register, sign out, sign in again and still own the board', async () => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'correct-horse-battery';
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(APP_URL);

  await page.click('button:has-text("Create account")');
  await page.fill('input[placeholder="Display name"]', 'Grace');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('form button[type="submit"]');
  const id = await createSession(page, 'Mine');

  await page.click('button:has-text("People")');
  await page.click('text=Sign out');
  await page.locator('text=Sign in').first().waitFor();

  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', 'not-the-password');
  await page.click('form button[type="submit"]');
  await page.locator('[role="alert"]').waitFor();
  assert.match(await page.locator('[role="alert"]').innerText(), /Invalid email or password/);

  await page.fill('input[type="password"]', password);
  await page.click('form button[type="submit"]');
  await joinSession(page, id);
  await expectEventually(
    async () => (await page.locator('button:has-text("Export")').count()) === 1,
    'returning user is still the owner (Export is owner-only)',
  );
  assert.equal(await page.locator('text=View only').count(), 0);

  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(APP_URL);
  await p2.click('button:has-text("Create account")');
  await p2.fill('input[placeholder="Display name"]', 'Impostor');
  await p2.fill('input[type="email"]', email);
  await p2.fill('input[type="password"]', 'another-password-1');
  await p2.click('form button[type="submit"]');
  await p2.locator('[role="alert"]').waitFor();
  assert.match(await p2.locator('[role="alert"]').innerText(), /already exists/);
  await context.close();
  await other.close();
});

test('eraser: dragging over a stroke removes it for everyone and leaves other shapes', async () => {
  const alice = await newUser(browser, 'Alice');
  const id = await createSession(alice.page, 'Erase');
  const bob = await newUser(browser, 'Bob');
  await joinSession(bob.page, id);

  await alice.page.click('button[title="Rectangle"]');
  await alice.page.mouse.click(300, 300);
  await alice.page.click('button[title="Draw"]');
  await alice.page.mouse.move(450, 500);
  await alice.page.mouse.down();
  await alice.page.mouse.move(750, 500, { steps: 12 });
  await alice.page.mouse.up();
  await expectEventually(strokeAt(bob.page, 600, 500), 'Bob sees the stroke');

  await alice.page.click('button[title="Eraser"]');
  await alice.page.mouse.move(500, 480);
  await alice.page.mouse.down();
  await alice.page.mouse.move(700, 505, { steps: 15 });
  await alice.page.mouse.up();

  await expectEventually(async () => !(await strokeAt(bob.page, 600, 500)()), 'stroke erased for Bob');
  assert.ok(!(await strokeAt(alice.page, 600, 500)()), 'stroke erased for Alice');
  assert.ok(await rectEdge(bob.page, 300, 300)(), 'the rectangle is untouched');
  await alice.context.close();
  await bob.context.close();
});

test('undo/redo: add, move and delete are each undoable and sync to the other user', async () => {
  const alice = await newUser(browser, 'Alice');
  const id = await createSession(alice.page, 'Undo');
  const bob = await newUser(browser, 'Bob');
  await joinSession(bob.page, id);
  const undo = () => alice.page.keyboard.press('Control+z');
  const redo = () => alice.page.keyboard.press('Control+Shift+z');
  const onBoard = (page: any, x: number) => rectEdge(page, x, 300);

  // add -> undo -> redo
  await alice.page.click('button[title="Rectangle"]');
  await alice.page.mouse.click(300, 300);
  await expectEventually(onBoard(bob.page, 300), 'Bob sees the rectangle');
  await undo();
  await expectEventually(async () => !(await onBoard(bob.page, 300)()), 'undo removes it for Bob');
  await redo();
  await expectEventually(onBoard(bob.page, 300), 'redo brings it back for Bob');

  // move -> undo
  await alice.page.mouse.move(300, 300);
  await alice.page.mouse.down();
  await alice.page.mouse.move(520, 300, { steps: 10 });
  await alice.page.mouse.up();
  await expectEventually(onBoard(bob.page, 520), 'Bob sees the moved rectangle');
  await undo();
  await expectEventually(onBoard(bob.page, 300), 'undo moves it back for Bob');
  assert.ok(!(await onBoard(bob.page, 520)()), 'and it is no longer at the new place');

  // delete -> undo
  await alice.page.mouse.click(300, 300);
  await alice.page.keyboard.press('Delete');
  await expectEventually(async () => !(await onBoard(bob.page, 300)()), 'Bob sees it deleted');
  await undo();
  await expectEventually(onBoard(bob.page, 300), 'undo restores the deleted rectangle for Bob');

  // the toolbar buttons are wired to the same history
  await alice.page.click('button[aria-label="Undo"]');
  await expectEventually(async () => !(await onBoard(bob.page, 300)()), 'toolbar undo works');
  await alice.page.click('button[aria-label="Redo"]');
  await expectEventually(onBoard(bob.page, 300), 'toolbar redo works');
  await alice.context.close();
  await bob.context.close();
});

test('line and arrow: drawn by dragging, synced, and erasable', async () => {
  const alice = await newUser(browser, 'Alice');
  const id = await createSession(alice.page, 'Lines');
  const bob = await newUser(browser, 'Bob');
  await joinSession(bob.page, id);
  const mid = (page: any) => regionHasInk(page, 392, 342, 16, 16);

  await alice.page.click('button[title="Line"]');
  await alice.page.mouse.move(300, 300);
  await alice.page.mouse.down();
  await alice.page.mouse.move(500, 400, { steps: 12 });
  await alice.page.mouse.up();
  await expectEventually(() => mid(bob.page), 'Bob sees the line');

  // An arrow has a head: ink is concentrated near its end, away from a plain line's end.
  await alice.page.click('button[title="Arrow"]');
  await alice.page.mouse.move(300, 560);
  await alice.page.mouse.down();
  await alice.page.mouse.move(600, 560, { steps: 12 });
  await alice.page.mouse.up();
  await expectEventually(() => regionHasInk(bob.page, 585, 548, 8, 8), 'Bob sees the arrow head');

  // Undo removes the arrow only; the eraser removes the line.
  await alice.page.keyboard.press('Control+z');
  await expectEventually(async () => !(await regionHasInk(bob.page, 585, 548, 8, 8)), 'arrow undone');
  assert.ok(await mid(bob.page), 'the line is still there');

  await alice.page.click('button[title="Eraser"]');
  await alice.page.mouse.move(380, 330);
  await alice.page.mouse.down();
  await alice.page.mouse.move(420, 370, { steps: 8 });
  await alice.page.mouse.up();
  await expectEventually(async () => !(await mid(bob.page)), 'line erased for Bob');
  await alice.context.close();
  await bob.context.close();
});

test('session menu: leave a board, start another, and switch back from the list', async () => {
  const alice = await newUser(browser, 'Alice');
  await createSession(alice.page, 'Board One');
  await alice.page.click('button[title="Rectangle"]');
  await alice.page.mouse.click(300, 300);
  await alice.page.waitForTimeout(500);

  // Leave to the start screen and make a second session
  await alice.page.click('button:has-text("Fableboard")');
  await alice.page.click('text=New or join another session');
  await alice.page.locator('button:has-text("New board")').waitFor();
  await createSession(alice.page, 'Board Two');
  assert.equal(await alice.page.locator('text=Sketch it. Sync it. Ship it.').count(), 1, 'fresh empty board');

  // Both sessions are listed, and the first still has its shape
  await alice.page.click('button:has-text("Fableboard")');
  const list = alice.page.locator('div.absolute:has-text("Your sessions")');
  await expectEventually(async () => (await list.innerText()).includes('Board One'), 'Board One is listed');
  assert.match(await list.innerText(), /Board Two[\s\S]*current/);
  await alice.page.click('button:has-text("Board One")');
  await expectEventually(rectEdge(alice.page, 300, 300), 'Board One comes back with its rectangle');
  await alice.context.close();
});

async function leaveToHome(page: any) {
  await page.click('button:has-text("Fableboard")');
  await page.click('text=New or join another session');
  await page.locator('button:has-text("New board")').waitFor();
}

test('home screen: your boards and boards shared with you are listed and openable', async () => {
  const alice = await newUser(browser, 'Alice');
  const id = await createSession(alice.page, 'Planning');
  const bob = await newUser(browser, 'Bob');
  await joinSession(bob.page, id);

  await leaveToHome(alice.page);
  const mine = alice.page.locator('section:has-text("Your boards")');
  await expectEventually(async () => (await mine.innerText()).includes('Planning'), 'Alice sees it under Your boards');
  assert.match(await mine.innerText(), /owner/);

  await leaveToHome(bob.page);
  const shared = bob.page.locator('section:has-text("Shared with you")');
  await expectEventually(async () => (await shared.innerText()).includes('Planning'), 'Bob sees it under Shared with you');
  assert.match(await shared.innerText(), /editor/);
  assert.ok(!(await bob.page.locator('section:has-text("Your boards")').innerText()).includes('Planning'));

  await shared.locator('button:has-text("Planning")').click();
  await bob.page.locator('.font-mono').first().waitFor();
  assert.equal((await bob.page.locator('.font-mono').first().innerText()).trim(), id);
  await alice.context.close();
  await bob.context.close();
});

test('invite link: opening /?join=CODE signs in and lands on that board', async () => {
  const alice = await newUser(browser, 'Alice');
  const id = await createSession(alice.page, 'Invite me');
  const carol = await newUser(browser, 'Carol');
  await carol.page.goto(`${APP_URL}/?join=${id}`);
  await carol.page.locator('.font-mono').first().waitFor();
  assert.equal((await carol.page.locator('.font-mono').first().innerText()).trim(), id);
  assert.ok(!carol.page.url().includes('join='), 'the code is removed from the address bar');
  await alice.context.close();
  await carol.context.close();
});

test('mobile: usable at phone width with touch drawing, no sideways scroll', async () => {
  const mia = await newUser(browser, 'Mia', {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const page = mia.page;
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok((await overflow()) <= 1, 'home screen fits the width');

  await createSession(page, 'Phone');
  assert.ok((await overflow()) <= 1, 'board fits the width');
  const tool = page.locator('button[title="Rectangle"]');
  const box = await tool.boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= 390, 'tools are reachable on screen');
  const redo = await page.locator('button[aria-label="Redo"]').boundingBox();
  assert.ok(redo && redo.x + redo.width <= 390, 'undo and redo are both on screen');

  // Tap to place a shape
  await tool.tap();
  await page.touchscreen.tap(150, 420);
  await expectEventually(() => regionHasInk(page, 120, 378, 60, 4), 'tap placed a rectangle');

  // Freehand with a real touch stroke
  await page.locator('button[title="Draw"]').tap();
  const cdp = await mia.context.newCDPSession(page);
  const touch = (type: string, x?: number, y?: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: x === undefined ? [] : [{ x, y: y! }],
    });
  await touch('touchStart', 60, 600);
  for (let i = 1; i <= 12; i++) await touch('touchMove', 60 + i * 20, 600);
  await touch('touchEnd');
  await expectEventually(() => regionHasInk(page, 160, 596, 40, 8), 'touch stroke drew a line');

  // Kanban opens as a bottom sheet and a card can be moved without drag-and-drop
  await page.locator('button:has-text("Kanban")').tap();
  const todo = page.locator('[data-column="todo"]');
  await todo.waitFor();
  const sheet = await todo.boundingBox();
  assert.ok(sheet && sheet.x >= 0 && sheet.x + sheet.width <= 390, 'kanban fits the width');
  assert.ok((await overflow()) <= 1, 'board with kanban open fits the width');
  await todo.locator('text=+ Add card').tap();
  await page.fill('input[placeholder="Card title..."]', 'Phone task');
  await page.keyboard.press('Enter');
  await page.selectOption('select[aria-label="Move card to column"]', 'done');
  await expectEventually(
    async () => (await page.locator('[data-column="done"]').innerText()).includes('Phone task'),
    'card moved to Done from the select',
  );
  await mia.context.close();
});
