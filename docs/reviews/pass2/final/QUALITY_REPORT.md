# Pass 2: final quality report

**Branch:** `pass2` (from baseline `e645e90`). About 45 commits, roughly +8.6k / −1.5k lines in `src/`.
**Date:** 2026-11-08.
**Reviews:** every review in this pass is **internal**: other model instances acting as Reviewers A–F with
authority to reject. No external human has reviewed or played this build.

## How the pass was run
- **Order:** audit → menu → cave and Yeti → course refactor → long courses → Endless → Daily → visual passes → three review-and-repair rounds → final evidence.
- **Engineers:** specialist agents did the cave, Yeti, terrain and trees, and visual work. The lead did the systems, menu, cinematic and integration, and made every commit.
- **Reviews:** round 1 (`round1/`), round 2 (`round2/`), and a final round 3 (`final/FINAL_REVIEW_A_CE.md`).
- **Defect tracking:** every defect has an ID in `DEFECTS.md`. A developer saying something is fixed does not close it; only a reviewer's verdict on new evidence does.
- **Environment:**
  - no GPU (SwiftShader software WebGL) and 2 CPUs;
  - one 1920×1080 frame took 1–13 minutes;
  - the session's server restarted about six times, killing running agents. Work in progress was snapshotted into commits so nothing was lost.

## Results by requirement

| Area | Final status | Evidence |
|---|---|---|
| **U1/U2 Menu** (fit, title, no overflow, input) | **PASS** (internal C/E: 8/10) | All 7 Playwright menu tests green (`e2e/menu_results.md`) at 1366×768, 1920×900, 1920×1080, 2560×1440, 125 % zoom and 150 % UI scale, with keyboard, mouse and gamepad. Screenshots in `menu/`. |
| **U5/U6 Course length** | **PASS** (internal B: 8/10) | Sprint 3 / Standard 10 (default) / Endurance 20 / Expedition 50 km / Endless. Headless wins at every length and losses are possible (`tests/unit/course.test.ts`). Long courses add skirmishes that end at refuges. Alternate lines save time (`review_regressions.test.ts`). |
| **Endless** | **PASS** | 120 km browser session: GPU geometries 324–382, textures ≤ 21, JS heap 58–86 MB with no trend, 13 refuges, 0 errors (`endless_memory.json`). Floating origin is verified to 120 km. Escalation is capped at +33 %, a documented ceiling. |
| **U7 Daily** | **PASS** (internal B: 9/10) | UTC rollover, 14-day replay, course codes, custom seeds, Relaxed/Normal/Hard difficulty, records per course code, migration and sanitising. All covered by tests. |
| **U4 Yeti grounding** | **PASS** (A: 8/10, C: 8/10) | 584-frame capture through the hand-off into the chase. Soles 0 cm into the floor, hands ≥ 14 cm above it, head ≥ 3.7 m below the roof. No teleport; the landing is on camera. |
| **U3 Cave geology** | **PASS** (A: 7/10, was 4) | Reads as a rock band in the hillside; fracture-set shading. `cinematic/`, `visual/r3_*`. |
| **Cave interior and cinematic angles** | **FAIL, by 0.5** (A: 6.5/10) | Dark beats now work (t = 5.4–7.9). Remaining at review time: the Yeti was still lit at the 3.8 s cut, grey orbs near the head at 5.4 and 14.6 s, and a seam on the threshold floor. The 3.8 s dimming was changed after the review; that frame was re-captured but not re-reviewed (`final/cine_check/`). |
| **Yeti model/face/fur** | **FAIL, by 0.5** (A: 6.5/10, was 6) | Better skin, varied teeth, bare mouth interior, bigger head and a neck. Still open: fur fills the opened mouth from the close-up roar angle, a long fringe at the mouth corner, palms that read as glove pads, a hard fur "brim" line on the forehead, and a forehead whorl. |
| **Trees / terrain shading / atmosphere / cohesion** | **PASS** (7 / 7 / 7 / 7) | Contour-line artefacts are gone. Conifers rebuilt. Aerial perspective and a skyline. |
| **U8 Overall visuals** | Improved on every axis; two sub-areas are still marginal | See above. |

## Not verified or not possible here
- **Frame rate on a real GPU:** not measured. High-preset gameplay is about 4–5.6 M triangles per frame including shadow passes, about 500 draw calls, and the Yeti is about 720 k triangles. This needs measuring on hardware; the levers are `Vegetation.nearDist`, the tree tiers and fur card counts.
- **Playtesting and audio:** no human has played it or listened to it.
- **Motion:** quality was judged from stills, not motion (fur shimmer, cut rhythm).
- **Licensed assets:** investigated and none used. Only package registries were reachable (`ASSETS_AND_LICENSES.md`).

## Known open defects (minor unless noted)
These are from `final/FINAL_REVIEW_A_CE.md` and `DEFECTS.md`:
- **Cave interior (M):** A8, A10, A11, A12, A13.
- **Yeti (M):** A15, A17, A35 (roar angle), A36, A42, A44.
- **Environment:**
  - A2: milky slab at the end of the band;
  - A24: collidable trees on steep walls are now thinned, but the reviewer still saw some;
  - A29: rock scatter is too even;
  - A31: distant ranges are flat;
  - A37: snow facets;
  - A41: dotted seams along creases;
  - A43: untextured logs;
  - A45: bedding lines look ruled.
- **Systems:**
  - B3: alternate lines carry no real risk;
  - B6: plan arrays grow slowly on Endless;
  - B7: escalation is speed-only;
  - B12: float32 precision on particles and tracks beyond 250 km;
  - E6: gamepad users cannot type a course code;
  - E13 (partial): an unconfirmed draft code survives a menu re-render.

## Bottom line
- **Met, with tests, measurements and internal review:** every user-reported functional defect (menu, course length, configurable distance, Daily, Yeti grounding). The Endless and streaming architecture also meets its requirements.
- **Not met:** the visual bar. Two of eight visual areas sit half a point under the internal 7/10 pass mark after three rounds. The procedural Yeti close-ups and the cave interior are where a human art pass, or licensed scanned assets, would help most.
