# Round 5 performance (W-096, W-086 targets)

## Build and method
- **Build:** recorded `bbbef83` in every JSON. Its source is identical to the frozen candidate `729e226` (`git diff 729e226 bbbef83 -- src` is empty). The only change since the freeze is in the evidence tool.
- **Tool:** `tools/prod_frames.mjs` against the production build (`npm run build`, `vite preview`), Classic course, Endless, Relaxed, skilled autopilot, 12 km.
- **Order:** the six runs ran one after another, after every other job had finished. Nothing else was running on the 2-CPU machine.
- **Two measurements, kept apart:**
  - **CPU step time (`median`, `p95`, `p99`, `max`, `over16`).** These are the per-frame session, physics, world-streaming and scene-update costs, timed in the browser on the production build.
  - **Software render time (`softwareRenderMs`).** One frame in about every 240 is rendered through SwiftShader, which is CPU emulation of a GPU. It ranks scene cost (draw calls, overdraw, shader work) between builds on the same machine. **It is not GPU time. GPU time was not measured** (no hardware GPU here).
- **Round-4 comparison:** `../../../round-4/candidate/perf/`, same tool and course. Round 4 recorded the last frame's triangles; round 5 adds the maximum over the run. So triangle counts are compared only between round-5 locations.

## Results

| | Whiteout high | Alpine high | Fjord high | Whiteout low | Alpine low | Fjord low |
|---|---|---|---|---|---|---|
| CPU step median / p95 / p99 (ms) | 0.8 / 8.1 / 9.2 | 0.6 / 7.5 / 8.3 | 4.0 / 10.2 / 12.2 | 0.6 / 7.6 / 9.0 | 0.3 / 6.9 / 7.7 | 0.6 / 8.7 / 11.6 |
| CPU frames > 16 ms (of ~33–36k) | 17 | 11 | 55 | 9 | 1 | 38 |
| CPU frames > 33 ms | 0 | 2 | 1 | 0 | 1 | 0 |
| CPU max (ms) | 30.0 | 49.5 | 54.6 | 32.2 | 33.2 | 28.5 |
| Software render median (ms) | 5,868 | 5,336 | 7,448 | 1,722 | 1,829 | 2,146 |
| Max draw calls | 711 | 517 | 654 | 570 | 390 | 511 |
| Max triangles | 5.16 M | 3.06 M | 2.10 M | 1.56 M | 2.60 M | 1.29 M |
| Shader programs (start → 12 km) | 92 → 98 | 70 → 73 | 92 → 92 | 69 → 75 | 48 → 51 | 76 → 76 |
| Programs compiled during play | 6 | 3 | 0 | 6 | 3 | 0 |
| Largest cave time slice (ms) | 24.7 (cave), 14.5 (dressing) | 27.2 | 23.5 (dressing) | 31.1 | 14.5 | 21.3 |
| Heap (MB), start → 12 km | 80 → 121 | 73 → 115 | 105 → 159 | 49 → 59 | 41 → 64 | 70 → 87 |
| Geometries, start → 12 km | 532 → 663 | 364 → 412 | 505 → 564 | 434 → 574 | 267 → 325 | 383 → 459 |
| Restarts / errors | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

### Whiteout against round 4

| | Round 4 (`0787168`) | Round 5 |
|---|---|---|
| High: software render median | 8,886 ms (2.10× Alpine) | **5,868 ms (1.10× Alpine)** |
| High: CPU frames > 16 ms | 22 | 17 |
| High: CPU p95 / p99 / max | 7.9 / 9.7 / 23.3 | 8.1 / 9.2 / 30.0 |
| Low: software render median | 1,558 ms | 1,722 ms |
| Low: CPU frames > 16 ms | 3 | 9 |
| Low: heap at 12 km | 116 MB | 59 MB |

Alpine's own figures moved between rounds too: software render 4,232 → 5,336 ms, and CPU frames over 16 ms 4 → 11. The machine and tool are the same. So treat ±25% in the software render figure, and single-digit counts of frames over 16 ms, as run-to-run spread rather than a measured regression.

## Against the W-086 / W-096 targets

| Target | Result |
|---|---|
| High ≤ 1.5× Alpine (software render) | **Met:** 1.10× (round 4: 2.10×) |
| No Endless frame over 16 ms outside cinematics | **Not met:** 17 CPU frames over 16 ms on high, 9 on low. Alpine has 11 / 1 and Fjord 55 / 38, so this is not unique to Whiteout. The largest single cost is the time-sliced cave work: 24.7 ms on high, 31.1 ms on low. |
| ≤ 2 shader links after start | **Not met:** 6 programs compiled during play (Alpine 3, Fjord 0). The tool counts them but does not name them. |
| Endless memory | No unbounded growth over 12 km. Heap moves with GC timing. Geometries grow 532 → 663 on high (Alpine 364 → 412), and textures 28 → 33. These are the per-location streamed sets, not a leak. A run longer than 12 km would settle it. |

## What this does not show
- **GPU time:** not measured. The software render figure ranks scene cost only.
- **Frame pacing at 60 fps on real hardware:** not measured.
- **Mid-run compiles:** the tool does not say which shaders compile mid-run or whether they cause a visible hitch.
