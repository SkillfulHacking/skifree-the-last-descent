/**
 * Save migration (pass 4 release verification). Runs WITHOUT ?debug, exactly as a returning player
 * opens the deployed build:
 *  - a representative Pass 3 save (settings v1, record book v2 with several course codes incl.
 *    Daily and custom seeds, the legacy records v1 key, seenCaveCinematic, NO progress key) loads
 *    with settings and records untouched, achievements fresh, and the game still playable;
 *  - a v1 progress save is migrated to v2 (rewards of earned achievements granted, unknown ids and
 *    keys preserved, stats kept) and written back as v2 by the first legitimate commit.
 * The Pass 3 formats are those of `main` at aadc93e (src/core/settings.ts: Settings, RecordBook).
 */
import { test, expect, type Page } from '@playwright/test';
import { focusRow, press } from './keyboard-menu';

const KEY_S = 'skifree-tld.settings.v1';
const KEY_R1 = 'skifree-tld.records.v1';
const KEY_RB = 'skifree-tld.records.v2';
const KEY_P = 'skifree-tld.progress';

const DAY = 86_400_000;
const T0 = Date.parse('2026-11-01T18:00:00Z');

/** A returning Pass 3 player: every Settings field (non-default where it is safe to be), custom keys. */
const PASS3_SETTINGS = {
  quality: 'low',
  renderScale: 0.9,
  masterVolume: 0.65,
  musicVolume: 0.4,
  sfxVolume: 0.85,
  cameraShake: 0.6,
  reduceFlashes: true,
  reduceCameraMotion: false,
  invertCameraY: true,
  invertCameraX: false,
  steerSensitivity: 1.15,
  cameraSensitivity: 1.2,
  deadzone: 0.18,
  showFps: false,
  showTutorial: false, // the tutorial retired itself after the first run
  uiScale: 1,
  rearView: true,
  captions: false,
  course: 'custom',
  courseLength: 'sprint',
  customSeed: 'AVALANCHE',
  dailyDate: null,
  difficulty: 'hard',
  biome: 'alpine',
  bindings: {
    left: ['KeyA', 'ArrowLeft', 'KeyJ'],
    right: ['KeyD', 'ArrowRight', 'KeyL'],
    tuck: ['KeyW', 'ArrowUp'],
    brake: ['KeyS', 'ArrowDown'],
    drift: ['ShiftLeft', 'ShiftRight'],
    pop: ['Space'],
    recover: ['KeyR'],
    lookback: ['KeyC'],
    pause: ['Escape', 'KeyP'],
    skip: ['Escape', 'Enter'],
  },
};

const rec = (bestTime: number | null, bestScore: number, bestDistance: number, bestSurvival: number, runs: number, wins: number) => ({ bestTime, bestScore, bestDistance, bestSurvival, runs, wins, seenCaveCinematic: true });
/** Pass 3 record book: Classic, Daily (incl. Hard and a past day), custom seeds (hashed text + plain number), Endless. */
const PASS3_BOOK = {
  seenCaveCinematic: true,
  courses: {
    'CLASSIC-SPR': rec(158.4, 18420, 3000, 74.2, 7, 4),
    'CLASSIC-STD': rec(512.9, 61230, 10000, 402.5, 3, 1),
    'CLASSIC-SPR-H': rec(null, 9120, 2210.5, 61.3, 2, 0),
    'DAILY-2026-11-01-SPR': rec(151.2, 19977, 3000, 70.1, 2, 2),
    'DAILY-2026-11-07-STD-H': rec(null, 40110, 7480.2, 299.9, 1, 0),
    'SEED-3803621719-SPR-H': rec(149.8, 21004, 3000, 71.7, 5, 3), // AVALANCHE, Hard
    'SEED-1234567-END': rec(1040.6, 133000, 20000, 870.4, 1, 1),
    'SEED-4055206780-ENDLESS': rec(null, 88000, 14211.9, 655, 4, 0), // POWDER Endless (banked runs)
  },
};
/** the pre-course-records key Pass 3 still left behind for players from Pass 1 (ignored once v2 exists) */
const PASS3_LEGACY_R1 = { bestTime: 171.0, bestScore: 15000, bestDistance: 3000, bestSurvival: 70, runs: 12, wins: 5, seenCaveCinematic: true };

type Store = Record<string, string>;

async function seedAndOpen(page: Page, store: Store, url = '/') {
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.clear();
      for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    }
  }, store);
  await page.goto(url);
  await waitReady(page);
}

async function waitReady(page: Page) {
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 240_000, polling: 1000 });
}

const dump = (page: Page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)!])));

test.describe.configure({ mode: 'serial' });

test('a Pass 3 save (settings + per-course records, no progress key) loads unchanged in the pass-4 build and stays playable', async ({ page }) => {
  test.setTimeout(40 * 60 * 1000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const seeded: Store = { [KEY_S]: JSON.stringify(PASS3_SETTINGS), [KEY_RB]: JSON.stringify(PASS3_BOOK), [KEY_R1]: JSON.stringify(PASS3_LEGACY_R1) };
  await seedAndOpen(page, seeded);

  // nothing is rewritten or lost by loading; no progress save is created just by opening the game
  let after = await dump(page);
  expect(JSON.parse(after[KEY_S]!)).toEqual(PASS3_SETTINGS);
  expect(JSON.parse(after[KEY_RB]!)).toEqual(PASS3_BOOK);
  expect(after[KEY_R1]).toBe(seeded[KEY_R1]);
  expect(after[KEY_P]).toBeUndefined();
  expect(Object.keys(after).sort()).toEqual(Object.keys(seeded).sort());

  // the menu shows the stored course choice and its Pass 3 personal best; achievements start fresh
  await expect(page.locator('.course-card .code')).toHaveText('SEED-3803621719-SPR-H');
  await expect(page.locator('.course-card .rec')).toContainText('Best 21,004 pts · 2:29.8');
  await expect(page.locator('.course-card .rec')).toContainText('5 runs');
  await expect(page.locator('.menu-row', { hasText: 'Yeti' }).locator('.val')).toHaveText(/Hard/);
  await expect(page.locator('.menu-row', { hasText: 'Achievements' }).locator('.hint')).toHaveText('0 / 12');
  await focusRow(page, 'Achievements');
  await press(page, 'Enter');
  await expect(page.locator('.ach-card')).toHaveCount(12);
  await expect(page.locator('.ach-card.earned')).toHaveCount(0);
  await expect(page.locator('.menu-subtitle')).toContainText('0 / 12 earned');
  await expect(page.locator('.menu-subtitle')).not.toContainText('read-only');
  await press(page, 'Escape');

  // other stored courses keep their records: switch Mountain to Classic with the keyboard (Hard stays)
  await focusRow(page, 'Mountain');
  await press(page, 'ArrowLeft'); // custom → daily
  await press(page, 'ArrowLeft'); // daily → classic
  await expect(page.locator('.course-card .code')).toHaveText('CLASSIC-SPR-H');
  await expect(page.locator('.course-card .rec')).toContainText('Best 9,120 pts');
  await expect(page.locator('.course-card .rec')).toContainText('2 runs');

  // playable: Start with the keyboard, skip the intro, ski with a custom key, pause, exit
  await focusRow(page, 'Start');
  await press(page, 'Enter');
  await page.waitForSelector('.hud:not(.hidden)', { timeout: 600_000 });
  await page.waitForTimeout(1500);
  await press(page, 'Space'); // skip the intro
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyJ'); // a Pass 3 custom binding (steer left)
  await page.waitForTimeout(4000);
  await page.keyboard.up('KeyJ');
  await page.waitForTimeout(4000);
  await page.keyboard.up('KeyW');
  // software rendering runs far below real time: the skier is moving and scoring (distance shows 0.1 km steps)
  await expect(page.locator('.hud-score')).not.toHaveText('0');
  await page.screenshot({ path: 'docs/reviews/pass4/release-verification/migration_pass3_playing.png' });
  await press(page, 'Escape');
  await expect(page.locator('.menu-root:not(.hidden) .menu-title')).toBeVisible();
  await focusRow(page, 'Exit to Menu');
  await press(page, 'Enter');
  await expect(page.locator('.course-card .code')).toHaveText('CLASSIC-SPR-H');

  // after a real (abandoned) run: every record intact, settings only changed by the player's course choice,
  // and the first progress save is a fresh v2 save (no achievements: none were earned)
  after = await dump(page);
  expect(JSON.parse(after[KEY_RB]!)).toEqual(PASS3_BOOK);
  expect(after[KEY_R1]).toBe(seeded[KEY_R1]);
  expect(JSON.parse(after[KEY_S]!)).toEqual({ ...PASS3_SETTINGS, course: 'classic' });
  if (after[KEY_P] !== undefined) {
    const p = JSON.parse(after[KEY_P]!);
    expect(p.version).toBe(2);
    expect(p.achievements).toEqual({});
    expect(p.cosmetics.owned).toEqual({});
  }
  // and it all survives a reload
  await page.reload();
  await waitReady(page);
  await expect(page.locator('.course-card .code')).toHaveText('CLASSIC-SPR-H');
  await expect(page.locator('.course-card .rec')).toContainText('Best 9,120 pts');
  expect(JSON.parse((await dump(page))[KEY_RB]!)).toEqual(PASS3_BOOK);
  await page.screenshot({ path: 'docs/reviews/pass4/release-verification/migration_pass3_menu_after.png' });
  expect(errors).toEqual([]);
});

test('a v1 progress save migrates to v2 without ?debug: reward granted, unknown data kept, written back as v2', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  const v1 = {
    version: 1,
    achievements: { 'not-today-yeti': { earnedAt: T0 }, 'first-descent': { earnedAt: T0 - DAY }, 'achievement-from-a-newer-build': { earnedAt: T0 } },
    stats: { counters: { pizzaMeters: 400, wins: 3, snowballsDodged: 2 }, sets: { dailyDays: ['2026-11-01'], biomesVisited: ['alpine'] } },
    futureKey: { keep: true },
  };
  const seeded: Store = { [KEY_S]: JSON.stringify(PASS3_SETTINGS), [KEY_RB]: JSON.stringify(PASS3_BOOK), [KEY_P]: JSON.stringify(v1) };
  await seedAndOpen(page, seeded);
  // the screen reads the migrated save
  await expect(page.locator('.menu-row', { hasText: 'Achievements' }).locator('.hint')).toHaveText('2 / 12');
  await focusRow(page, 'Achievements');
  await press(page, 'Enter');
  await expect(page.locator('.ach-card.earned')).toHaveCount(2);
  await expect(page.locator('.ach-card[data-id="not-today-yeti"] .ach-earned')).toContainText('Earned');
  await expect(page.locator('.ach-card[data-id="pizza-party"] .ach-count')).toHaveText('400 / 1,000 m');
  await expect(page.locator('.ach-card[data-id="daily-ritual"] .ach-count')).toHaveText(/^1 \/ 3/);
  await expect(page.locator('.ach-card[data-id="dodgeball"] .ach-count')).toHaveText(/^2 \/ 10/);
  // the migrated Glacier Blue is owned and can be equipped (a legitimate player action → commit)
  await focusRow(page, 'Locker');
  await press(page, 'Enter');
  await expect(page.locator('.menu-row.focus .val')).toHaveText('Summit Red');
  await press(page, 'ArrowRight');
  await expect(page.locator('.menu-row.focus .val')).toHaveText('Glacier Blue');
  const stored = JSON.parse((await dump(page))[KEY_P]!);
  expect(stored.version).toBe(2);
  expect(stored.achievements).toEqual(v1.achievements); // timestamps and unknown ids untouched
  expect(stored.stats).toEqual(v1.stats);
  expect(stored.futureKey).toEqual({ keep: true });
  expect(stored.cosmetics.owned).toEqual({ 'jacket.glacier-blue': { at: T0, source: 'migration:not-today-yeti' } });
  expect(stored.cosmetics.equipped).toEqual({ jacket: 'jacket.glacier-blue' });
  // records and settings untouched by the progress migration
  expect(JSON.parse((await dump(page))[KEY_RB]!)).toEqual(PASS3_BOOK);
  expect(JSON.parse((await dump(page))[KEY_S]!)).toEqual(PASS3_SETTINGS);
  // reload: a v2 save now, loads as such
  await page.reload();
  await waitReady(page);
  await expect(page.locator('.menu-row', { hasText: 'Achievements' }).locator('.hint')).toHaveText('2 / 12');
  expect(JSON.parse((await dump(page))[KEY_P]!)).toEqual(stored);
});
