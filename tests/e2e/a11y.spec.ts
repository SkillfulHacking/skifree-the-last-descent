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
      const run = document.querySelector('.hud-center.run')!.getBoundingClientRect();
      const glyph = (document.querySelector('.hud-center.run') as HTMLElement).firstElementChild?.getBoundingClientRect() ?? run;
      const inset = document.querySelector('.rear-view')!.getBoundingClientRect();
      return { runTop: glyph.top, runBottom: glyph.bottom, insetBottom: inset.bottom, h: innerHeight };
    });
    console.log(`UI ${ui}: inset bottom ${r.insetBottom.toFixed(0)}, RUN. ${r.runTop.toFixed(0)}–${r.runBottom.toFixed(0)} of ${r.h}`);
    expect(r.runTop).toBeGreaterThanOrEqual(r.insetBottom - 1);
    // the skier stands at about 60–70 % of the screen height in the follow camera
    expect(r.runBottom).toBeLessThanOrEqual(r.h * 0.6);
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
