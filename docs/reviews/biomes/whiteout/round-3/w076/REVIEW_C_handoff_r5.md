# W-076 focused review, round 5: Reviewer C (Cinematics), the watched cave hand-off

- **Reviewer:** C, Cinematics. **I am a model-based reviewer, not a human playtester.** I watched nothing in real time. What a player "sees" below comes from still frames, the manifest, code and the replays from round 4.
- **Build:** `pass5-whiteout` @ **e503677**. Changes since 7e985b6:
  - 1a2bdef: `obstacles.ts` `inLeapView` clears the sight-line triangle; the unit test adds a tree check on the camera-to-Yeti line;
  - e503677: the balance re-check `balance/round3-cave/README.md`.

  New strip: 72 frames, manifest sha e503677. My r1–r4 reports stand as written.
- **Examined:**
  - `git diff 7e985b6 e503677` (src, test, README);
  - all 72 frames against the manifest;
  - the Yeti root projected through each frame's camera;
  - 3–4× crops of the flight and landing region in all three locations.

  I modified nothing in the repository apart from this file.

## Verdict: **PASS** (cinematics) for the watched hand-off of W-076

Every pass criterion I set is now met on this strip.

**Camera continuity.**
- The camera path is unchanged from r4: the per-step angles and the projected Yeti positions match r4's to the degree and the pixel.
- So r4's 60 fps replay still applies: at most 0.3–0.7°/frame in the first second and 2.4–3.2°/frame overall.
- There is no jump at the hand-off: 0.5–1.0° from `*_03` to `*_04`. There is no snap at the end of the release.

**The Yeti at touchdown, unobstructed in all three locations.**
- **Alpine (C11 resolved).** The fir that hid him in r4 is gone.
  - In my crops he is visible on the cave ledge at 0.60 s (`alpine_06`) and in mid-air against the rock at 1.40 and 1.93 s (`alpine_09`, `_11`).
  - He has landed on the snow at 2.10 s (`alpine_12`, projected (462,232), seen at about (455,228)), then is upright and running at 2.37 s (`alpine_13`).
- **Fjord and Whiteout:** unchanged from r4. He is clear in mid-air, and lands with a visible snow puff (`fjord_12`, `whiteout_12`).

**The skier** is in frame from 0.6 s to the end in every location.

**The leap reads as the payoff** in Fjord and Whiteout, and adequately in Alpine (see C13).

**No Yeti teleport, freeze or second leap**, and the manifest agrees with the images for all 72 frames.

## Findings (all Minor)

### C13 (Minor): the Alpine leap is small and low-contrast
- At about 55 m the Yeti is about 12–15 px tall, white against pale rock and snow.
- In my 4× crop of `alpine_12` the landing puff is barely distinguishable from the snow.
- He reads, but a player glancing at the HUD could miss it.
- **Fix direction (optional):** a slightly larger or darker burst on snow-white locations, or a modest fov narrowing (zoom) during the hold.

### C14 (Minor): the sight-line clearing assumes a skier on the route, within 45 m
- `inLeapView` (`obstacles.ts:276-286`) clears the triangle (landing point, route at trigger, route at trigger + 45 m), padded by 4 m. The unit test checks only a skier on `routeX` at a constant speed.
- Two cases fall outside it:
  - a skier who arrives wide on the piste, so the camera line runs outside the padded triangle;
  - a skier who covers 45 m before the landing at about 2.1 s, which needs more than about 21 m/s (77 km/h).

  In either case a tree may reappear on the line.
- Untested. On Classic both cases are unusual (the strip's arrival is 51–56 km/h).
- **Fix direction:** widen the triangle to the piste edges, or to trigger + 60 m, or add an off-route case to the test.

### Balance side effect (not my area; claim checked only for consistency)
- The clearing removes every obstacle kind in the triangle, so the first 45 m of each chase is also free of route hazards.
- The README reports 0 outcome flips across 54 Classic runs and the W3H set, and keeps W-056 open. I did not re-run these numbers.

### Carried over, unchanged, and not blocking
- **C12:** RUN. sits over the Yeti for 1.6 s after he lands (`*_15`).
- **C3:** the letterbox and HUD switch on one frame (`*_03`→`*_04`).
- **C10:** about 3.5 s of steering in the look-back view. On Classic its risk is lower now that the triangle is free of obstacles. It remains an owner trade-off.

## What would change my verdict
- **Back to FAIL:**
  - a strip on another course (Daily, Custom, an Endless encounter, or a wide or very fast arrival) showing a tree or other occluder hiding the touchdown (C14);
  - or any regression in the camera path.
- **Remaining polish:** C12, C13, C3 and C10 would not change this verdict.

This change does not resolve W-056, and I do not credit it with doing so.
