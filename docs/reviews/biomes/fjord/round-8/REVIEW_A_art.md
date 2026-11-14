# Fjord Coast, Round 8: Reviewer A, art direction

- **Reviewer:** A (art direction).
- **Nature of review:** model-based reviewer, same model family as the developers; not an external human.
- **Build:** `d1f642b` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`; HEAD = `d1f642b`, tree clean apart from the untracked round-8 evidence).
- **Date:** 2026-11-13.

**Method**
- Viewed all 36 Round-8 1920×1080 PNGs with the Read tool: `01`, `02`, `03`, `05`, `06`, `07`, `08`, `08b`, `08c`, `08d`, `10`, `11`, `11c`, `14` at full size, the rest on half-resolution contact sheets (`scratch/review-a-r8/s1–s6.png`).
- Compared every shot with Round 7 (`round-7/candidate/`, build `7b0a5bc`): per-shot pixel difference, threshold 12/255 (`scratch/review-a-r8/d.py`), and side-by-side views of `01`, `06`, `10`, `11`, `11c`, `14`. Compared `06`/`03` with Round 3 (`final/`) and Alpine (`cmp.png`).
- Zoomed crops (`crop.py`): `11_left.png` (headland in the trophy shot), `03_far.png`, `01_isl.png`, `06_foot.png`, `14_isl.png`.
- Pinstripe measurement on `06` x 500–1100, y 330–620 (`stripe2.py`): mean |vertical 2nd derivative| of luminance vs horizontal.
- Source diff `7b0a5bc..d1f642b` (`scanIslands.ts`, `scanModels.ts`, `snowMaterial.ts`, `rockMaterial.ts`, `cliffKit.ts`, `harbour.ts`, `buildings.ts`, `App.ts`) and `tools/biome_evidence.mjs` `settle()`.
- `npx vitest run tests/unit/fjord_art.test.ts tests/unit/fjord_reveal.test.ts`: 8/8 pass.

**Evidence status at my final check** (about 14:35 EST, after roughly 50 minutes of waiting; captures were running at about 10 minutes per shot):
- `EVIDENCE.md` and `manifest.json` are present this round, for the first time since Round 4.
- `res-1366/` has `01`, `02`, `09` and `09d`. I viewed `01`, `02` and `09`: same art as at 1920, nothing clipped.
- `res-2560/` and `standard/` are absent.
- `perf/` has partial logs.
- `round-8/TESTS.md` is absent.

## 2. Verdict: **FAIL** against 9/10. Art direction reaches the ≥ 8 public-preview bar, with no margin.

The developers fixed exactly the two things I put at the top of the Round-7 list, and they fixed them properly:
- **The white folded slabs are gone** from the menu (`01`) and from `06`. The menu's first frame now shows a real boulder-scan island where the crumpled ribbon chain was (`01` x 1440–1900, y 480–730). Cause confirmed in code: the `mountainside`, `namaqualand_cliff_02` and `namaqualand_boulders_01` scans are deleted (`scanIslands.ts:22–39`).
- **The white streaks on the harbour headland are gone** in `10`, `11`, `11c` and `11d` (`snowMaterial.ts:114–117`: faces steeper than ~30° are rock; seeps rarer and grey-blue).
- **The `06` pinstripe is gone.** The vertical high-frequency energy in the measured region fell from 6.09 to 3.67, and the vertical/horizontal ratio from 1.42 to 1.17 (no directional stripe). I checked the harness reasoning: `App.ts:822–827` applies `freeCam` after `session.frame()` updates the world, so the scenery did LOD for the skier. `settle()` (`biome_evidence.mjs:103–115`) now hands the scenery the real camera. This is an evidence fix, plus the strata only on the finest LOD (`cliffKit.ts:133`) and the band fade (`rockMaterial.ts:312–316`). Rounds 5–7 `06` therefore showed a LOD a player would not see from there.
- The gulls are now visible in the gull beat (`08c`).

What did not change (≤ 1 % of pixels in the measured regions, or the same on inspection):
- The cave boulders: still in two lanes, still hovering, still with shards (`07`: 0.20 % changed).
- The summit sugarloaf (`02`).
- The inland boulder confetti (`02`, `09`, `10`, `11h`).
- The scoured-rock slugs and the pillow wedges (`04b`, `12`).
- The reveal massif's mush and crater ring (`11c`, `11i`).
- The glass-cylinder splash (`11h`).
- The rectangular snow-patch edge (`12`).

Several named §4 failures are still on screen, though no longer in the first or the hero frames:
- stretched textures (the headland is now streak-free but still a vertically smeared curtain);
- repeated boulders;
- pillow rocks;
- needle crests (`14`, `06`).

There is still no wet band at any waterline.

Because the two most visible failures are gone, art direction goes from 7.5 to **8**: at the preview bar, not above it. A 9 needs the six Majors below.

## 3. Scores (out of 10, from an art-direction point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **8** | The first frame (menu) and the hero trophy frame are clean for the first time, the `06` slab and pinstripe are gone, and the archipelago is one consistent scanned-rock family. Against that, the remaining Majors are the cave boulders, the sugarloaf, the inland chips, the smeared headland, the needle crests at the viewpoint and the missing wet band. |
| Environmental uniqueness | **8** | The scanned skerries (`03`, `05`, `09d`), the open-sea cave frame (`08`, `08b`), the stockfish racks and waterfront (`11e`, `10`) and the catch shot that faces the water carry a real coastal identity. The summit bowl (`02`), the inland walls and the Expedition arm (`16`) still read as Alpine with a sea backdrop. |
| Skiing and hazard mechanics | 6.5 (low confidence) | Visual read only. The scoured-rock slabs (`04b`, `09d`, `12`) are still slug-shaped plates; the wind-gate windsock and spindrift read clearly (`12`/`12b`). |
| Difficulty and fairness | 7 (low confidence) | Outside my area. Hazards and landing markers (`09b`, `09c`) are legible. |
| Cinematics | 7.5 (low confidence; C's area) | Up from 7: the gulls are in the gull beat (`08c`), and `08` is still the best cave frame. Unchanged: `08b` (Yeti mid-air in front of the face), the splash cylinder (`11h`), the trophy over the presenter's head (`11g`) and the reveal massif (`11c`). The Standard-course set is not delivered. |
| Performance and stability | 7 (low confidence) | Not measured by me; `perf/` is incomplete. The captures show no corruption, and `EVIDENCE.md` reports 0 page errors. |
| Accessibility and controls | 7 (low confidence) | Captions are legible (`08c`, `08d`, `09`, `09d`, `11f2`, `15`). The 1366 menu, summit and pursuit art match the 1920 frames; 2560 is not delivered. |
| Overall player experience | **8** | The run now opens on a clean menu and closes on a streak-free harbour. Mid-run it is still a mix of scanned coast and Alpine-generic inland, and the closing reveal still shows the mushy massif. |

## 4. Defects

### Critical
**None.** No missing assets, broken rendering or corrupted frames in the shots.

### Major

**A8-M1 (carried from A7-M6, not fixed). Cave boulders hover on the snow, laid out in lanes, with loose shards. Tracker F-040 (open, rated m there).**
- Evidence:
  - `07` is 0.20 % changed against Round 7. The slab at x 1005–1170, y 875–960 still reads as hovering (no lip, no contact shade, underside visible).
  - The two lanes are still at x 320–560 and x 930–1100. The shards are still at x 1085–1100, y 1005–1035.
  - `08` x 415–840, y 500–860 and `08c` x 700–890, y 530–640: rocks on a smooth snow plane with no collar.
- I keep this at Major because it sits in the signature set piece, in front of the cave, in four frames.
- Fix:
  - Add a snow collar: a raised ring in the snow heightfield, or a ring mesh with the snow material, around each boulder's intersection line.
  - Add a dark contact decal.
  - Re-scatter into 2–3 clumps of mixed scale.
  - Delete the shard sprites.

**A8-M2 (carried from A7-M3, not fixed). Summit sugarloaf blocks the sea vista. Tracker F-029 OPEN.**
- Evidence: `02` x 900–1470, y 280–640. It is the first gameplay frame of every Fjord run.
- Fix: lower it, or rotate it into an asymmetric headland with the scanned rock face to seaward so the summit frame opens onto the fjord.

**A8-M3 (carried from A7-M4, partial). No wet band at any waterline; foam is a 1–2 px chalk line. F-031 claimed.**
- Evidence:
  - `01_isl.png`, `14_isl.png`: the islands meet the water with a thin pale rim and no darkened, glossy band above it.
  - `06_foot.png`: the cliff foot has a constant white line, and the rock directly above the water is the same matte grey as 200 m up.
  - `11_left.png`: the headland meets the quay water through a mist band, with no wet rock.
- The brief asks for "foam, wet rock". There is foam, minimally; there is no wet rock.
- Fix: in `rockMaterial` and the coast-rock path of `snowMaterial`, darken the albedo by about 35 % and drop the roughness to about 0.25 within 0–3 m above `uWater`. Widen the foam to a broken ring with noise.

**A8-M4 (carried from A7-M5, not fixed). Repeated boulder chips on the inland and harbour walls. Tracker F-032 (chips open).**
- Evidence:
  - `02` x 0–330, y 0–600;
  - `10` x 0–560, y 100–360 (evenly spaced white chips across the headland);
  - `11h` and `11j` above the houses;
  - `09`, `09b`, `16` left wall.
- Fix: cluster the chips in gullies and at the cliff foot as talus, vary their scale 3–5×, and leave most of each face bare. Or use one boulder scan as talus.

**A8-M5 (carried from A7-M2, partial; downgraded in visibility). Harbour headland is a vertically smeared, textureless curtain. F-028 claimed.**
- What is fixed: the white streaks are gone. `10` x 760–960, y 180–420 and `11` x 0–430, y 120–420 no longer show a single white strip.
- What remains:
  - `11_left.png`: the face is smooth grey with soft vertical light/dark smears running the full height, like drapery. There is no rock grain, joint or ledge.
  - Also visible in `11d` x 0–1000, y 120–440, `11g` and `10`. This is the §4 "stretched textures" failure, still in the trophy frame.
- Fix: put the triplanar `rock_face_03` (or the cliff kit) on the coast heightfield's steep faces instead of the planar-projected coast-rock tone. A few horizontal ledges with snow benches would also break the curtain.

**A8-M6 (NEW to my review; the shot is unchanged from Round 7, which I could not review then). Needle crests on the far massif at the scenic viewpoint.**
- Evidence:
  - `14` x 1210–1920, y 0–200: a row of sharp low-poly triangular spires along the crest of the massif, framed as the payoff of the viewpoint. It is identical in Round 7's `14` (now present in `round-7/candidate/`).
  - Milder in `06` x 640–950, y 140–300 and `04` top right.
- §4 names needle crests explicitly.
- Fix: apply the `rangeSoft` crest clamp used on the valley walls to this far massif (cap the ridge-noise amplitude, round the peaks to ≥ 25° apex), or replace the crest silhouette with a scanned skyline.

### Minor
- **m1 (carried). Pale "concrete" parapet rim.**
  - Evidence: `05` x 1000–1920, y 600–1050. It is a smooth grey-white curb with a hard edge.
  - Fix: rock material on the rim ledge.
- **m2 (carried, C's area). `08b`: the Yeti is mid-air in front of a blank face.**
  - Evidence: x 1200–1330, y 460–610. It is unchanged (1.7 %).
- **m3 (carried). Faceted low-poly hillside in the `08`/`08b` framing.**
  - Evidence: `08` x 0–210, y 230–650; `08b` x 0–300, y 520–940.
- **m4 (NEW). Repeated boulder trio on the sea.**
  - Evidence: `03` x 1285–1515, y 335–390 (`03_far.png`), also in `07`, `14`. Three near-identical rounded lumps sit in a row. With only three scans shipped (`scanIslands.ts:22`), small skerries now repeat visibly.
  - Fix: random yaw and non-uniform scale per instance, and never three of one scan in a cluster.
- **m5 (carried). Reveal massif mush and crater ring.**
  - Evidence: `11c` x 1180–1330, y 470–560; `11i`. Only the far island changed (from a slab to a scan).
- **m6 (carried). Scoured-rock slugs.**
  - Evidence: `04b`, `09d` y 780–1080, `12` x 790–1020, y 490–580.
- **m7 (carried). Pillow wedge and rectangular patch edge on the piste.**
  - Evidence: `12` x 295–430, y 700–770; the straight patch edge at x 1130–1920, y 830–900.
- **m8 (carried, partial). Harbour houses.**
  - Evidence: `10`. The right-hand row is now stepped and varied (F-032 claim partly verified), but both rows still sit in an even arc on flat snow. The plunge backdrop (`11h`, `11j`) is still a regimented row.
- **m9 (carried). Leopard-spot plaza.**
  - Evidence: `10` x 600–1050, y 590–720; `10b`.
- **m10 (carried). Menu water ray streaks and the card rock.**
  - Evidence: `01` x 880–1900, y 430–950; x 750–810, y 950–1060. The same at 1366 (`res-1366/01_menu.png`).
- **m11 (carried). `07b` outlook.**
  - Evidence: the "lightning-bolt" ice decal, the hard sheet-shadow edge and no fjord in view.
- **m12 (carried; F-041). Hamlet strand reads as a flat bright wedge with a paper edge.**
  - Evidence: `06` x 520–735, y 755–830 (`06_foot.png`).
- **m13 (carried; F-042). Glass-cylinder splash rim and trophy over the presenter's head.**
  - Evidence: `11h` x 1400–1640, y 270–370 (sheet coordinates ×2); `11g`.
- **m14 (NEW). The `06` wall now reads as smooth clay.**
  - Evidence: `06_wall`: with the strata pinstripe gone, the coarse LOD has broad soft folds and almost no grain at 1.3 km.
  - Fix: a mid-frequency joint/gully term that survives at distance (a ~40–80 m period, as already done for `fol`).
- **m15 (NEW). Viewpoint platform is grey untextured slabs.**
  - Evidence: `14` x 420–900, y 780–990. The planks are flat grey quads stepping down the slope.
  - Fix: a wood material and a ground-hugging deck.

## 5. What works

- **First frame.** The menu sea now has a credible scanned island where the slab chain was. The composition (cliff, skerries, open fjord) is strong at 1920 and 1366.
- **`06` long view.** No slab, no disc, no pinstripe. It is the cleanest long shot of the series and far better than Round 3 (`final/06`: needle crests, white vertical smears).
- **Headland streaks.** They are fixed everywhere I measured (`10`, `11`, `11c`, `11d`). The trophy frame no longer carries white strips.
- **`08c` gulls.** They are now in the frame on the boulders and in the air.
- **Island family.** One coherent scanned-rock look across `01`, `03`, `05`, `09d` and `14`.
- **Evidence quality.** The manifest and `EVIDENCE.md` are delivered, and the pixel probe is a sound diagnostic method. The harness reasoning checks out in code.

## 6. Status of earlier defects (my own verification)

### Round 7 (`round-7/REVIEW_A_art.md`)

| # | Defect | Status | Evidence |
|---|---|---|---|
| A7-M1 | White slab and floating disc in `06` and the menu | **Fixed** | `06`: no slab or disc at x 1580–1920, y 720–990 (20.6 % of the frame changed). `01`: a scan island replaces the ribbons. The scans were removed in code. |
| A7-M2 | Headland snow streaks and stretched texture | **Partial** | The streaks are fixed. The smeared curtain remains (A8-M5). |
| A7-M3 | Summit sugarloaf | **Not fixed** | A8-M2. |
| A7-M4 | Foam and wet band | **Partial** | A thin foam line exists; there is no wet band (A8-M3). |
| A7-M5 | Repeated boulder chips | **Not fixed** | A8-M4. |
| A7-M6 | Cave boulders unseated, in lanes | **Not fixed** | A8-M1 (`07`: 0.20 % changed). |
| m1 | Parapet rim | **Not fixed** | m1. |
| m2 | `08b` mid-air Yeti | **Not fixed** | m2. |
| m3 | Faceted hillside | **Not fixed** | m3. |
| m4 | Flat snow plates on far islands | **Fixed** | The islands are all boulder scans with less snow (`snow 0.6`, `snowFrom 0.8`); `03_far.png` shows no flat plates. |
| m5 | Cliff pinstripe | **Fixed** (as an evidence artefact plus LOD) | Vertical HF 6.09 → 3.67, ratio 1.42 → 1.17. See m14 for the new smoothness. |
| m6 | Reveal mush | **Not fixed** | m5. |
| m7 | Scoured-rock slugs | **Not fixed** | m6. |
| m8 | Pillow rocks | **Not fixed** | m7. |
| m9 | Houses | **Partial** | m8. |
| m10 | Leopard plaza | **Not fixed** | m9. |
| m11 | Menu streaks and card rock | **Not fixed** | m10. |
| m12 | `07b` outlook | **Not fixed** | `07b`: 0.81 % changed. |
| m13 | Hamlet raft | **Not fixed** | m12. |
| m14 | Splash rim, matte plunge water | **Not fixed** (rim); the plunge water reads acceptably as water | m13. |
| m15 | No gulls in the gull beat | **Fixed** | `08c`. |
| m16 | Rectangular patch edge | **Not fixed** | m7. |

### Tracker items in my area (`round-8/DEFECTS.md`)

| ID | Claimed | My verification |
|---|---|---|
| F-008 | CLAIMED | **Partial.** The vertical smearing remains on the headland (A8-M5). The needle crests remain at `14` (A8-M6). |
| F-009 | CLAIMED | **Fixed** (scans; slabs gone). Small-skerry repetition is m4. |
| F-010 / F-030 | CLAIMED | **Partial** (m6). |
| F-011 | CLAIMED | **Mostly fixed**; the rim remains (m1). |
| F-012 | CLAIMED | **Partial** (m12). |
| F-013 / F-031 | CLAIMED | **Partial** (A8-M3). |
| F-016 | VERIFIED (E r4) | **Unverified by me:** `res-2560/` was not delivered. |
| F-023 | CLAIMED | **Mostly fixed**; boulder seating remains (A8-M1). |
| F-026 | CLAIMED | **Fixed** in `06` (measured). |
| F-027 | CLAIMED | **Partial**; the reveal mush remains (m5). |
| F-028 | CLAIMED | **Partial**: the streaks are fixed, the smear remains (A8-M5). |
| F-029 | OPEN | **Open, confirmed** (A8-M2). |
| F-032 | OPEN (partial) | **Partial, confirmed.** The waterfront is stepped; the chips are open (A8-M4, m8). |
| F-036 | CLAIMED | **Fixed** (`01`, `06`). |
| F-037 | CLAIMED | **Fixed** (`08c`). |
| F-040 | OPEN | **Open, confirmed**; I rate it Major (A8-M1). |
| F-041 | OPEN | **Open, confirmed** (m12). |
| F-042 | OPEN | **Open, confirmed** (m13). |

## 7. Public-preview gate (completion brief §10): items in my area

| Gate item | Status | Evidence |
|---|---|---|
| Art direction ≥ 8 | **Met, at the bar** | My score is 8. The first frame and the hero frame are clean; six Majors remain. |
| §4 named failures absent | **Not met** | **Not met:** stretched textures (A8-M5), repeated boulders (A8-M4, m4), pillow rocks (m7), needle crests (A8-M6). **Met:** loaf / cake / cylinder islands (all scans now); concrete or masonry rock (rim residue m1); snow on vertical ocean cliffs (the streaks are gone). **Largely met:** terrain/cliff seams (no pinstripe; the hamlet strand edge m12). |
| Foam and wet rock at the waterline | **Not met** | A8-M3. |
| Varied coves and natural island silhouettes | **Partial** | The silhouettes are natural (`01`, `03`). The `06` coastline is still long and straight, and the small skerries repeat (m4). |
| No snow-coloured water in the victory | **Met** | `11`, `11d`, `11h`, `11j`. |
| Poly Haven materials and models used meaningfully | **Partial** | Used on the islands, the cave and the boulders. Not used on the headland, the parapet or the viewpoint deck. |
| Art verified at 1366×768 and 2560×1440 | **Not met (incomplete evidence)** | 1366: `01`, `02`, `09` and `09d` were present; the three I viewed are fine. 2560: `res-2560/` was absent. |
| Standard-course cave art | **Not met (no evidence)** | `standard/` was absent. |

**Bottom line.** On my own category the art-direction gate item (≥ 8) is met, narrowly. Full approval (9) is not close. The shortest path to a 9:
1. Seat the cave boulders and re-cluster them (A8-M1).
2. Add a wet band and a broken foam ring (A8-M3).
3. Put real rock on the headland (A8-M5).
4. Reshape the sugarloaf (A8-M2).
5. Soften the viewpoint massif crest (A8-M6).
6. Cluster the inland chips (A8-M4).
7. Deliver `res-2560/` and `standard/`.
