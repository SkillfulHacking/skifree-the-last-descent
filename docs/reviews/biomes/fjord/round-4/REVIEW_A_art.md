# Fjord Coast, Round 4 (release decision): Reviewer A, art direction

- **Reviewer:** A (art direction).
- **Nature of review:** model-based reviewer, same model family as the developers; not an external human.
- **Build:** `8d19542` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`).
- **Date:** 2026-11-12.

**Method**
- Viewed every Round-4 candidate PNG at full 1920×1080: `01`–`11j`, plus the late `12_wind_gate_gust`.
- Compared them with Round 3 (`final/`) and the Alpine baseline (`09`, `02`).
- Measured with PIL in `scratch/review-a-r4/`:
  - region luminance and RGB (`m.py`);
  - whole-frame R3→R4 pixel differences (`d.py`);
  - side-by-side crops (`06_r3_vs_r4.png`, `11c_r3_vs_r4.png`, `01_r3_vs_r4.png`, `03_islands_r3_top_r4_bottom.png`, `04b_r3_vs_r4.png`, `alpine_vs_fjord.png`);
  - zooms (`06_hatch_2x.png`, `06_foot_2x.png`, `06_notch_4x.png`, `06_hamlet_3x.png`, `06_crest_seam.png`, `07_lintel.png`, `08d_column.png`, `05_slab.png`, `07b_plane.png`, `01_islands.png`);
  - an FFT of the cliff-face texture.
- Read `INTEGRATION_LOG.md`, `DEFECTS.md`, `artscene/REVIEW_artscene.md` and the Poly Haven section of `docs/ASSETS_AND_LICENSES.md`, and spot-checked `src/world/art/rockMaterial.ts`. I treated the developer notes as claims to check, not as evidence.
- Ran `npx vitest run tests/unit/fjord_art.test.ts`: 7/7 pass.

**Evidence gaps at my final check (11:4x)**
- `candidate/res-1366/` and `candidate/res-2560/` do not exist.
- `candidate/EVIDENCE.md` and `candidate/manifest*.json` do not exist.
- So I could not verify the 1366×768 and 2560×1440 art, or the per-shot camera, phase and z values.

## 2. Verdict: **FAIL** (against 9/10; also below the ≥ 8 art-direction bar for a public preview)

Round 4 fixes the two worst Round-3 hero failures, and the improvement is real:
- **The sea cave is legible.** Shell median luminance is 45/255 and columns 44/255. In Round 3 both were 1/255, with 73–79 % of pixels below 10.
- **`08b` now frames the Yeti against the fjord.**
- **The plunge water no longer reads as a snowfield.** Water mean RGB in `11j` is (95, 107, 118); in Round 3 it was (135, 143, 151).
- **The sea cliffs no longer smear vertically.** The cliff kit brings benches and strata (`06`, `01`).

But most of the frame is unchanged from Round 3. `02`, `03`, `09`, `10`, `10b`, `11c`, `11e`, `11g` and `11i` differ from Round 3 by less than 3 % of pixels (more than 30 levels of difference), and every completion-brief §4 failure on those frames is still visible:
- the needle-spike mountain face that fills the signature reveal (`11c`, `11i`);
- white snow streaks on the vertical harbour cliff behind every finish and victory shot;
- the summit "sugarloaf";
- loaf, cake, saucer and crumpled islands;
- a scoured-rock hazard made of untextured grey plates;
- repeated boulder confetti on the inland walls.

Where the new cliff kit does show, it reads as woven grey canvas or concrete rather than rock. There is no real foam or wet-rock line anywhere. In the cave, the hexagonal "lintel" blocks visibly float off the rock.

This is not Alpine with new colours. Where it is good (`09d` composition, `11b`, `08`), it is clearly the Fjord. It is a **7/10** environment, not an 8 and not a 9.

## 3. Scores (out of 10, from an art-direction point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **7** | Up from 6.5. The cave, the plunge water and the sea-cliff smearing are fixed. Still open: the needle field and white cliff streaks in the signature reveal (`11c`, `11i`) and the harbour (`10`, `11d`, `11g`); the summit sugarloaf (`02`); the islands; the flat-plate hazard (`09d`); floating lintel blocks (`07`, `08b`, `08c`, `08d`); a canvas or concrete read on the cliff kit (`06`, `05`). |
| Environmental uniqueness | **7.5** | Unchanged. Sea, harbour, quay, stockfish and basalt columns make it unmistakably coastal (`03`, `09d`, `11b`, `11e`, `08b`). Against that: the summit (`02`) uses the same layout as Alpine (sign, hut, fence) and centres on a generic snow hill; the inland walls share Alpine's boulder confetti (`alpine_vs_fjord.png`); `11` and `11f2` face inland. |
| Skiing and hazard mechanics | 6 (low confidence) | Visual read only. The windsock telegraph works. The scoured rock is placeholder geometry at every distance, and from the chase camera (`09d`) it fills a third of the frame with untextured plates. |
| Difficulty and fairness | 7 (low confidence) | Outside my area. Runs are open and readable, and the sea stays in view. |
| Cinematics | 7 | Up from 6.5. The cave beats are now readable, the Yeti leaps against the fjord (`08b`) and the plunge lands in water. Against that: lintel blocks float in `08b`, `08c` and `08d`; the reveal (`11c`, `11i`) is unchanged and dominated by the needle field; the trophy shot `11` still faces an inland snowfield. |
| Performance and stability | 7 (low confidence) | Not measured by me. The software-renderer captures show no corruption. |
| Accessibility and controls | 7.5 (low confidence) | The cave is no longer crushed to black (only 5 % of `08c` is below 10/255; it was 83 %). Captions are legible. Art at 1366 and 2560 is unverified (no shots). |
| Overall player experience | **7** | The run itself is a pleasant coastal descent and the harbour après is charming. But the summit view, the hazard rock and the final reveal each carry a prominent, already-reported visual failure. |

## 4. Defects

### Critical
**None.** Nothing I can see blocks rendering, and no assets are missing. (The missing resolution evidence is a gate gap; see §7.)

### Major

**A4-M1. The signature reveal and far massif are still a field of needle spikes (named failure: needle crests). Unchanged since Round 3.**
- Evidence:
  - `11c` x 900–1920, y 120–800 and `11i` x 900–1920, y 120–780: hundreds of sharp conical spikes with smeared snow.
  - `11c` differs from Round 3 in 2.9 % of pixels; only the beacon changed (`11c_r3_vs_r4.png`).
  - `06` crest x 640–1000, y 130–330: the same needles as Round 3 (`06_r3_vs_r4.png`).
- Cause: `rangeSoft` (`src/world/biomes/fjord/biome.ts:209`, `course.ts:257`) only rounds ranges 350 m or more beyond the piste edge. The massif seen in the reveal is nearer than that.
- Fix:
  - Apply the softened ridged field, or a few authored massif meshes, to the whole visible headland above the harbour.
  - Clamp the ridged-noise amplitude on slopes above about 45°, so the crest breaks into a few large massifs rather than spikes.
  - Re-capture `11c`, `11i` and `06`.

**A4-M2. Snow streaks on vertical ocean cliffs behind the harbour (named failure). Not fixed.**
- Evidence:
  - `10` x 760–960, y 180–420; `10b` x 400–470, y 260–540; `11d` x 790–1000, y 200–490; `11g` x 260–500, y 150–480; `11c`/`11i` x 1480–1840, y 780–950.
  - Vertical white strips run down a sheer, untextured, smeared heightfield face.
- Cause: the cliff kit is deliberately off at the finish harbour (`cliffKitWeight` = 0 at the finish, INTEGRATION_LOG §4). The face behind every victory shot is therefore the Round-3 face.
- Fix: extend the kit (with the hamlet carve-out) behind the harbour, or at minimum suppress the snow term on faces steeper than about 65–70° and give that wall the kit's rock material.

**A4-M3. The summit vista is still blocked by the free-standing snow sugarloaf (Round-3 M2). Not fixed.**
- Evidence: `02` x 900–1470, y 280–640. A symmetric snow pyramid with a dark smear band stands centre-frame between the start and the sea. Only 1.8 % of pixels differ from Round 3.
- Fix: as in Round 3. Shape it as an asymmetric coastal headland with a cliffed, rock-exposed seaward face, or lower it so the sea opens behind the start.

**A4-M4. Islands are still loaves, cakes, saucers and crumpled lumps (named failures: uniform loaf, cake, pillow). F-009 not fixed.**
- Evidence:
  - `01` x 1470–1850, y 555–730: the hero island is a crumpled, faceted twin-peak lump with snow texture stretched down its flanks (crop `01_islands.png`).
  - `01` x 1310–1480, y 555–590: a flat white "saucer" sliver.
  - `03` x 1645–1850, y 445–495: a two-tier flat slab, a cake (crop `03_islands_r3_top_r4_bottom.png`).
  - `03` x 1310–1540, y 350–390, plus `05`, `09`, `09b`, `09d`: smooth snow-capped whalebacks in rows to the horizon.
  - No island has foam or a wet band at the waterline.
- The developers chose to keep the Round-3 heightfield islands (INTEGRATION_LOG §5). Commit `ac5234a` only reshapes them into "whalebacks", which is still the loaf the brief bans.
- Fix:
  - Asymmetric profiles (one cliffed side and one long slope).
  - Headland and cove outlines instead of ellipses.
  - Dark, wet lower 1–2 m, and no near-white tops below the snow line.
  - Fewer, larger groups.
  - Drop the sliver tops.

**A4-M5. The scoured-rock hazard reads as placeholder geometry at every distance (F-010). Not fixed; worse from the chase camera.**
- Evidence:
  - `09d` x 0–1920, y 630–1080: flat-shaded, untextured grey low-poly plates fill the bottom third of the gameplay frame.
  - `04b` x 760–1180, y 540–640: slug- or jet-shaped grey slabs, with paper-thin white shards lying on the snow at x 590–1040, y 610–705 (`04b_r3_vs_r4.png`).
  - `12` x 790–1020, y 495–595: the same slabs.
  - `09c` x 480–870, y 625–675.
- Fix: give the ribs the cliff or cave rock material (they currently use a vertex-colour material, per ASSETS_AND_LICENSES). Make them angular and darker with flat wind-polished tops; ground them with a wind-crust lip; delete the white shards.

**A4-M6. The cliff-kit and rim surfaces read as canvas, concrete or masonry (named failure: concrete or masonry rock; also pinstripe). F-011 partial.**
- Evidence:
  - `06` face x 0–1100, y 50–950: a regular woven "waffle" hatch at 1:1 and 2× (`06_hatch_2x.png`). The FFT of x 150–550, y 180–370 shows a single dominant peak with a 6.3 px horizontal period, 216× the median high-frequency power. That is a tiling signature, not rock. The macro tone is a flat, uniform mid-grey: mean RGB (130, 135, 134), with no rust, seep or lichen variation visible at this range.
  - `05` x 1100–1920, y 640–1050 (`05_slab.png`): the rim is a smooth, pale, sloped slab, like a concrete parapet along the sea.
  - `11b` x 950–1920, y 395–490 and `11j` x 0–1920, y 630–695: the quay is regular, pale, untextured panels.
- Fix:
  - Break the Rock Face 03 tile on the kit: either a larger tile than 9 m with stochastic or hex-tiling, or a higher mip bias at distance.
  - Add a world-space albedo variation layer (seeps under benches, darker wet base).
  - Give the rim ledge and quay a rock or stone material with irregular coursing.

**A4-M7. No foam and no wet-rock line at the shore (completion brief §4 "Water and coastlines": required). F-013 not effectively fixed.**
- Evidence:
  - `06` cliff foot (`06_foot_2x.png`): the claimed "surf ribbon" is a 1–2 px dotted pale line that reads as a seam, not surf. There is no darkened wet band on the rock.
  - Islands (`01`, `03`) and cave columns: hard cuts to water.
- Fix: a 2–6 m wide, broken, animated foam band in `FjordWater`, driven by distance to shore, plus a 1–3 m darkened, glossier wet-rock band in the rock material above the waterline.

**A4-M8. The cave's hexagonal "lintel" blocks float in the air, and the column faces show stretched texture (named failures: floating props, stretched textures).**
- Evidence:
  - Floating blocks: `07` x 720–1090, y 340–470 (crop `07_lintel.png`); `08b` x 1440–1680, y 120–355; `08c` x 365–1310, y 575–860; `08d` x 1130–1520, y 120–400. Five to seven separate prisms with icicles hang clear of the rock.
  - Stretched texture: a pale, stretched band down one prism face in `08d` x 1670–1800, y 430–960 (`08d_column.png`), and on the prisms in `08c` x 370–470, y 590–800.
- Fix: seat the lintel prisms into the shell (bury 30–50 %, or build a connected overhang), and fix the per-face UV or triplanar weight on the column side faces.

**A4-M9. Repeated boulder patterns on the inland walls (named failure).**
- Evidence: `09` x 0–960, y 0–580; `09b` x 0–700, y 100–520; `02` x 0–330, y 0–600; `11j` x 1000–1700, y 150–450; `07b` x 300–1900, y 0–450. The same small pale rock chips are scattered evenly over planar facets. The pattern is identical in style to Alpine (`alpine_vs_fjord.png`).
- Fix: cluster the debris in gullies and at slope breaks (talus cones), vary scale by a factor of 3–5, and leave most of each face bare.

### Minor

- **m1. Menu: pale straight "ray" streaks on the water (Round-3 m6).** `01` x 880–1900, y 500–950. The card-like rock at x 750–810, y 950–1060 is also still there. The clay curtain is fixed.
- **m2. Harbour houses (Round-3 m4) not fixed.**
  - Loose on snow with no footing: `10` x 1165–1920, y 450–660.
  - The front green house overlaps the yellow house behind it at x 1210–1240.
  - Identical gable bodies repeated: `11h`/`11j` x 700–1920, y 310–620; `09d` x 535–920, y 535–590; two identical rainbow rows in `11i`.
  - Walls are flat colour with no texture (`11f` x 330–1260, y 120–710).
- **m3. Leopard-spot slush on the finish plaza (Round-3 m5) not fixed.** `10b` x 0–900, y 610–780; `10` x 600–1100, y 560–740.
- **m4. The `07b` outlook still shows no fjord (Round-3 m8).** It also has a hard-edged, sheet-like shadow boundary on the snow at x 900–1110, y 200–640 (`07b_plane.png`), and the "lightning-bolt" crack decal on the tide pool remains (x 600–1300, y 680–1000).
- **m5. Basalt columns read as a uniform toy crowd; the props still read as debris.**
  - Columns: `07` x 890–1780, y 420–1030, with the same girth, all upright and with flat caps.
  - The net stands upright in mid-air: `07` x 460–545, y 735–805; `08b` x 1010–1100, y 830–960.
- **m6. Inland-facing beats.** `11` faces the inland snowfield. In `11f2`, the right half (x 1440–1920, y 120–700) is snowfield and mountain, with the sea only a sliver at left. (Cinematics is C's area.)
- **m7. The hamlet strand reads as a floating raft (F-012 partial).** `06` x 520–735, y 755–830 (`06_hamlet_3x.png`): a flat polygonal plate with a crisp angular edge and a white wedge cut into the cliff. There is also an unexplained dark slot in a bench at `06` x 890–935, y 550–585 (`06_notch_4x.png`).
- **m8. Seam where the cliff kit meets the heightfield (named failure: terrain/cliff seams).** `06` x 400–750, y 320–540 (`06_crest_seam.png`): horizontal stair-step terracing lines on the heightfield directly above the kit.
- **m9. The splash's lower rim reads as a glass cylinder.** `11h` x 920–1300, y 600–740.
- **m10. The stockfish are identical cut-outs in perfect rows.** `11e` x 540–1330, y 410–610.
- **m11. The plunge water is still paler and flatter than the harbour water, with no specular.** `11j`/`11h` y 760–950 measure mean RGB (95, 107, 118); `11b` water measures (69, 87, 100). It reads as water now, but matte.
- **m12. A hard rectangular decal or patch edge across the snow.** `12` x 1130–1920, y 830–900.

## 5. What works

- **Sea cave (`07`, `08`, `08b`, `08c`, `08d`).** The Poly Haven Rock Face 03 shell reads as dark, fractured rock. The columns frame the mouth, and the darkness is controlled: the chamber stays black (mouth median 2/255) while the shell and columns are legible.
- **`08b`.** The Yeti leaping across the columns, with the harbour and fjord behind, is the best cave image in four rounds.
- **Sea cliffs (`06`, `01`).** Horizontal benches and buttresses replace the vertical smearing and the clay curtain.
- **Plunge (`11j`, `11h`).** The water is a dark grey-blue that reads as sea.
- **Harbour à la quay (`11b`, `11e`).** The sauna, tub, boats, stockfish rack and islands sit together, unchanged and still good. The cod in the mouth (`11f`) reads as a fish.
- **Gameplay frames (`03`, `09d`).** Strong coastal composition.

## 6. Status of earlier defects (my own verification)

### Round 3 (`final/REVIEW_A_art.md`)

| # | Defect | Status | Evidence |
|---|---|---|---|
| M1 | Cave crushed to black | **Fixed** | `07` shell median 45/255 (0 % < 10), columns 44 (4 %). `08c` 5 % < 10 (was 83 %); `08d` 28 % (was 76 %). |
| M2 | Summit sugarloaf | **Not fixed** | `02` x 900–1470, y 280–640; 1.8 % of pixels differ from R3. |
| M3 | Plunge water reads as snow | **Mostly fixed** | `11j` (95, 107, 118) vs R3 (135, 143, 151). Still paler and more matte than `11b` (m11). |
| M4 | Cliff smearing and needle crest | **Partial** | Smearing fixed on the kit cliffs (`06`, `01`). Needle crest unchanged (`06`, `11c`, `11i`). White streaks remain on the harbour cliff (A4-M1, A4-M2). |
| M5 | Scoured rock placeholder | **Not fixed** | Spindles became slabs and shards; `09d` is worse (A4-M5). |
| M6 | Loaf islands | **Not fixed** | Still loaves, plus cakes and saucers (A4-M4). |
| m1 | Cave props read as debris | **Not fixed** | Net in mid-air (m5). |
| m2 | Trophy-headed presenter | **Mostly fixed** | `11g`: the head is now visible behind and beside the trophy. |
| m3 | Cod reads as a stick | **Fixed** | `11f`: reads as a flat fish. |
| m4 | Houses loose on snow, overlapping | **Not fixed** | `10` (m2). |
| m5 | Leopard-spot plaza | **Not fixed** | `10b` (m3). |
| m6 | Menu clay curtain and ray streaks | **Partial** | Curtain fixed; streaks and card rock remain (m1). |
| m7 | Rim snow shoulder, evenly spaced cairns | **Not fixed** | `03` x 700–1900, y 470–640. |
| m8 | `07b` shows no fjord | **Not fixed** | m4. |
| m9 | Stair-stepped waterline outline | **Partial** | Now a dotted 1–2 px line (`06_foot_2x.png`). |

### Round 2 (A1–A13)

| # | Status | Notes |
|---|---|---|
| A1 | Mostly fixed | Quay present. Houses are still loose behind it. |
| A2 | Partial | As M4 above. |
| A3 | Not fixed | Islands, as above. |
| A4 | Mostly fixed | Cave legible and sea in frame. Floating lintel blocks (A4-M8). |
| A5 | Not fixed | Inland-wall faceting unchanged (`09`, `09b`). |
| A6 | Not fixed | A4-M5. |
| A7 | Mostly fixed | |
| A8 | Fixed | Glass-rim minor (m9). |
| A9 | Mostly fixed | |
| A10 | Fixed | |
| A11 | Mostly fixed | Identical cod (m10). |
| A12 | Fixed (cliff) | Card rock remains. |
| A13 | Partial | |

### Tracker items in my area (`DEFECTS.md`)

| ID | Claimed | My verification |
|---|---|---|
| F-003 | Cave near-black | **Fixed** (measured above). |
| F-004 | Cave sea framing (C's area) | **Fixed** for the classic Sprint cave (`08`, `08b`). The custom caves remain a known gap per the log; not in the shots. |
| F-005 | Plunge water | **Mostly fixed** (m11). |
| F-008 | Needle crest, vertical smearing | **Partial.** Smearing fixed on the kit; needles and harbour streaks not fixed. |
| F-009 | Islands | **Not fixed.** |
| F-010 | Scoured rock | **Not fixed.** |
| F-011 | Rock reads as concrete or masonry | **Partial.** The masonry joint grid is gone; the canvas/waffle hatch and concrete rim and quay remain. |
| F-012 | Hamlet float or clip | **Partial.** Houses are not in the wall, but the strand reads as a raft (m7). |
| F-013 | Foam | **Not effectively fixed** (A4-M7). |
| F-014 | Cod and presenter | **Fixed / mostly fixed.** |
| F-016 | 2560 UI scale | **Unverified:** `candidate/res-2560/` is absent. |

## 7. Public-preview gate (completion brief §10, as summarised in the brief): items in my area

| Gate item | Status | Evidence |
|---|---|---|
| Art direction ≥ 8 | **Not met** | My score is 7. Nine Major defects, six of them completion-brief §4 named failures. |
| §4 named failures absent | **Not met** | Needle crests (A4-M1); vertically stretched textures, now limited to the cave prisms (A4-M8); loaf, cake and pillow islands (A4-M4); repeated boulders (A4-M9); concrete-looking rock (A4-M6); snow on vertical ocean cliffs (A4-M2); terrain/cliff seams (m8). |
| Foam and wet rock at the waterline | **Not met** | A4-M7. |
| Varied coves and natural island silhouettes | **Not met** | A4-M4. The coastline outline is long and straight in `06` and `03`. |
| No snow-coloured water in the victory | **Met** | `11h` and `11j` measured; reads as water. |
| Poly Haven assets used meaningfully, colour and scale correct | **Partial** | Rock Face 03 works on the cave shell (4 m tiles). On the cliff kit (9 m tiles) it tiles into a visible waffle at distance (A4-M6). Cliff Side is used only as a macro layer. Aerial Rocks 02 and Coast Sand Rocks 02 are unused, although the hazard rock and the shore are exactly where they were needed. Provenance entries are present and specific (`ASSETS_AND_LICENSES.md:103–108`); the technical pipeline is D's area. |
| Art verified at 1366×768 and 2560×1440 | **Not met (no evidence)** | `candidate/res-1366/` and `candidate/res-2560/` were still absent at my final check. |

**Bottom line:** the release gate for a public preview is **not met** on art direction. The fastest route to an 8:
1. Soften the needle massif and extend the kit (or snow suppression) behind the harbour, which repairs `11c`, `11i`, `10`, `11d` and `11g`.
2. Give the hazard rock the rock material.
3. Seat the lintel blocks in the rock.
4. Add a real foam and wet band.
5. Reshape or lower the summit hill.
