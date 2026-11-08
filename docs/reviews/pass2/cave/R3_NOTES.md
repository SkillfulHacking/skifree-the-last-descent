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
