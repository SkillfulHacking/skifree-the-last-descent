# Fjord Coast, Round 9: Reviewer A, art direction

- **Reviewer:** A (art direction).
- **Nature of review:** model-based reviewer, same model family as the developers; not an external human.
- **Build:** `e0e2eca` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`). Most shots were drawn by `c9ffd1b`; the cave and cinematic shots were drawn by `e0e2eca`.
- **Date:** 2026-11-14.

**Method**
- I checked the build claim. `git diff --stat c9ffd1b e0e2eca -- src` touches only `src/world/caveTerrain.ts` (+11/−1). The claim holds.
- I read the art diff `d1f642b..e0e2eca`:
  - `rockMaterial.ts:360–363`: the wet band widens with distance.
  - `snowMaterial.ts:160–161`: the shore wash widens with distance.
  - `coast.ts:707–712`: the far-massif summit now uses three ridged octaves, compressed above 0.55.
  - `seaCave.ts:390–420`: boulders are bedded at 0.62 of their height and get colliders.
  - `caveTerrain.ts:357–367`: the jamb cap.
- Per-shot pixel difference against Round 8 (threshold 12/255, `scratch/review-a-r9/d.py`):
  - Every non-cave shot changed by ≤ 2.3 %, except `09` (4.5 %), `10` (4.4 %) and `08d` (10 %). `08c` changed by 67 % (new camera).
  - Change maps for `01`, `03`, `06` and `10` are in `dm.py`. In `06` the change is a thin line along the cliff-foot waterline.
- I viewed at full size: `03`, `06`, `07`, `08`, `08b`, `08c`, `08d`, `10`, `14`, and all six `standard/` shots. Contact sheets (`s1`–`s3`, `s2560`) cover `01`, `02`, `04b`, `05`, `09`, `11`, `11c`, `11g`, `11h`, `12`, `15`, `16` and all four `res-2560/` shots.
- Before/after crops (Round 8 on top, Round 9 below):
  - `c14_crest`, `c14_isl`: viewpoint crest and islands;
  - `c06_foot`, `c06_crest`: cliff foot and crest in `06`;
  - `c01_isl`: menu island;
  - `c11_left`: headland in the trophy shot;
  - `c07_mouth`, `c07_bould`: cave mouth and boulders in `07`;
  - `c08c_fg`, `c08cs_fg`, `c08c_smudge`: gull-beat foreground and the dark smear.
- Wet-band luminance probe (`wet.py`) on the `06` cliff foot.
- `npx vitest run tests/unit/fjord_art.test.ts tests/unit/fjord_reveal.test.ts`: 8/8 pass.
- `round-9/TESTS.md` was not present when I finished.

## 2. Verdict: **FAIL** against 9/10. Art direction holds at the ≥ 8 preview bar, still with no margin.

Round 9 changed very little that a player can see. The non-cave set is almost unchanged from Round 8 (≤ 2.3 % of pixels in most shots).

What improved:
- **Viewpoint crest (`14`).** The tallest single-vertex spire is gone and the small spikes are now shoulders. A few faceted triangular peaks remain at x 1250–1350.
- **Cave boulders.** They now sit two-thirds under the snow and their undersides no longer show.
- **Evidence.** The Standard-course set and `res-2560/` were delivered for the first time. The 2560 frames match the 1920 art.

What did not reach the screen:
- **The claimed wet band.** In `06` I measured about 12 % darkening above the foam on some columns (x 250–350) and nothing on others. The islands (`01`, `14`, `03`) are identical to Round 8. The headland (`11`) is unchanged.

What got worse:
- **New artefact in the Sprint cave mouth (`07`).** A bright white sliver now floats inside the dark mouth, at the centre of the foreshadow frame, next to two sky-blue holes.
- **The deeper boulder bedding exposes thin white snow-painted flaps** that overhang the rock (`08c`, `standard/08c`).
- **The new gull-beat camera looks inland.** On both Sprint and Standard, `08c` shows the valley wall full of boulder chips instead of the cave or the sea.
- **The Standard cave set shows no fjord** in `07`, `08` and `08b`. Only `standard/08c` has a sliver of sea.

Still on screen from the §4 list: stretched textures (the headland curtain, F-050, untouched), repeated boulders (the chips, now even more visible in the cinematic), and pillow rocks.

I keep art direction at **8** because the first frame, the long view, the harbour and the trophy frames are still clean. The new regressions sit in the signature cave set piece, so this 8 is weaker than Round 8's. Environmental uniqueness drops to **7.5**: the default-length course's cave sequence now reads as an Alpine valley.

## 3. Scores (out of 10, from an art-direction point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **8** | The hero frames (`01`, `06`, `10`, `11`, `11d`) are unchanged and clean, and the `14` crest is better. Against that: there is a new floating sliver and sky holes in the `07` cave mouth, snow flaps on the boulders, and four Majors from Round 8 are still open (headland curtain, chips, sugarloaf, wet band not visible). At the bar, not above it. |
| Environmental uniqueness | **7.5** | Down from 8. The Standard (default-length) cave set shows no sea in `07`, `08` or `08b`. The gull beat on both lengths frames the inland valley and its chip confetti. The scanned skerries, the harbour and the Sprint cave frames (`08`, `08b`) still carry the coast. |
| Skiing and hazard mechanics | 6.5 (low confidence) | Visual read only, unchanged: the scoured-rock slabs are still slug plates (`04b`, `12`). Windsock and spindrift read clearly. |
| Difficulty and fairness | 7 (low confidence) | Outside my area. Markers and hazards are legible (`09b`, `09c`). |
| Cinematics | 7 (low confidence; C's area) | Down from 7.5. The Standard emergence (`standard/08`) and leap (`standard/08b`) have no fjord, and the gull beat now looks inland. The Sprint `08` and `08b` still frame the sea well. The Yeti is no longer visible before his growl in either `08c`. |
| Performance and stability | 7.5 (low confidence) | Not measured by me. `EVIDENCE.md` reports Fjord CPU p99 of 11.9 ms and 0 frames over 33 ms in the production bundle (software renderer; no GPU claim). No corrupted frames. |
| Accessibility and controls | 7.5 (low confidence) | The instruction subtitle now sits on a dark pill and is legible (`15`). The 2560 menu, summit and finish are delivered and consistent. |
| Overall player experience | **8** | Essentially the Round-8 experience. The first and last frames are clean. The default-length cave sequence has lost its coastal read, and the mid-run inland stays Alpine-generic. |

## 4. Defects

### Critical
**None.** No missing assets, crashes or corrupted frames in any shot.

### Major

**A9-M1 (NEW, regression). White sliver and sky holes inside the Sprint cave mouth.**
- Evidence:
  - `07_yeti_cave.png` x 940–972, y 483–556: a bright white curved shard floating in the dark opening, at frame centre.
  - x 975–1000, y 460–500 and x 1010–1050, y 500–520: two blue patches, read as sky through the shell.
  - Crop: `scratch/review-a-r9/c07_mouth.png`. Round 8's `07` (same pose) has neither.
- Likely cause (not proven):
  - `probe-cave.json` at (0.5, 0.5) lists cave-rock at 46 m, then **the snow terrain (`skifree-snow-v6:fjord`) at 48 m**, then cave-rock again.
  - The new jamb cap in `caveTerrain.ts:357–367` (fa0352d) lowers the heightfield just inside the mouth, and may expose a terrain edge and a gap in the shell.
- Fix: probe the shard's pixel. If it is the terrain, restrict the cap to the Standard cave's jamb geometry, or keep the terrain under the chamber floor mesh everywhere inside `MOUTH_U`. Close the shell gap so no sky shows through.

**A9-M2 (carried from A8-M1, partial; F-040). Cave boulders: still in lanes, no snow collar, and now thin snow-painted flaps.**
- What improved: the slabs no longer show undersides (`07` x 1020–1180, y 870–960).
- What remains:
  - `07` keeps two lanes (x 320–530 and x 930–1180) and a loose shard (x 995–1050, y 990–1060).
  - **New:** with the crowns cut at the waist, the `snowFrom 0.62` shader paints the scan's thin edges white. These read as paper flaps standing off the rock: `08c` x 350–700, y 690–950 (`c08c_fg.png`) and `standard/08c` x 1120–1550, y 740–850 (`c08cs_fg.png`).
  - `standard/07` x 300–365, y 915–985 shows a thin stick-like sliver.
  - There is still no snow collar or contact shade anywhere.
- Fix:
  - Raise `snowFrom` for the bedded boulders, or mask snow by the original scan's height, so only the true top gets snow.
  - Add a snow collar ring.
  - Drop the crowns thinner than about 0.3 m, or pick yaw so their broad face is up.
  - Re-cluster the Sprint set into 2–3 mixed clumps, as the Standard set already is.

**A9-M3 (NEW to my review: the Standard set had not been delivered before). The default-length cave sequence has no coast, and the gull beat looks inland on both lengths.**
- Evidence:
  - `standard/07`, `standard/08` and `standard/08b` show no sea. `standard/08b` is the Yeti leaping over an inland valley whose wall is covered in chips (x 1000–1900, y 120–700).
  - `08c` (Sprint): the camera stands beside the gulls and looks down the inland valley. The cave and the sea are both out of frame; the chips are at x 900–1900, y 120–330. Round 8's `08c` at least held the cave.
  - The change was made in round 9 for C r8 #1 (the Yeti showed before his growl). It fixed that, but traded the coast for the least coastal view in the level.
- Fix: keep the gull group in the near plane, but aim the camera seaward (the `seaFraming` stations already used for `08`). On Standard caves, apply F-024's seaward stations to `07`, `08` and `08b`.

**A9-M4 (carried from A8-M5; F-050 OPEN, confirmed). Harbour headland is a vertically smeared, textureless curtain.**
- Evidence: `c11_left.png`. It is pixel-identical in character to Round 8 and still in the trophy frame (`11`, `11d`, `11g`, `10`).
- Fix: as in Round 8. Put triplanar `rock_face_03` on the steep faces of the coast heightfield, and add a few ledges.

**A9-M5 (carried from A8-M4; F-032 chips OPEN, confirmed). Repeated boulder chips on the inland walls, now in the cinematic too.**
- Evidence:
  - `02` left wall;
  - `10` x 0–560, y 100–360;
  - `07b` and `standard/07b`: dozens of identical chips across the wall seen from inside the cave;
  - `standard/08b` and `standard/08c` x 150–1250, y 150–650;
  - `09`, `16`.
- Fix: cluster them as talus in gullies and at the wall foot, vary scale 3–5×, and leave most faces bare.

**A9-M6 (carried from A8-M3; F-048 claimed, partial). The wet band does not read on screen.**
- Evidence:
  - `06` cliff foot (`wet.py`): mean luminance 2–12 px above the foam vs 25–50 px above went 111→98, 116→101 and 94→83 at x 250–350 (about 12 % darker). At x 400–650 there is no consistent change. The mean ratio went 0.97→0.99 (noise).
  - `c06_foot.png`: a faint darker band is visible only on the left. The constant white foam line dominates.
  - Islands: `c01_isl.png` and `c14_isl.png` are identical to Round 8. The scans are already near-black, so a 45 % darkening cannot read, and I see no gloss.
  - Headland: unchanged (`c11_left.png`).
- Fix: on the cliff and headland faces, the band needs contrast against a lighter rock above it: about 3–6 m at near range and visible gloss (roughness about 0.2 with a sky reflection term). On the islands, lift the rock tone above the band instead of darkening the band further. Break the foam line into a noisy ring.

**A9-M7 (carried from A8-M2; F-029 OPEN, confirmed). Summit sugarloaf blocks the sea vista.**
- Evidence: `02`, `res-2560/02`: unchanged.
- Fix: as before.

### Minor
- **m1 (A8-M6, downgraded: F-049 partial). Faceted peaks on the viewpoint massif.**
  - Evidence: `14` x 1250–1350, y 90–140 and x 1400–1500, y 20–100 (`c14_crest.png`). The single-vertex needle is gone; low-poly triangular peaks remain.
  - Also `06` x 640–950, y 140–300 (`c06_crest.png`), identical to Round 8: that massif is outside the `coast.ts` change.
- **m2 (carried). Pale "concrete" parapet rim.**
  - Evidence: `05` x 1000–1920, y 600–1050.
- **m3 (carried). Faceted low-poly hillside.**
  - Evidence: `08` x 0–210, y 230–650.
- **m4 (carried). Repeated boulder trio on the sea.**
  - Evidence: `03` x 1285–1515, y 335–390; `14` x 1000–1225, y 415–465.
- **m5 (carried; F-051 OPEN). Reveal massif mush and terraces.**
  - Evidence: `11c`, `11i`: unchanged.
- **m6 (carried). Scoured-rock slugs.**
  - Evidence: `04b`, `12` x 790–1020, y 490–580.
- **m7 (carried). Pillow wedge and rectangular patch edge.**
  - Evidence: `12`.
- **m8 (carried). Harbour houses in an even arc on flat snow; regimented plunge backdrop.**
  - Evidence: `10`, `11h`.
- **m9 (carried). Leopard-spot plaza.**
  - Evidence: `10` x 600–1050, y 590–720; `res-2560/10b`.
- **m10 (carried). Menu water ray streaks and the card rock.**
  - Evidence: `01`, `res-2560/01`.
- **m11 (carried). `07b` outlook.**
  - Evidence: lightning-bolt ice decal, hard shadow edge, no fjord.
  - New observation: the wall's top shows blocky, pixel-stepped shading at x 1000–1600, y 0–300 in `07b` and `standard/07b`.
- **m12 (carried; F-041). Hamlet strand reads as a flat wedge.**
  - Evidence: `06` x 520–735, y 755–830. It is slightly darker than in Round 8 (`c06_foot.png`), but still a flat paper-edged sheet.
- **m13 (carried; F-042). Glass-cylinder splash rim; trophy over the presenter's head.**
  - Evidence: `11h`, `11g`.
- **m14 (carried). Smooth clay wall at 1.3 km.**
  - Evidence: `06`.
- **m15 (carried). Viewpoint platform is grey untextured slabs.**
  - Evidence: `14` x 420–900, y 780–990.
- **m16 (NEW). Dark smeared slab in the gull beat.**
  - Evidence: `08c` x 660–770, y 435–450 (`c08c_smudge.png`). It is a black, motion-blurred sliver on the snow, probably a scoured-rock plate seen edge-on.
  - Fix: bias the camera off it, or skip it in that shot.
- **m17 (NEW, minor). Unidentified beige object at the top-right edge of `standard/07`.**
  - Evidence: x 1690–1760, y 0–50.

## 5. What works

- **First frame and the long view.** `01` and `06` stay clean: one consistent scanned island family, no slabs, no pinstripe. `res-2560/01` and `02` match.
- **`14` crest.** The worst needle is gone, and the viewpoint payoff reads as a mountain rather than a row of teeth.
- **Sprint cave frames.** `08` (Yeti at the mouth with the archipelago behind him) and `08b` (the leap with the fjord on the left) are the best frames in the set.
- **The roar.** `08d` and `standard/08d` read well: the Yeti is grounded, and there are spray and mist.
- **Harbour finish and trophy.** Waterfront colour, racks, lights and water that is not snow (`10`, `11`, `11d`, `11h`).
- **Evidence.** The Standard set, `res-2560`, the manifests and the build-split table are delivered, and the build claim checks out in git.

## 6. Status of earlier defects (my own verification)

### Round 8 (`round-8/REVIEW_A_art.md`)

| # | Defect | Status | Evidence |
|---|---|---|---|
| A8-M1 | Cave boulders hover, in lanes, with shards | **Partial** | Seated deeper with no undersides, but still in lanes, no collar, and new snow flaps (A9-M2). |
| A8-M2 | Summit sugarloaf | **Not fixed** | A9-M7. |
| A8-M3 | No wet band; chalk foam line | **Partial (not visible)** | About 12 % darkening on part of the `06` foot only; islands and headland unchanged (A9-M6). |
| A8-M4 | Repeated chips | **Not fixed**, more exposed | A9-M5 (now in `standard/08b`, `08c` and `07b`). |
| A8-M5 | Headland curtain | **Not fixed** | A9-M4. |
| A8-M6 | Needle crests at the viewpoint | **Mostly fixed** | `c14_crest.png`; faceted peaks remain (m1); the `06` massif is unchanged. |
| m1 | Parapet rim | Not fixed | m2. |
| m2 | `08b` mid-air Yeti over a blank face | **Fixed on Sprint** | `08b` now frames the leap against the cliff with the fjord to the left. `standard/08b` is inland (A9-M3). |
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
| F-008 | CLAIMED | **Partial.** The smearing remains on the headland (F-050). The crest is improved at `14` but unchanged in `06`. |
| F-009 | CLAIMED | **Fixed** (scans). Small-skerry repetition remains (m4). |
| F-010 / F-030 | CLAIMED | **Partial** (m6). |
| F-011 | CLAIMED | **Mostly fixed**; the rim remains (m2). |
| F-012 | CLAIMED | **Partial** (m12). |
| F-013 / F-031 | CLAIMED | **Partial.** A foam line exists; see F-048. |
| F-016 | VERIFIED | **Confirmed** for art: `res-2560/01`, `02`, `10` and `10b` render consistently. |
| F-023 | CLAIMED | **Mostly fixed** (no floating lintel or net); the boulders are A9-M2. |
| F-026 | CLAIMED | **Fixed** (no pinstripe in `06`). |
| F-027 | CLAIMED | **Partial** (m5). |
| F-028 | CLAIMED | **Fixed for the streaks**; the curtain is F-050. |
| F-029 | OPEN | **Open, confirmed** (A9-M7). |
| F-032 | OPEN (partial) | **Open, confirmed**; the chips are now more exposed (A9-M5). |
| F-036 | CLAIMED | **Fixed** (`01`, `06`). |
| F-040 | CLAIMED (r9) | **Partial.** Bedded deeper and solid in code (`seaCave.ts:397–401`, `colliders`). On screen: still lanes, no collar, and new snow flaps (A9-M2). |
| F-041 | OPEN | **Open**, marginally better (m12). |
| F-042 | OPEN | **Open, confirmed** (m13). |
| F-048 | CLAIMED (r9) | **Partial, not visible at the islands or the headland** (A9-M6). The code change is real but too weak. |
| F-049 | CLAIMED (r9) | **Mostly fixed at `14`**; faceted peaks remain; the `06` massif is unchanged (m1). |
| F-050 | OPEN | **Open, confirmed** (A9-M4). |
| F-051 | OPEN | **Open, confirmed** (m5). |
| fa0352d (cave-mouth snow wedge) | CLAIMED (r9) | **Fixed on Standard:** no wedge over the Yeti in `standard/08`. **Possibly regressed on Sprint:** the white sliver and sky holes in `07` (A9-M1). Cause unconfirmed; the probe points at the terrain behind the shell. |
| F-024 (Standard cave sea, C's item) | CLAIMED | **Not met in the delivered Standard set:** no sea in `standard/07`, `08` or `08b` (A9-M3). |

## 7. Public-preview gate (completion brief §10): items in my area

| Gate item | Status | Evidence |
|---|---|---|
| Art direction ≥ 8 | **Met, at the bar (no margin)** | My score is 8. A new Major regression (A9-M1) sits in the signature cave set piece. |
| §4 named failures absent | **Not met** | **Not met:** stretched textures (A9-M4), repeated boulders (A9-M5, m4), pillow rocks (m7). **Largely met:** needle crests (m1, faceted only). **Met:** loaf / cake / cylinder islands; snow on vertical ocean cliffs. **Mostly met:** concrete or masonry rock (rim, m2); terrain/cliff seams (no pinstripe). **New seam-type artefact:** the cave mouth (A9-M1). |
| Foam and wet rock at the waterline | **Not met** | Foam: yes, a thin line. Wet rock: not legible on screen (A9-M6). |
| Varied coves and natural island silhouettes | **Partial** | The silhouettes are natural. The `06` coastline is straight, and the small skerries repeat. |
| No snow-coloured water in the victory | **Met** | `11`, `11d`, `11h`, `11j`. |
| Poly Haven materials and models used meaningfully | **Partial** | Used on the islands, the cave shell and the boulders (with the snow-flap problem). Not used on the headland, parapet or viewpoint deck. |
| Art verified at 1366×768 and 2560×1440 | **Met** (menu, summit, finish) | `res-2560/*` and `res-1366/*` are consistent with 1920. |
| Standard-course cave art | **Not met** | Delivered, but there is no sea in three of six frames and the gull beat looks inland (A9-M3). |

**Bottom line.** The art-direction gate item (≥ 8) is still met, narrowly. Full approval (9) is no closer than in Round 8. The shortest path to a 9:
1. Fix the `07` cave-mouth sliver and holes (A9-M1).
2. Aim the gull beat and the Standard cave shots seaward (A9-M3).
3. Fix the boulder snow flaps and add collars (A9-M2).
4. Put real rock on the headland (A9-M4).
5. Cluster the chips (A9-M5).
6. Make the wet band legible (A9-M6).
7. Reshape the sugarloaf (A9-M7).
