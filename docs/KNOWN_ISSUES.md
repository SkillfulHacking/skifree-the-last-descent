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
