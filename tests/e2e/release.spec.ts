/**
 * Pass 4 release verification, WITHOUT ?debug (nothing here may be assisted: the persist policy
 * only commits real, unassisted play):
 *  - the Achievements screen shows all 12 achievements (earned / progress / hidden / the four
 *    awaiting future locations) at 1366x768, 1920x1080 and 2560x1440 (screenshots for review);
 *  - an equipped jacket persists across reloads;
 *  - a real unlock (Pizza Party, from a save 10 m short of the goal) through genuine keyboard play,
 *    granting its jacket, persisted and still shown after a reload.
 */
import { test, expect, type Page } from '@playwright/test';
import { focusRow, press } from './keyboard-menu';

const KEY_S = 'skifree-tld.settings.v1';
const KEY_P = 'skifree-tld.progress';
const OUT = 'docs/reviews/pass4/release-verification';
const T0 = Date.parse('2026-11-08T17:30:00Z');

const SETTINGS = { quality: 'low', course: 'classic', courseLength: 'sprint', showTutorial: false };
/** a player a few sessions in: 3 earned, 3 in progress, 1 hidden, 4 awaiting locations, 1 locked */
const SAVE = {
  version: 2,
  achievements: { 'first-descent': { earnedAt: T0 - 3 * 86_400_000 }, 'not-today-yeti': { earnedAt: T0 - 2 * 86_400_000 }, airborne: { earnedAt: T0 } },
  stats: { counters: { pizzaMeters: 990, wins: 2, snowballsDodged: 4 }, sets: { dailyDays: ['2026-11-07'], biomesVisited: ['alpine'] } },
  cosmetics: { owned: { 'jacket.glacier-blue': { at: T0 - 2 * 86_400_000, source: 'achievement:not-today-yeti' } }, equipped: {} },
};

async function open(page: Page, store: Record<string, string>) {
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    }
  }, store);
  await page.goto('/');
  await ready(page);
}
const ready = (page: Page) => page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 240_000, polling: 1000 });
const progress = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY_P);

test.describe.configure({ mode: 'serial' });

test('all 12 achievements display at 1366x768, 1920x1080 and 2560x1440', async ({ page }) => {
  test.setTimeout(40 * 60 * 1000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page, { [KEY_S]: JSON.stringify(SETTINGS), [KEY_P]: JSON.stringify(SAVE) });
  await focusRow(page, 'Achievements');
  await press(page, 'Enter');
  await expect(page.locator('.ach-card')).toHaveCount(12);
  await expect(page.locator('.ach-card.earned')).toHaveCount(3);
  await expect(page.locator('.ach-card.secret .ach-name')).toHaveText('???');
  await expect(page.locator('.ach-card.future')).toHaveCount(4);
  for (const id of ['scenic-route', 'whiteout-survivor', 'ice-dancer', 'steam-runner']) await expect(page.locator(`.ach-card.future[data-id="${id}"] .ach-req`)).toContainText('coming soon');
  await expect(page.locator('.ach-card[data-id="pizza-party"] .ach-count')).toHaveText('990 / 1,000 m');
  await expect(page.locator('.menu-subtitle')).toContainText('3 / 12 earned');
  for (const [w, h] of [
    [1366, 768],
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const l = await page.evaluate(() => {
      const grid = document.querySelector('.ach-grid')!;
      const cards = [...document.querySelectorAll('.ach-card')].map((e) => e.getBoundingClientRect());
      const clipped = [...document.querySelectorAll('.ach-card .ach-name, .ach-card .ach-desc, .ach-card .ach-meta')].filter((e) => e.scrollWidth > e.clientWidth + 1).length;
      return {
        gridScroll: grid.scrollHeight - grid.clientHeight,
        overflowX: document.documentElement.scrollWidth - innerWidth,
        overflowY: document.documentElement.scrollHeight - innerHeight,
        cardsOutside: cards.filter((q) => q.top < 0 || q.left < 0 || q.bottom > innerHeight + 0.5 || q.right > innerWidth + 0.5).length,
        tiny: cards.filter((q) => q.width < 200 || q.height < 40).length,
        clipped,
      };
    });
    expect(l, `${w}x${h}`).toEqual({ gridScroll: 0, overflowX: 0, overflowY: 0, cardsOutside: 0, tiny: 0, clipped: 0 });
    await page.screenshot({ path: `${OUT}/achievements_${w}x${h}.png`, timeout: 600_000 }); // software rendering is slow at 2560x1440
  }
});

test('an equipped jacket persists across reloads (no ?debug)', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  await open(page, { [KEY_S]: JSON.stringify(SETTINGS), [KEY_P]: JSON.stringify(SAVE) });
  await focusRow(page, 'Achievements');
  await press(page, 'Enter');
  await focusRow(page, 'Locker');
  await press(page, 'Enter');
  await expect(page.locator('.menu-row.focus .val')).toHaveText('Summit Red');
  await press(page, 'ArrowRight');
  await expect(page.locator('.menu-row.focus .val')).toHaveText('Glacier Blue');
  expect((await progress(page)).cosmetics.equipped).toEqual({ jacket: 'jacket.glacier-blue' });
  await page.screenshot({ path: `${OUT}/locker_glacier_blue_before_reload.png` });
  for (let i = 0; i < 2; i++) {
    await page.reload();
    await ready(page);
    expect((await progress(page)).cosmetics.equipped).toEqual({ jacket: 'jacket.glacier-blue' });
    await focusRow(page, 'Achievements');
    await press(page, 'Enter');
    await focusRow(page, 'Locker');
    await press(page, 'Enter');
    await expect(page.locator('.menu-row.focus .val')).toHaveText('Glacier Blue');
  }
  await page.screenshot({ path: `${OUT}/locker_glacier_blue_after_reload.png` });
  // the rest of the save is untouched by equipping
  const p = await progress(page);
  expect(p.achievements).toEqual(SAVE.achievements);
  expect(p.stats).toEqual(SAVE.stats);
});

test('a real unlock through keyboard play (Pizza Party) persists, grants its jacket and survives a reload (no ?debug)', async ({ page }) => {
  test.setTimeout(80 * 60 * 1000);
  await page.setViewportSize({ width: 640, height: 360 }); // a small window keeps software rendering near 1-2 fps
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await open(page, { [KEY_S]: JSON.stringify(SETTINGS), [KEY_P]: JSON.stringify(SAVE) });
  expect(await page.evaluate(() => 'progress' in ((window as unknown as { __skifree?: object }).__skifree ?? {}))).toBe(false); // no debug harness
  // record every toast shown (they are short-lived; the loop below polls slowly)
  await page.evaluate(() => {
    const seen: string[] = ((window as unknown as { __toasts: string[] }).__toasts = []);
    new MutationObserver(() => {
      const n = document.querySelector('.ach-toast-name')?.textContent;
      const sub = document.querySelector('.ach-toast-sub')?.textContent ?? '';
      if (n && !seen.includes(`${n}|${sub}`)) seen.push(`${n}|${sub}`);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await focusRow(page, 'Start');
  await press(page, 'Enter');
  await page.waitForSelector('.hud:not(.hidden)', { timeout: 600_000 });
  await page.waitForTimeout(1500);
  await press(page, 'Enter'); // skip the intro
  // ski: tuck (W) until the HUD shows real speed, then hold a pizza wedge (S) until nearly stopped;
  // repeat until the unlock is committed. Software rendering runs at ~1 fps here, so game time
  // advances far slower than real time: the loop is paced by the HUD speedometer, not the clock.
  const kmh = async () => Number((await page.locator('.hud-speed').textContent())?.replace(/[^0-9]/g, '') || 0);
  let unlocked = false;
  const deadline = Date.now() + 55 * 60 * 1000;
  while (!unlocked && Date.now() < deadline) {
    if (await page.locator('.menu-root:not(.hidden) .menu-row', { hasText: 'Retry' }).count()) await press(page, 'Enter'); // caught: Retry
    await page.keyboard.down('KeyW');
    for (let t = Date.now(); Date.now() - t < 240_000 && (await kmh()) < 35; ) await page.waitForTimeout(1000);
    await page.keyboard.up('KeyW');
    const top = await kmh();
    await page.keyboard.down('KeyS');
    for (let t = Date.now(); Date.now() - t < 240_000 && (await kmh()) > 9; ) await page.waitForTimeout(1000);
    await page.keyboard.up('KeyS');
    unlocked = !!(await progress(page))?.achievements?.['pizza-party'];
    console.log(`[pizza loop] ${new Date().toISOString()} tuck→${top} km/h, wedge→${await kmh()} km/h, ${await page.locator('.hud-dist').textContent()} to go, unlocked=${unlocked}`);
  }
  expect(unlocked, 'Pizza Party committed by real play').toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __toasts: string[] }).__toasts)).toContain('Pizza Party|New jacket: Pesto Green (Locker)');
  await page.screenshot({ path: `${OUT}/unlock_toast_pizza_party.png` });
  const p = await progress(page);
  expect(p.version).toBe(2);
  expect(p.stats.counters.pizzaMeters).toBeGreaterThanOrEqual(1000);
  expect(p.cosmetics.owned['jacket.pesto-green'].source).toBe('achievement:pizza-party');
  for (const id of Object.keys(SAVE.achievements)) expect(p.achievements[id]).toEqual(SAVE.achievements[id as keyof typeof SAVE.achievements]);
  // leave the run (pause → Exit to Menu), reload, and check it is still there
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  if (await page.locator('.menu-root:not(.hidden) .menu-row', { hasText: 'Exit to Menu' }).count()) {
    await focusRow(page, 'Exit to Menu');
    await press(page, 'Enter');
  }
  await page.reload();
  await ready(page);
  await expect(page.locator('.menu-row', { hasText: 'Achievements' }).locator('.hint')).toHaveText('4 / 12');
  await focusRow(page, 'Achievements');
  await press(page, 'Enter');
  await expect(page.locator('.ach-card[data-id="pizza-party"]')).toHaveClass(/earned/);
  await expect(page.locator('.ach-card[data-id="pizza-party"] .ach-earned')).toContainText('Earned');
  await page.screenshot({ path: `${OUT}/achievements_after_real_unlock.png` });
  await focusRow(page, 'Locker');
  await press(page, 'Enter');
  await expect(page.locator('.locker-locked')).toHaveCount(0); // every jacket owned now
  for (let i = 0; i < 3 && (await page.locator('.menu-row.focus .val').textContent()) !== 'Pesto Green'; i++) await press(page, 'ArrowRight');
  await expect(page.locator('.menu-row.focus .val')).toHaveText('Pesto Green');
  expect((await progress(page)).cosmetics.equipped).toEqual({ jacket: 'jacket.pesto-green' });
  await page.screenshot({ path: `${OUT}/locker_pesto_green.png` });
  expect(errors).toEqual([]);
});
