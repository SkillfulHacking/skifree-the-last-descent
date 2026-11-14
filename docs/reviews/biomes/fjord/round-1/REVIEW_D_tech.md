# Fjord Coast: Round 1 review. Reviewer D, Technical & Performance Engineer

- **Reviewer:** D, Technical & Performance Engineer. **Model-based reviewer** from the same model family as the developers. Not an external human, and not independent in the external sense.
- **Build:** `f8519ca` (branch `pass4-fjord`). The worktree HEAD is `78cb83f`. `git diff --stat f8519ca HEAD -- src tests` is empty, so the source I inspected and tested is exactly `f8519ca`.
- **Date:** 2026-11-10
- **Method:** static reading of the Fjord code (`src/world/coast.ts`, `src/world/biomes/fjord/**`, `src/world/presentation/*`, `src/world/hazards/*`) and the engine paths it touches (`World`, `App`, `GameSession`, `TerrainRenderer`, `snowMaterial`, `look/ranges`). I also ran headless Node/Vitest measurements, kept under `scratch/review-d/`. That folder has `budget`, `endless`, `heap`, `hitch`, `chunk`, `gust`, `slots`, `initial` and `far` tests, plus a DOM-canvas stub so the three.js view builders run in Node.
- **What was not measurable here:** no GPU and no browser (the brief prohibits them). **Nothing in this report is a frame rate, GPU time or shader compile time.** Every timing below is main-thread JavaScript measured in Node on a 2-CPU machine that another job was also using. Read those timings as relative magnitudes, not as browser figures.

## 2. Verdict

**FAIL** against the 9/10 target for Performance and stability.

The core architecture is sound, and I measured it rather than assuming it:
- Everything Fjord adds is streamed and bounded on any length.
- Over 120 km of Endless, every scenery chunk and hazard view that was created was disposed.
- JS heap stays flat over 200 km.
- Strict `tsc` is clean and all 241 unit tests pass.

Four clearly fixable problems still keep this below a release bar:
1. Scenery chunks (hamlets, cairns, viewpoints) are built **synchronously on the main thread during play**. Measured: about 23 ms median and up to 120–300 ms per chunk in Node, roughly every 512 m. The rest of the engine time-slices this kind of work.
2. Each coastal shelter adds a **`PointLight` that streams in and out**. In three.js 0.187 a change in light count forces every lit material to switch programs. The first time it happens, all of them recompile mid-run (first refuge, about 4.8 km into Endless).
3. On Expedition and Endless, the water renderer has 4 slots, so **fjord arms beyond the four nearest get no water surface**. Measured: water is missing within the 12 km far plane at 81% / 99% of course positions. The nearest undrawn arm can be only 4.3–5.1 km ahead.
4. The primary long-distance evidence shot shows a **hard-edged peach rectangle above the horizon**. The developers' own `scratch/diag` captures trace it to `DistantRanges` with the Fjord `openSector` setting.

The evidence is Sprint-only, which has a single fjord arm, so it cannot show problem 3.

## 3. Scores (from a technical/performance point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | 7 (low confidence) | From the shots I opened (02, 04, 06, 11c) the look is coherent and strongly coastal. The rendering artefact in `06_long_distance.png` is a technical blemish in a primary evidence shot. Art judgement belongs to Reviewer A. |
| Environmental uniqueness | 8 (low confidence) | The coast is a real terrain capability (cliffs, chained fjord arms, islands, harbour) with its own shaders, not Alpine relit. |
| Skiing and hazard mechanics | 7.5 (low confidence) | Fjord uses the shared fixed 120 Hz physics. The cornice friction is applied with a clamp (`min(speed, decel*dt)`), so it is numerically stable. Hazards act through the pure, tested environment layer. Game feel belongs to Reviewer B. |
| Difficulty and fairness | 7.5 (low confidence) | The headless chase-balance and placement tests pass. Hazard views only appear about 400–650 m ahead (see defect 9). Fairness belongs to Reviewers B and E. |
| Cinematics | 7.5 (low confidence) | Technically safe: the victory script creates no new meshes or materials mid-cinematic, and the harbour exists from load. Direction belongs to Reviewer C. |
| **Performance and stability** | **6.5** | Lifecycle and memory are bounded and verified. Main-thread build hitches, a mid-run shader recompile from a streamed light, missing water on long courses, and fill-rate waste from the water drawn first all count against it. No frame-rate evidence exists for any preset. |
| Accessibility and controls | 7.5 (low confidence) | Same input stack and fixed-timestep physics as Alpine. Nothing Fjord-specific regresses controls in code. Not otherwise assessed. |
| Overall player experience | 7 (low confidence) | Likely an attractive and stable Sprint. Long courses carry the unverified water gap and periodic hitches. |

## 4. Defects

### 1. Major: scenery chunks are built synchronously on the main thread during gameplay

**Evidence:**
- `World.stream` calls `scenery.stream(z)` every 64 m (`src/game/World.ts:172`).
- `FjordScenery.stream` builds every missing chunk in its window in one call (`src/world/biomes/fjord/views/scenery.ts:64`, `buildChunk` at :79). That includes the hamlet marching loops (up to 400 `heightAt` steps), house kits, `mergeGeometries` and normal computation.
- Measured (`scratch/review-d/chunk.test.ts`, warm JIT, Node), chunks with a hamlet: n=30, p50 **22.8 ms**, max **120 ms**.
- Measured, chunks without a hamlet: p50 8.5 ms, max 81 ms.
- Over 60 km of Endless (`hitch.test.ts`): `scenery.stream` p95 **42.6 ms**, max **302 ms**, 118 builds, about one per 512 m.
- The engine already time-slices comparable work: terrain is built row by row, and caves use `Cave.buildSteps` one slice per frame. The Fjord scenery does not.

**Fix:**
- Turn `buildChunk` into a generator, the same pattern as `Cave.buildSteps`. Run one slice per frame within a ms budget (cairns → viewpoint → each hamlet house → merge).
- Or queue chunk builds and run one per frame, starting with the furthest-ahead missing chunk. AHEAD = 8 chunks (4 km) gives plenty of lead time.
- Separately, cache the strand-flat x per hamlet instead of marching `heightAt`.

### 2. Major: the coastal shelter adds a streamed `PointLight`, which forces a recompile of all lit materials mid-run

**Evidence:**
- `src/world/biomes/fjord/views/shelter.ts:90` creates `new THREE.PointLight(...)` per shelter.
- `World.syncLodges` creates shelters within z−400..z+1600 and disposes them after.
- In three 0.187 the light count is part of each program's key (`WebGLPrograms.js:351` `numPointLights`). A change in `lights.state.version` sends every lit material through `getProgram` again (`WebGLRenderer.js:2456`).
- The load-time `renderer.compile` (`App.ts:219`) only sees the light count that exists at load. The first time a new count appears, every lit program in view is compiled synchronously: terrain, trees, rocks, Yeti fur, skier, kit materials and others.
- Measured (`endless.test.ts`): shelter count goes 0→1 at **4.8 km** on Endless, then alternates 0/1 every 6 km. On a finite course with refuges, the harbour's 2 lights plus the Yeti rim light are already present, so a shelter adds a 4th light.
- Alpine refuges add no light, so this is a Fjord regression. The engine already avoids the problem for the Yeti rim light: `App.ts:199` notes "always in the scene: no recompiles".
- Compile time cannot be measured without a GPU.

**Fix:**
- Make one persistent "refuge lantern" `PointLight`, owned by World or the scenery and present at warmup. Move it to the nearest shelter and set its intensity to 0 when there is none.
- Or drop the light and rely on the emissive lamp material plus a glow sprite.

### 3. Major: fjord arms beyond the 4 nearest have no water on Expedition and Endless

**Evidence:**
- `FjordWater.update` collects the reaches in [camZ−4500, camZ+14000] and sorts them by distance (`water.ts:133-134`). It draws only `SEA_SLOTS = 4` (`snowMaterial.ts:87`), and the slots include up to 4.5 km *behind* the camera.
- The terrain shore band uses the same 4 slots.
- Measured (`slots.test.ts`):

  | Course | Reaches in window (max) | Positions with water missing within the 12 km far plane | Nearest undrawn arm ahead | Mean water coverage ahead |
  |---|---:|---:|---:|---:|
  | Standard | 4 | 0% | n/a | full |
  | Expedition | 8 | **81%** | **4.3 km** | 7.6 km |
  | Endless | 7 | **99%** | **5.1 km** | 7.8 km |

- In an undrawn arm the fjord bed (180 m below the level) is rendered as plain terrain, with no water and no shore band.
- Using the shared aerial model with the Fjord fog values (lin 1/46000, exp 0.000145), about 48% of surface contrast survives at 5 km. So a dry, snowy bed in place of dark water is likely visible. I could not confirm this visually: every evidence shot is `classic:sprint`, which has a single reach.

**Fix:**
- Prefer reaches ahead of the camera (or in the view frustum) when filling slots.
- Or raise `SEA_SLOTS` to 8. The water quads discard cheaply and the terrain loop is 8 compares.
- Add a capture at Expedition z ≈ 20 km looking down the fjord to the round-2 evidence.

### 4. Major: hard-edged rectangular artefact in the long-distance shot (DistantRanges / Fjord open sector)

**Evidence:**
- In `06_long_distance.png` there is a flat-topped peach block above the horizon, right of the cliff (about x 1170–1405, y 420–548).
- The developers' own post-build diagnosis in `scratch/diag/` shows the cause: the block is in `base.png` and gone in `hide_5_DistantRanges.png`.
- Fjord is the only biome that sets `ranges.openSector` (`biome.ts:110`). That sector lowers range layers (`look/ranges.ts:69-72`), which most likely exposes a ring layer or the haze band behind it.

**Fix:**
- Root-cause it with the existing `rk_*` method, one ring layer or the haze band at a time.
- Make sure the haze band is either lowered with the open sector or faded by the same mask.
- Recapture 06.

### 5. Major (static analysis, GPU cost not measured): water is drawn first, as full-screen quads that use `discard`

**Evidence:**
- `water.ts:120` sets `renderOrder = -1`, so all 4 water quads (32×32 km, `frustumCulled = false`) are drawn before the opaque terrain.
- Every pixel below the horizon therefore runs the full water fragment shader: 3 × `sf_wave` = 12 value-noise lookups, Fresnel, glitter and atmosphere. This happens even where terrain later covers the pixel, which in normal play (looking down the piste) is most of the screen.
- The three other slots still run the shader prefix up to `discard`, and using `discard` defeats early-Z for those draws.
- The terrain is 300–1300 m above the water, so almost all of that water shading is overdrawn.

**Fix:**
- Draw water after the opaque terrain (default or positive `renderOrder`) so the depth test rejects hidden water fragments.
- Clip each reach quad geometrically to [z0, z1) on the CPU (z-extents are known) instead of `discard`.
- Then profile on a real low-end GPU with `renderer.info` and a GPU timer query before claiming any frame time.

### 6. Minor: the sea-gust view does 120 terrain evaluations per frame per non-dormant gust, including gusts behind the camera

**Evidence:**
- `hazardViews.ts:103-108` calls `m.heightAt` for all 120 streamer particles every frame.
- `HazardLayer.update` updates every live view, and bands are kept until z−900.
- Measured (`gust.test.ts`): **0.67 ms** per non-dormant gust update in Node.
- Measured over 60 km: mean live gusts 2.3, mean non-dormant 1.2, max 5. That is about 0.8 ms per frame on average and about 3.3 ms worst case of main-thread time for decoration.
- Fjord `heightAt` itself costs 1.2–2.3× Alpine on the wide x band (`budget.test.ts`, for example 35 vs 18.5 µs at z ≈ 1 km on Standard).

**Fix:**
- Cache ground heights on a small x grid per gust at creation (the streamers run along a fixed z row).
- Or animate the streamers in the vertex shader.
- Skip updates for views more than about 150 m behind the camera.

### 7. Minor: Fjord scenery does not scale with the graphics preset

**Evidence:**
- `budget.test.ts`: scenery draws 46–60 calls and 42–58 k triangles at both `low` and `high`.
- Only the shadow casting (`cast: this.hi`), the mist strength and the water `uDetail` change with the preset.
- The harbour does scale (133 k triangles at low vs 166 k at high).

**Fix:** on `low`, use fewer chunks ahead (for example 5), skip house details (chimneys, window frames) beyond 1 km, and use fewer mist banks.

### 8. Minor: hazard view materials are never compiled at load on Sprint and on some daily seeds

**Evidence:**
- `initial.test.ts`: on all three Sprint variants and on `daily/expedition`, no `sea-gust` instance is in the load-time hazard window. The first one appears at z ≈ 1.1–1.6 km.
- Its materials could therefore compile at first sight mid-run: the vertex-coloured double-sided sock, and the `PointsMaterial` with a map for the spindrift.
- I did not verify whether these program permutations already exist elsewhere in the scene.

**Fix:** add one hidden instance of each registered hazard view (or its materials on a dummy mesh) to the scene during `buildWorld` warmup.

### 9. Minor: hazard views pop in only 400–656 m ahead

**Evidence:**
- `environment.ts:108` ensures hazard bands to z+400. Bands are 256 m, so views appear 400–656 m ahead.
- Obstacles and vegetation are streamed to `farDist` (1.3–3.2 km by preset).
- A 7 m orange windsock and a dark rock patch therefore appear in plain view on long sightlines.

**Fix:** stream the hazard *views* over the visual window, separate from the physics window. View creation is already decoupled through `onBand`.

### 10. Minor: absolute-coordinate geometry loses float32 precision on very long Endless runs

**Evidence:**
- Chunk kits, cairns and the hazard patches are merged in absolute world coordinates. The `Batch` uses `mat(x, y, z)`.
- With `World.renderShifted` the model-view translation then carries −(absolute camera position), so the floating origin does not help these meshes.
- Float32 view-space error (Node `Math.fround` simulation): **0.4 mm at 10 km, 3.8 mm at 50 km, 15 mm at 150 km, 30 mm at 300 km**. At 150 km that is roughly 2–3 px of shimmer on objects about 5 m from the camera at 1080p.
- The terrain is unaffected because its chunks store relative vertices. This is an engine-wide convention that Fjord inherits, not a Fjord-only bug.

**Fix:** build chunk and hazard geometry relative to a per-chunk origin (`mesh.position` = chunk origin), the same way `TerrainRenderer` does.

### 11. Minor: module-level singletons are never disposed

**Evidence:**
- `endless.test.ts` teardown leaves 4 materials and 2 textures undisposed after `World`-equivalent dispose.
- The materials are the hazard `shared` set (`hazardViews.ts:17`: pole, sock, rock, stone).
- The textures are `signTexture()` (512×160) and the soft-particle texture (64×64).
- This is bounded and does not grow, but GPU objects survive world rebuilds until the page reloads.

**Fix:** reference-count them, or dispose them from the presentation module when the last world using `fjord` is disposed.

### 12. Minor: the sea-cave net leaks and keeps animating when it is not placed

**Evidence:**
- `seaCave.ts:102-106`: when `clearOfPath` fails, `netMesh` is never added to the group.
- Its geometry is therefore never disposed (the dispose traverses the group).
- `update()` still rewrites its 165 vertices every frame.

**Fix:** create the net only when it is placed, or dispose `netG` explicitly and skip the update.

## 5. What works

Every figure below comes from the measurements described in the Method line.

**Memory and streaming are bounded and verified:**
- 120 km of Endless with scenery, hazard views and shelters: peak 12 chunks, 18 live hazard views, 110 draw calls, about 69 k triangles for Fjord additions.
- Hazard views: 754 created and 745 disposed while running, with all remaining ones disposed on teardown.
- Every tracked geometry (2,979) was disposed; the only exceptions are the bounded singletons in defect 11.
- JS heap is flat over 200 km for both Fjord and Alpine (about 28–31 MB, noise only).
- Coast bookkeeping grows trivially: 64 crests, 122 hamlets and 145 lookouts at 200 km.

**The pure/presentation split is clean:**
- Coast, hazards, surface and weather contain no three.js.
- The views follow `HazardField.onBand`, so view lifetime equals band lifetime.
- Endless coast generation is deterministic and order-independent.

**Physics:**
- Fixed `PHYS_DT` = 1/120 with an accumulator.
- Frame dt is clamped to 0.1 and there is a 12-step spiral guard.
- Hazards run on the physics clock.
- Cornice friction uses a clamped decrement, so it is stable at 6× friction.

**Shaders:**
- Coast terrain is a compile-time variant keyed by biome id (`skifree-snow-v6:fjord`).
- Quality settings are applied through uniforms, not new permutations.
- The 4 water materials share one program.
- The mist is one instanced draw call.

**Finish:**
- The harbour is cheaper than the Alpine resort: 166 k vs 241 k triangles, about 1.6 s vs 5.5 s Node build time at load, and 2 lights vs 3.
- It only animates within 900 m of the camera.

**Production build:**
- `npx tsc --noEmit` exit 0 under strict settings, and `vitest run` gives 241 of 241 passing.
- The `dist/` bundle (1.27 MB, 381 KB gzip) is fully procedural, with no runtime asset fetches.

## 6. Brief compliance (Fjord bullets relevant to Reviewer D)

| Requirement | Status | Evidence |
|---|---|---|
| Sea-level terrain and coastline integrate at all supported course lengths (Fjord section) | **Partial** | The heightfield is continuous and water edges are hidden at every length (`tests/unit/fjord.test.ts` passes). Water *rendering* is missing for arms beyond the 4 nearest on Expedition and Endless (defect 3). The evidence is Sprint-only. |
| Do not build enormous fully resident scenes; use the streamed architecture (§5) | **Done** | Scenery, hazards and shelters are streamed and bounded (measured, §5 above). |
| Support all modes including Endless (§5) | **Partial** | Generation and disposal hold over 120–200 km. Runtime hitches remain (defects 1 and 2). |
| Hazard resource lifecycles (§8 D) | **Done** | `endless.test.ts`: views created equals views disposed. Minor singletons only (defect 11). |
| Shader management (§8 D) | **Partial** | Cache keys are sound. Streamed light recompile (defect 2). Possible first-sight compiles of hazard views (defect 8). |
| Draw calls / GPU memory (§8 D) | **Partial** | Counts are moderate and bounded. Water overdraw (defect 5) and no preset scaling (defect 7). GPU memory itself was not measurable here. |
| Physics timestep stability (§8 D) | **Done** | Fixed 120 Hz with an accumulator and guards. Fjord modifiers are clamped and continuous. |
| Production build compatibility (§8 D, §10) | **Done** | Strict `tsc` is clean and the unit suite passes. I did not run `vite build` or Playwright (prohibited). `dist/` dated with `f8519ca`. |
| Endless generation and resource disposal tests (§10) | **Partial** | The existing test covers the *pure* `HazardField` only. Nothing in `tests/` covers disposal of three.js views, scenery chunks or shelters. `scratch/review-d/endless.test.ts` shows how to add that coverage. |
| Never claim a frame rate without measurements (§8 D) | **Done** | No frame-rate claims are made in the docs I read, and this review claims none. |

## Reproducing

From `/home/claude/sf-fjord`:

```
NODE_OPTIONS=--expose-gc npx vitest run --config scratch/vitest.config.ts scratch/review-d/<file>.test.ts --silent=false
```

`endless.test.ts` reads `KM` (default 120).
