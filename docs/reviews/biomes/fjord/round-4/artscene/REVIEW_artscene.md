# Fjord Coast art-pipeline experiment (round 4): independent art review

- **Reviewer:** Environmental Art Director. **Model-based reviewer, not external** (same model family as the developers).
- **Build:** branch `fjord-art-r4` @ `46100cb` (`/home/claude/sf-art4`).
- **Date:** 2026-11-11.
- **Method:**
  - Viewed all 12 current/proposed pairs at full size (1920×1080), plus the two `*_fill1.3.png` cave captures.
  - Viewed the final-round `06_long_distance` and `11c_victory_reveal` for context.
  - Cropped and zoomed with PIL and measured luminance (median of grey values).
  - Viewed the baked `gneiss_albedo` and `basalt_albedo` textures.
  - Read `cliffKit.ts`, `artCoast.ts`, `rockMaterial.ts`, `basaltPortal.ts` and `docs/ART_PIPELINE.md`. The developer's notes were treated as claims to check, not as evidence.
  - I ran no browser, no build and no tests.
- **Scope limit:** the test scene contains no hamlets, ships, mist, vegetation, obstacles or HUD. It shows terrain, water and the new art only.

## 1. Verdict: **ADOPT WITH CHANGES**

The proposed approach is **clearly better for the sea cliffs and the sea cave**. Both of those were the worst defects in the final round:

- The vertical smearing on the cliffs is gone. The faces now carry horizontal strata, benches and buttresses.
- The cave goes from a black cut-out (median 0/255) to legible dark basalt (median 32–43/255).

The proposed approach is **not clearly better for the islands**. It adds variety, but the new forms read as manufactured objects: drums, layered cakes and pillows with a paving pattern. The old loaf domes also remain on the horizon in every shot. The baked rock material is the weakest part of the proposal. At mid-distance it reads as board-formed concrete or dry-stone masonry, not as gneiss.

Recommendation:

- **Adopt the cliff kit** (`cliffKit.ts`) and the **basalt portal material** (`basaltPortal.ts`).
- **Gate the islands** (`islands.ts`) behind the fixes listed below.
- **Do not treat this as reaching 9/10.** The proposed art is about **5.5–6/10**, against about **4–4.5/10** for the current art in the same frames. It is roughly 3 points short of 9/10.

## 2. Per-shot comparison

| Shot | Result | Why |
|---|---|---|
| `long` (= final `06`) | **Better** | The vertical fall-line striation and the white smears on the faces (current x 0–1100, y 100–950) are replaced by a few large rock bands with dipping snow benches (proposed x 0–1150, y 380–620). That is the right geological read at a kilometre. The plateau islands right of centre (x 1250–1400 and 1600–1910, y 600–760) break up the row of loaves.<br>Against it:<br>- The face is a uniform mid-grey, like canvas. A fine, regular hatch is visible at 1:1 (crop x 0–700, y 350–950).<br>- Irregular white "ice foot" patches cling to vertical rock at the waterline (x 140–340, y 800–920; x 560–740, y 680–790).<br>- The waterline is a crisp cut with no foam, talus or notch.<br>- The horizon is now emptier, because heightfield islands were removed and the far domes were left as they were.<br>- The needle crest (x 400–1020, y 0–330) is identical in both, because it belongs to the land heightfield. |
| `cliff` | **Clearly better** | The current frame is the worst image in the set: a clay curtain of vertical flutes with pale spindle streaks (x 380–1100, y 0–800). The proposed frame has a stepped, tiered, jointed wall that reads as rock architecture.<br>Against it:<br>- At 2× the rock reads as rendered concrete or stucco with soft horizontal hatching (crop x 300–800, y 250–550).<br>- The snow benches are paper-thin white slivers with knife-edge ends, with no thickness or overhang (x 370–1000, y 330–640).<br>- There is a dark blotch, apparently an AO or occlusion artefact, at x 925–1005, y 545–600.<br>- The foot meets the water as a straight edge (x 200–1390, y 800–890), with no wave-cut notch visible even though `cliffKit.ts` claims one. |
| `cave` (= final `07`) | **Clearly better** | Current: shell median 0/255 (98 % of pixels below 10), columns 1/255 (85 % below 10), and the lintel is a jumble of black cubes. Proposed: shell 43/255, columns 51/255, and the chamber stays black as intended (1/255). The hexagonal columns frame the mouth and step down in a causeway, which reads as columnar basalt.<br>Against it:<br>- The mouth is a clean round-topped tunnel with straight jambs, like a railway adit (x 850–1050, y 430–630).<br>- The shell texture is a regular rectangular joint grid draped over a blobby mound (x 500–1900, y 0–450). That reads as block masonry, and column joints do not form on a mound's skin.<br>- Column heights are quantised into regular treads with nearly uniform girth, all perfectly upright.<br>- The "sea cave" sits on a snowfield, not at the water. That is the round-3 placement, not this experiment, but the frame still does not say "sea". |
| `cave_near` | **Clearly better** | Current is 70 % of pixels below 10/255. Proposed has a readable shell (32/255) and columns (53/255), with only 4.6 % of the frame below 10, almost all of it the intended chamber.<br>Against it:<br>- Every column edge carries a pale vertical line from rim light on flat-shaded edges (x 590–600, 745–755, 1265–1275, y 360–860). At this distance it reads as chalk outlines on a toy kit.<br>- The octagonal snow caps are pillow-like.<br>- A loose tilted slab sits at x 420–520, y 750–810.<br>- The chamber floor has an olive-brown cast, RGB about (44, 46, 40), at x 900–1100, y 690–730.<br>- The shell still shows the brick grid (x 0–850, y 0–700).<br>- The shell median of 32/255 is just below the 35/255 floor of the developer's own target. |
| `islands` (= final `03` framing) | **Mixed / about the same** | Gains: the uniform loaves at mid-distance are gone; there is a skerry chain along a grain (x 840–1040, y 320–350) and a wooded islet (x 1385–1470, y 560–610).<br>Losses:<br>- The hero island (x 915–1115, y 435–540) is a fluted drum with a radial, star-shaped snow cap converging on a central point, like a pleated cake.<br>- The far island (x 1235–1320, y 300–340) is a flat-topped stump with vertical sides, like a tin can.<br>- A pale floating disc, a skerry that reads as a saucer, sits at x 1415–1460, y 555–575.<br>- The old loaf domes remain in the background (x 860–1500, y 230–280), so two visual languages sit in one frame.<br>- The mid-ground is sparser, and the current frame's scatter was, honestly, the more pleasing composition. |
| `island` (sea-level close-up) | **Mixed** | Gains: the cliff-girt plateau island (x 0–330, y 390–550) and the wooded islet with dense spruce (x 830–1110, y 495–600) are believable archetypes.<br>Losses:<br>- The foreground skerry (x 575–955, y 645–800) is a pale cushion engraved with a regular flagstone or tortoise-shell joint grid. Glacier-polished coastal rock is dark, wet and weed-banded at the waterline. This reads as a paved pillow and is the least natural object in the set.<br>- No foam or wet line at any island waterline.<br>- The plateau island's flanks are pleated like drapery (crop `clifisl`).<br>- Old domes remain at x 430–730 and 1520–1800, y 460–500. |

## 3. Scores (/10)

| Category | Current | Proposed | Notes |
|---|---:|---:|---|
| Cliff realism (form) | 4 | **6.5** | Tiers, benches, buttresses and dipping strata: the right idea, well executed in form. Still missing: no visible notch or talus, waterline snow patches, thin snow, and the panel-like segmentation of the tiers. |
| Rock material | 3.5 | **5** | No more UV stretch, and real normal detail exists. But the bake is low-contrast and the joint grid is masonry-like, so mid-distance surfaces read as concrete or stucco and the basalt reads as blockwork. |
| Islands / shoreline | 4.5 | **5** | More variety, but the silhouettes are artificial (drum, cake, pillow). No foam line, and two generations of islands sit in one frame. |
| Sea cave | 2 | **6** | From unreadable to legible. Held back by the tunnel-shaped mouth, the brick grid on the shell, uniform toy columns and chalk-line edges. |
| Overall composition | 5 | **5.5** | `long` and `cliff` improve. `islands` is sparser. The skyline needles (land heightfield) still dominate the signature long shot in both modes. |

## 4. Remaining defects (proposed)

### Critical
None blocks rendering.

### Major
- **P-M1. The baked rock reads as manufactured material** (concrete, stucco, blockwork).
  - Where: `src/world/art/textures/gneiss_albedo.webp`, `basalt_albedo.webp` (from `tools/artbake/bake.mjs`), and `rockMaterial.ts` (macro luminance clamp and strata). Visible in `cliff_proposed` x 300–1400, y 100–880, `long_proposed` x 0–1100, and the `cave*_proposed` shell.
  - The albedo is low in contrast, and the joints are near-orthogonal, evenly spaced courses.
  - Fix:
    - Replace with photo-scanned CC0 sets (ART_PIPELINE §3.2).
    - Failing that: rebake with fewer, irregular, non-orthogonal joints; stronger colour variation (rust seeps, lichen, wet streaks running down from benches); and a far-field albedo variation map in world space, not in the tile.
- **P-M2. Snow on the basalt shell follows a block grid, and the shell carries column joints.**
  - Where: `basaltPortal.ts` (the `rockMat` at line 109 uses the column-joint `basalt` bake on the mound).
  - Fix: use a separate massive, fractured basalt or lava bake for the shell; keep the column bake on the prisms only.
- **P-M3. The skerry archetype reads as a paved pillow.**
  - Where: `islands.ts`, skerry archetype (`island_proposed` x 575–955, y 645–800; the disc at `islands_proposed` x 1415–1460, y 555–575).
  - The top is too pale, the joints too regular, the outline a swollen cushion, and there is no dark wet weed band.
  - Fix:
    - Darken and wet the lower 1–2 m.
    - Use whaleback-style polished slopes with plucked lee steps.
    - Use a far lower joint density, or none at this scale.
    - No near-white albedo below the snow line.
- **P-M4. The cliff-girt islands read as drums or cakes.**
  - Where: `islands.ts`, cliffed archetype (`long_proposed` x 1600–1910, y 655–760; `islands_proposed` x 915–1115, y 435–540).
  - The profile is a vertical fluted skirt and a domed or radial top.
  - Fix:
    - Use asymmetric profiles: one high cliffed side and one long slope.
    - Use plan outlines with headlands and coves, not scallops.
    - Break the radial snow pattern on the cap.
- **P-M5. No foam or surf line where any mesh meets the water.** This applies to the cliffs, islands and cave columns, and is acknowledged in ART_PIPELINE §6.5.
  - Every waterline is a hard cut (`cliff_proposed` y 800–890; all islands).
  - Fix: a depth- or distance-to-mesh foam term in `FjordWater`, or a decal ring per island and per cliff segment.
- **P-M6. Integration risk: strand-flat hamlets.**
  - `src/world/coast.ts:393–628` raises a strand flat about 4.5 m above the water at each hamlet so the houses stand at the cliff foot (visible in final `06` at x 490–710, y 750–820).
  - `artCoast.ts` `kitWeight()` excludes only the headland crests and the finish, not hamlets. In `long_proposed` the flat at that spot is gone.
  - Without a hamlet carve-out in `CliffModel`, the houses will stand in the air or inside the wall.
- **P-M7. Two island generations in one frame.**
  - The far-field heightfield domes remain in every proposed shot (`islands_proposed` x 860–1500, y 230–280; `island_proposed` x 430–800 and 1520–1800).
  - ART_PIPELINE §8 says the proposed build "would replace them too". This is not shown, so it is unverified.

### Minor
- **p1. Thin, knife-edge snow benches.** Snow ribbons with no thickness or overhang. Where: `rockMaterial.ts` snow term and `cliffKit.ts` bench geometry (`cliff_proposed` x 370–1000, y 330–640). Fix: give snow geometric thickness on the bench meshes, or a soft cornice lip.
- **p2. "Ice foot" and snow patches clinging to vertical faces at the waterline.** Where: `rockMaterial.ts:245–253` (`long_proposed` x 140–340, y 800–920). Fix: cap `rkIce` by the face's distance from the waterline on near-vertical faces, or restrict it to a 0.3 m line.
- **p3. Chalk-line rim highlights on every column edge.** Where: `basaltPortal.ts` (flat-shaded prisms plus bevel). Fix: smaller bevel, darker edge tone, and varied lean and girth (5–7 sides, which ART_PIPELINE also notes).
- **p4. Tunnel-like cave mouth.** Where: the shared `Cave` geometry, not this experiment. Fix: an asymmetric, taller, fractured portal with a column-lintel overhang.
- **p5. Olive cast on the chamber floor.** Where: `cave_near_proposed` x 900–1100, y 690–730.
- **p6. Dark AO blotch on the cliff face.** Where: `cliff_proposed` x 925–1005, y 545–600 (`cliffKit.ts` occ term or gully overlap).
- **p7. Claimed wave-cut notch and talus cones are not visible** in any capture (`cliffKit.ts` header). Either they are too small to read, or they are absent.
- **p8. Documentation and provenance drift.**
  - ART_PIPELINE §8 still says the cave was "Not re-captured", but `46100cb` re-captured it.
  - The manifest's `sha` field reads `4b4472f` (the parent), not `46100cb`.
  - The "current" captures date from 13:46–14:03, before iterations 4–5. That is acceptable, because current mode does not use the art code, but it should be stated.

## 5. Developer claims checked

| Claim (ART_PIPELINE) | Finding |
|---|---|
| Vertical smearing gone on the sea cliffs | **Confirmed** (`long`, `cliff`) |
| Strata read at a kilometre | **Confirmed** (`long`) |
| Loaf islands replaced by archetypes | **Partly.** Archetypes are present, but far loaves remain and the new forms read as artificial. |
| Cave at fill 0.55 lands at about 35–45/255 | **Mostly.** Shell 43 in `cave`, 32 in `cave_near` (below 35); columns 51–53. |
| The cliff looks "a little like cast concrete" | **Confirmed, and understated.** It is the main limit on the material score. |
| Needles are the land heightfield | **Confirmed.** Identical in both modes. |
| +60–110k triangles in view in the game | **Unverified.** The test scene shows +100k to +560k per shot (`island`: 134k → 590k; `long`: 936k → 1.41M). Islands cost about 100–230k triangles. No frame-time numbers exist anywhere. |

## 6. What blocks 9/10

| Class | Items |
|---|---|
| **Fixable implementation defects** | Shell bake (P-M2), skerry and cliffed archetype shapes (P-M3, P-M4), foam line (P-M5), hamlet carve-out (P-M6), replacing far-field domes (P-M7), snow thickness and ice foot (p1, p2), column variety and edge tone (p3), AO blotch (p6), notch and talus visibility (p7), docs (p8). The land-heightfield needle crest (G2 from the final round) is also fixable, but outside this experiment, and it dominates the long shot. |
| **Missing art assets** | Photo-scanned CC0 rock sets for gneiss and basalt (the single largest lift for the material score). Scanned boulder and talus meshes. A hand-sculpted hero headland and cave portal (2–3 set pieces). Better pine and vegetation assets for the wooded islets. None was reachable from the sandbox. |
| **Architecture limitations** | Land-side terrain is still a heightfield. Rim, crest and inland walls keep the heightfield's faceting and needle risk, and the mesh/heightfield seam at the rim needs care. Merging the cliff segments as streamed LOD meshes means LOD transitions, which are unproven. The engine has no screen-space AO or GI, so the dark-cave legibility depends on a hand-tuned fill constant per site. |
| **Unverifiable subjective quality** | Whether the procedural bake can ever reach "commercial" without scans. How the kit reads in motion, through mist, and with the harbour and hamlets present (none is in the test scene). Whether the island silhouettes read as "Norwegian" to a player. A human art director or player panel would need to judge. |
| **Hardware-testing limits** | No frame times. The triangle counts in the test scene are 35–50 % higher than current; the in-game estimate is not measured. Download and GPU memory are estimated only, and KTX2 is not implemented. Not checked at 1366×768 or 2560×1440, on integrated GPUs or on mobile. LOD0 build cost is about 184 ms per segment (Node) and needs time-slicing; hitches are unverified. |

**Bottom line:** adopt the cliff kit and the cave material now. They fix the two most visible final-round failures, and the approach (authored meshes plus triplanar PBR) is the right architecture. Rework the island archetypes and add foam before the islands ship. Plan for scanned textures. Without them the material ceiling is about 6/10, and 9/10 is not reachable on procedural bakes alone.
