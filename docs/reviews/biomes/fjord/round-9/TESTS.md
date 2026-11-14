# Round 9 — test results on the candidate

**Candidate: `3bf5a7e`** (branch `pass4-fjord`). Browser: Chrome + SwiftShader (software; 2 CPUs) — test
durations are not frame rates.

The full browser suite ran on `e0e2eca`; `3bf5a7e` differs from it only in `src/world/caveTerrain.ts`
(the jamb cap's margin, 1.5 m → 0.5 m: heightfield just inside a cave mouth) — `git diff e0e2eca 3bf5a7e -- src tests`.
The menu spec was re-run in full on `3bf5a7e`, and the unit suite runs on `3bf5a7e` (below).

## Type check and unit tests
- `npx tsc --noEmit` on `e0e2eca`: clean.
- `npx vitest run`: **26 files, 311 tests passed** on `e0e2eca` and again on `3bf5a7e`.

## Browser suite on `e0e2eca` (`npx playwright test --workers=1`, production build, 3.6 h)

| # | Test | Result | Time |
|---|---|---|---|
| 1 | `tests/e2e/game.spec.ts:57:1` main menu loads with a rendered 3D background and no fatal errors | pass | 2.2m |
| 2 | `tests/e2e/game.spec.ts:71:1` full loop: start → learn → cave cinematic → chase → caught → retry → victory | pass | 13.3m |
| 3 | `tests/e2e/game.spec.ts:190:1` pause/resume and gamepad hot-plug do not break the game | pass | 3.1m |
| 4 | `tests/e2e/menu.spec.ts:77:3` main menu fits 1920x1080 without scrolling, title intact | pass | 3.2m |
| 5 | `tests/e2e/menu.spec.ts:77:3` main menu fits 1920x900 without scrolling, title intact | pass | 2.8m |
| 6 | `tests/e2e/menu.spec.ts:77:3` main menu fits 1366x768 without scrolling, title intact | pass | 1.9m |
| 7 | `tests/e2e/menu.spec.ts:77:3` main menu fits 2560x1440 without scrolling, title intact | pass | 5.7m |
| 8 | `tests/e2e/menu.spec.ts:90:1` browser zoom 125% and UI scale 150% keep the menu usable (scroll only if needed) | pass | 6.3m |
| 9 | `tests/e2e/menu.spec.ts:116:1` keyboard, mouse and gamepad drive the course controls; the choice persists | **fail** (timeout, see rerun) | 15.1m |
| 10 | `tests/e2e/menu.spec.ts:155:1` a course code typed into the menu selects that course | not run (serial after #9) → see rerun | — |
| 11 | `tests/e2e/menu.spec.ts:196:1` the Location row (Alpine, Fjord Coast) shows name, rating and description and the menu still fits | not run (serial after #9) → see rerun | — |
| 12 | `tests/e2e/migration.spec.ts:102:1` a Pass 3 save (settings + per-course records, no progress key) loads unchanged in the pass-4 build and stays playable | pass | 31.4m |
| 13 | `tests/e2e/migration.spec.ts:182:1` a v1 progress save migrates to v2 without ?debug: reward granted, unknown data kept, written back as v2 | pass | 9.2m |
| 14 | `tests/e2e/progression.spec.ts:87:1` Achievements + Locker: layout, keyboard/mouse/gamepad, v1 save migration, equip persists and recolours the skier | pass | 11.5m |
| 15 | `tests/e2e/progression.spec.ts:173:1` an automated ?debug run reports unlocks but never persists them | pass | 3.2m |
| 16 | `tests/e2e/release.spec.ts:43:1` all 12 achievements display at 1366x768, 1920x1080 and 2560x1440 | pass | 8.6m |
| 17 | `tests/e2e/release.spec.ts:83:1` an equipped jacket persists across reloads (no ?debug) | pass | 8.7m |
| 18 | `tests/e2e/release.spec.ts:112:1` a real unlock through keyboard play (Pizza Party) persists, grants its jacket and survives a reload (no ?debug) | pass | 30.1m |
| 19 | `tests/e2e/scenic.spec.ts:60:1` Scenic Route: choose Fjord Coast, ski to a viewpoint, unlock, toast, Achievements, survives a reload (no ?debug) | pass | 1.0h |

#9 timed out at its 15-minute limit while the machine also ran two evidence renders (load ~8 on 2 CPUs;
the click on the Mountain row's ▶ waited for frames). #10–#11 are serial after it and did not run.

## Re-run on `3bf5a7e`, idle machine: `npx playwright test tests/e2e/menu.spec.ts --workers=1` (59 min)

| # | Test | Result | Time |
|---|---|---|---|
| 1 | `tests/e2e/menu.spec.ts:77:3` main menu fits 1920x1080 without scrolling, title intact | pass | 2.8m |
| 2 | `tests/e2e/menu.spec.ts:77:3` main menu fits 1920x900 without scrolling, title intact | pass | 2.6m |
| 3 | `tests/e2e/menu.spec.ts:77:3` main menu fits 1366x768 without scrolling, title intact | pass | 1.9m |
| 4 | `tests/e2e/menu.spec.ts:77:3` main menu fits 2560x1440 without scrolling, title intact | pass | 4.2m |
| 5 | `tests/e2e/menu.spec.ts:90:1` browser zoom 125% and UI scale 150% keep the menu usable (scroll only if needed) | pass | 3.8m |
| 6 | `tests/e2e/menu.spec.ts:116:1` keyboard, mouse and gamepad drive the course controls; the choice persists | pass | 10.0m |
| 7 | `tests/e2e/menu.spec.ts:155:1` a course code typed into the menu selects that course | pass | 22.7m |
| 8 | `tests/e2e/menu.spec.ts:196:1` the Location row (Alpine, Fjord Coast) shows name, rating and description and the menu still fits | pass | 11.0m |

**All 19 browser tests have passed on the candidate's code** (#1–#3, #12–#19 on `e0e2eca`, which differs only
in the cave-mouth terrain; #4–#11 on `3bf5a7e`). That includes the no-debug Scenic Route journey (#19),
save migration from Pass 3 and from v1 progress (#12, #13), keyboard/mouse/gamepad menu control (#9), and the
real unlock by keyboard play (#18). Screenshots the suite writes are copied to `browser-shots/`.
