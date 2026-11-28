/**
 * Round 3 (owner's report): the chase starts from the same state whether the cave cinematic is watched
 * or skipped — with the real keyboard Skip (Escape) and the controller's Start button, at several
 * moments — and the first viewing still pauses on Escape instead of skipping.
 * W-076 decision 1: and on the same forward gameplay camera — the watched cinematic's last beat swings
 * round to it (no snap or flip on the way, none at the hand-off), the first controllable frame looks
 * downhill, nothing turns the view back on its own, the held look-back still works, and with Reduce
 * Camera Motion the swing is a cut.
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
  cam: { pos: number[]; dir: number[] };
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
  cameraPose(): { pos: number[]; dir: number[] };
  world(): { mountain: { routeX(z: number): number; profile: { encounters(a: number, b: number): Array<{ triggerZ: number }> } } };
};
const api = 'window.__skifree';

async function boot(page: Page, biome: string, difficulty = 'normal', reduceCameraMotion = false) {
  // (round 5, review E4-6) "downhill" is measured against the run itself — the course's direction at the
  // skier (the racing line's tangent), horizontal components only — not world +Z: a curving run must not
  // pass or fail on its bend
  await page.addInitScript(() => {
    (window as unknown as { __runFwd: (k: W) => number }).__runFwd = (k: W) => {
      const s = k.state().session!;
      const m = k.world().mountain;
      const tx = m.routeX(s.z + 6) - m.routeX(s.z - 6);
      const tl = Math.hypot(tx, 12);
      const d = k.cameraPose().dir;
      const dl = Math.hypot(d[0]!, d[2]!) || 1;
      return ((d[0]! / dl) * tx + (d[2]! / dl) * 12) / tl;
    };
  });
  await page.addInitScript(
    ([b, d, r]) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ course: 'classic', courseLength: 'sprint', biome: b, difficulty: d, showTutorial: false, reduceCameraMotion: r }));
      }
    },
    [biome, difficulty, reduceCameraMotion] as const,
  );
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 240_000, polling: 1000 });
}
const sess = (page: Page) =>
  page.evaluate(() => {
    const k = (window as unknown as { __skifree: W }).__skifree;
    return { ...k.state().session!, cam: k.cameraPose() };
  });

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

/**
 * step frames one at a time until the chase has begun; the state on that (hand-off) frame, with the
 * camera of every frame stepped (cinematic time, direction) for the turn checks
 */
async function untilChase(page: Page, max = 900) {
  return page.evaluate((n) => {
    const k = (window as unknown as { __skifree: W }).__skifree;
    const track: Array<{ t: number; dir: number[] }> = [];
    for (let i = 0; i < n; i++) {
      const s = k.state().session!;
      if (s.phase === 'chase') return { s: { ...s, cam: k.cameraPose(), fwd: (window as unknown as { __runFwd: (k: W) => number }).__runFwd(k) }, track };
      k.framesLive(1, 1 / 30);
      track.push({ t: s.cinematicTime, dir: k.cameraPose().dir });
    }
    return { s: { ...k.state().session!, cam: k.cameraPose() }, track };
  }, max);
}
/** the state 2 s into the chase (no input); the lowest downhill component of the view on the way */
async function after2s(page: Page) {
  return page.evaluate(() => {
    const k = (window as unknown as { __skifree: W }).__skifree;
    let minDirZ = Infinity;
    for (let i = 0; i < 60; i++) {
      k.framesLive(1, 1 / 30);
      minDirZ = Math.min(minDirZ, (window as unknown as { __runFwd: (k: W) => number }).__runFwd(k));
    }
    return { s: { ...k.state().session!, cam: k.cameraPose() }, minDirZ };
  });
}
const angle = (a: number[], b: number[]) => (Math.acos(Math.max(-1, Math.min(1, a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!))) * 180) / Math.PI;

const vec = (s: S) => [s.x, s.z, s.speed, ...s.vel, ...s.yetiPos, ...s.yetiVel, s.yetiSpeed, s.yetiAirborne ? 1 : 0, s.yetiDelay, s.yetiHeading];
function same(a: S, b: S, tol: number, what: string) {
  const va = vec(a);
  const vb = vec(b);
  const worst = Math.max(...va.map((v, i) => Math.abs(v - vb[i]!)));
  expect(worst, `${what}: largest difference ${worst.toFixed(4)} (watched ${JSON.stringify(va.map((v) => +v.toFixed(3)))} vs ${JSON.stringify(vb.map((v) => +v.toFixed(3)))})`).toBeLessThanOrEqual(tol);
  // the same gameplay camera (W-076 decision 1); the direction within a shake's worth
  const dp = Math.hypot(...a.cam.pos.map((v, i) => v - b.cam.pos[i]!));
  expect(dp, `${what}: camera position differs by ${dp.toFixed(3)} m`).toBeLessThanOrEqual(0.05);
  expect(angle(a.cam.dir, b.cam.dir), `${what}: camera direction`).toBeLessThanOrEqual(2);
}

test.describe.configure({ mode: 'serial' });

type Case = { biome: string; slow: boolean; difficulty: string; reduce: boolean };
const CASES: Case[] = [
  { biome: 'alpine', slow: false, difficulty: 'normal', reduce: false },
  { biome: 'fjord', slow: false, difficulty: 'normal', reduce: false },
  { biome: 'whiteout', slow: false, difficulty: 'normal', reduce: false },
  { biome: 'alpine', slow: true, difficulty: 'normal', reduce: false },
  { biome: 'whiteout', slow: false, difficulty: 'hard', reduce: false },
  { biome: 'fjord', slow: false, difficulty: 'hard', reduce: true },
];
const label = (c: Case) => `${c.biome}, ${c.difficulty}${c.slow ? ', slow arrival' : ''}${c.reduce ? ', Reduce Camera Motion' : ''}`;
// the cinematic's last beats (src/cinematic/caveHandoff.ts)
const TURN_AT = 14.7;
const LEAP_AT = 15.8;

for (const c of CASES) {
  test(`${label(c)}: watching the cave cinematic or skipping it (Escape, controller Start) starts the same chase on the same forward camera`, async ({ page }) => {
    test.setTimeout(60 * 60 * 1000);
    void api;
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await boot(page, c.biome, c.difficulty, c.reduce);

    // 1) first viewing: Escape pauses (it cannot skip yet); then it is watched to the end
    await toCave(page, c.slow);
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
    const { s: watched, track } = await untilChase(page);
    expect(watched.phase).toBe('chase');
    // the canonical start: the Yeti on the ledge, leaping
    expect(watched.yetiAirborne).toBe(true);
    // W-076 decision 1: the swing from the Yeti to the run (frames stepped at 1/30 s: ≤ 3.6°/frame at 60 fps)
    const turn = track.filter((f) => f.t >= TURN_AT - 1e-6);
    const steps = turn.slice(1).map((f, i) => angle(turn[i]!.dir, f.dir));
    // and from the cinematic's last frame onto the hand-off frame
    steps.push(angle(turn[turn.length - 1]!.dir, watched.cam.dir));
    const big = steps.filter((a) => a > 7.2);
    if (c.reduce) {
      // Reduce Camera Motion: no swing — a hold, one cut to the forward view, a hold
      expect(steps.filter((a) => a > 1.5).length, `the cut (frame turns ${steps.map((a) => a.toFixed(1)).join(' ')})`).toBeLessThanOrEqual(1);
    } else expect(big, `the swing turns too fast (frame turns ${steps.map((a) => a.toFixed(1)).join(' ')})`).toEqual([]);
    // (round 4, W-090) downhill means downhill: round 3 accepted dir.z > 0.3 (72° off the run); measured
    // 0.978–0.989 (review E), so ≥ 0.9 (< 26°); the values are logged
    const fwd0 = (watched as unknown as { fwd: number }).fwd;
    console.log(`[cave_skip] ${label(c)} first frame along the run ${fwd0.toFixed(3)} (world dir.z ${watched.cam.dir[2]!.toFixed(3)})`);
    expect(fwd0, 'the first controllable frame looks down the run').toBeGreaterThan(0.95);
    expect(Math.max(...steps.slice(-3)), 'no jump at the hand-off').toBeLessThan(c.reduce ? 1.5 : 7.2);
    const { s: watched2, minDirZ } = await after2s(page);
    console.log(`[cave_skip] ${label(c)} lowest alignment with the run over 2 s ${minDirZ.toFixed(3)}`);
    expect(minDirZ, 'the view never turns back on its own').toBeGreaterThan(0.9);

    // 2) skips at several moments: before he shows (1 s), mid-reveal (9 s), during the swing (15.2 s),
    // just before the leap (15.7 s)
    for (const [what, at, how] of [
      ['Escape at 1 s', 1.0, 'key'],
      ['controller Start at 9 s', 9.0, 'pad'],
      ['Escape during the swing', (TURN_AT + LEAP_AT) / 2, 'key'],
      ['controller Start just before the leap', LEAP_AT - 0.1, 'pad'],
    ] as const) {
      await toCave(page, c.slow);
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
      const { s: skipped } = await untilChase(page, 6);
      expect(skipped.phase, `${what}: the skip ends the cinematic at once`).toBe('chase');
      expect((await page.evaluate(() => (window as unknown as { __skifree: W }).__skifree.state())).mode, `${what}: a skip is not a pause`).toBe('playing');
      same(watched, skipped, 1e-3, `${what}, hand-off frame`);
      const { s: skipped2, minDirZ: mz } = await after2s(page);
      same(watched2, skipped2, 1e-3, `${what}, 2 s into the chase`);
      console.log(`[cave_skip] ${label(c)} ${what}: lowest alignment with the run ${mz.toFixed(3)}`);
      expect(mz, `${what}: the view never turns back on its own`).toBeGreaterThan(0.9);
    }

    // 3) the player's own look-back (C) still turns the view round, and lets it go
    if (!c.slow && c.biome === 'alpine') {
      await page.keyboard.down('KeyC');
      const back = await page.evaluate(() => {
        const k = (window as unknown as { __skifree: W }).__skifree;
        k.framesLive(30, 1 / 30);
        return (window as unknown as { __runFwd: (k: W) => number }).__runFwd(k);
      });
      await page.keyboard.up('KeyC');
      const fwd = await page.evaluate(() => {
        const k = (window as unknown as { __skifree: W }).__skifree;
        k.framesLive(45, 1 / 30);
        return (window as unknown as { __runFwd: (k: W) => number }).__runFwd(k);
      });
      expect(back, 'held look-back faces uphill').toBeLessThan(-0.3);
      console.log(`[cave_skip] ${label(c)} released look-back alignment ${fwd.toFixed(3)}`);
      expect(fwd, 'released, the view faces the run again').toBeGreaterThan(0.9);
      // (round 5, review E4-6) the controller's B does the same
      const padB = await page.evaluate(() => {
        const k = (window as unknown as { __skifree: W }).__skifree;
        const pad = (down: boolean) => ({ id: 'test pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ value: down && i === 1 ? 1 : 0, pressed: down && i === 1 })) });
        const R = (window as unknown as { __runFwd: (k: W) => number }).__runFwd;
        k.setInputPads(() => [pad(true)]);
        k.framesLive(30, 1 / 30);
        const b = R(k);
        k.setInputPads(() => [pad(false)]);
        k.framesLive(45, 1 / 30);
        return { b, f: R(k) };
      });
      console.log(`[cave_skip] ${label(c)} pad B look-back ${padB.b.toFixed(3)}, released ${padB.f.toFixed(3)}`);
      expect(padB.b, 'held pad B faces uphill').toBeLessThan(-0.3);
      expect(padB.f, 'released pad B, the view faces the run again').toBeGreaterThan(0.9);
    }
    expect(errors).toEqual([]);
  });
}
