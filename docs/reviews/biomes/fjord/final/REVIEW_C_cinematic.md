# Fjord Coast — Round 3 (FINAL) — Reviewer C: Cinematic & Animation Director

- **Reviewer:** C, Cinematic & Animation Director
- **Nature of review:** model-based reviewer (same model family as the developers; not external)
- **Build:** `aba21bc` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`)
- **Date:** 2026-11-10
- **Evidence used:**
  - Every final PNG at 1920×1080: `01`–`11j`, including all eleven victory stills (`11d`, `11e`, `11f`, `11f2`, `11g`, `11`, `11b`, `11j`, `11h`, `11i`, `11c`) and the cave set (`07`, `07b`, `08c`, `08`, `08d`, `08b`).
  - `final/manifest.json` for camera positions and cinematic times.
  - Round-2 stills, `round-3/wip/r3/07` and `round-3/wip/merged/07` for before/after comparison.
  - **Missing:** `final/res-1366/` was still empty when I finished, and `final/res-2560/` did not exist.
- **Source read:**
  - `src/world/biomes/fjord/views/seaCaveCinematic.ts` (whole file);
  - `harbourVictory.ts` lines 1–410;
  - the `PLUNGE_TIMES` and plunge driver in `harbour.ts`;
  - the basalt shader patch in `seaCave.ts`;
  - snowball code in `GameSession.ts` and `SnowballView.ts`, `Snowballs.ts`;
  - `caveSide` in `fjord/biome.ts` and `profile.ts`;
  - the snowball section of `tools/biome_evidence.mjs`.
  - `git diff aec1812..aba21bc`: `src/cinematic/CaveCinematic.ts` is unchanged, and so is `SnowballView.ts`.
- **Tests:** `npx vitest run tests/unit/fjord_art.test.ts tests/unit/snowballs.test.ts` → 15/15 passed.
- **My own measurements** (scratch in `scratch/review-c-r3/`):
  - near-black pixel share inside the letterbox of the cave frames;
  - mean RGB of the basalt in 07 (final and pre-merge wip);
  - foreground water luminance in 11j, 11h, 11b and round-2 11h;
  - the beacon pixel colour in 11c and 11i;
  - enlarged crops of the gag face, the rear-view insets and the 07 hull.
- `REMEDIATION_art.md` and `REMEDIATION_gameplay.md` were read as claims and checked one by one.

## 2. Verdict — **FAIL** (Cinematics 7.5/10 against the 9/10 target)

The victory sequence made a real step forward:

- every quay beat now has the harbour behind it (`11d`, `11e`, `11g`);
- the Yeti faces the lens for the gag (`11f`, `11f2`);
- the cannonball now has a tuck at its apex and a crown splash (`11j`, `11h`);
- the reveal settles before the title lands, then holds for 2.6 s with the start marked (`11c`).

The cave encounter, though, was damaged by the merge with the gameplay branch. Moving the cave to the sea side (R4, `fjord/biome.ts:177 caveSide: -1`) has three effects:

1. The signature "emergence from inside the sea cave, the Yeti against the fjord" shot can no longer run. `seaCaveCinematic.ts:140` evaluates `seaward` to false for every Fjord cave, so the fallback three-quarter angle is used.
2. The leap shot now looks inland, with no sea (`08b`).
3. The basalt shading, which was tuned on the sun-facing pre-merge cave, now crushes the whole portal to pure black. 76–84% of the pixels inside the letterbox in `08c` and `08d` are below luminance 8. The fanned column-end lintel and the clinker hull, the key props of the remediation, cannot be read.

Several smaller problems also remain open:

- the cod reads as a stick pushed up the Yeti's nose;
- the trophy hides the harbourmaster's face in the presentation;
- the beacon renders as a white disc rather than a fire;
- the plunge water reads as snow at the low camera;
- the Hard-mode throw cue is unchanged since round 2.

Taken together, this is a good 7.5, not a 9.

## 3. Scores

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **7.5** | The harbour, finish and reveal compositions are strong (`10`, `11d`, `11e`, `11b`, `11i`, `11c`). The cave is now a black void: the basalt is crushed to RGB ≈ 0–7, the lintel facets are lost and the hull reads as debris (`07`, `08c`, `08d`). |
| Environmental uniqueness | **8** | The sea-side cave is visible from the summit in `02` and has the sea beside it in `07`. The victory is fully coastal. The cave's interior shots could be any black cave. |
| Skiing and hazard mechanics | **7** (low confidence) | Judged from stills only. The landing column is very legible in `09b` and `09c`. |
| Difficulty and fairness | **7** (low confidence) | The landing marker reads well. The throw itself is not visible in either final still (main view or inset). The text cue is still throw-1-only. |
| Cinematics | **7.5** | Up from 7. The victory comedy and the reveal now mostly land. The cave beats are evidenced at last, but they play against black. The merged cave orientation disabled the signature emergence shot and the sea in the leap. The gag prop and the presenter's face still undercut the two character beats. |
| Performance and stability | **7** (low confidence) | The manifest reports no errors. Not profiled. |
| Accessibility and controls | **7** (low confidence) | Captions cover the gulls, the roar and the gag. The title is legible. The snowball caption is still once-only (`GameSession.ts:651`). |
| Overall player experience | **7.5** | The end of the run is now genuinely memorable: the harbour, the plunge and the summit-to-sea reveal. The mid-run encounter is visually murky, and its best idea is no longer in the build. |

## 4. Defects

Severities: Critical blocks shipping; Major is clearly visible or clearly wrong for a 9/10 target; Minor is polish.

1. **Major (new, merge regression) — The basalt cave renders as a featureless black void.**
   - **Evidence:**
     - Mean RGB of the chamber and causeway region in `07`, crop (1100–1700, 450–700), is **(6, 7, 7)**. The brow band, crop (560–1400, 120–260), is (24, 29, 34).
     - The pre-merge `round-3/wip/r3/07` measured (41, 39, 34) and (79, 77, 71) on the same relative crops. There, the hexagonal lintel and column facets read clearly.
     - Pixels below luminance 8 inside the letterbox: `08c` **82%**, `08d` **76%**, `08` 55%; round-2 `08` was 26%.
     - In `08c` the gulls and icicles float in black. In `08d` the "dropping lintel icicles" hang from nothing visible.
   - **Cause (inferred):** the shader cuts on basalt (`seaCave.ts:106`, `:156–159`: indirect diffuse ×0.32, direct ×0.5, specular ×0.25–0.3) were calibrated on a sun-facing mouth. With `caveSide: -1` the mouth faces away from the sun and only the crushed indirect term remains.
   - **Fix:**
     - Re-tune the basalt for the shadow-side orientation: a floor of about 35–45 sRGB on shadowed faces, or a cool rim or bounce term from the snow and sea.
     - Add a small fill light for the cave shots (`CavePresentation.cinematic`) so the column facets and the lintel read.
     - Add a test that asserts a minimum mean luminance on the portal at the 07 camera.

2. **Major (new, merge regression) — The signature Fjord shots are dead code or no longer show the sea, and the evidence notes misdescribe them.**
   - **Evidence:**
     - `seaCaveCinematic.ts:140`: `seaward = sign(O.x) === sign(rimX − M.x)`. With the cave on the rim side and the mouth facing the piste, this is false for every Fjord cave, so the "from inside the sea cave" shot (`:155–168`) never runs.
     - `08` is the fallback high three-quarter angle. The Yeti stands against the black mouth, and the sea is a corner at the top-left.
     - The leap camera (`:183`) sits on the ledge looking toward the skier, which is now inland. `08b` shows the valley wall and trees, with no sea or islands.
     - `07b` ("looking out past the basalt portal to the fjord") also shows only the inland slope. It has a straight translucent wedge at x 950–1100, cause unknown.
     - Manifest notes for `08`, `08b` and `07b` promise the fjord; the images do not show it.
   - **Fix:**
     - Re-author the two shots for the sea-side cave. For the emergence, place the camera on the piste side, low, looking *into* the mouth past the Yeti, with the open sea framed beside the portal (the sea is right there in `07`).
     - For the leap, take a side-on angle along the cliff, so the sea and the drop are behind the Yeti and the skier below.
     - Delete or test the unreachable branch.
     - Make the evidence notes describe what the camera actually sees.

3. **Major — The leap (`08b`) does not read as a leap.**
   - **Evidence:**
     - From close behind, the Yeti's back and soles fill the top of frame against the far hillside, with no ground under him.
     - With the skier 40 px tall further down the slope, he reads as a 50 m giant walking up the hill.
     - There is no arc, no ledge edge in frame, and no shadow on the snow.
   - **Fix:**
     - Frame the take-off with the ledge lip in the foreground and the arc across the frame (side-on).
     - Alternatively, keep the rear angle but drop the camera so the Yeti is silhouetted against the sky above the horizon, and add his shadow landing near the skier.

4. **Major — The gag prop reads as a stick through the Yeti's nose.**
   - **Evidence:**
     - `11f` (crop in `scratch/review-c-r3/11f_face.png`): the cod is a thin beige plank entering at the nostril. Its flat stockfish silhouette is edge-on.
     - Cause: `harbourVictory.ts:338` sets `rotation.y = heading + π/2`. The extruded shape lies in its local XY plane, so its face is turned perpendicular to the Yeti's facing, which is toward the lens.
     - `:335` places it 0.18 m below the mouth bone, which lands on the muzzle.
     - The gag face in `11f2` is a head-tilted snarl that reads as gagging only with the caption. There is no body business: hands hang at his sides.
   - **Fix:**
     - Use `rotation.y = heading` (the flat side to the lens).
     - Clamp the fish between the teeth, with the tail out of the side of the mouth.
     - Add a body beat on the gag: hunch, hand to throat, tongue out, a shudder.

5. **Minor — The trophy hides the harbourmaster's face in the presentation.**
   - **Evidence:**
     - In `11g` the plinth is held at head height directly in front of his face, so he reads as a lighthouse-headed figure. The remediation claim "held off to his right so his face stays clear" is not true in the final frame.
     - In `11` (after the toss) both his hands are at his head, holding a dark object at his ear. That is not a clap.
   - **Fix:**
     - Lower `holdLift` and offset the grip to chest height and to one side.
     - Verify the clap pose at about 10.9 s.

6. **Minor — The start beacon renders as a white disc, not a fire.**
   - **Evidence:** in `11c` and `11i` the beacon pixels are saturated at (255, 255, 255), with a soft white halo (`scratch/review-c-r3/11c_beacon.png`). Additive orange over bright snow clips to white (`harbourVictory.ts:215`). It reads as a sun glint or a snowball.
   - **Fix:** use normal blending with an opaque orange core and a dark rim, or a small flame-and-smoke column. Keep it constant-size.

7. **Minor — The reveal's "summit" still has terrain above it.**
   - **Evidence:** in `11c` the chute groove continues above the beacon to the top of frame (x 860–900, y 120–480). The start is therefore not the top of anything. Composition and timing are otherwise fixed.
   - **Fix:** raise `endLook` slightly so the skyline above the start is in frame, or let the beacon sit on a visible shoulder.

8. **Minor — The plunge water reads as snow at the low camera.**
   - **Evidence:**
     - The foreground mean RGB in `11j` and `11h` is (141, 149, 157), paler than the cobbles in `11d` (116, 122, 127).
     - Round-2 `11h` water measured (70, 89, 102), and the water near the pier in `11b` measures (67, 85, 98).
     - The crown splash therefore erupts from what looks like a snowfield.
     - The camera is about 0.6 m above the surface (`harbourVictory.ts:181`). This is probably grazing-angle Fresnel; I could not confirm the cause.
   - **Fix:** raise the 4b camera by 1–1.5 m or tilt it down, and/or cap the Fresnel for low cinematic cameras.

9. **Minor — The cave props are still unreadable.**
   - **Evidence:**
     - The "clinker hull" in `07` (crop `scratch/review-c-r3/07_hull.png`) reads as black blocks, a pale cylinder and sticks. No strakes or keel are visible at this camera; they were visible pre-merge.
     - The float net is a blue moiré lattice (`07`, `08` lower-left).
   - **Fix:** this follows from #1. Also turn the hull side-on to the 07 camera, and fade or replace the net texture at distance.

10. **Minor — The Hard-mode throw cue is unchanged since round 2.**
    - **Evidence:**
      - The caption is still `b.throws === 1` only (`GameSession.ts:651`), and there is no inset pulse during the wind-up.
      - In final `09b` and `09c` neither the ball nor its glint is visible in the inset or the main view (crops `inset_09b/09c`). Round-2 `09c` showed the glint.
      - `SnowballView.ts` is unchanged, so this is probably capture timing: the tool waits 1.5 s and then 2.3 s after `throwT > 0.55` (`biome_evidence.mjs:291–297`). Either way, readability of the throw itself is not evidenced this round.
    - **Fix:** add a throttled per-throw cue and an inset border pulse during the wind-up, and capture `09b` during the wind-up.

11. **Minor — Leftover staging blemishes.**
    - **Fixed:** the skis no longer touch the letterbox in `11`, and the `08b` orb is gone.
    - **Still present:**
      - `11d` and `11`: closed ring and loop ski tracks around the skier;
      - `11b`: a pale box under the sauna deck (x 130–500, y 690–820), and ladder rungs below the deck edge;
      - `11f` and `11f2`: the Yeti's feet are cut by the letterbox;
      - `08c`: the gull wings read as sticks at most flap phases.

### What I could not verify

- Motion:
  - gull flight;
  - the icicle fall and shatter;
  - the ice-crack particles at 9.0 s;
  - the Yeti's grab, bite and fling timing;
  - the fish arc and its splash;
  - the trophy toss;
  - the plunge run cycle and roll in motion;
  - the swing from the leap back into gameplay;
  - camera smoothness.
- Audio sync.
- Frame rate.
- 1366×768 and 2560×1440 captures (none present).
- Standard, Long and Endless lengths (Sprint only).
- Whether the 11j/11h pale foreground is the water shader or terrain.

## 5. What works

- **Harbour-framed victory:** `11d` tracks down the street to the water, festoon lights and islands. `11e` has the Yeti at the stockfish rack with boats and the fjord behind, a properly Fjord image. `11g` puts the sea behind the presentation.
- **Plunge:** a visible stride on the deck (`11b`), a genuine cannonball tuck at the apex against the painted houses (`11j`), and a crown splash with sheets and droplets in place of the round-2 decal ring (`11h`).
- **Reveal:** `11i` and `11c` are the best images in the build. The chute runs from the marked start to the harbour, which is tiny at the foot of the wall. The title lands after the move settles (24.0 s against `revealEnd` 23.8 s) and holds 2.6 s. The test now asserts this correctly.
- **Cave beats evidenced:** the gull scatter in `08c` and the roar with spray and falling icicles in `08d` exist and are captioned. The Yeti is planted on the snow in `08`.
- **Establishing shots:** `02` shows the black sea-side cave knob from the summit (good foreshadowing), and `10` is a strong finish establishing shot.

## 6. Round-2 defects (my own verification)

| # | Round-2 defect | Status | Basis |
|---|---|---|---|
| 1 | Cave = Alpine + unevidenced garnish | **Partially fixed, with regressions** | The Fjord shots and beats are now real and captured (`08c`, `08d`), and the cave is by the sea (`07`). But the inside-cave emergence never runs, the leap has no sea, and the basalt is crushed to black (#1, #2). `CaveCinematic.ts` choreography is unchanged. |
| 2 | Gag filmed from behind | **Mostly fixed** | Face to the lens in `11f` and `11f2`. The prop reads as a stick in the nose (#4). |
| 3 | Plunge payoff weak, unevidenced | **Mostly fixed** | Tuck and crown splash shown (`11j`, `11h`). The water reads as snow (#8). |
| 4 | Quay beats don't read as a harbour | **Fixed** | `11d`, `11e`, `11g` |
| 5 | Reveal payoff and title timing | **Mostly fixed** | Title after settle, 2.6 s hold, start in frame and marked. The beacon reads white, and terrain continues above the start (#6, #7). |
| 6 | Presentation pose | **Not fixed (changed)** | A two-hand hold now exists, but it hides his face (`11g`), and the post-toss pose is hands-at-head (#5). |
| 7 | Cave props primitive | **Partially fixed** | Columns are varied (`07`) and the icicles sit on the lintel. The hull and lintel are unreadable after the merge (#9). |
| 8 | Snowball cue partial | **Not fixed** | Code unchanged. The final stills don't show the throw (#10). |
| 9 | Staging blemishes | **Partially fixed** | Skis and orb fixed. Tracks, the sauna box and the ladder remain (#11). |

## 7. Brief compliance checklist (Fjord bullets relevant to Reviewer C)

| Requirement | Status | Evidence |
|---|---|---|
| Biome-appropriate cave and Yeti encounter (§2) | **partial** | The sea cave is placed and its beats exist. Visually it is a black void, and the sea framing is lost (#1–#3). |
| Evidence of the actual cave and victory (§8) | **done** | 6 cave stills and 11 victory stills |
| Memorable victory cinematic | **mostly done** | `11d`–`11c`. Character beats weakened (#4, #5). |
| Exploit the elevation difference; pull back from the ocean to reveal the mountain | **mostly done** | `11i`, `11c` (#6, #7) |
| Coastal-themed trophy presentation | **partial** | Lighthouse trophy, harbourmaster, sea behind. Face hidden (#5). |
| Playful après-ski celebration | **done** | `11b`, `11j`, `11h` (minor #8) |
| Harbour, boardwalk, colourful buildings, fishing boats, distant ships | **done** | `10`, `11e`, `11b`, `11i` |
| Do not reuse the Alpine resort | **done** | Harbour set and new beat sheet |
| Occasional sea mist near the water | **partial** | `11i` waterline mist. The cave sea smoke is a few soft blobs (`08d`). |
| Dramatic views across the fjord | **done** | `02`, `09`, `11c` |
| Hard-mode throw readable in ordinary chase (§10) | **partial** | The marker is excellent. The throw is not shown this round, and the per-throw cue is missing (#10). |
