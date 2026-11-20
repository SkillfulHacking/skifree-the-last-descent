# W-076 focused review, round 3: Reviewer C (Cinematics), the watched cave hand-off

- **Reviewer:** C, Cinematics. **I am a model-based reviewer, not a human playtester.** I watched nothing in real time. What a player "sees" below comes from still frames, the manifest, code and headless experiments.
- **Build:** `pass5-whiteout` @ **a4e8a4d** (source as of 7e4db92). The new hand-off camera is the follow camera's own look-back (`handoffBlend.ts` `lookBackAt`/`shotBlend`, `FollowCamera.lookBackOverride`, `GameSession.ts:344-360`), plus a strip of 63 frames out to chase t = 4.33 s. My reports `REVIEW_C_handoff.md` and `_r2.md` stand as written.
- **Examined:**
  - `git diff ca1679f a4e8a4d` and `FollowCamera.update` (lines 120-200);
  - `tests/unit/handoff_blend.test.ts`;
  - all 63 frames against `manifest.json` (sha a4e8a4d);
  - 3× crops of the Yeti's projected screen position.
- **Ran, in /tmp only:** Vitest under `/tmp/rc/vt`, using the repo's real `FollowCamera`, `shotBlend`, `lookBackAt` and the Classic Sprint mountain and obstacles of each location.
  - The cinematic's last shot is taken from the manifest's `*_03` frame (camera position and direction).
  - The skier follows the route at 13.5 m/s; the run is stepped at 60 fps for the first second.
  - Files: `shot.test.ts`, `shot2.test.ts`, `shot3.test.ts`, `obs.test.ts`.
  - I modified nothing in the repository apart from this file.

## Verdict: **FAIL** (cinematics)

The look-back design fixes most of what I asked for:
- **The skier** is in frame from about 0.6 s onward in every location.
- **The release** onto the run is smooth: at most 45° per 0.267 s in the strip, about 2.8° per frame.
- **The ending** settles on the normal follow camera (`*_20`, the step change is down to 5–6°).
- **Whiteout's landing reads well:** the Yeti is clearly airborne at 1.67/1.93 s and lands with a visible snow burst at 2.20/2.47 s.

Two defects remain:
- **The first 0.5 s of the hand-off contains a one-frame camera jump of about 44°.** It happens about 0.2 s after control returns, in all three locations.
- **The touchdown is not visible in Alpine or Fjord.** In Alpine the HUD and a fir tree hide it; in Fjord the BEHIND YOU inset covers it.

## Findings

### C8 (Critical): a one-frame camera jump of about 44° at 0.2 s, plus a turn the wrong way before it
**Headless, 60 fps** (`shot.test.ts`, the real `FollowCamera` and `shotBlend`, the shot pose from the manifest):

| Location | Largest single-frame turn | When | Camera yaw by frame |
|---|---|---|---|
| Alpine | **43.3°** | t = 0.20 s | 113° → 90° (turning away from the target) → 126° |
| Fjord | **44.5°** | t = 0.20 s | |
| Whiteout | **44.2°** | t = 0.20 s | |

Before the jump the camera turns 5–9° per frame in the opposite direction to its final heading.

**Cause** (`shot2.test.ts`). On the jump frame the **follow camera itself** flips its yaw by 180° in a single frame. In Alpine it goes from −21° to 159°; in Fjord from −1° to 179°; in Whiteout from −7° to 173°. It happens like this:
1. `startChase` snaps the follow camera to the *forward* pose (`GameSession.ts:771`; `finishCave` sets `lookBackOverride = null` first).
2. On the next frame `lookBackOverride = 1` swings its spring-driven position and aim through the skier to the look-back pose.
3. When the aim point passes the camera, the direction from the camera to the aim point reverses.

`shotBlend` is at k ≈ 0.25 by then, so about a quarter of that 180° flip reaches the screen.

**The strip agrees.** Between `*_03`/`04` (0.07 s) and `*_05` (0.33 s) the yaw reverses direction:

| Location | Yaw sequence | Then |
|---|---|---|
| Alpine | 113° → 99° → 150° | 55° in one 0.267 s step |
| Fjord | −126° → −113° → −171° | 62.5° |
| Whiteout | −118° → −107° → −177° | 73° |

`*_05` (0.33 s) shows neither the skier nor, in Alpine and Fjord, a clearly visible Yeti. The camera is low over the tracks (`alpine_05`, `fjord_05`).

**Why the unit test misses it.** `handoff_blend.test.ts:89` measures `maxTurn` only for `B.t > HANDOFF_CAM.shot` (0.5 s), so the shot blend is never measured. Its shot aim is also synthetic (`(0, 6, −40)` straight up the z axis), not the real line to the cave.

**Fix direction (checked).** Snap the follow camera with the look-back already applied: set `lookBackOverride = 1` before `follow.snap` at the hand-off. In my run (`shot3.test.ts`) that alone brings the largest turn down to **2.5° (Alpine), 3.0° (Fjord) and 3.6° (Whiteout) per frame**. Lengthening `HANDOFF_CAM.shot` to about 0.7 s would bring Whiteout under 3°. Extend the test to cover t ≤ 0.5 s, with the shot aimed at the real ledge.

### C9 (Major): the touchdown is not readable in Alpine or Fjord
I projected `yetiRoot` + 1 m through each frame's camera (`cam.pos`, `dir`, `fov`, 16:9) and checked 3× crops.

**Alpine.** The Yeti is inside the camera's view but hidden:
- 0.33–1.40 s: under the HUD's TO FINISH panel and progress marker. He is projected at (819,45), (831,62), (753,74) and (719,84). In `alpine_09`'s crop the red progress dot sits on him.
- 1.93 and 2.20 s (touchdown is between them): behind the foreground fir, projected at (656,120) and (630,133). The crops of `alpine_11`/`12` show the tree and the cave mouth, but no Yeti and no snow burst.
- So in Alpine the leap and the landing are effectively unseen.

**Fjord.**
- He reads mid-air at 1.67/1.93 s, a clear silhouette at about (400,135).
- At 2.20 s (landed, projected (427,158)) the BEHIND YOU inset appears on the same beat (x 337–623, y 80–197) and covers the landing spot.
- The burst shows only as a few pixels *inside* the inset (`fjord_12`/`13` crops).

**Whiteout passes this criterion:** the Yeti is in frame and clearly visible at touchdown.

**Whiteout's early flight is out of frame.** From 0.33 to 1.13 s the Yeti is projected left of the screen (−236 to −23 px), so the take-off is not seen. That is acceptable, because the landing reads.

**Fix direction:**
- Keep `rearView` off until the look-back release begins. While the main camera is already looking back, the inset duplicates it (`*_12`–`*_14` show the same view twice).
- Bias the look-back's yaw toward the Yeti (the cave is 40–60 m to the side of the route), so he sits in the clear upper middle of the screen rather than under the HUD corner.
- Treat a foreground tree between the camera and the landing point as occlusion. For example, use the `FollowCamera` obstacle query, or raise the camera.

### C10 (Minor): forced look-back under control for about 3.5 s
- From about 0.3 s to about 3.9 s the player steers a skier seen from the front: left and right are mirrored on screen, and the course ahead is not visible (about 50 m at 50 km/h).
- In Whiteout this runs under "STORM IN 2 s ←" and "the wind pushes you left" (`whiteout_06`), where the arrow and the wording assume the forward view.
- On Classic Sprint I found **no obstacles within 6 m of the route in the 60 m after the trigger**, in all three locations (`obs.test.ts`), so the risk there is low. Daily, Custom and Endless courses are unchecked.
- **Fix direction:** guarantee a clear corridor after the trigger, or shorten the hold. This is the owner's trade-off between seeing the landing and seeing ahead.

### C3 (Minor, unchanged): letterbox and HUD switch on one frame
`CaveCinematic.ts:319-320` is unchanged. From `*_03` (letterboxed) to `*_04` (0.07 s) the full HUD appears at once, with Whiteout's storm badge and caption.

### Verified (no defect)
- **The release.** In the strip, the turn per 0.267 s step from 2.47 s to 4.33 s is at most 45.1°. That is about 169°/s, or 2.8° per frame at 60 fps. The view settles on the downhill follow view: yaw −21° (Alpine), 0° (Fjord), −10° (Whiteout). The hold until the landing + 0.35 s matches the frames: the turn starts between 2.47 and 2.73 s, after a landing between 1.93 and 2.20 s.
- **The skier is in frame** from 0.60 s in all three locations (`*_06`–`*_20`), including through the release orbit (`alpine_17`).
- **No Yeti teleport, freeze or second leap.** The hand-off shot is unchanged (`*_03`), and `yetiRoot` advances evenly with one landing.
- **Manifest against images**, all 63 frames: phases, cinematic and chase times, `yetiAirborne`/mode (`leap` up to 11, `run` from 12), RUN. and the inset from 12, and `cam.dir` all agree with the images.

## What would change my verdict
- **To PASS:**
  1. C8 fixed, with a test covering t = 0–0.5 s on the real shot aim, showing no step above about 3–3.5°/frame.
  2. A re-shot strip that includes a frame within ±0.1 s of the landing, in which the Yeti's touchdown is visible and not covered by the HUD, the inset or a tree in Alpine and Fjord (C9).
- C10 and C3 alone would not hold the verdict at FAIL.

This change does not resolve W-056, and I do not credit it with doing so.
