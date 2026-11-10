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

async function boot(page: Page, settings: Record<string, unknown> = {}, url = '/?debug') {
  // one init script per page: seeds settings on the first load only (reloads keep test changes)
  await page.addInitScript((s) => {
    if (!sessionStorage.getItem('booted')) {
      sessionStorage.setItem('booted', '1');
      localStorage.setItem('skifree-tld.settings.v1', JSON.stringify({ quality: 'low', ...s }));
    }
  }, settings);
  await page.goto(url);
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
    await page.screenshot({ path: `docs/reviews/pass2/menu/e2e_menu_${w}x${h}.png`, timeout: 600_000 }); // software rendering is slow at 2560x1440
  });
}

test('browser zoom 125% and UI scale 150% keep the menu usable (scroll only if needed)', async ({ page: first }) => {
  let page = first;
  await page.setViewportSize({ width: 1536, height: 864 }); // 1920x1080 at 125%
  await boot(page);
  let l = await layout(page);
  expect(l).toMatchObject({ panelScroll: 0, overflowX: 0, titleClipped: false, rowsOutside: 0 });
  // a fresh page (its own single init script) so the 150 % UI scale really applies (E4)
  await first.close(); // one rendering page at a time (software WebGL is slow)
  const page2 = await page.context().newPage();
  await page2.setViewportSize({ width: 1366, height: 768 });
  await boot(page2, { uiScale: 1.5 });
  expect(await page2.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--ui-scale').trim())).toBe('1.5');
  page = page2;
  l = await layout(page);
  expect(l.overflowX).toBe(0);
  expect(l.titleClipped).toBe(false);
  // whatever does not fit scrolls inside the panel, and navigation keeps the focus visible
  for (let i = 0; i < 5; i++) await press(page, 'ArrowDown'); // lands mid-list (the list wraps) — E15
  expect(await page.evaluate(() => document.querySelector('.menu-row.focus .label')?.textContent)).not.toBe('Start');
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
  // keyboard: down to Length (found by its label: a Location row sits in between when more than
  // one location exists), right twice → Expedition
  for (let i = 0; i < 6; i++) {
    if (((await page.locator('.menu-row.focus .label').textContent()) ?? '').includes('Length')) break;
    await press(page, 'ArrowDown');
  }
  await expect(page.locator('.menu-row.focus .label')).toContainText('Length');
  await press(page, 'ArrowRight');
  await press(page, 'ArrowRight');
  expect((await page.evaluate(() => (window as unknown as MW).__skifree.currentCourse())).length).toBe('expedition');
  // mouse: click the Mountain row's ▶ → Daily (the Day row appears)
  await page.locator('.menu-row', { hasText: 'Mountain' }).locator('.inc').click({ force: true }); // software rendering: the click never settles
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
  test.setTimeout(45 * 60 * 1000); // several steps, each a few software-rendered frames
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot(page);
  const input = page.locator('.menu-row', { hasText: 'Enter a course code' }).locator('input');
  await input.focus();
  // real key events: letters such as S/D/W/A and Space are game/menu keys elsewhere
  await page.keyboard.type('seed-777-end', { delay: 20 });
  expect(await page.evaluate(() => (window as unknown as MW).__skifree.state().menu)).toBe('main');
  await page.keyboard.press('Enter');
  const c = await page.evaluate(() => (window as unknown as MW).__skifree.currentCourse());
  expect(c.id).toBe('SEED-777-END');
  expect(c.mode).toBe('custom');
  await expect(page.locator('.menu-root')).toBeVisible();
  // an invalid code keeps the text and explains why, inline (E1)
  const input2 = page.locator('.menu-row', { hasText: 'Enter a course code' }).locator('input');
  await input2.focus();
  await page.keyboard.type('NOPE-123', { delay: 20 });
  await page.keyboard.press('Enter');
  await expect(page.locator('.course-card .err')).toContainText('NOPE-123');
  await expect(page.locator('.menu-row', { hasText: 'Enter a course code' }).locator('input')).toHaveValue('NOPE-123');
  // an invalid code typed but not confirmed blocks Start, and says why (E12)
  const input3 = page.locator('.menu-row', { hasText: 'Enter a course code' }).locator('input');
  await input3.focus();
  await input3.fill('');
  await page.keyboard.type('ALSO-WRONG', { delay: 20 });
  await page.locator('.menu-row.primary').click({ force: true }); // software rendering: the focus transition never reports 'stable'
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as MW).__skifree.state().mode)).toBe('menu');
  await expect(page.locator('.course-card .err')).toContainText('ALSO-WRONG');
  // typing a seed then clicking Start straight away starts that course (E2: the click isn't lost)
  await page.evaluate(() => (window as unknown as MW).__skifree.setCourse('custom', 'sprint'));
  const seed = page.locator('.menu-row.kind-text', { hasText: 'any word or number' }).locator('input');
  await seed.focus();
  await seed.fill('');
  await page.keyboard.type('AVALANCHE', { delay: 20 });
  await page.locator('.menu-row.primary').click({ force: true }); // software rendering: the focus transition never reports 'stable'
  await page.waitForFunction(() => (window as unknown as MW).__skifree.state().mode === 'playing', null, { timeout: 600_000, polling: 1000 });
  expect(await page.evaluate(() => (window as unknown as { __skifree: { state(): { course: { label: string } } } }).__skifree.state().course.label)).toContain('AVALANCHE');
});

test('the Location row (Alpine, Fjord Coast) shows name, rating and description and the menu still fits', async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await boot(page, {}, '/?debug');
  const row = page.locator('.menu-row', { hasText: 'Location' });
  await expect(row).toHaveCount(1);
  await expect(row.locator('.val')).toHaveText('Alpine');
  await expect(row.locator('.loc-rating')).toHaveText('●○○○○ Beginner');
  await expect(row.locator('.loc-note')).toContainText('Clear winter day');
  // pick Fjord Coast with the mouse: the code gains its tag, the note follows
  await row.locator('.inc').click({ force: true }); // software rendering: the focus transition never reports 'stable'
  await expect(page.locator('.menu-row', { hasText: 'Location' }).locator('.val')).toHaveText('Fjord Coast');
  await expect(page.locator('.menu-row', { hasText: 'Location' }).locator('.loc-rating')).toHaveText('●●○○○ Scenic');
  await expect(page.locator('.menu-row', { hasText: 'Location' }).locator('.loc-note')).toContainText('Sea cliffs');
  expect((await page.evaluate(() => (window as unknown as MW).__skifree.currentCourse())).id).toMatch(/@FJORD$/);
  for (const [w, h] of [
    [1366, 768],
    [1920, 1080],
    [2560, 1440],
  ] as const) {
    await page.setViewportSize({ width: w, height: h });
    for (const mode of ['classic', 'daily', 'custom']) {
      await page.evaluate((m) => (window as unknown as MW).__skifree.setCourse(m, 'standard'), mode);
      const l = await layout(page);
      expect(l, `${mode} @ ${w}x${h} with Location`).toMatchObject({ panelScroll: 0, overflowX: 0, overflowY: 0, titleClipped: false, rowsOutside: 0 });
    }
    // the description stays on one line
    const noteEm = await page.evaluate(() => {
      const n = document.querySelector('.loc-note') as HTMLElement;
      return n.getBoundingClientRect().height / parseFloat(getComputedStyle(n).fontSize);
    });
    expect(noteEm).toBeLessThan(1.8); // one line of text
    await page.screenshot({ path: `docs/reviews/biomes/fjord/round-1/e2e_menu_location_${w}x${h}.png`, timeout: 600_000 }); // software rendering is slow at 2560x1440
  }
});
