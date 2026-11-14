# Fjord Coast, Round 9 (final): Reviewer A, art direction

- **Reviewer:** A (art direction).
- **Nature of review:** model-based reviewer, same model family as the developers; not an external human.
- **Build:** `3bf5a7e` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`).
- **Date:** 2026-11-14.
- **Supersedes:** my preliminary report on `e0e2eca` (`round-9/prelim-e0e2eca/REVIEW_A_art.md`).

**Method**
- I checked the build claims in git:
  - `git diff --stat e0e2eca 3bf5a7e -- src` touches only `src/world/caveTerrain.ts`. The jamb cap now acts only within `JAMB_CAP.cd = 1.6` of the chamber path; before, the limit was `cd < 2.6`.
  - `git diff c9ffd1b e0e2eca -- src` also touches only `caveTerrain.ts`. So every non-cave shot (drawn by `c9ffd1b`) shows the candidate's art.
- I read the art diff `d1f642b..3bf5a7e`:
  - `rockMaterial.ts:360–363`: the wet band widens with distance.
  - `snowMaterial.ts:160–161`: the shore wash widens with distance.
  - `coast.ts:707–712`: the far-massif summit uses three octaves, compressed above 0.55.
  - `seaCave.ts:390–420`: boulders are bedded at 0.62 of their height, are solid, and their geometry is shared.
  - `caveTerrain.ts`: the jamb cap.
- I compared each shot with Round 8 (threshold 12/255; `scratch/review-a-r9/d.py`, `dm.py`):
  - Non-cave shots changed by ≤ 2.3 %, except `09` and `10` (about 4.5 %).
  - Re-rendered cave shots: `07` 2.0 %, `07b` 0.4 %, `08` 2.8 %, `08b` 1.7 %, `08c` 67 % (new camera), `08d` 23 % (new framing).
- I viewed every re-rendered cave shot on `3bf5a7e`: `07` at full size; the rest on contact sheets `t1`–`t3`.
  - Sprint: `07`, `07b`, `08`, `08b`, `08c`, `08d`.
  - Standard: `07`, `07b`, `08`, `08b`, `08c`, `08d`.
- From the preliminary pass, still valid because those shots were not re-rendered:
  - full-size views of `03`, `06`, `10`, `14`;
  - contact sheets `s1`–`s3` and `s2560`.
- Crops (Round 8 on top, Round 9 below, unless noted):
  - `c07_mouth_3bf.png`: Sprint mouth.
  - `c_s07_mouth.png`, `c_s08_mouth.png`: Standard mouth (candidate only).
  - `c08c_both.png`: gull-beat boulders, Sprint and Standard, candidate.
  - `c14_crest.png`, `c14_isl.png`, `c06_foot.png`, `c06_crest.png`, `c01_isl.png`, `c11_left.png`.
- Bright-pixel count inside the Sprint mouth (`07` x 840–1060, y 440–620, max channel > 150): **0**. On `e0e2eca` the shard was there.
- Wet-band luminance probe on the `06` cliff foot (`wet.py`).
- `npx vitest run tests/unit/fjord_art.test.ts tests/unit/fjord_reveal.test.ts`: 8/8 pass.
- `round-9/TESTS.md` reports 19/19 browser tests passing on the candidate's code and 311/311 unit tests on `3bf5a7e`. I did not re-run them.

## 2. Verdict: **FAIL** against 9/10. Art direction holds at the ≥ 8 preview bar, with no margin.

**Fixed since the preliminary review.** The `3bf5a7e` re-render clears my preliminary A9-M1 (prelim-A9-M1 in the tables below). The Sprint cave mouth no longer shows the white shard or the sky holes (`c07_mouth_3bf.png`; 0 bright pixels in the mouth). The Standard mouth is clean in `standard/07` and `standard/08`, with no snow wedge over the Yeti. The narrower jamb cap does what it claims.

**Unchanged from Round 8.** Outside the cave, Round 9 barely changed the picture:
- The viewpoint crest (`14`) lost its worst needle spire. That is the one clear improvement.
- The claimed wet band is not legible at the islands, the headland or most of the cliff foot.
- The headland curtain (F-050), the chips (F-032), the summit sugarloaf (F-029) and the reveal massif (F-051) are untouched.

**Cave set piece: one gain, three losses.**
- Gain: the boulders are bedded deeper, and their undersides no longer show.
- Loss: they are still in lanes, with no snow collar.
- Loss: the snow shader now paints their thin cut edges into white paper flaps.
- Loss: the gull beat looks down the inland valley on both lengths, and the Standard cave set shows no fjord in three of six frames.

The §4 failures still on screen are stretched textures, repeated boulders and pillow rocks.

**Scores.** I keep art direction at **8**: the first frame, the long view, the harbour and the trophy frames are clean, and the cave-mouth regression is gone. Environmental uniqueness is **7.5**: the default-length course's cave sequence reads as an Alpine valley.

## 3. Scores (out of 10, from an art-direction point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **8** | The hero frames (`01`, `06`, `10`, `11`, `11d`) are clean, the `14` crest is better, and the cave mouth is clean on both lengths. Against that, six Majors remain: boulder flaps and lanes, the inland gull beat and Standard set, the headland curtain, the chips, the illegible wet band, and the sugarloaf. At the bar, not above it. |
| Environmental uniqueness | **7.5** | The Standard (default-length) cave set shows no sea in `07`, `08` or `08b`, and the gull beat frames the inland valley and its chips on both lengths. The skerries, the harbour and the Sprint `08`/`08b` still carry a strong coastal identity. |
| Skiing and hazard mechanics | 6.5 (low confidence) | Visual read only, unchanged. The scoured-rock slabs are still slug plates (`04b`, `12`). Windsock and spindrift read clearly. |
| Difficulty and fairness | 7 (low confidence) | Outside my area. Markers and hazards are legible (`09b`, `09c`). |
| Cinematics | 7 (low confidence; C's area) | The Sprint `08` and `08b` frame the sea well, and the roar (`08d`, both lengths) is grounded and readable. The Yeti is not visible before his growl in either `08c`. Against that, the Standard emergence and leap have no fjord, and the gull beat looks inland. |
| Performance and stability | 7.5 (low confidence) | Not measured by me. `EVIDENCE.md` reports Fjord production-bundle CPU p99 of 11.9 ms with 0 frames over 33 ms (software renderer; no GPU claim). No corrupted frames. |
| Accessibility and controls | 7.5 (low confidence) | The instruction subtitle sits on a legible dark pill (`15`). The 2560 menu, summit and finish frames are consistent. `TESTS.md` reports the menu spec, including keyboard/mouse/gamepad, passing on `3bf5a7e`. |
| Overall player experience | **8** | The run opens and closes cleanly. The default-length cave sequence has lost its coastal read, and the mid-run inland stays Alpine-generic. |

## 4. Defects

### Critical
**None.** No missing assets, crashes or corrupted frames. The preliminary cave-mouth artefact is fixed.

### Major

**A9-M1 (carried from A8-M1, partial; F-040). Cave boulders: still in lanes, no snow collar, and now snow-painted flaps.**
- What improved: no visible undersides (`07` x 1020–1180, y 870–960).
- What remains:
  - Two lanes in `07` (x 320–530 and x 930–1180), plus a loose shard at x 995–1050, y 990–1060.
  - **New this round:** with the crowns cut at the waist, the `snowFrom 0.62` shader paints the scans' thin edges white. They read as paper flaps standing off the rock:
    - `08c` x 330–700, y 680–960;
    - `standard/08c` x 1120–1550, y 740–850 (`c08c_both.png`, re-rendered on `3bf5a7e`).
  - `standard/07` x 300–365, y 915–985: a stick-like sliver.
  - No snow collar or contact shade anywhere.
- Fix:
  - Mask snow by the scan's original local height, so only the true crown gets snow, or raise `snowFrom` for the bedded set.
  - Add a collar ring in the snow material.
  - Cull crowns thinner than about 0.3 m.
  - Re-cluster the Sprint set into 2–3 mixed clumps, as the Standard set already is.

**A9-M2 (NEW in Round 9). The default-length cave sequence has no coast, and the gull beat looks inland on both lengths.**
- Evidence (`3bf5a7e`):
  - `standard/07`, `standard/08` and `standard/08b` show no sea. `standard/08b` is the Yeti leaping over an inland valley whose wall is covered in chips.
  - Sprint `08c`: the camera stands beside the gulls and looks down the inland valley, with the cave and the sea out of frame. Round 8's `08c` at least held the cave.
  - `standard/08c`: valley wall and chips, with a sliver of sea at the far right.
- The round-9 fix for C r8 #1 (Yeti visible before his growl) works, but it traded the coast for the least coastal view in the level.
- Fix: keep the gull group in the near plane and aim the camera seaward (the `seaFraming` stations used for `08`). Apply F-024's seaward stations to the Standard `07`, `08` and `08b`.

**A9-M3 (carried from A8-M5; F-050 OPEN, confirmed). Harbour headland is a vertically smeared, textureless curtain.**
- Evidence: `c11_left.png`. Unchanged from Round 8, and still in the trophy frames (`11`, `11d`, `11g`, `10`).
- Fix: triplanar `rock_face_03` on the steep faces of the coast heightfield, plus a few ledges with snow benches.

**A9-M4 (carried from A8-M4; F-032 chips OPEN, confirmed). Repeated boulder chips on the inland walls, now also in the cinematic.**
- Evidence:
  - `02` left wall;
  - `10` x 0–560, y 100–360;
  - `07b` and `standard/07b` (dozens of identical chips across the wall seen from the cave);
  - `standard/08b` and `standard/08c`;
  - Sprint `08c` upper wall;
  - `09`, `16`.
- Fix: cluster them as talus in gullies and at the wall foot, vary scale 3–5×, and leave most faces bare.

**A9-M5 (carried from A8-M3; F-048 claimed, partial). The wet band does not read on screen.**
- Evidence:
  - `06` cliff foot (`wet.py`): luminance 2–12 px above the foam fell by about 12 % at x 250–350 only (111→98, 116→101, 94→83). At x 400–650 there is no consistent change; the mean ratio went 0.97 → 0.99, which is noise.
  - The islands are identical to Round 8 (`c01_isl.png`, `c14_isl.png`). The scans are already near-black, so darkening cannot read, and there is no gloss.
  - Headland: unchanged.
- Fix:
  - On the cliffs and headland, a 3–6 m band at near range with visible gloss (roughness about 0.2 plus a sky reflection), set against lighter rock above.
  - On the islands, lift the rock tone above the band.
  - Break the foam into a noisy ring.

**A9-M6 (carried from A8-M2; F-029 OPEN, confirmed). Summit sugarloaf blocks the sea vista.**
- Evidence: `02`, `res-2560/02`, unchanged.
- Fix: lower it, or turn it into an asymmetric headland with the scanned face to seaward.

### Minor
- **m1 (was A8-M6; F-049 mostly fixed). Faceted peaks on the viewpoint massif.**
  - Evidence: `14` x 1250–1350, y 90–140 and x 1400–1500, y 20–100 (`c14_crest.png`). The single-vertex needle is gone.
  - The `06` massif at x 640–950, y 140–300 is unchanged (`c06_crest.png`).
- **m2 (carried). Pale "concrete" parapet rim.**
  - Evidence: `05` x 1000–1920, y 600–1050.
- **m3 (carried). Faceted low-poly hillside.**
  - Evidence: `08` left edge.
- **m4 (carried). Repeated boulder trio on the sea.**
  - Evidence: `03` x 1285–1515, y 335–390; `14` x 1000–1225, y 415–465.
- **m5 (carried; F-051 OPEN). Reveal massif mush and terraces.**
  - Evidence: `11c`, `11i`.
- **m6 (carried). Scoured-rock slugs.**
  - Evidence: `04b`, `12`.
- **m7 (carried). Pillow wedge and rectangular patch edge.**
  - Evidence: `12`.
- **m8 (carried). Houses in an even arc on flat snow; regimented plunge backdrop.**
  - Evidence: `10`, `11h`.
- **m9 (carried). Leopard-spot plaza.**
  - Evidence: `10` x 600–1050, y 590–720; `res-2560/10b`.
- **m10 (carried). Menu water ray streaks and the card rock.**
  - Evidence: `01`, `res-2560/01`.
- **m11 (carried). `07b` outlook.**
  - Evidence: lightning-bolt ice decal, hard shadow edge, no fjord. The top of the wall shows pixel-stepped shading (both lengths, upper right).
- **m12 (carried; F-041). Hamlet strand reads as a flat paper-edged sheet.**
  - Evidence: `06` x 520–735, y 755–830. Slightly darker than in Round 8.
- **m13 (carried; F-042). Glass-cylinder splash rim; trophy over the presenter's head.**
  - Evidence: `11h`, `11g`.
- **m14 (carried). Smooth clay wall at 1.3 km.**
  - Evidence: `06`.
- **m15 (carried). Viewpoint platform is grey untextured slabs.**
  - Evidence: `14` x 420–900, y 780–990.
- **m16 (NEW). Dark smeared slab in the Sprint gull beat.**
  - Evidence: `08c` around x 660–770, y 435–450. Probably a scoured-rock plate seen edge-on and motion-blurred.
- **m17 (NEW). Unidentified pale object at the top-right edge of `standard/07`.**
  - Evidence: x 1690–1760, y 0–50.

## 5. What works

- **Cave mouths.** Both lengths are clean on `3bf5a7e`: no shard, no sky holes and no snow wedge. The developers diagnosed the preliminary finding correctly and fixed it narrowly.
- **First frame and the long view.** `01` and `06` show one consistent scanned island family, with no slabs and no pinstripe. They match at 1366 and 2560.
- **`14` crest.** The worst needle is gone.
- **Sprint cave frames.** `08` (the Yeti at the mouth, archipelago behind) and `08b` (the leap, fjord to the left) are the best frames in the set.
- **The roar.** `08d` on both lengths: the Yeti is grounded, with spray and mist, and the lighting is controlled.
- **Harbour finish and trophy.** Waterfront colour, racks, lights, and water that is not snow (`10`, `11`, `11d`, `11h`).
- **Evidence.** The Standard set, `res-2560`, the manifests and the build-split table are all delivered, and the build claims check out in git.

## 6. Status of earlier defects (my own verification)

### Preliminary Round 9 (`prelim-e0e2eca/REVIEW_A_art.md`)

| # | Defect | Status on `3bf5a7e` | Evidence |
|---|---|---|---|
| prelim-A9-M1 | White shard and sky holes in the Sprint cave mouth | **Fixed** | `c07_mouth_3bf.png`; 0 bright pixels in the mouth box; `standard/07` and `08` also clean (`c_s07_mouth.png`, `c_s08_mouth.png`). |
| prelim-A9-M2…M7 | Boulders, inland gull beat and Standard set, headland, chips, wet band, sugarloaf | **Still hold** | Now A9-M1…M6. Re-rendered shots confirm the boulder flaps and the inland framing. |

### Round 8 (`round-8/REVIEW_A_art.md`)

| # | Defect | Status | Evidence |
|---|---|---|---|
| A8-M1 | Cave boulders hover, in lanes, with shards | **Partial** | Seated deeper, no undersides; lanes and no collar remain; new snow flaps (A9-M1). |
| A8-M2 | Summit sugarloaf | **Not fixed** | A9-M6. |
| A8-M3 | No wet band; chalk foam line | **Partial (not visible)** | A9-M5. |
| A8-M4 | Repeated chips | **Not fixed**, more exposed | A9-M4. |
| A8-M5 | Headland curtain | **Not fixed** | A9-M3. |
| A8-M6 | Needle crests at the viewpoint | **Mostly fixed** | `c14_crest.png`; m1. |
| m1 | Parapet rim | Not fixed | m2. |
| m2 | `08b` mid-air Yeti over a blank face | **Fixed on Sprint** | `08b` frames the leap with the fjord. `standard/08b` is inland (A9-M2). |
| m3 | Faceted hillside | Not fixed | m3. |
| m4 | Boulder trio | Not fixed | m4. |
| m5 | Reveal mush | Not fixed | m5. |
| m6 | Scoured-rock slugs | Not fixed | m6. |
| m7 | Pillow wedge and patch edge | Not fixed | m7. |
| m8 | Houses | Not fixed | m8. |
| m9 | Leopard plaza | Not fixed | m9. |
| m10 | Menu streaks and card rock | Not fixed | m10. |
| m11 | `07b` outlook | Not fixed | m11. |
| m12 | Hamlet strand | Marginal | m12. |
| m13 | Splash rim and trophy over the head | Not fixed | m13. |
| m14 | Clay wall | Not fixed | m14. |
| m15 | Viewpoint deck | Not fixed | m15. |
| (gate) | `res-2560/` and `standard/` missing | **Fixed** (delivered) | Both viewed. |

### Tracker items in my area (`round-9/DEFECTS.md`)

| ID | Claimed | My verification |
|---|---|---|
| F-008 | CLAIMED | **Partial.** The headland smear remains (F-050); the crest is improved at `14` and unchanged in `06`. |
| F-009 | CLAIMED | **Fixed** (scans). Small-skerry repetition remains (m4). |
| F-010 / F-030 | CLAIMED | **Partial** (m6). |
| F-011 | CLAIMED | **Mostly fixed**; the rim remains (m2). |
| F-012 | CLAIMED | **Partial** (m12). |
| F-013 / F-031 | CLAIMED | **Partial.** A thin foam line only; see F-048. |
| F-016 | VERIFIED | **Confirmed** for art: `res-2560/*` consistent. |
| F-023 | CLAIMED | **Mostly fixed** (no lintel or net); the boulders are A9-M1. |
| F-024 (C's area) | CLAIMED | **Not met in the delivered Standard set**: no sea in `standard/07`, `08` or `08b` (A9-M2). |
| F-026 | CLAIMED | **Fixed** (no pinstripe). |
| F-027 | CLAIMED | **Partial** (m5). |
| F-028 | CLAIMED | **Fixed for the streaks**; the curtain is F-050. |
| F-029 | OPEN | **Open, confirmed** (A9-M6). |
| F-032 | OPEN (partial) | **Open, confirmed**; the chips are more exposed (A9-M4). |
| F-036 | CLAIMED | **Fixed** (`01`, `06`). |
| F-040 | CLAIMED (r9) | **Partial.** Bedded deeper and solid in code (`seaCave.ts:397–401`, `colliders`); on screen: lanes, no collar, snow flaps (A9-M1). |
| F-041 | OPEN | **Open**, marginally better (m12). |
| F-042 | OPEN | **Open, confirmed** (m13). |
| F-048 | CLAIMED (r9) | **Partial; not legible at the islands, the headland or most of the cliff foot** (A9-M5). |
| F-049 | CLAIMED (r9) | **Mostly fixed at `14`**; faceted peaks remain; the `06` massif is unchanged (m1). |
| F-050 | OPEN | **Open, confirmed** (A9-M3). |
| F-051 | OPEN | **Open, confirmed** (m5). |
| Cave-mouth jamb (fa0352d, 6598705) | CLAIMED (r9) | **Fixed.** No snow wedge on Standard and no shard or holes on Sprint (`3bf5a7e`). |

## 7. Public-preview gate (completion brief §10): items in my area

| Gate item | Status | Evidence |
|---|---|---|
| Art direction ≥ 8 | **Met, at the bar (no margin)** | My score is 8. |
| §4 named failures absent | **Not met** | **Not met:** stretched textures (A9-M3), repeated boulders (A9-M4, m4), pillow rocks (m7). **Largely met:** needle crests (m1). **Met:** loaf / cake / cylinder islands; snow on vertical ocean cliffs. **Mostly met:** concrete or masonry rock (m2); terrain/cliff seams (no pinstripe; the cave-mouth seam fixed). |
| Foam and wet rock at the waterline | **Not met** | Foam: a thin line. Wet rock: not legible (A9-M5). |
| Varied coves and natural island silhouettes | **Partial** | The silhouettes are natural; the `06` coastline is straight and the small skerries repeat. |
| No snow-coloured water in the victory | **Met** | `11`, `11d`, `11h`, `11j`. |
| Poly Haven materials and models used meaningfully | **Partial** | Islands, cave shell and boulders (with the flap problem); not the headland, parapet or deck. |
| Art verified at 1366×768 and 2560×1440 | **Met** (menu, summit, finish) | `res-1366/*`, `res-2560/*`. |
| Standard-course cave art | **Not met** | The cave mouth is clean, but there is no sea in three of six frames and the gull beat looks inland (A9-M2). |

**Bottom line.** The art-direction gate item (≥ 8) is met, narrowly. Full approval (9) is not close. The shortest path to a 9:
1. Aim the gull beat and the Standard cave shots seaward (A9-M2).
2. Fix the boulder snow flaps and add collars (A9-M1).
3. Put real rock on the headland (A9-M3).
4. Cluster the chips (A9-M4).
5. Make the wet band legible (A9-M5).
6. Reshape the sugarloaf (A9-M6).
