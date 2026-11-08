# Cave/environment round 3 — working notes

Scope: A34, A29, A10/A37/A2/A3/A40/A6, A30 (+A31 if time). Branch pass2, uncommitted.

## Log
- start: read round2/A_visual.md. Plan: rockMaterial fracture rewrite first (A34).
- built /tmp/dist_r3 (PREVIEWS=1), preview :5341; rendering /tmp/r3a front,closeup after rockMaterial v4 + rock geometry change
- [00:31] rebuilt (bedding mask, caveTerrain smax/sink, footprint rewrite, rocks); game capture /tmp/r3b via /tmp/r3game.json
- r3_cave_rock_closeup / r3_cave_piste (in-game, classic sprint, freeCam): quilted cells gone (new
  cv_fracture: bedding partings + 2 staggered joint sets, smooth bed-stretched knobs). Claw = one pale
  scraped set. Bedding partings still a bit "ruled" at 50 m -> mask raised, fracture fade 18-60 m.
- [00:53] ranges.ts A31 tweak (haze, spurs, key/fill); capture 2 -> /tmp/r3c (rocks mid/near at z~460 x 120-240, cave piste, ranges)
- [01:05] vitest 109/109 pass, tsc ok. Evidence copied: r3_rocks_mid/near, r3_cave_piste, r3_cave_hill_wide, r3_ranges, r3_cave_rock_closeup. Rendering preview front/closeup/threequarter -> /tmp/r3d
- [01:09] preview r3d: prints now soft depressions, claws pale scrape; facets remain on apron edge -> widened ledge liftMask falloff (0.75..2.1); more mid-freq rock bump (surface-nets facets showed through). Final preview render -> /tmp/r3e
- [final] r3_preview_front/closeup (final build). vitest 109/109, tsc clean. Exit path min clearance 5.60 m,
  42.5k tris (unchanged budget). A30: spiky crests come from course.ts heightAt():
  `rough = ridged(x/160, z/160, s+7, 4) * 70 * smoothstep(30,220,e)` (line ~140) and the distant-range term
  `900 * smoothstep(350,2600,e) * (0.35 + ridged(x/900, z/900, s+11, 5))` (line ~143) — not edited.
  Remaining: surface-nets facets visible on the rock at 4 m; bedding partings still fairly continuous;
  A2/A3 slab at the band's right end not addressed; A31 ranges change unverified (not in frame).
