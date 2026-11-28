# W-076 focused review: Reviewer C (Cinematics), the watched cave hand-off

- **Reviewer:** C, Cinematics. **I am a model-based reviewer, not a human playtester.** I watched nothing in real time. What a player "sees" below comes from still frames, code and one headless check.
- **Build:** `pass5-whiteout` @ **9bd85d7** (W-076 `789c23f`, Gitar `Timeline.apply` fix `2d3618c`, review fixes `9bd85d7`). I read `git diff 2d3618c 9bd85d7` (src and README) and the hand-off parts of `git diff 1218f06 2d3618c`.
- **Examined:**
  - code: `CaveCinematic.ts` (shots 12.3–14.6 s, `finish`), `Timeline.ts`, `caveHandoff.ts`, `spawn.ts`, `GameSession.ts` (cave branch, `cineBlend`, `leapPending`/`yetiLanded`, `rearView`), the old `CaveCinematic.ts` at 1218f06;
  - the strip `round-3/handoff/`: all 42 frames viewed, each checked against `manifest.json` (sha 9bd85d7);
  - the old ending: code at 1218f06 and `round-2/evidence/15_cave_leap.png`;
  - reviews B, E and F on 2d3618c.
- **Ran:** one Node check, `/tmp/rc/q.mjs`, using the repo's three.js 0.187.0. I modified nothing in the repository; this file is the only thing I wrote there.

## Verdict: **FAIL** (cinematics)

The hand-off frame itself is clean in all three locations:
- no Yeti teleport, freeze or second leap;
- no change in camera position or fov from 14.43 s to chase t = 0;
- Fjord's final shot now holds (the Gitar fix works).

**Why it fails.** The camera "swing" that follows never rotates. A three.js aliasing bug freezes the camera's orientation on the cinematic's last shot for the leap's whole flight, about 2.1 s. Only the position and fov blend.

- **While the player has control:** the camera looks back uphill at the cave and backs away from it. The skier leaves the frame within 0.2 s and stays out of it.
- **When the blend ends** (as the Yeti lands): the orientation cuts hard, by roughly 110–125°, to the follow view.

That is the camera jump the brief rules out. It is just moved 2 s later and onto the landing beat. It was already present at 2d3618c (with a 1.2 s blend); the earlier strips stopped at chase t ≤ 0.4 s, before it shows. 9bd85d7 makes it last longer.

## Findings

### C1 (Critical): the cineBlend never rotates the camera; the skier is out of frame for about 2 s under control, then a hard cut of about 110–125°
**Code.** `GameSession.ts:358`:
```ts
this.camera.quaternion.slerpQuaternions(B.quat, this.camera.quaternion, k);
```
- In three.js 0.187.0, `slerpQuaternions(qa, qb, t)` is `this.copy(qa).slerp(qb, t)` (`node_modules/three/src/math/Quaternion.js:771-773`).
- Here `qb === this`, so `copy(B.quat)` overwrites the follow camera's rotation before the slerp. The result is `B.quat` for every k, including k = 1.
- The position line (`lerpVectors`, :357) is safe, because it reads each component before writing it.

**Headless check** (`/tmp/rc/q.mjs`), the same call with two rotations 162° apart. The result stays at **0.00° from the cinematic pose** for k = 0, 0.5, 0.86 and 1. A correct slerp at k = 0.5 gives 81°.

**Frames.** These confirm it in all three locations.

The camera position moves toward the follow position:

| Chase t | Alpine cam z | Skier z |
|---|---|---|
| 0.0 s | 284.6 | 282.1 |
| 1.6 s | 296.1 | 303.7 |

The fov widens from 46° to 64.5°. But every image from `*_06` to `*_13` still looks uphill at the cave:
- `alpine_13` (k ≈ 0.86): cave and tree, no skier;
- `fjord_13`: the cave, with the Yeti mid-air on the right;
- `whiteout_13`: the cave.

The skier, whose helmet is at the bottom edge of `*_05`, is in **no** frame from 0.2 s to 1.6 s.

**Blend timing and the cut.**
- The blend lasts `max(1.2, sp.flight)` (`GameSession.ts:296`), about 2.0–2.1 s.
- On its last frame k = 1 still yields `B.quat`, and `cineBlend` is then cleared (:361). The next frame applies the follow camera's own orientation: a single-frame cut.
- **My estimate of the cut** comes from the manifest positions: the yaw from the camera toward the leap shot's look target, against a follow camera looking down the fall line. It is about 113° (Alpine), 125° (Fjord) and 117° (Whiteout). These figures are not measured from frames; the strip ends at 1.6 s.

**Player impact** (every watched cave encounter, every location):
- For about 2 s the player steers a skier they cannot see, with a camera facing backwards and dollying backwards.
- In Whiteout this coincides with "STORM IN 3/2/1 s" and the caption "the wind pushes you left; ski the flagged gaps" (`whiteout_05`–`13`).
- It ends in a hard cut on the landing. That cut is the "camera jump" the brief excludes.
- The old ending (1218f06) had no such problem. Control returned only at 18.0 s, after a Timeline-authored bezier swing (`via` pose, `lookAt` every frame) into `followPose`.

**Fix direction.**
- Use a temporary: `const q = this.camera.quaternion.clone(); this.camera.quaternion.slerpQuaternions(B.quat, q, k)`.
- A better approach is to blend the **look target**, not the quaternion. Track the Yeti (`yetiLook`) early and the follow target late, so the subject never leaves frame. A raw slerp across about 120° passes through a mid-swing view that shows neither the Yeti nor the skier.
- Add a unit test of the blend that asserts the angle to the follow orientation decreases monotonically.
- Add the camera's look direction (or quaternion) to the strip manifest. The current `cam` (pos and fov only) cannot show this defect; only the images can.

### C2 (Major): the leap's payoff is weaker than the old ending, and the new landing beat has no visual evidence
**What the strip shows of the leap:**
- **Fjord** reads well: a clear mid-air silhouette against the sky (`fjord_09`, `fjord_13`, Yeti at about (700, 205)).
- **Whiteout** reads moderately: small, against dark rock (`whiteout_09`, `whiteout_13`).
- **Alpine** reads poorly. The Yeti is about 15–20 px tall, white on pale rock (`alpine_07`–`10`), and passes behind the foreground fir at 1.4–1.6 s. In my 3× crops of region (330–650, 150–300), `alpine_12` shows him half-hidden at the trunk's left and `alpine_13` shows only a fragment.

**The landing is not in the strip.**
- The flight lasts about 2.0–2.1 s. The strip stops at 1.6 s, where the manifest has y = −37.25 (Alpine), still `yetiAirborne: true`.
- So the new beat (shake, 60-particle burst, footstep, RUN. title) and the end of the swing are unevidenced. These are the very things 9bd85d7 adds (`yetiLanded`, `GameSession.ts:373-381`).

**The landing is framed off-screen by design.**
- The blend is timed to end as he lands, and the follow camera faces downhill. The burst therefore plays behind the camera, about 40–60 m uphill.
- The player gets the shake, the thud and the title at the same moment as C1's hard cut.
- In the old ending, the landing was filmed inside a letterboxed, Yeti-tracking 2.35 s leap shot with the skier's helmet in the foreground (`round-2/evidence/15_cave_leap.png`), and the swing came afterwards.

**Fix direction:**
- After C1, end the blend about 0.3–0.5 s *after* the landing, with the look target still on the Yeti at touchdown. Then the burst is seen before the camera turns downhill.
- Re-shoot the strip out to chase t = flight + 0.6 s (about 2.8 s).

### C3 (Minor): the letterbox, the HUD and Whiteout's storm UI all pop on one frame while the camera is still in the cinematic shot; removing the letterbox reveals a clipped helmet
**Evidence.** In `*_04` → `*_05`, the bars vanish and the full HUD appears; in Whiteout the storm badge and caption appear too. `CaveCinematic.ts:319-320` hard-switches both in `finish()`.

The bottom bar was hiding the skier. In `*_05` a cropped helmet sits on the bottom edge:
- Alpine x ≈ 255–380;
- Fjord x ≈ 590–660;
- Whiteout x ≈ 555–700.

It has left the frame by `*_06`. So the "shot from behind the skier's position" never actually shows the skier while it is a shot (`*_03`/`*_04`).

**Fix direction:**
- Ease the bars out over 0.3–0.5 s.
- Raise or retarget `leapCam` so the shoulder sits above the bottom bar, as the old shot's helmet did.

### C4 (Minor): the last shot does not quite frame what the code comment says
- `CaveCinematic.ts:146-147` still says "over the skier's shoulder, the Yeti crouched on the ledge". The README was corrected in 9bd85d7.
- In `*_03`/`*_04` (cinematic 14.23/14.43 s) the Yeti stands upright in mode `roar` (manifest). Mode `leap` is set only on the final cinematic frame (`tl.at(CAVE_LEAP_AT)`).
- The shot lasts 0.4 s and has no anticipation pose.
- `tl.at(CAVE_LEAP_AT)` also sets the root's rotation to `sp.heading`. On a cave whose exit path is not aligned with the leap, that could be a visible turn on the last cinematic frame. The strip has no frame between 14.43 s and 14.6 s, so this is **unverified**.

**Fix:** a crouch or gather pose for 0.3 s before 14.6, and correct the comment.

### C5 (Minor, evidence): the manifest is partly uncheckable
- `yetiPos` reads [0,0,0] in every cinematic frame (it is the AI, not the model). Teleport checks therefore rest on images.
- In the images, the Yeti's screen position in `*_04` and `*_05` is identical to within about 2 px in all three locations.
- `cam` has no orientation (see C1).

## Verified myself (no defect)
- **Hand-off continuity:**
  - the camera moves 0.06 m from `*_04` to `*_05` in all three locations;
  - fov goes 45.2° → 46.0°;
  - the framing is identical.
- **No teleport, freeze or second leap:**
  - the cinematic no longer flies a leap; the AI flies one;
  - the manifest positions advance evenly: 2.97 m per 0.2 s horizontally in Alpine and 2.55 m in Fjord and Whiteout, on a ballistic y arc that peaks around 0.6 s;
  - `airborne` stays true and `mode` stays `leap` from frame 05 to 13.
- **Fjord fallback (Gitar):** `fjord_04` and `fjord_05` hold the leap shot. There is no snap back to the roar close-up.
- **9bd85d7 presentation fixes, as far as the strip goes:**
  - no "RUN." title and no "BEHIND YOU" inset during the flight (unlike the `alpine_05`/`06` frames reviewer F saw);
  - the HUD shows "YETI" with an empty bar on t = 0, not "Infinity m".
- **Manifest against images**, all 42 frames:
  - phases agree: letterbox and no HUD on 00–04, HUD on 05–13;
  - cinematic times agree with the shot list: 00 is the roar close-up (fov 30); 01–02 are the reaction cut at 13.7 s (the camera moves 42–62 m, intended); 03–04 are the leap shot;
  - chase times agree with the skier's z (+2.7 m per 0.2 s, consistent with the HUD's 49–56 km/h);
  - the HUD Yeti distances (Alpine 60→55 m, Fjord 38→37 m, Whiteout 45→40 m) agree with the manifest positions.

## What would change my verdict
- **To PASS:**
  1. C1 fixed, with a test of the rotation blend.
  2. A new strip out to about 2.8 s of chase in all three locations, with camera orientation in the manifest, showing:
     - a monotonic swing;
     - no cut at the end;
     - the skier back in frame well before the landing;
     - the landing beat (burst and title) actually framed or deliberately cut to.
- C3–C5 alone would not hold the verdict at FAIL. C2 would, unless the re-shot strip shows the landing reads.

This change does not resolve W-056, and I do not credit it with doing so.
