# Fjord Coast, Round 1: Reviewer A (Environmental Art Director)

- **Reviewer:** A, Environmental Art Director
- **Nature of review:** model-based reviewer (same model family as the developers; not external)
- **Build:** `f8519ca` (branch `pass4-fjord`); screenshots in `docs/reviews/biomes/fjord/round-1/`, compared shot by shot with `docs/reviews/biomes/alpine-baseline/`
- **Date:** 2026-11-10
- **Method:** I viewed every Fjord PNG at full size, at 1920×1080 plus the 1366×768 and 2560×1440 variants. I put each one beside the matching Alpine shot. I read `src/world/biomes/fjord/**`, `src/world/coast.ts` (islands and ocean cut), `src/world/look/ranges.ts`, and `src/world/Vegetation.ts` (talus). I ran nothing and modified nothing apart from this report.

## 1. Verdict: FAIL

This is not "Alpine with recoloured materials." The sea, the cliff wall, the harbour, the lighthouse and the reveal shot of the victory cinematic are real structural and compositional changes. The menu preview and `11c_victory_reveal.png` could only be this location. The 9/10 art targets are still well out of reach, for five reasons:

- A hard-edged peach-coloured block appears in the sky. It shows in the long-distance composition and in a gameplay-height shot.
- The brief asks for "distant islands." What renders instead is hundreds of evenly scattered white blobs that read as ice floes or debris.
- The signature coastal cliff is one monotonous wall with a vertically stretched texture.
- From the gameplay camera (`09*`) the biome is mostly a white slope, a faceted mountainside, and the same trees, rocks, start gate and hut as Alpine.
- The Yeti cave is the Alpine cave mesh tinted beige, with crude prop dressing.

The harbour finish has the right ingredients, but at ground level it reads as a row of box houses around a grey-blotched snowfield. The boardwalk, boats and ships the brief asks for are hardly visible in the finish shots.

## 2. Scores (from an art-direction point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **6** | Strong macro idea: sea cliffs above open water, ending at a painted harbour. Execution falls short of 9/10. See the sky artefact (D1), floe-like islands (D2), the stretched monotonous cliff (D3), placeholder-grade cave and harbour dressing (D5, D6), and the faceted inland wall seen in every gameplay frame (D7). |
| Environmental uniqueness | **7** | Unmistakable in menu, summit, long-distance, finish and victory shots. Much weaker from the gameplay camera, where the sea is a thin strip at the horizon. The start gate and hut are identical to Alpine, and the cave is the Alpine mesh recoloured. |
| Skiing and hazard mechanics | **6** (low confidence) | I judged only the visuals. The sea-gust windsock is a clear, diegetic telegraph. The scoured-rock hazard looks like a floating grey sheet with black cubes on it. That is readable, but placeholder-looking. |
| Difficulty and fairness | **7** (low confidence) | Outside my expertise. The visuals show broad open runs with hazards beside the line rather than across it, which fits a 2/5 biome. I did not test this. |
| Cinematics | **7** | The `11c` sea-to-mountain reveal does what the brief asks and is the best image in the set. `08` puts the camera inside a basalt column: the left third of the frame is a flat dark plane. `11b` is crude: a flat brown deck slab, a sprite flame and smeared water. |
| Performance and stability | **7.5** (low confidence) | Every manifest reports `errors: []`. Frame rate cannot be judged under SwiftShader, and I did not measure it. |
| Accessibility and controls | **7** (low confidence) | Captions are present, e.g. "[heavy footsteps behind you]". The `11c` subtitle "Fjord Coast — from the summit to the sea" has low contrast over the bright cliff. |
| Overall player experience | **6.5** | Worth a look from the menu and in the closing shot. During actual skiing it mostly feels like the Alpine run with sea on the horizon, and the finish is underdressed at ground level. |

## 3. Defects

### Critical

**D1. A hard-edged peach-coloured block is rendered in the sky.**
- Evidence:
  - `06_long_distance.png`: an opaque peach rectangle at about x 1170–1405, y 420–548. It has a perfectly vertical right edge and sits on the horizon beside the cliff.
  - `04b_hazard_rock.png`: a flat peach trapezoid at about x 720–1070, y 150–200, above the horizon in the centre of the frame.
- Probable cause (not proven): the colour matches the Fjord `sunHaze` `[1.0, 0.84, 0.66]` (`src/world/biomes/fjord/biome.ts:95`). The shapes match a distant-range ridge segment from `DistantRanges` with `openSector { center: 2.2, halfWidth: 1.35, floor: 0.03 }` (`biome.ts:110`, `src/world/look/ranges.ts:59-73`). That ridge shader fogs anything near or below the viewer's horizon fully to `sf_fogColor(v)`, which is tinted toward `uSunHaze` near the sun (`ranges.ts` "anything at or below the viewer's horizon … pure haze"). The sky dome behind it is a different colour, so the ridge shows as a flat cut-out.
- Fix:
  1. Confirm by hiding `DistantRanges.group` in the `?debug` harness at the `06` camera.
  2. Then either make the ridge haze match the sky colour exactly in that direction, or suppress the ridges fully (floor 0) across the whole open sector with a soft edge instead of a band.
  3. Add a regression screenshot at the `06` camera.

### Major

**D2. The "distant islands" read as ice floes or scattered debris, not islands.**
- Evidence: `02_summit`, `03_mid_mountain`, `04_signature_hazard`, `05_material`, `06_long_distance`, `10_finish`, `01_menu`. Hundreds of small white snow-capped lumps are spread evenly across the whole sea out to the horizon. In `01_menu` some look like flat white paper scraps (around x 1580–1650, y 465–500). None has a rock shoreline, dark granite, trees, or a silhouette that reads as land at distance. The brief also asks for "cold blue ocean" and "dramatic views across the fjord". An evenly speckled sea reads as pack ice, which is a different place.
- Source: `coast.ts:465-475`. `island()` produces 8–45 m domes from fbm noise across the whole sea, and the terrain snow material covers them.
- Fix:
  - Make far fewer and much larger islands (hundreds of metres to kilometres), clustered into a few groups and an opposite shore.
  - Expose dark rock on steep shores and leave snow only on flat tops. Put pines on the larger ones.
  - Keep a few skerries near the harbour.
  - Remove or sharply reduce the even scatter.

**D3. The coastal cliff is monolithic and its texture is stretched.**
- Evidence:
  - `06_long_distance`: a single straight wall several kilometres long, with uniform vertical smearing (UV stretching on near-vertical faces), regular horizontal banding, and a white snow skirt at sea level along its whole length.
  - The same treatment appears on the harbour headland in `10_finish`, `10b_finish_ground` and `11_victory_trophy`, and on the right wall in `11c`.
  - The crest has evenly spaced spiky cones (`06`, upper left).
  - There are no buttresses, coves, gullies, waterfalls, ledges with birds or vegetation, or sea stacks.
  - The near-white and beige tones make it read more like an ice shelf than the "enormous coastal cliffs" of rock the brief describes.
- Fix:
  - Use triplanar or world-projected rock on faces steeper than about 60°.
  - Add plan-view variation to the cliff line: headlands, coves and talus fans at the base.
  - Use darker, wetter rock near the waterline, with no snow on vertical faces at sea level.
  - Add a few waterfalls or ice-falls and sea stacks.
  - Break up the crest silhouette with fewer, larger forms.

**D4. From the gameplay camera the biome is largely interchangeable with Alpine.**
- Evidence:
  - `09_pursuit`, `09b_hard_snowball` and `09c_hard_snowball_marker` show a white slope, a faceted grey-white mountainside on the left, sparse generic pines and rocks, and the sea as a thin hazy strip at the horizon. With the HUD hidden this would often not be recognisable, even though §2 requires recognition at a glance.
  - `02_summit` uses the same start banner, the same timber hut and the same fence-post line as Alpine `02_summit`.
- Fix:
  - Route the line so the rim and water sit in the gameplay camera's view more of the time.
  - Make a biome-specific start, for example a stave or turf-roof hut, a flag mast, or a summit cairn with a wind vane.
  - Add coastal trackside dressing: wind-bent trees, cairns, lichen rock, sea-spray rime.
  - Make tree and rock silhouettes clearly coastal rather than reusing Alpine props.

**D5. The Yeti "sea cave" is the Alpine cave recoloured, dressed with crude props, and not by the sea.**
- Evidence:
  - `07_yeti_cave` and `08b_yeti_cinematic` against Alpine `07` and `08b`: same mound shape, same mouth, same strata lines, same snow patches, tinted beige. `seaCave.ts:2` confirms the cave is shared and only dressed.
  - No water is visible anywhere near the cave, so "sea cave" does not read.
  - The basalt columns are untextured, flat-shaded prisms with flat white cap discs. Some caps look detached or floating (`07`, around x 550–710, y 195–215).
  - The foreground has near-black untextured hexagonal blocks (`07`, lower left x 20–180, y 830–960, and lower right), and loose hex boulders (`08b`, x 565–1180, y 590–670).
  - The icicles form a uniform comb.
  - Small pale shards appear to float inside the mouth (`07`, around x 890–1080, y 445–555).
- Fix:
  - Give the Fjord cave its own mesh, or at minimum a different silhouette, and place it where the sea or a frozen inlet is visible.
  - Texture the basalt (vertical jointing, weathering) and seat the caps on the columns.
  - Replace the black hex blocks with eroded columns.
  - Vary icicle length and spacing.
  - Ground or remove the floating shards.

**D6. The harbour finish is underdressed and its ground reads as dirty snow.**
- Evidence:
  - `10_finish` and `10_finish_2560x1440`: the finish area has large grey blotches with hard, wavy edges over snow. It reads as camouflage, not as quay paving, wet stone or a plaza.
  - The sea houses are one box-and-gable template repeated in different colours, with a single small square window on the visible gables. The three red houses in the foreground stand alone on open snow.
  - `10b_finish_ground` and `11_victory_trophy`: at eye level the scene is an empty blotchy plain with two rows of houses and a line of string lights.
  - Not visible in either finish frame: the boardwalk on piles, the finger piers, the moored fishing boats, and the distant ships the brief asks for. `harbour.ts:4-8` and `scenery.ts` describe them, and only one boat and the pilings show, in `11b`.
- Fix:
  - Give the quay a real paved or plank material with clean edges.
  - Frame the `10`/`10b` cameras, and the run-out the player sees, toward the waterfront: boardwalk, piers, boats, and the ferry or ship on the horizon.
  - Vary house size, height, roof pitch, door and window layout, and add some porches or boathouses. Put annexes, fish racks and crates between the houses.
  - Seat the foreground houses on footings or a street.

**D7. Heavy faceting on the inland mountainside, the dominant surface in gameplay.**
- Evidence: `09_pursuit`, `09b`, `09c` (left half), `02_summit`, `03_mid_mountain` and `05_material` (left). Large flat triangles with hard light/shadow breaks are visible across the whole wall. Alpine walls have some of this too, but in Fjord this wall fills about 40% of most gameplay frames.
- Fix: smooth normals or a denser mesh on the near wall band, plus a stronger macro-detail normal or bump on rock faces.

**D8. The scoured-rock hazard looks like a placeholder decal.**
- Evidence:
  - `04b_hazard_rock`: a flat grey polygon with jagged edges. Its left tip lifts visibly off the snow (around x 700, y 590). A few tiny black cubes are sprinkled on top.
  - It reads the same in `02_summit` (x 630–760, y 670–700) and `03_mid_mountain` (x 990–1085, y 690–705).
- Fix:
  - Blend it into the terrain material as a splat with soft, wind-scoured edges.
  - Add a few real low rock ridges breaking through, plus thin sastrugi around them.
  - Keep a readable but natural colour difference from the snow.

### Minor

**D9. Rocks appear to hang on sheer faces.**
- Evidence: `11c_victory_reveal`, right cliff, around x 1700–1910, y 250–610: discrete boulders sit on a near-vertical wall. Similar dots appear across the upper `06` wall.
- Likely cause: the talus/scatter passes (`Vegetation.ts` around lines 231–262) sample `mountain.heightAt` with a slope window that misses the coast's wall.
- Fix: reject placements whose local gradient, sampled on the final coast-modified height, is above about 1.0.

**D10. The `11b` celebration set is crude.**
- Evidence:
  - The deck is a single flat brown box (`harbour.ts:209`).
  - The foreground water texture is smeared into large blobs.
  - The flame is a flat sprite.
  - A grey rock floats in the sky area against the cliff at about x 860, y 150.
- Fix: add plank detail and edge trim to the deck, use a closer-range water normal LOD, use layered flame particles, and remove or ground the stray rock.

**D11. Snow close-up material.**
- Evidence: `04b` and `10b` foregrounds show blotchy blue cells that smear at grazing angles. This is shared with Alpine, but the material close-up is supposed to show biome identity.
- Fix: add a biome-specific coastal surface, such as wind crust, rime and sastrugi, and fix the grazing-angle filtering.

**D12. The menu preview has flat-card props, and the rim gives no sense of height.**
- Evidence: `01_menu`, the slab rock at about x 1075–1165, y 850–955 and the tree at about x 1250–1340, y 720–910 read as thin cards. The snow rim seems to meet the water at the same level because no cliff face is visible under it, which undersells the "enormous coastal cliffs".
- Fix: move the menu camera slightly outboard so part of the wall drop is visible, and replace the slab rock.

**D13. Atmosphere: "clear skies, excellent visibility" and "occasional sea mist" are not shown.**
- Evidence:
  - `02`, `03` and `05` have a heavy white haze band that erases the horizon and any far shore.
  - No shot shows recognisable sea-mist banks over the water, although `views/mist.ts` exists. They may be too faint, or absent at these cameras.
- Fix: thin the horizon band over open water so islands and the far shore stay crisp, and make sure at least one evidence shot shows a mist bank lying on the water.

**D14. Low-contrast subtitle in `11c`.**
- Evidence: the subtitle "Fjord Coast — from the summit to the sea" (around y 345) is nearly invisible against the bright cliff.
- Fix: add a darker scrim or text shadow.

## 4. What works

- **`11c_victory_reveal`.** A low shot from the sea along the cliff, looking up the descent with the coloured harbour at its foot and fjord walls behind. It delivers the brief's "start at the ocean and reveal the mountain" idea and is the strongest frame in the set.
- **Water.** Cold, deep blue-grey with wind ripples and a sun-glitter path. It reads as sea, not a recoloured snow plane.
- **Harbour palette.** The red, ochre, green, white and blue gabled houses, the striped lighthouse, the string lights and the "MÅL · FINISH" timber gate read as Nordic at once. None of it is the Alpine lodge (compare Alpine `10_finish`).
- **Menu preview (`01_menu`, all three resolutions).** It is unmistakably a different place from Alpine's.
- **Sea-gust windsock (`04`).** A diegetic hazard telegraph that fits the setting.
- **Tree density.** Sparse and appropriately open for an exposed coastal slope.

## 5. Brief compliance: Fjord section (art-relevant bullets)

| Brief bullet | Status | Evidence |
|---|---|---|
| Enormous coastal cliffs | **Partial** | Present and large (`06`, `11c`), but monotonous, stretched, and seldom visible from gameplay (D3, D4) |
| Cold blue ocean water | **Done** | `01`, `03`, `06`, `11c` |
| Distant islands | **Partial / weak** | They exist in code (`coast.ts:465`) but render as evenly scattered white floes (D2) |
| Snowy mountain peaks | **Partial** | Crest spikes in `06`; the far fjord walls in `11c` are good; summit shots are dominated by one faceted wall |
| Clear skies and excellent visibility | **Partial** | Blue skies, but a heavy horizon whiteout in `02`, `03`, `05`, plus the sky artefact (D1, D13) |
| Rocky coastal outcrops | **Partial** | Basalt at the cave only (crude). Little or no outcrop dressing along the rim or shore |
| Sparse evergreen forests at higher elevations | **Done** | `02`, `03`, `04` |
| Colourful shoreline architecture | **Done (quality: partial)** | `10`, `10b`, `11`: the right palette, but repetitive box houses (D6) |
| Occasional sea mist near the water | **Not evidenced** | No shot shows it (D13) |
| Dramatic views across the fjord | **Partial** | `11c` and `01_menu` yes. Gameplay views mostly no (D4) |
| Not a traditional ski village | **Done** | No lodge or chalet; a harbour instead |
| Harbour, boardwalk, colourful buildings, fishing boats, distant ships, ocean to the horizon | **Partial** | Buildings, ocean and lighthouse are visible. The boardwalk shows only in `11b` as a flat slab. One boat is visible (`11b`), and a boat on snow at the cave. No distant ships in any shot (D6) |
| Finish near the shore | **Done** | `10`, `10b` |
| Victory exploits the elevation difference; ocean-to-mountain reveal | **Done** | `11c` |
| Coastal-themed trophy, playful après-ski | **Done (quality: partial)** | Gilded lighthouse trophy (`11`); badestamp hot tub with bonfire (`11b`), crude (D10) |
| "Do not reuse the Alpine resort under different lighting" | **Done for the finish; not done for the start and cave** | Start gate and hut identical to Alpine (`02`); cave is the Alpine mesh recoloured (D5) |
| §2: recognisable with the HUD hidden | **Partial** | Yes in menu, summit, long-distance and finish shots; doubtful in pursuit gameplay (D4) |
