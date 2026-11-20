# CPU frame cost and memory — candidate build, production bundle

**Tool:** `tools/prod_frames.mjs`, 12 km of Endless with the skilled autopilot. Every simulated frame (session, physics, Yeti, hazards, `World.update` streaming) is timed in Chrome's V8.

**What is not measured:**
- GPU work: rendering here is SwiftShader, a software rasteriser, so **GPU timing is unavailable**;
- draw submission, uploads and shader compiles inside `renderer.render`.

The software render times are listed only to show that a frame was drawn.

| Location | frames | median ms | p95 | p99 | max | > 8 ms | > 16 ms | > 33 ms | heap MB | triangles (last frame) | SwiftShader render ms (median) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| alpine | 32849 | 0.4 | 7.2 | 7.9 | 26.2 | 263 | 5 | 0 | 89.8 | 1,823,000 | 4347 |
| fjord | 34890 | 2.9 | 9 | 10.7 | 60.7 | 3641 | 17 | 1 | 163.4 | 1,660,694 | 5822 |
| whiteout | 37270 | 7.5 | 15.3 | 17.6 | 55.7 | 16626 | 1220 | 11 | 103.2 | 7,804,452 | 10541 |

## Finding (W-038, major)
Whiteout's steady-state CPU cost per frame is **7.5 ms median**, against Fjord's 2.9 ms and Alpine's 0.4 ms.
- 1220 of 37,270 frames exceed 16 ms (Fjord 17, Alpine 5).
- The scene submits about 4× the triangles of Fjord.

This is a constant cost, not streaming hitches.

**CPU profile** (1500 frames, `scratch/profile.mjs`, not committed): about 59% native `(program)` time and 27% one minified function in the bundle. The game's own JS (terrain queries such as `centerX`/`routeX`/`heightAt`) is under 10%. That points to per-frame buffer or attribute work in the weather views (the snowfall/blowing-snow particle updates and geometry rebuilds are the first suspects). **Not yet attributed:** a dev-build profile is needed.

## Endless memory (`endless_whiteout.json`, 40 km, `tools/endless_memory.mjs`)
| | min | max | at 40 km |
|---|---|---|---|
| Heap (MB) | 62.2 | 94.2 | 81.2 |
| Geometries | 478 | 589 | 559 |

No growth trend.

## Audio (`../audio.json`, `tools/audio_probe.mjs`)
Master output tapped with an AnalyserNode on course `SEED-3403625622-SPR@WHITE`:

| | RMS | Peak |
|---|---|---|
| Clear window | 0.089 | 0.42 |
| Storm (physics clock t = 37 s) | 0.101 | 0.46 |

- 705 sources started; no NaN; no clipping (max peak 0.46); no errors.
- **The storm is only about 13% louder in RMS than the clear window.** Whether that reads as a storm is for the reviewers.
