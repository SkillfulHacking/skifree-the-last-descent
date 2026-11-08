# Pass 2, round 2: Reviewers B (systems and progression) and C/E (cinematic and UI/UX)

- **Reviewers:** B and C/E. These are INTERNAL reviews by another model instance, not by external humans. We did not write the code under review.
- **Commit reviewed:** `79f95d2` (`79f95d2ae917501d7a14a4b63feb8e10da6629f2`) "Round-2 cinematic tail frames (14.6, 15.8, 16.6, hand-off); over-shoulder leap camera lowered", branch `pass2`.
  - `src/` and `tests/` were clean against HEAD.
  - The only untracked files are four PNG copies under `docs/reviews/pass2/cinematic/`. The same frames are committed under `cinematic_tail/`.
- **Method:**
  - Read the code and checked the round-2 evidence.
  - Re-ran the unit suite, the typecheck, the build and every round-1 probe.
  - Added new probes under `tests/review/`.
  - Made no changes to `src/` and launched no browser. The Playwright menu suite was already running; its log is reported below.
- **Developer claims in DEFECTS.md were not taken on trust.** Each ID below is closed only on the evidence named.

## Verdict

| Area | Round 1 | Round 2 | Pass mark | Result |
|---|---|---|---|---|
| P4 configurable lengths, generated courses, Endless (B) | 6/10 FAIL | **8/10** | 8 | **PASS** |
| P5 Daily, Custom, records (B) | 8/10 conditional | **9/10** | 8 | **PASS** |
| Cinematic and grounding, P2 (C) | 7/10 REJECT | **8/10** | 8 | **PASS, conditional on C10** (new defect, M) being fixed in round 3 with a velocity-continuity check in the report |
| Menu and UX, P3 (E) | 7/10 REJECT | **7.5/10** | 8 | **REJECT** (see below) |

**Why Menu and UX is rejected:**
- New defect E12 (M): an invalid code followed by Start silently starts the previous course. This brings back the silent failure that E1 was meant to remove.
- E4 and E5 are unverified because the e2e suite had not reached them; see "Menu e2e" below. The four layout tests are green.

Fixing E12 is one small change plus one e2e assertion. If the remaining e2e tests come back green, it should pass.

## Evidence run for this round

**Build and test checks**

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx vite build --outDir /tmp/review_build` | exit 0 (1,128 kB JS) |
| `npx vitest run` | **107/107 passed** (46 s) |
| Round-1 probes (`npx vitest run --config tests/review/vitest.config.ts --disableConsoleIntercept`) | 8 files, 16 tests passed. Numbers are quoted per ID below. |

**New probes (in `tests/review/`)**

| Probe | What it checks |
|---|---|
| `b_rearview2.test.ts` | Replays the round-2 render order (B2) |
| `b_alts_time.test.ts` | Time saved on alternate lines with a skilled-style driver, 6 seeds × 20 km, 41 lines (B3) |
| `b_difficulty.test.ts` | Difficulty combined with late-Endless escalation (B7/B11) |
| `e_drafts.test.ts` | Replays `MenuSystem.activate()` with an invalid draft (E12) |

Note: `b_rearview.test.ts` from round 1 still "passes". It is a frozen replay of the OLD render order and documents the round-1 bug, so it is not a regression test of current code.

**Browser evidence produced by the developer (reviewed only, not re-run)**
- `cinematic/grounding_report.json`: 554 frames.
- Frames `cine_t*.png` and `cinematic_tail/*`.
- `final/game_chase.png`.
- `endless_memory.json`: 120 km.
- `menu/e2e_menu_*.png`.

**Menu e2e (`/tmp/menu_e2e3.log`), status when this report was written**
- 4 of 7 tests passed:
  - fits 1920×1080 (3.7 min);
  - fits 1920×900 (3.0 min);
  - fits 1366×768 (1.8 min);
  - fits 2560×1440 (5.2 min).
- Still pending: zoom 125% plus UI scale 150% (E4), keyboard/mouse/gamepad, and the course code test (E1/E2/E5).
- The runner is slow and we were told not to wait. **E4 and E5, and the e2e confirmation of E1 and E2, are UNVERIFIED.**

---

## B: systems and progression, round-1 IDs

| ID | Status | Evidence |
|---|---|---|
| **B1** build | **VERIFIED** | At HEAD, `tsc` and `vite build` are both green. The cave work is committed. `npm run build` now runs `tsc --noEmit && vite build`. There is still no pre-commit hook, so this depends on people running it. |
| **B2** rear view after origin shift | **VERIFIED** | `App.ts:666-672`: `prepareRearView()` poses `rearCam` in absolute coordinates *before* `renderShifted([camera, rearCam])`, and `World.ts:307-332` shifts both cameras with the scene. `GameSession.rearView()` reads `renderPos` and `yeti.root.position` outside the shift (`GameSession.ts:276-291`). Probe `b_rearview2`: rear camera to Yeti is **61.8 m** (round 1: 2,110 m), the Yeti sits at the frame centre (NDC 0.000), and the absolute position is restored after the draw. In `final/game_chase.png` (7 km into a 10 km course, so the origin has shifted) the rear window shows the slope behind and the Yeti. Residual: there is no repo test, only our probe. |
| **B3** alternate lines | **PARTIAL** | Now real. Each line is a 0.7 m sunken lane (`course.ts:193-197`) with icy surface (`course.ts:250-256`; ice weight 0.75, μ 0.025, grip ×0.32) and orange/blue pole markers every 28 m (`Markers.ts`). Probe `b_alts_time`: the alternate line is faster on **40 of 41** lines, mean **1.30 s** saved (median 1.12, max 2.72) against round 1's geometric ~0.2 s. Not closed: (a) the risk side is not demonstrated: **0 crashes** on 41 icy lines for the skilled driver, so it is a free 1.3 s with no trade-off; (b) density is still about 3.1 lines per 10 km, and the geometric saving is still about 4.5 m; (c) no repo test measures the time saving. Not blocking. |
| **B4** pacing on long courses | **VERIFIED** | `profile.ts:531-540`: Endurance has 1 skirmish (at 0.4 L) and Expedition has 3 (at 0.24, 0.5 and 0.72 L). Each ends at a refuge, with speedMul 0.94–0.98, and the main encounter is still last. `b_winloss`: 20 km skilled `enc=2` (victory 942 s); 50 km skilled `enc=4` (victory 2,376 s, 486 s of chase in total). A careless skier is now caught at **12,163 m on 50 km** (was 46,317 m after 71 minutes) and at 8,149 m on 20 km. |
| **B5** frontier order dependence | **VERIFIED** | `reach()` in `slopeDeg`, `baseHeight`, `halfWidth` and `centerX` (`profile.ts:742-763`). `heightAt` and `surfaceWeights` call `centerX` first. `b_firsttouch`: worst error **0.000 m** (was 1,058 m). `b_fartile`: **0 of 87,120** vertices differ for seeds 1, 99 and 4242. |
| **B6** Endless growth | **WONTFIX accepted** | Documented in KNOWN_ISSUES:104. The 120 km browser session (`endless_memory.json`) shows geometries 324–382 and textures 19–21 with no trend; bands, vegetation bands and chunks are constant; the heap is 58–86 MB with a regression slope of 0.045 MB/km and is flat by 20 km windows (68, 69, 74, 74, 71, 73 MB); 13 refuges; 0 page errors. Caveat: the session teleports 1 km at a time, so particles, tracks and the chase are not exercised over the distance. |
| **B7** Endless escalation | **PARTIAL** | +5% per encounter, capped at ×1.30 from encounter 6 (about 59 km) (`profile.ts:606-607`). It is now measurable: seed 4242, encounter 9, minimum gap **27.9 m vs 48.6 m** at encounter 0. Still only speed escalates: chase length, segment mix and encounter spacing are unchanged, and it plateaus after about 59 km. Acceptable; not blocking. |
| **B8** Daily rollover on retry | **PARTIAL** | Retry and Restart reuse `world.course` (`App.ts:357-360`): fixed. Not fixed: the menu is not refreshed on rollover. If the main menu is left open across 00:00 UTC, the course card still shows yesterday's code and seed, but Start builds *today's* course (`currentCourse()` is re-evaluated at click time). The note "new mountain in N h" is also computed once per render. Minor. |
| **B9** corrupt records | **VERIFIED** | `cleanRecords` (`settings.ts:203-214`) is applied to every course on load. Probe input `{bestTime:"abc", bestScore:"9999999", runs:"x"}` becomes type-correct defaults, and the merge then gives `runs:1`. `dailyDate` is checked as a real calendar date (`settings.ts:141`). |
| **B10** code and seed edge cases | **VERIFIED** | `parseCourseId` rejects future days (`CourseConfig.ts:140-142`); the menu says "(or that day hasn't happened yet)". Numeric seeds above 2³²−1 are hashed: `"0"` → 0 and `"4294967296"` → 3428553431. A word seed still shows as its number after a code round trip; this is documented as by design. `makeCourse` still accepts a future date internally, but no user path reaches it. |
| **B11** serialisable config and difficulty | **VERIFIED** | `difficulty` (Relaxed 0.93 / Normal 1 / Hard 1.07) appears in `CourseConfig`, in the course id (`-R`/`-H`), in the records key, in the menu and in `GameSession.ts:513`. `courseSpec()` exports segments, encounters, refuges, alternate lines and route samples, and a unit test checks that it is deterministic (`course.test.ts:84-92`). `b_difficulty`: Relaxed does not rescue an "average" (never-tucking) skier, who is caught at encounter 0 on both seeds. That is consistent with the unit test's intent (Relaxed is escapable for *intermediate*). |
| **B12** float32 render buffers | **WONTFIX accepted** | Documented in KNOWN_ISSUES:106. The new `AltMarkers` instance matrices are also absolute and are covered by the same note. |

**Cliff-tree thinning** (`obstacles.ts:243-250`, new in round 2). It only *removes* off-piste trees on ground steeper than tan 0.55. It is deterministic: it uses `heightAt`, and B5 makes that order-independent.
- `b_geometry` determinism (band 150 generated far-first vs in order): identical.
- Lane clearance worst case is **5.74 m** (≥ 4.5 m); the route never leaves the piste; the worst 20 m rise is −0.24 m.
- `b_winloss` outcomes are unchanged in kind (skilled wins every finite course; careless and cautious are caught).

**Floating origin and the chase:** `final/game_chase.png` shows HUD "YETI 46 m" and a working "BEHIND YOU" window after the shift.

### New B defects

| ID | Sev | Where | Defect | Remedy |
|---|---|---|---|---|
| B13 | m | `profile.ts:607` × `CourseConfig.ts:19-21`, `GameSession.ts:513` | **Hard combined with late Endless gives an undocumented hard wall.** At encounter 9 the Yeti runs at ×1.30 × 1.07 = ×1.39. The skilled reference autopilot (the best line the game's own tooling can ski) is **caught** on seed 4242 (`b_difficulty`: caught at z 87,347, minimum gap 2.7 m). Seed 5 survives with 22 m. Endless is meant to end, but the point where it becomes impossible depends on the seed and is not stated or tested. | Cap the product (for example `min(1.33, speedMul × difficulty)`) or document the Hard + Endless ceiling, and add a test that the skilled autopilot survives at least N encounters on Hard. |
| B14 | m | `tests/unit` | **No repo regression tests for B2 or B3.** The rear-view fix and the alternate-line time saving are covered only by reviewer probes. | Port `b_rearview2` and `b_alts_time` (with an assertion such as mean saving > 0.5 s) into `tests/unit`. |

---

## C: cinematic and grounding, round-1 IDs

Grounding report summary (`cinematic/grounding_report.json`; the `cinematic_tail/` copy has identical size):
- 554 frames: 509 `caveCinematic` (t 0.03–16.97) and 45 `chase`.
- Soles 0.000 throughout.
- Minimum hand height 0.139 m.
- Minimum head clearance below the roof 3.70 m.
- Maximum root step 0.708 m per frame (leap), landing at t = 16.67.
- `errors: []`.

| ID | Status | Evidence |
|---|---|---|
| **C1** leap overshoot / teleport at hand-off | **VERIFIED** | `spawn.ts:20-27` solves the ballistic flight from the real drop (vUp 5.5; flight = (vUp + √(vUp² + 2g·drop))/g), so he lands on the target. `CaveCinematic.ts:259-288`: a landed leap hands over in place; an in-flight hand-off passes position and velocity to `yetiAI` (no ledge reset, no second leap). Report: the root comes down smoothly (root above floor 2.08 → 1.68 → 1.27 → 0.85 → 0.42 → 0 over frames 494–499), with **no positional discontinuity** from frame 438 through the chase. The landing is at 16.67 s, before `tl.done`. **But see the new defect C10:** the velocity is not continuous. |
| **C2** 0.6 m pop at 6.2 s | **VERIFIED** | The crawl eases out to exactly `GRIP_AT`. Report steps for t 5.90–6.20: 0.008 → 0.005 → 0.002 → 0.000 m, and 0.000 across the 6.2 cue. |
| **C3** report coverage | **VERIFIED** (with caveats) | The report now covers the leap, landing, hand-off and 1.5 s of chase, and records hands, head-below-roof and the per-frame root step. Caveats: (1) "hand" is a single palm-socket point (`YetiModel.ts:212-215`: wrist + 0.14 d + 0.075 n). It shows the palm does not penetrate, not that the knuckles make contact. Crawl hand height has a median of 0.18 m; the frames at 3.8, 5.4 and 7.9 visually show knuckles on the floor. (2) Chase frames carry `t = -1`. (3) The report has no velocity or acceleration check, which is why C10 was not flagged; its "max root step" headline hides a single-frame stop from 21 m/s. |
| C4 lit Yeti in the "shadow" beat | **NOT FIXED** | `cine_t3_8.png` still shows the Yeti fully readable and white at the mouth; `cine_t5_4.png` is the same. The tracker already marks this "partial (creature engineer)". |
| C5 stale caption at t = 0.1 | **VERIFIED** | `cine_t0_1.png` has no caption. |
| C6 feet cropped at 9.5 s | **VERIFIED** | In `cine_t9_5.png` both feet and both hands are fully above the letterbox and grounded. |
| C7 over-the-shoulder leap | **PARTIAL** | In `cine_t14_6.png` and `cine_t15_8.png` only the top of the skier's helmet is in frame, at the bottom edge. It reads as an unidentified red-and-white blob, not as an over-the-shoulder shot. |
| C8 Yeti appears above the roof at 15.8 s | **VERIFIED** | In `cine_t15_8.png` he is airborne in front of the mouth, below the brow. |
| **C9** white blob | **NOT FIXED** | It is still visible in round-2 frames: `cine_t3_8.png` (≈860, 700, beside the left hand), `cine_t5_4.png` (≈830, 800) and `cine_t14_6.png` (≈945, 490, left of the head at the mouth). Disabling glints and flakes in the dark beats (e42406f) did not remove it. |

### New C defects

| ID | Sev | Where | Defect | Remedy |
|---|---|---|---|---|
| **C10** | **M** | `CaveCinematic.ts:189-198` (`yetiAnim.speed = L.landed ? 0 : 6`, root not advanced after landing); `CaveCinematic.ts:271-275` (`place` + `startChase(null)`); `YetiAI.ts:98-102` (`delay = startDelay 0.6`) | **The Yeti stops dead on landing and stands frozen for about 0.93 s.** Report frames 498–526: about 0.71 m per frame (21 m/s) in the air, then **0.000 m per frame from frame 499 (t 16.67) to frame 526**, which is 10 cinematic frames plus 18 chase frames, in mode `run` with animation speed 0. After that he accelerates from rest. This is a single-frame stop from 21 m/s with no recovery pose. It is visible: `cine_handoff_chase.png` shows him standing upright in the "BEHIND YOU" window at 43 m. Compare the AI's own landing branch (`YetiAI.ts:122-128`), which keeps 60% of horizontal speed. | On a filmed landing, hand over the landing velocity (`yetiAI.speed = |v_h| × 0.6`, heading from the velocity) and skip or shorten `startDelay`. Alternatively, play a short scripted landing crouch (mode `land`, about 0.4 s) with a matching animation so the stop is motivated. Add a check to `tools/cinematic.mjs` that the root's acceleration stays bounded (e.g. \|Δstep\| ≤ 0.15 m/frame outside scripted cuts) and that it never stands still for more than 0.3 s in `run` mode. |
| C11 | m | `CaveCinematic.ts:96` (15.8–17.0 swing to `followPose`) | **The landing climax happens off-camera.** At 16.6 s the camera is already behind the skier looking downhill (`cine_t16_6.png`). The landing at 16.67 s (shake, snow puff, footstep) fires with no visible cause, and the letterbox is already gone at 15.8. | Hold on the Yeti until touchdown (≥ 16.7 s), then swing. Or move the landing target into the follow camera's rear-quarter view. |
| C12 | m | `cine_t6_6.png` | The "hand plants on the threshold" insert frames the feet; the planted hand (lower left) is cut off by the bottom letterbox. | Lower the insert's look point by about 0.3 m, or frame on `getHandWorldPosition('left')`. |

---

## E: menu, UX and input, round-1 IDs

| ID | Status | Evidence |
|---|---|---|
| **E1** invalid code fails silently | **PARTIAL** | Pressing Enter on an invalid code keeps the text (`codeDraft`) and shows `.course-card .err` inline (`App.ts:316, 324-333`). That is fixed in code. The e2e assertion (`menu.spec.ts`, code test) had not run yet: UNVERIFIED at runtime. **Still silent on the click path:** see E12. |
| **E2** Start click lost after typing | **VERIFIED** (code); e2e UNVERIFIED | Blur now only stores a draft (no re-render, `Menu.ts:212-220`). Button activation commits drafts and then runs the *re-rendered* screen's button with the same label (`Menu.ts:315-326`). The e2e test (type AVALANCHE, click Start, expect the run with that label) exists but had not run yet. |
| **E3** fit at 1366×768 with the Yeti row | **VERIFIED** | Vertical padding is now `clamp(12px, 4vh, 56px) 6vw` (`styles.css:164`). The e2e test "fits 1366x768" **passed** (panelScroll 0, no overflow, rows inside, all three mountain modes). The fresh `e2e_menu_1366x768.png` (00:21) shows the Custom mode with the Yeti and Seed rows and about 60 px of headroom. 1920×1080 and 1920×900 also passed. |
| **E4** UI scale 150% test | **UNVERIFIED** | The spec now uses a fresh page with a single init script and asserts `--ui-scale` = `1.5` (`menu.spec.ts:84-90`). Sound in code, but not yet run. |
| **E5** real key events in the code test | **UNVERIFIED** | The spec uses `keyboard.type('seed-777-end')`, which sends real key events including S, D and E, and asserts the menu stays `main`. It still does not assert that the focused row and course mode stay unchanged *before* Enter. Not yet run. |
| E6 gamepad cannot type a code | **WONTFIX accepted** | Documented in KNOWN_ISSUES:102. Recommended: say "keyboard only" in the row note. |
| E7 placeholder | **PARTIAL** | The placeholder is now built from today's date and fits at 1366. The contrast is unchanged (`rgba(255,255,255,0.38)`, `styles.css:187`) and is still faint in the screenshot. |
| E8 Start hint | **VERIFIED** | The hint shows mountain · length · difficulty (`App.ts:247`). Nit: it says "Classic" while the selector says "The Last Descent". |
| E9 retire confirmation | **VERIFIED** (code) | Two-step label swap (`App.ts:401-414`). It never times out, so an accidental first press stays armed until the pause screen is rebuilt. Acceptable. |
| E10 small text at 2560×1440 | **VERIFIED** (nit) | `@media (min-width:2200px) and (min-height:1200px)` raises the rows to 19 px and the panel to 640 px (`styles.css:190-194`). The e2e fit test at 2560×1440 **passed**, and the fresh `e2e_menu_2560x1440.png` shows larger rows with no scrolling. Nit: the row notes (`small`), the 190 px inputs and the 13 px placeholder are not scaled and still read tiny. |
| E11 `fmtDistance(999.6)` | **VERIFIED** | It rounds first (`Hud.ts:32-37`), so the result is "1.0 km". |

### New E defects

| ID | Sev | Where | Defect | Remedy |
|---|---|---|---|---|
| **E12** | **M** | `Menu.ts:315-326` with `App.ts:324-333` | **An invalid code followed by clicking Start (or pressing Enter/A on Start) starts the previous course.** `commitDrafts()` applies the draft. `set()` records `codeError` and re-renders, but nothing reports the failure back to `activate()`, so the re-rendered Start action runs at once. The menu closes, the world for the *old* course loads, and the error is never seen. This is the E1 silent failure through the most natural path: type a friend's code, click Start. Probe `e_drafts.test.ts`: `started=1, codeError="“NOPE-123” is not a course code"`. | Make a text item's `set` able to reject (for example by returning `false`), have `commitDrafts()` return "rejected", and in `activate()` abort the button action and focus the code row. Add an e2e assertion: type `NOPE-123`, click Start, expect mode `menu` and a visible `.err`. |
| E13 | m | `Menu.ts:72-77` (`replace` keeps `drafts`), `App.ts:231-232` | **Stale draft and stale error state.** (1) Type a code, then (without Enter) change Mountain or Length with ◀▶. `replace()` re-renders and the field shows empty, but the hidden draft for the old item survives and is applied on the next button press. (2) `codeError` and `codeDraft` persist on the App, so the error banner and the bad text reappear when returning to the menu after a run. Neither clears until a valid code is entered. | Clear `drafts` in `replace()`/`render()`, or re-key them to the new item and keep the input's value. Clear `codeError` in `toMenu()` and on any other course change. |
| E14 | m | `styles.css:160` (`.hud-center.run { top: 18% }`) vs `App.ts:692-696` (rear view at top 78 px, about 175 px tall) | **The "RUN." banner overlaps the rear-view window** at chase start (`cine_handoff_chase.png`): the letters sit across the bottom half of "BEHIND YOU" exactly when the Yeti is first shown there. | Move the banner below about 270 px (e.g. `top: 30%`), or delay the rear view until the banner fades. |

---

## IDs not verified as fixed (summary)

| Status | IDs |
|---|---|
| NOT FIXED | C4, C9 |
| PARTIAL | B3, B7, B8, C7, E1 (click path, see E12), E7 |
| UNVERIFIED (e2e not yet run) | E4, E5; runtime confirmation of E1, E2 |
| WONTFIX accepted (documented) | B6, B12, E6 |

## New defects

| ID | Sev | Summary |
|---|---|---|
| B13 | m | Hard × Endless ×1.39 at encounter 9 catches the skilled autopilot (seed 4242); the ceiling is undocumented |
| B14 | m | No repo tests for the B2 rear-view fix or the B3 alternate-line saving |
| C10 | **M** | The Yeti stops dead from 21 m/s on landing and stands frozen for about 0.93 s across the hand-off |
| C11 | m | The landing happens off-camera; the letterbox is gone before the leap ends |
| C12 | m | The hand-plant insert crops the planted hand at the letterbox |
| E12 | **M** | An invalid code plus Start silently starts the previous course |
| E13 | m | A hidden stale draft survives re-render; the code error and bad text persist across runs |
| E14 | m | The "RUN." banner overlaps the rear-view window |

## Required for round 3
- **Cinematic (to keep the conditional pass):**
  - fix C10;
  - add a velocity/acceleration continuity check to `tools/cinematic.mjs`;
  - re-capture the report through the hand-off.
  - C9 and C4 stay open under the creature and cave engineers.
- **Menu (to pass):**
  - fix E12 and add its e2e assertion;
  - have the full 7-test menu suite green, including E4 and E5.
