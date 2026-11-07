# Review D — Technical & Performance Engineering

> **Internal multi-agent review — separate agent instance of the same model family; not an external/independent human approval.**

## What was inspected
`src/game/{App,GameSession,World}.ts`, `src/world/{TerrainRenderer,Vegetation,Environment,Resort,Cave,course}.ts`, `src/physics/{SkierPhysics,obstacles}.ts`, `src/yeti/YetiModel.ts` + `model/{materials,buildGeometry}.ts`, `src/fx/{Particles,SkiTracks}.ts`, `src/audio/{AudioEngine,graph}.ts`, `src/cinematic/*`, `src/ui/Hud.ts`, `vite.config.ts`, `tsconfig.json`, `tests/**`, and three.js `WebGLRenderer.compile` (node_modules).

## Evidence observed
- `npx tsc --noEmit`: exit 0 (strict; `noUncheckedIndexedAccess` off, ~180 `!` assertions).
- `npx vitest run`: 4 files, 74 tests pass (4.8 s).
- `npx vite build --outDir /tmp/review-dist`: OK. JS ≈ 1.03 MB raw / ≈ 300 KB gzip (three ≈ 150 KB gz). Build also emits `preview/*.html`, `preview_*.js` and `OrbitControls` (`vite.config.ts:5-17`).
- No FPS/GPU timing measured (no GPU). Draw-call and triangle figures come from the brief's debug-harness numbers plus reading the code.

## Critical defects (blocking)
1. **No measured evidence for the 60 FPS @1080p High target.** The scene has about 2.5M triangles before culling, around 300–450 main-pass draws (256 terrain chunks + a far mesh, all resident (`TerrainRenderer.ts:57-62`); per-cell instanced vegetation; resort visible from the start because the camera far plane is 12 km and fog leaves it at ~30% visibility at 3 km), plus a shadow pass. This is plausible on a mid-range desktop GPU, but nobody has shown it. At a 9/10 gate, a performance target with no measurement blocks the pass.
2. **GPU memory leak when the quality preset changes.** `Environment.dispose()` (`Environment.ts:146-154`) never calls `sun.shadow.dispose()`. Each rebuild through `App.buildWorld` (`App.ts:148-151`) orphans a 2048² shadow render target, or 4096² on Ultra.

## Major weaknesses
3. **Terrain LOD has no hysteresis, though the comment says it does** (`TerrainRenderer.ts:103-111`). `desiredStep` is a hard threshold, so a skier carving back and forth across a ring boundary forces full chunk rebuilds again and again. When `want` flips back to `c.step` mid-build, the stale job still completes and swaps in an unwanted LOD, which then gets rebuilt. Up to 3.5 ms of every gameplay frame goes to streaming (`GameSession.ts:555`), and the GPU upload (~1.3 MB per step-1 chunk, `Uint32` indices at `:199` where `Uint16` would fit) is outside that budget. `surfaceWeights` allocates an object per vertex (`course.ts:334`, called at `TerrainRenderer.ts:188`), about 16.6k objects per step-1 chunk.
4. **Three always-on PointLights** (`Resort.ts:244,295,478`) add to the light loop of every lit fragment in the scene: terrain, trees, and the 12 Yeti fur shells, even when the resort is 3.5 km away. Toggling `visible` would trigger a recompile, so the fix is baking or emissive fakes, or lights only within resort range with a constant light count.
5. **Shader warm-up is incomplete.** `renderer.compile` (`App.ts:169`) uses `traverseVisible`, but every vegetation mesh is `visible=false` at that point (`Vegetation.ts:163`, before the first `update`), so foliage and rock programs compile on the first menu frame. Shadow-depth variants (skinned/instanced Yeti, cave meshes) are never pre-compiled, so a hitch is likely when the Yeti first appears in the cave cinematic. Unverified.
6. **Yeti shell fur has no distance LOD** (`YetiModel.ts:109-126`; 12 shells on High, `buildGeometry.ts:53`). The shells are full `MeshStandardMaterial` with `discard` (`materials.ts:115-129`), which defeats early-Z. In cinematic close-ups (fov 30–34, head filling the screen), that is about 12 layers of PBR shading with 3 point lights, a directional light and PCF shadows, plus alpha-to-coverage cards. This is the most likely fill-rate spike. `setFurVisible` exists but nothing calls it.
7. **Per-frame CPU work that doesn't need to run.** All ~12 skinned guests and resort FX update every frame from the menu onward (`App.ts:452,460`, `Resort.ts:738-742`). The tutorial rewrites `innerHTML` every frame (`GameSession.ts:579` → `Hud.ts:125-127`). The HUD writes `textContent` and `toLocaleString` every frame without change checks. Particles walk the whole pool (7000 on High) and re-upload four attributes every frame, including `aCol`, which never changes after emit (`Particles.ts:135-164`).
8. **GC pressure.** `collide()` allocates a `Set` on every physics step at 120 Hz (`SkierPhysics.ts:443`), and `drainEvents` allocates an array each step (`:586`). `syncVisuals` allocates about 8 Vector3/Matrix4 plus a spread pose object per frame (`GameSession.ts:456-462,469-489,505-509,545,549`). `updateHud` calls `stats()` to build an object every frame (`:595`). Cinematic shots allocate many vectors per frame in their `from/to` closures (`CaveCinematic.ts:40-71`). V8 handles each of these individually, but together they cause periodic minor-GC pauses.

## Minor issues
- `GameSession.dispose` (`:694-700`) doesn't cancel the `shakeTrees` `setTimeout`s (`:135`), so delayed bursts land in the next run. `world.yetiPrints` is never cleared between runs (only tracks and particles are, `:107-108`).
- `App.loop` catches and logs each frame (`App.ts:428-432`). A persistent exception spams the console 60 times a second and freezes the game with no message. Context loss shows a fatal message with no `webglcontextrestored` path (`:57-61`).
- A quality change doesn't re-apply the pixel-ratio cap (`applyPixelRatio` is only called from resize and render scale, `App.ts:104-115`). MSAA is fixed at construction (`:49`).
- Dead condition `if (s.crashed && !this.s.crashed) break;` (`SkierPhysics.ts:450`).
- Vegetation `InstancedMesh`es keep `matrixAutoUpdate=true` (`Vegetation.ts:120-136`), so ~1–2k static nodes get traversed every frame.
- The audio scheduler runs on a 25 ms `setTimeout` (`AudioEngine.ts:64-74`). It gets throttled in hidden tabs while the menu music is still playing. `safe()` swallows every audio error silently.
- The production build ships preview pages and the `?debug` harness (`vite.config.ts:5-17`, `App.ts:137`). A leftover `tools/dbgshot.tmp.mjs` is in the repo.
- Physics is sound: fixed 1/120 s step, 12-step spiral cap (`GameSession.ts:200-207`), interpolated rendering, and a deterministic test. There is no tunnelling risk, since the minimum core radius is 0.66 m against 0.375 m per step at 45 m/s, and `physics.test.ts:290` covers it.
- Tests don't cover terrain streaming, LOD seams, vegetation culling, resource disposal or run-to-run leaks (`renderer.info.memory` across N retries), or any perf budget.

## Recommended corrections (prioritized)
1. Measure on real hardware (mid-range desktop GPU, 1080p High): p50/p95 frame time for menu, chase, cave close-up and resort finish, using the existing `__skifree.perf()`. Add an e2e that runs 10 retries and asserts `renderer.info.memory.{geometries,textures}` stays flat.
2. `Environment.ts:146`: add `this.sun.shadow.dispose()`.
3. `TerrainRenderer.ts:104-111`: add a hysteresis band (e.g. coarsen only past `range*1.15`), and cancel or retarget in-flight jobs when `want===c.step`. Use `Uint16Array` indices. Make `surfaceWeights` write into an out-param.
4. Yeti: fewer shells by distance or screen size (call `setFurVisible`/shell count at > 40 m). Cap shells to 8 in close-ups on High, or use `alphaHash`/pre-pass depth.
5. Resort point lights: enable them only near the finish while keeping the light count constant (intensity 0 doesn't save cost, so use a bake or emissive fake). Skip `Resort.update` and guest animation when the camera is more than ~400 m away.
6. Warm-up: call `vegetation.update(camera.position)` before `compile`, use `compileAsync`, and render one off-screen frame with the Yeti in the shadow frustum during loading.
7. Remove per-step and per-frame allocations (reuse `stillTouching`, the event array, scratch vectors, the pose object). Add change checks in the HUD and drop `refreshPrompt` per frame. Use `addUpdateRange` and skip `aCol` uploads in particles.
8. Clear `yetiPrints` and pending timeouts on session start. Rate-limit and surface loop errors. Handle `webglcontextrestored` or offer a reload button.
9. Exclude `preview/` from the production `rollupOptions.input`. Enable `noUncheckedIndexedAccess`.

## Scores
- **Performance and stability: 6/10.** The architecture is reasonable: chunked terrain with skirts, a time-sliced build, instancing, a pooled particle system, fixed-step physics, and voice limiting with node cleanup. But nothing is measured, there is a confirmed GPU leak, LOD thrash, always-on point lights, no fur LOD, and incomplete warm-up.
- **Code quality/architecture: 7/10.** Separation is clean (World persists, Session is per run, Stage interface), strict TS passes, and physics and audio logic are well tested. Weaknesses: comments that don't match behaviour, dead code, the swallow-all error policy, no rendering or lifecycle tests, and dev pages in the production build.

## Pass/fail vs 9/10 gate
**FAIL.** Both scores are below 9, and the central performance claim has no measurement behind it.

## Unverified or unavailable evidence
- Real GPU frame times, shadow-pass cost, overdraw in fur close-ups, and the shader-compile hitch at the cave reveal. All of these come from reading code, since only SwiftShader is available.
- Post-frustum-culling draw counts during gameplay and memory growth over repeated runs were not instrumented. The e2e suite (`tests/e2e/game.spec.ts`) was not run.
