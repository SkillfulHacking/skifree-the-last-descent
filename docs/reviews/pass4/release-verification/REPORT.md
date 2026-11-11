# Pass 4 release verification — PR #4 (`pass4`)

Commit verified: `303fa00` (game code identical at final SHA `a8ff7f6`; bundle `main-1L9uUBgY.js` identical
at 303fa00, 8015d48 and c7036df). Pass 3 baseline: `main` @ `aadc93e`. Environment: 2 CPUs, headless
Chromium + SwiftShader, PW_PORT=4411, with other agents' browsers running concurrently (load 3–5.6).
Verification performed by a QA agent (model-based); report text transcribed by the lead.

| # | Item | Result |
|---|---|---|
| 1 | 2560×1440 menu test | PASS (screenshot timeout raised to 10 min in c7036df after a load timeout) |
| 2 | Unit + Playwright suites (production build) | PASS — tsc 0 errors; vitest 215/215; Playwright 18/18 |
| 3 | Pass 3 → PR #4 save migration | PASS — `tests/e2e/migration.spec.ts` |
| 4 | Alpine unchanged | PASS — identity/golden tests, byte-identical cross-version sim hashes vs `main`, browser autopilot run |
| 5 | 12 achievements at 3 sizes | PASS |
| 6 | No-debug unlock + equipped-jacket persistence | PASS |

No merge blockers.

## 1. 2560×1440 menu
`PW_PORT=4411 npx playwright test tests/e2e/menu.spec.ts -g "2560x1440 without scrolling"` — passed standalone
(3.5 min; `logs/e2e_item1_menu_2560.log`, `item1_menu_2560x1440.png`). In the full run at 8015d48 it timed
out at `page.screenshot` (120 s) after its layout assertions passed (`logs/e2e_full_part1.log`); c7036df sets
`screenshot({ timeout: 600_000 })` (as the Location test already did); full menu rerun passed (7.8 min,
`logs/e2e_full_part2_menu.log`).

## 2. Suites
`npx tsc --noEmit` exit 0; `npx vitest run` 215/215 (12 files); `npm run build` exit 0. Logs under `logs/`.

| Spec | Test | Result |
|---|---|---|
| game | menu loads / full loop / pause+gamepad | ✓ 2.0 / 16.2 / 4.4 min |
| menu | 1920×1080, 1920×900, 1366×768, 2560×1440 | ✓ 4.9, 4.5, 3.1, 7.8 min |
| menu | zoom/UI scale; keyboard/mouse/gamepad; course code; Location row | ✓ 3.2, 9.0, 22.1, 10.3 min |
| progression | Achievements + Locker; ?debug never persists | ✓ 14.3, 4.3 min |
| migration | Pass 3 save; v1 → v2 | ✓ 12.5, 4.3 min |
| release | 12 achievements at 3 sizes; equip persists | ✓ 11.4, 9.9 min |
| release | real Pizza Party unlock | ✘ at c7036df (out of play time at ~1 fps) → ✓ 35.7 min at 5e0c0bf |

## 3. Migration
Pass 3 storage formats taken from `git show main:src/core/settings.ts` (unchanged in PR #4); keys
`skifree-tld.settings.v1`, `skifree-tld.records.v2`, legacy `skifree-tld.records.v1`.
- A (Pass 3 save, no progress key): every Settings field (Hard, seed AVALANCHE, Sprint, tutorial retired,
  inverted Y, captions off, J/L bindings), 8 records (CLASSIC-SPR, CLASSIC-STD, CLASSIC-SPR-H,
  DAILY-2026-11-01-SPR, DAILY-2026-11-07-STD-H, SEED-3803621719-SPR-H, SEED-1234567-END,
  SEED-4055206780-ENDLESS), seenCaveCinematic, legacy v1 records. On load all keys deep-equal, no new keys;
  menu shows Pass 3 bests; achievements 0/12; run plays with the custom binding; after a run + reload records
  byte-identical, settings differ only by `course: 'classic'`; fresh v2 progress save. No page errors.
- B (v1 progress save → v2): UI 2/12 with progress values; Glacier Blue granted with source
  `migration:not-today-yeti` and equippable; unknown ids/keys and timestamps kept; written as v2 on first
  commit; stable after reload.

## 4. Alpine unchanged
Identity/golden unit tests pass. Cross-version script (`logs/golden_cross.test.ts.txt`) run on a temp
worktree of `main` and on `pass4`: `golden_main_aadc93e.json` and `golden_pass4_303fa00.json` IDENTICAL
(per-step SHA-256 of position/speed/heading/crash for Classic Sprint × 4 styles and generated custom, Daily and
Hard-with-snowballs courses). Browser: game.spec full loop reaches tutorial, cave, chase, caught, retry,
victory (CLASSIC-SPR, 2:36.6).

## 5. Achievements screen
Seeded: 3 earned, progress 990/1000 m, 1/3, 4/10, a hidden one, Long Haul locked, 4 future-location cards.
All 12 cards visible without scrolling/clipping at 1366×768, 1920×1080, 2560×1440
(`achievements_*.png`). At 2560×1440 text is small (panel doesn't scale; Settings → text size mitigates).

## 6. No-debug persistence (`release.spec.ts`)
Harness API asserted absent. Equipping Glacier Blue via the Locker persists across 2 reloads
(`locker_glacier_blue_*_reload.png`). Real unlock: from 990 m pizza braking, keyboard play unlocked Pizza Party
and granted Pesto Green (source `achievement:pizza-party`); toast captured; after reload 4/12, card earned,
Pesto Green equippable and persists (`unlock_toast_pizza_party.png`, `achievements_after_real_unlock.png`,
`locker_pesto_green.png`).

## Commits added (tests/artifacts only, no game code)
8015d48 new specs (`migration`, `release`, `keyboard-menu` helpers) · c7036df screenshot timeout ·
5e0c0bf unlock loop paced by HUD speed · a8ff7f6 screenshots and logs.

## Observations (non-blocking)
1. UI doesn't scale up at 2560×1440 (text-size setting mitigates).
2. A v1 progress save is rewritten as v2 only at the first commit (deterministic in-memory migration until then).
3. At 640×360 (below supported sizes) the Achievements footer overlaps the Locker row.
4. Concurrent browser use by other agents caused all slowness/timeouts.
