# Pass 2 — Round 2 — Reviewer A (visual art direction)

**Reviewer:** Reviewer A, INTERNAL (another model instance, not an external human). I have authority to reject.
**Commit reviewed:** `79f95d2` (79f95d2ae917501d7a14a4b63feb8e10da6629f2) "Round-2 cinematic tail frames (14.6, 15.8, 16.6, hand-off); over-shoulder leap camera lowered", branch `pass2`.
**Method:** I looked only at the still images and JSON listed below. I did not launch a browser or rebuild. I read code only to explain what the images show. I did not accept engineer claims (`cave/R2_NOTES.md`, `yeti/R2_NOTES.md`, commit messages) as evidence. I compared against round-1 frames taken from `41ceb7a` with `git show`.
**Bar:** polished, believable, cohesive procedural stylisation, not photorealism. The pass mark is 7/10 per area.

**Note on evidence files.**
- `docs/reviews/pass2/cinematic/cine_t14_6.png`, `cine_t15_8.png`, `cine_t16_6.png` and `cine_handoff_chase.png` are untracked, and their bytes differ from the committed `cinematic_tail/` versions.
- For t ≥ 14.6 and the hand-off I judged the committed `cinematic_tail/` versions, which are the later ones with the lowered camera.
- The two `grounding_report.json` files are identical.

## Overall verdict: **REJECT** (5 of 8 areas still fail, but every score went up or held)

Real progress:
- **The headline critical cave complaint (A1) is resolved in the shipped wide shots.** In `cinematic_tail/cine_t14_6.png` and `cine_t15_8.png` the cave is now an exposed, snow-benched rock band in the hillside, not a loaf on the slope.
- **The contour-line artefact (A25) is gone** from every 1920×1080 in-game frame.
- **The trees are fixed** to a passing standard.

What still blocks acceptance:
1. **The Yeti is still stage-lit in the "dark" beats, and is brighter than in round 1.** Under the caption "[something growls in the dark]", the fur is near-white against a black void. The mean luminance of the Yeti region at t=3.8 went from 34 in round 1 to 59 now.
2. **The unexplained bright orbs are still there** (A12).
3. **The rock face has a new, regular "quilted/jigsaw" crease pattern** that reads as upholstery (A34).
4. **The terrain is still peppered with identical flat "pancake" rocks** (A29), and the hills above the cave are still crumpled and spiky (A30).

## Evidence examined

- **In-game cinematic, 1920×1080:**
  - `cinematic/cine_t0_1.png`, `cine_t3_8.png`, `cine_t5_4.png`, `cine_t6_6.png`, `cine_t7_9.png`, `cine_t9_5.png`, `cine_t11.png`
  - `cinematic_tail/cine_t14_6.png`, `cine_t15_8.png`, `cine_t16_6.png`, `cine_handoff_chase.png`
  - `cinematic_tail/grounding_report.json`: summary plus all 554 frames, which I re-aggregated per mode.
- **Cave preview:** `cave/r2_front.png` (the only round-2 cave preview).
- **Yeti preview:** `yeti/r2_face_front.png`, `r2_face_34.png`, `r2_body_front.png`, `r2_body_side.png`, `r2_roar.png`, `r2_gallop.png`, `r2_crawl.png`, `r2_leap.png`, `r2_emerge.png`, `r2_dark.png`, `r2_hands_feet.png`.
- **Environment, 960×540:** `visual/r2_before_*` against `r2_after_*` for trees, trees2, vista, vista2, z600, z2500 and menu, plus `visual/r2_cmp_vista2_wall_crop.png`.
- **Round-1 comparison:** `41ceb7a:docs/reviews/pass2/cinematic/cine_t{3_8,5_4,7_9,14_6,15_8}.png` and the round-1 `cave/*.png`.
- **Code, read to explain what I saw:**
  - `src/cinematic/CaveCinematic.ts:250`: the shade depends only on tunnel depth `s`, so near the mouth (t=3.8–5.4) it is about 1.
  - `src/game/App.ts:855–874`: the grounding probes.
  - `src/yeti/YetiModel.ts:370–410`: the footstep/hand-strike hooks and the palm probe.

## Scores

| # | Area | R1 | R2 | Result |
|---|------|---:|---:|--------|
| 1 | Cave geology & integration with terrain | 4 | 6 | **FAIL** |
| 2 | Cave interior/darkness & every cinematic angle | 5 | 5 | **FAIL** |
| 3 | Yeti model/face/fur/eyes | 6 | 6 | **FAIL** |
| 4 | Yeti grounding & locomotion (as visible) | 7 | 8 | PASS |
| 5 | Trees | 6 | 7 | PASS |
| 6 | Terrain/rock/snow shading | 4 | 6 | **FAIL** |
| 7 | Atmosphere/distance/skyline | 7 | 7 | PASS |
| 8 | Overall cohesion | 5 | 6 | **FAIL** |

### Why each score

1. **Cave geology (6).**
   - Big step up. The band now continues into the slope with snow benches on the right (`cine_t15_8` x 1200–1920). The mouth is irregular and asymmetric, and the icicles are clustered.
   - It is held below 7 for three reasons:
     - the quilted crease cells on every close view (A34);
     - a milky, ghost-like vertical slab where the band ends on the right (A2, partial);
     - the paw prints still read as icons (A6).
2. **Interior and cinematic (5).**
   - The starfield motes are gone and the floor-disc crescent is mostly gone.
   - The darkness beats are now worse: the Yeti is lit like a studio subject (A9).
   - The orbs remain (A12).
   - The climactic landing at t≈16.7 is not on screen in any frame (A38).
3. **Yeti model (6).**
   - Fur now reads as hair, not confetti. The head and neck proportions are fixed and the gallop silhouette reads.
   - New tells in close-up:
     - fur cards pass through the open mouth in the roar (A35);
     - the face reads as a grainy black rubber mask under a hard white "helmet" brow (A36);
     - the palms are still dark glove-like pads (A17);
     - the fur silhouette has stair-step aliasing at mid distance (A15).
4. **Grounding and locomotion (8).**
   - The gallop, crawl and leap poses are all fixed in the previews.
   - Soles are at 0 cm and there are no frame jumps outside the leap: the maximum root step is 0.153 m/frame in crawl and 0.088 in emerge, against 0.708 in leap flight, which is plausible.
   - There are caveats on the metrics; see A20.
5. **Trees (7).**
   - The leader tips, drooping whorls, varied snow loads and smooth shading fit the terrain now.
   - Decorative trees still stand inside rock-exposed patches on steep faces (A24).
6. **Terrain (6).**
   - Removing the contour lines and the speckle is the biggest gain in the build.
   - What remains:
     - uniform flat disc rocks in every wide shot;
     - spiky, crumpled hill peaks;
     - steep rock that now reads as soft grey smudges with no structure.
7. **Atmosphere (7).** Unchanged and still fine. The ranges are still flat (A31).
8. **Cohesion (6).**
   - Trees and terrain now share a "stylised-soft" language.
   - Three things still break it:
     - the Yeti's dense semi-realistic fur and grainy skin;
     - the quilted rock;
     - the boxy, flat-shaded gate posts.

## Per-ID verdicts (round-1 defects A1–A33)

Legend: **VERIFIED** (new evidence shows it fixed), **PARTIAL**, **NOT FIXED**, **UNVERIFIABLE** (no new evidence covers it).

| ID | Sev | Verdict | Evidence / comment |
|---|---|---|---|
| A1 | C | **VERIFIED (in-game angles)** | `cinematic_tail/cine_t14_6.png` and `cine_t15_8.png`: an exposed band with benches that continue into the slope; no trapezoid loaf (compare round-1 `cine_t14_6` and `cine_t15_8`). The round-1 acceptance views (`above`, `c11`) were not re-shot, so the "no straight edge > 5 m from above" test is unverified. Residual: a rounded snout where the band ends on the left (`cine_t15_8` 400–560, 480–610), which is acceptable. |
| A2 | M | **PARTIAL** | The ledge snow is opaque and crisp (`r2_front`, `cine_t15_8`). Remaining: a pale, translucent-looking vertical slab with a ghost rectangle where the band ends on the right (`cine_t15_8` x 1530–1640, y 390–510; also `cine_t14_6` 1500–1560, 380–470). |
| A3 | M | **PARTIAL** | The glassy shard overlays are gone from `r2_front`. Pale, overlapping soft sheets remain on the right wall (`cine_t3_8` 1440–1700, 150–560; `cine_t11` 1500–1920, 120–600), and the joint pattern became quilted cells (see A34). |
| A4 | M | **VERIFIED** | `r2_front`: the mouth is irregular, leaning and asymmetric. `cine_t14_6` and `cine_t7_9` show no straight jambs. |
| A5 | m | **VERIFIED (shipped angles)** | No marshmallow blobs in `r2_front`, `cine_t14_6`, `cine_t15_8` or `cine_t9_5`. `above` was not re-shot. |
| A6 | m | **NOT FIXED** | `r2_front` (970–1000, 800–830 and 970–1010, 960–1030): the prints are now small dotted "paw icons", still graphic symbols rather than depressions. |
| A7 | m | **VERIFIED** | `r2_front` and `cine_t11` (760–850, 120–290): clustered icicles of varied length with a slightly blue, translucent read. |
| A8 | M | **PARTIAL** | The starfield is gone (`cine_t3_8` and `cine_t5_4`, against round-1 `cine_t3_8`); only a few motes remain in `cine_t9_5`. The interior is still an almost pure black void, with only a hint of wall at upper left in `cine_t3_8` (560–800, 200–500). There is no readable back wall or bend. |
| A9 | M | **NOT FIXED (regressed)** | `cine_t3_8` (800–1040, 500–730) and `cine_t5_4` (690–1160, 440–920): bright white fur against black, with the caption "something growls in the dark". The mean luma of the Yeti region is 59 at t=3.8 and 54 at t=5.4, against 34 in round-1 `cine_t3_8`. Cause visible in code: `CaveCinematic.ts:250` shades only by tunnel depth (s−0.5)/6, so at the mouth the shade is about 1. `yeti/r2_dark.png` proves the shade path works in the preview, but the shipped beats don't use it. |
| A10 | M | **PARTIAL** | The crescent disc is gone in `cine_t3_8` and `cine_t7_9`. A darker lip and a faint line remain at the threshold: `cine_t7_9` (780–1500, 725–745) and `r2_front` (840–1160, 760–785). |
| A11 | M | **PARTIAL / UNVERIFIABLE** | Wall exposure is closer between `cine_t3_8`, `t7_9` and `t9_5`. The left wall still swings from mid-grey (t=3.8) to near-black (t=5.4 and 6.6). The ramp can't be judged from stills. |
| A12 | M | **NOT FIXED** | A soft white glow at each hand contact in `cine_t3_8` (860–900, 690–715) and `cine_t5_4` (820–850, 790–820); a grey orb beside the head in `cine_t14_6` (935–960, 485–505); a faint orb at left in `cine_t6_6` (110–150, 690–730). The hand ones match the hand-strike/footstep hooks in `YetiModel.ts` (~372–384), which suggests snow-puff particles firing on a rock floor in the dark. |
| A13 | M | **UNVERIFIABLE** | No round-2 `c1`–`c12` preview captures exist (the R2 notes say they were stopped). Every in-game beat frames its subject except t=16.6 (see A38). |
| A14 | M | **VERIFIED** | `r2_face_front` brow (480–1450, 60–360): smooth fur with fine strands, no rice-grain chips or detached flakes. |
| A15 | M | **PARTIAL** | The blue "ice shards" and screen-door dither are gone (`cine_t6_6` reads as hair; `r2_gallop`). Remaining: broad flat ribbon cards on the cheek mane (`r2_face_34` 480–800, 450–1000), and stair-step jaggies on the fur silhouette at mid distance (`cine_t3_8` and `cine_t5_4` outline). |
| A16 | M | **VERIFIED** | `r2_body_front` and `r2_body_side`: the head is about 0.4 of shoulder width and a neck is visible. `cine_t11` (800–910, 430–560) shows it in-game. |
| A17 | m | **PARTIAL** | The backs of the hands and the feet are furred (`r2_hands_feet`). The palms are still dark purple-grey "gloves" in `r2_roar` (290–330, 100–150 and 575–605, 100–150 in the half-scale crop; full res ≈ 620–700, 200–300 and 1180–1260, 200–300) and `r2_body_side` (860–900, 650–700). |
| A18 | m | **VERIFIED** | `r2_gallop`: front and hind limbs are clearly separated in silhouette. |
| A19 | M | **VERIFIED (preview)** | `r2_crawl`: the hind legs are under the body; the head turn looks within about 40°. In-game crawl frames `cine_t3_8` and `t5_4` are frontal and fine. |
| A20 | m | **PARTIAL** | `rootAboveFloor` is still 0 in every frame by construction (min = max = 0). `handL/R` probes a palm bind point (`YetiModel.getHandWorldPosition`), not the "lowest knuckle/palm point" its comment claims (`App.ts:865`). Crawl minimum hand clearance is 0.168 m and the median 0.175 m, so the metric can neither prove nor disprove contact. The visible-frame count is now consistent (554/554). |
| A21 | m | **PARTIAL** | The pose is fixed: a tucked pounce (`r2_leap`, `cine_t15_8` 935–1000, 490–580). The landing at t≈16.7 is not shown in any frame (A38), and there is no contact cue on the face in `cine_t15_8`. |
| A22 | M | **VERIFIED** | `r2_after_trees` and `r2_after_trees2`: a single leader spike, no star tips. |
| A23 | M | **VERIFIED** | `r2_after_trees2` centre tree: drooping, varied tiers, smooth shading, irregular snow load, no visible dark core. Near-camera trees are still large flat planes (`r2_after_trees` left edge), which is acceptable for the style. |
| A24 | m | **PARTIAL** | `r2_cmp_vista2_wall_crop.png`, lower panel (520–700, 360–520): decorative trees still stand inside rock-exposed bands on the steep face. Only collidable forests were removed. |
| A25 | C | **VERIFIED** | No contour lines in `cine_t0_1` (1080–1500, 330–500), `cinematic_tail/cine_t14_6` (0–900, 120–460) or `cine_t15_8` (1300–1920, 640–1000), all at 1920. Round-1 `cine_t14_6` showed them clearly. |
| A26 | M | **VERIFIED** | `r2_cmp_vista2_wall_crop.png`: the speckle in the upper panel is gone in the lower one. `cine_t0_1` right slope at 1920 is clean. |
| A27 | M | **PARTIAL** | The hard-edged cardboard slabs are gone (wall crop; `cine_t0_1` 0–360, 230–640). The steep faces now read as soft grey smudges with no rock structure. |
| A28 | m | **VERIFIED (960 only)** | `r2_after_vista`: no ruler-straight terraces on the left wall. The cave band's strata are irregular (`cine_t15_8`). |
| A29 | m | **NOT FIXED** | Identical flat grey "pancake" discs scattered uniformly, some stacked and apparently floating: `cine_t15_8` (620–690, 540–580; 1780–1830, 290–330), `cine_t0_1` right slope, `cine_handoff_chase` right slope and `r2_after_vista2`. |
| A30 | m | **NOT FIXED** | `cine_t15_8` (0–900, 0–300): crumpled, spiky egg-crate peaks above the cave. |
| A31 | m | **NOT FIXED** | `cine_t0_1` and `cine_t16_6` (700–1100, 330–380): ranges are still flat, low-contrast cards. No change is visible. |
| A32 | M | **PARTIAL** | Trees now match the soft terrain. The gate posts are still plain brown boxes (`r2_after_menu` 610–750, 830–930). The Yeti's semi-realistic fur and grainy skin (`r2_face_front`) and the quilted rock (A34) still clash. |
| A33 | m | **VERIFIED** | `r2_after_menu`: the START banner is fully in frame and the skier is clear of the posts. |

**Not verified-fixed (21):** A2, A3, A6, A8, A9, A10, A11, A12, A13, A15, A17, A20, A21, A24, A27, A29, A30, A31, A32, plus caveats on A1 and A5, whose top-down acceptance views were not re-shot.

## New defects

| ID | Sev | Area | Defect | Evidence | Remedy |
|---|---|---|---|---|---|
| A34 | M | Cave | The rock face is covered in regular, rounded "quilted/jigsaw" cells, crease lines forming rounded rectangles of similar size, so it reads as padded upholstery. The R2 notes flag the same thing. | `cave/r2_front.png` (whole face); `cine_t3_8` right wall (1250–1920, 120–900); `cine_t7_9` right wall (1340–1920, 120–800); `cine_t11` left wall | Make the crease field anisotropic along bedding (stretch 3–5× along the strike). Use a few long through-going joints plus bedding planes instead of closed cells, with varied crease depth and width. Fade the cells out with distance and slope. |
| A35 | M | Yeti | In the roar, chin and beard fur cards hang across the open mouth, drawing grey strands over the teeth and tongue. | `yeti/r2_roar.png` mouth (≈ 820–960, 160–360 at 1920) | Exclude cards whose roots are within about 3 cm of the lip line, or comb chin cards down and away and rotate them with the jaw bone. Re-check at maximum jaw open. |
| A36 | M | Yeti | The face reads as a grainy black rubber mask under a white "helmet". A hard straight horizontal fur edge runs across the forehead. The skin has high-frequency salt-and-pepper noise, and the teeth are uniform rectangular "piano keys". | `yeti/r2_face_front.png`: brow edge (480–1450, 330–370), skin noise (620–1300, 380–950), teeth (760–1100, 860–930); `r2_face_34` | Break the brow line with tufts and a short-hair gradient onto the skin. Cut skin-noise contrast by about 60% and lower its frequency, using wrinkles and pores, not static. Vary tooth size and add canines. |
| A37 | m | Cave/terrain | Snow near the mouth shows triangle-facet shading. | `cave/r2_front.png` (1100–1400, 800–950); in-game, smaller, `cine_t15_8` (1000–1080, 635–660) | Smooth the normals on the snow fillet and berm, or recompute normals from the SDF/heightfield gradient rather than per face. |
| A38 | m | Cinematic | The leap payoff happens off-screen: `cine_t16_6` is a forward view of the skier with no Yeti, while the report places the landing at about 16.7 s. This overlaps with Reviewer C. | `cinematic_tail/cine_t16_6.png` | Hold a shot that contains the landing, with a snow burst and contact, for at least 0.5 s before the cut. |
| A39 | m | Cinematic | In the over-shoulder shots only the top of the skier's helmet pokes into the bottom edge, so it reads as a stray object rather than a framing device. | `cine_t14_6` (780–890, 890–960); `cine_t15_8` (700–820, 1030–1080) | Either frame head and shoulders (lower and closer), or drop the skier out of frame entirely. |
| A40 | m | Cave | The claw marks are glossy black ribbons that read as stickers, and in `cine_t11` the same mark appears twice, stacked. | `cine_t3_8` (150–310, 320–480); `cine_t11` (450–550, 380–500 and 450–550, 630–770) | Render them as scraped rock (lighter albedo with normal grooves) instead of black geometry. Place one set only, or vary each instance. |

## Could not verify

- **Cave preview angles:** only `r2_front` exists. There are no round-2 `above`, `c11`, `threequarter`, `approach`, `inside`, `closeup` or `c1`–`c12` captures, so A1's top-down acceptance test, A5 from above and A13 are unverified.
- **Motion:** temporal fur shimmer, orb or particle behaviour, the wall-exposure ramp (A11), cut timing, and whether the Yeti pops through the floor between captured frames. All evidence is stills; the grounding JSON's per-frame root steps look smooth.
- **Hand contact:** the grounding metric measures a palm point, not the lowest hand geometry (A20).
- **Terrain at 1920:** the round-2 terrain and tree evidence is 960×540. `final/game_*.png` predates the terrain change, so I used it only for context. The A25 and A26 verdicts rest on the 1920 cinematic frames.
- **Quality tiers and resolutions:** I saw only q=high at 1920×1080 or 960×540.
- **Source of each orb (A12):** the hand-contact ones match the footstep/hand-strike hooks; the one by the head at the mouth (`cine_t14_6`) is unexplained.
