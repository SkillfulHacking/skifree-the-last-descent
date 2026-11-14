# Fjord Coast art pipeline — round 4 investigation (experiment branch `fjord-art-r4`)

Status: **experiment, not integrated.** Everything here lives in `src/world/art/**`,
`tools/artbake/`, `tools/artscene/` and `/artscene.html`; the game does not import any of it.
Captures: `docs/reviews/biomes/fjord/round-4/artscene/` (see §7).

## 1. Why the Fjord art plateaued at 6–7/10

The final-round reviews (A art 6.5, C cinematic 7.5, F critic 7) keep naming the same things:
needle crests, vertically smeared cliff rock, repeated loaf islands, near-vertical heightfield
terrain, placeholder scoured rock, artificial cave geometry, crushed-black sea cave. Most of these
are **methodology limits**, not tuning:

| Symptom | Root cause |
|---|---|
| Vertical smearing / striation on the walls (`06`, `11c`) | A 300–1300 m wall that drops in 100–500 m of plan is stored in a heightfield: a handful of 1–32 m grid cells span hundreds of metres of drop, so the shading and every texture lookup are stretched down the fall line. The "couloir" noise in `Coast.seaSide` adds more fall-line grooves. |
| Needle crests | Ridged noise on a coarse heightfield: single vertices poke up between under-sampled neighbours (no erosion, no rounding). |
| Loaf islands | One analytic dome per island, sampled by 32–64 m far tiles; a dome is all that survives that resolution. |
| Placeholder rock / cave columns | Flat-shaded primitive kits with vertex colours and procedural shader noise; no real micro-detail, no normal maps. |
| Black sea cave | Basalt albedo 0.016–0.02 × light multipliers (indirect ×0.32, direct ×0.5) in a back-lit orientation: 0–2/255. |

Per-pixel shader noise cannot fix a geometry problem, and more tuning of `Coast.seaSide` will not
remove the heightfield's one-height-per-(x, z) limit.

## 2. Options investigated

### 2.1 Authored / sculpted geological meshes
- **Cliff geometry independent of the heightfield** (adopted, `cliffKit.ts`): the wall is its own
  mesh laid out *along* the face (columns along the coast, rows down the face by arc length), so a
  vertical metre gets as many vertices as a horizontal one. The profile is authored (tiers of
  near-vertical bands and snow benches whose edges dip along the coast, a wave-cut sea cliff, a
  rounded lip, buttresses, gullies) and sculpted with terraced 3D noise and horizontally stretched
  ledges. The heightfield keeps the gameplay land and draws only a hidden *backing* on the sea
  side (the face pushed 9 m inland and 4 m down), plus talus cones and the fjord bed.
- **Hand-sculpted hero meshes** (Blender/ZBrush → glTF + Draco/Meshopt): best possible result for
  a few signature spots (the summit vista headland, the cave portal, the harbour headland), but
  they need an artist, and a procedural course of any length cannot be covered by hero pieces
  alone. Recommended later for 2–3 set pieces; not needed for the kit to work.
- **Scanned rock meshes** (Poly Haven models, CC0): would be ideal as instanced boulders/talus and
  as kit pieces; not downloadable from this sandbox (see §3).

### 2.2 PBR rock/cliff/coastal materials
- **CC0 photo-scanned sets** (Poly Haven, ambientCG) are clearly the best quality per byte. They
  are blocked from this sandbox (§3); the exact files to fetch are listed in §3.2. The material
  (`rockMaterial.ts`) takes them unchanged: albedo (sRGB) + an NHR texture (normal XY, height,
  roughness), with AO in the albedo alpha — a 2-texture set.
- **Offline-baked procedural PBR** (adopted for now, `tools/artbake/bake.mjs`): original code bakes
  tileable 1024² sets (gneiss: jointed blocks, folded felsic lenses, rust seeps, crustose lichen,
  speckle; basalt: column joints, cross joints, vesicles, rime) with height → normal and cavity AO.
  Quality is below a photo scan but far above per-pixel shader noise, and costs nothing per frame.
  No third-party art, so no licence question.

### 2.3 Triplanar + height/normal-blended terrain materials
Adopted for every authored rock surface: world-space triplanar at two scales (detail tile and a
rotated macro tile ×6–7, blended by distance) so neither UV stretch nor tiling shows; UDN normal
blending; macro strata bands that dip gently (layering reads at a kilometre); snow only on
surfaces flatter than ~55°, height-blended into the cavities; a wet dark band and thin ice foot at
the waterline; the game's aerial perspective (`look/atmosphere.ts`). Cost: 6 texture fetches per
scale (12 at high, 6 at low quality).

### 2.4 Procedural variation combined with authored assets
The kit is parametric: the same generator would accept scanned textures (drop-in, §3.2) and could
place instanced scanned boulders on the talus. Variation comes from the coast frame (rim height,
water level, z) and seeded noise; nothing is random at runtime.

### 2.5 Natural islands and shorelines
Adopted (`islands.ts`): archipelago layout per 1.1 km cell along a regional ice-flow grain (a
feature island + satellites strung along the grain), four archetypes — polished **skerries**,
**whalebacks** (roche moutonnée: long stoss slope, plucked lee cliff), **cliff-girt** plateau
islands with a gravel cove, low **wooded** islets — with domain-warped (periodic) coastlines,
dense rings at the shore and cliffs, blocky relief on steep parts, instanced pines on gentle dry
ground. Erosion simulation (hydraulic/thermal) was considered: worthwhile only offline on a
heightmap; for meshes at this scale terraced/plucked profiles give the read for a fraction of the
cost.

### 2.6 Texture budgets and loading on GitHub Pages
| Item | Download | GPU (with mips) |
|---|---|---|
| gneiss set (albedo+AO, NHR), 1024² WebP | 0.79 MB | 2 × 5.6 MB = 11.2 MB (RGBA8) |
| basalt set, 1024² WebP | 0.69 MB | 11.2 MB |
| same sets as KTX2/UASTC (via `ktx2-encoder`, MIT, npm) | ≈ 1.5–2 MB | 2 × 1.4 MB per set = 2.8 MB (BC7/ASTC) |
| same as KTX2/ETC1S | ≈ 0.4–0.6 MB | 0.7–1.4 MB per set |
| a 2K Poly Haven set (diffuse+nor_gl+rough+AO → 2 textures) | ≈ 6–9 MB JPG / 2–3 MB KTX2 | 45 MB RGBA8 / 11 MB BC7 |

Recommendation: 1024² for the kit (the macro layer hides tiling), KTX2 with UASTC for the NHR
texture (normals survive) and ETC1S for albedo; three's `KTX2Loader` + the basis transcoder that
ships in `three/examples/jsm/libs/basis/` (MIT). GitHub Pages serves static files with gzip and
caching; textures are referenced with `new URL(…, import.meta.url)`, so Vite only emits them when
the Fjord art module is imported, and `rockMaterial.ts` loads them lazily on first use (a 1×1
placeholder until then; macro terms carry the look, so there is no pop). They should be requested
while the Fjord loading screen runs, never on the menu of another location.

## 3. Assets, licences and the network constraint

### 3.1 What this sandbox can reach (checked 2026-11-11)
- Reachable: `registry.npmjs.org` (npm install works), `pypi.org`, `raw.githubusercontent.com`,
  `api.github.com` (but repository contents are refused for repositories not attached to the
  session).
- Refused by the egress proxy: `polyhaven.com` downloads (`dl.polyhaven.org`, `api.polyhaven.com`),
  `ambientcg.com`, `cdn.jsdelivr.net`, `unpkg.com`, `huggingface.co`, `opengameart.org`,
  `kenney.nl`, `threejs.org`. We did not try to route around any of these.
- npm search for CC0 rock/cliff PBR packages: nothing usable with verifiable provenance. Packages
  that bundle "Poly Haven" content either fetch at runtime from blocked hosts or redistribute
  without stating per-file provenance; `@pmndrs/assets` was assessed in pass 2 (no rock sets).
- GitHub mirrors: `BabylonJS/Assets` is reachable via raw.githubusercontent.com but is CC BY 4.0
  with per-file provenance unclear ("unless specified otherwise in the asset folder"), and its rock
  textures are generic; not used. No GitHub repository was found that independently redistributes
  Poly Haven/ambientCG rock sets with clear per-file provenance.
- **Decision:** ship original, offline-baked textures (§2.2); list the scanned sets for the user to
  download (below).

### 3.2 Recommended downloads (for the user; not downloaded here)
All CC0 (Poly Haven licence page: "Licensed as CC0 … You do not need to give credit … in a product
you sell"; checked 2026-11-11). Download the **2K** zip, maps *Diffuse*, *Normal (GL)*, *Rough*,
*AO*, *Displacement*; convert with `tools/artbake` (pack to albedo+AO / NHR, resize to 1024²,
encode KTX2) and record each file in `docs/ASSETS_AND_LICENSES.md`.

| Use | Asset page | Authors (from the page) | Licence |
|---|---|---|---|
| Fjord wall / cliff kit (primary) | https://polyhaven.com/a/cliff_side | Dario Barresi, James Ray Cock (photography); Jenelle van Heerden (processing) | CC0 |
| Fjord wall / weathered blocks (alt.) | https://polyhaven.com/a/rock_face_03 | Dario Barresi (photography); Rico Cilliers (processing) | CC0 |
| Shore / skerries (wave-worn rock, sand) | https://polyhaven.com/a/coast_sand_rocks_02 | *verify on the page (could not be fetched here)* | CC0 (Poly Haven) |
| Island tops, talus | https://polyhaven.com/a/aerial_rocks_02 | *verify on the page* | CC0 (Poly Haven) |
| Basalt (sea cave) | ambientCG "Rock" sets with dark basalt (search ambientcg.com "basalt") | ambientCG (Lennart Demes) | CC0 per https://docs.ambientcg.com/license (page could not be fetched in this session — verify) |

## 4. What was built (all deterministic, bounded)
- `src/world/art/rockMaterial.ts` — triplanar baked-PBR rock/snow material, lazy ref-counted textures.
- `src/world/art/cliffKit.ts` — `CliffModel` (pure cliff profile per z, backing height) and
  `CliffKit` (256 m segments, 3 LODs: 4/8/16 m columns; at most `maxSegments` alive; LRU by window).
- `src/world/art/islands.ts` — archipelago layout + four archetype meshes + tree placement.
- `src/world/art/basaltPortal.ts` — the sea-cave dressing: triplanar basalt on the shared cave rock
  (no light multipliers) and packed hexagonal column bodies (one draw call), respecting the
  exit-path and cinematic sight-line clearances of the round-3 dressing.
- `src/world/art/artCoast.ts` — `ArtCoastMountain` (land identical, sea side = hidden backing +
  bed) and `IslandSet`.
- `tests/unit/art_r4.test.ts` — land-side heights identical to round 3 (gameplay unchanged),
  segment determinism independent of query order, backing stays behind the face, deterministic
  island layout, size bounds.

## 5. Measured costs (test scene, high quality)
See §7 for the per-shot numbers recorded in the capture manifest.

| Piece | Geometry | Draw calls | CPU build |
|---|---|---|---|
| Cliff segment (256 m, H ≈ 470 m) LOD0 / 1 / 2 | 12.0k / 3.1k / 0.8k verts (23.6k / 5.9k / 1.5k tris) | 1 each | 184 / 15 / 6 ms (Node, 2 vCPU) |
| 28 islands (Sprint fjord, 3.4 km × 2.7 km) | 67k verts, 131k tris, 885 pines | 28 + 1 (mergeable to 1–2) | 311 ms |
| Basalt portal | see manifest | 1 | < 50 ms |
| `heightAt` on the sea side | — | — | 1.7× the round-3 cost (cached cliff columns) |

## 6. Integration plan (if the reviewer prefers the proposed look)
1. **Coast flag** `terrain.coast.cliffKit: true` (Fjord only). `Coast.seaSide` branches to the
   backing profile (`CliffModel.backingHeight`) and drops `island()` from the heightfield; land-side
   heights are untouched (the unit test above guards that), so physics, placement and every
   golden-terrain test for the land stay valid. Re-baseline only the sea-side golden values.
2. **Streaming**: `CliffKit.sync(z0, z1, camX, camZ, budget)` from `FjordScenery.stream/pump`
   (time-sliced like the scenery chunks: one segment per slice, LOD0 within 500 m). Islands per
   scenery chunk (merge per chunk into one geometry → 1 draw call per chunk).
3. **Cave**: register `buildBasaltPortal` as the Fjord `dressSteps` (replacing `dressSeaCave`'s
   columns/material; keep its props after re-checking them against the new lighting).
4. **Textures**: KTX2 (UASTC NHR, ETC1S albedo), preloaded on the Fjord loading screen; low
   quality uses one triplanar scale and 512² mips.
5. **Water/shore**: the water shader should add a foam line where the island/cliff meshes meet the
   water (depth from the backing/bed), as the terrain shader already does for heightfield shores.
6. Scoured-rock hazard and the menu cliff can reuse the rock material + kit (out of scope here).

Estimated cost in the game (Sprint, high): +1.5 MB download (WebP) or ~1 MB (KTX2); +22 MB GPU
(RGBA8) or ~6 MB (KTX2); +6–12 draw calls (cliff segments in view) +2–6 (islands merged per chunk)
+1 (cave portal); +60–110k triangles in view; CPU ~0.2 s per LOD0 segment, sliced over frames.

## 7. Test scene and captures
`/artscene.html?mode=current|proposed&shot=long|cliff|cave|cave_near|islands|island` (dev server:
`npx vite --config tools/artscene/vite.config.mts --port 4480`; capture: `node
tools/artscene/capture.mjs`). Both modes: Fjord Coast Classic Sprint (the final-round evidence
course), the game's `Environment` (sun, sky IBL, hemisphere, fog, aerial perspective), the game's
`TerrainRenderer` for the land and the game's `FjordWater`; identical cameras (`long` and `islands`
are the final-round `06_long_distance` and `03_mid_mountain` framings; `cave` is the `07_yeti_cave`
framing). No hamlets, ships, mist, vegetation or obstacles in either mode.

Captures (1920×1080), `docs/reviews/biomes/fjord/round-4/artscene/`:
`{long,cliff,cave,cave_near,islands,island}_{current,proposed}.png`, `manifest.json` (render
counts per shot; the one 404 logged on the first page is the missing favicon).

## 8. Critical look at the captures (self-assessment; the independent reviewer decides)

**Clearly better**
- *Sea cave* (`cave`, `cave_near`): the regression is gone. Round-3 dressing in this scene: shell
  median luminance 0/255 (89 % of pixels < 10), columns 1/255. Proposed, without any fill: shell
  16/255 median; with the snow-bounce fill 1.3 (the committed `cave*_proposed.png`, identical to
  `*_fill1.3.png`): shell 62/255, columns 71/255, 0–4 % of pixels < 10. That overshoots: the basalt
  reads mid-grey. The code now uses fill 0.55, which should land at about 35–45/255. **Not
  re-captured**: the release Playwright suite kept the browser busy. Re-run
  `node tools/artscene/capture.mjs <dir> 1920x1080 cave,cave_near proposed` before review. The
  proposed cave also has real surface detail, the chamber stays dark (baked visibility), and the
  packed columns read as columnar basalt framing the mouth rather than a crowd of bollards.
- *Vertical smearing*: gone on the sea cliffs. Strata benches carry horizontal snow bands that
  read at a kilometre (`long`), spurs and gullies break the wall, no slits or fall-line striation.
- *Loaf islands*: replaced by distinct archetypes (cliff-girt plateau, whaleback, wooded islet with
  pines, skerry chains along a grain).

**Still not 9/10 (honest)**
- The cliff face is too smooth and uniform in colour at mid-distance (reads a little like cast
  concrete): the procedural gneiss bake is the weak link. This is exactly where a photo-scanned
  CC0 set (§3.2) would make the largest difference; the material takes it unchanged.
- The inland skyline *needles* above the rim are the land heightfield (ridged noise beyond the
  piste), not the coast: untouched here (gameplay land). Fix separately (crest softening off-piste).
- Islands: the cliff-girt archetype is still a little "cake-like" from far; low skerries are
  mostly snow. Distant domes on the horizon in both modes are beyond the replaced area
  (far-shore/ocean islands) — the proposed build would replace them too.
- Columns are uniform in girth and perfectly upright; vary girth (5–7 sides), lean and break more.
- No surf/foam line where meshes meet the water yet (§6.5).

