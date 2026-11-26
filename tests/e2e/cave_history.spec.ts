/**
 * Round 4, owner's decision B: each location keeps its own cave-cinematic history, in the real game.
 * A player with an old save (the global flag, earned on Alpine) who has never visited Fjord or
 * Whiteout: the first Whiteout viewing can only be paused (Escape), its completion marks Whiteout and
 * nothing else, it survives a reload, the next Whiteout encounter is skippable, a Fjord cinematic
 * abandoned part-way (restart) does not count, and every record and unknown field of the save is kept.
 */
import { test, expect, type Page } from '@playwright/test';

type W = {
  state(): { mode: string; session: { phase: string } | null };
  startRun(skipIntro?: boolean): Promise<void>;
  advance(sec: number): void;
  framesLive(n: number, dt?: number): void;
  hold(v: boolean): void;
  autopilot(style: string | null): void;
  caveHistory(): { book: Record<string, boolean>; legacy: boolean; stored: string | null };
  pressMenu(label: string): boolean;
  setCourse(mode: string, length: string, opts?: { custom?: string; difficulty?: string; biome?: string }): string;
};
const K = (page: Page) => page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.state());
const hist = (page: Page) => page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.caveHistory());

const OLD_SAVE = {
  seenCaveCinematic: true,
  futureFlag: { kept: 1 },
  courses: { 'CLASSIC-STD': { bestTime: 401.5, bestScore: 4321, bestDistance: 10000, bestSurvival: 380, runs: 5, wins: 2, seenCaveCinematic: true, ghost: [1, 2] } },
};

async function boot(page: Page, biome: string, seed: boolean) {
  await page.addInitScript(
    ([b, save, sd]) => {
      // the settings follow the test (location); the old save is written once, as an older build left it
      localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ course: 'classic', courseLength: 'sprint', biome: b, difficulty: 'normal', showTutorial: false }));
      if (sd && !sessionStorage.getItem('saved')) {
        sessionStorage.setItem('saved', '1');
        localStorage.setItem('skifree-tld.records.v2', save);
      }
    },
    [biome, JSON.stringify(OLD_SAVE), seed] as const,
  );
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 240_000, polling: 1000 });
}

async function toCave(page: Page) {
  await page.evaluate(async () => {
    const k = (window as unknown as { __skifree: W }).__skifree;
    await k.startRun(true);
    k.hold(true);
    k.autopilot('skilled');
    k.advance(200);
    k.autopilot(null);
    k.framesLive(30, 1 / 30);
  });
  expect((await K(page)).session!.phase).toBe('caveCinematic');
}

async function escape(page: Page) {
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.framesLive(2, 1 / 30));
}

test.describe.configure({ mode: 'serial' });

test('old save: Alpine history kept; Whiteout first viewing pauses, completes, persists and is skippable after; Fjord abandoned part-way is not counted', async ({ page }) => {
  test.setTimeout(90 * 60 * 1000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // 1) the old save migrates: Alpine seen (the flag and Alpine runs), Fjord and Whiteout not
  await boot(page, 'whiteout', true);
  let h = await hist(page);
  expect(h.book).toEqual({ alpine: true });

  // 2) Whiteout's first viewing: Escape pauses, it does not skip
  await toCave(page);
  await escape(page);
  expect((await K(page)).mode).toBe('paused');
  expect((await K(page)).session!.phase).toBe('caveCinematic');
  expect((await hist(page)).book.whiteout, 'not seen while paused').toBeUndefined();
  await page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.hold(false));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as unknown as { __skifree: W }).__skifree.state().mode === 'playing');
  await page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.hold(true));
  // watched to the end
  await page.evaluate(() => {
    const k = (window as unknown as { __skifree: W }).__skifree;
    for (let i = 0; i < 900 && k.state().session!.phase === 'caveCinematic'; i++) k.framesLive(1, 1 / 30);
  });
  expect((await K(page)).session!.phase).toBe('chase');
  h = await hist(page);
  expect(h.book).toEqual({ alpine: true, whiteout: true });
  const stored = JSON.parse(h.stored!);
  expect(stored.seenCave).toEqual({ alpine: true, whiteout: true });
  expect(stored.futureFlag).toEqual({ kept: 1 });
  expect(stored.courses['CLASSIC-STD'].bestScore).toBe(4321);
  expect(stored.courses['CLASSIC-STD'].bestTime).toBe(401.5);
  expect(stored.courses['CLASSIC-STD'].ghost).toEqual([1, 2]);

  // 3) reload: kept; the next Whiteout encounter is skippable (Escape skips straight to the chase)
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 240_000, polling: 1000 });
  expect((await hist(page)).book).toEqual({ alpine: true, whiteout: true });
  await toCave(page);
  await escape(page);
  expect((await K(page)).mode).toBe('playing');
  expect((await K(page)).session!.phase).toBe('chase');

  // 4) Fjord, never visited: its first viewing pauses on Escape; abandoned part-way (restart), not counted
  await boot(page, 'fjord', false);
  expect((await hist(page)).book).toEqual({ alpine: true, whiteout: true });
  await toCave(page);
  await escape(page);
  expect((await K(page)).mode, 'Fjord first viewing: Escape pauses').toBe('paused');
  await page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.hold(false));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as unknown as { __skifree: W }).__skifree.state().mode === 'playing');
  await page.evaluate(async () => {
    const k = (window as unknown as { __skifree: W }).__skifree;
    k.hold(true);
    k.framesLive(120, 1 / 30); // part of the cinematic
    await k.startRun(true); // restart: the cinematic is abandoned
  });
  expect((await hist(page)).book.fjord, 'abandoned part-way: not seen').toBeUndefined();
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 240_000, polling: 1000 });
  const after = await hist(page);
  expect(after.book).toEqual({ alpine: true, whiteout: true });
  expect(JSON.parse(after.stored!).seenCave).toEqual({ alpine: true, whiteout: true });

  expect(errors).toEqual([]);
});

// (Round 5, review E4-9) the pause menu's Restart Run and Exit to Menu before the first viewing completes
// do not mark the location seen; a completed viewing then holds across another seed, length and difficulty
test('pause-menu Restart Run / Exit to Menu mid-cinematic leave it unseen; seed, length and difficulty do not reset it', async ({ page }) => {
  test.setTimeout(60 * 60 * 1000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await boot(page, 'whiteout', false);
  expect((await hist(page)).book.whiteout).toBeUndefined();
  for (const choice of ['Restart Run', 'Exit to Menu']) {
    await toCave(page);
    await escape(page);
    expect((await K(page)).mode, `${choice}: first viewing, Escape pauses`).toBe('paused');
    expect(await page.evaluate((c) => (window as unknown as { __skifree: W }).__skifree.pressMenu(c), choice), `${choice} is on the pause menu`).toBe(true);
    await page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.framesLive(2, 1 / 30));
    expect((await hist(page)).book.whiteout, `${choice} part-way: not seen`).toBeUndefined();
  }
  // watched to the end: seen
  await toCave(page);
  await page.evaluate(() => {
    const k = (window as unknown as { __skifree: W }).__skifree;
    for (let i = 0; i < 900 && k.state().session!.phase === 'caveCinematic'; i++) k.framesLive(1, 1 / 30);
  });
  expect((await K(page)).session!.phase).toBe('chase');
  expect((await hist(page)).book.whiteout).toBe(true);
  // another seed, length and difficulty on the same location: still seen, Escape skips
  await page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.setCourse('custom', 'standard', { custom: 'ROUND5', difficulty: 'hard', biome: 'whiteout' }));
  await toCave(page);
  await escape(page);
  expect((await K(page)).mode, 'another seed/length/difficulty: Escape skips (seen)').toBe('playing');
  expect((await K(page)).session!.phase).toBe('chase');
  expect((await hist(page)).book).toEqual({ whiteout: true });
  expect(errors).toEqual([]);
});
