/**
 * Achievements & cosmetics (pass 4): the Achievements and Locker screens fit and navigate like
 * every other menu, a v1 progress save migrates in the browser, equipping a jacket persists and
 * recolours the skier, and automated ?debug runs never persist achievements.
 */
import { test, expect, type Page } from '@playwright/test';

type Progress = {
  saved: { version: number; achievements: Record<string, { earnedAt: number }>; stats: { counters: Record<string, number> }; cosmetics: { owned: Record<string, unknown>; equipped: Record<string, string> } };
  persisting: boolean;
  attached: boolean;
  toast: string;
  jacket: number | null;
  events: string[];
};
type MW = {
  __ready?: boolean;
  __skifree: {
    state(): { mode: string; menu: string | null; session: null | { phase: string; outcome: string } };
    setInputPads(fn: () => unknown[]): void;
    setCourse(mode: string, length: string): string;
    menuFocus(label: string): boolean;
    menuId(): string | null;
    pressMenu(label: string): boolean;
    progress(): Progress;
    startRun(skipIntro?: boolean): Promise<void>;
    autopilot(style: string | null): void;
    advance(sec: number): void;
    frames(n: number, dt?: number): void;
  };
};
const api = (page: Page) => page.evaluate(() => (window as unknown as MW).__skifree.progress());

const NOW = Date.parse('2026-11-01T10:00:00Z');
const V1 = {
  version: 1,
  achievements: { 'not-today-yeti': { earnedAt: NOW }, 'close-shave-from-the-future': { earnedAt: NOW } },
  stats: { counters: { pizzaMeters: 400 }, sets: {} },
};

async function boot(page: Page, progress: unknown = V1) {
  await page.addInitScript((p) => {
    if (!sessionStorage.getItem('booted')) {
      sessionStorage.setItem('booted', '1');
      localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ quality: 'low', course: 'classic', courseLength: 'sprint' }));
      if (p) localStorage.setItem('skifree-tld.progress', JSON.stringify(p));
    }
  }, progress);
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as MW).__ready === true, null, { timeout: 240_000, polling: 1000 });
}

async function press(page: Page, key: string) {
  await page.keyboard.press(key);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function pad(page: Page, button: number) {
  for (const b of [button, -1]) {
    await page.evaluate((bb) => {
      const buttons = Array.from({ length: 17 }, (_, i) => ({ value: i === bb ? 1 : 0, pressed: i === bb }));
      (window as unknown as MW).__skifree.setInputPads(() => [{ id: 'Xbox Wireless Controller (STANDARD GAMEPAD)', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons }]);
    }, b);
    await page.waitForTimeout(300);
  }
}

async function layout(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.menu-root:not(.hidden) .menu-panel')!;
    const grid = document.querySelector('.ach-grid');
    const rows = [...document.querySelectorAll('.menu-root:not(.hidden) .menu-row')].map((e) => e.getBoundingClientRect());
    const cards = [...document.querySelectorAll('.ach-card')].map((e) => e.getBoundingClientRect());
    return {
      panelScroll: panel.scrollHeight - panel.clientHeight,
      gridScroll: grid ? grid.scrollHeight - grid.clientHeight : 0,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      overflowY: document.documentElement.scrollHeight - innerHeight,
      rowsOutside: rows.filter((q) => q.top < 0 || q.bottom > innerHeight + 0.5).length,
      cardsOutside: cards.filter((q) => q.top < 0 || q.bottom > innerHeight + 0.5 || q.right > innerWidth).length,
    };
  });
}

test.describe.configure({ mode: 'serial' });

test('Achievements + Locker: layout, keyboard/mouse/gamepad, v1 save migration, equip persists and recolours the skier', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page);
  // the v1 save was migrated in memory (v2 shape, reward granted) — in ?debug nothing is written back
  let p = await api(page);
  expect(p.saved.version).toBe(2);
  expect(p.saved.cosmetics.owned['jacket.glacier-blue']).toBeTruthy();
  expect(p.saved.achievements['close-shave-from-the-future']).toBeTruthy();
  expect(p.jacket).toBe(0xc8302a);

  // the main menu still fits with the Achievements row
  for (const mode of ['classic', 'daily', 'custom']) {
    await page.evaluate((m) => (window as unknown as MW).__skifree.setCourse(m, 'sprint'), mode);
    expect(await layout(page), `main ${mode}`).toMatchObject({ panelScroll: 0, overflowX: 0, overflowY: 0, rowsOutside: 0 });
  }
  await page.evaluate(() => (window as unknown as MW).__skifree.setCourse('classic', 'sprint'));
  await expect(page.locator('.menu-row', { hasText: 'Achievements' }).locator('.hint')).toHaveText(/^1 \/ \d+$/);

  // keyboard: focus Achievements, Enter
  expect(await page.evaluate(() => (window as unknown as MW).__skifree.menuFocus('Achievements'))).toBe(true);
  await press(page, 'Enter');
  expect(await page.evaluate(() => (window as unknown as MW).__skifree.menuId())).toBe('achievements');
  await expect(page.locator('.ach-card')).toHaveCount(12);
  await expect(page.locator('.ach-card.earned')).toHaveCount(1);
  await expect(page.locator('.ach-card.earned .ach-name')).toHaveText('Not Today, Yeti');
  await expect(page.locator('.ach-card[data-id="pizza-party"] .ach-count')).toHaveText('400 / 1,000 m');
  await expect(page.locator('.ach-card.secret .ach-name')).toHaveText('???');
  // (Fjord Coast build: Scenic Route is earnable — only the three achievements of the locations still to come wait)
  await expect(page.locator('.ach-card.future')).toHaveCount(3);
  await expect(page.locator('.ach-card.future[data-id="scenic-route"]')).toHaveCount(0);
  await expect(page.locator('.menu-subtitle')).toContainText('1 / 12 earned');
  for (const [w, h] of [
    [1366, 768],
    [1920, 1080],
    [1280, 720],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
    const l = await layout(page);
    expect(l, `achievements ${w}x${h}`).toMatchObject({ panelScroll: 0, overflowX: 0, overflowY: 0, rowsOutside: 0 });
    if (w >= 1366) expect(l, `no inner scrolling at ${w}x${h}`).toMatchObject({ gridScroll: 0, cardsOutside: 0 });
    await page.screenshot({ path: `docs/reviews/pass4/achievements/achievements_${w}x${h}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
  // Escape goes back; gamepad A re-enters; gamepad B goes back
  await press(page, 'Escape');
  expect(await page.evaluate(() => (window as unknown as MW).__skifree.menuId())).toBe('main');
  await page.evaluate(() => (window as unknown as MW).__skifree.menuFocus('Achievements'));
  await pad(page, 0);
  expect(await page.evaluate(() => (window as unknown as MW).__skifree.menuId())).toBe('achievements');
  await expect(page.locator('.menu-row.focus .label')).toHaveText('Locker');
  await pad(page, 1);
  expect(await page.evaluate(() => (window as unknown as MW).__skifree.menuId())).toBe('main');

  // mouse: Achievements → Locker
  await page.locator('.menu-row', { hasText: 'Achievements' }).click();
  await page.locator('.menu-row', { hasText: 'Locker' }).click();
  expect(await page.evaluate(() => (window as unknown as MW).__skifree.menuId())).toBe('locker');
  expect(await layout(page)).toMatchObject({ panelScroll: 0, overflowX: 0, overflowY: 0, rowsOutside: 0 });
  await expect(page.locator('.menu-row.focus .label')).toContainText('Jacket');
  await expect(page.locator('.menu-row.focus .val')).toHaveText('Summit Red');
  await expect(page.locator('.locker-locked')).toHaveCount(1); // Pesto Green still locked
  // keyboard: right → Glacier Blue (owned via the migrated achievement); saved + applied to the model
  await press(page, 'ArrowRight');
  await expect(page.locator('.menu-row.focus .val')).toHaveText('Glacier Blue');
  p = await api(page);
  expect(p.saved.cosmetics.equipped).toEqual({ jacket: 'jacket.glacier-blue' });
  expect(p.jacket).toBe(0x2f6db5);
  await page.screenshot({ path: 'docs/reviews/pass4/achievements/locker_glacier_blue.png' });
  // only owned jackets cycle: right again wraps to Summit Red, then back to Glacier Blue
  await press(page, 'ArrowRight');
  await expect(page.locator('.menu-row.focus .val')).toHaveText('Summit Red');
  await press(page, 'ArrowRight');
  await expect(page.locator('.menu-row.focus .val')).toHaveText('Glacier Blue');
  // the choice (a player action, not an award) survives a reload, as a v2 save
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('skifree-tld.progress')!));
  expect(stored.version).toBe(2);
  expect(stored.achievements['close-shave-from-the-future']).toBeTruthy(); // unknown id preserved
  await page.reload();
  await page.waitForFunction(() => (window as unknown as MW).__ready === true, null, { timeout: 240_000, polling: 1000 });
  p = await api(page);
  expect(p.saved.cosmetics.equipped.jacket).toBe('jacket.glacier-blue');
  expect(p.jacket).toBe(0x2f6db5);
});

test('an automated ?debug run reports unlocks but never persists them', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  await boot(page, null);
  expect(await page.evaluate(() => localStorage.getItem('skifree-tld.progress'))).toBe(null);
  await page.evaluate(() => (window as unknown as MW).__skifree.startRun(true));
  await page.evaluate(() => (window as unknown as MW).__skifree.frames(2));
  let p = await api(page);
  expect(p.attached).toBe(true);
  expect(p.persisting).toBe(false); // ?debug harness
  // the skilled autopilot skis the 3 km course: cave, chase, escape at the finish
  await page.evaluate(() => {
    const s = (window as unknown as MW).__skifree;
    s.autopilot('skilled');
    s.advance(200);
  });
  expect((await page.evaluate(() => (window as unknown as MW).__skifree.state())).session?.phase).toBe('caveCinematic');
  // play the (first, unskippable) cave cinematic out, then ski the chase to the finish
  for (let i = 0; i < 40 && (await page.evaluate(() => (window as unknown as MW).__skifree.state())).session?.phase === 'caveCinematic'; i++)
    await page.evaluate(() => (window as unknown as MW).__skifree.frames(60));
  expect((await page.evaluate(() => (window as unknown as MW).__skifree.state())).session?.phase).toBe('chase');
  await page.evaluate(() => (window as unknown as MW).__skifree.advance(200));
  expect((await page.evaluate(() => (window as unknown as MW).__skifree.state())).session?.outcome).toBe('victory');
  p = await api(page);
  for (const t of ['RunStarted', 'BiomeVisited', 'DistanceReached', 'YetiEncountered', 'YetiEscaped', 'RunFinished']) expect(p.events, t).toContain(t);
  expect(p.toast).toContain('not saved');
  expect(p.saved.achievements).toEqual({});
  await page.evaluate(() => (window as unknown as MW).__skifree.frames(500));
  await page.waitForFunction(() => (window as unknown as MW).__skifree.state().menu === 'results');
  expect(await page.evaluate(() => (window as unknown as MW).__skifree.pressMenu('Main Menu'))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('skifree-tld.progress'))).toBe(null);
  await expect(page.locator('.menu-row', { hasText: 'Achievements' }).locator('.hint')).toHaveText(/^0 \/ \d+$/);
});
