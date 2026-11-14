# Fjord Coast, Round 6: Reviewer A, art direction

- **Reviewer:** A (art direction).
- **Nature of review:** model-based reviewer, same model family as the developers; not an external human.
- **Build:** `5c28419` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`; HEAD = `5c28419` at review time).
- **Date:** 2026-11-13.

**Method**
- Viewed every Round-6 candidate PNG at 1920×1080 (`01`–`12`, 32 files) with the Read tool. I viewed the changed shots at full size and the rest on half-resolution contact sheets (`scratch/review-a-r6/sheet1–3.png`).
- Compared each shot with Round 5 (`round-5/candidate/`, build `e2ce964`):
  - per-shot pixel difference (`scratch/review-a-r6/d.py`);
  - region difference and luminance (`m.py`);
  - side-by-side crops (`sbs_01_menu.png`, `sbs_03_mid_mountain.png`).
- Zoomed crops: `06_right_2x.png`, `06_islands_2x.png`, `03_group_3x.png`, `03_far_2x.png`, `07_left_2x.png`, `07_right_2x.png`, `07_mouth_2x.png`, `08_debris_2x.png`, `10_wall_2x.png`.
- Read the source diff `e2ce964..5c28419`: `scanIslands.ts`, `scanModels.ts`, `seaCave.ts`, `coast.ts`, `snowMaterial.ts`, `rockMaterial.ts`, `harbourVictory.ts`, `scenery.ts`. Checked the provenance rows in `docs/ASSETS_AND_LICENSES.md` (128–133: all six scans listed).
- `npx vitest run tests/unit/fjord_art.test.ts`: 7/7 pass.

**Evidence missing at my final check**
- `candidate/EVIDENCE.md` and `candidate/manifest*.json`.
- `candidate/res-1366/`, `candidate/res-2560/` and `candidate/standard/`.
- Extra beats after `12` (no `12b`, `13`, `14` or `15`).
- `candidate/perf/` and `round-6/TESTS.md`.

So the art at 1366×768 and 2560×1440, the Standard-course cave, and the per-shot camera, phase and z values are **unverified**, for the second round running.

## 2. Verdict: **FAIL** (against 9/10; also below the ≥ 8 art-direction bar for a public preview)

The change of method worked where it was applied.
- **Islands:** in the gameplay shots (`02`, `03`, `04`, `05`, `09`, `09d`, `11e`), the loaves and whalebacks have become craggy, asymmetric scanned rock. Snow lies on the flatter tops. This is the first time in six rounds that the archipelago looks like a Norwegian skerry coast.
- **Cave:** the uniform hex-prism causeways and the driftwood logs are gone from the foreground.

But the round also brought new, clearly visible faults:
- **`06` long-distance shot:** a white, untextured, folded slab and a flattened dark "canoe" disc float in the right foreground.
- **`07`, `08`, `08c`, `08d`:** a lone rectangular basalt "monolith" leans against the cave face.
- **Icicles:** they now hang from bare rock about 250 px above the cave mouth (`08c`).
- **Cave foreground:** untextured grey prism drums, a pale card and small sprite bits still float or interpenetrate among the new boulders (`07`, `08`, `08b`). The boulders sit on the snow with their undersides showing, not half-buried.
- **`08b`:** the best image of Round 5 lost its basalt perch, and the Yeti now hangs in the air in front of a blank wall.
- **Menu `01`:** the islands have vanished.

The frames the player sees at the end have not changed at all:
- the harbour-wall snow streaks (0.0 % of pixels changed in the measured region of `10` and `11c`, despite the `snowMaterial.ts` change);
- the summit sugarloaf;
- the inland boulder confetti;
- the inland-facing catch shot `11`, which was re-shot but still shows no sea.

Net: a 7.5 that is better in the middle of the run and worse in the cave. The art-direction bar of 8 is still not met.

## 3. Scores (out of 10, from an art-direction point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **7.5** | The islands are now a real improvement (`03`, `09d`, `11e`), and so are the column-free cave foreground and the closed waffle (`06`). New faults offset that: the white slab and floating disc in `06`, the cave monolith, icicles on bare rock, and floating drums and card (`07`, `08`). All the Round-5 end-of-run faults are unchanged (`10`, `11`, `11c`, `02`). |
| Environmental uniqueness | **8** | Up from 7.5. The scanned skerry archipelago now carries the Fjord identity in almost every gameplay frame (`02`, `03`, `04`, `09`, `09d`), together with the quay, stockfish and harbour (`11b`, `11e`). Held back by the Alpine-like summit and inland walls (`02`, `07b`, `09`) and by a catch shot that faces upslope (`11`). |
| Skiing and hazard mechanics | 6.5 (low confidence) | Visual read only; `04`, `04b`, `04c`, `09d` and `12` are unchanged (≤ 1.5 % of pixels differ). The scoured rock still has slug-shaped slabs and paper shards (`04b`), and its near-range texture is blurred (`09d`). |
| Difficulty and fairness | 7 (low confidence) | Outside my area. The runs read openly, and the sea and islands stay in view. |
| Cinematics | 6.5 | Down from 7. `08b` lost its basalt perch: the Yeti now floats in front of a blank wall at x 1200–1330, y 460–610. Other faults: a monolith in `08`/`08c`/`08d`, icicles detached from the brow (`08c`), and the catch shot `11` still inland. The reveal `11c` and the harbour wall are unchanged. |
| Performance and stability | 7 (low confidence) | Not measured by me, and `candidate/perf/` is absent. The captures show no corruption. The scans are only six meshes of about 45 KB each. |
| Accessibility and controls | 7 (low confidence) | Captions are legible (`08c`, `08d`, `09`, `09d`). The art at 1366 and 2560 is unverified because `res-1366/` and `res-2560/` are absent. |
| Overall player experience | **7** | The descent with the new islands is the best the Fjord has looked. But the cave set piece is now littered with new oddities, and the finish and victory still show the same streaked wall, inland catch and leopard plaza. |

## 4. Defects

### Critical
**None.** Nothing I can see blocks rendering, and no assets are missing from the shots. The resolution and Standard-course evidence is missing; that is a gate gap (§7), not a Critical.

### Major

**A6-M1 (NEW, regression). White untextured slab and floating squashed disc in the long-distance fjord shot.**
- Evidence: `06` x 1580–1920, y 720–990 (crop `06_right_2x.png`).
  - A flat, white, faceted, folded plate with a grey cut face sits on the water, with a thin white fin at its left end (x 1580–1640, y 735–785).
  - Below it, x 1740–1890, y 875–935, a dark lens-shaped disc with a white top hovers on the water like a hull.
  - Round 5 had a dark rocky island at this spot.
- Likely cause:
  - The disc looks like a whaleback scan with a 2.4× footprint stretch (`scanIslands.ts`, `f = 2.4`) and a low height. It is squashed flat: a named "stretched" failure.
  - The slab is heightfield land that the scan pass skipped (the `landy`/`hc` rejects) and that is still above the water.
- Fix:
  - Clamp the footprint-to-height aspect of each scan (for example, height ≥ 0.35 × the shorter footprint).
  - Where a blob is rejected, make sure the heightfield there is either a shoal below the water or is drawn with a scan, never as a bare snow plate.
  - Re-capture `06`.

**A6-M2 (NEW). Lone rectangular "monolith" against the cave face.**
- Evidence:
  - `07` x 1225–1280, y 395–690 (crop `07_mouth_2x.png`): one tall, smooth, square-section prism standing upright against the face;
  - `08` x 1640–1810, y 435–735 (leaning);
  - `08c` x 1430–1520, y 745–960;
  - `08d` x 1650–1900, y 380–960.
- With the causeways removed, the "portal colonnade" (`seaCave.ts:372`) is reduced to this single column. It reads as a 2001-style slab or a door, not basalt.
- Fix: remove it, or build an actual cluster of 5–9 jointed columns of varied girth, merged into the face with the rock material.

**A6-M3 (carried from A5-M5, partial). Floating and ungrounded props in front of the sea cave.**
- Evidence:
  - `07` x 490–570, y 770–850: two untextured grey prism drums, one intersecting a boulder;
  - `07` x 330–370, y 885–915: the pale bent card, still floating;
  - `07` x 570–690, y 820–860: small floating sprite bits;
  - `08` x 650–870, y 690–860 (crop `08_debris_2x.png`): the same drums, card and small fishbone/ladder sprites;
  - `08b` x 940–1165, y 765–880.
- The new scan boulders sit on top of the flat snow plane with their undersides visible and no drift lip or contact darkening. In `07` x 1005–1195, y 860–955 (crop `07_right_2x.png`) a slab reads as hovering. The code's "half-buried" (`p.y = gy - r*0.35`) does not show on screen.
- The boulders are also laid out as two parallel rows flanking the approach (`07` x 320–580 and x 930–1195), which reads as staged.
- `WRECKAGE = false` removed the hull, oar and logs, but the "fallen drums" loop and the card source were not removed.
- Fix:
  - Delete the fallen drums and the card.
  - Sink the boulders 30–50 % into a raised drift (a snow-lip mesh or a heightfield bump).
  - Scatter them in clumps rather than lanes.

**A6-M4 (carried from A5-M1). Snow streaks on the vertical harbour cliff behind the finish and victory. F-028 OPEN; not fixed since Round 3.**
- Evidence:
  - `10` x 760–960, y 180–420 (crop `10_wall_2x.png`);
  - `11c` x 1480–1840, y 780–950;
  - `10b`, `11d`, `11g`, `11h`, `11j`.
- Measured: 0.0 % of pixels in `10`'s streak region and 0.06 % in `11c`'s differ from Round 5. The face is still a smooth, smeared, untextured grey with white vertical strips, and no wet band at its foot.
- The new `snowMaterial.ts` bare-rock term (`dh` 30–700, slope 0.42–0.62) has no visible effect here.
- Fix:
  - Find out which material actually draws this face. The strips look like stretched UVs on a near-vertical heightfield, not the snow term.
  - Put the triplanar rock material (Rock Face 03 / Cliff Side) on it, or run the cliff kit behind the hamlet.

**A6-M5 (carried from A5-M2). Summit sugarloaf blocks the sea vista. F-029 OPEN.**
- Evidence: `02` x 900–1470, y 280–640; 0.94 % of pixels in the region changed (only the islands behind it).
- Fix: as in Round 5. Lower or shift the dome, or make it an asymmetric headland with a rock seaward face.

**A6-M6 (carried from A5-M6). No foam ring or wet band at the waterline: the islands, cliff kit and harbour wall all lack them. F-031 partial.**
- Evidence:
  - The new islands meet the water with a hard cut and short dark drip marks (`03_group_3x.png`). The luminance profile at `03` x 1330–1420 goes from rock about 50 to water about 150 over 8 px, with no foam peak (row maximum 185 against open water's 163–181).
  - The `scanIslands.ts` header promises "a wet band and foam at the waterline". The island material (`water: key`) does not produce one at this range.
  - The cliff-kit foam in `06` is unchanged (a constant chalk line).
- Fix: add a foam ring at the island footprints (a decal or a water-shader distance term against the island mask) and a 1–3 m darkened, glossy band above `uWater`.

**A6-M7 (carried from A5-M7). Repeated boulder chips on the inland walls. F-032 OPEN.**
- Evidence: `02` x 0–330, y 0–600; `07b` top band; `09` (sheet1) left wall; `11`, top centre x 840–1010, y 120–215; `11h` and `11j` above the houses. All unchanged.
- Fix: as in Round 5. Cluster the chips in gullies, vary their scale 3–5× and leave most faces bare. Better still, use a few of the scans as talus.

**A6-M8 (carried from A5-M8). The trophy/catch shot still faces inland. F-025 claimed; not fixed.**
- Evidence: `11` (57 % of pixels changed; the camera moved to `right, −5.4`, `harbourVictory.ts:158`).
- The frame now shows the skier and harbourmaster against a snow slope with a dark, smeared, storm-like rock band across the top (y 120–300), houses at right, and floating-looking rocks at x 840–1010, y 120–215. There is no water anywhere.
- Mirroring the camera did not put the quay behind the pair. C owns the framing; I list it because the completion brief forbids inland-facing victory shots.
- Fix: aim from the land side toward the quay, verified against the water position (for example, by the camera ray hitting `seaLevelAt` within the frame), and re-capture.

**A6-M9 (carried from A5-M4, changed). The cave basalt now reads as a single prop; the rim still reads as concrete.**
- The concrete-looking column clumps are gone from the foreground. That part is fixed, by removal.
- What remains:
  - the monolith (A6-M2);
  - grey drum prisms (A6-M3);
  - the pale, smooth parapet rim in `05` x 1100–1920, y 640–1050, unchanged (sheet1).
- Fix: put the rock material on the rim ledge.

### Minor

- **m1 (NEW). Icicles detached from the brow.**
  - Evidence: `08c` x 520–1050, y 515–595, about 200 px above the mouth's top edge at y about 790; `07` x 785–960, y 320–350; `08` x 1110–1385, y 230–310.
  - The new `yUp = max(6.1, lipTop − mouth + 0.3)` (`seaCave.ts:447`) lifted them onto a bare vertical face.
  - Fix: seat them on the actual overhang lip (sample the shell mesh), or remove them.
- **m2 (NEW). Menu has lost its islands.**
  - Evidence: `sbs_01_menu.png`. The Round-5 islands at `01` x 850–1370, y 270–410 are now open water.
  - The scans probably load after the menu's single `want()` call.
  - The empty sea is cleaner but less Fjord.
  - Fix: call `want()` again when a scan arrives (the code resets `win`, but nothing calls `want()` again on a static menu camera), or preload the scans before the menu frame.
- **m3 (NEW). Some distant islands still have flat white snow plates on top.**
  - Evidence: `03` x 695–815, y 255–290 (`03_far_2x.png`); `11c` x 20–240, y 720–790 (a flat snow plate).
  - Fix: raise `snowFrom` on the island material or limit snow to slopes under about 25°.
- **m4. Horizontal ripple pinstripe on the upper cliff kit:** unchanged (`06` x 500–1000, y 330–560; 0.01 % of pixels changed in the region).
- **m5. Reveal massif mush, crater ring and terracing:** unchanged (`11c` x 1180–1330, y 470–560; `11i`).
- **m6. Scoured-rock slug shapes and shards:** unchanged (`04b` x 590–1040, y 610–705; `09d` y 780–1080 blur).
- **m7. Pillow rocks on the piste:** unchanged (`12`, `04`).
- **m8. Harbour houses:** repeated rows, loose on snow, flat walls; unchanged (`10`, `11i`, `11h`, `11j`).
- **m9. Leopard-spot plaza:** unchanged (`10b`; `11` x 0–1100, y 560–700).
- **m10. Menu:** ray streaks on the water and the card rock; unchanged (`01` x 880–1900, y 500–950; x 750–810, y 950–1060).
- **m11. `07b` outlook:** no fjord, a hard sheet-shadow edge, and the "lightning-bolt" ice decal; unchanged (2.9 % of pixels differ).
- **m12. Hamlet strand reads as a raft:** unchanged (`06` x 520–735, y 755–830).
- **m13. Rectangular patch edges on the snow:** unchanged (`12` x 1130–1920, y 830–900).
- **m14. Glass-cylinder splash rim (`11h`) and matte plunge water (`11j`):** unchanged (`11h` and `11j` differ in 0.1 % of pixels).

## 5. What works

- **Scanned islands (`03`, `09d`, `11e`, `02`, `06` mid-range).**
  - Real crag silhouettes: stepped, fractured, asymmetric.
  - A cold regrade that matches the cliff kit.
  - Snow on the tops, varied group sizes.
  - This finally retires the loaf / cake / whaleback read across most of the run, and it is the single biggest art gain since Round 2.
  - The provenance is documented (`ASSETS_AND_LICENSES.md:128–133`).
- **Cave foreground without the hex causeways and logs (`07`, `08`).** The scanned boulders are real rock forms, and the shell material reads as natural rock.
- **`08d` roar.** Controlled darkness, and the irregular mouth reads well.
- **Harbour après (`11b`, `11e`).** Still charming; the scan island behind the stockfish racks in `11e` adds depth.

## 6. Status of earlier defects (my own verification)

### Round 5 (`round-5/REVIEW_A_art.md`)

| # | Defect | Status | Evidence |
|---|---|---|---|
| A5-M1 | Harbour cliff snow streaks | **Not fixed** | A6-M4. 0.0 % of pixels changed in the region. |
| A5-M2 | Summit sugarloaf | **Not fixed** | A6-M5. |
| A5-M3 | Loaf, whaleback and crumpled islands | **Largely fixed** | `03`, `09d`, `11e` and `sbs_03`. Residual: the `06` white slab and squashed disc (A6-M1, a regression), flat snow plates on distant islands (m3), and no foam (A6-M6). |
| A5-M4 | Concrete columns and rim | **Partial** | The foreground prisms were removed. A monolith remains (A6-M2), and the drums and rim are unchanged (A6-M9). |
| A5-M5 | Floating cave debris | **Partial** | The logs, hull and poles are gone. The drums, card and sprite bits remain, and the boulders are ungrounded (A6-M3). |
| A5-M6 | Chalk-line foam, no wet band | **Not fixed** | A6-M6. The new islands have none either. |
| A5-M7 | Repeated inland boulders | **Not fixed** | A6-M7. |
| A5-M8 | Catch shot inland | **Not fixed** (re-shot) | A6-M8. |
| m1 | Ripple pinstripe | **Not fixed** | m4. |
| m2 | Massif mush and crater | **Not fixed** | m5. |
| m3 | Scoured-rock shapes and blur | **Not fixed** | m6. |
| m4 | Pillow rocks | **Not fixed** | m7. |
| m5 | Houses | **Not fixed** | m8. |
| m6 | Leopard plaza | **Not fixed** | m9. |
| m7 | Menu streaks and card rock | **Not fixed** | m10. The menu islands are also gone now (m2). |
| m8 | `07b` outlook | **Not fixed** | m11. |
| m9 | Hamlet raft | **Not fixed** | m12. |
| m10 | Rectangular snow patches | **Not fixed** | m13. `12b` not delivered this round. |
| m11 | Glass splash rim | **Not fixed** | m14. |
| m12 | Matte plunge water | **Not fixed** | m14. |

### Tracker items in my area (`DEFECTS.md`; the tracker has no Round-6 entries)

| ID | Claimed | My verification |
|---|---|---|
| F-008 | CLAIMED | **Partial.** The harbour streaks remain open (A6-M4). |
| F-009 | CLAIMED | **Largely fixed by the scans.** The `06` regression is open (A6-M1). |
| F-010 / F-030 | CLAIMED | **Mostly fixed.** The shapes remain (m6). |
| F-011 | CLAIMED | **Partial** (A6-M2, A6-M9). |
| F-012 | CLAIMED | **Partial.** The strand reads as a raft (m12). |
| F-013 / F-031 | CLAIMED | **Partial / not fixed** (A6-M6). |
| F-016 | VERIFIED (E r4) | **Unverified by me:** `res-2560/` absent. |
| F-023 | CLAIMED | **Partial** (A6-M2, A6-M3, m1). |
| F-025 | CLAIMED | **Not fixed** (A6-M8). |
| F-026 | CLAIMED | **Partial** (m4). |
| F-027 | CLAIMED | **Mostly fixed.** Mush remains (m5). |
| F-028 | OPEN | **Open, confirmed** (A6-M4). |
| F-029 | OPEN | **Open, confirmed** (A6-M5). |
| F-032 | OPEN | **Open, confirmed** (A6-M7, m8). |

## 7. Public-preview gate (completion brief §10): items in my area

| Gate item | Status | Evidence |
|---|---|---|
| Art direction ≥ 8 | **Not met** | My score is 7.5. Nine Majors remain, two of them new this round (A6-M1, A6-M2). |
| §4 named failures absent | **Not met** | **Not met:** snow on vertical ocean cliffs (A6-M4); stretched/squashed forms (the `06` disc, A6-M1); repeated boulders (A6-M7); pillow rocks (m7); the concrete rim (A6-M9). **Largely met:** loaf / cake / cylinder islands (scans; the `06` and m3 residuals remain); needle crests (m5 residual). **Met:** columns as cylinder props in the cave foreground (removed). |
| Foam and wet rock at the waterline | **Not met** | A6-M6. |
| Varied coves and natural island silhouettes | **Partial** | The island silhouettes are now natural (`03`, `09d`). The `06` coastline is still long and straight, with no coves. |
| No snow-coloured water in the victory | **Met** | `11j` is unchanged and reads as water, though matte. |
| Poly Haven materials and models used meaningfully | **Partial** | The scans and Rock Face 03 work on the islands and cave boulders. The harbour wall and rim still do not use them, and the boulders are not seated in the snow. |
| Art verified at 1366×768 and 2560×1440 | **Not met (no evidence)** | `res-1366/` and `res-2560/` were absent at my final check. |
| Standard-course cave art | **Not met (no evidence)** | `standard/` was absent. |

**Bottom line:** the public-preview gate is **not met** on art direction. The shortest route to an 8:
1. Fix the `06` slab and disc, and clamp the scan aspect (A6-M1).
2. Remove the monolith, the drums and the card, and seat the cave boulders in drifts (A6-M2, A6-M3).
3. Put rock material on the harbour wall (A6-M4). This is now the oldest open Major.
4. Add foam rings to the scan islands (A6-M6).
5. Re-aim `11` at the water (A6-M8).
6. Deliver the `res-*` and `standard/` evidence.
