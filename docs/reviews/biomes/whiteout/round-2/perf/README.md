# Round 2 — CPU frame cost, memory, audio (candidate build, production bundle)

**Tools:**
- `tools/prod_frames.mjs`: 12 km of Endless, skilled autopilot; every simulated frame timed in V8.
- `tools/endless_memory.mjs`: 40 km.
- `tools/audio_probe.mjs`.

**GPU timing is unavailable here** (SwiftShader software rendering): no number below is a GPU time.

| Location | median ms (R1 → R2) | p95 (R1 → R2) | p99 | max | frames > 16 ms (R1 → R2) | > 33 ms | heap MB | draw calls (last frame) | triangles (last frame) |
|---|---|---|---|---|---|---|---|---|---|
| alpine | 0.4 → **0.4** | 7.2 → 7.1 | 7.5 | 16.8 | 5 → **2** | 0 | 106.5 | 510 | 1,823,000 |
| fjord | 2.9 → **2.9** | 9 → 8.9 | 10.6 | 25.2 | 17 → **19** | 0 | 169.9 | 579 | 1,660,694 |
| whiteout | 7.5 → **0.7** | 15.3 → 8 | 8.7 | 67.4 | 1220 → **18** | 2 | 100.3 | 648 | 13,876,505 |

**W-038 (the drift plume) is reproduced on the integrated build.** Whiteout's median CPU frame time is 0.7 ms (round 1: 7.5), and 18 frames exceed 16 ms (round 1: 1220) — the same level as Fjord (19).

**The renderer counters are those of the run's last frame,** so they depend on where that frame looked (here, a wide view down the ridge with the drop now in sight). They are not a scene total.

**Scene census at the same point** (`scratch/census.mjs`, Endless z = 1500, camera at the same pose, visible-object totals; not committed):

| | Round 1 (`3f7bc45`) | Round 2 |
|---|---|---|
| Instanced props and vegetation | 6.76 M triangles in 286 meshes | 6.75 M in 285 |
| Terrain chunks | 1.07 M | 1.02 M |
| Whiteout scenery | 0.63 M | 0.63 M |
| Scenery meshes with culling disabled | 25 | 7 (W-052: the ridge rocks are now culled per chunk) |

New round-2 objects are small: drift-gap markers 432 triangles; cave cornice, rime and bank about 1.1 k.

## W-038 visual check (plume grounding and motion)
The plume heights are sampled once per grain along its crest track. The unit test `whiteout_drift_plume.test.ts` checks that they stay within 5 cm of the per-frame terrain query they replaced, and the positions still animate every frame. In the round-2 frames the plumes stream off the drift crests in a storm; no floating grains were seen in the frames examined.

## Endless memory (40 km, Whiteout)
| | min | max | at 40 km |
|---|---|---|---|
| Heap (MB) | 62.7 | 84.1 | 75.5 |
| Geometries | 482 | 583 | 559 |

There is no growth trend and no errors.

## Audio (`../audio.json`)
Master output was tapped on course `SEED-4033011667-SPR@WHITE`.

| | RMS | Peak |
|---|---|---|
| Clear window | 0.088 | — |
| Storm | 0.149 | 0.60 |

**The storm is +4.6 dB over the clear window (round 1: +1.1 dB).** The probe also recorded:
- maximum peak 0.60, so no clipping;
- no NaN values;
- no errors.

Wind direction and shelter are covered by `tests/unit/storm_audio.test.ts`; the probe does not measure the stereo pan.
