# W-031 — Whiteout cave leap white-out: diagnosis and fix

**Status: FIXED (commit 3571f21), verified on the integrated renderer** (production build, SwiftShader).

## Root cause
`Environment` captured the bases of its storm scaling (sun intensity, snowfall flake size, haze
height-falloff, fog colour) lazily, from the live and already-scaled values, behind the guard
`if (sunBase === 0)`. A retry reuses the world (same course). When run 1 ended before the weather's
first storm change, the old session's teardown called `setAmbientScale(1)` → `applyLight()` →
`sun = sunBase (0) × …` = 0; on run 2 the first storm change captured `sunBase = 0`, the guard never
latched, and every storm change (every frame of the cave squall) re-captured the scaled values and
scaled them again:

| on run 2, cave leap 15.2 s | fresh page (run 1) | retry (run 2), before the fix |
|---|---|---|
| snowfall flake size (m) | 0.093 | **3.1·10²⁶** (1.2·10⁸⁷ in the e2e reproduction) |
| flakeBase / sunBase | 0.075 / 0.657 | 2.5·10²⁶ / **0** |
| haze falloff | 7.1·10⁻⁴ | 1.4·10⁻⁴⁰ |

Screen-sized flakes (2400 sprites, depth-tested, drawn before the icicles in the transparent pass)
veiled everything but the skier and the icicles. Same root cause, branch only: Alpine and Fjord (no
fronts) never captured their bases, so on every retry their sun was 0 (**W-033**).

## How it was proven (tools/w031_probe.mjs)
1. Same course, same camera: a fresh page renders the leap cleanly at 640×360 and 1280×720, with
   the harness's autopilot and settle — `repro_run1_leap_1280.png`. Only a **second run in the
   same page** reproduces it — `repro_run2_leap_1280.png`.
2. Ruled out: render origin (0,0,0), camera matrix = position, terrain culling/streaming (367 chunks
   drawn), fog density (0.0017).
3. Shared-atmosphere debug views (`atmoDebug`): fog amount, distance heatmap and a flat magenta tag
   on every `sf_atmosphere` surface all render *under* the same grey veil
   (`repro_run2_fogamount.png`, `repro_run2_magenta_tag.png`) → not the atmosphere shader.
4. Setting the collapsed falloff back on the frozen frame changes nothing → a symptom, not the cause.
5. Bisection over every visible transparent drawable (`hideVeil`): hiding only the environment's
   snowfall Points clears the frame (`bisect_snowfall_hidden.png`); its state dump
   (`snowprobe_run1.json` / `snowprobe_run2.json`) shows the compounded bases.

## Fix (architectural)
- Environment: every base comes from the location's look, once, at construction; storm and
  cinematic scaling compose multipliers (`setSunScale` beside `setAmbientScale`); nothing is read
  back from a live value.
- CaveCinematic dims the sun through `setSunScale` (it used to write `sun.intensity` directly — a
  second writer fighting the storm's).

## Regression
- `tests/e2e/whiteout_rerun.spec.ts` — fails on the old capture (Whiteout: flake base 1.2·10⁸⁷;
  Alpine and Fjord retry: sun 0), passes on the fix: bases equal the look after storms on a retry;
  the cave-leap frame's luminance σ > 25 (white-out frames 5–15, healthy ≈ 40).
- Matrix on a retry (`matrix.json`, `after_*_leap.png`): Whiteout Standard, Endurance (2nd
  encounter), Expedition (3rd), Endless (3rd), Alpine, Fjord — emergence, roar, leap and swing-back
  frames σ 32–72, floating origins (0,0,0), (0,−2048,7168), (0,−3072,13312), the chase hand-over,
  bases = look, no page errors.
