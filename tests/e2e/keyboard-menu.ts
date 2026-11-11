/** Shared helpers for e2e specs that drive the menus like a player (no ?debug harness). */
import type { Page } from '@playwright/test';

/** one key press, then two rendered frames (menus read input once per frame) */
export async function press(page: Page, key: string) {
  await page.keyboard.press(key);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** move the menu focus with the arrow keys (as a player would) until the row's label matches */
export async function focusRow(page: Page, label: string | RegExp) {
  const re = typeof label === 'string' ? new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) : label;
  for (let i = 0; i < 40; i++) {
    const cur = (await page.locator('.menu-root:not(.hidden) .menu-row.focus .label').first().textContent())?.trim() ?? '';
    if (re.test(cur)) return;
    await press(page, 'ArrowDown');
  }
  throw new Error(`menu row ${label} not reachable by keyboard`);
}
