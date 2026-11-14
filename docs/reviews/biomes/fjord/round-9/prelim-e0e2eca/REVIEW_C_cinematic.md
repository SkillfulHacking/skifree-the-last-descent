# Fjord Coast — Round 9 — Reviewer C: Cinematics

- **Reviewer:** C, cinematics
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `e0e2eca` (branch `pass4-fjord`). The cave and cinematic shots were rendered on `e0e2eca`; the victory, finish and pursuit shots on `c9ffd1b`. `git diff c9ffd1b e0e2eca -- src` touches only `src/world/caveTerrain.ts` (+11/−1). I checked this myself.
- **Date:** 2026-11-14

## 1. Evidence used and gaps

- **Images viewed:**
  - Sprint (`round-9/candidate/`): every cave and cinematic PNG (`07`, `07b`, `08`, `08b`, `08c`, `08d`), plus `09`, `11`, `11c`, `11g` and `16`.
  - **Standard (`round-9/candidate/standard/`, all six shots):** the first time in five rounds that the cave cinematic was rendered on the default course.
- **Pixel diff against round 8** (`scratch/review-c-r9/diff9.py`; a pixel counts as changed if any channel moves by more than 8/255):
  - **Real change:** `08c` 68.7% (new gull shot) and `08d` 15.7% (particles and mist only; same pose).
  - **Cave shots:** `07` 5.3%, `07b` 4.3%, `08` 3.3%, `08b` 2.0%.
  - **Victory, `11`–`11j`:** 0.6–2.3%, so it is unchanged for the sixth round. `harbour.ts`, `harbourVictory.ts`, `seaFraming.ts`, `src/cinematic/**` and `src/yeti/**` are all byte-identical between `d1f642b` and `e0e2eca` (`git diff --quiet`).
- **Source read:**
  - the `d1f642b..e0e2eca` diff of `seaCaveCinematic.ts` (gull shot, lines 162–193);
  - `seaCave.ts` (boulder bedding, colliders, shared geometry);
  - `caveTerrain.ts` (the new jamb cap, lines 357–367);
  - `presentation/cave.ts`.
- **Tests:** `fjord_reveal.test.ts` and `fjord_art.test.ts` pass, 8/8. No test was added for the gull shot or for the jamb cap (`git diff d1f642b e0e2eca --stat -- tests` is empty).
- **My own probes** (`scratch/review-c-r9/`, headless, against the shipped modules):
  - **`gullshot9.test.ts` → `gullshot9.txt`.** It builds the real dressing (`dressSeaCave`) and rebuilds the shipped gull-shot pose: biggest-group centroid, camera +15 m along the face and −2 m inward, a 0.8 m dolly, fov 44→48. It covers **18 caves**: Classic Sprint (high and low quality), Classic Standard (high and low), Classic Endurance (2 caves), 8 Standard seeds and 2 Endurance seeds × 2 caves. It simulates the shipped gull flight at 60 Hz and uses the cinematic letterbox (visible NDC |y| < 0.778). For each cave it records:
    - gulls in frame;
    - the nearest gull to the lens;
    - camera clearance above the terrain;
    - whether the mouth opening is in frame;
    - whether the Yeti's head is in frame with terrain line of sight at 2.4, 3.0 and 3.6 s, using the shared exit-path placement.
  - **`jamb9.test.ts` → `jamb9.txt`.** It compares `caveTerrainOffset` at `e0e2eca` with the `c9ffd1b` version (copied to `caveTerrain_c9ffd1b.ts`) on a 0.5 m grid around 6 caves, and projects the lowered points into the exact `07` camera (pose from the manifest; look target from `tools/biome_evidence.mjs:268`).
  - **Crops:**
    - `r9_07_mouth_r8_vs_r9.png`: the Sprint mouth, round 8 vs round 9;
    - `r9_08c_sprint_mid.png` and `r9_08c_std_gulls.png`: the gull shots;
    - `r9_07std_boulders.png` and `r9_08_sprint_boulders.png`: the boulders.
- **Missing evidence:**
  - `round-9/TESTS.md` had not appeared when I finished.
  - The coastal reveal (7.9–9.2 s) is **still not rendered on any course**. The Standard set captures 2.95, 9.5, 11.65 and 15.0 s, so it skips the reveal.
  - No frame between 3.8 and 7.9 s (the dark interior and the eyes) was captured.

## 2. Verdict — **FAIL** (Cinematics 8.5/10 against the 9/10 target; up from 8)

**Fixed this round (I checked each one myself):**
- **The gull beat no longer shows the Yeti early.** Neither `08c` frame (Sprint or Standard) shows him. My probe finds his head in frame with line of sight on **0/18** caves (it was 9/9).
- **The gull beat now works on the default course.**
  - On screen: `standard/08c` shows about 8 gulls scattering off the boulders under the caption.
  - Probe: **≥ 3 gulls in frame at 2.4 s and ≥ 2 in flight through the beat on 18/18 caves**. On Standard caves 10/10 gulls stay in frame for the whole beat (it was 0/0/0/0 on 7/7).
- **No white snow wedge in the Standard mouth.** The jamb is clean in `standard/08`.
- **The cave boulders are bedded deeper**, so their undersides no longer show.

**Why it still fails:**
- **The default-course encounter never puts the Yeti and the sea in the same frame.** This is now confirmed on screen: `standard/08`, `08d` and `08b` contain no water at all. The manifest notes for `08` ("the Yeti against the fjord") are false for Standard.
- **The coastal reveal is unchanged:**
  - the code is byte-identical;
  - the cave is never in it;
  - about 25% of its closing frames are near-dry;
  - it has still never been rendered.
- **The fix for the Standard jamb introduced a new artefact in the Sprint cave mouth.** A lit white shard hangs inside the dark opening, and two see-through holes appear in the chamber, in the cave's establishing view (`07`). My probe shows the new cap lowers the heightfield by up to 9–13 m on every cave, in the exact region of the image where the artefact sits.
- **The boulders still read as placed props**, with no contact shading and with sliver and flake shapes.
- **The victory sequence is untouched for the sixth round.**

## 3. Scores

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **7.5** | The boulders are bedded deeper but still pasted-on, with flake and plank shapes (`r9_07std_boulders.png`). There is a new white shard and holes in the Sprint mouth (`07`). The victory podium and catch shot are unchanged. The Sprint encounter frames (`08`, `08b`, `08d`) remain handsome. |
| Environmental uniqueness | **8** | The harbour, quay, stockfish, plunge and closing fjord reveal are clearly not Alpine. But the default-course encounter, now seen on screen, is rock, snow and a frozen puddle, and could sit in any biome. |
| Skiing and hazard mechanics | **7** (low confidence) | Stills only. Not my area. |
| Difficulty and fairness | **7** (low confidence) | Not assessed. |
| Cinematics | **8.5** | Up: the gull beat is fixed on every length and no longer spoils the Yeti (on screen for Sprint and Standard; probe 18/18). Down: the default-course encounter is entirely inland on screen; the reveal is unchanged and unrendered; there is a new mouth artefact; the victory is frozen. |
| Performance and stability | **7.5** (low confidence) | The developers' CPU numbers (`EVIDENCE.md`) show p99 under 12 ms and 0 frames over 33 ms. I did no profiling. `TESTS.md` was not available. 8/8 related unit tests pass. |
| Accessibility and controls | **7.5** (low confidence) | "[gulls scream and scatter]" now matches the picture on every length. I did not check the rest. |
| Overall player experience | **8** | A Standard player now gets a readable gull beat and a clean emergence. The encounter still never says "sea cave" on the default course, and the ending is still the best part. |

## 4. Defects

**No Critical defects found in my area.**

### 1. Major (new regression) — The jamb cap opens the Sprint cave mouth: a floating white shard and two see-through holes inside the opening

**Evidence:**
- **The frame:** `07` (`e0e2eca`, Sprint, foreshadow). Inside the dark mouth:
  - a lit white curved sliver at x 940–970, y 480–555;
  - two dark-blue see-through patches at x 990–1050, y 455–510.
- **Before:** neither is in round 8's `07`, which has the identical camera (crop `r9_07_mouth_r8_vs_r9.png`). The rest of the frame changed by only 5.3%, mostly the re-bedded boulders.
- **Cause:** the round-9 cap in `caveTerrain.ts:362–366`.
  - It applies for `cd < 2.6`, which includes the region inside the chamber wall.
  - There it pulls the heightfield down to `bank + liftGround + 0.4`.
  - It ramps over only 0.6 m in `cd` (2.0→2.6) and 1.5 m in `u`.
- **Probe (`jamb9.txt`):**
  - The cap lowers the old surface by up to **9.3 m** (Classic Sprint and Standard) and **13.0 m** (S7X5, S7X17), at 29–35 points per cave on a 0.5 m grid. On the 1 m terrain grid that leaves near-vertical snow facets and gaps.
  - Projected into the `07` camera, the lowered points fall at **x 840–1302, y 114–642**, which covers both artefacts. The mouth centre projects at (960, 649).
- **Not observed:** `standard/07`, `07b` and the captured cinematic frames don't show it. Other camera angles and the uncaptured 3.8–7.9 s interior shots are untested.

**Fix:**
- Bound the cap: at most 0.5–1 m of lowering, and only where `cd ≤ 0.3` (the opening itself, not inside the rock).
- Or widen the ramps so no adjacent 1 m vertices differ by more than about 1.5 m.
- Add a unit test over the finite-length caves: the maximum height step between adjacent 1 m grid vertices within 6 m of the mouth must be below a bound, and must not be worse than `c9ffd1b`.

### 2. Major (carried; F-024 core) — On the default course the Yeti never shares a frame with the sea; now confirmed on screen

**Evidence:**
- **Rendered Standard frames:** none of the encounter frames contains water.
  - `standard/08` (9.5 s): Yeti, frozen pool, rock wall.
  - `standard/08d` (11.65 s): the roar against the rock face.
  - `standard/08b` (15.0 s): the leap down an inland slope with scree and trees.
- **The gull beat:** it now looks along the face and partly outward. Outward is toward the piste, so `standard/08c` is inland too.
- **Code:** `seaFraming.ts` is unchanged since round 8, so my round-7 station probe (emergence 0/21, leap 0/21 with the sea on non-Sprint caves) still applies.
- **Captions and manifest:** the manifest notes "the Yeti against the fjord" (`08`) and "spray and sea smoke" (`08d`) describe the Sprint cave, not what a default-course player sees.

**Fix:** as in C r7 #4 and C r8 #4.
- Add a crane shot above and behind the rim, looking down across the cave to the fjord, with the Yeti in it; or make the reveal include the brow and cut to the Yeti from there on the roar.
- Assert that on ≥ 90% of finite-length caves some shot from 7.9 to 16 s has the Yeti at ≥ 10% of frame height with ≥ 0.10 water.

### 3. Major (carried; F-038 partial) — The coastal reveal never shows the cave, its closing frame is near-dry on about 25% of caves, and it has never been rendered

**Evidence:**
- `seaFraming.ts` and the reveal shot are byte-identical to `d1f642b`, and the only terrain change is local to the mouth. My round-8 sweep (`scratch/review-c-r8/sweep8.txt`) therefore still describes the build:
  - mouth or brow in frame **0/71**;
  - closing-frame water < 0.10 on **18/71** (0.00 on 11/71);
  - only the opening frame is checked.
- No evidence set captures 7.9–9.2 s.

**Fix:** as in C r8 #3.
- Check the end of the move as well as the start (≥ 0.15 water on a ≥ 16×9 grid).
- Re-aim with the brow at about `sy` 0.6.
- Add a reveal still to `tools/biome_evidence.mjs` for the Standard course.

### 4. Major (F-040 partial) — Cave boulders: bedded deeper, but still pasted on, with sliver and flake shapes

**What is better:** the scans now sit about two-thirds under the snow (`seaCave.ts:394–397`), and their undersides no longer show.

**Remaining:**
- There is still no contact shade, drift or collar. The collars from `cd8f1fa` were removed again in `ff41883`.
- The snow meets each rock along a hard line on flat, unmarked snow.
- Slicing at the waist turns some scans into thin flakes:
  - a plank-like sliver at x 300–365, y 915–985 in `standard/07`;
  - a tilted flake at x 1245–1320, y 740–815 in `standard/07`;
  - a tattered all-white lump at x 440–580, y 740–840 in `08` (crop `r9_08_sprint_boulders.png`).
- These are in the hero shots of the signature cinematic.

**Fix:**
- Exclude scan orientations whose cross-section at the cut height is thinner than about 0.4 r.
- Add a contact-AO decal and a shallow drift skirt.
- Cap small scans with snow geometry that follows the rock's top, not a sheet.

### 5. Minor — Gull beat: works now, but the mouth sits at the frame's edge, nothing is coastal, and there is no test

**Evidence:**
- The code comment (`seaCaveCinematic.ts:186–188`) says the mouth is "well outside the frame behind the camera's shoulder".
- Probe: on **10/10 Standard caves** the mouth centre projects at NDC x **0.96–0.98**, inside the frame's right edge, and all three mouth points are in frame. In `standard/08c` the jamb and the frozen pool at the mouth are visible at x 1580–1920.
- The Yeti is hidden today only by the oblique angle through the jamb (0/18 in the probe; not visible in either render).
- `O` points toward the piste on every cave, so the shot looks up the run (`08c` Sprint), not "out to sea" as the comment says.
- The test I asked for in round 8 was not added.

**Fix:**
- Move the camera ≥ 20 m along the face, or yaw 10° away from the mouth.
- Add the regression test: Yeti head outside the frame at 2.4–3.8 s, ≥ 3 gulls in frame.

### 6. Minor — The gull model still shows in close-up

- The nearest gull is now 8.4 m from the lens on Sprint (probe; it was about 1–2 m effective in round 8). In `08c` it is about 200 px across.
- The flat single-triangle wings with black tips still read as blades (`r9_08c_sprint_mid.png`, x 700–900, y 340–560).

**Fix:** as in C r8 #6.

### 7. Minor — The catch shot (`11`) is unchanged (1.1% diff)

- The skier is cut off at the waist and seen from behind.
- The water is a thin band.
- The podium is a row of toy blocks at x 825–1175, y 505–570.

### 8. Minor — Victory details unchanged for the sixth round (F-042 open, F-032 partial)

- `11g`: the trophy hides the presenter's head.
- `11h`: the cylindrical splash crown.
- `11f`/`11f2`: the cut-out cod.
- `11j`: the bather on the roof ridges.
- The waterfront row is one gable model in one line.
- `11c`: the chute groove.

All are pixel-stable against round 8.

### 9. Minor — Carry-overs and evidence notes

- **`08d`:** still no falling ice (`PORTAL = false`, `seaCave.ts:42`), so the manifest note "the lintel icicles drop and shatter" describes something that does not happen.
- **`07b` (Sprint and Standard):** the translucent wedge seam across the snow (x about 950–1110, y 210–670) remains.
- **`07b`:** the far slope's shadow is blocky (x 1100–1600, y 0–200).
- **Notes to fix:**
  - the `08c` manifest note "gulls burst off the basalt portal": they burst off boulders;
  - the Standard `08` note "the Yeti against the fjord": there is no fjord in that frame.

### What I could not verify

- Motion, camera smoothness and audio sync.
- The 3.8–7.9 s dark/eyes shots, and whether the jamb artefact (#1) shows from inside the chamber.
- The reveal on screen.
- Whether the Yeti is grounded at his first visible frame (now in the uncaptured 3.8–7.9 s window). In `standard/08` and `08` his feet are planted on the snow.

## 5. What works

- **The gull beat is now a real beat on every length:** a flock lifting off the boulders, under the caption, with no early Yeti (`08c`, `standard/08c`; probe 18/18).
- **The Standard emergence is clean.** `standard/08` has no snow wedge, and the Yeti is planted beside the frozen pool.
- **The Sprint encounter is still strong:**
  - `08`: the Yeti beside the mouth, over the fjord and islands;
  - `08b`: the leap against the face, with the sea beyond;
  - `08d`: the roar with sea smoke.
- **Pursuit framing (`09`, `16`)** keeps the sea or the coast in view, with a readable rear-view inset.
- **The ending remains the strongest part of the build:** the quay street, the stockfish racks, the plunge in water that reads as water, and the closing fjord reveal (`11c`).

## 6. Round-8 defects and tracker items (my own verification)

| Round-8 C # / tracker | Status | Basis |
|---|---|---|
| #1: gull shot shows the Yeti before his growl (regression) | **Fixed** | Both `08c` renders; probe 0/18 (was 9/9). Residual risk: defect 5 |
| #2 / F-037: no gulls on Standard caves | **Fixed** | `standard/08c`; probe ≥ 3 in frame 18/18; in flight 10/10/10/10 on Standard |
| #3 / F-038: reveal never shows the cave, closing frame near-dry | **Not fixed (partial as before)** | Code identical; defect 3 |
| #4 / F-024: Yeti and sea never share a frame on the default course | **Not fixed**, now confirmed on screen | `standard/08`, `08d`, `08b`; defect 2 |
| #5 / F-040: boulders perched | **Partial** | Undersides hidden; no contact shading; slivers (defect 4). Collision is B's area |
| #6: gull model in close-up | **Partial** | Farther from the lens (8.4 m); same model (defect 6) |
| #7 / F-025: catch shot | **Not fixed** (unchanged since round 7) | `11`, 1.1% diff |
| #8 / F-042: victory details | **Not fixed** | Defect 8 |
| F-032: repeated houses / regimented waterfront | **Partial** (unchanged since round 8) | `11j`, `11h` |
| #9: carry-overs (falling ice, `07b` seam, harbour islands) | **Not fixed** | Defect 9 |
| F-023: lintel and props floating | **Regressed (new instance)** | A floating shard in the Sprint mouth from the jamb cap (defect 1) |
| Round-9 claim: no white snow wedge in the Standard jamb | **Fixed** | `standard/08` |
| F-003: black cave / controlled darkness | **Still fixed** | `07`, `08`, `08d`, Standard set |
| F-005: plunge water reads as snow | **Still fixed** | `11b`, `11h`, `11j` (pixel-stable) |

## 7. Public-preview gate (completion brief §10) — my area

| Gate item | Status | Evidence |
|---|---|---|
| No critical defect or unrecoverable state in the cave cinematic or the victory | **met** | No Critical. The reveal camera stays clear (code unchanged since round 8's sweep) |
| No major regression in a signature cinematic | **met for the captured cinematic frames** | The round-8 regression (early Yeti) is fixed. The new jamb artefact (defect 1) is in the cave's approach view, not in a captured cinematic frame. It counts against 9/10, and the 3.8–7.9 s interior shots are unverified |
| Cave: natural irregular opening, controlled darkness | **met** | `07`, `standard/07`, `08d` |
| No floating props or clipping in the cave | **not met** | A new floating shard and holes in the Sprint mouth (defect 1); flake-shaped boulders (defect 4) |
| Yeti grounded from his first visible frame | **not evidenced** | His first visible frame is not captured |
| Coastal reveal in the encounter (sea, cliffs, birds, mist, sound) | **met on Sprint; not met on Standard** | Birds are now present on every length. On the default course the rendered cinematic has no sea, and the reveal is unrendered with no cave (defects 2–3) |
| Water that is not snow | **met** | `11b`, `11h`, `11j` |
| Buildings not floating or repeated | **partially met** | Not floating; one model in a line |
| Trophy staging | **partially met** | `11`, `11g` |
| No inland-facing shots | **met in the victory; not met in the Standard cave sequence** | Defect 2 |
| Fish gag | **met (minor polish)** | `11f`, `11f2` |
| Ending on the ocean and mountain reveal | **met** | `11c`, `11i` |

**Gate result for my area:**
- **Preview gate items:** met, narrowly. No Critical, and no regression in the captured cinematic frames.
- **Full approval (9/10):** **not met.** Four Majors remain:
  - the jamb artefact (new);
  - Yeti and sea never together on the default course;
  - the reveal never shows the cave and is never rendered;
  - the boulders.
- The gate is not lowered.
