# W-076 focused review, round 2: Reviewer C (Cinematics), the watched cave hand-off

- **Reviewer:** C, Cinematics. **I am a model-based reviewer, not a human playtester.** I watched nothing in real time. What a player "sees" below comes from still frames, the manifest, code and one reconstruction script.
- **Build:** `pass5-whiteout` @ **ca1679f**. That is 78da1b2 (the new `src/camera/handoffBlend.ts`, the C4 comment, the manifest's `dir`/`yetiRoot`) plus ca1679f (the strip now runs to chase t = 3.27 s in 0.267 s steps). My first report, `REVIEW_C_handoff.md` on 9bd85d7, stands as written.
- **Examined:**
  - `git diff 9bd85d7 ca1679f` (src, tools, tests);
  - `handoffBlend.ts`, `GameSession.ts:293-300, 353-360`;
  - `tests/unit/handoff_blend.test.ts`, `balance/skip-handoff/old_blend_run.txt`;
  - all 51 frames of `round-3/handoff/` against `manifest.json` (sha ca1679f).
- **Ran:** `/tmp/rc/sw.py`. It computes the camera's turn between consecutive frames from the manifest's `cam.dir`, and how far the Yeti is from the line of sight. It also replays `applyHandoffBlend`'s formula at 60 fps, using a follow pose extrapolated from the post-swing frames. That replay agrees with the manifest's directions to within 0–1.5° outside the fast turn and 7–14° inside it, so I quote its peak rates as estimates. I modified nothing in the repository apart from this file.

## Verdict: **FAIL** (cinematics). C1 is fixed; the new swing has a whip-pan just before the landing, and the landing is not seen

**What is fixed, verified on the frames:**
- **The camera now turns.** The yaw goes 113° → −22° (Alpine), −126° → −2° (Fjord) and −118° → −12° (Whiteout).
- **No snap at the end.** The swing settles exactly on the follow pose. After it ends, the change between steps is 0.0–0.6° (frames 13→16 in all three locations).
- **The hand-off is seamless.** From 14.43 s to chase 0.07 s the camera moves 0.07 m and turns 0.1°.
- **No Yeti teleport, freeze or second leap.** `yetiRoot` goes from the ledge to 1.0 m along the arc after 0.07 s, then advances evenly. The landing comes once, between 1.93 s and 2.20 s.

**What still fails:**
- How the swing is shaped. The aim *points* are blended linearly. The Yeti's aim point is uphill and the follow camera's aim point is downhill, so the blended point passes within a few metres of the camera. The result is a whip-pan of 105–127° in about 0.3–0.5 s, at the moment the Yeti is about to land.
- Because of that whip-pan, the touchdown the change set out to show is out of frame in all three locations. In Alpine and Whiteout the player also has no skier on screen for 2.2–2.5 s while in control.

## Findings

### C6 (Major): a whip-pan of 105–127° in ≤0.53 s, while the player has control, just before the landing
**Evidence.** Measured turn between consecutive manifest frames (0.267 s apart):

| Location | 1.40→1.67 s | 1.67→1.93 s | 1.93→2.20 s | 2.20→2.47 s |
|---|---|---|---|---|
| Alpine | 5.8° | **55.0°** | **71.8°** | 8.0° |
| Fjord | 8.0° | **105.4°** | 25.0° | 2.3° |
| Whiteout | 12.3° | **60.3°** | 37.7° | 6.6° |

- Fjord turns 105° in one 0.267 s step, an average of **≥395°/s**.
- Alpine turns 127° over 0.53 s.
- My 60 fps replay puts the peak at about **11°/frame in Fjord** (t ≈ 1.83 s) and about 8°/frame in Alpine (t ≈ 1.95 s). In Fjord that exceeds the new unit test's own limit of 10°/frame. The replay is approximate (see "Ran" above), but the measured step averages alone confirm a whip-pan.

**Cause.** `handoffBlend.ts:44`:
```ts
look.copy(B.look).lerp(yetiAim, smoothstep(0, 0.3, u)).lerp(followLook, smoothstep(0.5, 1, u))
```
- This moves the aim point on a straight line from the Yeti (30–50 m uphill) to a point 30 m downhill of the follow camera.
- That line passes close to the camera: within about **5.8 m** in Fjord, 9.7 m in Alpine and 13.9 m in Whiteout (replay). Near that point a small movement of the aim point is a large turn of the camera.
- `smoothstep(0.5, 1, u)` is steepest at u = 0.75 (t ≈ 1.85 s), which is the same moment.

**Why the unit test passes.** Its geometry (`shotLook` (30, 8, −40), follow aim (0, 1, 20), camera near the origin) does not put the camera close to the blended line. It never tests the real cave geometry.

**What the player sees.**
- `alpine_11`: a 1.93 s frame of bare mountainside, with neither the Yeti nor the skier in it.
- `whiteout_11`: grey slope, mid-turn, with the storm caption on screen.
- At 60 fps this reads as a whip-pan, not a swing. `reduceCameraMotion` is still not consulted.

**Fix direction.**
- Interpolate the *direction* (yaw and pitch, or a slerp of quaternions computed separately) with a cap on angular speed, for example ≤150–180°/s.
- Or hold the Yeti until touchdown + 0.3 s and then make a deliberate editorial **cut** to the follow camera. A clean cut after the beat is legitimate; a whip through empty terrain is not.
- Extend the unit test with the real cave geometry from the manifest (camera, ledge, landing point, follow pose) and assert the peak rate.

### C7 (Major): the landing is not seen, and the skier is off screen for about 2–2.5 s under control in Alpine and Whiteout
**The landing.**
- On the last frame before touchdown (1.93 s, `yetiAirborne: true`), the Yeti is **71° (Alpine), 136° (Fjord) and 90° (Whiteout)** from the line of sight. At fov 64.6° and 16:9 the horizontal half-angle is about 48°, so he is out of frame everywhere.
- At 2.20 s he has landed, the main view is on the skier, and RUN. plus the BEHIND YOU inset appear (`*_12`). The touchdown, its burst and the shake happen during or behind the whip.
- So the commit's claim that the swing "watches the landing", and the comment's "the landing is seen", are not supported.
- The leap's flight does read well up to 1.67 s:
  - `fjord_10`: a clear mid-air silhouette;
  - `whiteout_10`: visible against the rock;
  - `alpine_10`: tiny, partly behind the fir again.
- The aim starts leaving him at u = 0.5 (t ≈ 1.24 s), about 0.8 s before he lands. Choosing `dur = flight + 0.45` does not put the landing in frame, because the turn is front-loaded.

**The skier.** The skier first reappears at:

| Location | Skier back | Relative to the landing (≈2.0–2.2 s) |
|---|---|---|
| Fjord | 1.93 s (`fjord_11`) | before |
| Alpine | 2.20 s (`alpine_12`) | at |
| Whiteout | 2.47 s (`whiteout_13`) | after; in `whiteout_12` the skier appears only in the BEHIND YOU inset, not in the main view |

- The skier left the frame by 0.07–0.33 s, so control without a visible skier lasts about 1.6 s (Fjord) to 2.4 s (Whiteout).
- In Whiteout this is under "STORM IN 3/2/1 s" and "the wind pushes you left; ski the flagged gaps".
- The strip's skier coasts with no input (`autopilot(null)`, `tools/handoff_strip.mjs:22`). Its speed falling from 51 to 27 km/h in Whiteout is terrain, not the camera.

**Fix direction:** keep the Yeti framed through touchdown + about 0.3 s (the burst), then cut to the follow camera. That shows the payoff and gives the skier back at about 2.3–2.5 s with no whip. Alternatively, a wider framing that holds both the skier and the Yeti, as in the old over-the-shoulder leap shot (`round-2/evidence/15_cave_leap.png`).

### C3 (Minor, unchanged): letterbox and HUD switch on one frame
- `CaveCinematic.ts:319-320` is unchanged.
- From `*_03` (14.43 s, letterboxed, no HUD) to `*_04` (chase 0.07 s) the full HUD appears, with Whiteout's storm badge and caption.
- The t = 0 frame is no longer sampled, so the clipped helmet I reported is no longer in the strip. The code that produced it is unchanged.
- **Fix direction:** ease the bars out over 0.3–0.5 s.

### Resolved since round 1
- **C1:** resolved as described above.
- **C4:** the comment at `CaveCinematic.ts:146` now matches the shot.
- **C5:** the manifest records `cam.dir` and `yetiRoot`. That made C6 measurable.
- **The test:** `old_blend_run.txt` shows the old blend failing 2 of the 4 tests, so the test does guard against C1.

### Manifest against images (51 frames)
All entries agree with the images:
- phases: letterbox on 00–03, HUD from 04;
- cinematic times: 00 is the roar close-up (fov 30); 01–02 are the reaction cut (the camera moves 42–62 m, intended); 03 is the leap shot;
- `yetiAirborne` and mode: `leap` up to 11, `run` from 12;
- RUN. and the inset appear from 12;
- the HUD distances agree with the `yetiPos`/skier separation;
- the camera direction in each image matches `cam.dir` (cave-facing up to 10, downhill from 12).

## What would change my verdict
- **To PASS:** a swing (or a cut) in which:
  - no step exceeds about 3°/frame at 60 fps (a cut being the exception);
  - the Yeti is in frame at touchdown in all three locations;
  - the skier is back in frame within about 0.5 s of the landing.

  It should be shown on a re-shot strip that includes a frame within ±0.1 s of the landing, with a unit test using the real cave geometry.
- C3 alone would not hold the verdict at FAIL.

This change does not resolve W-056, and I do not credit it with doing so.
