/**
 * Pass 6: the pole push on the Recover button, in the real game — keyboard and a simulated gamepad,
 * a remapped key, the crash → recover → push context, the HUD prompt with the configured binding,
 * no pushing in a cinematic, and the one-time hint (remembered, tutorial untouched).
 */
import { test, expect, type Page } from '@playwright/test';

type S = { mode: string; session: null | { phase: string; speed: number; crashed: boolean; poleStrokes: number; poleT: number; prompt: string; z: number } };
type W = {
  __ready?: boolean;
  __skifree: {
    state(): S;
    startRun(skipIntro?: boolean): Promise<void>;
    frames(n: number, dt?: number): void;
    teleport(z: number, speed?: number): void;
    crash(): void;
    holdInput(inp: object): void;
    toCave(): void;
    seenCave(v: boolean): void;
    setInputPads(fn: () => unknown[]): void;
  };
};

const errors: string[] = [];
async function boot(page: Page, settings: object) {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text());
  });
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('skifree-tld.settings.v1', JSON.stringify(s));
    }
  }, settings);
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as W).__ready === true, null, { timeout: 240_000, polling: 1000 });
}
const st = async (page: Page) => (await page.evaluate(() => (window as unknown as W).__skifree.state())).session!;
/** let the real game loop run (it reads the real keyboard and gamepad) until `fn` holds */
const until = (page: Page, fn: string, timeout = 240_000) => page.waitForFunction(fn, null, { timeout, polling: 250 });
const S = 'window.__skifree.state().session';
const frames = (page: Page, n: number) => page.evaluate((k) => (window as unknown as W).__skifree.frames(k), n);
const pad = (page: Page, y: boolean) =>
  page.evaluate((yy) => {
    const buttons = Array.from({ length: 17 }, () => ({ value: 0, pressed: false }));
    buttons[3] = { value: yy ? 1 : 0, pressed: yy };
    (window as unknown as W).__skifree.setInputPads(() => [{ id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons }]);
  }, y);

test.describe.configure({ mode: 'serial' });

test('keyboard: slow → POLE PUSH prompt and hint; hold R strokes; crash → R recovers first; release, press → push; cinematic: no push', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  await boot(page, { course: 'classic', courseLength: 'sprint', showTutorial: false });
  await page.evaluate(() => (window as unknown as W).__skifree.startRun(true));
  // standing at the start gate (pizza held so the run-in does not carry the skier off): the prompt
  // shows the configured key
  await page.keyboard.down('KeyS');
  await until(page, `${S}.prompt.startsWith('pole:keyboard')`);
  let s = await st(page);
  await expect(page.locator('.hud-prompt')).toContainText('POLE PUSH');
  await expect(page.locator('.hud-prompt kbd')).toHaveText('R');
  // the one-time hint (control hints on by default; it waits for any caption on screen to clear),
  // remembered without touching the tutorial
  for (let i = 0; i < 20; i++) {
    const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('skifree-tld.settings.v1') ?? '{}').seenPoleHint === true);
    if (seen) break;
    await page.waitForTimeout(1000);
  }
  await expect(page.locator('.hud-caption')).toContainText('push with your poles');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('skifree-tld.settings.v1')!));
  expect(saved.seenPoleHint).toBe(true);
  expect(saved.showTutorial).toBe(false);
  await page.keyboard.up('KeyS');

  const z0 = s.z;
  await page.keyboard.down('KeyR');
  await until(page, `${S}.poleStrokes >= 3`);
  s = await st(page);
  expect(s.z).toBeGreaterThan(z0 + 0.5);
  await page.keyboard.up('KeyR');

  // crash, then hold R: it gets the skier up — and no push while it stays held (pizza held from
  // here on, so the skier stays below the pole cutoff on the start slope while the test waits)
  await page.keyboard.down('KeyS');
  await page.evaluate(() => (window as unknown as W).__skifree.crash());
  await until(page, `${S}.prompt.startsWith('recover:keyboard')`);
  await expect(page.locator('.hud-prompt')).toContainText('RECOVER');
  const strokes = (await st(page)).poleStrokes;
  await page.keyboard.down('KeyR');
  await until(page, `!${S}.crashed`);
  await page.waitForTimeout(4000);
  expect((await st(page)).poleStrokes).toBe(strokes);
  await page.keyboard.up('KeyR');
  await page.waitForTimeout(1000);
  // (below the 55 km/h cutoff, or a press could not push)
  expect((await st(page)).speed).toBeLessThan(55 / 3.6);
  await page.keyboard.down('KeyR');
  await page.waitForTimeout(150);
  await page.keyboard.up('KeyR');
  await until(page, `${S}.poleStrokes === ${strokes + 1}`);
  await page.waitForTimeout(3000);
  expect((await st(page)).poleStrokes).toBe(strokes + 1);
  await page.keyboard.up('KeyS');

  // the cave cinematic: holding the button does nothing
  await page.evaluate(() => {
    (window as unknown as W).__skifree.seenCave(false);
    (window as unknown as W).__skifree.toCave();
  });
  await page.evaluate(() => {
    for (let i = 0; i < 400 && (window as unknown as W).__skifree.state().session!.phase !== 'caveCinematic'; i++) (window as unknown as W).__skifree.frames(1);
  });
  expect((await st(page)).phase).toBe('caveCinematic');
  // (the game loop is held for the cinematic steps below; holdInput feeds the held button to frames())
  const before = (await st(page)).poleStrokes;
  await page.evaluate(() => (window as unknown as W).__skifree.holdInput({ recoverHeld: true }));
  await frames(page, 60);
  await page.evaluate(() => (window as unknown as W).__skifree.holdInput({}));
  expect((await st(page)).phase).toBe('caveCinematic');
  expect((await st(page)).poleStrokes).toBe(before);
  expect(errors).toEqual([]);
});

test('controller Y pushes and shows Y in the prompt; a remapped key replaces R', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  await boot(page, { course: 'classic', courseLength: 'sprint', showTutorial: false, seenPoleHint: true, bindings: { recover: ['KeyF'] } });
  await page.evaluate(() => (window as unknown as W).__skifree.startRun(true));
  await pad(page, false);
  await until(page, `${S}.prompt.startsWith('pole:xbox')`);
  await expect(page.locator('.hud-prompt kbd')).toHaveText('Y');
  await pad(page, true);
  await until(page, `${S}.poleStrokes >= 2`);
  await pad(page, false);
  await page.evaluate(() => (window as unknown as W).__skifree.setInputPads(() => []));
  await page.waitForTimeout(2000);
  // keyboard: R is no longer Recover; F is
  const n = (await st(page)).poleStrokes;
  await page.keyboard.down('KeyR');
  await page.waitForTimeout(3000);
  await page.keyboard.up('KeyR');
  expect((await st(page)).poleStrokes).toBe(n);
  await page.keyboard.down('KeyF');
  await until(page, `${S}.poleStrokes > ${n}`);
  await page.keyboard.up('KeyF');
  await until(page, `${S}.prompt.startsWith('pole:keyboard')`);
  await expect(page.locator('.hud-prompt kbd')).toHaveText('F');
  expect(errors).toEqual([]);
});
