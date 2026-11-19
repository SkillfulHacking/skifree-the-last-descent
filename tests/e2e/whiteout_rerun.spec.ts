/**
 * W-031 regression: a retry (a second run on the same course reuses the world and its environment).
 * The environment's storm scaling used to capture its "base" values lazily from the live, already-scaled
 * lights and materials; a first run that ended before the weather's first storm change left the sun at
 * 0 (the old session's teardown reset the ambient light while the sun's base was still 0), so the
 * capture guard (`sunBase === 0`) never latched and every storm change re-captured and re-scaled them — on a second run the snowfall flakes grew to ~3·10²⁶ m and the
 * Whiteout cave leap rendered as a flat white-out (the falloff of the shared haze collapsed to ~1e-40).
 *
 * Asserted here, on the second run, after the storm has changed many times:
 * - the environment's bases equal the location's look (flake size, sun, haze falloff);
 * - the live flake size stays within its storm range;
 * - the cave leap frame is not washed out (luminance spread of the screenshot — the white-out frames
 *   measured 5–15, healthy frames ~40 at the same camera).
 */
import { test, expect, type Page } from '@playwright/test';
import sharp from 'sharp';

type Snow = { size: number; flakeBase: number; sunBase: number; falloffBase: number; storm: number; sun: number; hemi: number };
type K = {
  hold(v: boolean): void;
  freeCam(v: null): void;
  toMenu(): void;
  setCourse(mode: string, length: string, o: object): string;
  startRun(skip?: boolean): Promise<void>;
  seenCave(v: boolean): void;
  hud(v: boolean): void;
  frames(n: number, dt?: number): void;
  teleport(z: number, speed?: number): void;
  setTime(t: number): void;
  state(): { session: { phase: string; cinematicTime: number } | null };
  world(): { mountain: { finishZ: number; profile: { encounters(a: number, b: number): { triggerZ: number }[] }; biome: { weather: { flakeSize: number }; lighting: { sunIntensity: number }; atmosphere: { falloff: number } } } };
  renderProbe(n?: string[]): { snow: Snow };
};
const k = <R>(page: Page, src: string, arg?: unknown) => page.evaluate(([s, a]) => (0, eval)(s)((window as unknown as { __skifree: K }).__skifree, a), [src, arg] as const) as Promise<R>;

async function run(page: Page, biome = 'whiteout') {
  await k(page, '(k) => { k.hold(false); k.freeCam(null); k.toMenu(); }');
  await page.waitForTimeout(1500);
  await k(page, `(k) => k.setCourse('custom', 'sprint', { difficulty: 'normal', biome: '${biome}', custom: 'WO-RERUN' })`);
  await k(page, '(k) => k.startRun(true)');
  await page.waitForTimeout(2500);
  await k(page, '(k) => { k.seenCave(false); k.hold(true); k.hud(false); }');
}

test('Whiteout: a second run keeps its environment bases; the cave leap is not a white-out (W-031)', async ({ page }) => {
  test.setTimeout(60 * 60 * 1000);
  await page.setViewportSize({ width: 320, height: 180 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 900_000, polling: 1000 });

  // run 1: an early restart — over before the weather's first storm change (a retry reuses the same
  // world and environment; the old session's teardown reset the ambient light with the sun's base still 0)
  await run(page);
  await k(page, '(k) => k.frames(30, 1 / 30)');

  // run 2: the original failure
  await run(page);
  const look = await k<{ flake: number; sun: number; falloff: number }>(page, '(k) => { const b = k.world().mountain.biome; return { flake: b.weather.flakeSize, sun: b.lighting.sunIntensity, falloff: b.atmosphere.falloff }; }');
  await k(page, '(k) => { for (let t = 20; t < 80; t += 0.5) { k.setTime(t); k.frames(1, 1 / 30); } }');
  const tz = await k<number>(page, '(k) => { const m = k.world().mountain; return m.profile.encounters(0, m.finishZ)[0].triggerZ; }');
  await k(page, '(k, z) => k.teleport(z + 0.5, 16)', tz);
  // (round 3: the cinematic ends as the Yeti leaps — the leap is the chase's first seconds, the camera
  // swinging back to third person over the flight) the frame as he lands, the swing complete: the
  // gameplay camera at the cave, where the W-031 white-out was
  const reached = await k<boolean>(page, '(k) => { for (let i = 0; i < 2000; i++) { const s = k.state().session; if (s && s.phase === "chase") { for (let j = 0; j < 150 && k.state().session.yetiAirborne; j++) k.frames(1, 1 / 30); k.frames(2, 1 / 30); return k.state().session.yetiAirborne === false; } k.frames(1, 1 / 30); } return false; }');
  expect(reached).toBe(true);

  const snow = (await k<{ snow: Snow }>(page, '(k) => k.renderProbe([])')).snow;
  expect(snow.flakeBase).toBeCloseTo(look.flake, 6);
  expect(snow.sunBase).toBeCloseTo(look.sun, 6);
  expect(snow.falloffBase).toBeCloseTo(look.falloff, 9);
  expect(snow.size).toBeGreaterThanOrEqual(look.flake - 1e-9);
  expect(snow.size).toBeLessThanOrEqual(look.flake * 2.3 + 1e-9);

  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r)))));
  const png = await page.screenshot({ timeout: 1_200_000 });
  const st = await sharp(png).greyscale().stats();
  const spread = st.channels[0]!.stdev;
  expect(spread, `leap frame luminance stdev ${spread.toFixed(1)} (white-out ≈ 5–15, healthy ≈ 40)`).toBeGreaterThan(25);
  expect(errors).toEqual([]);
});

// the same root cause on the branch, in locations with no weather fronts at all: their storm bases were
// never captured, so the first `setAmbientScale` (a run's teardown, the cave reveal) set the sun to 0 —
// every retry on Alpine or Fjord ran without sunlight
for (const biome of ['alpine', 'fjord']) {
  test(`${biome}: a retry keeps the sun (W-031 root cause)`, async ({ page }) => {
    test.setTimeout(30 * 60 * 1000);
    await page.setViewportSize({ width: 320, height: 180 });
    await page.goto('/?debug');
    await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 900_000, polling: 1000 });
    await run(page, biome);
    await k(page, '(k) => k.frames(30, 1 / 30)');
    await run(page, biome);
    await k(page, '(k) => k.frames(30, 1 / 30)');
    const sunLook = await k<number>(page, '(k) => k.world().mountain.biome.lighting.sunIntensity');
    const snow = (await k<{ snow: Snow }>(page, '(k) => k.renderProbe([])')).snow;
    expect(snow.sunBase).toBeCloseTo(sunLook, 6);
    expect(snow.sun).toBeCloseTo(sunLook, 6);
  });
}
