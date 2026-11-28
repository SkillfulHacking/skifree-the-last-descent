# Whiteout Ridge, round 4: Reviewer E (QA, Accessibility and Controls)

- **Reviewer:** E. I own category 7 (Accessibility and controls) and QA/test integrity. Scores marked (lc) are outside my speciality and are low confidence.
- **What this review is:** a review by a model, **not a human playtester**. I did not play in real time, did not listen to audio, did not use a screen reader, and did not judge motion comfort or reading speed. I launched no browser and no Playwright (machine constraint: perf captures running). Verdicts on what the player sees rest on code, the developer's logs and captures, and my own headless probes, as stated for each one.
- **Build:** frozen source `71c9ceb`. `git diff 71c9ceb HEAD -- src` is empty and `git status` shows no change under `src` or `tests`. After the freeze, only `tests/e2e/{game,migration,scenic}.spec.ts` and `tools/whiteout_evidence.mjs` changed (judged in the QA section below).
- **What I examined:**
  - `CANDIDATE.md`, `OWNER_DECISIONS.md`, `DEFECTS.md`, `round-3/CONSOLIDATED.md`, `round-3/REVIEW_E_qa.md`.
  - All logs in `candidate/` (`unit`, `tsc`, `build`, the 14 e2e logs including the three first-run failures).
  - Every evidence manifest. Images I looked at: `a11y_ui150/04, 16`; `a11y_reduce_weather/05` beside `whiteout/05`; `whiteout/15, 16, 24`; `strip_rcm/04, 09`.
  - `git diff 46ed200 71c9ceb -- src tests` in full for: `core/settings.ts`, `core/a11y.ts`, `game/App.ts`, `game/GameSession.ts`, `cinematic/{CaveCinematic,Timeline,caveHandoff}.ts`, `ui/{Hud.ts,styles.css}`, `whiteout/{hazards,storm}.ts`, `views/rescue*.ts`, and the changed tests.
  - Unchanged context: `input/Input.ts`, `camera/FollowCamera.ts`, `views/scenery.ts`, `ui/scale.ts`.
- **What I ran myself:**
  - **Unit suite:** `npx vitest run` on HEAD (source identical to `71c9ceb`): **61 files, 521/521 pass** (`/tmp/eprobe4/unit_mine.txt`).
  - **Probe A (`/tmp/eprobe4/blizzdir.probe.test.ts`, output `out.txt` and `out2.txt`):** my round-3 blizzard probe, extended.
    - It records the caption's side at the first warning, then the push for every 0.1 s that the skier is inside the cell's ±25 m while the cell is **actually pushing** (active phase).
    - Courses: 12 Whiteout courses × Normal and Hard, with the skilled autopilot and the real `BiomeEnvironment` events.
  - **Probe B (`route.probe.test.ts`):** the route heading at each location's cave trigger, used to interpret the `cave_skip` dir.z values.

## Scores

| # | Category | R3 | R4 | Justification |
|---|---|---|---|---|
| 1 | Visual art direction (lc) | 7 | 7.5 | Storm frames read as a storm. The station-yard Yeti close-up is clean. I saw only a few frames. |
| 2 | Environmental uniqueness (lc) | 8 | 8 | The rim and cloud-sea work is visible in the strips (`strip_rcm/09`). I did not judge it blind. |
| 3 | Skiing and hazard mechanics (lc) | 7 | 8 | W-081 verified: the caption, the push and the air push agree in every cell that pushed (probe A). The Hard headwind now follows the stance (code read). |
| 4 | Difficulty and fairness (lc) | 7 | 7.5 | Developer data, not re-run. Classic Hard is won everywhere, but Alpine Hard and Whiteout Hard Standard are above the owner's ranges, and the Classic Fjord Hard Sprint margin is 7 m. |
| 5 | Cinematics (lc) | 7.5 | 7.5 | Live RCM cut confirmed in `strip_rcm` (hold to 15.25 s, one cut, fov 64 constant). `whiteout/15` "The leap" has no Yeti in frame, and `24` shows no visible beam. |
| 6 | Performance and stability (lc) | 7 | 7.5 | 11/11 specs pass. The three first-run failures were test defects, and each is fixed honestly. There is still no GPU timing. |
| **7** | **Accessibility and controls (owned)** | **8** | **8.5** | The round-3 Major (F1) is fixed and verified. A vibration toggle, `aria-live` captions, flash reduction on the station and live RCM have all landed. Against that: none of the new accessibility behaviours has a test, RCM scope is still partial, Reduce Weather is unchanged, and the W-085 RUN. fix is double-scaled under the UI zoom, which predicts RUN. over the skier at UI 150% (E4-1). |
| 8 | Overall player experience (lc) | 7.5 | 8 | Per-location cave history behaves as the owner asked. The opening is calmer (front alerts wait 3 s). |

**Category 7: 8.5/10. FAIL against the 9/10 target.** I found no Critical or Major finding in my category. Every open item is minor. Together, though, they leave the round's accessibility work unverified by any test, and one of them (E4-1) is a probable regression for large-text players.

**QA/test integrity: sound.** The freeze is honest, the post-freeze test edits are legitimate fixes that weaken no assertion, and the unit suite reproduces 521/521. The evidence set is only partly committed, and its notes are still template text (E4-7).

## Round 3 → round 4 (my items)

| R3 | Tracker | Status | Check |
|---|---|---|---|
| F1 Major: blizzard caption names the wrong side | W-081 | **Fixed, verified** | See probe A results below this table. |
| F2: accessibility untested; no `aria-live`; no captures | W-088 / W-084 | **Partly fixed → E4-2, E4-4** | `Hud.ts:116-117` adds `role=status` and `aria-live=polite`. Captures now exist (`a11y_ui150`, `a11y_reduce_weather`, `a11y_low`). Still no e2e reads a caption's text in Whiteout, and `menu.spec` still never selects Whiteout. |
| F3: RCM not live; crane and zoom untouched | W-088 | **Partly fixed → E4-3** | Now live: the cave turn (`CaveCinematic.ts:143-147`, `Timeline.when`), the run-intro crane (hold, then cut; `GameSession.ts:257-261`), the follow camera (`GameSession.ts:1317`) and the inset zoom (`:407`, a cut). Untouched: the cave cinematic's own 0–2.4 s opening crane, the handheld drift, the victory rise. No menu note. |
| F4: `reduceFlashes` gaps | W-088 | **Mostly fixed → E4-5** | Beacon and light bar are steady (`rescue.ts:635-641`), and the storm eye glow is dimmed (`GameSession.ts:1246`). The trail-marker lamps still pulse. |
| F5: `game.spec` intro flake | W-090 | **Fixed** (after one failed run) | `hold` + `keyboard.down` + `framesLive` + `up`. The first attempt failed because a sub-frame tap of Space is dropped by the game (see E4-8). |
| F6: `cave_skip` loose, unlogged; pad paths untested | W-090 | **Partly fixed → E4-6** | The thresholds are now 0.9 / 0.85 and the values are logged. Alpine passes at 0.902 against 0.9. Pad Start on a first viewing and pad B look-back are still not exercised in the browser. |
| F7: no vibration toggle | W-088 | **Fixed** | `Settings.vibration`, default on and sanitized (`settings.ts:159`). It gates the only rumble path, `session.rumble` (`App.ts:538-542`). `Input.rumble` has no other caller. It is not unit-tested (E4-2). |
| Obs.: one global "seen" flag | Decision B | **Done** | See the decision B section below. |

**Probe A results for F1 / W-081:**
- 274 runs, 137 unique cells, of which 66 were pushing while the skier crossed them.
- **Caption ≠ actual push: 0. Push flips while pushing: 0.** HUD arrow ≠ push while pushing: 0 of 26.
- Round 3 had 11 of 120 wrong captions and 3 reversals.
- The 12 "mismatches at the cell centre" are all cells in their lull at the crossing, where nothing pushes.

## Owner's decision B (per-location cave history): **meets the decision**, with minor test gaps (E4-9)

| Requirement | Verdict | Evidence |
|---|---|---|
| Keyed by location; one never marks another | Met | `RecordBook.seenCave`, `caveSeen` and `markCaveSeen` (`settings.ts`). `App.ts:529-536` reads and marks only `world.course.biome`. Unit tests 1–2; the e2e marks Whiteout only. |
| Seed, length and difficulty don't reset it | Met by construction (untested) | The key is the biome id alone. No test varies seed, length or difficulty. |
| Later encounters skippable | Met | `finishCave` sets `recordsSeenCave = true` (`GameSession.ts:802`). The e2e skips after a reload (step 3). |
| Pause, restart or abandon before completion doesn't mark it | Met in code; partly tested | Only `finishCave` marks it (`GameSession.ts:315`), plus the two debug paths (E4-9). The e2e covers pause and a debug `startRun` restart. The pause-menu *Restart Run* and *Exit to Menu* are not tested. |
| Migration: idempotent, keeps records and unknown fields, keeps Alpine, never infers Whiteout | Met | `migrateCaveHistory` runs only when `seenCave` is absent. Unknown top-level and per-course fields are kept (`unknown`) and written under the known ones. Unit tests 3–9 and the e2e check this (including a `futureFlag` and per-course `ghost`). Whiteout is never inferred. |
| Escape/Start behaviour and W-076 parity unchanged | Met | `cave_skip.txt` 6/6 (skips by Escape and pad Start at 1, 9, 15.2 and 15.7 s match the watched run to 1e-3). |

**Inference note (minor, design):** with the old flag set, no Alpine runs and some Fjord runs, Fjord is marked seen. A player who watched Alpine's cave and then used *Exit to Menu* records no Alpine run, because `applyRun` runs only on results (`App.ts:604`). That player's Fjord caves were skippable under the old flag, so the Fjord mark rests on weak evidence. It is rare, and the consequence is benign (Fjord becomes skippable). I record it for the owner and do not count it as a defect.

## Findings

### E4-1 (minor; probable regression for large text): the W-085 RUN. fix is double-scaled under the UI zoom and should put RUN. over the skier at UI 150%

**Evidence:**
- The HUD sits inside `.ui { zoom: var(--ui-scale) }` (`styles.css:160`, `App.ts:94`). Inside a zoomed element, CSS px and viewport units are both multiplied by the zoom. I checked this on the capture: in `a11y_ui150` (1280×720, Z = 1.5) the caption's bottom edge is 215 px from the bottom, which is 1.5 × (11vh + 64 px).
- The new rule is `top: max(36%, calc(78px * var(--ui-scale) + min(175px * var(--ui-scale), 12.5vw) + 10px))` (`styles.css:178`). It multiplies by the scale a second time.
- The inset sits outside the zoom (`document.body`) and is scaled once (`App.ts:885-889`). At 1280×720 and UI 1.5 it spans y = 117–277 px (the capture agrees).
- **Predicted RUN. position** at 1280×720, UI 1.5:
  - top: 1.5 × (117 + 160 + 10) ≈ **430 px**;
  - glyph height: 7vw × 1.5 ≈ 134 px;
  - so RUN. covers **y 430–564 of 720**, where the skier is drawn (y ≈ 430–500 in `a11y_ui150/16`).
  - At 1366×768 it is about 447–590. At UI 1.0 it is unchanged and correct (`strip_rcm/09` matches the formula).
- **Check on the model:** applied to round 3's `top: 36%`, the same model gives an 18 px overlap with the inset, which is what review C measured in round 3 (12–18 px).
- No capture shows the hand-off at UI 150%: `a11y_ui150` has no strip frame.

**Impact:** for 1.6 s on the first controllable frame, players who need large text get a 134 px title over their own skier and the near piste. Round 3's problem (overlapping the inset) is traded for a worse spot, for exactly the players the setting exists for.

**Fix:**
- Inside the zoom, express the inset bottom in unzoomed units: `top: max(36%, calc(78px + min(175px, 12.5vw / var(--ui-scale)) + 10px / var(--ui-scale)))`. At UI 1.5 and 1280×720 this gives a screen top of about 287 px, which clears the inset (277) and sits above the skier.
- Capture the hand-off at UI 1.0 and 1.5, at 1280×720 and 1366×768.
- Related observation: at UI 1.5 the caption box (`bottom: calc(11vh + 64px)`, also zoomed) sits on the skier's body (`a11y_ui150/04`, `/16`). Consider anchoring it below the skier at large scales.

### E4-2 (minor, QA): none of the round's new accessibility behaviours has a test

**Evidence:**
- `grep` over `tests/unit` and `tests/e2e` for `vibration`, `A11Y`, `reduceFlashes`, `aria-live`, `FRONT_QUIET`, `rearViewZoom`, `when:` and a mid-cinematic RCM toggle finds only one hit: the migration spec's new default `vibration: true`.
- The `cave_skip` RCM case starts with RCM already on. It does not turn RCM on mid-cinematic, which was the round-3 F3 scenario.

**Impact:** each of these is one line that a refactor could silently undo. W-088 is "PARTLY FIXED" on the tracker and has no regression test at all.

**Fix:** unit tests are enough for most of these:
- `Timeline` `when` evaluated per frame (switch at t: a cut, no orbit);
- `rearViewZoom` under RCM;
- `Hud` caption attributes;
- the `session.rumble` gate with `vibration` false;
- `RescueStation.update` with `A11Y.reduceFlashes` (constant opacity);
- `FRONT_QUIET` (no pill or caption for 3 s, then announced).

Add one e2e step: pause during a first viewing, turn RCM on, resume, and assert at most one turn > 1.5°.

### E4-3 (minor, carried F3): Reduce Camera Motion still leaves several camera moves, and the menu does not say what it covers

**Evidence:**
- The cave cinematic's opening crane (`CaveCinematic.ts:90`: 0–2.4 s with a `via` arc) has no `when`.
- `Timeline.apply` adds handheld drift whatever the setting (`Timeline.ts:127-132`). It is used on most cave and victory shots, including the 0.03 m slough shot.
- The victory rise and pull-back (`rescueVictory.ts`) are unchanged.
- The Settings row has no note (`App.ts:668`), and the README still lists no vibration or Reduce Weather.

**Fix:**
- Give the cave crane a hold-and-cut alternative under RCM.
- Scale `handheld` by `(rcm ? 0 : 1)`.
- Cut the victory rise.
- Add a one-line note to the setting, and update the README.

### E4-4 (minor, carried F2/N5): Reduce Weather Effects is visually weak, and Whiteout captions are not asserted in the browser

**Evidence:**
- `a11y_reduce_weather/05_storm` and `whiteout/05_storm` (same course, time and camera) are almost indistinguishable. Only the far right-hand trees are a little clearer. W-088 states Reduce Weather as unchanged.
- No e2e asserts a Whiteout caption's text, and `menu.spec` still selects only Alpine and Fjord.

**Fix:**
- Let the setting cut storm fog density and streak opacity substantially (presentation only, as W-049 requires). Re-capture the pair.
- Add caption-text assertions to `whiteout.spec`: the front caption and one blizzard caption, with the side.

### E4-5 (minor): the trail-marker lamps still pulse with "Reduce flashes & pulsing" on

**Evidence:** `views/scenery.ts:183-186`: brightness 0.7–1.2 and size ±20% at about 0.38 Hz, running along the line, with no check of the setting. The rate is slow and the depth moderate, so this is not a WCAG flash failure, but the setting's label promises it.

**Fix:** a `uPulse` uniform set to 0 from `A11Y.reduceFlashes` (steady lamps).

### E4-6 (minor, QA): `cave_skip` measures dir.z against world +Z; Alpine passes by 0.002, and two pad paths are still untested in the browser

**Evidence:**
- `cave_skip.txt` logs Alpine (normal and slow) first frame dir.z **0.914**, lowest over 2 s **0.902**, against a threshold of 0.9. Fjord logs 0.985–0.987 and Whiteout 0.957–0.973.
- Probe B: Alpine's route at the cave heads at dir.z 0.922–0.948. The camera is right (on the route and pitched down about 10°). The metric is the problem: it measures the camera against world +Z rather than the route.
- The spec comment cites my round-3 probe range (0.978–0.989), which came from a different measure.
- Pad Start pausing a first viewing, and pad B look-back, are still exercised only below the browser level.

**Impact:** a small course or camera change at Alpine fails this test with a correct camera. A camera 25° off the route on a straight course would pass.

**Fix:**
- Assert the angle to the route tangent, or to `follow.idealPose`, at < 10°, and log it.
- Add the two pad cases (one Whiteout case is enough).

### E4-7 (minor, evidence integrity; W-084 partly met)

**What is good:**
- Every Whiteout shot records the SHA, course id (verified against the built world), settings override, the Yeti's distance, whether he is drawn and in the main view, and his height in px.
- The harness throws when course verification or the chase-gap set-up fails (`whiteout_evidence.mjs:117, 268`).
- The flags are honest. For example, `15_cave_leap` records `inMainView: false, heightPx: 0`.

**What is not:**
- **Notes are still fixed template text, not written from the images:**
  - `15_cave_leap`'s note says "The leap (15.2 s)", but the frame is the swing, with the skier only and no Yeti.
  - `24_v_yeti_flinch` says "close on the Yeti in the searchlight beam", but no beam or pool is visible; the Yeti is evenly lit.
- **The Yeti `distance` is the stale chase gap outside the chase.** It reads 2495.1 m in every victory shot, including `24` where he is 318 px tall, and 2609.9 m at `19_station_approach`.
- **The strip manifests (`strip_*`) record no on-screen height**, although `CANDIDATE.md` says "every shot".
- **Not committed:**
  - `a11y_low/`, `a11y_reduce_weather/`, `a11y_ui150/` and `rim_1366/` are untracked.
  - `strip_rcm/` in commit `0787168` holds a partial 3-frame set (SHA `6ff50f9`). The working tree has a 16-frame recapture (SHA `0787168`), with frames 00–02 modified and 03–15 untracked.
- **SHA statement:** `CANDIDATE.md` says the manifests record `6ff50f9`. Five of them record `0787168`. The source is identical (I verified that the `src` diff is empty), so this is a documentation error, not a provenance one.
- **The SHA is `git rev-parse HEAD`**, not the provenance of the served `dist`.

**Fix:**
- Commit the final evidence before reviews start.
- Generate notes from the measured fields (for example "Yeti not in frame") or review them by hand.
- Record the camera-to-Yeti and skier-to-Yeti distance outside the chase.
- Add `heightPx` to the strip tool.
- Stamp the `dist` build's SHA into the bundle and read it back.

### E4-8 (minor, controls): a sub-frame tap of Space (pop, intro skip) is dropped

**Evidence:**
- `Input.gameplay` reads `pop` from `down` only (`Input.ts:250`), with no latch from `pressedQ`. `recover` does have one (`:288-289`).
- `game_run1_space_released.txt` shows this: a press and release before the stepped frames left the intro running.
- The test fix (hold the key across the frames) is legitimate for the test, but the game behaviour is unchanged.

**Impact:** at low frame rates (Low preset on weak hardware, 15–20 fps), a quick tap to pop or to skip the intro can be lost.

**Fix:** `pop = pop || this.keyPressed('pop')`, a one-frame stroke as for recover. Add a unit test.

### E4-9 (minor, decision B coverage and hygiene)

- **Owner cases not tested:**
  - the pause-menu *Restart Run* and *Exit to Menu* during a first viewing (the e2e uses the debug `startRun`);
  - a seed, length or difficulty change keeping a location's flag;
  - old flag set, no runs at all → Alpine;
  - runs on both Alpine and Fjord → only Alpine.
- **Debug paths persist history:** `debugSkipCave` and `debugToChase` call `finishCave()` → `onCaveSeen` → `saveRecordBook` (`GameSession.ts:1432-1450`). A `?debug` session (evidence tools, testers) marks a location seen on a viewing nobody watched. Gate the save on `!debugUsed`.

### E4-10 (minor, QA logs): `unit.txt` has no SHA, and its run started before the frozen commit existed

**Evidence:** the run started at 07:24:45, and `71c9ceb` was committed at 07:36:22. The other logs carry a SHA header.

**Closure:** my rerun on HEAD (source identical to `71c9ceb`) gives 521/521. Add the SHA header to the unit log as the e2e logs have.

### Observations (not defects)

- **HUD arrow vs caption at warning time:** they disagree in 1 of 67 warnings shown while a front is building. The cell's gust window peaked at s ≤ 0.3, so the cell keeps its own direction while the pill already shows the front's arrow. The caption is correct about the push.
- **W-085 `FRONT_QUIET`:** delaying the pill, the caption *and* the audio cue together keeps deaf and hearing players at parity. A front that builds during the 3 s is announced when the alerts resume (`GameSession.ts:1277`). The logic is sound, though untested (E4-2).
- **Vibration:** the setting gates the single choke point. A rumble already playing (≤ 260 ms) is not cancelled when the setting is turned off, which is acceptable.
- **`aria-live`:** the text is written while the line is `display:none`, and then the line is shown. Whether screen readers announce it consistently is unverified (no screen reader run). A combined `.hud-caption` region that changes only its text content would be the more robust pattern.

## QA/test integrity: post-freeze test changes (`71c9ceb..HEAD`)

| File | Change | Verdict |
|---|---|---|
| `game.spec.ts` | `press('Space')` → `down('Space')`, then `framesLive(3)`, then `up('Space')` | **Legitimate.** `press()` releases before any frame runs under `hold(true)`, and the game reads pop as held. A real tap lasts several frames. The assertion (intro ends, phase `learn`) is unchanged. The game-side weakness is E4-8. |
| `migration.spec.ts` | Strict `toEqual` gains `vibration: true` | **Legitimate.** It is a new setting written at its default. The equality is still exact, with no optional branch. |
| `scenic.spec.ts` | `clock.pauseAt` is retried only on a "past" error, at most 3 times, with a later target | **Legitimate.** It is a harness timing fix and touches no game assertion. |
| `tools/whiteout_evidence.mjs` | `SETTINGS` override, recorded in the manifest | **Legitimate.** It is what makes the accessibility captures traceable. |

**Pre-freeze test edits (`46ed200..71c9ceb`):**
- `cave_skip` and `game.spec` were strengthened.
- `whiteout.test` / `hazard_pass` were re-based on the intended W-080 headwind change (exact to 1e-12 on the hazards' own drag).
- `scan_lod` follows W-086.
- `whiteout_r2` replaces single-seed outcome pins with an aggregate (reader ≥ blind + 3 of 12 on Hard). This drops the round-3 assertion that the weather-blind skier is caught on WD10 Normal. It follows owner's decision A and is B's to judge, not mine.

## What would raise category 7 to 9

1. E4-1: fix the RUN. formula for the zoom, and capture the hand-off at UI 150%.
2. E4-2: unit tests for each W-088 / W-085 behaviour, plus one mid-cinematic RCM e2e.
3. E4-3 and E4-5: RCM covering the cave crane, the handheld drift and the victory rise, with a menu note; steady trail lamps under Reduce flashes.
4. E4-4: a Reduce Weather effect a player can see, and caption-text e2e in Whiteout.

## What I could not verify

- Screen-reader announcement of captions, controller rumble on real hardware, and audio cue timing (model reviewer, no devices).
- The RUN. position at UI 150% is predicted from CSS plus the zoom behaviour I measured on the captures. There is no image of it.
- The balance tables and the perf numbers (developer data, not re-run).
- Whether each e2e run served a `dist` built from the logged SHA (I trusted the headers; the source is identical across them).
- SonarCloud.
