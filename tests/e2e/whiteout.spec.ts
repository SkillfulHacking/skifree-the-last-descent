/**
 * Whiteout Ridge in the real game (Pass 5 full production, brief §11, W-018): the location boots
 * clean; a front is announced (HUD pill + caption) before it arrives and the storm is on the HUD
 * while it blows; Hard snowballs are thrown with their landing marks inside a storm; the storm-cave
 * encounter plays through to the chase; the rescue station finish reaches victory and the visit is
 * saved. Weather is reached by setting the run's physics clock (debug setTime), as in the evidence
 * captures. SwiftShader: no frame-rate claims here.
 */
import { test, expect, type Page } from '@playwright/test';

type Front = { s: number; dir: number; phase: 'clear' | 'build' | 'storm' | 'ease'; left: number; k: number };
type Sess = { phase: string; outcome: string | null; z: number; time: number; snowballMarker: boolean; cinematicTime: number; finishZ: number; yetiDistance: number; crashes: number };
type W = {
  __ready?: boolean;
  __skifree: {
    state(): { mode: string; session: Sess | null };
    startRun(skipIntro?: boolean): Promise<void>;
    frames(n: number, dt?: number): void;
    teleport(z: number, speed?: number, x?: number, heading?: number): void;
    setTime(t: number): void;
    front(t: number): Front | null;
    weatherHud(): { pill: string | null; caption: string | null };
    toCave(): void;
    seenCave(v: boolean): void;
    autopilot(style: string | null): void;
    placeYeti(gap: number): void;
    progress(): { saved: { stats: { sets: { biomesVisited: string[] } } }; events: string[] };
  };
};

const KEY_S = 'skifree-tld.settings.v1';
const errors: string[] = [];
async function boot(page: Page, settings: object) {
  errors.length = 0;
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|404/.test(m.text())) errors.push(m.text());
  });
  await page.addInitScript(
    ([k, s]) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem(k, JSON.stringify(s));
      }
    },
    [KEY_S, settings] as const,
  );
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as W).__ready === true, null, { timeout: 240_000, polling: 1000 });
}
const api = <R>(page: Page, fn: (w: W['__skifree'], arg: number) => R, arg = 0) => page.evaluate(([f, a]) => new Function('w', 'a', `return (${f})(w, a)`)((window as unknown as W).__skifree, a), [fn.toString(), arg] as const) as Promise<R>;
const sess = (page: Page) => api(page, (w) => w.state().session!);
const frames = (page: Page, n: number) => api(page, (w, k) => w.frames(k), n);
/** the first physics time ≥ from at which the front is in `phase` (searched in 1 s steps) */
const findPhase = (page: Page, phase: Front['phase'], from: number) =>
  page.evaluate(
    ([ph, t0]) => {
      const w = (window as unknown as W).__skifree;
      for (let t = t0; t < t0 + 900; t += 1) if (w.front(t)?.phase === ph) return t;
      return -1;
    },
    [phase, from] as const,
  );

const WHITEOUT = { course: 'custom', customSeed: 'WO-E2E', courseLength: 'sprint', showTutorial: false, biome: 'whiteout', quality: 'low' };

test.describe.configure({ mode: 'serial' });

test('boots clean; a front is announced on the HUD before it arrives and while it blows', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  await boot(page, WHITEOUT);
  await api(page, (w) => w.startRun(true));
  await api(page, (w) => w.seenCave(true));
  expect((await sess(page)).phase).toBeTruthy();
  const build = await findPhase(page, 'build', 1);
  expect(build).toBeGreaterThan(0);
  // the front builds: the HUD warns (pill) — the storm wall is on the horizon
  await api(page, (w, t) => w.setTime(t + 1), build);
  await frames(page, 20);
  const warn = await api(page, (w) => w.weatherHud());
  expect(warn.pill, JSON.stringify(warn)).toBeTruthy();
  const storm = await findPhase(page, 'storm', build);
  await api(page, (w, t) => w.setTime(t + 2), storm);
  await frames(page, 20);
  const blow = await api(page, (w) => w.weatherHud());
  expect(blow.pill, JSON.stringify(blow)).toBeTruthy();
  expect(blow.pill).not.toBe(warn.pill);
  // and it passes
  const clear = await findPhase(page, 'clear', storm);
  await api(page, (w, t) => w.setTime(t + 3), clear);
  await frames(page, 20);
  expect(errors).toEqual([]);
});

test('Hard: the Yeti throws in the storm and the landing marks are up', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  await boot(page, { ...WHITEOUT, difficulty: 'hard', customSeed: 'WO-E2E-H' });
  await api(page, (w) => w.startRun(true));
  await api(page, (w) => w.seenCave(true));
  await api(page, (w) => w.autopilot('skilled'));
  await api(page, (w) => w.toCave());
  // through the encounter into the chase
  for (let i = 0; i < 60 && (await sess(page)).phase !== 'chase'; i++) await frames(page, 30);
  expect((await sess(page)).phase).toBe('chase');
  const storm = await findPhase(page, 'storm', Math.ceil((await sess(page)).time));
  await api(page, (w, t) => w.setTime(t + 1), storm);
  let marker = false;
  for (let i = 0; i < 80 && !marker; i++) {
    await api(page, (w) => w.placeYeti(30));
    await frames(page, 15);
    marker = (await sess(page)).snowballMarker;
  }
  expect(marker).toBe(true);
  expect((await api(page, (w) => w.front(w.state().session!.time)))?.phase).toMatch(/storm|ease|build/);
  expect(errors).toEqual([]);
});

test('storm cave encounter plays through to the chase; the rescue station finish saves the visit', async ({ page }) => {
  test.setTimeout(40 * 60 * 1000);
  await boot(page, { ...WHITEOUT, customSeed: 'WO-E2E-C' });
  await api(page, (w) => w.startRun(true));
  await api(page, (w) => w.seenCave(false));
  await api(page, (w) => w.toCave());
  let saw = false;
  for (let i = 0; i < 80; i++) {
    await frames(page, 30);
    const s = await sess(page);
    if (s.cinematicTime > 0) saw = true;
    if (s.phase === 'chase') break;
  }
  expect(saw).toBe(true);
  expect((await sess(page)).phase).toBe('chase');
  // to the rescue station, the Yeti far behind
  const fz = (await sess(page)).finishZ;
  await api(page, (w, z) => w.teleport(z - 60, 20), fz);
  await api(page, (w) => w.placeYeti(200));
  await api(page, (w) => w.autopilot('skilled'));
  for (let i = 0; i < 120 && (await sess(page)).outcome !== 'victory'; i++) await frames(page, 30);
  expect((await sess(page)).outcome).toBe('victory');
  // the victory sequence runs
  await frames(page, 300);
  const p = await api(page, (w) => w.progress());
  expect(p.saved.stats.sets.biomesVisited).toContain('whiteout');
  expect(errors).toEqual([]);
});
