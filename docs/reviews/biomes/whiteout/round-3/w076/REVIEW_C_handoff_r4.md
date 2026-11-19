# W-076 focused review, round 4: Reviewer C (Cinematics), the watched cave hand-off

- **Reviewer:** C, Cinematics. **I am a model-based reviewer, not a human playtester.** I watched nothing in real time. What a player "sees" below comes from still frames, the manifest, code and headless replays.
- **Build:** `pass5-whiteout` @ **7e985b6**. Changes since 7e4db92:
  - 05a6b6a: the look-back is set before the snap, a 0.7 s shot ease, `lookBackAim`, no inset during the look-back;
  - 09930a3: the aim pulled 30% onto the Yeti, a 2.3 s release;
  - 7e985b6: RUN. waits 0.6 s after the touchdown.

  Strip: 72 frames, out to chase t ≈ 5.0 s, with a frame on the landing (sha 7e985b6). My earlier reports (r1–r3) stand as written.
- **Examined:**
  - `git diff 7e4db92 7e985b6 -- src/`;
  - `FollowCamera.update`;
  - all 72 frames against the manifest;
  - the Yeti root projected through each frame's camera (pos, dir, fov, 16:9);
  - 3× crops of the landing region in every location.
- **Ran, in /tmp only:** `/tmp/rc/vt/r4.test.ts`, which replays the hand-off at 60 fps for 5.5 s with the repo's real `FollowCamera`, `shotBlend` and `lookBackAt`.
  - Inputs: each location's Classic Sprint mountain and obstacles; the shot pose from `*_03`; the Yeti path and landing time from the manifest; the skier on the route at 13.5 m/s.
  - I modified nothing in the repository apart from this file.

## Verdict: **FAIL** (cinematics), on one Major finding. Everything else now meets my pass criteria

**Met (verified):**
- **Turn rate (C8 resolved).** The largest turn in the 60 fps replay:

| Location | First second | Whole hand-off (in the release, about 4.1 s) |
|---|---|---|
| Alpine | 0.31°/frame | 2.42°/frame |
| Fjord | 0.59°/frame | 2.82°/frame |
| Whiteout | 0.72°/frame | 3.18°/frame |

  - The strip agrees: 4–10° per 0.267 s step in the first 0.6 s, with no reversal of direction.
  - The strip's largest step is 51.9° in 0.267 s (Whiteout 3.93→4.20 s, an average of 195°/s). That is consistent with the replayed peak of about 3.2°/frame.
  - The release ends on the forward view: yaw −21° (Alpine), 1° (Fjord), −10° (Whiteout), with the last step at about 5°.
- **The Yeti is on the camera's axis at touchdown.** In the replay he is 6.2–6.9° off axis. In the strip the projected touchdown points are (462,232), (506,236) and (494,239): mid-frame, clear of the HUD.
- **The skier** is in frame from 0.6 s to the end in every location (`*_06`–`*_23`).
- **The landing reads in Fjord and Whiteout** (crops of `*_09`–`*_15`):
  - the Yeti is visible in mid-air at 1.40 and 1.93 s;
  - he touches down on the frame flagged `run` (`fjord_12` at 2.10 s, `whiteout_12` at 2.07 s) with a white snow puff at his feet;
  - he stands, then RUN. appears 0.6 s later.
- **The BEHIND YOU inset** no longer appears during the look-back.
- **No Yeti teleport, freeze or second leap.** One landing per location; `yetiRoot` is continuous.
- **The manifest agrees with the images** for all 72 frames: phase, cinematic and chase times, airborne/mode, RUN. from about land + 0.6 s (frames 14/15), and `cam.dir`.

## Findings

### C11 (Major): in Alpine the whole leap and landing happen behind a foreground fir
This is the case you flagged as known; I judged it.

**Evidence.**
- From 0.60 s to 2.90 s the Yeti's projected position stays in a tight cluster at x 457–491 and y 211–232 (`alpine_06`–`alpine_15`).
- A fir about 25 m from the camera occupies x ≈ 435–600 and y ≈ 100–330 over the same frames.
- My crops of `alpine_07`, `09`, `11`, `12` (the landing, 2.10 s), `13` and `15` show **no Yeti and no snow burst at all**: only the tree, with the cave to its right.
- The only sight of him after the cinematic is on the ledge at 0.07–0.33 s, a 25 px figure in the cave mouth (`alpine_04`/`05`).
- After that the Alpine player sees the HUD distance tick down from 59 m to 53 m, a shake, a footstep sound, then RUN.

**Why it is Major, not Minor.**
- The aim is *pulled onto* the Yeti, so the tree and the Yeti stay aligned for the whole 2.9 s. This is not a one-frame occlusion; the framing locks the tree onto him.
- The leap was the encounter's payoff, and on Alpine's default course it is now invisible.
- The developers knew of this and did not fix it.

**Fix direction** (any one of these):
- Keep the trees in the obstacle field and scenery out of the corridor from the trigger section of the route to the landing point (it is off-route, so balance is barely affected; re-run the Alpine balance check if it is an obstacle).
- Use the `FollowCamera` obstacle query along the camera-to-Yeti line, and shift the look-back bias or raise the boom until the line is clear.
- Extend `handoff_blend.test.ts` to assert an unobstructed line from the camera to the Yeti at touchdown, using the `ObstacleField` it already builds.

The test already requires the Yeti to be within 30°/18° of the axis. That passes here, which shows the criterion is necessary but not sufficient.

### C12 (Minor): RUN. covers the Yeti once he lands
- The title appears 0.6 s after touchdown, mid-frame, over the spot where the look-back now holds him. See `fjord_15` and `whiteout_15` (the Yeti visible between "U" and "N" in Whiteout, covered in Fjord) and `alpine_15`.
- It stays up for 1.6 s, which is most of the time he is running at the player before the release turns away.
- The comment at `GameSession.ts` ("it sits mid-frame, where the look-back puts him") describes this as intended. It costs the first sight of him running.
- **Fix direction:** place the title lower (over the snow between the skier and the Yeti), or show it on the release.

### C3 (Minor, unchanged): letterbox and HUD switch on one frame
`CaveCinematic.ts:319-320`. From `*_03` to `*_04` the full HUD, Whiteout's storm badge and the caption all appear at once.

### C10 (Minor, unchanged): about 3.5 s of steering in a mirrored view under control
The release begins at about 2.5 s and lasts 2.3 s, so the forward view returns at about 4.8 s, longer than in r3. On Classic there are still no obstacles near the route (r3 check). Daily, Custom and Endless courses are unchecked. This is an owner trade-off.

## What would change my verdict
- **To PASS:** C11 fixed. A re-shot Alpine strip (or a test with an obstacle check) should show the Yeti unobstructed in mid-air and at touchdown, with the snow puff visible, as it already is in Fjord and Whiteout.
- C12, C3 and C10 would not hold the verdict at FAIL.

This change does not resolve W-056, and I do not credit it with doing so.
