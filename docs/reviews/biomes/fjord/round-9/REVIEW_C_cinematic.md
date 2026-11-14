# Fjord Coast — Round 9 — Reviewer C: Cinematics (final)

- **Reviewer:** C, cinematics
- **Nature of review:** model-based reviewer (same model family as the developers; not an external human)
- **Build:** `3bf5a7e` (branch `pass4-fjord`).
  - The worktree HEAD `564cd5b` has identical `src` and `tests`.
  - `git diff e0e2eca 3bf5a7e -- src` touches only `src/world/caveTerrain.ts`: the jamb cap's reach `cd < 2.6` → `cd < JAMB_CAP.cd = 1.6`, and its `u` ramp shortened.
  - `git diff c9ffd1b 3bf5a7e -- src` touches only that file. I checked both diffs myself.
- **Preliminary review:** on `e0e2eca`, in `round-9/prelim-e0e2eca/REVIEW_C_cinematic.md`. This report replaces it.
- **Date:** 2026-11-14

## 1. Evidence used and gaps

- **Images viewed:**
  - the re-rendered cave and cinematic shots on `3bf5a7e`, for both Sprint and Standard (`07`, `07b`, `08`, `08b`, `08c`, `08d`);
  - from the `c9ffd1b` set: `09`, `11`, `11c`, `11g` and `16`.
- **Pixel diff against round 8** (`scratch/review-c-r9/diff9.py`; a pixel counts as changed if any channel moves by more than 8/255):
  - Sprint `07` 2.1%, `07b` 0.7%, `08` 3.2%, `08b` 2.1%;
  - `08c` 68.7% (new gull shot);
  - `08d` 32.3% (particles and mist; same pose);
  - victory `11`–`11j` 0.6–2.3%, so it is unchanged for the sixth round.
- **Byte-identical since round 8** (`git diff --quiet d1f642b 3bf5a7e`): `harbour.ts`, `harbourVictory.ts`, `seaFraming.ts`, `src/cinematic/**` and `src/yeti/**`.
- **Source read:**
  - `seaCaveCinematic.ts`: gull shot, lines 162–193;
  - `seaCave.ts`: boulder bedding, colliders, shared geometry;
  - `caveTerrain.ts`: jamb cap, both versions.
- **Tests:**
  - `fjord_reveal.test.ts` and `fjord_art.test.ts`: 8/8 pass on `3bf5a7e`.
  - `round-9/TESTS.md`: 311/311 unit tests on `3bf5a7e`; all 19 browser tests pass on the candidate's code. That includes the full loop through the cave cinematic and the victory (#2), which ran on `e0e2eca`, differing only in the cap.
  - No test covers the gull shot or the jamb cap.
- **My probes** (`scratch/review-c-r9/`, headless, against the shipped modules, re-run on `3bf5a7e`):
  - **`gullshot9.test.ts` → `gullshot9.txt`.** It builds the real dressing and rebuilds the shipped gull-shot pose on **18 caves**:
    - Classic Sprint (high and low quality), Classic Standard (high and low) and Classic Endurance (2 caves);
    - 8 Standard seeds (S7X1, S7X5, S7X8, S7X14, S7X17, S7X24, R6A, C4G);
    - Endurance E7X0 and E7X3 × 2 caves.

    It simulates the shipped gull flight at 60 Hz inside the cinematic letterbox, and measures: gulls in frame, the nearest gull to the lens, camera clearance, the mouth in frame, and the Yeti's head in frame with terrain line of sight at 2.4, 3.0 and 3.6 s (shared exit-path placement).
  - **`jamb9.test.ts` → `jamb9.txt` (`e0e2eca`) and `jamb9_3bf5a7e.txt`.** It measures how far the cap lowers the heightfield against the pre-cap `c9ffd1b` function, on a 0.5 m grid around 6 caves, and projects the lowered points into the exact `07` camera.
  - **Crops:**
    - `r9_07_mouth_r8_vs_r9.png`: the `e0e2eca` artefact;
    - `r9b_07_mouth_r8_vs_3bf5a7e.png`: the fixed Sprint mouth;
    - `r9b_07std_mouth.png`: the Standard mouth;
    - `r9_08c_sprint_mid.png` and `r9_08c_std_gulls.png`: the gull shots;
    - `r9_07std_boulders.png` and `r9_08_sprint_boulders.png`: the boulders.
- **Gaps:**
  - The coastal reveal (7.9–9.2 s) is **still not rendered on any course**.
  - No frame from 3.8 to 7.9 s (the dark interior and the eyes) was captured.
  - I could not judge motion or audio sync.

## 2. Verdict — **FAIL** (Cinematics 8.5/10 against the 9/10 target; up from 8 in round 8)

**What round 9 fixed (I checked each one myself):**
- **The gull beat no longer reveals the Yeti early.** He is absent from `08c` and `standard/08c`. Probe: his head is in frame with line of sight on **0/18** caves (round 8: 9/9).
- **The gull beat works on the default course.**
  - On screen: `standard/08c` shows the flock lifting off the boulders under the caption.
  - Probe: **≥ 3 gulls in frame at 2.4 s and ≥ 2 in flight through the beat on 18/18 caves**. On Standard caves 10/10 gulls stay in frame for the whole beat (round 8: 0 on 7/7).
- **No white snow wedge in the Standard mouth.** `standard/08` and `standard/07` both have a clean jamb.
- **The preliminary review's new regression (shard and holes in the Sprint mouth) is fixed.**
  - The Sprint mouth in `07` now matches round 8 (crop `r9b_07_mouth_r8_vs_3bf5a7e.png`).
  - The cap now lowers the ground by at most 2.4 m (Classic) to 4.1 m (S7X5, S7X17), at 6–8 grid points per cave. On `e0e2eca` it was 9–13 m at 29–35 points.
  - No captured frame shows a hole or shard.
- **The boulders are bedded deeper**, so their undersides no longer show.

**Why it still fails:**
- **On the default course the Yeti and the sea never share a frame.** The rendered Standard frames confirm it: `standard/08`, `08d`, `08b` and `08c` show no water.
- **The coastal reveal is unchanged:** byte-identical code, the cave is never in it, its closing frame is near-dry on about 25% of caves, and it has never been rendered.
- **The boulders still read as placed props**, with no contact shading and with sliver and flake shapes.
- **The victory is untouched for the sixth round.**

## 3. Scores

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **7.5** | The cave mouth is clean again on both lengths. The boulders are bedded but still pasted on, with flake and plank shapes (`r9_07std_boulders.png`). The victory podium and catch shot are unchanged. The Sprint encounter frames (`08`, `08b`, `08d`) remain handsome. |
| Environmental uniqueness | **8** | The harbour, quay, stockfish, plunge and closing fjord reveal are clearly not Alpine. The default-course encounter, now seen on screen, is rock, snow and a frozen pool, and could sit in any biome. |
| Skiing and hazard mechanics | **7** (low confidence) | Stills only. Not my area. |
| Difficulty and fairness | **7** (low confidence) | Not assessed. |
| Cinematics | **8.5** | Up: the gull beat is fixed on every length and no longer spoils the Yeti, and the mouth regression was fixed within the round. Down: the default-course encounter is entirely inland on screen; the reveal is unchanged and unrendered; the boulders; the victory is frozen. |
| Performance and stability | **8** (low confidence) | `TESTS.md`: 311 unit and 19 browser tests pass, including the full loop through the cinematic and the victory. The developers' CPU numbers (`EVIDENCE.md`, measured on `e0e2eca`) show p99 11.9 ms and no frame over 33 ms. I did no profiling. |
| Accessibility and controls | **7.5** (low confidence) | "[gulls scream and scatter]" now matches the picture on every length. I did not check the rest. |
| Overall player experience | **8** | A Standard player now gets a readable gull beat and a clean emergence. The encounter still never says "sea cave" on the default course, and the ending is still the best part. |

## 4. Defects

**No Critical defects found in my area.**

### 1. Major (carried; F-024 core) — On the default course the Yeti never shares a frame with the sea; now confirmed on screen

**Evidence:**
- **Rendered Standard frames (`3bf5a7e`):** none contains water.
  - `standard/08` (9.5 s): Yeti, frozen pool, rock wall.
  - `standard/08d` (11.65 s): the roar against the rock face.
  - `standard/08b` (15.0 s): the leap down an inland slope with scree and trees.
- **The gull beat:** it looks along the face toward the piste (`O` = outward = toward the piste), so `standard/08c` is inland too.
- **Code:** `seaFraming.ts` is unchanged, so my round-7 station probe (emergence 0/21, leap 0/21 with the sea on non-Sprint caves) still applies.
- **Manifest:** the notes "the Yeti against the fjord" (`08`) and "spray and sea smoke" (`08d`) describe the Sprint cave only.

**Fix:**
- Add a crane shot above and behind the rim, looking down across the cave to the fjord with the Yeti in it; or let the reveal include the brow and cut to the Yeti from there on the roar.
- Assert that on ≥ 90% of finite-length caves some shot from 7.9 to 16 s has the Yeti at ≥ 10% of frame height with ≥ 0.10 water.

### 2. Major (carried; F-038 partial) — The coastal reveal never shows the cave, its closing frame is near-dry on about 25% of caves, and it has never been rendered

**Evidence:**
- The reveal code is byte-identical to round 8, and the only terrain change since then is the cap inside the mouth. My round-8 sweep (`scratch/review-c-r8/sweep8.txt`) therefore still holds:
  - mouth or brow in frame **0/71**;
  - closing-frame water < 0.10 on **18/71** (0.00 on 11);
  - only the opening frame is checked.
- No evidence set captures 7.9–9.2 s.

**Fix:**
- Check both ends of the move (≥ 0.15 water on a ≥ 16×9 grid).
- Put the brow in frame at about `sy` 0.6.
- Add a Standard reveal still to `tools/biome_evidence.mjs`.

### 3. Major (F-040 partial) — Cave boulders: bedded deeper, but still pasted on, with sliver and flake shapes

**What is better:** about two-thirds of each scan is under the snow (`seaCave.ts:394–397`), and the undersides no longer show.

**Remaining:**
- There is no contact shade, drift or collar. The collars from `cd8f1fa` were removed again in `ff41883`.
- The snow meets each rock along a hard line on unmarked snow.
- Cutting the scans at the waist leaves thin flakes:
  - a plank-like sliver at x 300–365, y 915–985 in `standard/07`;
  - a tilted flake at x 1245–1320, y 740–815 in `standard/07`;
  - a tattered all-white lump at x 440–580, y 740–840 in `08` (crop `r9_08_sprint_boulders.png`).

**Fix:**
- Reject scan orientations whose cross-section at the cut height is thinner than about 0.4 r.
- Add a contact-AO decal and a shallow drift skirt.
- Shape the snow caps to the rock's top.

### 4. Minor — The jamb cap still lowers the ground by up to 4 m, with no guard test

**Evidence (`jamb9_3bf5a7e.txt`):**
- The narrowed cap lowers the pre-cap surface by up to 2.4–2.7 m on Classic Sprint, Classic Standard and S7X8, and 4.0–4.1 m on S7X5 and S7X17. That is at 6–8 points per cave on a 0.5 m grid (> 2 m at 1–2 points).
- On `e0e2eca` the wider margin did this by 9–13 m and opened visible holes.
- In the `07` camera the lowered points sit at x 845–1229, y 409–639. They are hidden by the rock jamb in every `3bf5a7e` render I checked (`07`, `standard/07`, `07b`, `08`).
- Other angles and the uncaptured interior shots are unverified.

**Fix:** add a unit test: the maximum height step between adjacent 1 m terrain vertices within 6 m of the mouth stays at or below the `c9ffd1b` value, on every finite-length cave.

### 5. Minor — Gull beat: the mouth sits at the frame's edge, nothing coastal, and no regression test

**Evidence:**
- The code comment (`seaCaveCinematic.ts:186–188`) says the mouth is "well outside the frame behind the camera's shoulder".
- Probe: on **10/10 Standard caves** the mouth centre projects at NDC x **0.96–0.98**, inside the right edge of the frame. In `standard/08c` the jamb and the frozen pool at the mouth are visible at x 1580–1920.
- The Yeti stays hidden (0/18) only because of the oblique angle through the jamb.
- The shot looks up the run, not "out to sea" as the comment says.

**Fix:**
- Move the camera ≥ 20 m along the face, or yaw 10° away from the mouth.
- Add the test asked for in round 8: Yeti head outside the frame at 2.4–3.8 s, and ≥ 3 gulls in frame.

### 6. Minor — The gull model still shows in close-up

The nearest gull is now 8.4 m from the lens on Sprint (probe), and the gull models are smaller in `08c`. The flat single-triangle wings with black tips still read as blades (`r9_08c_sprint_mid.png`, x 700–900, y 340–560).

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

- **`08d`:** still no falling ice (`PORTAL = false`, `seaCave.ts:42`), but the manifest note says "the lintel icicles drop and shatter".
- **`07b` (Sprint and Standard):** the translucent wedge seam across the snow (x about 950–1110, y 210–670) remains.
- **`07b`:** the shadow on the far slope is blocky (x 1100–1600, y 0–200).
- **Notes to fix:**
  - the `08c` manifest note says the gulls burst off "the basalt portal"; they burst off boulders;
  - the Standard `08` note says "the Yeti against the fjord"; there is no fjord in that frame.

## 5. What works

- **The gull beat is now a real beat on every length:** a flock lifting off the boulders under the caption, with no early Yeti (`08c`, `standard/08c`; probe 18/18).
- **Both cave mouths are clean.** `07` and `standard/07`: an irregular opening with controlled darkness. `standard/08`: the Yeti planted beside the frozen pool.
- **The preliminary review's regression was fixed and re-rendered within the round.**
- **The Sprint encounter is still strong:**
  - `08`: the Yeti beside the mouth over the fjord and islands;
  - `08b`: the leap against the face with the sea beyond;
  - `08d`: the roar with sea smoke.
- **Pursuit framing (`09`, `16`)** keeps the coast in view, with a readable rear-view inset.
- **The ending is still the strongest part of the build:** the quay street, the stockfish racks, the plunge in water that reads as water, and the closing reveal (`11c`).

## 6. Round-8 defects, preliminary round-9 defects and tracker items (my own verification)

| Item | Status | Basis |
|---|---|---|
| C r8 #1: gull shot shows the Yeti before his growl | **Fixed** | Both `08c` renders; probe 0/18 (was 9/9). Residual risk: defect 5 |
| C r8 #2 / F-037: no gulls on Standard caves | **Fixed** | `standard/08c`; probe ≥ 3 in frame on 18/18 |
| C r8 #3 / F-038: reveal never shows the cave, closing frame near-dry | **Not fixed** (partial, as in round 8) | Code identical; defect 2 |
| C r8 #4 / F-024: Yeti and sea never share a frame on the default course | **Not fixed**, now confirmed on screen | Defect 1 |
| C r8 #5 / F-040: boulders perched | **Partial** | Undersides hidden; no contact shading; slivers (defect 3). Collision is B's area |
| C r8 #6: gull model in close-up | **Partial** | Farther from the lens; same model (defect 6) |
| C r8 #7 / F-025: catch shot | **Not fixed** | `11` (defect 7) |
| C r8 #8 / F-042: victory details | **Not fixed** | Defect 8 |
| F-032: repeated houses / regimented waterfront | **Partial** (unchanged) | `11j`, `11h` |
| C r8 #9: carry-overs (falling ice, `07b` seam, harbour islands) | **Not fixed** | Defect 9 |
| C prelim-r9 #1: shard and holes in the Sprint mouth (jamb cap) | **Fixed** | `07` on `3bf5a7e`; cap 9–13 m → 2.4–4.1 m. Residual: defect 4 |
| Round-9 claim: no white snow wedge in the Standard jamb | **Fixed** | `standard/07`, `standard/08` |
| F-023: floating props in the cave | **Still fixed** in the captured frames | `07`, `standard/07`, `08`, `standard/08` |
| F-003: controlled darkness | **Still fixed** | `07`, `08d`, Standard set |
| F-005: plunge water reads as snow | **Still fixed** | `11b`, `11h`, `11j` |

## 7. Public-preview gate (completion brief §10) — my area

| Gate item | Status | Evidence |
|---|---|---|
| No critical defect or unrecoverable state in the cave cinematic or the victory | **met** | No Critical. Browser test #2 (full loop through the cinematic and the victory) passes. The reveal camera stays clear (code unchanged since round 8's sweep) |
| No major regression in a signature cinematic | **met** | The round-8 regression (early Yeti) is fixed, and the preliminary round-9 mouth artefact is fixed on screen |
| Cave: natural irregular opening, controlled darkness | **met** | `07`, `standard/07`, `08d` |
| No floating props or clipping in the cave | **partially met** | No floating props or holes in the captured frames. The boulders read as placed, with flake shapes (defect 3) |
| Yeti grounded from his first visible frame | **not evidenced** | The first visible frame (3.8–7.9 s) was not captured. In `08` and `standard/08` his feet are planted |
| Coastal reveal in the encounter (sea, cliffs, birds, mist, sound) | **met on Sprint; not met on Standard** | Birds are present on every length. On the default course the rendered cinematic has no sea, and the reveal is unrendered with no cave (defects 1–2) |
| Water that is not snow | **met** | `11b`, `11h`, `11j` |
| Buildings not floating or repeated | **partially met** | Not floating; one model in a line |
| Trophy staging | **partially met** | `11`, `11g` |
| No inland-facing shots | **met in the victory; not met in the Standard cave sequence** | Defect 1 |
| Fish gag | **met (minor polish)** | `11f`, `11f2` |
| Ending on the ocean and mountain reveal | **met** | `11c`, `11i` |

**Gate result for my area:**
- **Public-preview gate:** met. No Critical, no unrecoverable state, and no major regression in a signature cinematic.
- **Full approval (9/10):** **not met.** Three Majors remain:
  - Yeti and sea never together on the default course;
  - the reveal never shows the cave and has never been rendered;
  - the boulders.
- The gate is not lowered.
