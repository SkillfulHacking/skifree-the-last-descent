# Whiteout Ridge, round 5: Reviewer E (QA, accessibility, controls, test strength and evidence integrity)

- **Reviewer:** E. I own category 7 (accessibility and controls, including test strength and evidence integrity). Scores for other categories are low confidence (lc).
- **This is a model review, not a human playtest.** I did not play in real time, listen to audio, use a screen reader, hold a controller or judge motion comfort. Verdicts on what a player sees rest on code, the committed logs and images, and one browser probe of my own (below).
- **Build reviewed:** frozen source `729e226`. `git diff 729e226 53af863 -- src tests` is empty; later commits change only `tools/whiteout_evidence.mjs` (`bbbef83`) and documents.
- **What I examined:**
  - `CANDIDATE.md`, `OWNER_DECISIONS.md`, `DEFECTS.md` (W-076, W-084, W-085, W-088, W-090, W-097, W-098, W-099), `round-4/REVIEW_E_qa.md`.
  - `git diff 71c9ceb 729e226` for `src/input`, `src/ui`, `src/game/App.ts`, `GameSession.ts`, `src/cinematic/*`, `weatherFx.ts`, `Environment.ts`, `capabilities/environment.ts`, whiteout `scenery.ts`, `rescue.ts`, `rescueVictory.ts`, `rimSpindrift.ts`; and every changed test.
  - All 12 e2e logs, `unit.txt`, `tsc.txt`, `build.txt`; all evidence manifests.
  - **17 evidence images, each against its manifest note and checks** (table below).
- **What I ran (all under `/tmp/eR5`, copies made with `git archive`):**
  1. **Old-code check:** the new unit tests copied onto `71c9ceb` (`/tmp/eR5/old`).
  2. **Unit subset on `729e226`:** `input`, `timeline_calm`, `reduce_weather`, `cave_history`, `rear_inset`, `handoff_camera` → 6 files, 48/48 pass.
  3. **Browser probe (`/tmp/eR5/new/tests/e2e/zz_probe.spec.ts`, log `/tmp/eR5/out/probe.log`):** the `a11y.spec` hand-off path (Whiteout Classic Sprint, Low, 1280×720) at UI 1.5 and 1.0. At the hand-off frame and 10 and 25 frames later it records:
     - a screenshot;
     - the skier's projected feet and head;
     - the `.hud-center.run` box and the inset box.

     The screenshots are `/tmp/eR5/out/handoff_ui{1.5,1}_f{0,10,25}.png`.

## Scores

| # | Category | R4 | R5 | Justification |
|---|---|---|---|---|
| 1 | Visual art direction (lc) | 7.5 | 7.5 | The searchlight beat now reads (`24_v_yeti_light`). `24c` has a hard-edged translucent band across 3/4 of the frame (both runs). Storm frames are good. |
| 2 | Environmental uniqueness (lc) | 8 | 8 | Not judged blind. |
| 3 | Skiing and hazard mechanics (lc) | 8 | 8 | The pill arrow and caption side agree in the frames I saw (`05`, `28`). I ran no probe this round. |
| 4 | Difficulty and fairness (lc) | 7.5 | — | Not assessed (B's data). |
| 5 | Cinematics (lc) | 7.5 | 7.5 | The beam is fixed and the set-up shot has the Yeti. The welcome beat still has no skier (`21`, both motion settings), and `24c` has the band artefact. |
| 6 | Performance and stability (lc) | 7.5 | 7.5 | 37/37 e2e pass on the first run. The developer's own table misses frame and compile targets. |
| **7** | **Accessibility and controls (owned)** | **8.5** | **8.5** | Real progress: Reduce Camera Motion now covers every timeline; the lamps are steady; Reduce Weather is visible; the pop tap is latched; the cave test is route-relative. Two new tests fail on the old code. Against that: at UI 150 % **RUN. still covers the skier's shoulders** and the caption covers his legs (my probe), while the test that claims to check this passes on a wrong premise (E5-1, E5-2). Several behaviours are still untested (E5-3), and two new effects ignore the settings (E5-4, E5-5). |
| 8 | Overall player experience (lc) | 8 | 8 | |

**Category 7: 8.5/10. FAIL against the 9/10 bar.** No Critical or Major finding. Every finding is minor. The deciding issue is E5-1/E5-2: round 4's headline accessibility item (RUN. at UI 150 %) is claimed fixed and "tested", but the frame shows it is only partly fixed and the test cannot see the remaining overlap.

## Round 4 → round 5 (my items)

| R4 | Tracker | Status | Check |
|---|---|---|---|
| E4-1: RUN. double-scaled at UI 150 % | W-085/W-098 | **Partly fixed → E5-1** | The formula is no longer double-scaled. At UI 1.5 RUN. clears the inset (inset bottom 277, RUN. top 287). It now sits on the skier's head and shoulders instead (probe image). At UI 1.0 it is clear of both (probe image `handoff_ui1_f0.png`). |
| E4-2: new a11y behaviours untested | W-098 | **Partly fixed → E5-3** | New and adequate: `timeline_calm.test` (fails on `71c9ceb`), the input tap test (fails on `71c9ceb`), and e2e for `role`/`aria-live`, the hand-off caption text and vibration on/off. Still untested: `LAMP_CALM` (its comment says "exported for the test"; no test imports it), the beacon/light bar under Reduce Flashes, `FRONT_QUIET`, `rearViewZoom` under RCM, and a mid-cinematic RCM toggle in the browser. |
| E4-3: RCM gaps, no menu note | W-098 | **Fixed in code; README not updated** | `Timeline.calm` is wired into the cave, defeat and victory timelines. With calm on, every shot holds its end pose (`raw = 1`), with no handheld drift, read per frame. This covers the cave crane, the handheld drift and the victory rise. The menu note is added. `strip_rcm` shows held views and cuts (fov 44 → 38 at 14.3 s, held to 15.1 s, then cut to 64). The README still lists neither vibration nor Reduce Weather. A new continuous zoom ignores RCM (E5-5). |
| E4-4: Reduce Weather weak; no Whiteout caption e2e | W-098 | **Mostly fixed** | 0.45 → 0.25, and fog keep 0.6 → 0.4. `a11y_reduce_weather/05` beside `whiteout/05` is now clearly different: the crest trees and slope are legible, and there are far fewer streaks. `a11y.spec` asserts a Whiteout caption's text (the landing). No blizzard-side caption is asserted in the browser. The new rim spindrift ignores the setting (E5-4). |
| E4-5: lamps pulse under Reduce Flashes | W-098 | **Fixed (code), untested** | `scenery.ts`: `vPulse = mix(pulse, 0.31, uLampCalm)`, with `LAMP_CALM` set each frame from `A11Y.reduceFlashes`. Size and brightness are both steady. |
| E4-6: `cave_skip` vs world +Z; pad paths | W-090/W-098 | **Fixed** | `__runFwd` measures the camera against the route tangent (horizontal). Alpine now logs 1.000 / 0.996 (was 0.914 / 0.902 against world Z). The thresholds are 0.95 / 0.9. Pad B look-back is in the browser (−0.940, released 0.938). Pad Start *pausing a first viewing* is still not browser-tested (minor, unchanged). |
| E4-7: evidence integrity | W-097 | **Mostly fixed → E5-6** | See the evidence section. |
| E4-8: sub-frame Space tap dropped | W-098 | **Fixed** | `pop = key('pop') \|\| keyPressed('pop')`. The unit test fails on `71c9ceb` ("expected false to be true") and passes now. Checked for side effects: `menu()` clears `pressedQ`, so a Space that confirms Resume does not become a hop. `game.spec` still holds Space across frames, so no browser test sends a true sub-frame tap (acceptable; the unit test covers the reader). |
| E4-9: decision B coverage and hygiene | Decision B | **Mostly fixed** | The new e2e covers pause-menu *Restart Run* and *Exit to Menu* mid-cinematic (unseen), then a full viewing, then another seed, length and difficulty (custom ROUND5, Standard, Hard) still skippable, with book `{whiteout: true}`. Not done: `debugSkipCave` and `debugToChase` still call `finishCave()` → `onCaveSeen` → `saveRecordBook` (`GameSession.ts:1432-1450`, `App.ts:542`), so a `?debug` session still persists history (test and tool hygiene only). |
| E4-10: unit log run before commit | — | **Unchanged** | The header now says "run on this tree before the commit". The run started 05:49:49 and lasted 715 s; the commit is at 06:01:50. My subset rerun on `729e226` passes. I did not rerun the full 542. |

## Owner's decision B and W-076 parity: **preserved**

- **Decision B (per-location history):**
  - `App.ts:539-546` is unchanged: it reads and marks only `world.course.biome`.
  - `cave_history.txt`: 2/2 pass. Test 1 still covers the old-save migration: Alpine kept, `futureFlag` and per-course `ghost` kept, Whiteout never inferred, Fjord abandoned part-way not counted, reload persistence.
  - Test 2 adds the round-4 gaps (above).
  - The new unit test checks that seed, length, mode and difficulty never change the location a course id maps to.
- **W-076 parity:** `cave_skip.txt`, 6/6 pass. Skips by Escape and pad Start at 1, 9, 15.2 and 15.7 s equal the watched hand-off and the state 2 s into the chase to 1e-3, in all three locations, on Hard, on a slow arrival and with RCM. The hand-off is unchanged in source, apart from `LEAP_SETUP.fov` 34 → 38 (framing only).

## Findings

### E5-1 (minor; accessibility): at UI 150 % RUN. still sits on the skier, and the caption covers his legs

**Evidence:** my probe, `/tmp/eR5/out/handoff_ui1.5_f0.png` (1280×720, Low, UI 1.5, the `a11y.spec` path).

| Item | Position on screen |
|---|---|
| Inset | y 117–277 |
| RUN. line box | y 287–421 (glyphs about 300–405) |
| Skier (projected head and feet) | head 350, feet 491; helmet visible at about 360 |

- The skier's head shows through the gap between "U" and "N", and his right shoulder is under the "N".
- At +25 frames the head rises to 336, further into the title. RUN. stays up for 1.6 s.
- The caption box (`[something growls in the dark]`, y ≈ 457–505) lies across his thighs and knees.
- So for the first 1.6 s of control, a large-text player sees the skier boxed in between the title and a caption.
- At UI 1.0 (`handoff_ui1_f0.png`) all three are separate: RUN. 259–349, skier 360–491, caption about 545–577.

**Acceptance:**
- At UI 1.5, at 1280×720 and 1366×768, the RUN. glyph box clears both the inset and the skier's projected head by ≥ 8 px. For example, cap the RUN. size at large scales, or anchor it above the inset's bottom-left or right.
- At UI ≥ 1.25, the caption sits clear of the skier's projected box. For example, move it below the feet or to the bottom band.
- Both are verified by a test that measures the skier (E5-2), and by committed hand-off images at UI 1.0 and 1.5.

### E5-2 (minor; test strength): `a11y.spec` "RUN. clears … the skier" cannot see the skier

**Evidence (`tests/e2e/a11y.spec.ts:72-81`):**
- **The skier is assumed, not measured.** The test asserts `runBottom ≤ 0.6 × innerHeight` because "the skier stands at about 60–70 % of the screen height". That is true of the chase frames (`a11y_ui150/16`, skier at y 430–500). At the hand-off the follow camera frames the skier higher: head at 0.49 h, in `strip_rcm/08` and in my probe. The test passes with RUN. at 419 against a limit of 432, while the image shows the overlap (E5-1).
- **The "glyph" box is the whole line.** `firstElementChild` is null (`hasChild: false` in my probe; RUN. is a text node), so the "glyph" box is the full-width line box (x 0–1280). That box is not wrong as a vertical bound, but the code and its log label suggest a glyph measurement it is not making.

**Acceptance:**
- Project the skier's head and feet (`__skifree.projectToScreen`, as the evidence harness already does).
- Assert the RUN. text's range box (`document.createRange().selectNodeContents(el).getBoundingClientRect()`) clears the head by ≥ 8 px at UI 1.0 and 1.5, and log both.
- Add the same check for the caption at UI 1.5.
- The test must fail on `729e226` at UI 1.5.

### E5-3 (minor; test strength, carried from E4-2): several accessibility behaviours still have no test

**Evidence:** `git grep` over `tests/` on `729e226` finds no reference to `LAMP_CALM`, `FRONT_QUIET`, `rearViewZoom`, `A11Y.reduceFlashes` or `RescueStation` calm. `a11y.spec` boots with `reduceFlashes: true` but asserts nothing about it. The W-098 tracker row says the lamps and RCM are tested. Only `Timeline.calm` (RCM) is tested; Reduce Flashes is not.

**Acceptance:** each item below fails if its one line is removed.
- **Lamps:** a unit test compiles the lamp material (or reads `LAMP_CALM` after a `WhiteoutScenery.update` with `A11Y.reduceFlashes = true`) and asserts the steady value.
- **Beacon and light bar:** `RescueStation.update` under `A11Y.reduceFlashes` gives constant opacity.
- **`FRONT_QUIET`:** no pill or caption for 3 s after control, then the front is announced.
- **`rearViewZoom` under RCM:** a step, not an ease.
- **Mid-cinematic RCM toggle (browser):** pause, turn RCM on, resume, and at most one turn > 1.5°.

### E5-4 (minor; Reduce Weather Effects): the new rim spindrift ignores the setting

**Evidence:**
- `views/rimSpindrift.ts` (new) and `scenery.ts:247-249` set the veils' strength to `0.55 + 0.35 × storm`, with no `weatherFx.scale`.
- Every other weather layer reads it: `blowingSnow.ts:138`, `sky.ts:259`, `Environment.ts:170`, `World.ts:624-627`.
- `reduce_weather.test` checks only that physics modules do not read the setting.

**Acceptance:**
- The veils' `uK` is multiplied by `weatherFx.scale`, or by a floor if they serve as a rim cue (as `WEATHER_FX_TELEGRAPH_FLOOR` does for walls).
- A unit test asserts it.
- A Reduce Weather capture of a rim frame (`27/28`).

### E5-5 (minor; Reduce Camera Motion): the inset's new distance-driven zoom is continuous under RCM

**Evidence:**
- `App.ts:911`: `rearCam.fov = min(48 + (22 − 48)·zoom, rearInsetFov(distance))`. The second term changes every frame with the Yeti's distance (9°–48°): a continuous zoom of the background whenever the gap changes.
- Round 4 made the inset's leap zoom a cut under RCM (`GameSession.ts:407`). This new term has no RCM branch.
- The menu note now promises "cinematics cut between held views". The inset is not a cinematic, but it is the same kind of motion the setting exists to reduce.
- Low impact: the inset is a small viewport, and the zoom keeps the Yeti a constant size.

**Acceptance:** under RCM, `rearInsetFov` is quantised (for example, steps of ≥ 6° with hysteresis) or fixed, and a unit test checks it.

### E5-6 (minor; evidence integrity, W-097): fail-fast works and the checks are honest; notes, preset and strips are still short of the claim

**What is good (verified):**
- The harness throws on a failed check unless `LENIENT` (`whiteout_evidence.mjs:113`), and on course verification and chase-gap failures (`:157`, `:312`).
- **The two by-design stops are real and match their images:**
  - `whiteout_run1_harness_label/15_cave_leap`: no Yeti in the frame, check `yeti: false`.
  - `whiteout/21_v_welcome` and `a11y_rcm_flash_run1_strict/21`: no skier on the porch, check `skier: false`.
- The `LENIENT` runs list the failure in `failed`.
- The stale victory distance is fixed: outside a chase `distance` is dropped and `fromCamera` added (`24`: 7.6 m, 311–322 px).
- **Every check I sampled agrees with its image** (table below).

**What falls short:**
1. **Notes are still fixed template text.** A check now catches the worst case, but the text is not written from the frame:
   - `21`'s note still says "skier arriving" beside `failed: ["skier"]`.
   - `16_storm_chase` promises "captions"; none is on screen in `whiteout/16`, `a11y_low/16` or `a11y_ui150/16`.
   - `a11y_reduce_weather/05` repeats "driving snow streaks", which that setting removes.
   - `24c`'s note does not mention the hard-edged translucent band that covers most of the frame (both runs).
2. **About two-thirds of shots declare nothing** (`expect: {}`): 01–14, 16, 18, 19, 25–29. That includes `12–14`, whose notes are about the Yeti, and `16`, whose note promises the Yeti in the rear view. W-097 says "every evidence shot declares what must be in it".
3. **Preset is not recorded in the Whiteout manifests.** There is no `quality` key; it is implicit `high` from `settings()` (`:37`) unless `SETTINGS` overrides it. `CANDIDATE.md` says manifests record the preset.
4. **The SHA is `git rev-parse HEAD`**, with a `+dirty` check on `src`, not a stamp read back from the served `dist`.
   - `whiteout_victory/` and `a11y_rcm_flash/` record `f71f1b4`, while `CANDIDATE.md` says the re-run records `bbbef83`.
   - I checked that `bbbef83..f71f1b4` changes no `src`, `tools` or `tests`, so this is a documentation slip, not a provenance break.
5. **The skier check is looser than documented.** The comment says "feet and head inside the main view"; the code accepts chest *or* head (`:90-95`). Neither the skier nor the Yeti check tests occlusion.
6. **Strip manifests (`strip_*`) still carry no checks or on-screen sizes** (E4-7 asked for `heightPx`).
7. **Harness artefact:** in `whiteout/17_yeti_silhouette` (freeCam look-back) the HUD is hidden but the rear-view inset still draws, so the Yeti appears twice.

**Acceptance:**
- Notes are generated from, or suffixed with, the measured fields (for example "skier: NOT in frame", "caption: none").
- Every shot whose note names a subject declares it.
- The manifest records `quality` explicitly.
- The served bundle carries its build SHA and the harness reads it back.
- The skier check matches its documentation.
- Strips record `heightPx` or the subject checks.
- The inset is hidden for freeCam shots.

**Image sample (17 images; note and check against the image):**

| Image | Check | Matches image | Note |
|---|---|---|---|
| `whiteout_run1_harness_label/15_cave_leap` | yeti false (stop) | yes, no Yeti | the label was wrong, as stated in `CANDIDATE.md` |
| `whiteout/15_cave_setup` | yeti 60 px, skier | yes | matches |
| `whiteout/15b_cave_turn` | skier | yes | matches (the turn) |
| `whiteout/05_storm` | — | — | matches; pill ← and caption "pushes you left" agree |
| `a11y_reduce_weather/05_storm` | — | — | "driving snow streaks" over-states it |
| `a11y_ui150/05_storm` | — | — | matches; the caption box sits on the skier (E5-1) |
| `a11y_ui150/16_storm_chase` | — | — | Yeti clear in the inset (28 m); "captions" absent |
| `a11y_low/16_storm_chase` | — | — | inset on Low shows the Yeti (W-082 ok); "captions" absent |
| `whiteout/17_yeti_silhouette` | yeti 80 px | yes | inset duplicates the Yeti (artefact) |
| `whiteout/28_play_rim_storm` | — | — | storm; pill → and caption "pushes you right" agree |
| `strip_rcm/01` | none | — | held set-up view with RCM (consistent with the manifest pose) |
| `strip_rcm/08` | none | — | RUN. clear of inset and skier at UI 1.0 |
| `a11y_rcm_flash/21_v_welcome` | skier false | yes, no skier | note "skier arriving" wrong |
| `a11y_rcm_flash/22_v_lantern` | skier | yes | lantern raised in front of the porch, not "in the doorway" |
| `a11y_rcm_flash/24_v_yeti_light` | yeti 322 px, skier | yes | lamp glare, shaft and pool visible; the shaft passes over his head rather than "reaching him" |
| `a11y_rcm_flash/24c_v_yeti_recoil` | yeti 518 px | yes | recoil pose; a large hard-edged pale band is not mentioned |
| `whiteout_victory/24c_v_yeti_recoil` | yeti 485 px | yes | same band |

### Observations (not scored as defects)

- **Flake risk in the e2e logs:**
  - No retries; all 37 tests pass on the first run.
  - **The higher-risk test is the wall-clock "pizza loop" in `release.spec`** (unchanged this round). It needed 6 iterations and about 23 of its 55 minutes, and one iteration reached only 0 km/h on the tuck. It depends on SwiftShader speed under load.
  - `scenic.spec`'s `pauseAt` retry (round 4) did not trigger in this log.
  - The new specs drive frames deterministically (`frames` / `framesLive` with a fixed dt), so their risk is low.
- **Do the new tests fail on the old code?**
  - `input` (pop tap) and `timeline_calm`: **yes, both fail on `71c9ceb`** (`/tmp/eR5/old`).
  - The `cave_history` unit addition passes on old code, as it should: it is coverage, not a regression test.
  - `a11y.spec` RUN. at 1.5 would fail on old code (predicted RUN. bottom ≈ 564 > 432; not run).
  - The vibration and `aria-live` e2e pass on old code by design: they guard round-4 behaviour.
  - The `cave_skip` metric change is a measurement fix.
- **Reduce Flashes and the new searchlight beat:**
  - The glare sprite and pool fade in over about 0.25 s (`exp(-4·dt)`), and the scene dims over about 1.4 s.
  - Neither is a flash in the WCAG sense, and Reduce Flashes need not change them. I could not judge them in motion.
- **Captions and `aria-live`:** same structure as round 4. Whether screen readers announce reliably is unverified (no screen reader).
- **Vibration:** gated at `session.rumble` (`App.ts:549-552`). The e2e proves 0 rumbles when off and > 0 when on, with a fake pad. Real hardware is unverified.

## What would raise category 7 to 9

1. E5-1 and E5-2: RUN. and the caption clear of the skier at UI 1.5, proven by a test that measures the skier, with committed hand-off images at UI 1.0 and 1.5.
2. E5-3: tests for Reduce Flashes (lamps, beacon), `FRONT_QUIET` and the RCM inset zoom.
3. E5-4 and E5-5: the spindrift under Reduce Weather, and the inset zoom under RCM.
4. E5-6 items 1–3: notes from measurements, declarations on every subject-bearing shot, and preset recorded.

## What I could not verify

- Motion comfort, audio timing, screen-reader announcement and real-pad rumble.
- The full 542-test unit run on `729e226` (I ran the a11y subset only).
- Whether each committed e2e run served a `dist` built from its logged SHA. I trusted the headers; the source is identical across them.
- SonarCloud, balance and perf numbers.
