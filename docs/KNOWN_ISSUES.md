# Known issues and unmet quality gates

These are stated plainly. AAA quality was the target, not a claim. The review reports in
`docs/reviews/` have the full critique.

## Environment limitations (how this build was produced)

- **No GPU was available.** All rendering ran on SwiftShader, a software WebGL renderer, at
  960×540, where one frame takes seconds. **No frame rate on real hardware has been measured.**
  The 60 FPS @ 1080p (High) and 30 FPS (Low) targets are **unverified**.
  - What has been measured: draw calls, triangle counts, and the CPU cost of physics and terrain
    streaming. The in-game "Show performance stats" overlay and `?debug` → `__skifree.perf()`
    exist so the figures can be measured on a real machine.
- **No external assets could be downloaded,** so there are no CC0 models, HDRIs, recorded sounds or
  motion capture. Everything is procedural, which caps how realistic the result can look:
  - characters are sculpted from code;
  - animation is procedural, not keyframed or captured;
  - audio is synthesized.
- **No human has played the game.** Feel was tuned against measurements, automated
  simulations (autopilot styles, injected crashes) and reviewer analysis. The audio mix has been
  checked numerically (levels, clipping, NaNs) but nobody has listened to it.

## Visual quality vs the gates (internal review, round 1 → after fixes)

| Area | Gate | Round-1 score | Status |
|---|---|---|---|
| Mountain visuals | 9 | 5 | Not met. Improved since (lighting contrast, snow glints, per-side valley walls, avalanche paths, rock texturing) but not re-scored to 9. It still reads as a stylised indie game, not a photoreal mountain. |
| Player character/animation | 8.5 | 6.5 | Not met. A procedural puffer-jacket skier with IK and pose blending; procedural animation looks stiff next to motion capture; skis bend during crash tumbles. |
| Yeti visual design/animation | 9 | 6.5 | Not met. Shell fur and silhouette are strong; a hard edge remains where the fur meets the bare face; motion is procedural; one eye can read dark at some angles. |
| Art-style consistency | — | — | The resort guests are stylised (chibi-leaning), the Yeti semi-realistic and the skier stylised. |

## Gameplay / systems

- **Unmeasured performance hotspots:**
  - the resort's three point lights are always active (switching them would recompile every
    shader and cause a hitch);
  - the Yeti is about 0.7 M triangles on High, and its fur is limited to within 140 m;
  - the "BEHIND YOU" rear view renders the scene a second time into a small viewport, but reuses
    the frame's shadow map. It is off on Low and can be turned off in Settings.
- **Controller remapping:** controller buttons can't be remapped (keyboard only). D-pad buttons in
  menus step one item per press (the left stick and arrow keys auto-repeat).
- **Audio:** browsers require a key press or click before sound can play. A gamepad-only player
  sees an on-screen hint.
- **Captions:** there are none for the growls and roar.
- **Pausing:** the end cinematics can't be paused. The victory sequence (about 18 s) can't be
  skipped.
- **Terrain is a heightfield:** overhangs need hand-placed geometry. The cave is a tunnel mesh set
  in a notch cut into the terrain, pinned to full LOD.
- **Debug harness:** `?debug` is shipped in the production build, gated behind the URL parameter.
  It is not linked from the UI.
- **Pursuit balance** is tuned for the default course seed and checked on three seeds. A human who
  crashes early and never presses Recover can be caught on some seeds, which is intended to be
  punishing.

## Open items from the hostile-critic review (F)

- **Depth of play:** winning depends mostly on holding the tuck on clean lines and not crashing.
  There is no risky shortcut with a big payoff, no ghost of your best run and no difficulty modes.
  Replay variety comes from the Daily course seed and personal bests.
- **The Yeti on screen:** in the main view the Yeti is mostly seen through the "BEHIND YOU" window
  and in the close-range camera swing. In the main view itself it only reads clearly when it is
  very close.
- **Cinematic stills:** the roar close-up face is soft and smooth rather than detailed. Some cave
  boulders still look low-poly at close range.
- **Victory:** the skier keeps holding the poles while raising the trophy.
- **Playtesting:** no human playtesting has been done. All feel tuning used scripted bots, numerical
  experiments and reviewer analysis.


## Pass 2 status (2026-11-07)

These are tracked with IDs in `docs/reviews/pass2/DEFECTS.md`; reviews are in
`docs/reviews/pass2/round*/`. All reviews are **internal** (other model instances), not external
human reviewers.

**Verified by measurement or tests:**
- **Menu:** fits without scrolling at the 4 target sizes. Some menu e2e tests were changed after
  their last green run; see the tracker.
- **Course lengths:** headless runs complete 3, 10, 20 and 50 km courses, and wins and losses are
  both possible.
- **Daily:** determinism and UTC rollover are covered by tests.
- **Endless memory:** a 120 km browser session showed bounded GPU resources and JS heap
  (`docs/reviews/pass2/endless_memory.json`).
- **Floating origin:** correct at 50 km and beyond.
- **Grounding:** the Yeti's soles do not penetrate the floor in any captured frame of the cave
  cinematic.

**Internal visual gate, after three review rounds:** 8 of 10 areas pass. Two are half a point under
the 7/10 mark: the cave interior and cinematic angles (6.5) and the Yeti close-up model (6.5). Details
are in `docs/reviews/pass2/final/FINAL_REVIEW_A_CE.md` and the QUALITY_REPORT.

**Still open or unverified:**
- **No GPU frame rates.** Scene cost went up in pass 2: near conifers are about 650–840 triangles,
  and a High gameplay frame is about 4–5.6 M triangles including shadow passes. It must be measured
  on real hardware; reduce `Vegetation.nearDist` or tree tiers if needed.
- **Cave:** after two rounds it reads as a rock band in the hillside, but close up the rock creases
  look quilted. There is still a visible floor lip at the mouth (A10), and the footprint decals read
  as icons (A6).
- **Yeti:**
  - side fringe cards look like flat ribbons close up;
  - the head fur is coarser than the body fur after the head was scaled up;
  - the collected gallop phase is compact.
- **Trees:** close up (under 5 m) the tiers look polygonal and somewhat regular.
- **Terrain:** distant rock is soft rather than crisp. Some egg-crate relief remains in the
  heightfield noise on hillsides.
- **Course codes:** gamepad-only players cannot type a course code (E6). Every other control works
  with a gamepad.
- **Endless:** plan arrays grow slowly with distance (B6). Lookups are about 1.5× slower at
  1,000 km; memory is not affected.
- **Precision:** particles and tracks use absolute float32 positions (B12). The error is under 4 mm
  at 50 km and about 3 cm beyond 250 km of Endless.
