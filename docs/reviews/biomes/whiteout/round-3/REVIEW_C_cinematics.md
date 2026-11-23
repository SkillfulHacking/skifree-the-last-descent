# Whiteout Ridge, round 3: Review C (Cinematics & Camera)

- **Reviewer:** C, Cinematics & Camera. I own category 5 (Cinematics).
- **Nature:** I am a model reviewer, not a human playtester. I did not play the game. I judged it from still frames, manifests (camera poses), source code, unit tests I ran, and the committed browser log. I saw no motion at frame rate and heard no audio. Judgements about feel are marked as such.
- **Build:** frozen candidate `46ed200`. `git diff 46ed200 HEAD -- src tests` is empty, so later commits are docs and evidence only. The hand-off strip manifest records sha `305bf60`, a docs-only commit after `46ed200`, so the source is the same.
- **Changes since the last focused review (`e06d6b9`) that touch my area:** `526785a` only. It moves the leap set-up camera to 6 m behind the skier, adds an angular-blend aim (`caveHandoff.ts:36-42`, `LEAP_SETUP`), and resets the orbit when a cave begins (`GameSession.ts:765`, `FollowCamera.resetOrbit`). The other commits are terrain/cloud-deck (W-065), Alpine pace (W-077) and the pill colour (W-074).
- **What I examined:**
  - All 42 frames in `candidate/evidence/handoff_strip/`. I made 2× crops of every inset (07–13 × 3 locations) and of the bottom band of every set-up frame (01–02) to measure the skier against the bar.
  - `manifest.json` and `run.log`. From them I computed the per-step view turn, the Yeti's distance and his angle off the camera axis.
  - Source: `CaveCinematic.ts`, `caveHandoff.ts`, `orbit.ts`, `Timeline.ts`, `stormCave.ts` (squall/hand-back), `presence.ts`, `GameSession.ts` (`gameplayPose`, cave branch, `finishCave`, `yetiLanded`, `rearViewZoom`, `rearView`, `buildIntro`, `weatherAudio`), `App.ts` (inset), `FollowCamera.ts`, `styles.css`, `rescueVictory.ts`, `rescue.ts`, `trophy.ts`, `victorySteer.ts`.
  - Tests: `tests/e2e/cave_skip.spec.ts` and its log `candidate/e2e/cave_skip.txt`.
  - Earlier reviews: `round-2/REVIEW_C_cinematic.md`, `DEFECTS.md`, `w076-final/README.md` and `REVIEW_C_final.md` (context only, not approval).
- **Run myself:** `npx vitest run tests/unit/handoff_camera.test.ts tests/unit/cave_handoff.test.ts tests/unit/presence.test.ts`. 3 files, **36/36 pass**.
- **Not run:** browsers or Playwright, as instructed.

---

## (a) Scores

| # | Category | R2 | R3 | Justification |
|---|---|---|---|---|
| 1 | Visual art direction (lc) | 6.5 | 7 | The strip shows a flatter, darker storm light, a darker cave in the lull, and the cloud deck below the ridge in frames 05–13. I did not review the art in detail. |
| 2 | Environmental uniqueness (lc) | 7.5 | 7.5 | The cave dressing (rime cornice, darker granite) reads distinctly from Alpine's limestone in the inset crops. The finish was not rendered on this build. |
| 3 | Skiing and hazard mechanics (lc) | 6 | 6.5 | Not examined, apart from the forward camera framing the route and gates from the first controllable frame. |
| 4 | Difficulty and fairness (lc) | 6 | 6.5 | Not examined. Watch/skip parity is asserted by e2e 6/6 on `46ed200`. |
| **5** | **Cinematics** | **6.5** | **7** | **The hand-off is clean and meets every owner decision. The leap itself reads only briefly, and on Alpine and Whiteout only in the inset (R3-C1). The set-up shot keeps the skier as a sliver on the bar (R3-C2). The victory fixes are code-only, and two round-2 majors (door, light beat) are unchanged in code (R3-C7). This is below the 9 target.** |
| 6 | Performance and stability (lc) | 6 | 7 | Not examined. The strip manifest has no errors, and the browser suite is all green per CANDIDATE.md. |
| 7 | Accessibility and controls (lc) | 6 | 6.5 | Reduce Camera Motion is a good alternative. On Low quality, or with the inset off, the leap has no image (R3-C5). RUN. can overlap the inset at UI scale 1.5 on small viewports (R3-C4, computed). |
| 8 | Overall player experience (lc) | 6.5 | 7 | The chase starts fairly and on a readable forward view. The opening seconds of the Whiteout chase are crowded (R3-C3). |

**Category 5 gate:** 7/10 against a 9 target, so **not met**. Nothing is release-blocking in the hand-off itself. The shortfall is leap legibility and the unverified/unaddressed victory beats.

---

## (b) W-076 focused verdict on the final staging: **PASS** (hand-off 9/10, leap presentation 5.5/10)

| Owner's decision / question | Result on `46ed200` | Evidence |
|---|---|---|
| Forward camera at control | **Met** | The hand-off frames face the run: yaw −21.8° (Alpine), −1.4° (Fjord), −10.1° (Whiteout), pitch −9 to −10°. Route, gates and skier are in frame (`*_07`). e2e asserts `dir.z > 0.3` on the first controllable frame and for 2 s after it, in all 6 cases. |
| No automatic look-back | **Met** | After the hand-off the view turns only 0.0–1.2° per 0.27 s step (manifest, all 3 locations, 07→13). The look-back code is gone. The `lookBack: 0.35·sin` at `GameSession.ts:1047` drives the skier's *body* pose, not the camera. |
| Watched and skipped use the same camera | **Met** | Both paths go through `finishCave` → `follow.snap` (`GameSession.ts:777-801`), and the swing's target is `gameplayPose()`, the same snap (`:196-212`, `CaveCinematic.ts:153`). e2e: ≤ 0.05 m and ≤ 2° at the hand-off and 2 s later, with Escape and pad Start at four moments, 3 locations, Normal/Hard, slow arrival, and RCM. Log: 6 passed, 47.1 min, "dist built from 46ed200". |
| Canonical start kept | **Met** | `startCanonicalChase` is unchanged. `cave_handoff.test.ts` passes (I ran it). |
| Clean hand-off: no pop | **Met** | Strip turns per 0.27 s: hold 0.2°; swing 29–50°; across the hand-off 6.8–8.5° (the ease-out tail 15.63→15.80 plus 0.07 s of follow); after that ≤ 1.2°. The unit test asserts that the swing ends exactly on the snap and stays ≤ 3.6° per 60 fps frame. The FOV ramps from 62.5 to 64.3–64.5 across the hand-off, with no step. |
| Clean hand-off: letterbox and captions | **Met** | `letterbox(false)` fires at 14.7 s, and the 0.7 s CSS transition finishes at 15.4 s, before control at 15.8 s. Captions sit at `bottom: calc(11vh + 64px)` (`styles.css:168`), always above the bars. There is no caption from the cinematic live at the hand-off: the roar caption ends at 13.55 s. |
| Skier in frame through the swing (old C3) | **Met** | Frames 03–06 have the skier near the centre in all three locations. The test now checks NDC against the letterbox (`handoff_camera.test.ts`). |
| Orbit held at the trigger (old C4) | **Fixed** | `beginCave` → `follow.resetOrbit()` (`GameSession.ts:763-765`), with a unit test. |
| Threat lands clearly | **Mostly** | The threat is carried by the roar close-up (12.3–13.7), the skier's look-back, the growl at the gather cut, RUN. with its sting on the first controllable frame, the inset, and the landing's thud, rumble, shake and caption. The gather beat itself is weak (R3-C2). |
| Leap legible with the forward camera | **Partly** | The main camera never shows the leap (by design). In the inset he reads well on **Fjord** (dark rock, then blue sky: arc visible in `fj_09–13`). On **Alpine** and **Whiteout** he reads only while he is in front of the dark mouth (`*_07–08`). After that he is a pale smudge on pale limestone or grey rock and white snow (`al_09–13`, `wh_09–13`). The landing (≈ 2.1 s) is in no frame (R3-C1). |
| Reduce Camera Motion as an alternative | **Good** | Hold on the Yeti 14.7–15.25 s, one cut to the forward pose, then 0.55 s still before control (`CaveCinematic.ts:156-159`). No shake in cinematics (`GameSession.ts:430`). A single reverse cut is a standard, comfortable grammar, and the still forward hold lets the eye settle before control. Verified in code and in the e2e case (Fjord Hard RCM: at most one turn step > 1.5°). There are no RCM frames on this build. |

**Why PASS:** every product decision is implemented correctly and robustly. It is verified by code, by a unit suite I ran, by a completed browser run on this exact build, and by the stills. The remaining weaknesses are in what the leap *looks like*, not in the hand-off's correctness. None of them would be fixed by going against the owner's decisions. Each has a presentation-only fix that costs no chase time. R3-C1 and R3-C2 are what stand between this and a "satisfying" leap.

---

## (c) Findings

### R3-C1 — Major (leap legibility; carried from C2, not addressed): on Alpine and Whiteout the leap reads only for its first ~0.3–0.5 s in the inset, and the landing is never evidenced
- **Evidence (frames, 2× inset crops):**
  - `alpine_07/08` and `whiteout_07/08`: he is a clear pale figure in the dark mouth.
  - `alpine_09–13`: a ~10 px pale shape on pale limestone, almost lost.
  - `whiteout_09–13`: he crosses the white cornice, then grey rock, then sits by the bright snow slope. At `wh_12` he is a faint smudge at the right of the cliff.
  - `fjord_09–13`, by contrast: the arc is clearly visible against dark rock and then sky.
- **Evidence (manifest):** across 07→13 the Yeti closes only from 56.5 to 48.4 m (Alpine) and from 48.8 to 35.9 m (Whiteout). He is still `yetiAirborne: true` at 1.67 s in all three locations, so the strip ends before the landing.
- **Evidence (code):**
  - The inset camera is 1.5 m ahead of the skier and 2.4 m to the side, aimed at the Yeti (`GameSession.ts:403-418`). The flight comes almost straight at it, so the arc is foreshortened.
  - The inset fades in over 0.3 s (`styles.css:166`) while the crouch and launch play (0–0.36 s).
- **Player impact:**
  - "He left the cave" reads.
  - "He leapt" (arc, apex, drop) reads on Fjord only.
  - The landing is carried by sound, the caption, rumble and shake. I could not verify any of these as image.
- **Fix (presentation only):**
  - While `leapPending`, offset the inset camera 8–12 m perpendicular to `spawn.leap`, and aim between the Yeti and his landing point, so the arc crosses the box.
  - Add a dark outline or rim boost to the Yeti during `leapPending`. The `yetiRim` point light (`App.ts:206-209`) sits behind him and is not enough against pale rock.
  - Show the inset at full opacity on the hand-off frame.
  - Extend the strip to chase t ≈ 3 s to capture the touchdown and the 22° → 48° ease-out.

### R3-C2 — Minor (composition): the set-up shot (gather) frames the skier as a cropped sliver on the bottom bar, and the Yeti stands still
- **Evidence (frames):**
  - The bars are 59 px at 540p (rows 0–58 and 481–539, measured).
  - In `*_01/02` the skier's helmet and back occupy only about NDC y −0.6 to −0.78, and the body continues under the bar. On Fjord the helmet itself touches the bar (my crop of rows 400–540 of `*_01/02`).
  - The Yeti is about 27–47 px tall at 540p: 67.6 m from the camera on Alpine, 57.4 m on Whiteout, 47.1 m on Fjord, at FOV 40 (manifest). He is in `stand` (manifest `yetiMode`) for the whole 0.5 s hold.
- **Evidence (code):**
  - `LEAP_SETUP = { back: 6, lift: 0.3, toSkier: 0.5, fov: 40 }` (`caveHandoff.ts:36`).
  - The new unit test checks the head at a fixed `P + 1.5 m` against `|y| < 0.75` (`handoff_camera.test.ts`, the "leap set-up shot" case). The skier is crouched in the look-back pose (`poseOverride lookBack:1`, `CaveCinematic.ts:218`), so the real helmet sits lower than that point. The test passes a frame where most of the skier is under the bar.
  - The "gather" is only a label: `CAVE_GATHER_AT` sets `stand` (`CaveCinematic.ts:222-230`). The crouch still plays after control returns, inside the fading-in inset.
- **Player impact:** an improvement on `e06d6b9`, where there was no skier at all. But the over-the-shoulder tie between hunter and hunted is a red bump at the frame edge, and nothing telegraphs a jump. This is the beat the owner's staging names "gather".
- **Fix:**
  1. Set `toSkier` to about 0.6, or aim at `P + 1.0`, so the helmet and shoulders sit around NDC −0.5.
  2. Tighten to FOV 32–34 (Yeti about 45–60 px).
  3. At `CAVE_GATHER_AT`, play the leap's crouch frozen at about 0.2 s, and start `leap` at `modeTime ≈ 0.22` on hand-off.
  4. In the test, project the posed skier's actual head bone, and require the torso (`P + 0.7`) above the bar.

### R3-C3 — Minor (attention; carried from C5, not addressed): on the Whiteout strip seed a storm front lands on the hand-off
- **Evidence:**
  - `whiteout_07–13`: on the first controllable frame the player gets RUN., the leap in the inset, a "STORM IN 3 s ←" chip counting to 1, and the two-clause caption "[a storm front rolls in — the wind pushes you left; ski the flagged gaps in the drifts]".
  - The landing caption follows at about 2.1 s (`GameSession.ts:384`), and the front arrives at about 3 s.
- **Player impact:** the chase's first beat and a weather decision compete for the same 3 s. This is a cinematic attention problem, not a fairness one: W-056 keeps the stretch fair.
- **Fix:** let no front *build* in the first ~3 s of a chase (extend W-056's fair-opening rule). Alternatively, keep the chip but hold the front caption until RUN. fades (1.6 s).

### R3-C4 — Minor (layout; computed, not rendered): RUN. sits right under the inset and can overlap it at UI scale > 1 on small viewports
- **Evidence:**
  - At 960×540, the cap height of RUN. starts about 4–8 px below the inset, and its red glow overlaps the inset's frame (`whiteout_07` crop).
  - Computed from `App.ts:866-871` (inset top `78·ui`, height `min(420·ui, 0.3W)/2.4`) and `styles.css:175` (`.hud-center.run { top: 36% }`):
    - 1280×720 at UI scale 1.5: inset bottom at 277 px, RUN. box top at 259 px.
    - 1366×768 at UI scale 1.5: inset bottom at 288 px, RUN. box top at 276 px.
  - So RUN. overlaps the inset by 12–18 px in exactly the configuration a low-vision player would choose.
  - I did not check whether `--ui-scale` also enlarges RUN.
- **Fix:** place RUN. below the inset (`top: max(36%, inset bottom + 16px)`, via a CSS variable that `App` sets), or lower it to about 46% during `leapPending`.

### R3-C5 — Minor (carried C6): on Low quality, or with the rear-view glance off, the leap has no image at all
- **Evidence:** the inset is gated on `quality !== 'low'` and `settings.rearView` (`App.ts:855`).
- **Fix:** force the inset on for the leap (about 2.5 s), or caption the launch: "[the Yeti leaps from the ledge]".

### R3-C6 — Minor (test/code consistency): the set-up camera's terrain-clearance lift aims at a different point than the shot
- **Evidence:**
  - `CaveCinematic.ts:134` still tests the line of sight to the *old* positional target (`ledge + 1.6` lerped 0.34 toward the head), while the shot now aims with `leapSetupLook` (`:145`).
  - `handoff_camera.test.ts` omits that lift loop altogether, so a Whiteout cave cut into a bank (the case the loop exists for) is not covered by the composition test.
  - The strip shows no obstruction on this seed.
- **Fix:** test clearance to both the Yeti and the skier's head from the final camera. Run the loop in the unit scenario too, using the shared function.

### R3-C7 — Major, carried (victory staging; code only, no renders on this build)
- **Fixed in code since round 2 (unverified in image):**
  - N-1: the skier stops on the porch mark (`rescueVictory.ts:57`, `victorySteer.ts` `onMark`).
  - N-2: only the lantern flies (`trophy.ts:20-26,50`).
  - N-4: walk-in from 14 m, with the gait following root speed (`rescueVictory.ts:30,70,204`).
  - N-6: the wind follows the staged weather (`GameSession.ts:1355-1356`).
  - N-7: the Yeti is hidden only out of the frustum (`rescueVictory.ts:231`).
- **Not changed in code:**
  - **N-3**, the door: `rescue.ts:639` is the same hinge code that did not visibly open in round 2.
  - **N-5**, the searchlight-on-Yeti beat: beam `uK` 0.12/0.42 is unchanged (`rescue.ts:480, 654-655`), as are the shot-4 framing and the `disgust` pose.
- **Player impact:** if N-5 still reads as in round 2, the climax's cause and effect stays invisible.
- **Fix:** see round-2 N-3 and N-5. Capture victory beats 3.5–13.5 s with the HUD and letterbox on.

### R3-C8 — Evidence notes (no player impact)
- The strip captures are minutes apart in wall time, so CSS transitions are always complete:
  - `*_03` (14.83 s) shows no bars, although the bars are still almost fully closed then (0.13 s into a slow-start 0.7 s curve).
  - `*_07` shows the full HUD and RUN. at full opacity.
  - I judged the letterbox timing from CSS and code, not pixels.
- The strip ends at chase t = 1.67 s, before the landing.
- No RCM frames, and no 1366/1920 hand-off frames.
- `candidate/evidence/whiteout/` held only `01_clear_window` and `02_wall_far` when I finished. No cave, chase, Hard or victory renders exist for this build.

---

## Other scope items, briefly
- **Opening (`GameSession.ts:247-270`):** unchanged. A 4.2 s curved crane into the follow camera's ideal pose under the letterbox, with the title. It uses the same land-on-the-gameplay-pose grammar as the cave hand-off, so the two read as one style. No frames on this build.
- **Cave cinematic beats 0–13.7 s:** unchanged in `CaveCinematic.ts` since round 2 apart from the set-up shot. The Whiteout squall is in its lull (about 0.3 of peak) through 14.2–15.8 s (`stormCave.ts:34,181`), so the set-up and the inset are not fogged out. The hand-back starts from the squall at `CAVE_LEAP_AT` whatever the skip moment (`:225-230`). No cave-dressing frames on this build (W-066 unreviewed by me).
- **Presence cues (`presence.ts`, `GameSession.ts:1269-1283`):** these are presentation only and suppressed during the leap. The distant call does not overwrite another caption. Unit tests pass. I saw no frame with ▲ CLOSING or the call caption.
- **In-run camera (`FollowCamera.ts`):** after the hand-off it holds steady. `chaseFrame` damps in (FOV 64.5 → 67, ≤ 1.2° per 0.27 s), with no pop. Held look-back works and releases (e2e).

## (d) What I could not verify
- **Motion and feel at 60 fps:** the swing's comfort at its peak (strip steps of up to 50° per 0.27 s, about 186°/s average in that interval), and how quickly a player's eye finds the inset.
- **Audio:** the gather growl, the RUN. sting, the landing impact and rumble, the distant calls, and the victory wind drop.
- **The landing as image:** the 22° → 48° inset ease-out, and the snow burst.
- **Reduce Camera Motion in pixels;** the hand-off at 1366×768, 1920×1080 and ultrawide; R3-C4's overlap (computed only).
- **Every victory beat on this build** (no renders). The W-063 fixes are code-read only.
- **Whether the e2e ran on a quiet machine:** it passed (6/6) but took 47 min, and I did not re-run it.
