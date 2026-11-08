# Pass 2 — Round 1 — Reviewer A (visual art direction)

**Reviewer:** Reviewer A, INTERNAL (another model instance, not an external human). I did not build this work and I am entitled to reject it.
**Commit reviewed:** `41ceb7a` (41ceb7a5f4c7c39156c9707d64120b887161e882) "Cinematic: threshold hand-plant beat; final 1920x1080 beat frames + grounding report (0 cm penetration, 438 visible frames)" on branch `pass2`.
**Method:** I looked at the still images below and read the code where it helped. I did not launch the game or rebuild it, as instructed. Note that `docs/reviews/pass2/cave/c5.png`, `c6.png`, `c7.png` and `c12.png` are **untracked** (newer than the commit). `docs/reviews/pass2/final/` was empty when I looked.

**Bar:** polished, believable and cohesive. It does not have to be photoreal AAA, but it must have no obvious amateur tells. The pass mark is 7/10 per area.

## Overall verdict: **REJECT**

The cave is much better than the pass-1 boulder pile (`docs/screenshots/final/cave_c02_2_9.png`). Stacked roof rocks are gone, the opening is a rounded arch, and the face reads as a single body of stratified rock. The Yeti's pass-1 face-mask seam is fixed, and the grounding numbers are clean. The two worst problems are still the ones the product owner named:

- **The cave still reads as an object placed on the slope.** From above and from wide angles it is a trapezoidal loaf with planar flanks, not an outcrop of the hillside.
- **The terrain shader has an aliasing pattern of contour lines.** It shows in almost every wide frame and is now the strongest amateur tell in the game.

## Evidence examined

- Cave: `docs/reviews/pass2/cave/{approach,front,inside,threequarter,closeup,above,c1,c2,c3,c4,c5,c6,c7,c10,c11,c12}.png`. Files c8 and c9 do not exist.
- In-game cinematic: `docs/reviews/pass2/cinematic/cine_t{0_1,3_8,5_4,6_6,7_9,9_5,11,14_6,15_8}.png`, plus `grounding_report.json` (summary and per-frame data).
- Pass-1 comparison: `docs/screenshots/final/cave_c02_2_9.png` and `docs/screenshots/yeti_face_front.png`.
- Yeti: `docs/reviews/pass2/yeti/{face_front,face_34,crawl,emerge,roar,gallop,stand_slope_debug}.png`.
- Environment: `docs/reviews/pass2/visual/{before,after}_{z600,vista,grove}.png`, plus `after_{trees,z4200,z6000,menu}.png`.
- Code: `src/world/snowMaterial.ts` (lines 95–156), `src/world/cave/rockField.ts` (header and terms), `src/cinematic/CaveCinematic.ts` (lines 200–260).

## Scores

| # | Area | Score | Result |
|---|------|------:|--------|
| 1 | Cave geology & integration with terrain | 4 | **FAIL** |
| 2 | Cave interior/darkness & every cinematic angle | 5 | **FAIL** |
| 3 | Yeti model/face/fur/eyes | 6 | **FAIL** |
| 4 | Yeti grounding & locomotion (as visible) | 7 | PASS (borderline) |
| 5 | Trees | 6 | **FAIL** |
| 6 | Terrain/rock/snow shading | 4 | **FAIL** |
| 7 | Atmosphere/distance/skyline | 7 | PASS |
| 8 | Overall cohesion | 5 | **FAIL** |

Severity: C = critical (blocks acceptance), M = major, m = minor.

## Defects and remedies

### Area 1 — Cave geology & integration (4/10)

**A1 (C): the massif is a box or loaf sitting on the slope, not an outcrop of it.**
- Evidence:
  - `cave/above.png`: the whole block, with a straight vertical right face and a sharp 90° corner at about (1380,620).
  - `cave/c11.png`: a trapezoid with a flat top and planar sloped flanks, x 480–1720.
  - `cinematic/cine_t14_6.png`: the right flank, x 1600–1880, is a single inclined plane.
  - `cine_t15_8.png`: the block's outline, x 220–1360, y 560–1080.
- Remedy:
  - In `caveTerrain.ts`/`rockField.ts`, stop ending the formation with flanks. Taper `cliffHeight` to 0 over 30–60 m on each side of the run using a noise-modulated falloff. Raise the backing terrain (`ground`/`hRaw`) to meet the cliff top, so that from above the rock is a band of exposed face in the slope.
  - Break the top edge into 2–3 stepped benches that continue sideways into the terrain's own strata.
  - Acceptance test: from `above` and `c11`, no straight silhouette edge longer than about 5 m, and no visible flank face.

**A2 (M): translucent, soft "skirt" smears where the rock meets the snow.**
- Evidence:
  - `cave/approach.png`: a white haze column at x 440–620, y 300–600.
  - `cave/c11.png`: a vertical milky band at x 1480–1720, y 420–860.
  - `cave/threequarter.png`: overlapping pale planes at x 1450–1900.
- Remedy:
  - Replace the alpha/fog-like snow blend on the rock with an opaque, normal-driven snow cap: snow where `n.y > ~0.6`, with a crisp noisy edge.
  - Where rock meets ground, add real geometry: drift fillets or a talus apron in the SDF, not a transparent card.

**A3 (M): large, flat, overlapping facets on the face read as shards of glass or decals rather than fractured rock.**
- Evidence:
  - `cave/threequarter.png`: x 1300–1900, y 300–1000.
  - `cave/c1.png`: x 1500–1900, y 380–900.
  - `cave/c2.png`: the right half.
- Remedy:
  - Raise the bake resolution near the face, or add a normal-map or triplanar detail octave in `rockMaterial.ts`.
  - Remove the pale, low-alpha tint patches that make the facets look like layered sheets.
  - Make the joint lines follow strata and joints instead of polygon edges. At present the dark crack lines trace triangle borders.

**A4 (M): the opening has straight vertical jambs and a smooth tunnel bore, so it reads as a man-made doorway.**
- Evidence:
  - `cave/c2.png`: the right jamb is a straight vertical line from y 690 to 1080 at x ≈ 1275.
  - `cave/front.png`: both jambs, x 800 and 1165.
  - `cine_t7_9.png`: the right jamb, x 1560–1600.
- Remedy:
  - Make the chamber superellipse in `rockField.ts` asymmetric and lean it 5–10°.
  - Add 0.3–0.8 m noise displacement to the wall at the mouth only.
  - Add a fallen-block or ledge fillet on one side, so the mouth's width changes with height.

**A5 (m): the snow blobs at the cliff base look like marshmallows or stuck-on putty.**
- Evidence:
  - `cave/above.png`: (560–720, 540–610), plus the chain from (1040,700) to (1520,970).
  - `cave/front.png`: (260–520, 700–820).
- Remedy:
  - Merge the blobs into the ground as wind drifts with a long tail downwind, using smin with the terrain.
  - Alternatively, delete the free-floating small ones.

**A6 (m): the footprint decals in the snow at the mouth render as outlined line art.**
- Evidence:
  - `cave/front.png`: (970–1200, 860–930).
  - `cave/c1.png`: (870–1220, 830–900).
- Remedy:
  - Render the prints as soft depressions: darken the AO and normal-perturb, with no outline.
  - Alternatively, use a height-displaced decal with soft edges.

**A7 (m): the icicles are a uniform comb of identical white cones in one line, like a row of teeth.**
- Evidence: `cave/c2.png` (600–1460, 580–730) and `cave/front.png`.
- Remedy:
  - Cluster the icicles; vary length 5× and thickness.
  - Concentrate them at drip points under the brow, leaving gaps.
  - Give them a translucent, slightly blue ice material, not opaque white.

### Area 2 — Cave interior/darkness & cinematic angles (5/10)

**A8 (M): the interior is a perfectly black void, and the dust motes read as a starfield.**
- Evidence: `cave/inside.png`, `cave/c3.png`, `cave/c4.png`, `cine_t3_8.png` and `cine_t5_4.png`, all in the upper-centre black area.
- Remedy:
  - Give the tunnel a visible back wall or bend, picked out by a very low cold bounce term. The bounce should fall off with depth into the tunnel, about 2–4% luminance near the mouth, so the eye reads depth rather than a cut-out.
  - Show the motes only inside the shaft of light at the mouth. Alternatively, make them larger and softer and hide them beyond about 4 m into the dark.

**A9 (M): the Yeti looks stage-lit against the void.**
- Evidence:
  - `cine_t5_4.png`: the bright white fur on the black background at (720–1150, 530–800).
  - `cine_t3_8.png`: the same effect.
- The dim logic in `CaveCinematic.ts` (setShade, ambient ×0.15) does not show in the result. The figure looks composited in.
- Remedy:
  - Clamp the fur's ambient/hemisphere contribution with the same depth shade as the body. Fur cards appear to ignore `setShade`.
  - Keep the eyes as the brightest element in the frame until t ≈ 7.

**A10 (M): the floor reads as a separate disc, with a visible crescent seam between the cave floor and the outside snow.**
- Evidence:
  - `cine_t7_9.png`: the crescent at (440–1700, 730–800).
  - `cine_t3_8.png`: (200–1500, 800–840).
  - `cave/front.png`: (800–1170, 740–785).
- Remedy:
  - Blend the floor material into the snow over 1–2 m: scatter snow into the mouth with noise, matching albedo and normal at the threshold.
  - Remove the step in floor height at the lip.

**A11 (M): the lighting and exposure on the cave walls jump between consecutive beats.**
- Evidence: the left wall in `cine_t3_8.png` versus `cine_t7_9.png`. The rock shifts from mid-grey to near-black and back to bright at `cine_t9_5.png`.
- Remedy: ease the dim factor with a slower time constant, about 1.5 s. Make sure no cut happens during the ramp.

**A12 (M): an unexplained bright soft orb floats in frame.**
- Evidence:
  - `cine_t6_6.png` at (320,688).
  - `cine_t14_6.png` near the Yeti's head at (930,480).
  - `cine_t5_4.png` between the hands at (905,760).
  - `cine_t3_8.png` at (910,675).
- I could not identify the source; it may be a particle or a sprite with additive blending.
- Remedy:
  - Find the emitter and remove it, or restrict it.
  - If it is snow spray or vapour, use non-additive, depth-faded soft particles.

**A13 (M): some preview camera angles show no subject.**
- Evidence:
  - `cave/c5.png` is a solid sky colour.
  - `cave/c10.png` and `cave/c12.png` are empty snowfield with the cave cropped or absent.
  - `cave/c6.png` and `cave/c7.png` show a placeholder capsule.
- These come from the preview, not from the in-game frames, so I cannot confirm they ship. Each shot must frame the cave or the Yeti.
- Remedy:
  - Reconcile the preview camera list with `CaveCinematic` shots and re-capture every shot with the real Yeti.
  - Add an automated check that the subject's projected bbox is inside the frame.

### Area 3 — Yeti model/face/fur/eyes (6/10)

**A14 (M): close up, the fur reads as rice grains or confetti rather than hair.** Flakes float detached from the silhouette.
- Evidence:
  - `yeti/face_front.png`: the brow at (280–1000, 60–260); detached chips at (195–260, 250–320).
  - `yeti/face_34.png`: (250–700, 80–300).
- Remedy:
  - Use longer, tapered strand cards (aspect ≥ 1:6) with alpha-to-coverage, and clump them by direction.
  - Cull shells or cards whose root is more than about 1 cm from the skin.
  - Shorten the cards on the brow and muzzle and comb them along a flow map.

**A15 (M): on the body and limbs, the fur cards render as hard, bluish "ice shard" spikes with screen-door dithering at the edges.**
- Evidence:
  - `yeti/gallop.png`: the whole body.
  - `yeti/roar.png`: the chest at (480–800, 200–380).
  - `cine_t6_6.png`: arm edges at (560–660, 500–900).
- Remedy:
  - Soften the card alpha: fade the tips and drop the hard alpha test, or use alpha-to-coverage with MSAA.
  - Reduce the blue specular on the cards.
  - Add a 1–2 frame temporal or jitter resolve, or reduce the noise of the dither pattern.

**A16 (M): the proportions are off.** The head is tiny relative to the shoulder mass and there is no visible neck.
- Evidence:
  - `yeti/roar.png`: the head is about 100 px wide against shoulders about 420 px.
  - `cine_t11.png`: (830–920, 490–570).
- Remedy:
  - Scale the head by 1.2–1.3×.
  - Lift the head and add a fur ruff and trapezius mass to bridge into the shoulders.

**A17 (m): the hands and feet are hairless dark-grey "gloves" that read like boots or hooves from distance.**
- Evidence: `yeti/gallop.png` (560–640, 560–610) and `yeti/roar.png` (340–400, 110–190; 880–940, 110–185).
- Remedy: extend short fur over the backs of the hands and the tops of the feet, and lighten the palm and sole skin to a dusky grey-blue.

**A18 (m): the gallop silhouette reads as a "furry comma" with no readable limbs.**
- Evidence: `yeti/gallop.png`.
- Remedy: shorten the back and limb fur in run mode, or comb it backwards along velocity, so the legs read in silhouette.

**Improvement noted:** the pass-1 face-mask seam (`docs/screenshots/yeti_face_front.png`) is fixed. Eyes and lids are good.

### Area 4 — Grounding & locomotion (7/10, PASS)

The frames support the claim: in `cine_t3_8`, `cine_t5_4`, `cine_t7_9` and `cine_t9_5` the hands and feet are planted, with no sinking. The JSON reports minimum sole clearance of 0 and no errors. The specific "appears below the floor then rises" complaint is not visible in any still. There are open points:

**A19 (M): the crawl pose's hind leg loops sideways like a tail, and the head is turned 90° from the body line.**
- Evidence: `yeti/crawl.png` (540–820, 470–640), with the head at (380–480, 270–360).
- Remedy:
  - Constrain the hip yaw and knee plane in the crawl IK.
  - Limit the head's yaw relative to the chest to ±35°.

**A20 (m): the grounding metric `rootAboveFloor` is tautological during crawl and emerge**, because `placeAt()` sets `root.y = floorHeightAt()`.
- The summary also says `visibleFrames: 438`, but all 475 per-frame entries have `visible: true`.
- Remedy: report the clearance of the lowest bone or vertex against the floor, and fix the visible-frame count.

**A21 (m): at the leap, the Yeti appears splayed against the hillside with no contact or shadow cue.**
- Evidence: `cine_t15_8.png` at (880–1090, 470–610). The JSON shows the root 11 m above the floor reference with nearly constant world Y.
- Remedy: add a contact shadow or blob shadow while airborne, use a tucked jump pose rather than a starfish, and land within the shot.

**Not verifiable from stills:** whether he rises out of the floor in motion between captured frames. A short video or a frame strip at 30 fps across t = 0–1.5 s and 7.5–8.5 s is needed.

### Area 5 — Trees (6/10)

There is a clear improvement over `before_grove.png`, where trees were stacked cones. The trees still fail close-up:

**A22 (M): the tree tops are a four-pointed star or fleur-de-lis shape that looks like a Christmas-tree ornament.**
- Evidence: `visual/after_grove.png` (900–990, 80–200) and (1395–1475, 255–350).
- Remedy: replace the tip with a single narrow leader spike plus 2–3 small droop tufts.

**A23 (M): the branch whorls are perfectly radial, flat-shaded and symmetric, and the dark conical core is visible between whorls.** Hard polygon facets contrast with the smooth-shaded terrain.
- Evidence: `after_grove.png`, the central tree (740–1180, 80–940) and the left-edge tree (0–220, 0–700).
- Remedy:
  - Use smooth normals or a spherical-normal trick on the foliage.
  - Jitter whorl rotation and length per level, droop the lower branches, and hide the core with denser inner cards.
  - Vary the snow load per branch, so caps are not the same pad on every tier.

**A24 (m): trees grow on near-vertical rock faces at the same density as on benches.**
- Evidence: `visual/after_vista.png`, the left wall at (0–520, 80–700).
- Remedy: reduce placement density with slope (zero above about 45°) and with the shader's rock mask.

### Area 6 — Terrain/rock/snow shading (4/10)

**A25 (C): the terrain has an aliasing pattern of contour lines.** Thin white iso-lines and swirls look like a topographic map on mid-distance slopes. It is the single most visible amateur tell, and it appears in the hero cinematic as well as in gameplay.
- Evidence:
  - `cave/approach.png`: (0–450, 0–400).
  - `cave/above.png`: (1500–1920, 0–960).
  - `cave/c11.png`: (1500–1900, 480–700).
  - `cine_t0_1.png`: (1080–1500, 330–500).
  - `cine_t14_6.png`: (150–560, 120–460).
  - `cine_t15_8.png`: (1300–1920, 640–1000).
  - `visual/after_vista.png`: (1500–1900, 480–800).
- Likely cause: the hard `smoothstep`/`step` thresholds in `snowMaterial.ts` lines 109–116 and 139–145 (`hard = step(...)`, the rockEdge threshold on `slope`, the joint threshold) are evaluated without derivative awareness. The `farA` fade starts at 120 m, but the artefacts already appear at 40–150 m.
- Remedy:
  - Widen every threshold by `fwidth()` of its input, e.g. `w = max(k, fwidth(x) * 1.5); smoothstep(e - w, e + w, x)`.
  - Clamp the noise frequencies with `fwidth(pp)`, like a mip bias.
  - Start the far fade at about 40 m.
  - Verify on `approach`, `above` and `after_vista` at 1920×1080.

**A26 (M): salt-and-pepper dithered speckle appears at rock/snow transitions.**
- Evidence:
  - `visual/after_z6000.png`: (1100–1500, 100–520).
  - `visual/after_trees.png`: (480–1200, 0–560).
- Remedy: the same derivative-aware fix as A25. Also remove any per-pixel hash in the transition, or run it through temporal AA.

**A27 (M): flat, featureless grey wall slabs with hard edges where they meet the snow look like cardboard cut-outs.**
- Evidence:
  - `cave/approach.png`: (1150–1550, 470–810).
  - `cave/threequarter.png`: (430–800, 80–510).
  - `cave/c12.png`: (0–420, 140–600).
  - `cine_t0_1.png`: (0–360, 230–640).
- Remedy:
  - Steep faces need the same strata, joint and snow-cling treatment as the near rock; they are currently untextured.
  - Check the projection switch in `snowMaterial.ts` line 96, where `vert` mixes the xz and vertical projections and stretches noise.
  - Add a cornice or snow fillet at the base.

**A28 (m): the strata appear as perfectly straight horizontal terraces with hard boundaries.**
- Evidence: `visual/after_vista.png`, the left wall at (0–520, 280–560).
- Remedy: increase the warp amplitude of `dip` (noise term at line 105) and band-offset noise. Vary band thickness.

**A29 (m): the scattered rocks are a uniform sprinkle of identical light pebbles.**
- Evidence: `after_vista.png` and `cine_t15_8.png` (1100–1700, 360–660).
- Remedy:
  - Cluster rocks below cliffs (talus) and under band ledges.
  - Vary the size distribution as a power law, and tint the rocks to the band tone.

**A30 (m): the hillside above the cave is "egg-crate" noise with spiky peaks.**
- Evidence: `cine_t15_8.png` (600–1700, 240–560).
- Remedy: lower the high-frequency amplitude and use ridged noise aligned to the fall line.

### Area 7 — Atmosphere/distance/skyline (7/10, PASS)

This is a good improvement over `before_vista.png`, where the vanishing point showed cut-out ridge cards (900–1010, 400–720). The layered haze ranges in `after_vista.png` and `after_z600.png` work.

**A31 (m): the distant range silhouettes are flat, low-contrast cardboard with no aerial-perspective gradient within each layer.**
- Evidence: `after_vista.png` (520–1100, 330–380).
- Remedy: add a slight vertical gradient (lighter at the base) and a sun-side rim to each ridge ring in `look/ranges.ts`.

### Area 8 — Overall cohesion (5/10)

**A32 (M): the rendering languages clash.**
- The trees and the start gate are faceted low-poly with flat shading (`after_grove.png`, `after_menu.png`).
- The cave is a sculpted SDF with soft noise (`cave/front.png`).
- The Yeti has dense near-realistic fur (`yeti/face_front.png`).
- The terrain is smooth procedural.
- Remedy:
  - Pick one target: "stylised-soft" fits the existing pieces best.
  - Smooth-shade the trees and props.
  - Give the gate posts and banner proper materials: wood grain or normal, and bevelled edges.
  - Keep the Yeti's fur stylised-clumped (see A14) rather than noisy-realistic.

**A33 (m): the menu composition crops the start banner ("ST… THE LAST") at the right edge, and the skier is hidden behind the gate post.**
- Evidence: `visual/after_menu.png` (1640–1920, 520–860).
- Remedy: move the menu camera, or the gate, so the banner is fully in frame or clearly out of it, and keep the skier clear of the post.

## Could not verify

- **Motion:** whether the Yeti rises through the floor between captured frames. Also fur shimmer and temporal dither in motion, snow particle behaviour, and camera cuts and timing. All evidence is stills.
- **Preview cameras:** whether the preview camera set (c5/c6/c7/c10/c12) matches the shipped cinematic shots.
- **Missing captures:** `docs/reviews/pass2/final/*` (empty at review time), `cave/c8.png` and `cave/c9.png`.
- **Resolution and quality tiers:** behaviour at resolutions other than 1920×1080 or 1280×720, and the low and medium quality tiers.
- **Source of the orb in A12.**
- **Performance (not my area):** the Yeti debug overlay reports about 832–868k triangles at q=high.
