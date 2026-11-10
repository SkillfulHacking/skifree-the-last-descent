# Fjord Coast, Round 2: Reviewer A (Environmental Art Director)

- **Reviewer:** A, Environmental Art Director
- **Nature of review:** model-based reviewer (same model family as the developers; not external)
- **Build:** `aec1812` (branch `pass4-fjord`)
- **Date:** 2026-11-10
- **Method:**
  - I viewed every round-2 PNG at 1920×1080 at full size. That is 24 shots, including the new victory beats `11d`–`11i`. I also viewed `res-1366/{01,02,10}`. `res-2560/` did not exist when I finished.
  - I compared each shot with the matching `alpine-baseline/` shot and the matching `round-1/` shot. I cropped and zoomed regions with PIL, under `scratch/review-a-r2/`.
  - I read `REMEDIATION_art.md` as a list of claims to check, not as evidence. I checked parts of `src/world/biomes/fjord/views/{harbour,seaCave}.ts`, `biome.ts` and `TerrainRenderer.ts`.
  - I ran `npx vitest run tests/unit/fjord_art.test.ts`: 5/5 passed.
  - The `wip/compare_*` images come from the art branch at 960 px, before the merge. I used them only to understand intent. Every verdict below is based on the merged-build shots.

## 1. Verdict: FAIL

Round 2 is a real step forward, not a cosmetic one. These are fixed:
- the sky artefact;
- the Alpine start;
- the unreadable subtitle;
- the crude après set.

The harbour now has setts, framed windows, a plank boardwalk, piers, boats and ships on the horizon. From the ordinary chase camera, Fjord is now recognisably a coast (`09`, `09b`): islands and open water sit at the end of the run.

It is still not a 9/10 environment. These remain:
- The dominant gameplay surface, the inland wall, is still visibly faceted in every chase frame.
- The cliff still shows vertical smearing and a snow skirt at sea level. Its crest still has the evenly spaced cardboard-cone spikes, unchanged from round 1.
- The islands are now one repeated family of smooth, rounded "loaves". Some floe-like slivers remain.
- The sea cave keeps the Alpine cave's silhouette, with no sea in sight. Its dressing is still placeholder grade: untextured hexagonal prisms in a grid, a "hull" that reads as a flat disc, and floats hanging on lines in mid-air.
- The harbour's water's edge is a smeared dark bank with white elliptical holes, and there is no quay wall.

Five of the developer's own requests (R1–R5: route near the rim, crest, far-field tiles, cave side, quay distance) were not carried out in the merged build. As a result the structural problems of round 1 are largely still present.

## 2. Scores (from an art-direction point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **7** | Up from 6. Strong wins: the sky is clean, the start is new, the harbour reads at eye level, the deck is planked, and the title has a scrim. Still visible in hero and gameplay frames: the faceted inland wall (`09*`, `05`, `10`), the smeared cliff with its snow skirt and spiky crest (`06`, `04`, `11`), the uniform islands, the placeholder cave dressing (`07`, `08b`) and the smeared shore bank (`11b`, `11h`). |
| Environmental uniqueness | **7.5** | Up from 7. The gameplay camera now ends on sea and islands (`09`, `09b`, `09c`), and the start and finish could only be this place. But the cave silhouette is identical to Alpine `07`. The rack gag (`11e`/`11f`) and the reverse trophy shot (`11`) are set on a generic snowfield under spiky peaks, with no sea or harbour in frame. |
| Skiing and hazard mechanics | 6.5 (low confidence) | Visuals only. The scoured-rock ribs read better from the chase camera (`09`: slab cluster at x 570–745, y 605–635). From the summit and mid-mountain they still read as a grey smudge decal with dark specks (`02`, `03`). The windsock is a good telegraph. The hazard close-up shot `04b` no longer contains the hazard (defect N7). |
| Difficulty and fairness | 7 (low confidence) | Outside my area. The frames show broad open runs. |
| Cinematics | 7 | The reveal (`11i`, `11c`) is strong, and the title is now legible. The après set is much improved. Against that: the presentation frame `11g` has the trophy floating above the harbourmaster's hat while his mittens are on his head; the splash `11h` is a flat opaque white ring; and the gag beats lose the coastal setting. |
| Performance and stability | 7 (low confidence) | Not measured. All manifests report no errors. |
| Accessibility and controls | 7.5 (low confidence) | The round-1 low-contrast subtitle is fixed by the scrim (`11c`). Captions are present (`09`, `11f`). |
| Overall player experience | 7 | Much more of a coastal run than in round 1. The chase frames still spend about 40 % of the screen on the faceted inland wall, and the cave beat still looks like Alpine. |

## 3. Status of round-1 defects (my own verification)

| # | Round-1 defect | Status | Evidence |
|---|---|---|---|
| D1 | Peach block in the sky | **Fixed** | `06`: clean sky right of the cliff where r1 had the rectangle (x 1170–1405, y 420–548). `04b`: clean sky. |
| D2 | Islands read as floes | **Partially fixed** | Detailed in defect A3 below. Now clustered, rounded, rock-sided islands that read as land at distance (`10`, `11c`). At mid range in `02`, `03`, `05`, `09` there are 15–20 near-identical smooth "bread-loaf" domes, the same size and with the same flat snow cap, spread across the view, with no trees and no silhouette hierarchy. Flat white floe-like slivers remain near the cliff foot: `01_menu` at x 1275–1400, y 530–570; `res-1366/01_menu` at x 905–995, y 375–405. |
| D3 | Monolithic, stretched cliff | **Partially fixed** | Detailed in defect A2 below. `06`: darker rock, and buttresses and coves now break the waterline. Not fixed: strong vertical striation across x 0–800; white snow blotches and a white apron to the waterline at bottom left (x 0–370, y 860–1060), against the claim "no snow skirt at sea level"; and a crest identical to round 1 (evenly spaced cones, x 450–1000, y 20–330). The cones are also prominent in `04` (x 1440–1920, y 0–330) and in the background of `11`. |
| D4 | Gameplay frame interchangeable with Alpine | **Partially fixed** | `09`/`09b`/`09c` now show open sea and islands ahead (Alpine `09` shows a forested V-valley). The start area is new and coastal: driftwood gate, red board, stone hut, mast with pennant, cairn, float rope (`02`, zoomed). Still: no rim or cliff drop in the gameplay frame (R1 not done), generic pines and rocks trackside, and the left 40 % of the frame is the faceted wall. |
| D5 | Cave is the Alpine cave tinted | **Partially fixed** | Detailed in defect A4 below. Material, icicles, tide pool and gulls are new. The silhouette and mouth are identical to Alpine `07`/`08b`, and there is no sea in either frame (R4 not done). |
| D6 | Harbour underdressed, blotchy ground | **Partially fixed** | Setts, windows on one or two floors, porches and dormers, boardwalk on piles, finger piers, trawler, boats, and freighter and ferry on the horizon are all visible (`10`, `11b`, `11i`). Remaining: the houses are still one gable-box family; a group of houses stands loose on open snow with no street or footing (`10` x 495–615, y 540–620); the water is still distant in `10b` (quayZ is still 190, `biome.ts:38`, so R5 was not done); the presentation crates are flat-coloured untextured boxes (`10b` x 1360–1615, y 690–750); and there is a smeared shore bank (new defect A1). |
| D7 | Faceting on the inland wall | **Not fixed in gameplay frames** | Detailed in defect A5 below. `09`, `09b`, `09c` (left half), `05` (x 0–500) and `10` (cliff) still show large flat planes with hard light and shadow breaks. These are the 64 m far-field tiles (`TerrainRenderer.ts:19`, `CORRIDOR_X` unchanged at ±512; R3 not done). |
| D8 | Scoured rock looks like a decal | **Partially fixed** | Detailed in defect A6 below. From the chase camera (`09`) it reads as a low slab cluster. From distance it is still a flat grey smudge with black specks (`02` x 715–780, y 640–655; `03` x 1000–1150, y 830–880 and x 1250–1390, y 760–790). In `04` (x 190–540, y 720–765) it reads as long flat grey planks. I could not judge it close up (N7). |
| D9 | Rocks hanging on sheer faces | **Fixed (mostly)** | `11c` and `11i`: none on the right wall. `06`: far fewer dots. See N5 for the separate "rocks floating in mist" look. |
| D10 | Crude `11b` celebration set | **Fixed (with a new issue)** | Plank deck with stringers, iron fire basket, sauna, tub with bathers, finer water ripples. A new problem appears on the shore behind the set (A1). |
| D11 | Close-up snow cells | **Partially fixed** | Calmer, but `04b` (lower right) and `10b` (lower left) still show mottled blue cells that smear at grazing angles. |
| D12 | Menu: card props, no sense of height | **Partially fixed** | The wall drop is now visible under the rim. It reads as a smooth, featureless clay curtain under an overhanging snow lip (`01` x 760–1270, y 520–800). The card-like slab rock remains (`01` x 830–890, y 815–910). |
| D13 | Haze and missing sea mist | **Partially fixed** | The horizon is crisper (`04`, `10`: islands and ships on the horizon). The mist is either hard-edged (A7) or a murky grey smear across the harbour wall (`11d`, `11g`). It does not read as banks of sea smoke lying on the water. |
| D14 | Low-contrast subtitle | **Fixed** | `11c`: the subtitle is legible on its scrim. |

## 4. Defects (round 2)

### Critical
None.

### Major

**A1. (New) The harbour's water's edge is a smeared dark bank with white elliptical holes, and there is no quay wall.**
- Evidence:
  - `11b`, x 950–1900, y 410–470 (crop `scratch/review-a-r2/11b_shore.png`): a blurred grey-black band dotted with hard white ovals between the waterfront houses and the water.
  - `11h`, x 520–1500, y 255–300: the same band. The pastel house row stands directly on a sloping snow bank above it, with no quay edge, capping or pilings.
- This is the eye-level image of "harbour" the brief asks for, and it reads as dirty slush.
- Fix: run the granite quay capping and a vertical quay wall along the whole waterfront the cameras see. Suppress the spray and wet-rock blotch term on the bank under the harbour, or replace it with a clean wet-stone or seaweed band. Seat the houses on the quay or on stilts.

**A2. The cliff still shows vertical smearing, a snow skirt and the spiky crest (round-1 D3, residual).**
- Evidence:
  - `06`, x 0–800: dense vertical striation.
  - `06`, x 0–370, y 860–1060: a white snow apron at the waterline.
  - `06`, x 450–1000, y 20–330: a crest of evenly spaced cones, pixel-identical in layout to round 1.
  - The same cones dominate `04` (upper right) and the background of `11_victory_trophy` (x 0–1160, y 120–330), where they read as cardboard pyramids.
  - The cliff above the harbour in `10` and `10b` still has long vertical streaks.
- Fix:
  - R2: soften the ridged crest into a few large forms.
  - Extend the bare spray zone so that no snow material reaches the waterline on faces steeper than about 50°.
  - Break the remaining fall-line striation with the gneiss foliation (it is horizontal-dipping) at larger scale, or reduce the streak contribution further on faces taller than about 200 m.

**A3. The islands are a single repeated form (round-1 D2, residual).**
- Evidence:
  - `02`, `03`, `05`, `09b`: all islands share the same smooth whaleback profile, flat-topped snow cap and dark skirt. They are similar in size and spread evenly across the frame, which reads as a scattering of "loaves", not an archipelago.
  - None has trees, a cliffed headland or a skerry fringe. There is no clear opposite shore except in `10`, `11c` and `11i`.
  - `03`, x 1270–1560: the large island has a broad, soft white surf halo that reads as a glow.
  - `01_menu`: flat white slivers remain.
- Fix:
  - Vary the archetypes: steep-sided cliffed islands, low skerry chains, one or two large forested islands with pines on lower slopes, and a far shore with relief.
  - Use fewer, larger groups with a clear size hierarchy.
  - Tighten the surf band to a thin line.
  - Remove the sub-metre floe slivers.

**A4. The sea cave still reads as the Alpine cave with placeholder props (round-1 D5, residual).**
- Evidence:
  - The mound and mouth silhouette are identical to Alpine `07` and `08b`, and no water is in frame (R4 not done).
  - `07`: the columns are flat-shaded hexagonal prisms in a regular grid with disc caps. They read as bollards or batteries, not a giant's causeway (also `08b` x 655–800 and x 1105–1330).
  - The "overturned clinker hull" is a smooth beige-blue ellipse with two sticks laid over it, with no planking, keel or gunwale visible (crop `07_hull.png`, `07` x 175–520, y 880–975).
  - The floats hang on lines raised off the snow (`07` x 85–360, y 965–1050).
  - Pale shards still sit inside the mouth (`07` x 980–1090, y 440–500).
  - The cave rock carries a regular pattern of pale oval blotches (`07` throughout, `08b` cave face) that reads as camouflage, not basalt.
- Fix:
  - Move the cave to the sea side (R4), or at minimum give the Fjord cave its own mouth and mound silhouette, with sea or a frozen inlet in the 07/08b frames.
  - Vary column heights, tilts and broken tops, and add columnar texture on the prism faces.
  - Model the hull's clinker strakes, keel and gunwale.
  - Drape the float lines on the ground.
  - Remove the shards.
  - Suppress the inherited Alpine blotch term under the basalt pass.

**A5. Inland-wall faceting persists in every chase frame (round-1 D7, not fixed in the merged build).**
- Evidence: `09`, `09b`, `09c` (x 0–950, y 0–600): large flat planes with stepped light and dark breaks. Also `05` (x 0–500) and `10` (the harbour cliff).
- Fix: R3. Use 32 m far-field tiles on the inland side for coastal mountains, or widen `CORRIDOR_X` for Fjord. Add macro-normal detail on the far tiles.

**A6. The scoured-rock hazard still reads as a decal from most distances (round-1 D8, residual).**
- Evidence: see the D8 row in section 3.
- Fix: give the ribs real height variation and break-up visible beyond about 60 m, add darker lichen-stained top faces, and fade the skin into wind-crust sastrugi rather than a uniform grey smudge.

### Minor

**A7. Hard-edged pale bands on the water.**
- Evidence: `06`, x 360–1000, y 840–900: a lighter band hugging the cliff foot with a straight, hard lower edge. A similar band appears in `03`, y 380–430, along the whole shore.
- Fix: feather the mist and shore-band quads in depth and screen space, so no straight boundary shows.

**A8. The splash is a flat opaque white ring.**
- Evidence: `11h`, x 665–1360, y 550–750, a `RingGeometry` with `MeshBasicMaterial` (`harbour.ts:655`). The splash particles are barely visible in the frame, so it reads as a target marker.
- Fix: use a foam texture with a soft inner and outer falloff and broken edges, plus a visible spray column and droplets.

**A9. In the presentation frame the trophy floats above the presenter's head.**
- Evidence: `11g`, x 725–965, y 120–485: the trophy base intersects the top of his hat while both mittens rest on his head and do not touch the trophy.
- Fix: attach the trophy to the hand bones (the `handWorld()` path), or pose the arms up to the base.

**A10. Rocks appear to float in the mist.**
- Evidence: `11d`, x 1015–1530, y 165–330, and `11g`, x 540–1900, y 120–200: light talus chunks stand out sharply in front of the fogged dark wall.
- Fix: put the talus under the same mist and fog as the terrain behind it, or draw the mist sprites after the scatter.

**A11. The gag beats lose the harbour.**
- Evidence:
  - `11e` and `11f`: a bare snowfield, with neither sea nor harbour in frame.
  - The dried cod are identical grey pin shapes in a perfect row.
  - The cod in the Yeti's hand reads as a rolled tan tube (`11f`, x 875–915, y 645–730).
  - The reverse shot `11` faces the inland snowfield and spiky peaks.
- Fix: frame the rack against the houses or the water, vary the size and angle of the cod, and model a recognisable split-cod silhouette for the hand prop.

**A12. The menu cliff face below the rim is featureless.**
- Evidence: `01_menu`, x 760–1270, y 520–800, and `res-1366`, x 560–905, y 380–570: a smooth grey curtain under a curled snow lip.
- Fix: apply the coastal gneiss shading at this near LOD, and replace the curled lip with a ragged cornice.

**A13. Close-up snow (round-1 D11, residual).**
- Evidence: see the D11 row in section 3.

**N7. (Evidence) The hazard close-up `04b` no longer shows the scoured rock.**
- Evidence: the frame shows only snow, trees and the sea. The merge moved the hazard, but the shot's camera stayed where it was.
- Fix: re-aim the evidence camera at the nearest scoured-rock instance in the merged build.

## 5. What works

- **`11c` and `11i` reveal.** Sea to harbour to the whole descent, with boats and piers visible and the title legible. It is still the best frame in the set.
- **Start area (`02`).** It is new and coastal: driftwood gate, falu-red board, stone hut, mast, cairn and float rope. It is no longer the Alpine start.
- **`11b` après set.** Plank deck on stringers and piles, sauna hut, staved tub with bathers, fire basket. It is now a believable *badestamp*.
- **Harbour at distance (`10`).** Setts, pier, boats, and ships and islands on the horizon read as a Nordic harbour.
- **Gameplay identity (`09`, `09b`).** The run now visibly ends at the sea.
- **Sky.** The round-1 artefact is gone.

## 6. Brief compliance: Fjord section (art-relevant bullets)

| Brief bullet | Status | Evidence |
|---|---|---|
| Enormous coastal cliffs | **Partial** | Scale and buttresses: done (`06`, `11i`). Smearing, snow skirt and spiky crest remain (A2). |
| Cold blue ocean water | **Done** | `01`, `03`, `06`, `11b` |
| Distant islands | **Partial** | They read as land at distance (`10`, `11c`). At mid range they are monotonous, and some slivers remain (A3). |
| Snowy mountain peaks | **Partial** | The far fjord walls in `11c` are good. The near crest is cardboard cones (A2). |
| Clear skies, excellent visibility | **Done** | Crisp horizon in `04`, `10`; no sky artefact. |
| Rocky coastal outcrops | **Partial** | Rim outcrops are tiny at the gameplay camera. The basalt is placeholder (A4). |
| Sparse evergreen forests at higher elevations | **Done** | `02`, `03` |
| Colourful shoreline architecture | **Done (quality: partial)** | `10`, `11b`, `11h`: a single house family, and no quay wall (A1). |
| Occasional sea mist near the water | **Partial** | Present, but hard-edged or murky (A7, D13). |
| Dramatic views across the fjord | **Partial → mostly** | `11c`, `11i`, `01`, and the end of the run in `09`. |
| Not a traditional ski village | **Done** | Harbour, not a lodge (compare Alpine `10`). |
| Harbour, boardwalk, colourful buildings, fishing boats, distant ships, ocean to the horizon | **Done (quality: partial)** | All visible across `10`, `11b`, `11i`. The water's edge is weak (A1). |
| Finish near the shore | **Partial** | 190 m inland; the water is distant at eye level (`10b`, R5 not done). |
| Victory exploits the elevation difference; ocean-to-mountain reveal | **Done** | `11i` → `11c` |
| Coastal-themed trophy, playful après-ski | **Done** | Gilded lighthouse; *badestamp*, sauna, cannonball. Polish issues: A8, A9. |
| "Do not reuse the Alpine resort under different lighting" | **Partial** | Start and finish are done. The cave is still the Alpine silhouette (A4). |
| §2: recognisable with the HUD hidden | **Mostly** | Yes in `09` and `09b` now, through the sea at the end of the corridor. Doubtful in `07`, `08b`, `11e`, `11f` and `11`. |
