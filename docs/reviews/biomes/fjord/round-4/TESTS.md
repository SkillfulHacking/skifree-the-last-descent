# Round 4 — test results on the integrated candidate

Candidate: **`c0ea8ae`** (branch `pass4-fjord`: PR #4 main + PR #6 engine wall fix + Fjord round 4 + round 4b fixes).
Build: `npm run build` → `dist/assets/main-MR3nvN5i.js`. Browser: Chrome + SwiftShader (software; 2 CPUs) — frame
rates here are not representative of real hardware.

## Type check and unit tests
- `npx tsc --noEmit`: clean.
- `npx vitest run`: **24 files, 306 tests passed** (259 s).

## Browser suite (`npx playwright test`, one worker, production build, 2.8 h)

| # | Test | Result | Time |
|---|---|---|---|
| 1 | game: menu loads with a rendered 3D background, no fatal errors | pass | 2.0m |
| 2 | game: full loop start → learn → cave cinematic → chase → caught → retry → victory | pass | 12.2m |
| 3 | game: pause/resume and gamepad hot-plug | pass | 3.0m |
| 4–7 | menu fits 1920×1080 / 1920×900 / 1366×768 / 2560×1440 without scrolling (2560 now with the ×1.33 resolution scale) | pass | 1.6–3.6m |
| 8 | menu: browser zoom 125 % + UI scale 150 % stay usable | pass | 3.4m |
| 9 | menu: keyboard, mouse and gamepad drive the course controls; choice persists | **fail → see rerun** | 6.0m |
| 10–11 | menu: course code typed; Location row (Alpine, Fjord Coast) | not run (serial after #9) → see rerun | — |
| 12 | migration: a Pass 3 save loads unchanged and stays playable | pass | 12.5m |
| 13 | migration: v1 progress → v2 without ?debug, reward granted, unknown data kept | pass | 4.4m |
| 14 | progression: Achievements + Locker, keyboard/mouse/gamepad, equip persists | pass | 9.9m |
| 15 | progression: a ?debug run reports unlocks but never persists them | pass | 2.5m |
| 16 | release: all 12 achievements at 1366×768, 1920×1080, 2560×1440 | pass | 7.6m |
| 17 | release: equipped jacket persists across reloads (no ?debug) | pass | 7.9m |
| 18 | release: real Pizza Party unlock by keyboard play, jacket granted, survives reload (no ?debug) | pass | 37.6m |
| 19 | **scenic (new): Scenic Route journey** — choose Fjord Coast on the menu, ski to a viewpoint by keyboard, unlock, toast, Achievements, reload (no ?debug) | pass | 49.2m |

### #9 — diagnosis
`locator.click` on the Mountain row's ▶ timed out at 60 s waiting for "visible, enabled and stable". Measured
frame time of the menu at 1920×1080 on this box: **7.1–7.3 s per frame on both the deployed Pass 4 build
(`3a87a76`) and the candidate** (identical draw calls 425 and triangles 1.65 M — `scratch/stab/fr.mjs`). Not a
regression: Playwright's actionability checks need several frames, so the 60 s timeout was too tight on this
machine (the same test passed in 9.0 min on the Pass 4 run). Fix: test-only, click timeout 240 s
(`tests/e2e/menu.spec.ts`). Rerun of the whole serial menu file: see below.

### Scenic Route journey (§2 of the completion brief)
Seeded save (3 earned achievements, Glacier Blue owned and equipped, stats, Alpine records for two courses),
Location still Alpine. The test chooses Fjord Coast with the arrow keys, starts, skips the intro and steers
with two short key taps (schedule planned with the same physics in `tests/unit/fjord_scenic_schedule.test.ts`;
the page clock is driven in exact 1/60 s frames). At t = 21 s the viewpoint was reached:
- trick "VIEWPOINT DISCOVERED +500", caption "[gulls cry over open water — a viewpoint]", toast **Scenic Route**;
- the save gained `scenic-route` with all three earlier achievements, the jacket, the equipped jacket, the
  wins counter and both Alpine records unchanged; `biomesVisited` gained `fjord`;
- after Exit to Menu and a reload: Achievements **4 / 12**, the Scenic Route card earned.
Screenshots: `round-4/scenic-journey/01_menu_fjord.png`, `02_viewpoint_toast.png`, `03_achievements_after_reload.png`.

### Rerun of `menu.spec.ts` (serial file) with the 240 s click timeout — all 8 pass (49 min)
fits 1920×1080 / 1920×900 / 1366×768 / 2560×1440, zoom 125 % + UI 150 %, keyboard/mouse/gamepad course
controls (7.8m), typed course code (19.8m), Location row Alpine / Fjord Coast (9.4m).

**Result: every browser test passes on the candidate (19/19), every unit test passes (306/306).**
