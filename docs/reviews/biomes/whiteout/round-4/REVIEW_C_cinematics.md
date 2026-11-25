# Whiteout Ridge, round 4: Review C (Cinematics & Camera)

- **Reviewer:** C, Cinematics & Camera. I own category 5 (Cinematics). My scores in the other categories are low confidence (lc).
- **What kind of review this is:** I am a model reviewer, not a human playtester. I did not play the game. I judged it from still frames, the capture manifests (camera poses, Yeti state), the source diff and the committed browser logs. I saw no motion at frame rate and heard no audio. Anything about feel is marked as inference.
- **Build:**
  - The frozen source is `71c9ceb`.
  - `git diff 71c9ceb HEAD -- src` is empty, and so are the diffs from `71c9ceb` to `6ff50f9`, the SHA in the evidence manifests.
  - The strip_rcm manifest records `0787168` (HEAD), which has the same source.
  - The e2e logs record `056a930` (cave_skip), `6b0e7ca` (cave_history) and `6ff50f9` (game). All three have source identical to `71c9ceb`.
- **Order of work:** I looked at every image before reading `CANDIDATE.md` and the manifest notes. Specifically:
  - all 30 shots in `whiteout/`;
  - all 48 frames of `strip_high/`, and the 16 frames each of `strip_low/` and `strip_rcm/`;
  - 2× crops of every inset (frames 07–15, all strips), and 4× crops of the Whiteout and Alpine insets 08/09–15;
  - full-resolution views of 01, 21, 22, 23, 24 and 26, crops of 16, 17, 25 and 26, a contrast-stretched copy of 24, and pixel samples of the doorway and fur;
  - side-by-side views of round-3 against round-4 for shots 21, 24 and 25.
- **Code read:** `git diff 46ed200 71c9ceb -- src` for `CaveCinematic.ts`, `Timeline.ts`, `caveHandoff.ts`, `App.ts` (`prepareRearView`, cave history), `GameSession.ts` (`rearView`, `rearViewZoom`, `FRONT_QUIET`, RCM intro), `rescue.ts`, `rescueVictory.ts`, `styles.css`, `Hud.ts`, `settings.ts` (decision B), `stormCave.ts` (slicing only). I also read `tests/unit/handoff_camera.test.ts` and `tests/e2e/cave_skip.spec.ts` (thresholds).
- **Not done:** I ran no browsers, no Playwright and no tests, as instructed. The `a11y_*` capture folders named in `CANDIDATE.md` did not exist in `evidence/` when I reviewed, so the UI-150 % and Reduce-Weather captures are unreviewed.

---

## (a) Scores

| # | Category | R3 | R4 | Justification |
|---|---|---|---|---|
| 1 | Visual art direction (lc) | 7 | 7 | The cave close-ups (13, 14) are unchanged: the rime blades still read as folded paper. The victory reveal now has sky, a lit lantern and characters. I leave Art to Reviewer A. |
| 2 | Environmental uniqueness (lc) | 7.5 | 7.5 | Not re-examined beyond the cinematic frames. |
| 3 | Skiing and hazard mechanics (lc) | 6.5 | 6.5 | Not examined. |
| 4 | Difficulty and fairness (lc) | 6.5 | — | Not examined. I have no view to give. |
| **5** | **Cinematics** | **7.5** | **8** | **What improved and is verified in image:** the Whiteout leap and its landing now read in the inset on High, Low and Reduce Camera Motion. The finish crane opens on the skier and lantern, and the reveal shows the porch side-on with people in it. RUN. clears the inset. W-076 parity still holds. **What keeps it from 9:** the climax still does not show what it says. No beam is visible and there is no flinch (C4-1, Major, carried for the third round). Alpine's leap is still pale on pale (C4-2). The set-up shot still leaves the skier as a sliver on the bottom bar (C4-3). |
| 6 | Performance and stability (lc) | 7 | 7 | Not examined. The strip manifests have `errors: []`, and the three e2e logs I read pass. |
| 7 | Accessibility and controls (lc) | 6.5 | 7.5 | **Verified:** Reduce Camera Motion in pixels (one 112° cut, then a still frame); the Low-quality inset during the leap; the RUN. position at UI scale 1.0; captions `aria-live` (code). **Not verified:** UI 150 % (no captures). |
| 8 | Overall player experience (lc) | 7 | 7.5 | The chase's first beat is now clean: no storm alert, RUN. below the inset, the leap visible, then the landing caption. The finish story's middle and end read. Its climax does not. |

**Category 5 gate: 8/10 against a target of 9, so not met.** There are no Critical findings. One Major remains in Whiteout's own presentation (C4-1). One Major is carried on Alpine (C4-2).

---

## (b) The judgements requested

### W-082: Yeti leap legible, landing seen, on Low too. **Whiteout: verified. Alpine: not met.**

| Check | Whiteout | Alpine | Fjord |
|---|---|---|---|
| Leap readable in the inset | **Yes.** In `07` he stands in the dark mouth. In `08–09` he is up on the cornice. In `10–13` he is a pale figure about 15–20 px tall (at 540p) crossing **dark rock**. In `14` he is a darker grey figure descending against the snow slope. | **No.** He reads in `07–08` against the dark mouth. In `09–13` he is a pale figure of about 15 px on pale limestone, which I could find only at 4×. In `14–15` he is a faint shape among the trees. | Yes: he reads against dark rock and then blue sky (`09–14`). |
| Landing in frame | **Yes.** `15` (chase 2.07 s, `yetiAirborne:false`, mode `run`): a dark figure with a white snow burst at his feet, and the main view shows the caption "[a heavy landing behind you]". | Lost: `15` shows no clear figure. | Yes: `15` shows the snow burst. |
| On Low | **Yes.** `strip_low/whiteout_07–15` show the same staging at lower texture detail. The figure and the landing burst read as on High. The code forces the inset on while `rearViewZoom() > 0` (`App.ts:871-872`). | — (no Low strip) | — |
| No fade-in | **Yes.** `.rear-view.snap { transition:none }` is applied during the leap. In `07` the inset is at full opacity on the first controllable frame. | | |
| Strip extended to the landing | **Yes.** The strip ends at 2.07–2.10 s. | | |

- **Manifest against image:** the claim in the code comment (`GameSession.ts:424-426`) and in DEFECTS ("the arc against the sky") is **not** what the Whiteout frames show. There the arc crosses dark rock, not sky. That is what makes it legible, so the outcome is good and the stated mechanism is wrong. Only Fjord shows the arc against sky.
- **Size:** the figure is small: about 15–20 px at 960×540, or about 2 % of the screen height. Whether a player's eye finds it in a 190 px inset at the moment RUN. appears is a motion judgement I cannot make (inference: probably yes, because it moves).
- **Rear-view setting off:** with the setting off, the leap still has no image. That respects the player's choice, and the landing caption remains.

### W-083: victory beats readable. **Crane and reveal: fixed and verified. Searchlight on the Yeti: not fixed. Doorway: not fixed.**

| Beat | Code (`71c9ceb`) | Image | Status |
|---|---|---|---|
| Searchlight on the Yeti (11.0–13.6 s) | The camera moves to his flank, 7–8.5 m out (`rescueVictory.ts:128-136`). The spot is raised to 1400 at 0.2 rad (`rescue.ts:661-663`). The beam shader is unchanged: an additive cone with alpha ≤ 0.42 (`rescue.ts:478-490`). The flinch is still `setYetiMode('disgust')` (`rescueVictory.ts:202`). | **24** (11.9 s): no beam crosses the frame, not even in a contrast-stretched copy. There is no pool at his feet that reads as light: the snow under him is about 20 levels brighter than the far snow, which I can only measure. The fur has a faint warm cast. He stands upright with his arms out low and his mouth open. It reads as a snarl or an advance, not a flinch. | **Open, Major (C4-1)** |
| Crane opening (13.6 s) | Starts at `sk() − toHut·4.5 + side·2.2`, aimed at the skier | **25** (16.0 s, mid-rise): the skier with the lantern's glow on the snow and the porch with a rescuer behind him, the storm still on. The subject is clear. (The 13.6 s start itself is not captured.) | **Fixed (verified)** |
| Reveal (20.5 s) | `endPos` at across·38 + faces·16 + 13 m | **26**: the station side-on in the right half, the porch with its two rescuers visible, the skier with a lantern halo in the snow about 10 m off the porch, blue sky with broken cloud, ranges on the horizon. | **Fixed (verified).** The figures are small (skier about 30 px at 768p); see C4-6. |
| Lit door and panes | `warm` / `warmDim` given `fog:false` (`rescue.ts:282-283`) | **21/22**: the doorway is still a **flat tan panel**. It samples (196,174,141), against round 3's (197,178,149), so it is effectively unchanged. Nothing warm spills. The windows read white or cream. | **Not fixed (C4-4).** The change had no visible effect. |
| Lantern halo at the raise | Unchanged | **22** (8.2 s; the note says "halo + light"): no halo on the lantern; the glass is pale. The halo *does* show in 25 and 26. | Note contradicts image (C4-7) |
| Pole in the lantern hand | Unchanged | **22**: the pole still hangs from the lantern hand. | Open, minor (C4-5) |

### W-091: set-up shot. **The Yeti is better. The skier is not fixed.**

- **Yeti:** the 34° lens makes him about 48 px tall at 540p in `whiteout_01/02` (round 3: 27–47 px). He reads clearly in the dark mouth on Whiteout and Alpine.
  - On Fjord his head sits close under the top bar (`fjord_01`).
  - He stays in `stand` throughout (manifest `yetiMode`). There is still no gather or crouch.
- **Skier:** he is still a cropped red sliver on the bottom bar in **all three locations**. In `alpine_01` the red pixels span rows 444–480, ending exactly at the bar (481). Whiteout and Fjord look the same (helmet and back only).
- **Why the test passes:** the unit test projects a fixed `P + 1.5 m` head, with shoulders 0.3 m lower (`handoff_camera.test.ts:43,76-78`). In the frames the skier is in a **deep crouch** at 14.03–14.57 s (`*_00`: full tuck), so his real head is far below 1.5 m. The test passes a frame where most of the skier is under the bar. This is the R3-C2 point 4 again (C4-3).
- **Lift fix (R3-C6):** fixed in code. `leapSetupCamera` tests the lines to both the Yeti's spawn and the head, and the unit test now uses the same function. No obstruction is visible in any of the three strips.

### W-076 parity: **still holds (PASS)**

- **Turn per 0.27 s step (from the manifest):**
  - The swing is 29–50°.
  - Across the hand-off it is 6.9–8.5°.
  - After the hand-off it is ≤ 1.4°, on every location, on High and on Low.
- **Reduce Camera Motion:** hold, then hold, then a single 112.5° cut at about 15.25 s, then 0.0°. The forward view is still for 0.55 s before control (`strip_rcm` 05–06), and the FOV stays fixed at 64.
- **First controllable frame:** faces the run. Its `dir.z` is 0.914 (Alpine), 0.987 (Fjord) and 0.973 (Whiteout) (`cave_skip.txt`).
- **Skip parity (`cave_skip.txt`, 6/6 pass, 1.1 h):** watched and skipped are identical within 0.05 m and 2° for Escape at 1 s, pad Start at 9 s, Escape during the swing and pad Start just before the leap. This covers Alpine/Fjord/Whiteout Normal, Alpine slow arrival, Whiteout Hard and Fjord Hard with RCM.
- **RCM is now read live** (`Timeline.Shot.when`, `CaveCinematic.ts:141-147`). Both branches end on `gameplayPose()`, so a mid-cinematic toggle cannot break the snap.
  - Edge case (inference, not tested): toggling RCM *during* the 15.25–15.8 s window jumps the camera from the swing to the forward hold. That is a single cut, not a pop.
- **Decision B (`cave_history.txt`, 1/1 pass):**
  - `seenCave` is keyed by biome and is set only in `finishCave`, which runs only on completion.
  - Pausing or abandoning before then does not mark the location seen.
  - A skip is possible only when `recordsSeenCave` is set.
  - None of this touches the Yeti, the camera or timing. Parity is unaffected.

---

## (c) Findings

### C4-1: Major (carried R3-C7 / W-083 N-5, third round). The searchlight beat still shows neither the light nor the flinch.
- **Evidence:**
  - Frame **24** (11.93 s; the manifest note says "in the searchlight beam, flinching"). There is no beam cone in the frame, and none appears even after a 2.5× contrast stretch.
  - There is no readable light pool on the snow. The foreground under him samples (189,194,203) against (151,167,186) further left, which also follows the fog and distance gradient.
  - The Yeti is in the `disgust` pose: upright, arms forward and low, mouth open. That is the same reading as round 3: a snarl, not a recoil.
  - **23** (10.2 s; the note says "past the skier and lantern") has no skier and no lantern in the frame.
- **Code cause:**
  1. The beam is an **additive** cone with alpha ≤ 0.42·(1−d), drawn in near-white colour (`rescue.ts:478-490`). Added to a storm background of about (190,200,215), it is invisible. Moving the camera to his flank cannot fix a beam that has no contrast.
  2. A 1400 spot on white fur and white snow under AgX at exposure 0.78 compresses into the same near-white.
  3. `disgust` is not a flinch. No pose was added.
- **Player impact:** the climax's cause and effect ("the light drives him off") is still invisible. The finish reads as "he walks up, grimaces and leaves".
- **Fix direction:**
  - Make the light read by **darkening around it**, not by brightening white on white:
    - during 11.0–13.0 s, drop the ambient/hemisphere and exposure about 30 % in the storm, so that the lit cone and the pool stand out;
    - draw the beam as a *normal-blended* cone with fog-coloured dust (alpha about 0.25), or as a cone of streaking snow particles lit by the beam;
    - project a hard-edged decal or pool at his feet (`toneMapped:false`).
  - Give him a rim or over-exposure pass on the lit side.
  - Add a dedicated recoil clip: arm across the eyes, head turned away, a half step back.
  - Put the lantern or the skier's silhouette soft in the foreground of 23 so that the eyeline reads.

### C4-2: Major (carried R3-C1 / W-082 on Alpine). Alpine's leap is still pale on pale after the cave mouth.
- **Evidence:**
  - `strip_high/alpine_09–13` (4× crops): a figure of about 15 px on pale limestone, which I found only by zooming.
  - The landing (`alpine_15`) is not discernible.
  - The new side offset (`side = 2.4 + 4.2·z`, `y − 0.8·z`) does not change the backdrop on this cave. The dark rock that makes Whiteout work does not exist here.
- **Scope:** this is outside Whiteout's own presentation, but it is the same code path and the W-082 row (originally "Alpine/Whiteout").
- **Fix direction:**
  - Aim the inset camera so the Yeti's path is framed against the sky or the dark mouth. For example, raise the look target about 4 m above his root during `leapPending` so the sky fills the top half, or choose the side per cave by testing the backdrop luminance along the arc.
  - Or add a thin dark outline/rim on the Yeti while `leapPending` (inset only).

### C4-3: minor (carried R3-C2 / W-091). The set-up shot still crops the skier to a sliver on the bottom bar, and the test that should catch it measures the wrong pose.
- **Evidence:**
  - `*_01/02`, all three locations: helmet and back only, ending on the bar (`alpine_01`: red rows 444–480, with the bar from 481).
  - `*_00` shows the skier in a full tuck at 14.03 s.
  - The test uses a fixed 1.5 m head (`handoff_camera.test.ts:43`), which matches an upright pose the frames do not show.
  - The Yeti stays in `stand` with no gather.
- **Player impact:** the hunter/hunted over-the-shoulder link is a red bump at the frame edge, and nothing telegraphs a jump. The shot lasts about 0.5 s, so the impact is limited.
- **Fix direction:**
  - Put the skier in an upright look-back pose for 14.2–14.7 s, or aim at `P + 0.9` and add 0.4 m of lift.
  - Have the test project the **posed** skier's head bone after `poseOverride` is applied.
  - Play the leap's crouch frozen at about 0.2 s from `CAVE_GATHER_AT`.

### C4-4: minor (carried R3-C7 / W-083 N-3). The open doorway is still flat tan, and `fog:false` had no visible effect.
- **Evidence:** `21` and `22`, doorway pixel (196,174,141), against (197,178,149) in round 3. Nothing warm spills onto the porch or the snow.
- **Likely cause (inference):** AgX tone mapping desaturates the LDR orange (1.0,0.62,0.24) toward beige. Fog was not the limiting factor.
- **Fix direction:** set `toneMapped:false` on `warm` and `warmDim`, or drive them as HDR (×3–4). Add a warm light card on the porch deck and the snow below the step.

### C4-5: minor (carried). The pole stays in the lantern hand.
- **Evidence:** `22`: the pole hangs from the raised lantern hand.
- **Fix direction:** drop or stow the pole on that side at `B.lantern`.

### C4-6: minor (new). The reveal's subjects are very small.
- **Evidence:** `26`: the skier is about 30 px tall at 768p and the rescuers about 15 px. The skier stands about 10 m out from the porch rather than on it, which `22`'s close framing had hidden. The composition is otherwise good.
- **Fix direction:** end the crane about 30 % closer, or at a narrower FOV (about 40°). Keep the skier on the porch mark through the rise.

### C4-7: minor (evidence integrity, carried R3-C10 / W-084). Several manifest notes still do not describe their images.
- **Contradictions:**
  - `15` "The leap (15.2 s)": the manifest itself records `inMainView:false`, and there is no Yeti in the frame.
  - `20` "letterbox on": no bars (the HUD and letterbox are hidden by the capture).
  - `21` "skier arriving": no skier.
  - `22` "halo + light": no halo.
  - `23` "past the skier and lantern": neither is in frame.
  - `24` "in the searchlight beam, flinching": neither is visible.
- **Now correct:**
  - `16`: the gap is 28 m, the HUD agrees, and the Yeti is a small dark figure in the inset.
  - `17`: an 80 px dark silhouette with two faint eye glints. W-009 is now evidenced at a close gap, although from a debug look-back camera at 50° FOV, not the gameplay view.
- **Also:**
  - The front phase in the 20–26 manifests reads `storm` with s ≈ 0.8–0.94, while 25 and 26 show the staged clearing. The manifest records the live front, not what is on screen.
  - The `a11y_*` captures listed in `CANDIDATE.md` are absent.
- **Fix direction:**
  - Write the notes from the frames, or derive them from recorded facts (Yeti visible, skier visible, letterbox state).
  - Record the staged weather in the victory shots.
  - Capture victory with the letterbox and title on.

### C4-8: note (test margin, no player impact)
- `cave_skip` asserts that the first controllable frame has `dir.z > 0.9`. Alpine logs 0.914 (0.902 lowest over 2 s, against a 0.85 floor).
- The spec comment says "0.978–0.989 (review E)", which describes Fjord and Whiteout, not Alpine.
- **Fix direction:** correct the comment. The margin is real but thin, so log the yaw in degrees.

### Verified resolved since round 3
- **R3-C3 / W-085, crowded opening:** Whiteout strip `07–15` show no storm chip and no front caption during the first 2 s. In code, `FRONT_QUIET = 3` gates alerts only. Whether a front was building on this seed is not recorded.
- **R3-C4 / W-085, RUN. overlapping the inset:** at 960×540, RUN. sits clearly below the inset (`07–12`).
  - The new CSS `top` (`styles.css:178`) sits inside `.ui { zoom: var(--ui-scale) }`. The px term is therefore probably scaled twice at UI > 1, which pushes RUN. *lower*, not into the inset.
  - Not rendered at 150 %.
- **R3-C5 / W-082 on Low:** the inset is shown on Low for the leap (verified in pixels).
- **R3-C6, lift target:** fixed in code and in the test.
- **R3-C9, crane opening and reveal:** see W-083 above.

---

## (d) Other scope, briefly
- **Cave beats 0–14 s:** unchanged in code apart from the set-up camera.
  - `12`: a dark rimed mouth with a dim shape inside; 103 px.
  - `13`/`14`: strong close shots of 252 px and 389 px. The face reads, and driven snow streaks cross the mouth.
  - The rime blades still look like folded paper in close-up (A's area).
- **Opening crane:** RCM now holds the establishing view and cuts at 2.6 s (`GameSession.ts:257-261`). This is code only; there are no frames on this build.
- **Storm chase `16`:** at 28 m and "▲ CLOSING", the Yeti is a dark figure of about 10 px in the inset. The threat is carried mainly by the HUD bar and the caption "[heavy footsteps behind you]". This is acceptable for a pursuit view, but the storm silhouette shown in `17` never appears in the gameplay camera.

## (e) What I could not verify
- Motion and feel at 60 fps:
  - whether the eye finds the 15–20 px leaping figure in the inset under RUN.;
  - the comfort of the 29–50° per 0.27 s swing;
  - the walk-in pace.
- Audio: the landing thud, the growl at the flinch, the fanfare, the wind drop.
- The victory letterbox and title, and the timing of the results panel (the capture hides the HUD).
- UI 150 %, other resolutions, and Reduce Weather Effects (captures absent).
- Whether a front was building during the Whiteout strip's hand-off (not recorded).
- The 13.6 s first frame of the crane (25 is mid-rise).

## Summary
- The round fixed what it could fix with camera placement:
  - Whiteout's leap and landing in the inset (High, Low and RCM);
  - the crane and the reveal;
  - the RUN./inset overlap;
  - the crowded hand-off.
- W-076 parity and decision B hold.
- What remains needs lighting and animation, not cameras:
  - the searchlight beat (C4-1, Major, third round);
  - the doorway's warmth (C4-4).
- Alpine's leap still disappears against pale rock (C4-2, Major).
- The set-up shot's skier is unchanged, and its test checks a pose the game does not use (C4-3).
- **Cinematics 8/10:** the 9 gate is not met.
