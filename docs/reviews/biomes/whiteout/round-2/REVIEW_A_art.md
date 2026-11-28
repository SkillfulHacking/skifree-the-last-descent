# Whiteout Ridge, round 2: Reviewer A (Environmental Art Director)

- **Reviewer:** A, Environmental Art Director. I own category 1 (Visual art direction) and category 2 (Environmental uniqueness).
- **Nature:** I am a model-based reviewer, not a human playtester. I judged still frames (SwiftShader, about 1 fps) and source code. I saw no motion, frame pacing, GPU output or audio.
- **Build:** `b70a793` (branch `pass5-whiteout`). Both `round-2/evidence/manifest.json` and `round-2/strip/manifest.json` record `b70a793`, so the frames show the candidate.
- **What I examined:**
  - All 30 round-2 frames in `evidence/`, compared one for one with round 1. I cropped and sampled pixels in 01, 03, 05, 28 and 29.
  - The 24-frame victory strip, as a contact sheet and with 07.5, 14.5 and 17.5 at full size.
  - Alpine `alpine-baseline/07_yeti_cave` and `09_pursuit`, and Fjord `final/09d_pursuit_rim`.
  - `git diff 3f7bc45 b70a793` for `Environment.ts`, `storm.ts`, `biome.ts`, `World.ts`, `look/weatherFx.ts` and every file in `views/` that changed (`sky`, `blowingSnow`, `cornice`, `hazardViews`, `stormCave`, `rescue`, `rescueVictory`, `ridgeRocks`). I also read `scenery.ts` and the capture script `tools/whiteout_evidence.mjs`.
- **Labels:** "Verified" means I checked it myself in an image, by arithmetic or in code. "Claim" means a developer sentence I did not confirm.

## Verdict: FAIL. Both owned categories are below 9.

| # | Category | R1 | R2 | One-line justification |
|---|---|---|---|---|
| 1 | Visual art direction | 5 | **6** | The storm is now dense and flat, the build-up card wedge is gone, the lantern glows and the storm break reads in the strip. But the sky and the ground still meet at a visible horizon, driven snow is still not visible, the cave's new dressing adds obvious artefacts, and the victory light beats still have no value contrast. |
| 2 | Environmental uniqueness | 6 | **6** | A full storm (19, 28) no longer looks like an Alpine overcast. But from the gameplay camera the ridge still reads as a trough with no drop: the closest the line comes to the rim on this course is 37 m. The cave is still Alpine's mesh, with dressing glued on. |
| 3 | Skiing and hazard mechanics (lc) | 6 | 6 | Not reviewed in depth. The drift-gap panels read at about 95 m in a storm (29). |
| 4 | Difficulty and fairness (lc) | 6 | 6 | The sky and the physics now agree during weather hand-backs (`blend` flag). I did not examine the balance data. |
| 5 | Cinematics (lc) | 5 | 6 | The Yeti stays hidden until his beat, the break is visible (strip 16.5–17.5) and the station stays in the reveal. The searchlight is still invisible, the plinth blocks the doorway at 7.5 s, and strip 14.5 is a dead frame. |
| 6 | Performance and stability (lc) | 7 | 7 | Not examined. This is a placeholder; defer to Reviewer D. |
| 7 | Accessibility and controls (lc) | 7 | 7 | The gap panels and thicker wands help. The storm caption stays on screen into CLEARING (06, 07). |
| 8 | Overall player experience (lc) | 6 | 6 | The storm finally has weight, but the ridge and the cave still do not deliver the fantasy. |

## Round 1 → round 2

| R1 finding | Status | Evidence I checked |
|---|---|---|
| **1. The storm does not look like a whiteout (Major)** | **Partly fixed** | See the detail below. |
| **2. Hard-edged sky geometry (Major)** | **Partly fixed** | See the detail below. |
| **3. The ridge does not read from the gameplay camera (Major)** | **Partly fixed (marginal)** | See the detail below, and new finding N2. |
| **4. The victory has no light to read (Major)** | **Partly fixed** | See the detail below. |
| **5. The storm-chase frames show no storm; sky and fog disagree in blends (Major)** | **Fixed** | `World.ts` now passes `blend` and `sky.ts:203` follows the blended storm. 16 and 17 show storm sky and storm light. The capture also calls `settleWeather()` (`whiteout_evidence.mjs`). The manifest still records the Yeti 114 m back in 16, not 18–34 m, so a close storm silhouette is still not evidenced. 17 shows only a tiny pale figure at about x 638, y 355. |
| **6. The cave is Alpine's cave, re-tinted (Major)** | **Not fixed in substance** | `stormCave.ts:4` still says "The shared cave geometry … untouched". 12 has the same mouth, strata and claw scratch (x 800, y 570) as `alpine-baseline/07`. The added cornice, feathers and sheet introduce new artefacts (finding N3). Lighting continuity across 12→15 is now fine, which closes R1-10. |
| **7. Cornice and rim wands (Minor)** | **Cornice not fixed; wands partly fixed** | The `cornice.ts` diff changes only the wand radius (to 0.06/0.07 m, about 2.4 px at 30 m). 08 shows the same constant-thickness kerb with 3 m kinks (x 640–1280, y 395–550). |
| **8. Trail lamps are not amber and do not pulse in sequence (Minor)** | **Not fixed** | The colour `[1.0,0.62,0.18]` is still additive (`scenery.ts:157,168`). All lamps still share one `sin(time·2.2)` (`scenery.ts:217`), and `phase` is still written but never read. The lamps read white in 05, 19, 23 and 28. |
| **9. Wind drifts look like slabs (Minor)** | **Not assessable** | The mounds are barely visible at the evidence distances (02 x 540–700, y 395–410). No frame shows a drift close up. The asymmetric `driftProfile` (`hazards.ts:78`) is right in principle. |
| **10. Lighting continuity cave → chase (Minor)** | **Fixed** | 15 is now graded dusky blue, matching 12–14. |
| **11. Evidence hygiene (Minor)** | **Mostly fixed** | The SHA matches the candidate, and gameplay-camera shots 27–29 were added. Some notes still overstate their frames: 01 says "the ridge in sun, cloud shadows" but is overcast with no sun and no shadows; 05 says "driving snow streaks"; 08 says "the lip curling"; 24 says "in the searchlight beam"; 21's sled and housing are shown but the "warm light spills out" is not. |

### Detail on R1-1: the storm

- **What improved (verified):**
  - The fog multiplier went from 11 to 21 (`storm.ts:33`) and the cap from 0.0105 to 0.016 (`biome.ts:75`).
  - At 05's `s = 0.877` the density is `0.00085 × (0.65 + 20.35 × 0.877^1.3)` ≈ **0.0151**, under the cap. With the shader term `1 − exp(−(d/26000 + (ρd)²))`, that gives **44% fog at 50 m, 77% at 80 m and 96% at 120 m**. Round 1 had 51% at 80 m and 92% at 150 m.
  - The comment's "≈55% at 50 m, ≈87% at 80 m" holds only at `s = 1`, uncapped. With the cap of 0.016 it is 47% and 81%.
  - The sun is cut by 92%, the hemisphere light by 30% and the environment light by 45% (`Environment.ts:229-231`).
  - In 05 the right-hand slope has lost its ripple shading. In 28 the crest-side trees are ghosts. 19 and 23 are the first frames in which sky and ground nearly merge.
- **What remains (verified):**
  - The horizon is still a hard value step (N1).
  - The near ground is much darker than the sky: in 28, pixel (640, 600) is (126, 144, 170) against a sky of (186, 188, 191).
  - The blowing-snow streaks are still not visible in any storm frame (N4).
  - The blizzard curtain still cannot be seen in 16. It has the same colour as in round 1.

### Detail on R1-2: the sky

- **Fixed:** the flat wedge in 04. The wall is now hidden within 300 m and fades over 300–1100 m (`sky.ts:234-242`), and 04 shows no plane.
- **Better:** the deck "drips". In 01 and 02 the deck no longer hangs sawtooth spikes.
- **Not fixed:**
  - **03 crop (x 900–1280, y 90–300):** the wall is a dark mass with a straight bottom edge at about y 250 and a vertical step at about x 1077. The plane still has no bottom fade (`WALL_FS`, `sky.ts:115-140`), and deck alpha is still `0.6·d` at the edge (`sky.ts:110`).
  - **Ranges:** they are still pale cut-paper silhouettes with vertical steps, in 01 (x ≈ 1250, y 30–60), 02, 06 and 27.
  - **09:** the straight-edged translucent grey smear (y 80–320) and the diagonal sheets are unchanged from round 1.
  - **06:** a dark flat-bottomed cloud band sits over the left ranges (x 0–520, y 180–290).

### Detail on R1-3: the ridge

- The rim moved from 26 m to 10 m and the lip from 3.5 m to 1.5 m (`biome.ts:131`).
- In 01 and 27 the drop-side bank is lower, and haze opens beyond it.
- But no frame from the gameplay camera shows the drop, the cornice, a valley floor or anything below the horizon line (N2).

### Detail on R1-4: the victory light

- **Better:**
  - The lantern now has an additive halo that swells with `lanternUp` (`rescue.ts:529-552, 639-643`), and it reads in 22 and strip 7.5.
  - The porch light is visible in 21.
  - The Yeti is hidden until 8.8 s (`rescueVictory.ts:62, 104`) and is not in 21.
  - The break is visible in strip 16.5–17.5, with a darker torn deck overhead.
  - The station is in the reveal (26).
- **Not fixed:**
  - In 23 and 24 there is no searchlight cone and no light pool on the Yeti, although `uK` rises to 0.42 and the light to 420 (`rescue.ts:633-635`). The README concedes this.
  - The finish storm is still high-key neutral grey (sky about 186), not darker or bluer.
  - The windows read cool white, not warm (20, 21).
  - The lantern still sits on top of the vertical pole held in the same hand (22, x 590–600, y 415–685).

## New findings

### N1. MAJOR: in a storm the sky dome is darker than the fogged ground, so the horizon stays a hard line (verified)

- **Measured in 28:**
  - Sky (640, 250) = **(186, 188, 191)**.
  - Fogged terrain at the horizon (1000, 330) = **(199, 208, 221)**; at (300, 385) it is (175, 189, 206).
  - The far ground is lighter and bluer than the sky: a step of about 30 in blue, right at the horizon.
- **Same pattern elsewhere:**
  - 05: sky (186, 188, 190) against near ground (128, 146, 172).
  - 19: sky (185, 188, 190) against ground at the horizon (200, 209, 221).
- **Cause (code):**
  - The storm dome is a `MeshBasicMaterial` in `fog.color`, drawn with `fog: false` at opacity 0.97 (`Environment.ts:270-283`), and it renders neutral grey after tone mapping.
  - The terrain fogs toward `fogColor` through the terrain shader, and comes out bluer and brighter.
  - The two paths do not produce the same final colour.
- **Player impact:** the defining whiteout cue, ground and sky becoming one value, never happens. Every storm frame keeps a crisp horizon that tells the player where the land ends.
- **Fix:** make the dome and the terrain fog resolve to the same tone-mapped colour (sample one, or drive both from one uniform after exposure). At `s > 0.7` raise the near-ground value toward the sky (lift the ambient term, or add a screen-space veil), so that the value difference shrinks rather than inverts.

### N2. MAJOR (uniqueness): the gameplay camera still never sees the drop; the racing line stays at least 37 m from the rim (verified number, from the capture's own computation)

- The capture script searches the whole course for the z where `|routeX − ridgeRimX|` is smallest (`whiteout_evidence.mjs`, `play` section). The best it finds is **37 m** (27's note).
- "Rim 10 m off the piste" (`biome.ts:129-131`) is therefore not "rim 10 m off the line": on this seed the line never comes within 37 m.
- **In 27 (clear), at that closest point:**
  - the left side is a low snow bank (y 350–400) meeting haze;
  - there is no edge silhouette, cornice lip, dark void or valley floor below the horizon;
  - the far ranges sit *above* the bank, as they do in a valley.
- **In 28 (the same place, in a storm):** the left side is an indistinct snowfield.
- **Compared with Fjord 09d:** that frame shows open water and islands beyond the rim from the same camera. Whiteout has no equivalent moment.
- **Player impact:** "exposed ridge" is still told by the HUD and the wind, not seen. The location's name promises exposure.
- **Fix:**
  - Route the line within 10–15 m of the rim for set stretches of each course, at least one per clear window.
  - Put something readable far below: a darker valley floor, a glacier or village lights.
  - Darken the void side, so that the lip has a silhouette.
  - Add a gameplay-camera evidence frame that shows it.

### N3. MAJOR (art/uniqueness): the cave's new storm dressing reads as artificial primitives (verified)

- **The spindrift sheet looks like a lattice of "digital rain".**
  - In 13 and 14 the mouth is filled with evenly spaced vertical grey dashes on a regular grid (13: x 0–900, y 30–420).
  - Cause: the texture is 90 `fillRect(1.5 × 10–32 px)` dashes at `x = 37k mod 64`, `y = 151k mod 256`, repeated 6× along a single plane (`stormCave.ts`, `sheetTex`).
  - It reads as rain or a screen effect, not spindrift, and it shows as a flat rectangle where it overlaps the rock (13, left).
- **The rime feathers look like bunting.**
  - They are 46 four-sided cones (`ConeGeometry(0.06, 1, 4)`) along the edge. In 12 (x 320–830, y 515–535) they read as a row of small white diamonds, and in 13 and 14 as faceted crystals hung in a line.
- **The cornice looks like a slab.**
  - It is a 28×7 lofted strip. In 12 it reads as a smooth white surfboard or lozenge floating over the mouth (x 280–870, y 465–525), with a seam at about x 510. It overhangs solid rock at the left as well as the opening.
  - In 15 (exterior) it reads as a white winged shape (x 490–690, y 355–400).
- **Player impact:** the signature set piece is now less convincing than plain rock would be. The cave is still Alpine's mesh underneath (same claw scratch, same strata).
- **Fix:**
  - Replace the textured plane with a particle sheet, using the existing `Grains` class with streaked sprites, or add noise-driven, non-periodic UVs.
  - Make the feathers irregular, flattened blades, clustered rather than evenly spaced.
  - Model the cornice into the brow with a scalloped edge, a shadowed underside and a blend into the rock, not as a separate strip.
  - Better still, give the cave its own silhouette: a hollow carved in ice or rime, or a rock rib with a drift-choked mouth.

### N4. MINOR: driven snow is still not visible in stills, although the code says it should be

- **Code (verified):** at full storm, `uStreak = 0.045 × 2.4 = 0.108 s`. At about 10 m/s of wind that is a streak of about 1 m, and at 10 m it is roughly 50+ px long and 3 px wide. The preset is `high` (6000 grains in a 48 × 48 × 21 m box, `blowingSnow.ts:17-24, 136-141`). The colour is near-white over a sky of about 186 grey.
- **Images:** I cannot find a single streak in 05, 16, 28 or 29. 28 (crop x 0–640, y 330–690) shows only ground-shader motion streaks and a few soft round flakes from `Environment.snow`.
- **Unverified cause:** the frozen capture clock, low wind in render space, or the `vA` edge fade. I could not run the renderer.
- **Player impact:** if this matches play, the storm has no airborne motion cue, which is the main signal of wind direction.
- **Fix:** capture one frame with the blowing snow isolated, to confirm whether it draws. If it does draw, give the streaks a value darker than the fog, or add a soft back-lit edge.

### N5. MINOR: planar seams across the terrain in the victory reveal (verified)

- 26 and strip 17.5–23.5 show a straight diagonal shading discontinuity across the snow, at x 0–640, y 380–700 in 26. This is the settled title shot, held for about 5 s.
- 11 has a similar seam at x 450–520, y 470–600.
- **Fix:** look for a terrain chunk or LOD border, or a shadow-cascade edge, at that camera height.

### N6. MINOR: snow "pucks" round the station (verified)

- The drifts around the hut and the porch are flat ellipsoid caps with hard rims. In 26 they sit at x 735–995, y 560–600, and they also appear in 21 at x 930–1160, y 455–515.
- They read as discs placed on the snow, not as drifts banked against the walls.
- **Fix:** blend them into the terrain (a height offset in the terrain shader, or feathered edges), and make them asymmetric toward the lee.

### N7. MINOR: victory composition (verified; cinematic owner C)

- **Strip 7.5:** a large dark grey box (x 345–435, y 185–315 at 960×540), which I take to be the lantern plinth from its geometry (`rescue.ts:555`), sits between the camera and the doorway. The lantern sits on top of it. It reads as a chimney in front of the hut and blocks the warm doorway behind the skier.
- **Strip 14.5:** a dead frame. Ground-level wands, a sled cut off at the right edge, and no subject.

### N8. MINOR: the storm caption persists into the clearing (verified)

- 06 (CLEARING pill) and 07 still show "[a storm front rolls in — the wind pushes you left…]". The words and the picture disagree.

## What is good

- **The storm at its best (19, 23, 28):** the station and the Yeti come out of the white as pale ghosts. This is the right look, and it is new in round 2.
- **The drift-gap panels (17, 29):** the hi-vis orange holds about 45% of its colour through the fog and reads at about 95 m. This is good storm-readability language, alongside the snowball beam (18).
- **The build-up (04):** it no longer has the card wedge. The dome-led transition is clean.
- **The lantern halo and porch light (21, 22, strip 7.5):** they give the cinematic its first warm accents.
- **The storm break (strip 16.5–17.5):** a darker torn deck over the station, which round 1 lacked.
- **The station design and the Yeti model:** both remain the location's strongest assets.

## What would raise each owned score to 9

**Category 1, Visual art direction (6 → 9):**
1. Sky and fogged ground at one value in a full storm, with no horizon step (N1), and near-ground contrast reduced toward the sky.
2. Visible driven snow in storm frames (N4), and a visible blizzard curtain in 16.
3. No card or plane artefacts: a soft bottom on the storm wall (03), smoothed ranges, the 09 smear removed, and deck alpha faded at the edge.
4. Cave dressing without periodic textures or primitive shapes (N3), and a sculpted rim cornice (R1-7).
5. Victory value contrast: a darker, cooler finish storm, a visible searchlight cone and pool on the Yeti, warm windows, and the lantern not on a stick.
6. Amber lamps that chase down the hill (R1-8), and terrain seams and snow pucks removed (N5, N6).

**Category 2, Environmental uniqueness (6 → 9):**
1. The drop seen from the gameplay camera at regular, evidenced points, with the line within about 10–15 m of a silhouetted lip and something readable below (N2).
2. A Whiteout-specific cave form, not Alpine's mesh with additions (R1-6, N3).
3. Side-by-side gameplay frames of Alpine, Fjord and Whiteout, in clear and in storm, that are identifiable without the HUD. Storm frames now pass this test; clear-window frames (01, 07) still read as an Alpine valley with greyer rock.
