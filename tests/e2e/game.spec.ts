/**
 * Gameplay smoke & integration tests. Uses the hidden ?debug harness (deterministic teleports,
 * fast-forward, autopilot) — never exposed in the normal UI.
 */
import { test, expect, type Page } from '@playwright/test';

type State = {
  mode: string;
  menu: string | null;
  session: null | { phase: string; outcome: string; z: number; speed: number; crashed: boolean; yetiDistance: number; yetiPhase: string; chaseTime: number; intro: boolean };
  records: { runs: number; wins: number; bestScore: number; seenCaveCinematic: boolean };
};

declare global {
  interface Window {
    __ready?: boolean;
    __skifree: {
      state(): State;
      startRun(skipIntro?: boolean): Promise<void>;
      teleport(z: number, speed?: number): void;
      advance(sec: number): void;
      frames(n: number, dt?: number): void;
      autopilot(style: string | null): void;
      placeYeti(gap: number): void;
      pressMenu(label: string): boolean;
      menuId(): string | null;
      seenCave(v: boolean): void;
      perf(): { calls: number; triangles: number };
      setInputPads(fn: () => unknown[]): void;
    };
  }
}

const errors: string[] = [];

async function boot(page: Page) {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text());
  });
  // these flows were written for the original 3 km course: Classic + Sprint (pass-2 default is Standard 10 km)
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ course: 'classic', courseLength: 'sprint' }));
    }
  });
  await page.goto('/?debug');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 240_000, polling: 1000 });
}

const st = (page: Page) => page.evaluate(() => window.__skifree.state());

test.describe.configure({ mode: 'serial' });

test('main menu loads with a rendered 3D background and no fatal errors', async ({ page }) => {
  await boot(page);
  const s = await st(page);
  expect(s.mode).toBe('menu');
  expect(s.menu).toBe('main');
  await expect(page.locator('.hero-title')).toHaveText('SKIFREE');
  await expect(page.locator('.menu-row.kind-button')).toHaveCount(4);
  const perf = await page.evaluate(() => window.__skifree.perf());
  expect(perf.calls).toBeGreaterThan(20); // the scene really draws
  expect(perf.triangles).toBeGreaterThan(50_000);
  await page.screenshot({ path: 'docs/screenshots/e2e_menu.png' });
  expect(errors).toEqual([]);
});

test('full loop: start → learn → cave cinematic → chase → caught → retry → victory', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  await boot(page);
  // keyboard: Enter on the focused "Start Game"
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__skifree.state().mode === 'playing');
  let s = await st(page);
  expect(s.session?.phase).toBe('intro');
  // skip the intro with a key
  await page.evaluate(() => window.__skifree.frames(3));
  await page.keyboard.press('Space');
  await page.evaluate(() => window.__skifree.frames(3));
  s = await st(page);
  expect(s.session?.intro).toBe(false);
  expect(s.session?.phase).toBe('learn');

  // keyboard steering changes heading
  const h0 = (await page.evaluate(() => (window.__skifree.state().session as unknown as { heading: number }).heading)) as number;
  await page.keyboard.down('KeyD');
  await page.evaluate(() => window.__skifree.frames(30));
  await page.keyboard.up('KeyD');
  const h1 = (await page.evaluate(() => (window.__skifree.state().session as unknown as { heading: number }).heading)) as number;
  expect(h1).toBeLessThan(h0 - 0.05);
  await page.screenshot({ path: 'docs/screenshots/e2e_tutorial.png' });

  // ski down to the cave with the autopilot (fast-forwarded, deterministic)
  await page.evaluate(() => window.__skifree.autopilot('skilled'));
  await page.evaluate(() => window.__skifree.advance(200));
  s = await st(page);
  expect(s.session?.phase).toBe('caveCinematic');
  // cinematic is non-interactive and the simulation is frozen
  const zFrozen = s.session!.z;
  await page.evaluate(() => window.__skifree.frames(120));
  s = await st(page);
  expect(s.session?.phase).toBe('caveCinematic');
  expect(s.session!.z).toBeCloseTo(zFrozen, 3);
  await page.screenshot({ path: 'docs/screenshots/e2e_cave_cinematic.png' });
  // first viewing cannot be skipped: Esc pauses instead, and the cinematic resumes afterwards
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__skifree.frames(2));
  s = await st(page);
  expect(s.session?.phase).toBe('caveCinematic');
  expect(s.mode).toBe('paused');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__skifree.state().mode === 'playing');
  // play it out
  await page.evaluate(() => window.__skifree.frames(400));
  s = await st(page);
  expect(s.session?.phase).toBe('chase');
  expect(s.session?.yetiPhase).toBe('chase');
  expect(s.records.seenCaveCinematic).toBe(true);
  await page.evaluate(() => window.__skifree.frames(20));
  await page.screenshot({ path: 'docs/screenshots/e2e_chase.png' });
  expect(await page.locator('.hud-yeti').isVisible()).toBe(true);

  // lose: put the yeti right behind and stop skiing
  await page.evaluate(() => {
    window.__skifree.autopilot('cautious');
    window.__skifree.placeYeti(6);
    window.__skifree.advance(4);
  });
  s = await st(page);
  expect(s.session?.phase).toBe('caught');
  expect(s.session?.outcome).toBe('caught');
  await page.evaluate(() => window.__skifree.frames(60));
  await page.screenshot({ path: 'docs/screenshots/e2e_defeat.png' });
  await page.evaluate(() => window.__skifree.frames(160));
  await page.waitForFunction(() => window.__skifree.state().menu === 'results');
  await expect(page.locator('.menu-title')).toHaveText('THE YETI WAS HUNGRY');
  // a caught player can't subsequently win: teleporting past the finish does nothing
  await page.evaluate(() => window.__skifree.teleport(3010, 10));
  expect((await st(page)).session?.outcome).toBe('caught');

  // retry without a reload
  expect(await page.evaluate(() => window.__skifree.pressMenu('Retry'))).toBe(true);
  await page.evaluate(() => window.__skifree.frames(2));
  s = await st(page);
  expect(s.mode).toBe('playing');
  expect(s.session?.phase).toBe('learn');
  expect(s.session?.outcome).toBe('none');
  expect(s.records.runs).toBe(1);

  // a full skilled run to the bottom
  await page.evaluate(() => window.__skifree.autopilot('skilled'));
  await page.evaluate(() => window.__skifree.advance(200));
  expect((await st(page)).session?.phase).toBe('caveCinematic');
  // second viewing: skippable
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__skifree.frames(3));
  expect((await st(page)).session?.phase).toBe('chase');
  await page.evaluate(() => window.__skifree.advance(200));
  s = await st(page);
  expect(s.session?.outcome).toBe('victory');
  expect(s.session?.phase).toBe('victory');
  await page.evaluate(() => window.__skifree.frames(90));
  await page.screenshot({ path: 'docs/screenshots/e2e_victory_stop.png' });
  await page.evaluate(() => window.__skifree.frames(180));
  await page.screenshot({ path: 'docs/screenshots/e2e_victory_trophy.png' });
  await page.evaluate(() => window.__skifree.frames(250));
  await page.waitForFunction(() => window.__skifree.state().menu === 'results');
  await expect(page.locator('.menu-title')).toHaveText('YOU SURVIVED THE MOUNTAIN');
  await page.screenshot({ path: 'docs/screenshots/e2e_results_win.png' });
  s = await st(page);
  expect(s.records.wins).toBe(1);
  expect(s.records.runs).toBe(2);

  // main menu, then a third run starts cleanly
  expect(await page.evaluate(() => window.__skifree.pressMenu('Main Menu'))).toBe(true);
  expect((await st(page)).mode).toBe('menu');
  await page.evaluate(() => window.__skifree.startRun(true));
  expect((await st(page)).session?.phase).toBe('learn');
  expect(errors).toEqual([]);
});

test('pause/resume and gamepad hot-plug do not break the game', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => window.__skifree.startRun(true));
  await page.evaluate(() => window.__skifree.frames(10));
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__skifree.frames(1));
  let s = await st(page);
  expect(s.mode).toBe('paused');
  const z = s.session!.z;
  await page.waitForTimeout(1500);
  expect((await st(page)).session!.z).toBeCloseTo(z, 5);
  await page.keyboard.press('Escape'); // back = resume
  await page.waitForFunction(() => window.__skifree.state().mode === 'playing');

  // inject a fake standard-mapping gamepad: right trigger tuck, left stick right
  await page.evaluate(() => {
    const buttons = Array.from({ length: 17 }, () => ({ value: 0, pressed: false }));
    buttons[7] = { value: 1, pressed: true };
    const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', connected: true, mapping: 'standard', axes: [0.8, 0, 0, 0], buttons };
    window.__skifree.setInputPads(() => [pad]);
  });
  await page.evaluate(() => window.__skifree.frames(20));
  expect(await page.evaluate(() => document.body.dataset.device)).toBe('xbox');
  // unplug
  await page.evaluate(() => window.__skifree.setInputPads(() => []));
  await page.evaluate(() => window.__skifree.frames(10));
  s = await st(page);
  expect(s.mode).toBe('playing');
  // start button pauses
  await page.evaluate(() => {
    const buttons = Array.from({ length: 17 }, () => ({ value: 0, pressed: false }));
    buttons[9] = { value: 1, pressed: true };
    window.__skifree.setInputPads(() => [{ id: 'DualSense Wireless Controller (Vendor: 054c)', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons }]);
  });
  await page.waitForFunction(() => window.__skifree.state().mode === 'paused', null, { timeout: 60_000 });
  expect(errors).toEqual([]);
});
