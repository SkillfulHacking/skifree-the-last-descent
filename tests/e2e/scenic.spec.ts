/**
 * Scenic Route: the real player journey on the Fjord Coast, WITHOUT ?debug (the persist policy
 * only commits unassisted play):
 *  - an existing player's save (3 earned, a jacket, stats) is loaded;
 *  - Fjord Coast is chosen in the menu with the keyboard, the run is started and the intro skipped;
 *  - the skier is steered with the keyboard (two short taps of Right, then Left) to the first
 *    viewpoint on the cliff rim of The Last Descent (Sprint), ~150 m down the run-in;
 *  - the "VIEWPOINT DISCOVERED" trick, the caption and the "Scenic Route" toast appear;
 *  - the unlock is in the save, the earlier achievements / jacket / stats are untouched;
 *  - after Exit to Menu and a reload, the Achievements screen shows Scenic Route as earned.
 *
 * Software rendering runs far below real time, so the page clock is driven by Playwright
 * (page.clock): game time advances in exact 1/60 s frames and key presses land between frames.
 * The key schedule was planned in the headless physics (the same SkierPhysics) and passes within
 * ~9 m of the viewpoint's centre for timing errors of ±0.15 s (discovery radius 14 m); a second
 * schedule is tried after a Restart if the first one misses.
 */
import { test, expect, type Page } from '@playwright/test';
import { focusRow, press } from './keyboard-menu';

const KEY_S = 'skifree-tld.settings.v1';
const KEY_P = 'skifree-tld.progress';
const KEY_R = 'skifree-tld.records.v2';
const OUT = 'docs/reviews/biomes/fjord/round-4/scenic-journey';
const T0 = Date.parse('2026-11-08T17:30:00Z');

/** a returning Alpine player: Location is still Alpine, so the menu choice below is real */
const SETTINGS = { quality: 'low', course: 'classic', courseLength: 'sprint', showTutorial: false, biome: 'alpine' };
const SAVE = {
  version: 2,
  achievements: { 'first-descent': { earnedAt: T0 - 3 * 86_400_000 }, 'not-today-yeti': { earnedAt: T0 - 2 * 86_400_000 }, airborne: { earnedAt: T0 } },
  stats: { counters: { pizzaMeters: 400, wins: 2, snowballsDodged: 4 }, sets: { dailyDays: ['2026-11-07'], biomesVisited: ['alpine'] } },
  cosmetics: { owned: { 'jacket.glacier-blue': { at: T0 - 2 * 86_400_000, source: 'achievement:not-today-yeti' } }, equipped: { jacket: 'jacket.glacier-blue' } },
};

/** [start s, end s, key] from the end of the intro; planned in tests/unit/fjord_scenic_schedule.test.ts */
const SCHEDULES: [number, number, 'ArrowRight' | 'ArrowLeft'][][] = [
  [[1.5, 1.7, 'ArrowRight'], [7.7, 7.8, 'ArrowLeft']],
  [[1.0, 1.5, 'ArrowRight'], [4.5, 5.0, 'ArrowLeft']],
];
const FRAME = 1000 / 60;

const ready = (page: Page) => page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 240_000, polling: 1000 });
const progress = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), KEY_P);
/** menu navigation while the page clock is paused: advance the clock instead of waiting for frames */
async function pressP(page: Page, key: string) {
  await page.keyboard.press(key);
  await page.clock.runFor(FRAME * 3);
}
async function focusRowP(page: Page, label: RegExp) {
  for (let i = 0; i < 40; i++) {
    const cur = (await page.locator('.menu-root:not(.hidden) .menu-row.focus .label').first().textContent())?.trim() ?? '';
    if (label.test(cur)) return;
    await pressP(page, 'ArrowDown');
  }
  throw new Error(`menu row ${label} not reachable by keyboard`);
}
const hasScenic = async (page: Page) => !!(await progress(page))?.achievements?.['scenic-route'];

test('Scenic Route: choose Fjord Coast, ski to a viewpoint, unlock, toast, Achievements, survives a reload (no ?debug)', async ({ page }) => {
  test.setTimeout(120 * 60 * 1000);
  await page.setViewportSize({ width: 640, height: 360 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const rec = (bestTime: number | null, bestScore: number, bestDistance: number, bestSurvival: number, runs: number, wins: number) => ({ bestTime, bestScore, bestDistance, bestSurvival, runs, wins, seenCaveCinematic: true });
  const BOOK = { seenCaveCinematic: true, courses: { 'CLASSIC-SPR': rec(158.4, 18420, 3000, 74.2, 7, 4), 'CLASSIC-STD': rec(512.9, 61230, 10000, 402.5, 3, 1) } };
  const records = JSON.stringify(BOOK);
  await page.addInitScript(
    (s) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.clear();
        for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
      }
    },
    { [KEY_S]: JSON.stringify(SETTINGS), [KEY_P]: JSON.stringify(SAVE), [KEY_R]: records },
  );
  await page.clock.install();
  await page.goto('/');
  await ready(page);
  expect(await page.evaluate(() => 'progress' in ((window as unknown as { __skifree?: object }).__skifree ?? {}))).toBe(false);
  await page.evaluate(() => {
    const seen: string[] = ((window as unknown as { __toasts: string[] }).__toasts = []);
    const tricks: string[] = ((window as unknown as { __tricks: string[] }).__tricks = []);
    const caps: string[] = ((window as unknown as { __caps: string[] }).__caps = []);
    new MutationObserver(() => {
      const n = document.querySelector('.ach-toast-name')?.textContent;
      if (n && !seen.includes(n)) seen.push(n);
      const t = document.querySelector('.hud-trick')?.textContent;
      if (t && !tricks.includes(t)) tricks.push(t);
      const c = document.querySelector('.hud-caption')?.textContent;
      if (c && !caps.includes(c)) caps.push(c);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });

  // choose Fjord Coast in the menu, as a player would
  await focusRow(page, 'Location');
  for (let i = 0; i < 6 && !/Fjord/.test((await page.locator('.menu-row.focus .val').textContent()) ?? ''); i++) await press(page, 'ArrowRight');
  await expect(page.locator('.menu-row.focus .val')).toContainText('Fjord');
  await page.screenshot({ path: `${OUT}/01_menu_fjord.png` });
  expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY_S)) ?? '{}').biome).toBe('fjord');

  let unlocked = false;
  for (let attempt = 0; attempt < SCHEDULES.length && !unlocked; attempt++) {
    if (attempt === 0) {
      await focusRow(page, 'Start');
      await press(page, 'Enter');
      await page.waitForSelector('.hud:not(.hidden)', { timeout: 600_000 });
      // from here the page clock is driven by the test
      await page.clock.pauseAt(await page.evaluate(() => Date.now() + 3000)); // a little ahead: SwiftShader frames are slow
    } else {
      // pause → Restart (same course)
      await page.keyboard.press('Escape');
      await page.clock.runFor(500);
      await focusRowP(page, /^(Restart|Retry)/);
      await pressP(page, 'Enter');
      for (let i = 0; i < 300 && !(await page.locator('.hud:not(.hidden)').count()); i++) await page.clock.runFor(200);
    }
    await page.clock.runFor(1500);
    await page.keyboard.press('Enter'); // skip the intro
    await page.clock.runFor(FRAME * 2);
    // drive the schedule in exact frames
    const sched = SCHEDULES[attempt]!;
    let held: string | null = null;
    for (let f = 0; f < 60 * 40; f++) {
      const t = f / 60;
      const want = sched.find(([a, b]) => t >= a && t < b)?.[2] ?? null;
      if (want !== held) {
        if (held) await page.keyboard.up(held);
        if (want) await page.keyboard.down(want);
        held = want;
      }
      await page.clock.runFor(FRAME);
      if (f % 60 === 59) {
        unlocked = await hasScenic(page);
        console.log(`[scenic ${attempt}] t=${t.toFixed(1)} ${await page.locator('.hud-speed').textContent()} km/h, ${await page.locator('.hud-dist').textContent()} to go, unlocked=${unlocked}`);
        if (unlocked) break;
      }
    }
    if (held) await page.keyboard.up(held);
  }
  expect(unlocked, 'Scenic Route committed by real play').toBe(true);
  // let the toast animate in, then capture it
  await page.clock.runFor(600);
  await page.screenshot({ path: `${OUT}/02_viewpoint_toast.png` });
  const w = await page.evaluate(() => {
    const g = window as unknown as { __toasts: string[]; __tricks: string[]; __caps: string[] };
    return { toasts: g.__toasts, tricks: g.__tricks, caps: g.__caps };
  });
  console.log(JSON.stringify(w));
  expect(w.toasts).toContain('Scenic Route');
  expect(w.tricks.join(' ')).toMatch(/VIEWPOINT DISCOVERED/);
  expect(w.caps.join(' ')).toMatch(/viewpoint/);

  // the save: new unlock added, everything earlier untouched
  const p = await progress(page);
  expect(p.version).toBe(2);
  expect(typeof p.achievements['scenic-route'].earnedAt).toBe('number');
  for (const id of Object.keys(SAVE.achievements)) expect(p.achievements[id]).toEqual(SAVE.achievements[id as keyof typeof SAVE.achievements]);
  expect(p.cosmetics.owned['jacket.glacier-blue']).toEqual(SAVE.cosmetics.owned['jacket.glacier-blue']);
  expect(p.cosmetics.equipped).toEqual({ jacket: 'jacket.glacier-blue' });
  expect(p.stats.counters.wins).toBe(2);
  expect(p.stats.sets.biomesVisited).toEqual(expect.arrayContaining(['alpine', 'fjord']));
  expect(p.stats.sets.scenic?.length ?? 0).toBeGreaterThanOrEqual(1);

  // leave the run, reload, check the Achievements screen
  await page.keyboard.press('Escape');
  await page.clock.runFor(500);
  await focusRowP(page, /^Exit to Menu/);
  await pressP(page, 'Enter');
  await page.clock.runFor(500);
  await page.clock.resume();
  await page.reload();
  await ready(page);
  // personal bests on the Alpine courses untouched (the Fjord run may add its own entry)
  const book = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY_R)) ?? '{}');
  expect(book.courses['CLASSIC-SPR']).toEqual(BOOK.courses['CLASSIC-SPR']);
  expect(book.courses['CLASSIC-STD']).toEqual(BOOK.courses['CLASSIC-STD']);
  await expect(page.locator('.menu-row', { hasText: 'Achievements' }).locator('.hint')).toHaveText('4 / 12');
  await focusRow(page, 'Achievements');
  await press(page, 'Enter');
  await expect(page.locator('.ach-card[data-id="scenic-route"]')).toHaveClass(/earned/);
  await expect(page.locator('.ach-card[data-id="scenic-route"] .ach-earned')).toContainText('Earned');
  await page.locator('.ach-card[data-id="scenic-route"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/03_achievements_after_reload.png` });
  expect(errors).toEqual([]);
});
