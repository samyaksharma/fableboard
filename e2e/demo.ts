import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { startStack, newUser, createSession, joinSession } from './helpers.js';

const docs = path.resolve(import.meta.dirname, '../docs');
fs.mkdirSync(docs, { recursive: true });
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

// A visible pointer and a caption bar, since headless recordings show neither.
async function decorate(page: Page) {
  // Passed as a string on purpose: tsx rewrites function bodies, which breaks them in the browser.
  await page.addInitScript(`(() => {
    const ready = () => {
      const cur = document.createElement('div');
      cur.style.cssText = 'position:fixed;z-index:99999;width:18px;height:18px;border-radius:50%;background:rgba(37,99,235,.35);border:2px solid #2563eb;pointer-events:none;transform:translate(-50%,-50%);left:-50px;top:-50px';
      const cap = document.createElement('div');
      cap.id = '__caption';
      cap.style.cssText = 'position:fixed;z-index:99999;left:50%;bottom:56px;transform:translateX(-50%);width:max-content;max-width:1000px;background:rgba(15,23,42,.88);color:#fff;font:600 17px system-ui;padding:10px 18px;border-radius:10px;pointer-events:none;opacity:0;transition:opacity .3s';
      document.body.append(cur, cap);
      addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; });
    };
    if (document.body) ready(); else addEventListener('DOMContentLoaded', ready);
  })()`);
}

const caption = (page: Page, text: string) =>
  page.evaluate(
    `(() => { const el = document.getElementById('__caption'); if (el) { el.textContent = ${JSON.stringify(text)}; el.style.opacity = ${text ? "'1'" : "'0'"}; } })()`,
  );

const move = (page: Page, x: number, y: number, steps = 25) => page.mouse.move(x, y, { steps });

async function main() {
  const stop = await startStack();
  const browser = await chromium.launch();
  try {
    const alice = await newUser(
      browser,
      'Alice',
      { recordVideo: { dir: path.join(docs, '.video'), size: { width: 1280, height: 720 } } },
      decorate,
    );
    const { page } = alice;
    const id = await createSession(page, 'Sprint planning');

    await caption(page, 'Fableboard: sketch it, sync it, ship it');
    await pause(1800);

    const bob = await newUser(browser, 'Bob', { viewport: { width: 1280, height: 720 } });
    await joinSession(bob.page, id);
    await caption(page, 'Bob joins from a second browser: presence + live cursors');
    await move(bob.page, 700, 250);
    await move(bob.page, 520, 420, 40);
    await pause(1800);

    await caption(page, 'Freehand drawing and shapes sync instantly');
    await page.click('button[title="Draw"]');
    await move(page, 160, 200);
    await page.mouse.down();
    for (let i = 0; i <= 30; i++) {
      await page.mouse.move(160 + i * 9, 200 + Math.sin(i / 3) * 34, { steps: 2 });
    }
    await page.mouse.up();
    await page.click('button[title="Rectangle"]');
    await move(page, 220, 420);
    await page.mouse.click(220, 420);
    await pause(1200);
    await page.screenshot({ path: path.join(docs, 'board.png') });

    await caption(page, 'Sticky notes use operational transform: concurrent typing merges');
    await page.click('button[title="Sticky Note"]');
    await move(page, 620, 300);
    await page.mouse.click(620, 300);
    await pause(700);
    await page.mouse.dblclick(620, 340);
    await page.keyboard.press('Control+A');
    await page.keyboard.type('Fix login bug', { delay: 70 });
    await pause(500);
    await bob.page.mouse.dblclick(620, 340);
    await bob.page.keyboard.press('Home');
    await Promise.all([
      page.keyboard.type(' on mobile', { delay: 80 }),
      bob.page.keyboard.type('(urgent) ', { delay: 80 }),
    ]);
    await page.mouse.click(900, 600);
    await bob.page.mouse.click(900, 600);
    await pause(1500);
    await page.screenshot({ path: path.join(docs, 'sticky-ot.png') });

    await caption(page, 'Drag any element into a kanban column to make it a task');
    await page.click('button:has-text("Kanban")');
    await pause(800);
    const progress = (await page.locator('[data-column="in_progress"]').boundingBox())!;
    await move(page, 620, 360);
    await page.mouse.down();
    await move(page, 800, 380, 20);
    await move(page, progress.x + 70, progress.y + 40, 30);
    await page.mouse.up();
    await pause(1200);
    const todo = (await page.locator('[data-column="todo"]').boundingBox())!;
    await move(page, 220, 420);
    await page.mouse.down();
    await move(page, todo.x + 70, todo.y + 40, 40);
    await page.mouse.up();
    await pause(1500);

    await caption(page, 'Cards drag between To Do, In Progress and Done, synced for everyone');
    await page
      .locator('[data-column="todo"] >> text=Rect')
      .first()
      .dragTo(page.locator('[data-column="done"]'));
    await pause(1500);
    await page.screenshot({ path: path.join(docs, 'kanban.png') });

    await caption(page, 'Owner controls roles: Bob becomes a viewer instantly');
    await page.click('button:has-text("People")');
    await pause(900);
    await page.selectOption('select', 'viewer');
    await pause(2000);
    await page.screenshot({ path: path.join(docs, 'roles.png') });
    await page.click('button:has-text("People")');

    await caption(page, 'Export the canvas and board to PDF, or everything to JSON');
    await page.click('button:has-text("Export")');
    await pause(2200);
    await caption(page, '');
    await pause(500);

    const video = page.video()!;
    await alice.context.close();
    await bob.context.close();
    await video.saveAs(path.join(docs, 'demo.webm'));
    fs.rmSync(path.join(docs, '.video'), { recursive: true, force: true });
    console.log('Saved docs/demo.webm');
  } finally {
    await browser.close();
    await stop();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
