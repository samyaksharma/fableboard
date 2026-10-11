import { spawn, type ChildProcess } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, BrowserContext, Page } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const APP_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3001/api/health';

async function waitFor(url: string, label: string, ms = 30_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`${label} did not start within ${ms / 1000}s`);
}

async function assertPortFree(url: string, label: string) {
  try {
    await fetch(url);
  } catch {
    return;
  }
  throw new Error(`${label} is already running on its port; stop it before running the E2E suite`);
}

export async function startStack(): Promise<() => Promise<void>> {
  await assertPortFree(API_URL, 'The API server (port 3001)');
  await assertPortFree(APP_URL, 'The client (port 5173)');
  const procs: ChildProcess[] = [];
  const run = (cmd: string, args: string[], cwd: string, env: Record<string, string> = {}) => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, stdio: 'ignore' });
    procs.push(p);
  };
  // Empty Convex vars keep the test run in memory so it never touches a real deployment.
  run(process.execPath, ['--import', 'tsx', 'src/index.ts'], resolve(root, 'packages/server'), {
    CONVEX_URL: '',
    CONVEX_SERVER_SECRET: '',
  });
  run(process.execPath, ['node_modules/vite/bin/vite.js', '--strictPort'], resolve(root, 'packages/client'));
  await waitFor(API_URL, 'API server');
  await waitFor(APP_URL, 'Client');
  return async () => {
    procs.forEach((p) => p.kill('SIGTERM'));
    await new Promise((r) => setTimeout(r, 300));
  };
}

export async function newUser(
  browser: Browser,
  name: string,
  opts: Parameters<Browser['newContext']>[0] = {},
  beforeGoto?: (page: Page) => Promise<void>,
) {
  const context: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    acceptDownloads: true,
    ...opts,
  });
  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());
  await beforeGoto?.(page);
  await page.goto(APP_URL);
  await page.click('button:has-text("Continue as guest")');
  await page.fill('input[placeholder="Your display name"]', name);
  await page.click('button:has-text("Continue as guest")');
  await page.locator('text=Create New Session').waitFor();
  return { context, page };
}

export async function createSession(page: Page, title: string): Promise<string> {
  await page.click('text=Create New Session');
  await page.fill('input[placeholder="Session title"]', title);
  await page.click('button:has-text("Create")');
  const id = page.locator('.font-mono').first();
  await id.waitFor();
  return (await id.innerText()).trim();
}

export async function joinSession(page: Page, sessionId: string) {
  await page.click('text=Join Existing Session');
  await page.fill('input[placeholder="Session ID"]', sessionId);
  await page.click('button:has-text("Join")');
  await page.locator('.font-mono').first().waitFor();
}

export async function regionHasInk(page: Page, x: number, y: number, w: number, h: number): Promise<boolean> {
  return page.evaluate(([px, py, pw, ph]) => {
    const canvas = document.querySelector('canvas.lower-canvas') as HTMLCanvasElement;
    const r = canvas.getBoundingClientRect();
    const data = canvas
      .getContext('2d')!
      .getImageData(Math.round(px - r.left), Math.round(py - r.top), pw, ph).data;
    for (let i = 0; i < data.length; i += 4) {
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 200) return true;
    }
    return false;
  }, [x, y, w, h]);
}

export async function expectEventually(fn: () => Promise<boolean>, label: string, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timed out waiting for: ${label}`);
}
