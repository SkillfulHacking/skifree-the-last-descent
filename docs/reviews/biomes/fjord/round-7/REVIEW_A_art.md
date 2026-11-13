# Fjord Coast, Round 7: Reviewer A, art direction

- **Reviewer:** A (art direction).
- **Nature of review:** model-based reviewer, same model family as the developers; not an external human.
- **Build:** `7b0a5bc` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`; HEAD = `7b0a5bc` at review time).
- **Date:** 2026-11-13.

**Method**
- I viewed all 31 Round-7 candidate PNGs at 1920×1080 with the Read tool. The changed shots (`01`, `06`, `07`, `08`, `08b`, `08c`, `08d`, `11`) I viewed at full size. The rest I viewed on half-resolution contact sheets (`scratch/review-a-r7/sheet1–6.png`).
- I compared each shot with Round 6 (`round-6/candidate/`, build `5c28419`):
  - per-shot pixel difference, threshold 12/255 (`scratch/review-a-r7/d.py`);
  - region difference (`m.py`);
  - side-by-side images (`sbs_*.png`).
- Zoomed crops: `06_right_2x.png`, `07_left_2x.png`, `07_right_2x.png`, `01_sea.png`, `sbs_03_far_2x.png`, `11_leftwall_2x.png`, `08b_yeti_3x.png`.
- Source diff `5c28419..7b0a5bc`: `scanIslands.ts`, `seaCave.ts`, `seaCaveCinematic.ts`, `seaFraming.ts`, `harbourVictory.ts`, `cliffStream.ts`, `rockMaterial.ts`.
- `npx vitest run tests/unit/fjord_art.test.ts tests/unit/fjord_reveal.test.ts`: 8/8 pass.
- The file times of the PNGs (01:27–04:37) are all after the commit time of `7b0a5bc` (01:21). That is consistent with the claim that they were captured from this build.

**Evidence missing at my final check** (the third round running for most of these):
- `candidate/EVIDENCE.md` and `candidate/manifest*.json`. Camera, phase and z for each shot are unverified.
- `candidate/res-1366/`, `candidate/res-2560/` and `candidate/standard/`.
- Every extra beat after `12` (no `12b`, `13`, `14` or `15`). `12_wind_gate_gust.png` arrived at 04:46, during my final check, and is reviewed below.
- `candidate/perf/` and `round-7/TESTS.md`.
- No shot of the new cave-cinematic coastal reveal (the low-over-the-water pose at 7.9–9.2 s). The art of that pose is therefore unverified; only its unit test (`fjord_reveal.test.ts`, water fraction ≥ 0.1) exists.

## 2. Verdict: **FAIL** (against 9/10; also below the ≥ 8 art-direction bar for a public preview)

This round did what Round 6 asked for in the cave and at the catch, and it did it well:
- The monolith, the grey drums, the card, the fish bones and the detached icicles are all gone (`07`, `08`, `08c`).
- `08` is now the best cave frame of the series. The Yeti stands at an irregular mouth, with the skerries, the open sea and the harbour beyond (`08` x 0–680, y 190–650).
- The catch shot `11` finally looks down to the quay, the water and the islands.
- The menu has its islands back.

But almost nothing outside those three views changed:
- The `06` white slab and the floating dark disc are still there; the region changed by 5 %, mostly the islands near it.
- The same kind of untextured white folded plate now appears in the **first frame of the game**: the menu (`01` x 1460–1920, y 540–670).
- The harbour headland still has its smeared vertical snow streaks: 0.00 % of pixels changed in the measured regions of `10` and `11c`. The new catch framing now puts that headland large in the hero trophy frame (`11` x 0–430, y 120–420).
- The cliff "pinstripe" that `d1b1171` claims to fix changed by 0.00 % in `06`.
- Unchanged pixel for pixel in the measured regions: the summit sugarloaf, the inland boulder confetti, the slug-shaped scoured rock and the absent foam.
- The cave boulders are "bedded" in code, but on screen they still sit on the snow with no lip or contact shadow (`07`).

Four of the named §4 failures remain on screen:
- snow on vertical ocean cliffs;
- stretched forms;
- repeated boulders;
- pillow rocks.

The art direction stays at 7.5.

## 3. Scores (out of 10, from an art-direction point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **7.5** | Every Round-6 cave regression except boulder seating is fixed, and `08` and `11` are real gains. Against that: the `06` slab and disc are unfixed and the same artefact now greets the player in the menu. The harbour-wall streaks (open since Round 3) are now centre-stage in the trophy shot, and the sugarloaf, foam and confetti have not changed. |
| Environmental uniqueness | **8** | The scanned skerries, the open-sea cave frame (`08`, `08b`) and a catch shot with quay, water and islands (`11`) carry the Fjord identity. The summit, the inland walls (`02`, `07b`, `09`) and the boulder-sprinkled slopes still read as Alpine. |
| Skiing and hazard mechanics | 6.5 (low confidence) | Visual read only. `04`, `04b`, `04c` and `09d` are unchanged (≤ 1.4 % of pixels differ; 0.00 % in the `04b` slab region). The slug slabs and blurred scoured rock remain. |
| Difficulty and fairness | 7 (low confidence) | Outside my area. The runs read openly. |
| Cinematics | 7 | Up from 6.5. `08` is clean and has the sea, the debris is gone, and `11` faces the water. Still wrong: the Yeti in `08b` is mid-air in front of a blank face, there are no gulls visible in the gulls beat `08c`, and the reveal `11c`/`11i` and plunge `11j` are unchanged. The new coastal-reveal pose was not captured. |
| Performance and stability | 7 (low confidence) | Not measured by me, and `perf/` is absent. The captures show no corruption. |
| Accessibility and controls | 7 (low confidence) | Captions are legible (`08c`, `08d`, `09`, `09d`, `11f2`). The art at 1366 and 2560 is unverified (no `res-*`). |
| Overall player experience | **7.5** | The cave set piece is clean again, and the catch now lands at the sea. But the first frame (menu) and the last frames (finish, trophy, reveal) still show the white slab, the streaked headland and the unchanged reveal massif. |

## 4. Defects

### Critical
**None.** No missing assets or broken rendering in the shots. The absent resolution and Standard evidence is a gate gap (§7).

### Major

**A7-M1 (carried from A6-M1, not fixed; spread to the menu). White untextured folded slab and floating flattened disc on the water.**
- Evidence:
  - `06` x 1580–1920, y 720–990 (`06_right_2x.png`): unchanged in shape. The folded white plate with a grey cut face and a white fin is still there, and so is the dark lens-shaped "canoe" disc at x 1745–1880, y 875–930. 5.37 % of pixels changed in the region, mostly the small islands above it.
  - **NEW, `01` menu** x 1460–1920, y 540–670 (`01_sea.png`): a chain of white, crumpled, untextured planes on the water, with a small flattened grey disc at x 1355–1410, y 555–575. This is the player's first image of the game.
- Cause analysis:
  - The `scanIslands.ts:150–157` 1:4 aspect clamp did not change these objects.
  - They are most likely not scans: they look like coast-heightfield land that the scan pass rejects (`hc > water + 1` or `landy`) and that is still drawn above the water with the snow shading.
  - The disc may be a skerry scan whose height `h` is itself tiny. The clamp limits the footprint to 4 h, but a 4:1 lens sunk by `0.18 h` still reads as a hull.
- Fix:
  - Find these meshes by name in a debug capture of `01` and `06` (the scans are named `island-*`).
  - Wherever the scan pass rejects a blob, push the heightfield there below `water − 2`, or always put a scan on it.
  - Give skerry scans a minimum absolute height (for example ≥ 3 m) as well as the aspect clamp.
  - Re-capture `01` and `06`.

**A7-M2 (carried from A6-M4, not fixed; now more prominent). Snow streaks and a stretched texture on the vertical harbour headland. F-028 OPEN since Round 3.**
- Evidence:
  - `10` x 760–960, y 180–420 and `11c` x 1480–1840, y 780–950: 0.00 % of pixels changed against Round 6.
  - **`11` x 0–430, y 120–420** (`11_leftwall_2x.png`): the new catch framing puts this face large behind the hero pair. It is a smooth, vertically smeared grey with four white vertical strips running to the waterline. There is no rock texture and no wet band.
  - Also visible in `10b`, `11b`, `11d`, `11g`, `11h`, `11j`.
- This is the brief's named failure "snow on vertical ocean cliffs" plus "stretched textures", and it now sits in the frame where the trophy is handed over.
- Fix:
  - Find out which material draws the headland. It is not `cliffStream` (whose change had no effect anywhere I measured), so it is probably the coast heightfield's `snowMaterial`, with planar UVs on a near-vertical face.
  - Replace it with the triplanar `rock_face_03` (`snow: 0` above a slope of about 55°, and a wet band at `uWater`), or run the cliff kit behind the hamlet.

**A7-M3 (carried from A6-M5, not fixed). Summit sugarloaf blocks the sea vista. F-029 OPEN.**
- Evidence: `02` x 900–1470, y 280–640. 1.13 % of pixels changed (the islands behind it).
- Fix: as before. Lower or shift the dome, or make it an asymmetric headland with a rock face on the seaward side.

**A7-M4 (carried from A6-M6, not fixed). No foam ring and no wet band at the waterline of the islands, the cliff kit or the harbour wall. F-031 partial.**
- Evidence:
  - `sbs_03_far_2x.png`: the islands still meet the water with a hard cut and dark drip marks.
  - `06`: the cliff-kit foam is the same constant chalk line.
  - `11` (`11_leftwall_2x.png`): the headland meets the quay water with no wet band.
- None of the round's commits touches foam.
- Fix: add a foam ring at the island footprints (a decal, or a term in the water shader based on distance to the island mask) and a darkened, glossy band of 1–3 m above `uWater` on every rock material.

**A7-M5 (carried from A6-M7, not fixed). Repeated boulder chips on the inland walls. F-032 OPEN.**
- Evidence:
  - `02` x 0–330, y 0–600: 0.00 % of pixels changed;
  - `09` and `09b` left wall;
  - `07b` top band;
  - `11h` and `11j` above the houses.
- Fix: cluster the chips in gullies, vary their scale 3–5× and leave most faces bare. Or use a few scans as talus.

**A7-M6 (carried from A6-M3, partial). Cave boulders are not seated in the snow and are still laid out in lanes.**
- What is fixed: the drums, card, bones and sprite props are gone (`07`, `08`). `seaCave.ts:391` now sinks the boulders by `r*0.5`.
- What remains:
  - On screen the boulders still sit on a flat snow plane, with no drift lip, no contact darkening and their undersides showing. In `07` x 1005–1170, y 875–960 (`07_right_2x.png`) the large slab clearly reads as hovering. `07` x 320–440, y 765–815 looks the same.
  - The layout is still two parallel lanes flanking the approach (`07` x 320–560 and x 930–1100).
  - Small loose white shards remain: `07` x 1085–1100, y 1005–1035; x 1050–1062, y 815–828.
  - `08` (x 415–840, y 500–860) reads better because of the steeper view, but still has no contact shadow.
- Fix: add a snow lip, or a darkened ring decal in the snow, at each boulder's intersection line. Scatter the boulders in 2–3 clumps rather than lanes, and delete the shard sprites.

### Minor

- **m1 (carried from A6-M9, downgraded). Pale parapet rim in `05`.**
  - Evidence: `05` x 1100–1920, y 640–1050; 0.17 % of pixels changed.
  - With the monolith and drums gone, this is the last "concrete" read.
  - Fix: put the rock material on the rim ledge.
- **m2 (carried, C's area). `08b`: the Yeti hangs mid-air in front of the face.**
  - Evidence: `08b` x 1200–1330, y 460–610 (`08b_yeti_3x.png`). It is in a leap pose about 60 px above the snow and 200 px left of the mouth, with no ledge or launch point in frame.
  - Fix: either frame the take-off ledge, or time the shot to the landing.
- **m3 (NEW). Faceted low-poly hillside exposed by the new `08`/`08b` framing.**
  - Evidence: `08` x 0–210, y 230–650; `08b` x 0–300, y 520–940. Flat-shaded triangles in grey and white.
  - Fix: use the snow/rock material with smooth normals on the far-field mesh, or pick a framing that keeps it out.
- **m4 (carried from A6-m3, partial). Flat white snow plates on distant islands.**
  - Evidence: `03` x 700–815, y 255–290 (`sbs_03_far_2x.png`). The plates are slightly smaller now that `snow` is 0.85 and `snowFrom` 0.7, but they are still flat.
- **m5 (carried from A6-m4, not fixed). Horizontal ripple pinstripe on the upper cliff.**
  - Evidence: `06` x 500–1100, y 330–620. 0.00 % of pixels changed. The vertical luminance profile has 82 sign changes in 219 rows (Round 6: 83).
  - Both the `cliffStream.ts:163` change (no Cliff Side macro) and the `rockMaterial.ts:315` change (`rkBand2`) are invisible here. Either this wall is not drawn by `cliffStream` (`artCoast.ts:81` uses `gneiss`), or the stripe is geometric terracing.
  - Fix: find out which mesh and material draws it before the next attempt.
- **m6 (carried). Reveal massif mush, crater ring and terracing.**
  - Evidence: `11c` x 1180–1330, y 470–560; `11i`. Unchanged (0.49 % and 0.07 % of pixels changed).
- **m7 (carried). Scoured-rock slug shapes and shards.**
  - Evidence: `04b` x 590–1040, y 610–705 (0.00 % of pixels changed); `09d` y 780–1080 is blurred.
- **m8 (carried). Pillow rocks on the piste.**
  - Evidence: `12` x 0–480, y 200–330 and x 1060–1360, y 240–340; `12` x 295–430, y 700–770 (a smooth white wedge); `04`.
- **m9 (carried). Harbour houses: repeated rows, loose on the snow, flat walls.**
  - Evidence: `10`, `11h`, `11i`, `11j`.
- **m10 (carried). Leopard-spot plaza.**
  - Evidence: `10b` x 0–960, y 300–540 (sheet4). In `11` the foreground is smudged grey snow.
- **m11 (carried). Menu ray streaks on the water and the card rock.**
  - Evidence: `01` x 880–1900, y 500–950; x 750–810, y 950–1060.
- **m12 (carried). `07b` outlook: no fjord, a hard sheet-shadow edge, and the "lightning-bolt" ice decal.**
  - 0.12 % of pixels changed.
- **m13 (carried). Hamlet strand reads as a raft.**
  - Evidence: `06` x 520–735, y 755–830.
- **m14 (carried). Glass-cylinder splash rim (`11h`) and matte plunge water (`11j`).**
  - 0.10 % and 0.00 % of pixels changed.
- **m16 (carried from A6-m13). Rectangular patch edge on the snow.**
  - Evidence: `12` x 1130–1920, y 830–900.
- **m15 (NEW, C's area). No gulls are visible in the gulls beat.**
  - Evidence: `08c`. The caption reads "[gulls scream and scatter]", but no bird can be seen in frame. The gulls now perch on the boulders (`d1b1171`), which are out of this framing.

## 5. What works

- **`08` emergence.** An irregular, naturally dark mouth, a grounded Yeti on the ice pool, and the skerries, open sea and harbour beyond. No props or clutter. This is the frame the brief asked for.
- **Cave cleanup (`07`, `08`, `08c`, `08d`).** The monolith, drums, card, bones and floating icicles are all gone, and the face reads as natural rock.
- **Catch shot `11`.** It now looks over the quay to water, islands and festoon lights. The inland-facing defect from Rounds 4–6 is fixed.
- **Menu islands are back (`01`).** The re-placement on load works (`scanIslands.ts:104–106`), apart from the slab chain (A7-M1).
- **The scanned archipelago (`03`, `09`, `09d`, `11e`)** is still the strongest identity element of the run.

## 6. Status of earlier defects (my own verification)

### Round 6 (`round-6/REVIEW_A_art.md`)

| # | Defect | Status | Evidence |
|---|---|---|---|
| A6-M1 | `06` white slab and floating disc | **Not fixed** (and seen in the menu) | A7-M1. |
| A6-M2 | Cave monolith | **Fixed** | `sbs_07_yeti_cave.png`, `sbs_08_yeti_cinematic.png`; `PORTAL = false` (`seaCave.ts:42`). |
| A6-M3 | Floating cave props, ungrounded boulders | **Partial** | The props are removed. The boulders are still unseated and in lanes, and the shards remain (A7-M6). |
| A6-M4 | Harbour cliff snow streaks | **Not fixed** (now more prominent) | A7-M2. 0.00 % of pixels changed. |
| A6-M5 | Summit sugarloaf | **Not fixed** | A7-M3. |
| A6-M6 | No foam or wet band | **Not fixed** | A7-M4. |
| A6-M7 | Repeated inland boulders | **Not fixed** | A7-M5. |
| A6-M8 | Catch shot inland | **Fixed** | `11`: quay, water and islands behind the pair (`harbourVictory.ts:150–163`). |
| A6-M9 | Concrete-looking basalt | **Mostly fixed** | Monolith and drums gone. The rim remains (m1). |
| m1 | Icicles detached from the brow | **Fixed** (removed) | `08c`, `07`. |
| m2 | Menu islands missing | **Fixed** | `01`, with the A7-M1 slab residue. |
| m3 | Flat snow plates on distant islands | **Partial** | m4. |
| m4 | Ripple pinstripe | **Not fixed** (claimed fixed) | m5. 0.00 % of pixels changed. |
| m5 | Reveal mush | **Not fixed** | m6. |
| m6 | Scoured-rock shapes | **Not fixed** | m7. |
| m7 | Pillow rocks | **Not fixed** | m8. |
| m8 | Houses | **Not fixed** | m9. |
| m9 | Leopard plaza | **Not fixed** | m10. |
| m10 | Menu streaks and card rock | **Not fixed** | m11. |
| m11 | `07b` outlook | **Not fixed** | m12. |
| m12 | Hamlet raft | **Not fixed** | m13. |
| m13 | Rectangular snow patches | **Not fixed** | `12` x 1130–1920, y 830–900: the straight patch edge is still there. |
| m14 | Splash rim and matte water | **Not fixed** | m14. |

### Tracker items in my area (`DEFECTS.md`; no Round-7 rows have been added)

| ID | Claimed | My verification |
|---|---|---|
| F-008 | CLAIMED | **Partial.** The harbour streaks remain (A7-M2). |
| F-009 | CLAIMED | **Largely fixed by the scans.** The `06` and menu slabs are open (A7-M1). |
| F-010 / F-030 | CLAIMED | **Mostly fixed.** The shapes remain (m7). |
| F-011 | CLAIMED | **Mostly fixed** (the cave basalt props were removed). The rim remains (m1). |
| F-012 | CLAIMED | **Partial** (m13). |
| F-013 / F-031 | CLAIMED | **Not fixed** (A7-M4). |
| F-016 | VERIFIED (E r4) | **Unverified by me:** `res-2560/` absent. |
| F-023 | CLAIMED | **Mostly fixed.** Boulder seating and shards remain (A7-M6). |
| F-025 | CLAIMED | **Fixed** (`11`). |
| F-026 | CLAIMED | **Not fixed on screen** (m5). |
| F-027 | CLAIMED | **Mostly fixed.** Mush remains (m6). |
| F-028 | OPEN | **Open, confirmed** (A7-M2). |
| F-029 | OPEN | **Open, confirmed** (A7-M3). |
| F-032 | OPEN | **Open, confirmed** (A7-M5, m9). |

## 7. Public-preview gate (completion brief §10): items in my area

| Gate item | Status | Evidence |
|---|---|---|
| Art direction ≥ 8 | **Not met** | My score is 7.5. Six Majors are open, five of them carried unchanged. |
| §4 named failures absent | **Not met** | **Not met:** snow on vertical ocean cliffs (A7-M2); stretched forms (A7-M1, A7-M2); repeated boulders (A7-M5); pillow rocks (m8). **Largely met:** loaf / cake / cylinder islands (scans; slab residue A7-M1); needle crests (m6 residue). **Met:** concrete or cylinder basalt in the cave. **Partial:** terrain/cliff seams (the `06` pinstripe, m5). |
| Foam and wet rock at the waterline | **Not met** | A7-M4. |
| Varied coves and natural island silhouettes | **Partial** | The island silhouettes are natural (`03`, `09d`). The `06` coastline is still long and straight. |
| No snow-coloured water in the victory | **Met** | `11`, `11d` and `11j` read as water (`11j` is matte). |
| Poly Haven materials and models used meaningfully | **Partial** | The scans and `rock_face_03` are used on the islands, the cave shell and the boulders. The harbour headland, the parapet rim and the `06`/`01` slabs do not use them. |
| Art verified at 1366×768 and 2560×1440 | **Not met (no evidence)** | `res-1366/` and `res-2560/` were absent at my final check. |
| Standard-course cave art | **Not met (no evidence)** | `standard/` was absent. |

**Bottom line: the gate is not met on art direction.** The shortest route to an 8:
1. Put real rock material on the harbour headland (A7-M2). It is the oldest open Major, and it is now in the trophy frame.
2. Remove the white heightfield slabs and flat discs from `01` and `06` (A7-M1).
3. Add foam rings and wet bands (A7-M4).
4. Seat the cave boulders and break up their lanes (A7-M6).
5. Fix or reshape the sugarloaf (A7-M3).
6. Deliver `EVIDENCE.md`, the manifests, `res-*`, `standard/`, `12` and the coastal-reveal shot.
