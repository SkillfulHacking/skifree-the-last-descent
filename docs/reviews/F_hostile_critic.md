# Review F — Player Experience / Hostile Game Critic

**Internal multi-agent review — separate agent instance of the same model family; not an external/independent human approval.**

## What was inspected
- All 28 PNGs in `docs/screenshots/final/` (gameplay, cave c01–c12, chase, defeat d01–d04, victory v01–v09).
- `README.md`, `docs/DESIGN.md`, `docs/KNOWN_ISSUES.md`, reviews A–E, `RESPONSES_ROUND1.md`.
- Code: `yeti/YetiAI.ts` tuning, `physics/SkierPhysics.ts` tuning, `cinematic/CaveCinematic.ts` (current beat values), `game/GameSession.ts` scoring, `world/course.ts` seed handling, `tests/unit/game.test.ts` pursuit tests.
- `npx vitest run`: 4 files, 80/80 pass.

## Evidence observed
- **Free skiing** (`gameplay_start`, `gameplay_z560`): a clean, readable, stylised valley with a good HUD. It is also empty. At z560 and 72 km/h the frame shows a wide, flat groomed corridor with no obstacles, features or decisions in view.
- **Cave**:
  - `c03` (the "shadow and eyes" beat) shows a fully lit, clearly visible Yeti sitting in a bright tunnel. There is no mystery.
  - `c07` and `c09` show faceted low-poly boulders, and the roar close-up face is a soft smudge with indistinct eyes.
  - `c05` (feet, not a hand) predates the fix. The current code films the hand at 1.6–1.9 m with fov 28–30.
  - `c11` (the leap) shows the Yeti as a speck among grey boulders from about 60 m. The later framing fix is not captured.
- **Chase** (`cave_chase_rear_30m`, `cave_chase_close_9m`, `c12`, `d01`):
  - The main view never shows the Yeti.
  - In the "BEHIND YOU" inset, the skier's own back dominates the frame. At 30 m and 12 m the Yeti is a grey blob, and at 9 m (`c12`) it is a puff of snow.
  - The only frame where the threat reads is at 4 m (`d01`), one second before death.
  - A huge "RUN." covers the middle of the screen in every chase capture.
- **Defeat** (`d02`): the best image in the set. The scale contrast and the grab are funny.
- **Victory** (`v05`, `v06`):
  - The trophy floats above the skier's fist on a grey block and is not held.
  - The raised arm is a featureless tube, and the skier holds the poles while celebrating.
  - The skier's body cuts the banner off to "LAST …SCENT".
  - In `v08` the subtitle is nearly illegible, and there is a soft rectangular seam in the snow at lower left.
- **Results** (`v09`): competent UI. It shows a 2:37 run and a 76 s chase.

## Critical defects
1. **The antagonist is effectively invisible during the gameplay it exists for.** The chase is the game, and in the evidence the Yeti appears only as a HUD bar, a word and a thumbnail blob. Round 1's biggest finding (A) is mitigated on paper, not solved on screen.
2. **There is no evidence that it is fun.** No human has played it and no frame rate has been measured. Its feel is tuned against perfect-line bots. A 9/10 "complete player experience" cannot be awarded on simulations.

## Major weaknesses
- **Replay value is thin.** There is one fixed seed (`SEED_DEFAULT = 20261106`) and no seed selection, so every run is the same 3 km course in about 2.5 minutes. The hooks are score, best time and a style multiplier. There are no ghosts, unlocks, alternate routes with stakes, difficulty options or daily seeds. After two wins there is little left to learn.
- **Pacing:**
  - The first third is a tutorial plus open groomer.
  - The cave cinematic is 17 s of frozen simulation on every first run.
  - The tests allow a skilled player to open a gap of up to 260 m (the response cites about 208 m), while the rear view only appears inside 75 m. So for long stretches a good player is skiing alone, which flattens tension for exactly the players most likely to replay.
- **The balance curve is narrow.** The bots that "never tuck" are caught. Win or lose therefore hinges on one input (hold W when lined up), not on line choice or skill expression. The pursuit model is a rubber band (catch-up boost of 9, plus 5 more when far behind), which skilled players tend to resent once they notice it.
- **The Yeti is not memorable in close-up.** The fur shells look good in silhouette (`d02`, `v03`), but the face, which is the money shot of the roar, is mush, and the cave rock is primitive. The beloved, absurd SkiFree Yeti personality appears in one joke beat and the defeat.
- **The documentation contradicts the code** (an honesty issue). `DESIGN.md` still states the round-0 tuning:

  | Value | `DESIGN.md` | Code |
  |---|---|---|
  | Yeti speed cap | 25.5 | 27 |
  | Catch-up gap | 90 m | 60 m |
  | Catch-up boost | +6.5 | +9 |
  | Pizza braking | 2.3 + 0.09·v | 3.8 + 0.12·v |
  | Drift grip | 1.7/s | 3.8/s |
  | Drift turn rate | ×1.75 | 2.2 |

  Its fairness table ("min gap 32–57 m", "3 seeds") predates the retune, and only the default seed (plus one seed-42 crash case) is asserted. The README's "unit tests: … pursuit balance" suggests broader coverage than exists.
- **Mixed art styles:** chibi guests, a stylised skier and a semi-real Yeti. This is acknowledged but still looks amateurish in the resort shots.

## Minor issues
- The "RUN." title (2.2 s) blocks the centre of the screen exactly when the player has to read the terrain.
- The trophy is not attached to the hand, and the skier keeps holding the poles.
- The banner is cropped by the skier, and the crane-shot subtitle has poor contrast.
- There are no captions for the roar and growls, the victory sequence can't be skipped, and controller buttons can't be remapped.
- Several "final" captures predate the final framing fix, so the published evidence does not match the build.

## Recommended corrections (prioritized)
1. **Put the Yeti in the main view.**
   - Use periodic camera-side reveals or forced look-back beats.
   - Show its shadow and spray at screen edge when it is within 40 m.
   - Make the inset frame the Yeti, not the skier's back (lower the foreground, use a longer lens).
   - Add audio-spatial footsteps.
2. **Get real humans and a real GPU.** Run 5–10 blind playtests and an FPS capture before any quality claim. Record time-to-first-win, deaths per section and quit points.
3. **Fix the tension sag and the replay loop.**
   - Cap the gap (about 120 m) and trigger the inset from distance trends, not only proximity.
   - Add a seed / daily course option and a ghost of the personal-best run.
   - Add difficulty or Yeti modes, and at least one meaningful route choice (a risky shortcut with a payoff).
4. **Correct `DESIGN.md`** to the current tuning and current simulation results, and state the seed coverage of the tests honestly. Recapture `cave_c05`, `c06` and `c11` with the current build.
5. **Polish the payoffs.**
   - Give the roar close-up a readable face (eye highlights, sharper normal detail, rim light), and darken `c03` so the eyes beat lands.
   - Attach the trophy to the hand and drop the poles.
   - Shrink or offset "RUN.".
   - Add roar captions and make the victory sequence skippable.

## Score — Complete player experience: **5.5 / 10**

## Mock release-day review
*SkiFree — The Last Descent* is an impressively engineered tribute that forgets to let you see your pursuer. The deterministic physics, the procedural everything and the slick menus show real craft. The defeat gag, where a towering furball scoops up a terrified skier, earns a laugh. But the run is one fixed, roughly two-and-a-half-minute course. The first act is a tutorial on an empty groomer. The famous Yeti spends the chase as a progress bar and a blurry postage stamp. Winning comes down mostly to holding tuck. The cave reveal is ambitious and long, but its money shots are let down by mushy faces and lumpy rocks, and the victory lap has a floating trophy. Fans of the original will smile once. Newcomers will finish it, nod, and not come back. **Verdict: "Clever tech demo, not yet a game you'd recommend." 5.5/10.**

## Pass/fail vs 9/10
**FAIL.**

## Unverified evidence
- Frame rate and input latency on real hardware.
- Audio mix (never heard by a human).
- Actual feel of steering, drift and pizza.
- Human balance and crash frequency.
- The current framing of the hand, emergence and leap beats (the code changed after capture).
- Whether the inset Yeti reads better at 1080p than in the 960×540 SwiftShader captures.
- The motion quality of the animation (stills only).
