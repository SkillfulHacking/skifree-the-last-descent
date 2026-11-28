# Whiteout Ridge, round 3: Reviewer E (QA, Accessibility and Controls)

- **Reviewer:** E. I own category 7 (Accessibility and controls), which is the gating category for this review, and QA coverage. Scores marked (lc) are outside my speciality and are low confidence.
- **What this review is:** a review by a model, **not a human playtester**. I did not play in real time, did not listen to the audio, and did not judge motion comfort, feel or real reading speed. I launched no browser (machine constraint). Where I give a verdict on what the player sees, it rests on code, unit tests, the developers' browser logs and my own headless probes, as stated for each one.
- **Build:** frozen candidate `46ed200` (branch `pass5-whiteout`). `git diff 46ed200 HEAD -- src tests` is empty, and there are no uncommitted changes under `src` or `tests`. Unlike round 2 (N2), the candidate label is true.
- **What I examined:**
  - `CANDIDATE.md`, the round-2 `REVIEW_E_qa.md` and `CONSOLIDATED.md`, and `DEFECTS.md`.
  - Every log in `candidate/` (`tsc`, `build`, `unit`, and all 11 e2e logs plus the contended `game` run).
  - `git diff b70a793 46ed200 -- src tests`.
  - Source: `src/input/Input.ts`, `src/game/GameSession.ts` (frame, finishCave, gameplayPose, the blizzard caption, envCaption), `src/game/App.ts` (pause, the loop, settings, framesLive), `src/cinematic/{CaveCinematic,caveHandoff,orbit,Timeline}.ts`, `src/camera/FollowCamera.ts`, `src/yeti/spawn.ts`, `src/ui/{Hud.ts,styles.css}`, `src/world/biomes/whiteout/{hazards,storm}.ts`, `views/stormCave.ts`, `views/rescue.ts`.
  - Tests: `tests/e2e/cave_skip.spec.ts`, `game.spec.ts`, `migration.spec.ts`, `menu.spec.ts`, `whiteout.spec.ts`, `tests/unit/{handoff_camera,cave_handoff,input}.test.ts`.
- **What I ran myself:**
  - Unit tests `handoff_camera`, `cave_handoff`, `input`, `captions`, `presence`, `rebind`: **58/58 pass** on this tree.
  - **Probe 1 (`/tmp/eprobe/handoff.probe.test.ts`):** the real `FollowCamera` (chase framing and Yeti avoidance on) with real `SkierPhysics` and `YetiAI` from the canonical hand-off, for 6 s. It covers 3 locations × Normal/Hard × arrival at 3, 9 and 18 m/s × autopilot or no input (36 runs).
  - **Probe 2 (`/tmp/eprobe/blizzdir.probe.test.ts`):** the caption direction against the actual blizzard push and the HUD arrow, over 12 Whiteout courses (Classic Sprint and Standard, 10 custom Standard), with the skilled autopilot and the real `BiomeEnvironment` events.
  - Outputs: `/tmp/eprobe/handoff_out.txt` and `/tmp/eprobe/blizzdir_out.txt`.
- **Not seen:** `candidate/evidence/handoff_strip/` and `candidate/evidence/whiteout/` did not exist while I reviewed. Only `rim_1366/` had been captured; I looked at its storm frame.

## Scores

| # | Category | R2 | R3 | Justification |
|---|---|---|---|---|
| 1 | Visual art direction (lc) | 7 | 7 | The `rim_1366` storm frame reads as a storm: flat light, a lost horizon, the lamp and the wands carry. That is the only render I could see. |
| 2 | Environmental uniqueness (lc) | 8 | 8 | The cloud deck, rim spires and storm cave squall add identity (code read). Not judged from renders. |
| 3 | Skiing and hazard mechanics (lc) | 7 | 7 | Blizzard push now follows the front (probe 2: HUD arrow agrees in 63 of 64 cells). The clip cost is raised. The push can still reverse inside a cell (3 of 120). |
| 4 | Difficulty and fairness (lc) | 6 | 7 | W-056 has general placement rules with measurements (developer data, not re-run by me). Hard Standard is still 0/12. |
| 5 | Cinematics (lc) | 7 | 7.5 | One canonical start, and a swing onto the forward gameplay camera (verified in code and probe). Not seen rendered. |
| 6 | Performance and stability (lc) | 7 | 7 | Every spec passes with no page errors. `game.spec` failed once under CPU load (see F5). There is still no GPU timing. |
| **7** | **Accessibility and controls (owned, gating)** | **7** | **8** | W-076 controls are sound and well tested. The pad double-read is fixed. The pill contrast is fixed (5.5–6.9:1). Blizzard direction agrees far more often. Still open: accessibility features with no browser or capture evidence, no `aria-live`, `reduceFlashes` gaps, no vibration toggle, residual wrong-side captions (F1). |
| 8 | Overall player experience (lc) | 7 | 7.5 | The skip and watch paths are now equal, and control returns facing the run. Clearer storm warnings. |

**Category 7: 8/10. FAIL against the 9/10 target.** There is no Critical. One Major remains (F1), and the round-2 evidence gaps (N4, E12) are carried for a second round.

**QA coverage:** release-grade for the first time in this biome. The candidate is frozen and labelled correctly. TypeScript and the build pass, the unit suite passes 489/489, and all 11 browser specs pass on a `dist` built from `46ed200`. The migration assertion is strict again. The remaining QA items are minor (F5–F7).

## W-076 focused verdict: **PASS** (on this build)

I verified each owner requirement myself. I did not rely on the earlier `w076-final/` reviews.

| Requirement | Verdict | Evidence |
|---|---|---|
| Watched or skipped (Escape or pad Start, at any moment) give the same chase | **Met** | **Code:** `CaveCinematic.finish()` always calls `startCanonicalChase` (`CaveCinematic.ts:338-344`). A skip calls `tl.skip()`, and `tl.done` then runs `finishCave()`, the same function the watched path uses (`GameSession.ts:295-311`). The squall weather is handed back from the 15.8 s state on both paths (`stormCave.ts:224-232`). **Unit:** `cave_handoff` passes; worst difference ≤ 1e-6 over 10 s, 3 locations, slow and fast arrivals, Endless encounters 1–3, and it rejects the legacy hand-off. **e2e:** `cave_skip.txt` passes 6/6. Each case compares skips at 1, 9, 15.25 and 15.7 s (Escape and pad Start) with the watched run, to 1e-3 on the state and 0.05 m / 2° on the camera, at the hand-off and 2 s later. |
| First viewing: Escape pauses, no skip | **Met** | `cavePausable = caveCinematic && !recordsSeenCave` (`GameSession.ts:275-276`). `canSkip = recordsSeenCave` (`:293`). The e2e asserts `mode === 'paused'` and that the phase is still `caveCinematic` after resume (`cave_skip.spec.ts:159-168`). |
| Forward visibility on the first controllable frame | **Met** | `finishCave` sets `follow.lookBack = 0` and then snaps (`GameSession.ts:780, 798`). `snap` copies `lookBackS = lookBack` (`FollowCamera.ts:91`). The orbit is reset when the cave starts (`:762`). **Probe 1** (36 runs) measured the first frame at dir.z 0.978–0.989, pitched down 8.4–12.1°, with the skier in frame on every one of the 2,160 frames over 6 s. The e2e bound of dir.z > 0.3 is loose (F6), but the measured values are far inside it. |
| No automatic look-back | **Met** | Nothing writes `follow.lookBack` except the player's input (`GameSession.ts:359`), and the old scripted look-back is gone. In probe 1, the lowest dir.z over 6 s was 0.904. The largest yaw away from travel was 17° (Alpine, while steering), and it was camera lag, not a look-back. The Yeti never came within 16 m in the first 6 s (minimum 19.2 m), so the sideways swing that avoids the Yeti never fired. The skier model's head glance (`GameSession.ts:1047`) is cosmetic; the camera does not follow it. |
| Manual look-back works | **Met (keyboard e2e on Alpine; pad by code)** | `cave_skip.spec.ts:227-242`: holding C turns the view to dir.z < −0.3, and on release it returns to > 0.3. Unit `handoff_camera` covers the same. Pad B maps to the same field (`Input.ts:277`); see F6. |
| Reduce Camera Motion | **Met for the hand-off** (edge case in F3) | With the setting on, the shot holds on the Yeti, cuts once to the forward pose at 15.25 s, and holds to 15.8 s (`CaveCinematic.ts:156-159`). The e2e asserts at most one turn > 1.5° and no jump at the hand-off (fjord, hard). Shake is zero in both the cinematic and the follow camera. |
| Controller behaviour | **Met** | Start reads as both pause and skip in one frame (`Input.ts:278-279`). In a seen cinematic the pause is ignored and the skip applies; in a first viewing the pause wins. A Start press that closes the pause menu is not re-read by gameplay (`padUsed`, `Input.ts:115, 280, 311`, unit test). The e2e skips with Start at 9 s and 15.7 s. The prompt glyph is Start or Options. |

**Caveats (they do not change the verdict):**
- I have not seen a rendered hand-off on this build (the strip was not captured yet).
- A pad Start pause on the first viewing, and a pad B look-back, are tested only below the browser level (F6).
- Reduce Camera Motion turned on from the pause menu during the first viewing does not take effect for that cinematic (F3).

## Round 2 → round 3 (my items)

| R2 | Status | Check |
|---|---|---|
| N1 / W-072 Blizzard direction vs HUD; lost warnings | **Mostly fixed; residual → F1** | `blizzardPushDir` follows the front when s > 0.3 (`hazards.ts:225-236`). The caption uses the same rule. Queue TTL is 8 s (`GameSession.ts:868-876`). Probe 2: the HUD arrow agrees with the push in 63/64 cells. The caption disagrees in 11/120 cells (F1). |
| N2 / W-073 Candidate integrity | **Fixed** | Diff to HEAD is empty. All 11 specs ran on `dist` from `46ed200`. The contended `game` failure is published, not hidden. |
| N3 Migration assertion | **Fixed** | `settings.ts` is unchanged since `b70a793` (the round-2 change was reverted). `migration.spec.ts:171` requires `reduceWeather: false` again, with no optional branch. `migration.txt` 2/2. |
| N4 / E12 Accessibility features untested in the browser; no `aria-live` | **Not fixed → F2** | No e2e reads a Whiteout caption, Reduce Weather, or Whiteout in the Location row (`menu.spec.ts:197` covers Alpine and Fjord). `Hud.ts` has no `aria-live`. There were no captures at UI 150% or with Reduce Weather on/off at review time. |
| N5 Reduce Weather strength | **Not changed** | `World.ts` is not in the round-3 diff. Carried as a Minor in F2. |
| N6 `saveSettings` non-object | **Moot** | The code that caused it was reverted. |
| N7 / W-057 Caption advises the lee | **Fixed** | The front caption now names the flagged gaps (per the tracker; I did not re-measure). |
| E7 / W-074 Pill contrast | **Fixed** | `rgba(140,82,0,0.94)` with white text, which I computed over the scene: **5.54:1 over white snow** up to 6.91:1 over black. The tracker's "6.3:1" is a mid-grey figure, but every case passes AA 4.5. |
| E8 `reduceFlashes` | **Not fixed → F4** | The rescue beacon at 1 Hz and the light bar at 1.4 Hz (`rescue.ts:632-636`) and the storm eye glow (`GameSession.ts:1225`) still ignore the setting. |

## Findings

### F1 (Major): about 1 blizzard warning in 11 still names the wrong side

**Evidence (probe 2, `/tmp/eprobe/blizzdir_out.txt`):**
- Across 120 warned cells the skier reached:
  - **11 captions named the opposite side** from the push the cell gave as the skier crossed it;
  - in **3 cells the push reversed** inside the cell's ±25 m;
  - the HUD arrow disagreed with the push once in 64 cells where it was shown.
- Per course, the caption was wrong 0–3 times; Classic Standard had 3 of 13.
- **Cause:**
  - The caption's direction is computed at the moment of the warning, `blizzardPushDir(e.hazard, e.t, …)` (`GameSession.ts:871`).
  - The push is computed every step at the current time, `blizzardPushDir(h, c.t, c.seed)` (`hazards.ts:325`).
  - The push switches between the cell's own direction and the front's direction when s crosses 0.3, during a 9 s build and an 8 s ease (`storm.ts:131-147`).
  - A warning given about 8 s ahead of the cell (the TTL is sized for that) therefore spans the switch.
- In the early part of the build (s < 0.3), the HUD already shows "STORM IN n s ←/→" while cells push their own way. That accounts for the single arrow mismatch.

**Player impact:** a deaf or hard-of-hearing player, who relies on the caption for the cell's direction, is told the wrong side about 9% of the time. The "stand up out of the tuck" advice stays correct. A push that flips inside a cell cannot be read by anyone.

**Fix:** latch one push direction per cell when its warning is first emitted (store it in the hazard's runtime state), and use it for the caption, the push and the windX for the whole cell. Alternatively, compute the caption for the predicted arrival time and freeze the push once the cell is telegraphed. Add a test over a span of seeds: caption side = push side at the crossing, and no sign change inside a cell.

### F2 (Minor, carried from R2 N4/N5/E12): accessibility features still have no browser or capture evidence, and no `aria-live`

**Evidence:**
- `grep` over `tests/e2e`: no assertion on a Whiteout caption (`whiteout.spec.ts` uses `weatherHud().pill` only), on Reduce Weather Effects, or on choosing Whiteout in the menu (`menu.spec.ts:197`, Alpine and Fjord).
- `Hud.ts` has no `aria-live` or role on the caption box.
- `DEFECTS.md` W-074 says "Capture of a11y features: in the round-3 evidence". At review time `candidate/evidence/` held only `rim_1366/`, and `CANDIDATE.md` lists no Reduce Weather on/off pair and no UI-150% capture.
- Reduce Weather is unchanged since round 2: fog keeps 60% of the excess.

**Impact:** regressions in captions or settings would go unnoticed. Screen-reader users get no announcement of storm or blizzard warnings.

**Fix:**
- e2e: assert the front and blizzard caption text in `whiteout.spec`, and select Whiteout in `menu.spec`.
- Add `aria-live="polite"` to `.hud-caption`.
- Capture Reduce Weather on/off at storm peak, plus two caption lines at UI 150% at 1280×720 and 1366×768.

### F3 (Minor): Reduce Camera Motion turned on mid-cinematic does not stop the swing

**Evidence:** the swing or cut is chosen once, in the `CaveCinematic` constructor (`CaveCinematic.ts:156`). The first viewing is pausable, and the pause menu offers Settings (`App.ts` pause items). `applySettings` updates only `follow.reduceMotion` and `shakeScale` (`App.ts:163-166`).

**Impact:** a player who pauses because the first cinematic's camera moves bother them, and turns the setting on, still gets the 1.1 s orbit for that cinematic. The setting also leaves the 2.4 s opening crane, the handheld drift and the rear-view zoom from 48° to 22° untouched. Its scope is narrower than its name.

**Fix:** decide swing or cut inside the shot functions at evaluation time (read `st.settings.reduceCameraMotion` in `from`, `to` and `orbit`). Document in the menu note what the setting covers. Consider cutting the opening crane too.

### F4 (Minor, carried E8): `reduceFlashes` is ignored by the rescue beacon, the light bar and the storm eye glow

**Evidence:** `rescue.ts:632-636` sets opacity from `sin(2πt)` and `sin(9t)` with no check. `GameSession.ts:1225` sets the storm eye glow. Both rates are under 3 Hz, so this is not a WCAG flash failure, but the setting promises "Reduce flashes & pulsing".

**Fix:** with `reduceFlashes` on, hold the beacon and light bar steady (or pulse them at ≤ 0.5 Hz and low depth), and cap the eye glow as `CaveCinematic.ts:191` does.

### F5 (Minor, QA): `game.spec` intro check is timing-dependent

**Evidence:** `game_run1_contention.txt` failed at `game.spec.ts:85` (`intro` expected false after Space). The test presses Space and then steps `frames(3)`. `frames` uses neutral input (`debugFrames`), so the key press only counts if the live rAF loop ran a frame in between, which it may not do under load. The rerun passed alone.

**Impact:** a false failure under CI load. This is not a game defect: Space and A skip the intro (`GameSession.ts:291`).

**Fix:** use `hold(true)` plus `framesLive(3)` after the press, as `cave_skip.spec` does.

### F6 (Minor, QA): `cave_skip` assertions are loose and its log records no measurements; some controller paths are untested in the browser

**Evidence:**
- Forward is asserted as dir.z > 0.3 (`cave_skip.spec.ts:183, 186, 223`), which would pass a view 72° off downhill. Probe 1 shows the real values are about 0.98.
- `cave_skip.txt` prints only pass and fail: no frame turns, no dir.z, no hand-off state.
- Untested in the browser:
  - pad Start as a pause on a first viewing (only Escape is tested);
  - pad B look-back;
  - look-back in Whiteout or Fjord (Alpine only).

**Fix:**
- Assert the angle to `FollowCamera`'s ideal forward direction (< 5°), or dir.z > 0.9.
- Log the measured turns and directions per case.
- Add pad Start on a first viewing, and pad B look-back in one Whiteout case.

### F7 (Minor): no option to turn off controller vibration; round 3 adds a strong landing rumble

**Evidence:** `this.rumble?.(0.8, 0.5, 260)` fires on the Yeti's landing (`GameSession.ts:383`), along with the existing rumble calls. The Settings screen has no vibration item (`App.ts:640-670`).

**Impact:** some players with motor or sensory sensitivities need vibration off; their only workaround is to turn it off at the OS level.

**Fix:** add a "Controller vibration" slider or toggle (default on) and scale `Input.rumble` by it.

### Observations (not defects)

- **RUN. title:** it sits at 36% screen height, 44–96 px, for 1.6 s on the first controllable frame (`styles.css:175`), over the upper part of the forward view. This is by the owner's design. It is semi-transparent text, not a panel. Worth checking in the strip.
- **"Seen" is one flag for all locations** (`book.seenCaveCinematic`). A player who has seen Alpine's cave can skip Whiteout's storm-cave version on its first showing. Confirm that this is the owner's intent.
- **Blizzard warnings are marked warned when queued**, not when shown (`Hud.caption` returns true on queue). The 8 s TTL makes an unseen expiry rare. The tracker text "warned only when shown" overstates this.

## What I could not verify

- **Rendered hand-off frames** (`handoff_strip/`) and the `whiteout/` capture set: not present during the review. My W-076 verdict rests on code, unit tests, the e2e log and probe 1, not on images.
- **The real cave ledge spawn:** probe 1 and `cave_handoff` use the spawn without the ledge argument. The browser spec covers the real path but logs no numbers.
- **Hard Yeti speed in probe 1:** I did not apply `speedMul`, so the Hard and Normal rows are identical. The hand-off camera does not depend on it until the Yeti is within 16 m, and it was never that close in 6 s.
- **Real-time behaviour:** feel, motion comfort, audio cue audibility and direction, actual reading time at speed, and screen-reader behaviour: model reviewer, no playtest, no audio.
- **The developers' balance data** (W-056, W-077) and the perf numbers: not re-run.
- **The `dist` build of `46ed200`:** I trusted the log headers that the specs served it.
- **SonarCloud findings:** not readable from here.

## What would raise category 7 to 9

1. F1: one direction per cell, shared by the caption, the push and the HUD, with a seed-sweep test.
2. F2: caption, Reduce Weather and Whiteout-menu e2e; `aria-live`; the accessibility captures.
3. F3, F4, F7: Reduce Camera Motion honoured live and scoped; `reduceFlashes` applied to the rescue beacon, light bar and eye glow; a vibration setting.
