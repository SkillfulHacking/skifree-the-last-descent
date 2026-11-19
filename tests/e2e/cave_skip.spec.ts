/**
 * Round 3 (owner's report): the chase starts from the same state whether the cave cinematic is watched
 * or skipped — with the real keyboard Skip (Escape) and the controller's Start button, at several
 * moments — and the first viewing still pauses on Escape instead of skipping.
 *
 * Every run reaches the cave the same way (Classic Sprint, the deterministic 'skilled' autopilot,
 * fast-forwarded), so the skier arrives in the same state. The game loop is held and the frames are
 * stepped at a fixed 1/30 s through the real input pipeline (debug framesLive), so the real key press
 * or pad button is what skips; the state is read on the hand-off frame and again 2 s into the chase.
 */
import { test, expect, type Page } from '@playwright/test';

type S = {
  phase: string;
  z: number;
  x: number;
  speed: number;
  vel: number[];
  yetiPos: number[];
  yetiVel: number[];
  yetiSpeed: number;
  yetiAirborne: boolean;
  yetiDelay: number;
  yetiHeading: number;
  yetiDistance: number;
  cinematicTime: number;
};
type W = {
  state(): { mode: string; session: S | null };
  startRun(skipIntro?: boolean): Promise<void>;
  advance(sec: number): void;
  frames(n: number, dt?: number): void;
  framesLive(n: number, dt?: number): void;
  hold(v: boolean): void;
  autopilot(style: string | null): void;
  setInputPads(fn: () => unknown[]): void;
  setCourse(mode: string, len: string, o: Record<string, unknown>): string;
  teleport(z: number, speed?: number): void;
  world(): { mountain: { profile: { encounters(a: number, b: number): Array<{ triggerZ: number }> } } };
};
const api = 'window.__skifree';

async function boot(page: Page, biome: string) {
  await page.addInitScript((b) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ course: 'classic', courseLength: 'sprint', biome: b, difficulty: 'normal', showTutorial: false }));
    }
  }, biome);
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 240_000, polling: 1000 });
}
const sess = (page: Page) => page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.state().session!);

/** a fresh run up to the cave cinematic (frozen skier): skied there by the autopilot, or (slow) rolling in at ~3 m/s */
async function toCave(page: Page, slow = false) {
  await page.evaluate(async (sl) => {
    const k = (window as unknown as { __skifree: W }).__skifree;
    await k.startRun(true);
    k.hold(true);
    if (sl) {
      const tz = k.world().mountain.profile.encounters(0, 1e6)[0]!.triggerZ;
      k.teleport(tz - 4, 3);
      for (let i = 0; i < 600 && k.state().session!.phase !== 'caveCinematic'; i++) k.frames(1, 1 / 30);
      return;
    }
    k.autopilot('skilled');
    k.advance(200);
    k.autopilot(null);
  }, slow);
  const s = await sess(page);
  expect(s.phase).toBe('caveCinematic');
  return s;
}

/** step frames one at a time until the chase has begun; the state on that (hand-off) frame */
async function untilChase(page: Page, max = 900) {
  return page.evaluate((n) => {
    const k = (window as unknown as { __skifree: W }).__skifree;
    for (let i = 0; i < n; i++) {
      const s = k.state().session!;
      if (s.phase === 'chase') return s;
      k.framesLive(1, 1 / 30);
    }
    return k.state().session!;
  }, max);
}
/** the state 2 s into the chase (no input) */
async function after2s(page: Page) {
  return page.evaluate(() => {
    const k = (window as unknown as { __skifree: W }).__skifree;
    k.framesLive(60, 1 / 30);
    return k.state().session!;
  });
}

const vec = (s: S) => [s.x, s.z, s.speed, ...s.vel, ...s.yetiPos, ...s.yetiVel, s.yetiSpeed, s.yetiAirborne ? 1 : 0, s.yetiDelay, s.yetiHeading];
function same(a: S, b: S, tol: number, what: string) {
  const va = vec(a);
  const vb = vec(b);
  const worst = Math.max(...va.map((v, i) => Math.abs(v - vb[i]!)));
  expect(worst, `${what}: largest difference ${worst.toFixed(4)} (watched ${JSON.stringify(va.map((v) => +v.toFixed(3)))} vs ${JSON.stringify(vb.map((v) => +v.toFixed(3)))})`).toBeLessThanOrEqual(tol);
}

test.describe.configure({ mode: 'serial' });

for (const [biome, slow] of [['alpine', false], ['fjord', false], ['whiteout', false], ['alpine', true]] as const) {
  test(`${biome}${slow ? ', slow arrival' : ''}: watching the cave cinematic or skipping it (Escape, controller Start) starts the same chase`, async ({ page }) => {
    test.setTimeout(60 * 60 * 1000);
    void api;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await boot(page, biome);

    // 1) first viewing: Escape pauses (it cannot skip yet); then it is watched to the end
    await toCave(page, slow);
    await page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.framesLive(30, 1 / 30));
    await page.keyboard.press('Escape');
    await page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.framesLive(2, 1 / 30));
    expect((await page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.state())).mode).toBe('paused');
    expect((await sess(page)).phase).toBe('caveCinematic');
    // the pause menu runs in the live loop: resume there, then hold again
    await page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.hold(false));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => (window as unknown as { __skifree: W }).__skifree.state().mode === 'playing');
    await page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.hold(true));
    expect((await sess(page)).phase, 'still in the cinematic after the pause').toBe('caveCinematic');
    const watched = await untilChase(page);
    expect(watched.phase).toBe('chase');
    // the canonical start: the Yeti on the ledge, leaping
    expect(watched.yetiAirborne).toBe(true);
    const watched2 = await after2s(page);

    // 2) skips at several moments: before he shows (1 s), mid-reveal (~9 s), just before the leap (~14.3 s)
    for (const [label, at, how] of [
      ['Escape at 1 s', 1.0, 'key'],
      ['controller Start at 9 s', 9.0, 'pad'],
      ['Escape just before the leap', 14.3, 'key'],
    ] as const) {
      await toCave(page, slow);
      await page.evaluate((t) => {
        const k = (window as unknown as { __skifree: W }).__skifree;
        while (k.state().session!.cinematicTime < t - 1 / 60) k.framesLive(1, 1 / 30);
      }, at);
      expect((await sess(page)).phase).toBe('caveCinematic');
      if (how === 'key') await page.keyboard.press('Escape');
      else {
        // press Start for one stepped frame, then release (no loop frame in between)
        await page.evaluate(() => {
          const k = (window as unknown as { __skifree: W }).__skifree;
          const pad = (down: boolean) => {
            const buttons = Array.from({ length: 17 }, () => ({ value: 0, pressed: false }));
            if (down) buttons[9] = { value: 1, pressed: true };
            return { id: 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons };
          };
          k.setInputPads(() => [pad(true)]);
          k.framesLive(1, 1 / 30);
          k.setInputPads(() => [pad(false)]);
        });
      }
      const skipped = await untilChase(page, 6);
      expect(skipped.phase, `${label}: the skip ends the cinematic at once`).toBe('chase');
      expect((await page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.state())).mode, `${label}: a skip is not a pause`).toBe('playing');
      same(watched, skipped, 1e-3, `${label}, hand-off frame`);
      same(watched2, await after2s(page), 1e-3, `${label}, 2 s into the chase`);
    }
    expect(errors).toEqual([]);
  });
}
