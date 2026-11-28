/**
 * Round 5 (W-098, review E4-1/E4-2/E4-5): accessibility behaviours in the real game.
 *  - RUN. at the hand-off sits below the rear-view inset and above the skier at UI scale 1.0 and 1.5
 *    (the HUD is inside a CSS zoom; the inset is not);
 *  - captions are announced (role=status, aria-live=polite) and carry the hand-off caption text;
 *  - Settings → Controller vibration off silences the pad's rumble; on, the landing rumbles;
 * SwiftShader: no timing claims.
 */
import { test, expect, type Page } from '@playwright/test';

type W = {
  __ready?: boolean;
  __skifree: {
    startRun(skipIntro?: boolean): Promise<void>;
    toCave(): void;
    skipCave(): void;
    frames(n: number, dt?: number): void;
    framesLive(n: number, dt?: number): void;
    hold(v: boolean): void;
    state(): { mode: string; session: { phase: string } | null };
    setInputPads(fn: () => ReadonlyArray<unknown>): void;
    skierScreen(): { headY: number; feetY: number; x0: number; x1: number } | null;
  };
  __rumbles?: number;
};

const KEY_S = 'skifree-tld.settings.v1';
const base = { quality: 'low', biome: 'whiteout', course: 'classic', courseLength: 'sprint', difficulty: 'normal', rearView: true, showTutorial: false, seenPoleHint: true };

async function boot(page: Page, settings: object) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
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
  return errors;
}

/** start the run, ride into the cave and skip the cinematic: the hand-off frame (RUN. on screen) */
async function toHandoff(page: Page) {
  await page.evaluate(() => (window as unknown as W).__skifree.startRun(true));
  await page.evaluate(() => {
    const w = (window as unknown as W).__skifree;
    w.hold(true);
    w.toCave();
  });
  for (let i = 0; i < 40; i++) {
    const ph = await page.evaluate(() => (window as unknown as W).__skifree.state().session?.phase);
    if (ph === 'cave') break;
    await page.evaluate(() => (window as unknown as W).__skifree.frames(5));
  }
  await page.evaluate(() => {
    const w = (window as unknown as W).__skifree;
    w.skipCave();
    w.frames(2);
  });
}

for (const ui of [1, 1.5]) {
  test(`RUN. clears the rear-view inset and the skier at UI scale ${ui}`, async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize({ width: 1280, height: 720 });
    const errors = await boot(page, { ...base, uiScale: ui });
    await toHandoff(page);
    const r = await page.evaluate(() => {
      const el = document.querySelector('.hud-center.run') as HTMLElement;
      // (round 6, review E5-2) the glyphs themselves (a Range over the text), not the full-width line box
      const range = document.createRange();
      range.selectNodeContents(el);
      const g = range.getBoundingClientRect();
      const inset = document.querySelector('.rear-view')!.getBoundingClientRect();
      const sk = (window as unknown as W).__skifree.skierScreen()!;
      return { top: g.top, bottom: g.bottom, left: g.left, right: g.right, insetBottom: inset.bottom, insetLeft: inset.left, insetRight: inset.right, h: innerHeight, sk };
    });
    console.log(`UI ${ui}: inset bottom ${r.insetBottom.toFixed(0)}, RUN. ${r.left.toFixed(0)}–${r.right.toFixed(0)} × ${r.top.toFixed(0)}–${r.bottom.toFixed(0)}, skier x ${r.sk.x0.toFixed(0)}–${r.sk.x1.toFixed(0)}, helmet y ${r.sk.headY.toFixed(0)}`);
    const overlapX = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > 0;
    // clear of the inset: below it, or beside it
    expect(r.top >= r.insetBottom - 1 || !overlapX(r.left, r.right, r.insetLeft, r.insetRight)).toBe(true);
    // clear of the skier as the game projects him: above his helmet, or beside him
    expect(r.bottom <= r.sk.headY || !overlapX(r.left, r.right, r.sk.x0, r.sk.x1)).toBe(true);
    // and on screen, readable
    expect(r.bottom - r.top).toBeGreaterThan(40);
    expect(r.left).toBeGreaterThanOrEqual(0);
    expect(errors).toEqual([]);
  });
}

test('captions are announced and vibration follows its setting', async ({ page }) => {
  test.setTimeout(1_200_000);
  await page.setViewportSize({ width: 960, height: 540 });
  const errors = await boot(page, { ...base, vibration: false, reduceFlashes: true });
  // a connected pad whose rumble is counted
  await page.evaluate(() => {
    const w = window as unknown as W;
    w.__rumbles = 0;
    const pad = {
      id: 'test pad',
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })),
      vibrationActuator: { playEffect: () => ((w.__rumbles = (w.__rumbles ?? 0) + 1), Promise.resolve()) },
    };
    w.__skifree.setInputPads(() => [pad]);
  });
  await toHandoff(page);
  await page.evaluate(() => (window as unknown as W).__skifree.framesLive(60));
  const a = await page.evaluate(() => {
    const cap = document.querySelector('.hud-caption') as HTMLElement;
    return { role: cap.getAttribute('role'), live: cap.getAttribute('aria-live'), text: cap.textContent ?? '', rumbles: (window as unknown as W).__rumbles };
  });
  expect(a.role).toBe('status');
  expect(a.live).toBe('polite');
  // the hand-off's landing is captioned (and would rumble)
  expect(a.text).toMatch(/landing/i);
  expect(a.rumbles).toBe(0);

  // the same landing with vibration on rumbles the pad
  await page.evaluate(([k]) => {
    const s = JSON.parse(localStorage.getItem(k)!);
    s.vibration = true;
    localStorage.setItem(k, JSON.stringify(s));
  }, [KEY_S] as const);
  await page.reload();
  await page.waitForFunction(() => (window as unknown as W).__ready === true, null, { timeout: 240_000, polling: 1000 });
  await page.evaluate(() => {
    const w = window as unknown as W;
    w.__rumbles = 0;
    const pad = { id: 'test pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })), vibrationActuator: { playEffect: () => ((w.__rumbles = (w.__rumbles ?? 0) + 1), Promise.resolve()) } };
    w.__skifree.setInputPads(() => [pad]);
  });
  await toHandoff(page);
  await page.evaluate(() => (window as unknown as W).__skifree.framesLive(60));
  expect(await page.evaluate(() => (window as unknown as W).__rumbles)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

// (Round 6, W-103 / review E5-3) a controller's Start on a first cinematic viewing pauses it, never skips
test('controller Start pauses a first cave cinematic (does not skip it)', async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 960, height: 540 });
  const errors = await boot(page, { ...base });
  await page.evaluate(() => {
    const w = window as unknown as W & { __pad: { buttons: { value: number; pressed: boolean }[] } };
    w.__pad = { id: 'test pad', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false })) } as never;
    w.__skifree.setInputPads(() => [w.__pad]);
  });
  await page.evaluate(async () => {
    const k = (window as unknown as W).__skifree as unknown as { startRun(b: boolean): Promise<void>; hold(b: boolean): void; autopilot(s: string | null): void; advance(m: number): void; framesLive(n: number, dt?: number): void };
    await k.startRun(true);
    k.hold(true);
    k.autopilot('skilled');
    k.advance(200);
    k.autopilot(null);
    k.framesLive(30, 1 / 30);
  });
  expect((await page.evaluate(() => (window as unknown as W).__skifree.state())).session!.phase).toBe('caveCinematic');
  // Start (standard mapping button 9) down for a few frames, then up
  const press = (v: boolean) => page.evaluate((on) => {
    const w = window as unknown as { __pad: { buttons: { value: number; pressed: boolean }[] }; __skifree: W['__skifree'] };
    w.__pad.buttons[9] = { value: on ? 1 : 0, pressed: on };
    w.__skifree.framesLive(3, 1 / 30);
  }, v);
  await press(true);
  await press(false);
  const st = await page.evaluate(() => (window as unknown as W).__skifree.state());
  expect(st.mode).toBe('paused');
  expect(st.session!.phase).toBe('caveCinematic');
  expect(errors).toEqual([]);
});
