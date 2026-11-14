# Fjord Coast, Round 5: Reviewer A, art direction

- **Reviewer:** A (art direction).
- **Nature of review:** model-based reviewer, same model family as the developers; not an external human.
- **Build:** `e2ce964` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`; `git rev-parse HEAD` = `e2ce964f…` at review time).
- **Date:** 2026-11-12.

**Method**
- Viewed every Round-5 candidate PNG at 1920×1080: `01`–`11j`, `12_wind_gate_gust` and the late `12b_wind_gate_lull`.
- Compared each with Round 4 (`round-4/candidate/`, build `8d19542`):
  - per-shot pixel difference (`scratch/review-a-r5/d.py`);
  - side-by-side images with difference masks (`sbs_*.png`).
- Measured with PIL/numpy (`m.py`): region RGB, and FFT of the cliff face.
- Zoomed crops: `06_mid_2x.png`, `06_foot_2x.png`, `11c_face.png` vs `11c_face_r4.png`, `04b_rock_2x.png`, `07_debris_2x.png`, `08d_column.png`, `12b_patch.png`.
- Read the source diff `8d19542..e2ce964`: `rockMaterial.ts`, `snowMaterial.ts`, `coast.ts`, `hazardViews.ts`, `harbourVictory.ts`.
- Read the `DEFECTS.md` claims F-021…F-035 and treated them as claims to check, not as evidence.
- `npx vitest run tests/unit/fjord_art.test.ts`: 7/7 pass.

**Evidence missing at my final check (16:2x local)**
- `candidate/EVIDENCE.md` and `candidate/manifest*.json`.
- `candidate/res-1366/`, `candidate/res-2560/` and `candidate/standard/`.
- Extra beats 13–15 (only `12b` arrived), `candidate/perf/` and `round-5/TESTS.md`.

So the art at 1366×768 and 2560×1440, the Standard-course cave, and the per-shot camera, phase and z values are **unverified**.

## 2. Verdict: **FAIL** (against 9/10; also below the ≥ 8 art-direction bar for a public preview)

Round 5 is a real but narrow improvement. Four Round-4 Majors are fixed or largely fixed:
- **Floating cave lintel and net:** gone (`07`, `08b`, `08d`).
- **Scoured-rock hazard:** now carries the scanned rock material instead of untextured plates (`04b`, `09d`, `12b`). Foreground rock luminance in `09d` fell from 110 to 81.
- **Needle spikes in the signature reveal:** softened into a rumpled massif (`11c`, `11i`).
- **Woven waffle on the cliff kit (`06`):** gone, and a continuous foam line now rings the kit and the terrain shore.

But 26 of the 33 shots differ from Round 4 in less than 3 % of pixels, and the frames the player sees most are unchanged:
- the harbour wall behind every finish and victory shot still has white snow streaks down a sheer, untextured face;
- the summit still centres on the sugarloaf;
- the islands are still loaves and crumpled lumps;
- the inland walls still carry Alpine's boulder confetti;
- the basalt columns now read as pock-marked precast concrete;
- the cave foreground is still strewn with floating debris;
- the "sea-facing" catch shot (`11`) shows no sea at all.

The foam is a uniform white chalk line with no wet-rock band. A new horizontal ripple pinstripe shows on the upper cliff in `06`.

This is a 7.5 environment, not the 8 the gate needs.

## 3. Scores (out of 10, from an art-direction point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **7.5** | Up from 7. The needles, the plate rock, the floating lintel and the waffle tiling are fixed. Still open: harbour-wall streaks (`10`, `10b`, `11c`, `11d`, `11g`); the summit sugarloaf (`02`); loaf islands (`01`, `03`, `09d`); concrete columns and rim (`08d`, `07b`, `05`); floating cave debris (`07`, `08`, `08b`); a chalk-line foam with no wet band (`06`). |
| Environmental uniqueness | **7.5** | Unchanged. The coast, quay, stockfish, basalt and harbour are unmistakably Fjord (`03`, `09d`, `11b`, `11e`, `08b`). Against that: the summit (`02`) and inland walls (`09`, `09b`) still share Alpine's layout and boulder scatter, and the trophy beat (`11`) could be any snowy town. |
| Skiing and hazard mechanics | 6.5 (low confidence) | Visual read only. The scoured rock now reads as rock at chase range (`09d`), and the windsock telegraph works (`12`, `12b`). The rock is still slug or jet-shaped with paper-thin shards (`04b`), and its near-range texture is magnified and blurry (`09d` y 780–1080). |
| Difficulty and fairness | 7 (low confidence) | Outside my area. Runs are open and readable, and the sea stays in view. |
| Cinematics | 7 | Unchanged from Round 4. The lintel is gone and `08b` remains the best image in the set. Against that: the reveal massif is now rumpled mush with a crater ring above an unchanged streaked harbour wall (`11c`); the catch shot `11` still has no sea; a floating card and log sit in front of the cave in `07`, `08` and `08b`. |
| Performance and stability | 7 (low confidence) | Not measured by me, and `candidate/perf/` is absent. The captures show no corruption. |
| Accessibility and controls | 7 (low confidence) | Captions are legible (`08c`, `08d`, `09`, `11f`). The art at 1366 and 2560 is unverified because `res-1366/` and `res-2560/` are absent. |
| Overall player experience | **7** | A pleasant coastal descent with a charming après. But the summit vista, the harbour wall behind the finale and the cave foreground each still carry a prominent, already-reported failure. |

## 4. Defects

### Critical
**None.** Nothing I can see blocks rendering, and no assets are missing from the shots. The missing resolution and Standard evidence is a gate gap; see §7.

### Major

**A5-M1. Snow streaks on the vertical harbour cliff behind the finish and victory (named failure: snow on vertical ocean cliffs). F-028 OPEN; not fixed since Round 3.**
- Evidence:
  - `10` x 760–960, y 180–420;
  - `10b` x 400–470, y 260–540;
  - `11d` and `11g` (left third of the frame);
  - `11c` x 1480–1840, y 780–950 (crop `11c_face.png`).
- Vertical white strips run down a smooth, untextured, smeared grey face. `10`, `10b`, `11d` and `11g` each differ from Round 4 in ≤ 1 % of pixels.
- Fix: run the cliff kit, or at least the kit's rock material, behind the harbour with the hamlet carve-out. Failing that, zero the snow term on faces steeper than about 65° and apply the rock material there.

**A5-M2. Summit sugarloaf blocks the sea vista. F-029 OPEN; not fixed since Round 3.**
- Evidence: `02` x 900–1470, y 280–640. The symmetric snow dome stands centre-frame between the start and the sea; 1.7 % of pixels differ from Round 4.
- Fix: lower the dome, or shift it off-axis, so the fjord opens behind the start gate. Alternatively, make it an asymmetric headland with a rock seaward face.

**A5-M3. Islands are still loaves, whalebacks and crumpled lumps (named failures: loaf, cake, pillow). F-009 not effectively fixed.**
- `coast.ts` changed: the whalebacks are taller, and a ridged "crag" relief replaced the benches. The shots do not show the change; `01` differs in 0.6 % of pixels and `03` in 1.6 %.
- Evidence:
  - `01` x 1470–1850, y 555–730: the hero island is still a faceted twin-peak lump with snow stretched down its flanks;
  - `01` x 1310–1480, y 555–590: still a flat white saucer;
  - `03`, `05`, `09`, `09d` x 600–1900, y 400–440: rows of near-identical dark whalebacks with white caps, evenly spread to the horizon;
  - `11c` x 20–250, y 720–800: a flat cake;
  - no island has a wet band.
- Fix: as in Round 4.
  - Fewer, larger, asymmetric groups with cove outlines.
  - No near-white tops below the snow line.
  - Darken the lower 1–3 m.
  - Re-capture `01` and `03` so the change can actually be judged.

**A5-M4. Basalt columns and the rim read as concrete (named failure: concrete- or masonry-looking rock). F-011 partial.**
- Evidence:
  - `08d` x 1600–1920, y 380–960 (crop `08d_column.png`): smooth slate-blue faces with regular pinholes and horizontal joint lines, plus one pale tan face, like precast concrete pillars.
  - `07b` x 270–330 and x 770–950, y 200–340: pale, flat, blocky prisms.
  - `07` x 890–1770, y 380–1030: every column has the same girth, is upright, and has a flat snow cap.
  - `05` x 1100–1920, y 640–1050: the rim is still a smooth, pale, concrete-like parapet; 2.5 % of pixels differ from Round 4.
- Fix:
  - Give the columns the Rock Face 03 or Cliff Side triplanar material with darker basalt grading (no pinhole normal).
  - Vary girth by about 1.5×, lean 3–8°, and break or stagger the tops.
  - Give the rim ledge a rock material.

**A5-M5. Floating and ungrounded debris in front of the sea cave (named: floating props). Round-3 m1 / Round-4 m5, not fixed.**
- Evidence:
  - `07` x 430–475, y 755–800: a bent, paper-thin card floating in mid-air (crop `07_debris_2x.png`);
  - `07` x 595–630, y 880–935: an untextured grey log cylinder with no contact;
  - `07` x 860–990, y 990–1050: two untextured grey poles;
  - `07` x 300–480, y 870–965: a crate wreck;
  - the same card is visible in `08` (x 520–610, y 635–710) and `08b` (x 1030–1065, y 750–785).
- Nothing has a contact shadow or a snow lip on the flat blue snow plane.
- Fix: delete the card and the bare cylinders. Bury the remaining wreckage 20–30 % in snow with a drift lip. Give the props textured materials.

**A5-M6. Foam is a uniform chalk line with no wet-rock band (completion brief §4 "Water and coastlines"). F-031 partial.**
- Evidence: `06` cliff foot x 0–1150, y 640–990 (crop `06_foot_2x.png`). The surf is now continuous, a 2–5 px white line along the kit and the terrain. That is an improvement on Round 4's dotted 1–2 px line.
- But it has constant width and brightness and does not break or pool in coves. There is still no darker, glossier wet band above it.
- In code, `rockMaterial.ts` only adds `rkFoam` toward white. No wet darkening was added to the kit material. The terrain `wetRock` term predates Round 4.
- Fix:
  - Modulate the foam width by wave exposure and concavity (wider in coves, broken on headlands).
  - Add a 1–3 m darkened, low-roughness band above `uWater` in `rockMaterial.ts`.

**A5-M7. Repeated boulder chips on the inland walls (named failure: repeated boulders). F-032 OPEN.**
- Evidence: `02` x 0–330, y 0–600; `09` x 0–480, y 0–330 (half-res sheet `sheet1.png`); `09d` x 0–330, y 190–560; `11j` and `11h` upper band; `07b` top band.
- The same pale chips are evenly scattered over planar facets, as in Alpine.
- Fix: as in Round 4. Cluster the chips in gullies and talus cones, vary scale 3–5×, and leave most faces bare.

**A5-M8. The trophy/catch shot faces inland: no sea in frame. F-025 claimed fixed; not fixed in the shot.**
- Evidence: `11` (51.8 % of pixels differ from Round 4, so the shot did change). The frame holds town houses, a flagpole and a snowfield rising to a mountain at right. There is no water anywhere, although `harbourVictory.ts:147–166` says "the quay and the open fjord fill the background".
- This shot is C's area for framing; I list it because the completion brief bans inland-facing victory shots.
- Fix: rotate the profile so the quay and the water lie behind the pair. Verify with a capture.

### Minor

- **m1. New horizontal ripple pinstripe on the upper cliff kit.**
  - Evidence: `06` x 500–1000, y 330–560 (crop `06_mid_2x.png`) shows tight, wavy horizontal contour lines. FFT of x 560–960, y 330–520 gives a 9.5 px vertical period at 1,969× the median high-frequency power (Round 4: 10.6 px, 1,306×).
  - The waffle is gone, but the bedding still stripes at about 1 km.
  - Fix: fade or low-pass the strata term with distance the same way `mFar` does for the macro.
- **m2. The softened reveal massif is now mush, with a crater ring and terracing.**
  - Evidence: `11c` x 1180–1330, y 470–560 (a circular ring, crop `11c_face.png`); horizontal terrace bands at y 560–760 in `11c` and y 380–600 in `11i`.
  - It is better than the needles, but it is not a readable mountain.
  - Fix: a few authored massif forms, or lower-frequency ridged noise.
- **m3. Scoured-rock shapes.**
  - `04b` x 590–1040, y 610–705: the paper-thin pale shards remain (now textured).
  - The main slabs are slug or jet shapes with a beak (crop `04b_rock_2x.png`).
  - `09d` y 780–1080: the near-range texture is magnified and smeared; a finer detail tile or a second detail octave is needed.
- **m4. Pillow rocks on the piste.** White, untextured rounded rocks: `12b` x 300–430, y 700–770; `12`/`04` x 1110–1170; `12b` x 1120–1360, y 315–340.
- **m5. Harbour houses** (Round-4 m2) not fixed:
  - repeated identical rainbow rows in `11i` x 920–1460, y 770–820;
  - loose on snow in `10`;
  - flat untextured walls in `11e`, `11f` and `11f2`.
- **m6. Leopard-spot plaza** (Round-4 m3) not fixed: `10b` x 0–900, y 610–780.
- **m7. Menu** (Round-4 m1) not fixed: ray streaks on the water at `01` x 880–1900, y 500–950; card rock at x 750–810, y 950–1060.
- **m8. `07b` outlook** (Round-4 m4) not fixed: no fjord, a hard sheet-shadow edge, and the "lightning-bolt" crack decal on the tide pool (also `08` x 1200–1590, y 570–750).
- **m9. Hamlet strand reads as a raft** (Round-4 m7) not fixed: `06` x 520–735, y 755–830 shows a flat plate overhanging the water, with a white wedge cut into the cliff.
- **m10. Hard rectangular patch edges on the snow** (Round-4 m12) not fixed: `12b` x 1000–1600, y 570–900 (crop `12b_patch.png`); `12` x 1130–1920, y 830–900.
- **m11. The splash's lower rim reads as a glass cylinder** (Round-4 m9) not fixed: `11h` x 920–1300, y 600–740.
- **m12. Plunge water is still matte and paler than the harbour water.** `11j` y 760–950 is still mean RGB (95, 107, 118), identical to Round 4.

## 5. What works

- **The sea cave without the lintel (`07`, `08`, `08b`, `08d`).** It is a natural, irregular opening in the scanned rock with icicles at the brow. `08b`, the Yeti on the columns with the fjord behind, is still the best image in the set.
- **Scoured rock now reads as rock (`09d`, `04b`, `12b`).** It is dark (81/255 vs 110), cold and textured, and it sits in the coastal composition.
- **Reveal (`11c`, `11i`).** The needle field is gone; the crest now reads as wind-loaded snow.
- **Cliff kit (`06`).** No waffle; benches and buttresses read at range. The continuous foam line is at least visible from the fjord.
- **Harbour après (`11b`, `11e`, `11f`).** Unchanged and still charming.

## 6. Status of earlier defects (my own verification)

### Round 4 (`round-4/REVIEW_A_art.md`)

| # | Defect | Status | Evidence |
|---|---|---|---|
| A4-M1 | Needle crests in the reveal and far massif | **Mostly fixed** | `11c` and `11i` needles gone (`11c_face.png` vs `11c_face_r4.png`). The crest in `06` x 640–1000, y 130–330 still has three sharp horns. The replacement is mush (m2). |
| A4-M2 | Snow streaks on the harbour cliff | **Not fixed** | A5-M1. |
| A4-M3 | Summit sugarloaf | **Not fixed** | A5-M2. |
| A4-M4 | Loaf, cake and saucer islands | **Not fixed** | A5-M3. The code changed, but no visible change in `01` or `03`. |
| A4-M5 | Scoured rock is untextured plates | **Mostly fixed** | Rock material applied. The shapes and shards remain (m3). |
| A4-M6 | Canvas, waffle or concrete rock | **Partial** | Waffle fixed. New ripple pinstripe (m1). Concrete columns and rim (A5-M4). |
| A4-M7 | No foam or wet line | **Partial** | Continuous foam line present. No wet band, uniform width (A5-M6). |
| A4-M8 | Floating lintel; stretched column texture | **Lintel fixed; column face not fixed** | The lintel is gone in `07`, `08b` and `08d`. The pale tan face and concrete read remain on the `08d` column (A5-M4). |
| A4-M9 | Repeated boulders | **Not fixed** | A5-M7. |
| m1 | Menu streaks and card rock | **Not fixed** | m7. |
| m2 | Houses | **Not fixed** | m5. |
| m3 | Leopard plaza | **Not fixed** | m6. |
| m4 | `07b` outlook | **Not fixed** | m8. |
| m5 | Toy columns; floating props | **Partial** | The net is gone. The card, log and poles remain (A5-M5). Columns are still uniform. |
| m6 | Inland-facing beats | **Not fixed** | `11` (A5-M8); `11f2` unchanged (0.2 % of pixels differ). |
| m7 | Hamlet raft | **Not fixed** | m9. |
| m8 | Kit/heightfield seam | **Not fixed** | `06` x 400–750, y 320–540: terraced lines above the kit (`06_mid_2x.png`). |
| m9 | Glass splash rim | **Not fixed** | m11. |
| m10 | Identical stockfish | **Not fixed** | `11e` unchanged (0.6 % of pixels differ). |
| m11 | Matte plunge water | **Not fixed** | m12. |
| m12 | Rectangular patch on the snow | **Not fixed** | m10. |

### Tracker items in my area (`DEFECTS.md`)

| ID | Claimed | My verification |
|---|---|---|
| F-008 | CLAIMED | **Partial.** Smearing on the kit fixed; needles softened in the reveal; harbour streaks open. |
| F-009 | CLAIMED | **Not fixed** visually (A5-M3). |
| F-010 / F-030 | CLAIMED | **Mostly fixed** (scanned rock on the scoured views; m3 remains). |
| F-011 | CLAIMED | **Partial** (A5-M4). |
| F-012 | CLAIMED | **Partial.** No clipping seen, but the strand reads as a raft (m9). |
| F-013 / F-031 | CLAIMED | **Partial** (A5-M6). |
| F-016 | VERIFIED (E r4) | **Unverified by me:** `res-2560/` absent for Round 5. |
| F-023 | CLAIMED | **Partial.** Lintel and net fixed; the causeways are sparser; floating card and log remain (A5-M5); the columns read as concrete (A5-M4). |
| F-025 | CLAIMED | **Not fixed in the shot** (A5-M8). |
| F-026 | CLAIMED | **Partial.** The dot lattice and waffle are gone; a horizontal ripple pinstripe remains at about 1 km (m1). |
| F-027 | CLAIMED | **Mostly fixed** (A4-M1 row above). |
| F-028 | OPEN | **Open, confirmed** (A5-M1). |
| F-029 | OPEN | **Open, confirmed** (A5-M2). |
| F-032 | OPEN | **Open, confirmed** (A5-M7; the repeated houses as m5). |

## 7. Public-preview gate (completion brief §10, as summarised in the brief): items in my area

| Gate item | Status | Evidence |
|---|---|---|
| Art direction ≥ 8 | **Not met** | My score is 7.5. Eight Majors remain, six of them §4 named failures. |
| §4 named failures absent | **Not met** | Not met: snow on vertical ocean cliffs (A5-M1); loaf islands (A5-M3); concrete-looking rock (A5-M4); repeated boulders (A5-M7); pillow rocks (m4); a terrain/cliff seam (round-4 m8). Largely met: needle crests (m2 residual). Met: stretched textures (no longer seen outside the `08d` column face). |
| Foam and wet rock at the waterline | **Not met** | Foam present; no wet band (A5-M6). |
| Varied coves and natural island silhouettes | **Not met** | A5-M3. The `06` coastline is still long and straight. |
| No snow-coloured water in the victory | **Met** | `11j` (95, 107, 118) reads as water, though matte (m12). |
| Poly Haven materials used meaningfully; colour, scale, tiling, pinstripe, regrade | **Partial** | Rock Face 03 is now on the cave shell and the hazard rock, with a correct cold regrade. On the kit, the detail fades with distance (`rockMaterial.ts`), which fixed the waffle, but strata still pinstripe (m1). The columns and the harbour wall do not use it. |
| Art verified at 1366×768 and 2560×1440 | **Not met (no evidence)** | `res-1366/` and `res-2560/` absent at my final check. |
| Standard-course cave art | **Not met (no evidence)** | `standard/` absent. |

**Bottom line:** the public-preview gate is **not met** on art direction. The shortest route to an 8:
1. Put the rock material, without snow, on the harbour wall (A5-M1). That repairs `10`, `10b`, `11c`, `11d` and `11g` in one change.
2. Open the summit vista (A5-M2).
3. Delete the floating cave debris (A5-M5).
4. Re-material the columns (A5-M4).
5. Add a wet band under the foam (A5-M6).
6. Re-capture `01` and `03` so the island change can actually be judged.
