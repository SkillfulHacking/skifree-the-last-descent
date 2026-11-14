# Fjord Coast — FINAL round (round 3): Reviewer A (Environmental Art Director)

- **Reviewer:** A — Environmental Art Director
- **Nature of review:** model-based reviewer (same model family as the developers; not external)
- **Build:** `aba21bc` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`)
- **Date:** 2026-11-10
- **Method:**
  - Viewed all 31 FINAL 1920×1080 PNGs at full size and compared each with its `alpine-baseline/`
    and `round-2/` counterpart. Cropped / zoomed / measured with PIL under `scratch/review-a-r3/`.
  - Compared the merged-build cave and plunge shots with the art branch's pre-merge
    `round-3/wip/r3/` and `wip/iter/` captures to separate art changes from merge effects.
  - Read `round-3/REMEDIATION_{art,gameplay}.md` as claims only. Spot-checked
    `src/world/TerrainRenderer.ts` (R3 is implemented: `FAR_FINE_X = 3072`), `fjord/views/water.ts`
    (near Fresnel), `snowMaterial.ts` (coastal gneiss path).
  - `npx vitest run tests/unit/fjord_art.test.ts`: 7/7 pass.
  - **Evidence gap:** at my final check, `final/res-1366/` held only `01_menu.png`, and
    `final/res-2560/` did not exist. `res-1366/01_menu` lays out correctly and shows the same
    defects as the 1920 shot: clay-curtain cliff, slivers, ray streaks on the water. Summit and
    finish at 1366, and everything at 2560, are **unverified** for this build.

## 1. Verdict: **FAIL**

Round 3 fixes several things for real: the harbour now has a stone quay wall meeting the water
(`11b`, `11j`), the stockfish gag happens on the quay against the boats and islands (`11e`), the
finish sits closer to the water (`10`, `10b`), the splash is no longer a flat ring, the run passes
nearer the rim so the sea fills more of the gameplay frame (`03`, `09d`), and the far-field
faceting is finer. But the merge introduced regressions that are worse than what they replaced.
The sea-side cave (R4) is now **back-lit to pure black**: the mound, columns and lintel measure a
median luminance of 0–2/255 in `07`, and `08`, `08c` and `08d` are mostly black void. The same
change raised a **free-standing smooth snow "sugarloaf"** on the coastline that blocks the summit
view of the sea (`02`). The cannonball plunge lands in water that reads as a **snowfield** (`11j`,
`11h`). The new scoured-rock visual is a fan of **pale spindle "blades"** (`04b`, `04c`). Still
open from earlier rounds: the vertical smearing and needle crest on the cliffs, the uniform "loaf"
islands, the menu's clay-curtain cliff, and the houses standing loose on snow. The environment is
plainly *not* Alpine recoloured. At several hero moments, though, it is not 9/10 art: it is about
6.5.

## 2. Scores (from an art-direction point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **6.5** | Down from 7. Real wins: quay wall, quay rack, harbour proximity, `09d` composition, crown splash. These are outweighed by new hero-frame failures: the crushed-black cave (`07`, `08`, `08c`, `08d`), the summit sugarloaf (`02`), the plunge into "snow" (`11h`, `11j`) and the spindle rock (`04b`). The unresolved cliff smearing and needle crest dominate `06`, `11c` and `11i`. |
| Environmental uniqueness | **7.5** | Unchanged. Gameplay frames (`09`, `09b`, `09d`) and the finish/victory (`10`, `11b`, `11e`) could only be this place, and the cave is no longer the Alpine grey mound. But the summit (`02`) now centres on a generic snow pyramid, the reverse trophy shot `11` still faces an inland snowfield, and `08b` leaps against the inland wall with no sea. |
| Skiing and hazard mechanics | 6 (low confidence) | Visuals only. The windsock telegraph still reads well. The new scoured-rock view reads as placeholder (pale tapered blades on a black smudge decal, `04b`). From the chase camera it is a flat grey plate (`09d` x 240–940, y 595–680). |
| Difficulty and fairness | 7 (low confidence) | Outside my area. Open, readable runs; the sea is now in view. |
| Cinematics | **6.5** | Down from 7. The reveal (`11i` → `11c`) remains strong, and the quay framing (`11d`, `11e`) is much better. Against that: the cave beats are near-black; in `11g` the trophy plinth sits where the presenter's head is (he reads as lighthouse-headed); the cod in `11f` reads as a stick through his nose; and the plunge lands on what reads as snow. |
| Performance and stability | 7 (low confidence) | Not measured. The manifest reports no errors. |
| Accessibility and controls | 7 (low confidence) | Captions are present and legible. The cave beats are so dark (`08d`: about 85 % of the frame below 10/255) that the Yeti's surroundings are unreadable, which matters for low-vision players. |
| Overall player experience | **6.5** | The ski run itself now feels coastal and pleasant (`03`, `09d`). The encounter, the summit vista and the closing après gag each have a prominent visual failure that a player will notice. |

## 3. Status of earlier defects (my own verification)

### Round-2 (A1–A13, N7)

| # | Defect | Status | Evidence |
|---|---|---|---|
| A1 | Harbour water's edge: smeared bank, no quay wall | **Mostly fixed** | `11b` x 1250–1900, y 400–490 and `11j` y 630–695: a coursed stone quay with capping meets the water. Remaining: a sloped snow bank and loose houses behind the quay (`11b` x 1350–1920, y 340–400; `11j` x 1500–1920, y 570–630), i.e. G4 not done. |
| A2 | Cliff: vertical smearing, snow skirt, cone crest | **Partially fixed (skirt) / not fixed (smearing, crest)** | `06`: the white apron at bottom left is gone, but dense vertical striation still covers x 0–1100. White snow smears remain on sheer faces (y 600–900), and the crest is now *needle* spikes (crop `06_crest.png`, x 640–1000, y 80–300). New vertical white streaks on the sheer wall: `11c` x 1490–1840, y 780–950 (crop `11c_streaks.png`); also `10` x 790–960, y 180–420 and `11g`/`11d` behind the houses. G2 (crest) was not done (gameplay remediation §5). |
| A3 | Islands one repeated form | **Partially fixed** | The islands off the harbour carry pines, a boathouse and a skerry light (`10`, `11e`). The upper-arm islands in `01`, `02`, `03`, `05` and `09` are still identical snow-capped loaves (G3 not done), and the menu still has flat slivers (`01` x 1130–1200, y 285–300 and x 1270–1400, y 535–575). |
| A4 | Sea cave = Alpine cave + placeholder props | **Partially fixed, with a severe regression** | Sea now in frame (`07` left, `08` top left), basalt replaces the Alpine blotchy rock, irregular columns. But in the merged build the whole cave is back-lit to near-black (see M1). The lintel reads as a jumble of black cubes (`07_mouth.png`). The hull reads as scattered beige sticks and black blocks, and the net stands vertically in mid-air (`07` x 300–545, y 735–950; crop `07_props.png`). |
| A5 | Inland-wall faceting | **Partially fixed** | R3 is in code. Facets are visibly smaller (crop `05_wall_r2_vs_final.png`), but large planar facets and horizontal step seams still show in every chase frame (`09d` x 0–570, y 0–560; `09b` x 0–950, y 0–500). |
| A6 | Scoured rock reads as a decal | **Not fixed (changed, not improved)** | Close up it is now 6–8 pale, tapered spindle shapes fanned over a black smudge, with loose black cubes (`04b` x 665–1300, y 515–705; `04c` x 1070–1390, y 740–825). This reads as placeholder geometry, not wind-scoured rock. From distance it is still a flat smudge (`03` x 820–935, y 680–705). From the chase camera it is a flat plate (`09d`). |
| A7 | Hard-edged pale bands on water | **Mostly fixed** | `06`: the band near the cliff foot is softer, but a long straight pale band remains across the water at x 800–1400, y 800–860. New: in `01` the pale streaks on the water (x 1260–1700, y 700–950, crop `01_streaks.png`) read as straight light rays. |
| A8 | Splash a flat white ring | **Fixed as an effect** | `11h`: torn spray sheets, droplets and a jet. However, it now erupts from a surface that reads as snow (M3). |
| A9 | Trophy floating above the presenter | **Fixed / new issue** | `11g`: the trophy is gripped, but from this angle the plinth occupies exactly where his head is (x 830–1030, y 610–700), so he reads as having a lighthouse for a head. |
| A10 | Rocks floating in mist | **Fixed** | No longer visible in `11d` or `11g`. |
| A11 | Gag beats lose the harbour; identical cod | **Mostly fixed** | `11e`: rack on the quay, with boats, islands and a ship behind. Remaining: the cod are still identical cut-outs in perfect rows (`11e`, `11f`), the hand-held cod in `11f` reads as a thin stick through the nose (x 880–945, y 350–500), and the reverse shot `11` still faces an inland snowfield. |
| A12 | Menu cliff face featureless | **Not fixed** | `01` x 800–1270, y 520–940 (crop `01_cliff.png`): the same smooth clay curtain and curled snow lip. The card-like rock is still at x 750–810, y 950–1060. |
| A13 | Close-up snow cells | **Partially fixed** | `05` is calm. `04b` lower half still shows mottled blue cells. |
| N7 | `04b` did not show the hazard | **Fixed** | `04b` and `04c` now frame the scoured rock. |

### Round-1 items still open in my area
- **D7 (faceting):** partial (= A5).
- **D11:** partial (= A13).
- **D12 (menu):** not fixed (= A12).
- **D13 (mist):** mostly fixed (= A7).
- **D2:** partial (= A3).
- **D3:** partial (= A2).

## 4. Defects (final round)

### Critical
None strictly blocks rendering. M1 and M3 are borderline: they ruin a signature beat each.

### Major

**M1. (New, merge regression) The sea cave and its cinematic are crushed to black.**
- Evidence:
  - `07`: median luminance of the mound 0.3/255, columns 2/255, lintel 1/255, measured over x 600–1500 / 900–1700 / 780–1080. No surface detail is readable; the cave is a black cut-out.
  - `08`: about 60 % of the frame is black void.
  - `08c`: the gulls flutter against black.
  - `08d`: the roar is almost entirely black apart from the Yeti.
  - The art branch's own pre-merge capture (`round-3/wip/r3/07_yeti_cave.png`) shows a readable dark basalt (side by side: `scratch/review-a-r3/07_wip_vs_final.png`). The remediation's measured 55–77 RGB therefore does not hold in this build.
  - Cause (inferred): R4 moved the cave to the sea side, so the mouth now faces away from the sun. The basalt-only multipliers (indirect diffuse ×0.32, direct ×0.5, specular ×0.25) then leave nothing.
- Fix:
  - Re-tune the basalt multipliers for the shadowed sea-side orientation: raise the indirect floor, or add a cool sky-fill or rim term on basalt.
  - Add a cave-local fill light for the 07/08 cameras.
  - Target face luminance of roughly 35–60/255 *in the merged build*, and re-measure.

**M2. (New, merge regression) The summit vista is blocked by a free-standing snow sugarloaf.**
- Evidence: `02` x 820–1400, y 280–620 (crop `02_hill.png`). A smooth symmetrical pyramid of snow with a dark smeared band across its face stands on the coastline in the centre of the frame, between the start and the sea. The black cave cluster sits at its foot (x 855–930, y 440–515). In round 2 this view opened onto the sea.
- Cause: R4's "ordinary valley hillside" on the sea side around the cave (gameplay remediation §5).
- Fix: shape that hill as a coastal headland: cliffed on the sea side, lower, asymmetric, carried into the rim, with rock exposed on its seaward face. Alternatively, move the first cave further from the start so it is not the focal point of the summit shot.

**M3. (New) The plunge lands in water that reads as a snowfield.**
- Evidence:
  - `11j` and `11h`, y 700–960: a flat, matte, pale grey-white surface with soft blue mottling and no ripple or specular detail. The deck piles and the splash appear to stand in snow.
  - Measured mean RGB over y 760–950: about (136, 144, 152). The same water seen in `11b` measures about (67, 85, 98), and round-2 `11h` measured about (70, 88, 101).
  - The pre-merge `wip/iter/victory_15.05.png` shows the same thing, so this is art-side.
  - At this grazing camera height (about 1 m), the Fresnel term (`water.ts:96`) mixes almost fully to the pale fog/sky colour.
- Fix: clamp the grazing Fresnel for the near field (cap F at about 0.6), keep a darker body colour, add near-field normal detail and a specular sun streak, or raise the camera a little so the water reads as water.

**M4. Cliff smearing and needle crest persist (A2 residual).**
- Evidence: see the A2 row. This is the dominant surface in `06`, `11c` and `11i`, the location's signature long shots. The vertical white streaks on sheer faces also appear behind the harbour in `10`, `10b`, `11d` and `11g`.
- Fix:
  - G2: soften the inland ridged crest into a few large massifs.
  - Suppress the snow term on faces steeper than about 70°; the white streaks are snow on near-vertical slivers.
  - Break the fall-line striation with larger, horizontally dipping banding.

**M5. The scoured-rock hazard reads as placeholder geometry (A6).**
- Evidence: `04b` x 665–1300, y 515–705 and `04c`: pale, tapered spindle or blade shapes fanned out like feathers, on a soft black decal, with stray black cubes. No natural rock looks like this.
- Fix: model the ribs as low, angular, darker rock with flat-topped, wind-polished faces. Use irregular rather than tapered ends, ground the edges in the snow with a lip of wind crust, and drop the black smudge decal for a gravel/lichen ring.

**M6. Upper-arm islands are uniform loaves (A3 residual).**
- Evidence: `02`, `03`, `05`, `09`, `09b`: 15–20 near-identical smooth whalebacks with flat snow caps. `01` still has flat slivers.
- Fix: G3 (island archetypes in `coast.ts`): cliffed islands, skerry chains and one or two large forested islands; fewer, larger groups; no sliver tops.

### Minor

**m1. The cave props read as debris.**
- Evidence: `07` x 300–545, y 735–950 (crop `07_props.png`): the hull is unreadable among black blocks, and the net stands upright in mid-air. In `08b` a pale cylinder lies on the slope at x 420–530, y 835–905.
- Fix: lay the net on the ground and give the hull a clear silhouette. Once M1 is fixed these props will be visible, so make them read.

**m2. The presenter appears trophy-headed in `11g`.**
- Evidence: plinth at x 830–1030, y 610–700, exactly over the head.
- Fix: offset the hold further to the side or lower, or move the camera so the head and trophy separate.

**m3. The cod prop in `11f` reads as a stick.**
- Evidence: x 880–945, y 350–500.
- Fix: turn the cod's flat face to the camera for the bite, or give it some thickness.

**m4. The houses stand loose on snow, and one intersects another.**
- Evidence:
  - `10` x 1170–1920, y 450–660 (crop `10_right.png`): no street, footing or quay under them.
  - The green front house overlaps the cream house behind it.
  - The right-hand row has bare slate roofs while the left row has snow roofs.
- Fix: G4 (level apron); add footings or a street; de-overlap; make roof snow consistent.

**m5. The finish ground has leopard-spot blotches.**
- Evidence: `10b` x 0–700, y 600–800 and `10` plaza x 600–1000, y 570–740: evenly sized white ellipses on dark wet ground.
- Fix: lower the frequency and break up the shape of the slush mask, or swap it for drift lines along the setts.

**m6. The menu cliff is still a clay curtain (A12), and pale ray streaks show on the water.**
- Evidence: `01` (crops `01_cliff.png`, `01_streaks.png`).
- Fix: as in round 2; feather or shorten the mist sprites seen from above.

**m7. The rim reads as a soft snow shoulder dropping straight into the sea, with a row of evenly spaced cairns.**
- Evidence: `03` x 600–1500, y 440–720 (crop `03_rim.png`).
- Fix: expose rock outcrops and a broken cornice along the rim, and vary the cairn spacing. Today there are no "rocky coastal outcrops" at the gameplay camera.

**m8. The `07b` outlook shows no fjord.**
- Evidence: the frame shows the inland wall and the stylised "lightning-bolt" crack decal on the tide pool. The remediation's claim that the outlook frames the fjord no longer holds after R4.
- Fix: re-aim the evidence camera, or the beat, now that the mouth faces inland.

**m9. Thin pale stair-stepped outline along the cliff waterline.**
- Evidence: `06` (crop `06_foot.png`, along the whole foot); also a light outline around the islands in `01`.
- Fix: feather the shore band and foam line; reduce stair-stepping by sampling the waterline at higher resolution.

## 5. What works
- **Reveal (`11i` → `11c`).** The chute from summit to harbour, the beacon, the harbour row at the foot and the title over the settled frame. Still the best image in the set.
- **Harbour at the quay (`11b`, `11e`).** The stone quay, the boats, the stockfish rack against the islands and a ship. The gag now lives in the harbour.
- **Gameplay frames (`03`, `09`, `09d`).** The sea fills the right of the frame, with the harbour row and the lighthouse visible at the end of the run. Instantly not-Alpine (compare Alpine `09`, a forested V).
- **Finish (`10`).** Closer to the water, with a lighthouse on a rock, a pier and islands on the horizon.
- **Splash effect.** The torn spray sheets and droplets work as an effect.

## 6. Brief compliance — Fjord section (art-relevant bullets)

| Brief bullet | Status | Evidence |
|---|---|---|
| Enormous coastal cliffs | **Partial** | Scale is right (`06`, `11c`). Smearing, white streaks and the needle crest remain (M4). |
| Cold blue ocean water | **Partial** | Done at distance (`03`, `09`). The plunge water reads as snow (M3). |
| Distant islands | **Partial** | Dressed off the harbour (`10`, `11e`); uniform loaves elsewhere (M6). |
| Snowy mountain peaks | **Partial** | Needle crest (M4). |
| Clear skies, excellent visibility | **Done** | `03`, `09d`, `10` |
| Rocky coastal outcrops | **Partial / weak** | The basalt is black in its own shots (M1). The rim has no outcrops at the gameplay camera (m7). |
| Sparse evergreen forests at higher elevations | **Done** | `02`, `04c` |
| Colourful shoreline architecture | **Done (quality: partial)** | `10`, `11j`. Houses loose on snow (m4); flat untextured walls. |
| Occasional sea mist near the water | **Mostly** | `06`, `11c`. A residual band, and streaks in `01`. |
| Dramatic views across the fjord | **Partial** | `11c`, `09d` yes. The summit view is now blocked by the sugarloaf (M2). |
| Not a traditional ski village | **Done** | Compare Alpine `10`. |
| Harbour, boardwalk, colourful buildings, fishing boats, distant ships, ocean to the horizon | **Done** | `10`, `11b`, `11e`, `11c` |
| Skier crosses the finish near the shore | **Mostly** | `10`: water about 120 m beyond the arch (R5). |
| Victory exploits the elevation difference; ocean-to-mountain reveal | **Done** | `11i` → `11c` |
| Coastal-themed trophy, playful après-ski | **Done (quality: partial)** | Lighthouse trophy, sauna, tub, plunge. Issues: m2, M3. |
| Do not reuse the Alpine resort under different lighting | **Done** | Start, cave and finish are all distinct from Alpine. |
| §2: recognisable with the HUD hidden | **Mostly** | Yes in `03`, `09*`, `10`, `11*`. `07`/`08*` are recognisable only as "black cave"; `02` is dominated by a generic snow hill. |
| §9: 1366×768 and 2560×1440 verified | **Missing** (menu only) | `res-1366/01_menu.png` only; `res-2560/` absent at my final check. |
