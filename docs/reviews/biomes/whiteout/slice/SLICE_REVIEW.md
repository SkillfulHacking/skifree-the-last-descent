# Whiteout Ridge — vertical slice, self-review (not an independent review)

Build: branch `pass5-whiteout`, parent b207e69 + the slice commit. Renders: SwiftShader, 1280×720, `tools/capture.mjs`,
course `SEED-3939949724-SPR@WHITE` (Normal) and `…-SPR-H@WHITE` (Hard).

## What the slice has
- **Storm fronts** (`storm.ts`): clear vista window → 9 s telegraphed build → storm (fog ×11, crosswind 12.5 m/s, heavy
  snow) → easing; the wind veers between fronts. Deterministic per seed; the start is calm for 22 s.
- **Weather-affected skiing**: wind exposure per segment (ridges and the fast alternate lines open, trees and gullies
  sheltered) scales the airborne crosswind, gust wobble and headwind drag; exposed ground is wind-scoured hard pack
  (faster, less grip), sheltered snow is soft and slower.
- **Hazards**: `blizzard` cells sweeping across exposed stretches (5 s telegraph, fog + side-slip / air push, never a
  knock or crash) and `wind-drift` rows across open slopes with a gap on or off the racing line.
- **Telegraphing and accessibility**: HUD pill (`STORM IN 7 s ←`, `STORM ←`, `CLEARING`), captions and
  synthesized cues for fronts, blizzards and drifts; illuminated trail markers (amber on the line, blue on the
  exposed lines; unfogged, brighter in a storm); a fog ceiling (half contrast at ≥ 79 m); Hard snowball landing rings
  drawn without fog.
- **Finish**: a mountain-rescue station (lit door, red beacon through the fog, snowcat, sled, brass storm-lantern
  trophy) and a storm-to-shelter victory script (the storm is held, then clears over the ridge).

## Measured (headless, reader driver, 10 Sprint seeds)
Normal: Alpine 155.0 s, Fjord 164.8 s, Whiteout 168.0 s (all 10 won). Hard: Alpine 8/10, Fjord 8/10, Whiteout 5/10
won. Relaxed: Whiteout 10/10 (reader), 3/10 for the never-tucking "average" autopilot.

## Critical findings (open)
1. **Major — the mountain is not distinct enough yet.** Lowering the walls (460 → 110 m) and the distant ranges
   (1900 → 620 m) opened the view (`01_clear_window.png` vs `00_first_terrain_valley.png`), but the piste still runs
   down a valley-shaped trough: the generic cross-section makes every location a valley. A true ridge needs a terrain
   knob for a convex cross-section (falling away on both sides) and corniced edges. Not built.
2. **Major — the Yeti is white on white in a storm** (`03_storm_whiteout.png`): readable at 10 m but not at 60 m;
   the HUD distance bar and the rear view carry the cue. A darker silhouette or a rim light in storms is needed.
3. **Major — storm shots not yet checked for the blizzard cells and drifts close up**; the victory cinematic and the
   rescue station have not been rendered.
4. Minor — the storm dome makes the far terrain one flat grey; there is no sense of the storm *moving* (cloud motion).
5. Minor — the difficulty step over Fjord on Normal is small (+3 s); Hard is clearly harder.
6. The six-reviewer round has not been run on this build.

Verdict: the weather systems and their telegraphing work in the integrated game; the slice is **not** ready to build
the full course on until findings 1–2 are resolved.
