/**
 * Main-menu layout & input tests (Pass 2 P3): fits without scrolling at common desktop sizes,
 * title never clipped, no horizontal overflow, course controls reachable by keyboard, mouse and
 * gamepad, settings persist across reloads.
 */
import { test, expect, type Page } from '@playwright/test';

type MW = {
  __ready?: boolean;
  __skifree: {
    state(): { mode: string; menu: string | null; course: { id: string } | null };
    setInputPads(fn: () => unknown[]): void;
    setCourse(mode: string, length: string): string;
    currentCourse(): { id: string; length: string; mode: string };
    menuFocus(label: string): boolean;
  };
};

async function boot(page: Page, settings: Record<string, unknown> = {}) {
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('booted')) {
      sessionStorage.setItem('booted', '1');
      localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ quality: 'low', ...s }));
    }
  }, settings);
  await page.goto('/?debug');
  await page.waitForFunction(() => (window as unknown as MW).__ready === true, null, { timeout: 240_000, polling: 1000 });
}

/** one key press per rendered frame (the menu reads input once per frame) */
async function press(page: Page, key: string) {
  await page.keyboard.press(key);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function layout(page: Page) {
  return page.evaluate(() => {
    const panel = document.querySelector('.menu-panel')!;
    const title = document.querySelector('.hero-title')!;
    const r = title.getBoundingClientRect();
    const rows = [...document.querySelectorAll('.menu-root:not(.hidden) .menu-row')].map((e) => e.getBoundingClientRect());
    return {
      panelScroll: panel.scrollHeight - panel.clientHeight,
      overflowX: document.documentElement.scrollWidth - innerWidth,
      overflowY: document.documentElement.scrollHeight - innerHeight,
      titleClipped: title.scrollWidth > title.clientWidth + 1 || r.top < 0 || r.left < 0 || r.right > innerWidth || r.height < 30,
      rowsOutside: rows.filter((q) => q.top < 0 || q.bottom > innerHeight + 0.5).length,
      rows: rows.length,
    };
  });
}

test.describe.configure({ mode: 'serial' });

for (const [w, h] of [
  [1920, 1080],
  [1920, 900],
  [1366, 768],
  [2560, 1440],
] as const) {
  test(`main menu fits ${w}x${h} without scrolling, title intact`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    for (const mode of ['classic', 'daily', 'custom']) {
      await page.evaluate((m) => (window as unknown as MW).__skifree.setCourse(m, 'standard'), mode);
      const l = await layout(page);
      expect(l, `${mode} @ ${w}x${h}`).toMatchObject({ panelScroll: 0, overflowX: 0, overflowY: 0, titleClipped: false, rowsOutside: 0 });
    }
    await page.screenshot({ path: `docs/reviews/pass2/menu/e2e_menu_${w}x${h}.png` });
  });
}

test('browser zoom 125% and UI scale 150% keep the menu usable (scroll only if needed)', async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 864 }); // 1920x1080 at 125%
  await boot(page);
  let l = await layout(page);
  expect(l).toMatchObject({ panelScroll: 0, overflowX: 0, titleClipped: false, rowsOutside: 0 });
  await page.evaluate(() => sessionStorage.removeItem('booted'));
  await page.setViewportSize({ width: 1366, height: 768 });
  await boot(page, { uiScale: 1.5 });
  l = await layout(page);
  expect(l.overflowX).toBe(0);
  expect(l.titleClipped).toBe(false);
  // whatever does not fit scrolls inside the panel, and navigation keeps the focus visible
  for (let i = 0; i < 12; i++) await press(page, 'ArrowDown');
  const focusVisible = await page.evaluate(() => {
    const f = document.querySelector('.menu-row.focus')!.getBoundingClientRect();
    return f.top >= 0 && f.bottom <= innerHeight;
  });
  expect(focusVisible).toBe(true);
});

test('keyboard, mouse and gamepad drive the course controls; the choice persists', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot(page);
  // Start is focused first
  await expect(page.locator('.menu-row.focus .label')).toHaveText('Start');
  // keyboard: down to Length, right twice → Expedition
  await press(page, 'ArrowDown');
  await press(page, 'ArrowDown');
  await expect(page.locator('.menu-row.focus .label')).toContainText('Length');
  await press(page, 'ArrowRight');
  await press(page, 'ArrowRight');
  expect((await page.evaluate(() => (window as unknown as MW).__skifree.currentCourse())).length).toBe('expedition');
  // mouse: click the Mountain row's ▶ → Daily (the Day row appears)
  await page.locator('.menu-row', { hasText: 'Mountain' }).locator('.inc').click();
  expect((await page.evaluate(() => (window as unknown as MW).__skifree.currentCourse())).mode).toBe('daily');
  await expect(page.locator('.menu-row', { hasText: 'Day (UTC)' })).toHaveCount(1);
  // gamepad: d-pad right on the Day row → yesterday (press, then release)
  await page.evaluate(() => (window as unknown as MW).__skifree.menuFocus('Day (UTC)'));
  const before = (await page.evaluate(() => (window as unknown as MW).__skifree.currentCourse())).id;
  for (const pressed of [15, -1]) {
    await page.evaluate((bb) => {
      const buttons = Array.from({ length: 17 }, (_, i) => ({ value: i === bb ? 1 : 0, pressed: i === bb }));
      (window as unknown as MW).__skifree.setInputPads(() => [{ id: 'Xbox Wireless Controller (STANDARD GAMEPAD)', connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons }]);
    }, pressed);
    await page.waitForTimeout(300);
  }
  const after = (await page.evaluate(() => (window as unknown as MW).__skifree.currentCourse())).id;
  expect(after).not.toBe(before);
  expect(after).toMatch(/^DAILY-\d{4}-\d{2}-\d{2}-EXP$/);
  // persists across a reload
  await page.reload();
  await page.waitForFunction(() => (window as unknown as MW).__ready === true, null, { timeout: 240_000, polling: 1000 });
  expect((await page.evaluate(() => (window as unknown as MW).__skifree.currentCourse())).id).toBe(after);
  await expect(page.locator('.course-card .code')).toHaveText(after);
});

test('a course code typed into the menu selects that course', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot(page);
  const input = page.locator('.menu-row', { hasText: 'Enter a course code' }).locator('input');
  await input.click();
  await input.fill('seed-777-end');
  await input.press('Enter');
  const c = await page.evaluate(() => (window as unknown as MW).__skifree.currentCourse());
  expect(c.id).toBe('SEED-777-END');
  expect(c.mode).toBe('custom');
  // typing never triggers game/menu shortcuts (S, D, Space…)
  await expect(page.locator('.menu-root')).toBeVisible();
});
