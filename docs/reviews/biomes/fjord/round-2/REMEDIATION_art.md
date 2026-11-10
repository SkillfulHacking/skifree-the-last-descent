# Fjord Coast, round 2: art and cinematic remediation (reviewers A, C, F)

- **Branch:** `pass4-fjord-art` (worktree `sf-fjord-art`), from `bca5b14`. To be merged with the
  gameplay/tech branch `pass4-fjord`.
- **Scope:** the visual and cinematic findings of round 1: Reviewer A (art), Reviewer C (cinematics)
  and the visual items in Reviewer F (critic). Gameplay, physics, hazard logic, the course profile
  and terrain generation belong to the other developer. Requests for them are listed at the end.
- **Evidence:** iteration captures are in `round-2/wip/`, at 960×540. They come from
  `tools/biome_evidence.mjs` against a production build of this branch, served from a private port,
  using SwiftShader. `compare_*.png` puts the round-1 frame (scaled to 960 px) above the round-2
  frame from the same evidence camera. `iterN_*` files are intermediate states and are kept
  because they show how a fix converged. Round-2 review evidence at the full set of resolutions
  still has to be captured from the merged build.
- **Alpine is unchanged.** Every change is either inside `src/world/biomes/fjord/**` or behind a
  Fjord/coastal condition:
  - the terrain shader's `coastal` branches (new GLSL is emitted only for coastal biomes, so the
    Alpine program source is identical);
  - `TerrainRenderer` normal smoothing, gated on `mountain.coast`;
  - the `DistantRanges` far-plane clamp, gated on `openSector`;
  - `horizonHaze`, which defaults to the old `0.92` literal;
  - the `StartArea` hook (biomes without one get the shared start, unchanged);
  - the `CaveCinematic` hook (`cinematic?` on the cave presentation: Alpine has none, and the
    shared camera numbers moved into `CAVE_CAMS` without changing value);
  - Vegetation talus rejection, gated on `coast`, with the RNG call order unchanged.

  The one deliberate cross-biome change is the Hard-mode snowball readability (item 11), as the
  brief asked. `npx tsc --noEmit` is clean. `npx vitest run` passes (14 files, 246 tests, including the new
  `tests/unit/fjord_art.test.ts` and the Alpine terrain goldens).
- **Evidence harness note.** In held captures (`?debug` + `hold(true)` + `frames(n)`), App never runs
  the finish environment's per-frame update, so in every round-1 victory still the guests, boats,
  plunge and steam stood still. `tools/biome_evidence.mjs` now ticks the finish environment on the
  simulation clock during the Fjord victory beats. Alpine victory captures are unchanged.

## Commits

| SHA | Summary |
|---|---|
| `52b9d62` | D1: sky artefact root cause and fix (far-plane clamp), before/after at the 06 camera |
| `537f343` | Islands, cliff geometry and shading, coarse-LOD normals, talus, haze knob, coastal start, sea cave + cinematic hook, scoured-rock view, building kit |
| `acea089` | Harbour and victory rework, snowball readability, sea mist, `fjord_art.test.ts` |
| `54ea10a` | Basalt/cave material pass, hull, rim outcrops, menu camera, Fjord victory beats in the evidence tool |
| `c1ff78f` | Victory iteration: the plunge works, presenter staging, reveal path, stockfish, plaza shape, near-water ripples |
| `1ed4486` | Rock ribs drape, matte basalt, orange snowball glint, street props, rounder islands |
| `d0373cd` | Near-black basalt albedo, darker gneiss, per-viewport snowball glint size |
| `0256c3d` | Presenter meets the skier face to face; finish environment ticked in victory captures |
| (final) | This document and the final wip captures |

## Findings → changes

### 1. CRITICAL: the hard-edged peach rectangle in the sky (A D1, C 6, F 3, E)
**Root cause (proven).** It was not a mist sprite and not the ridge haze colour. The horizon haze
band (a cylinder of radius 11.6 km) and the outer ridge ring (10.9 km, plus up to 0.7 km of
lean-back) sit just inside the camera's 12 km far plane. With any pitch, the lower parts of the
band lie beyond the far plane in view depth (`z_view = r·cosφ·cos(pitch) + Δy·sin(pitch)`), so the
GPU clipped them. The clipped region is bounded above by a near-horizontal line and at the sides by
near-vertical lines. Through that hole the raw sky dome shows its warm grey-peach low-sun horizon.
Alpine hides the hole because ridges stand all round. Fjord's open sector leaves nothing behind it.

**Diagnosis captures.** The 06 camera, three ways:
- `wip/D1_06_before.png`: the rectangle at x 590–610.
- `wip/D1_06_diag_no_ranges.png`: with `DistantRanges` hidden, the peach becomes a full-width band,
  so it is the sky showing through.
- Hiding the band alone does the same (`scratch`). The original developer's `scratch/diag/rk_*`
  captures show the same.

**Fix** (`ranges.ts`, `52b9d62`). Clamp clip-space z inside the far plane, in the band and ridge
vertex shaders (`gl_Position.z = min(z, 0.99999·w)`), for open-sector looks only. Depth order
against everything nearer is unchanged.

**After:** `wip/D1_06_after.png`, same camera, no rectangle. The 04b frame no longer shows the
trapezoid either (`wip/iter4_04b_hazard_rock.png`).

### 2. Islands read as hundreds of evenly scattered ice floes (A D2, C 11, F 9, E)
`coast.ts island()` is rewritten as clustered placement (`537f343`, refined in `1ed4486`):
- **Clusters, not scatter.** 1.35 km cells; about 42 % hold a cluster.
- **Main island.** A glaciated whaleback 0.3–1 km long and 30–185 m high, elongated along a grain.
  The outline is domain-warped into coves and points. The profile is mostly a rounded dome, so it
  stays rounded when the 64 m far-field tiles sample it, with a steeper rim at the waterline.
  Ridged grain and a cleft run along its length.
- **Islets.** 1–4 satellite islets strung along the same grain, 12–34 m high.
- **Exclusions.** Nothing within ~380 m of the cliff foot (the rim views stay clean). The harbour
  mouth and the victory reveal's sightline are kept clear.
- **Rock, snow and shore.** The terrain shader puts rock on the steep shores and snow on the domes.
  The coastal shore band gives every shoreline a wet dark edge and an animated surf line.
- **Test.** `fjord_art.test.ts` checks that islands cover 1–25 % of the open sea in large connected
  pieces (fewer than 1.2 land/sea edges per land cell; an even speckle has about 4).

Evidence: `wip/D2_04_islands_iter2.png` and `compare_04_signature_hazard.png` (groups of rocky
islands with snow tops in place of floes), `compare_02_summit.png`, `compare_10_finish.png`
(islands on the horizon read as land).

### 3. Monotonous coastal cliff with vertical texture stretching (A D3/D9, C 5, F 10)
**Geometry** (`coast.ts seaSide`, cliff-face terms only):
- A ridged field of **buttresses and coves** pushes whole sections of face out to sea by up to
  about 35 % of the cliff's extent, so the wall breaks up in plan.
- **Ledge count and strength vary** along the coast (5–9 benches, never a regular stack).
- **Couloirs** have warped, irregular spacing and are gathered into gullied sections between
  smooth slabby faces.
- The **lower face is steeper**, with no long apron at the waterline.

**Shading** (`snowMaterial.ts`, coastal branch only):
- The fall-line streaks read as UV stretching on km-high walls. Coastal gneiss replaces 82 % of
  that rock with broad tonal zones, gently dipping foliation bands, joint-bounded blocks with their
  own tone, sparse vertical master joints, and rare, discrete frozen seeps.
- The walls are darker and wet (×0.68), so they read as rock and not as an ice shelf in a low sun.
- **No snow skirt at sea level.** The lowest 60–190 m of every wall and steep shore is
  spray-washed bare rock, darkening towards the water.
- The triplanar projection itself was already in place (`sf_tri*`). The stretching came from the
  anisotropic streak noise, not from UVs.

**Rocks stuck to sheer faces** (`Vegetation.ts` talus, coast only). Each talus block is now
rejected where its own ground is steeper than about 45°. Previously only the cluster centre was
tested, and blocks spread 14 m onto the wall. The RNG order is unchanged.

**Spiky crest cones.** These are the inland valley wall's ridged crest (terrain generation), not
the coast. They are listed as a request below.

Evidence: `wip/D3_06_iter1.png` → `wip/D3_06_iter2.png` → `compare_06_long_distance.png`.

### 4. Fjord identity from the gameplay camera (A D4, F 6)
What the art side can do without moving the course:
- Islands on the horizon now read as land (item 2).
- The horizon is crisper. Fjord sets `horizonHaze` 0.62 (was 0.92) and fog density 0.000125
  (was 0.000145).
- Sea mist is always present on the first arm and the open sea, some banks hug the foot of the
  wall, and one bank lies across the harbour mouth (A D13).
- Granite rim outcrops (lichen, sea-spray rime on the seaward face, snow in the lee) stand between
  the red-T cairns along the cornice. They sit on the sea side of the gameplay frame.
- The inland wall that fills the left of every chase frame is smoother (item 9).

Evidence: `compare_09_pursuit.png`. The sea now ends the corridor with rocky islands in view.
**Not fixed.** The sea is still a strip at the end of the corridor most of the time. That needs the
route and the rim to move (terrain is gameplay-owned): see requests R1 and R2.

### 5. The start area is the Alpine one (A D4, F 7)
`StartArea.ts` gets a biome hook, `registerStartDressing(biomeId, f)`. Fjord registers
`views/start.ts`, which keeps the same footprint (the gate 12 m down the route, the wand at
z = 2.8, the shelter up-slope on the sea side):
- a gate of silver-grey, weather-checked driftwood posts lashed with rope;
- netted glass fishing floats and buoys hanging from the beam;
- a line of nautical signal pennants;
- a falu-red START board ("FJORD COAST · TOPPEN 0 M · TO THE SEA");
- a dry-stone shelter with a turf roof under snow, a red door and a lit window;
- a flag mast with a long swallow-tail pennant and a gilded fish wind vane;
- a cairn with a red T;
- a rope line on driftwood posts strung with floats in place of the fence.

Evidence: `compare_02_summit.png` (red board, mast, stone hut, float line instead of the Alpine
arch, hut and fence).

### 6. The sea cave is the Alpine cave tinted (A D5, C 1/2/12, F 5/8)
The cave geometry contract is untouched, so Yeti grounding and the clearance bake are exactly as
before. What changed (`views/seaCave.ts`):
- **Cave rock (material only).** A Fjord pass is chained onto the shared cave-rock shader. The
  rock is near-black columnar basalt, with column seams in plan that show only on steep faces (and
  not every seam is open), a faint salt crust, and matte, wet rock. Alpine bedding no longer reads
  through.
- **Columns.** Hexagonal prisms packed tight, flat face to flat face. Each one is seated: its base
  is sunk below the lowest ground under its footprint. Each has its own shader, with anti-aliased
  cross-joints, wet near-black rock at the base and a lighter top. A snow cushion of the same
  hexagon sits exactly on every top. They step down from the wall like a giant's causeway. The
  boxy fallen drums are gone.
- **Water and ice.** A frozen tide pool lies flush on the cave floor at the mouth: dark
  green-blue sea ice with white cracks, following `floorHeightAt`, drawn with polygon offset. The
  Yeti emerges across it. A heap of broken sea-ice plates lies beside the mouth.
- **Wreckage that makes sense.** An overturned clinker hull (plank bands, faded blue top strake,
  a staved-in patch) lies half-buried on its side against the columns, with a broken spar,
  silver driftwood, slatted lobster pots, floats on a grounded line, fish bones, and the torn net
  draped over a low column step instead of hung in the air.
- **Icicles.** Irregular clusters, a few long ones, and gaps instead of a comb.
- **Camera clearance.** `CaveCinematic` exports its camera stations (`CAVE_CAMS`) and
  `caveCameraSightlines()`. The dressing rejects any prop within its radius plus 1.6 m (widening
  with distance) of a camera→subject line, or within 3 m of a camera, as well as the exit path and
  ledge. `tests/unit/fjord_art.test.ts` builds the dressing for both cave orientations and checks
  every recorded prop.
- **Biome hook for the cinematic.** `CavePresentation.cinematic?` (`presentation/cave.ts`) is
  called once by `CaveCinematic`. Shots added by the hook override the shared ones covering the
  same time, and the extras are disposed when the cinematic finishes. Fjord's
  `views/seaCaveCinematic.ts`:
  - gulls perched on the column tops scatter, screaming, on the rumble at 2.45 s, with the slough
    shot re-framed higher and wider to catch them (caption `[gulls scream and scatter]`);
  - on the roar, a plume of freezing spray and sea smoke bursts from the mouth;
  - icicles shatter off the brow;
  - the roar's wide shot opens a little wider.

  Alpine has no hook, so its encounter is unchanged.

Evidence: `compare_07_yeti_cave.png`, `compare_08_yeti_cinematic.png` (the emergence frame is no
longer blocked by a column), `compare_08b_yeti_cinematic.png`,
`wip/C2_08_emergence_clear_iter2.png`.
**Open.** The cave sits where the course puts it, on the snow slope, and the sea is not in its
frames. See request R4.

### 7. Harbour finish: box houses, blotchy ground, invisible boardwalk/boats/ships (A D6, C 10/11, F 4)
**Ground.**
- The coastal shore band's spray blotches no longer apply on flat ground. They were the
  "camouflage" on the plaza.
- The quay is paved with granite setts (snow in the joints, swept drifts). The paving is shaped
  as a street that widens into the quay square, with a ragged snow edge feathered by vertex alpha.

**Buildings** (`views/buildings.ts`):
- `house()` now has framed, mullioned windows on one or two floors, a framed front door with a
  step, optional porch and dormer, trim and roof colours, and clapboard banding.
- New `warehouse()` (sjøhus): tall, with a steep water gable, stacked framed loading doors, a hoist
  beam and small windows.
- The waterfront alternates warehouses and homes on the quay, with red boathouses on stilts over
  the water beyond the boardwalk.
- A street of five home types lines the run-out (two-storey with porch, cottage with dormer,
  eaves-on long house, tall narrow gable, net loft), with eaves or gables to the street and
  kick-sleds by the doors.

**Water's edge.** A real boardwalk of individual planks on stringers and piles. Finger piers of
planks with bollards and tyres. A granite quay capping course.

**Boats and ships.** Boats moored along the central boardwalk, where the 10/10b cameras and the
player look; a trawler at the east pier; two boats underway; a freighter and a ferry on the
horizon.

**Life.** Three stockfish racks (hjell) hung with properly shaped split cod. A fish kiosk with a
striped awning, a flag mast, kick-sleds, lobster pots and crates.

Evidence: `compare_10_finish.png`, `compare_10b_finish_ground.png`. At eye level it is now a
village street opening onto the quay and the water.
**Open.** The quay front is 190 m from the line (`FJORD_COAST.quayZ`, a terrain parameter), so the
water is still in the distance in 10b. See request R5.

### 8. The victory is the Alpine script with swaps (C 3/4/5/7/8/13, A D10/D14, F 4/11)
`views/harbourVictory.ts` is new; the beat sheet is in its header and in `HARBOUR_BEATS`:
1. **0–3.4 s, onto the quay.** A low tracking shot at ski height as the skier glides onto the
   setts.
2. **3.4–7.6 s, the fish-rack gag.** The Yeti stops at the end of the big stockfish rack (its stop
   point moved next to the rack, C7). He sniffs, grabs a dried cod (a prop in his hand), bites,
   gags (caption `[the Yeti gags on a dried cod]`), flings it, and stomps off. The rack frames the
   shot.
3. **7.6–12.0 s, the presentation.** A new harbourmaster guest in yellow oilskins waits on fish
   crates beside the stop point (visible in 10b). On the beat he stands face to face with the
   skier, 3 m in front of wherever and however turned the skier came to rest, already holding the
   gilded lighthouse up. (The first iteration kept him on the crates; skiers stop anywhere and turn
   in the spray stop, so the over-the-shoulder shot could not find both of them:
   `wip/iter5_11g_victory_present.png`.) An over-the-shoulder shot shows his face. He tosses the
   trophy. A reverse angle shows the skier catching it and holding it up, with the descent behind
   them.
4. **12.0–15.6 s, après.** Shot from the water side of the bathing pier
   (`wip/compare_11b_victory_celebration.png`):
   - the deck is now planks;
   - bathers sit inside the staves (`tubR − 0.62`, lower seat);
   - the layered bonfire basket is in the mid-ground and a new sauna hut smokes behind;
   - the red-robed bather does a run-up, springs, tucks into a cannonball (squash, roll about his
     own axis), and splashes, with an expanding foam ring. The original plunge could never have
     played: the guest's own update reset its root every frame. That is fixed.
   - a low cut over the water for the splash;
   - near-camera water now has fine cat's-paw ripples instead of smeared swell (A D10).
5. **15.6–23.9 s, the reveal.** The camera starts low over the sea past the lighthouse, inside a
   mist bank across the harbour mouth (C13), rises, and pulls back over the open fjord, where the
   island lane is kept clear. It ends looking up at the summit, `routeX(0)`, and not at mid-course
   (C5). The path is kept to the open-fjord side so the headland frames only the right edge.
   - The title "YOU REACHED THE SEA" / "Fjord Coast — from the summit to the harbour" lands at
     20.8 s, after the move.
   - The final frame holds until results at 24.4 s.
   - The new `scrim` title class (dark halo) keeps the subtitle legible over bright scenery (A D14).

The evidence tool captures nine Fjord beats (`11d`–`11i` plus the usual `11`, `11b`, `11c`); Alpine
beats are unchanged. `fjord_art.test.ts` checks the beat order, the title-after-reveal rule and the
hold before results.

Evidence: `compare_11_victory_trophy.png`, `compare_11b_victory_celebration.png`,
`compare_11c_victory_reveal.png`, `wip/iter3_11e_victory_racks.png`,
`wip/iter3_11f_victory_gag.png`, and the final `wip/final_11*.png`.

### 9. Faceting on the inland mountainside; blotchy close-up snow (A D7, D11)
- **Faceting.** On coarse LODs (step ≥ 2 m) of coastal mountains, `TerrainRenderer` low-passes the
  vertex normals with a [1 2 1]² kernel over a 2-vertex ring. Neighbouring chunks agree at their
  borders. The under-sampled walls had shown every triangle's own shading gradient (hard creases
  along triangle edges).
- **Close-up snow.** In the coastal branch, the micro-relief bump is calmer (×0.55), which removes
  the blotchy blue cells at grazing angles.
- Both are Fjord-only paths.

Evidence: `compare_09_pursuit.png` (left wall), `compare_04b_hazard_rock.png` (foreground snow).
**Residual.** The upper wall beyond x = 512 m is drawn by the 64 m far-field tiles and keeps some
large planes. See request R3.

### 10. Scoured-rock hazard looks like a floating grey sheet with cubes (A D8, F 1 visual)
`views/hazardViews.ts rockView` is rewritten (visual only; the hazard radius and logic are
untouched):
- **Ground skin.** A 12-ring × 44-segment skin hugs the terrain, using polygon offset rather than a
  lift. Its colour runs from dark polished gneiss and blue wind-glaze ice in the core, through
  gravel, to wind crust, and the rim fades into the snow (vertex alpha).
- **Rock ribs.** 4–6 low, chamfered ribs break through along the wind grain. They drape over the
  slope per vertex and are about 45 % buried, never more than about 0.4 m proud, because skis pass
  over them and the hazard only adds friction.
- **Snow and gravel.** Snow tails lie in the ribs' lee, and gravel stones are scattered.

Evidence: `compare_04b_hazard_rock.png`, `wip/iter4_04b_hazard_rock.png`.

### 11. Snowball wind-up and ball unreadable in the rear view (C 9; all biomes, Hard only)
In `SnowballView`:
- The ball in the Yeti's fist swells and flashes during the 0.42 s wind-up.
- Every ball in flight carries a constant-screen-size glint (`sizeAttenuation: false`, so it keeps
  its size in the small inset) and a six-sprite comet trail of its last ~0.2 s.
- The glint is the landing marker's orange-red, alpha-blended so it reads against snow and sky. A
  first additive white version vanished on snow (`wip/iter4_09b_hard_snowball.png`).
- No other Alpine visual changes.

Evidence: `compare_09b_hard_snowball.png`, `final_09c_hard_snowball_marker.png`.

### Also addressed
- **A D12, menu.** The camera is a little further out and lower-looking, so the top of the wall
  drops away below the cornice (`final_01_menu.png`).
- **A D13, atmosphere.** Crisper horizon; mist banks are evident (item 4).
- **A D10, stray rock in 11b.** Gone with the talus fix. Not seen in the new framing.
- **C 12, hoard.** Replaced by the overturned hull (item 6).

## Not fixed / open
- **A D4 / F 6.** The sea is still a thin strip during most ordinary chase frames (R1, R2).
- **A D3.** Spiky crest cones on the inland valley wall (R2).
- **A D5 / C 1.** The sea cave is not beside the water. The cave placement is gameplay-owned (R4).
- **D7 residual.** Far-field tile faceting above x = 512 m (R3).
- **D6.** The harbour waterfront is 190 m from the line at eye level (R5).
- **Unverified at speed.** All evidence is SwiftShader stills at 960×540. Motion (the gull flight,
  the tuck, the boat bobbing), frame rate with the extra dressing (all merged per material; no new
  lights), and the full-resolution look still need checking on the merged build.

## Requests for the gameplay / terrain developer
- **R1.** Route the racing line (or a frequent alternate line) within about 40–60 m of the rim
  more often, especially on straights, and keep the cornice berm low where it does. With the chase
  camera at its usual pitch, the sea and the cliff drop then sit in the lower third of the frame.
  The new rim outcrops and cairns are placed 7–26 m inside the rim and will frame it.
- **R2.** Fjord inland wall: soften the ridged crest (`wallRelief` / `detail` / ridged frequency),
  so the skyline seen from the sea is a few large forms instead of evenly spaced spikes.
- **R3.** Far-field terrain tiles for coastal mountains: 32 m instead of 64 m on the sea and
  inland-wall side (about 4× vertices for those tiles), or widen `CORRIDOR_X` for Fjord. The
  `TerrainRenderer` coastal path is ready to take either.
- **R4.** Put Fjord cave encounters on the sea side of the run (`side` toward −X), as close to the
  rim as the anchor rules allow, so the sea shows behind the cave in 07/08b and the "sea cave"
  reads. The dressing and its camera clearance adapt to either side; the test covers both.
- **R5.** Consider a shorter `FJORD_COAST.quayZ` (about 120 m), so the waterfront is in the
  mid-ground of the run-out and the finish frames. The harbour layout is relative to `zq` and
  adapts.
- **R6.** Rim outcrops, cairns and harbour street props have no colliders. They sit in the cornice
  zone or off the stop line, but you may want colliders on the rim outcrops, which are 1–2.6 m
  rocks.
- **R7, a merge note.** I touched `src/ui/styles.css` (one new `.scrim` class),
  `src/world/resort/Guest.ts` (one new `handWorld()` method), `src/world/Vegetation.ts` (talus,
  coast only) and `src/world/StartArea.ts` (hook). None of these change Alpine.
