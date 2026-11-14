# Fjord Coast, round 3: art and cinematic remediation (reviewers A, C, F; D's mist seam)

- **Branch:** `pass4-fjord-art` (worktree `sf-fjord-art`), from `0d6180b`. To be merged with the
  gameplay/tech branch `pass4-fjord`. No gameplay commits had landed on `pass4-fjord` while this was
  done, so none of the round-2 requests R1–R5 are in these captures.
- **Evidence:**
  - `round-3/wip/r3/` holds a full evidence run of this branch at 960×540 (`tools/biome_evidence.mjs`,
    SwiftShader, served from `scratch/dist-snap` on port 4481), with its `manifest.json`.
  - `round-3/wip/iter/` holds iteration and diagnosis captures from a persistent driver, all at
    960×540 and from the same cameras as the evidence tool:
    - `before_*` are this branch at `0d6180b` (the round-2 art);
    - `iterN_*` and `victory_*` are intermediate states.
  - The round-2 review stills (`round-2/*.png`, 1920×1080) are the "before" images for every
    finding below.
  - The full-resolution review captures (1920×1080, 1366×768, 2560×1440) still have to be taken
    from the merged build.
- **Alpine is unchanged.** Every change is inside `src/world/biomes/fjord/**`, the coastal-only GLSL
  in `snowMaterial.ts`, or default-off hooks:
  - `Guest.hold`, `holdLift`, `tuck` and `run` are only ever set by the Fjord victory;
  - `CavePresentation.cinematic` (Alpine has none);
  - `StartArea`'s biome hook.

  Checks: `npx tsc --noEmit` is clean, and `npx vitest run` passes (16 files, 259 tests at
  `b5cc196`, including the Alpine terrain goldens). `tests/unit/fjord_art.test.ts` now has 7 tests.

## Commits

| SHA | Summary |
|---|---|
| `f882267` | Sea cave rebuilt (basalt material and lighting, causeway, portal colonnade, lintel, hull, floats); Fjord cave shots; mist height fade; water `discard` removed; shoreline quay wall; Guest pose hooks |
| `fc581fe` | Victory re-staged (quay shot, gag at a quay rack facing the Yeti, two-hand trophy, run-up/tuck/crown-splash plunge, start beacon, title after settle); beat-sheet test fixed |
| `b5cc196` | Cod prop and gag camera, seaward presenter, coastal cliff shading, island dressing, scoured-rock visual, start layout merged per material, harbour low preset, evidence 04b/04c/09d |
| (final) | Lintel test with a rock face, this document, wip captures |

## Findings → changes

### 1. Cave encounter (C1, F major 3/4, A4)

**Basalt, measured.** In round 2 the cave rock measured RGB ≈ 86–108, mid warm grey, with pale
oval blotches. Two causes:
- The Fjord pass blended the basalt over the shared bedded rock at 0.92. The remaining 8 % of that
  rock's weathering pattern was as bright as the black itself, and read as camouflage.
- In the Fjord, direct light (sun 4.5), sky light and the rough sky reflection lift any albedo to
  mid grey. Zeroing the columns' albedo at runtime still measured RGB 44–62: that is specular, not
  fog (`iter/` diagnosis).

Changes (`seaCave.ts`):
- The basalt now *replaces* the shared rock. The column seams and cross-joints sit on the steep
  faces only.
- On basalt only, the shader scales indirect diffuse by ×0.32, direct diffuse by ×0.5–0.55 and
  specular by ×0.25–0.3. Snow on the same mesh is untouched.
- Measured on a 960 px frame from the 07 camera, after the change:
  - face 55–60;
  - lintel 52;
  - sunlit column sides 60–77;
  - before: 86–108.

  It reads near-black against the snow (`iter/iter3_07.png`, `wip/r3/07_yeti_cave.png`).

**Columns, not bollards** (`basaltKit.ts`, `seaCave.ts`):
- 5–7-sided prisms, written straight into one buffer:
  - jittered corners and per-face tone;
  - 35 % have broken, slanted tops;
  - a little lean;
  - snow only on some level tops, as an off-centre drift.
- They sit on a jittered hexagonal packing. The height field is stepped into ~1.1 m terraces, and
  some columns are snapped stumps. There are fallen drums in the snow.
- Two unequal bodies:
  - a large causeway on one side;
  - a smaller, collapsed one on the other.

**Fjord silhouette.** The shared mouth is part of the geometry contract and is unchanged. The
dressing changes the silhouette around it:
- A **portal colonnade**: tall columns flanking the mouth up to the brow, seated on the real rock
  face. The face position is sampled from the rock mesh's own vertices in one binned pass.
- A **lintel of column ends** over the opening, fanned like the curved columns at Fingal's Cave.
- Icicles now hang from the lintel's lowest column ends, on a lip (C7).

**Hull.** `clinkerHull()` builds an overturned clinker boat:
- 7 overlapping strakes per side, each proud of the one above;
- a tarred hull with a faded blue/white sheer strake and a staved-in hole;
- keel, stem and stern posts, a broken oar, and snow along the keel and in the lee.

**Smaller fixes:**
- The float line follows the snow (sampled every 0.3 m), and the floats are half-sunk.
- The shared cave's own icicles are hidden for the Fjord. Against the dark chamber they read as
  pale floating shards.
- The other "pale shards in the mouth" (round-2 A4, still visible at the 07 camera) are not
  dressing. Hiding the terrain and vegetation groups removes them
  (`iter/diag_07_terrain_hidden_shards_gone.png`), so they are terrain or scatter geometry. That is
  shared code: see request G1.

**Cinematic beats** (`seaCaveCinematic.ts`): the shared timing and Yeti choreography are unchanged,
so the grounding contract is intact. The Fjord shots and beats:
- **2.4 s, gulls.** They perch on the portal and lintel tops, white on black basalt, and the
  slough shot is re-framed tight on the brow. Captured as `08c` (`iter/iter4_08c_gulls.png`;
  before: `iter/before_08c_gulls.png`, gulls 2–3 px).
- **7.9–11 s, emergence from inside the sea cave.**
  - The camera is low in the chamber, behind the Yeti, who rises out of the dark mouth over the
    frozen tide pool with the far shore of the fjord beyond (`08`, `iter/iter4_08_emergence_inside.png`).
  - This applies when the mouth faces the sea. If gameplay moves the cave to the sea side (R4), the
    hook switches to a high three-quarter angle instead.
  - At 9.0 s the sea ice cracks under him (ice chips and a crack sound).
- **11.05 s, roar.**
  - A low cloud of sea smoke rolls out over the ledge, with a droplet burst. Round 2's plume had
    filled the lens with white (`iter/before_08d_roar.png`).
  - The lintel icicles actually drop. The real instanced icicle meshes fall under gravity and burst
    on the ground. Captured as `08d`.
- **14.6–16.95 s, leap.**
  - The camera stands on the ledge behind the Yeti, looking down the slope as he leaps onto the
    skier, with the sea and islands beyond (`08b`, `iter/iter4_08b_leap.png`).
  - The swing back into gameplay is re-authored from that camera.
- Compared with Alpine: Alpine `08` is a low frontal shot and Alpine `08b` is over the skier.
  The Fjord shots are from inside the cave and from behind the Yeti.

Evidence tool:
- `08c` is taken at 2.95 s, `08d` at 11.65 s, and `08b` at 15.0 s for the Fjord, all always on.
- New `07b_yeti_cave_outlook`: from inside the mouth, the basalt portal framing the run and the
  fjord.

### 2. Cliff (A2)
- **Vertical smearing.** The coastal gneiss now replaces 97 % of the shared rock (round 2: 82 %).
  The remaining fall-line streak noise had drawn the striation. The master joints are weaker and
  less elongated. This is a coastal-only GLSL path in `snowMaterial.ts`.
- **Snow down to the waterline.** A second bare-rock term covers the gentler foot of the walls
  (≤ 55–80 m above the water, slope > 0.035). The round-2 term only caught slopes > 0.1, which left
  the white apron. Flat harbour ground is still excluded.
- **Crest cones.** These are terrain: the inland valley wall's ridged crest heightfield, the same
  in round 1 and round 2. No scenery mesh is involved. See request G2.

### 3. Islands (A3)
- Island shapes and sizes come from the `coast.ts` heightfield, which is gameplay-owned: request G3.
- **Done on the art side** (`harbour.ts`): the islands off the harbour (seen in the finish, the
  reveal, `10`, `11c`, `11i`) are found by sampling the terrain once and dressed:
  - sparse pine stands on their flanks;
  - a red boathouse at a landing;
  - a small red-and-white light on the lowest outlying skerry.

  Fewer on low/medium.
- **Not done:**
  - The islands on the upper arms (`01`, `02`, `03`) are still the uniform "loaves".
  - The menu still has a couple of slivers (`wip/r3/01_menu.png`).

### 4. Harbour and victory (A1, A8, A9, A11, C2–C6, F5)
- **Quay wall (A1).** The shore wanders in x, and round 2 put a straight wall at a z taken at the
  centre, leaving a sloping, wet-blotched bank. Now, per 4 m bay, the waterline is found in the
  heightfield and the bank is filled with a solid granite quay up to deck level, with:
  - a face of coursed blocks;
  - a proud capping course;
  - a weed band at the tide line;
  - bollards.

  `victory_13.5.png` shows the stone quay meeting the water along the house row.
  A grey sloped snow strip remains behind the wall where the land stands above deck level: see G4.
- **The gag (C2, A11).**
  - It is staged at a new stockfish rack on the quay, by the water. The Yeti is brought down the
    street off camera during shot 1.
  - Shot 2 frames him arriving from up the street, with the boats, the fjord and the islands
    behind (`victory_4.7.png`).
  - In shot 2b he turns from the rack *to the camera*. The cod is lifted to the corner of his mouth
    for the bite, he gags (face to camera, `victory_6.75.png`) and flings it into the harbour,
    where it splashes.
  - The cod is now a flat, split, forked-tail stockfish silhouette. Round 2's cone read as a beak
    over his face in `victory_6.05.png`; the fix is in `b5cc196`.
- **Quay beats framed on the harbour (C4).**
  - Shot 1 tracks from behind and beside the skier, looking down the street to the quay and the
    water (`victory_2.2.png`; before: `round-2/11d`, a snow slope).
  - The presenter now always stands on the seaward side of the skier, so the over-the-shoulder
    shot has the quay and the sea behind him. The reverse angle has the descent behind the skier.
- **Trophy (A9, C6, F5).**
  - New Guest `hold`/`holdLift` pose: both hands together, held off to his right so his face stays
    clear, with a small lift before the toss. The trophy follows the midpoint of the two hand bones,
    plinth in the grip. It no longer floats above him.
  - His hands drop at the toss, and he claps afterwards instead of the armsUp cheer.
  - `victory_8.9.png` shows the grip but predates the seaward and face-clear fix. The final frame is
    `wip/r3/11g_victory_present.png`.
- **Skis and the letterbox (C9).** The reverse angle is pulled back to 5.2–5.6 m and aimed at
  1.3–1.45 m: skis and trophy are both inside the bars (`victory_10.9.png`).
- **Plunge (C3, A8).** The après beat is 1.6 s longer.
  - 0.8 s run-up across the open side of the deck: a forced stride cycle (Guest `run`) and a lean,
    clear of the ladder, tub, stove and sauna.
  - A spring off the edge, then a real tuck pose (Guest `tuck`: knees to the chest, arms hugging
    the shins).
  - A slow forward roll and a hang at the apex (time-warped arc).
  - Into the fjord ~3 m out.
  - The **crown splash** replaces the flat opaque ring:
    - 16 torn spray sheets thrown up and out, with a central jet;
    - a canvas spray texture with soft sides and ragged tips;
    - a feathered, lacy foam patch that spreads and thins;
    - 110 droplets under gravity and a puff of mist.
  - New stills: `11b` at 13.5 s (the sprint), `11j` at 14.4 s (the cannonball at its apex), `11h` at
    15.05 s (the crown) (`victory_13.5/14.4/15.05.png`).
- **Reveal (C5).**
  - New beats: `reveal 17.2 → revealEnd 23.8`, title at 24.0 *after* the camera settles, results at
    26.6, so the title holds 2.6 s.
  - The final pose is further out and higher, looking at `summit.lerp(harbour, 0.3)`. The start
    sits in the upper half with the chute running down to the harbour at the foot.
  - A warm, flickering beacon (a constant-screen-size additive sprite) marks the start from the
    first second of the move (`victory_24.8.png`).
  - `fjord_art.test.ts`: the misnamed test is replaced by three tests:
    - the beats run in order;
    - the title lands at or after `revealEnd` and holds ≥ 1.5 s before results;
    - the plunge splashes inside the low water shot, before the reveal.
- **Water near the camera.** At grazing angles the haze reflection washed the near water to a pale
  sheet. The near-field Fresnel mix is reduced by 30 %.

### 5. Sea mist seams on the water (D new 3)
Each mist bank carries its arm's water level (new instanced attribute `aLvl`) and fades by world
height:
- zero at the surface, where the opaque water cuts the sprite;
- full at 11–16 % of the sprite's size above it;
- with a noise-ragged edge.

Sprites are placed with only their faded lower edge under the water. Banks are lower (half-height
0.2 × size, was 0.32) and those hugging the wall are narrower. No straight seams remain in the 06
camera (`iter/iter1_06_mist.png`, `wip/r3/06_long_distance.png`; before: `round-2/06`
x 380–1400, y 900–960).

### 6. Water (A minor, D minor 4)
- The redundant `discard` is removed from the water shader. `update()` already clips each quad to
  its arm's [z0, z1). Slot and clip logic is untouched.
- The hard-edged pale bands (A7) were the mist seams in item 5.

### 7. Scoured rock (A6), visual only
`hazardViews.ts rockView` (visual only; footprint, radius and logic untouched):
- a darker and larger exposed core with lichen-stained patches;
- only thin glaze, and a narrower gravel ring;
- 6–8 ribs (was 4–6), 3–6.6 m long (was 2.2–5.2), still ≤ 0.4 m proud.

Evidence: `04b` (re-aimed at the hazard view actually streamed) and new `04c` from ~100 m.
**Note for the gameplay dev:** the extra ribs add ~30 % to this view's build cost, which tech
review D flagged as unsliced.

### 8. Start area (F minor)
- The layout is no longer Alpine's symmetric pair of fences: one long rope-and-float line on the
  cliff (sea) side swings out toward the rim, and a line of three trail cairns steps down the
  inland side.
- The whole dressing is static, so it is now merged per material at build time (D5: 124 draws →
  about one per material, ~15).

### 9. Evidence shots (`tools/biome_evidence.mjs`)
| Shot | What it shows |
|---|---|
| `04b` | Re-aimed: the nearest streamed scoured-rock view, from above and behind |
| `04c` | The scoured rock at ~100 m |
| `07b` | Inside the sea cave looking out |
| `08c` / `08d` | The Fjord cave beats (gulls; roar, spray and falling icicles), always on |
| `08b` | The Fjord leap at 15.0 s |
| `09d_pursuit_rim` | The ordinary chase camera where the run passes closest to the rim (sea in the gameplay view) |
| `11f2` | The gag face |
| `11j` | The cannonball |

Victory times follow the new beat sheet. **Note:** R1 (routing near the rim) has not been merged,
so `09d` shows the current route at its nearest point to the rim.

### 10. Presets (D5)
No preset hooks had landed from the gameplay dev, so the builders' `quality` is used.
- **Harbour, below high:**
  - half the boardwalk piles and railing posts;
  - every other moored boat (each boat is a few draws);
  - no coursed blocks on the quay face (fill and capping only);
  - fewer island trees, houses and islands.
- **Start:** merged per material on every preset.
- **Sea cave, below high:** fewer causeway columns, drums and lintel icicles.

Draw-call and triangle counts were **not re-measured** here; D's `budget.test.ts` should be
re-run after the merge.

## Open issues
- The terrain "pale shards" in the cave mouth (G1).
- The crest cones (G2), island archetypes on the upper arms and the menu slivers (G3).
- The remaining snow strip behind the quay wall (G4).
- A12: the menu's near cliff face is still a smooth curtain.
- The inland-wall faceting (R3) and the route near the rim (R1) are still open, from round 2.
- **Unverified:**
  - motion: gull flight, icicle fall, the run cycle and tuck in motion, the crown splash timing;
  - frame rate;
  - full-resolution captures;
  - the cave hook's sea-behind branch (no sea-side cave yet);
  - Expedition and Endless lengths.

## Requests for the gameplay / terrain developer
- **G1 (new).** At the 07 evidence camera, pale terrain or scatter fragments show inside the cave
  mouth.
  - Hiding the terrain and vegetation groups removes them.
  - No terrain vertex lies inside the chamber volume, so they are probably coarse-LOD terrain
    triangles spanning the chamber, from the hillside above the brow to the pit below the floor.
  - Please check the cave cut against the LOD at ~25–30 m. This is likely shared with Alpine.
- **G2 (= R2).** Soften the inland wall's ridged crest: the evenly spaced cones in `06`, `04` and
  `11` are heightfield.
- **G3.** Island archetypes in `coast.ts island()`:
  - cliffed islands, low skerry chains and one or two large islands;
  - fewer, larger groups;
  - drop the sub-150 m slivers seen in the menu.

  The harbour's island dressing adapts to whatever tops exist.
- **G4 (with R5).** Flatten the harbour ground to deck level (`sea + 2.4`) for ~15 m behind the
  waterline along the waterfront. The quay wall then meets a level apron, with no snow bank
  behind it.
- **R1, R3, R4.** Still wanted.
  - With R4 (a sea-side cave), the cave hook switches automatically to the sea-behind framing.
- **Merge notes.** Shared files touched, all with default-off or Fjord-only changes:
  - `src/world/resort/Guest.ts` (`hold`, `holdLift`, `tuck`, `run`);
  - `src/world/snowMaterial.ts` (coastal branch);
  - `src/world/biomes/fjord/views/hazardViews.ts` (`rockView` colours and rib count only);
  - `water.ts` (shading only: discard removed, near Fresnel).

  `Harbour` gains `plungeEdge`, `quayRack`, `quayFront`, `splashNow` and `PLUNGE_TIMES`. The Yeti
  victory stop point moved to the quay rack.
