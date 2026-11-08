# Cave round 2 — working notes (cave engineer #2)

Start: WIP commit 79a843e from engineer #1 (geology rewrite: band outcrop in caveTerrain/rockField, opaque
normal-driven snow, asymmetric leaning bore, clustered icicles, bounce term, preview c1..c12 with real Yeti).
Capture script: tools/cavecap.tmp.mjs (preview, __setCam batch). 

## Progress log
- [ ] render current state of 79a843e at 960x540, assess each A-item
- [x] rendered 79a843e (preview, 960x540): band-in-hillside geometry largely in place. Found:
  - dev server reloads the preview page whenever another engineer saves a file (blank 'inside' shot) ->
    use a PREVIEWS=1 build + `vite preview` (port 5333) instead.
  - chamber lid read as a raised oval "pillow" with a rock rim (plan/above/side) -> lid now lies 0.3 m
    proud and dives under the snow over ~5 m (rockField.ts).
  - grey translucent smears on the hill above the band (A2) = terrain shader rock-exposure on the
    heightfield's steep hidden step ramp poking above the band top. Probe (tools/cave.probe.ts):
    exposed steep (n.y<0.6) heightfield 437 -> 225 cells (0.25 m2) after: rock covers the ramp
    (top >= hill + 0.45 until STEP_IN+3.2, then dives under) and HILL_L 28 -> 36 (gentler hill).
    The remaining 225 are natural+hill slopes 45-53 deg at t 8-14 m (terrain strata, owned by snowMaterial).
  - rock material: isotropic 5 m blotches -> bed-elongated weathering; hairline fractures in albedo use
    the same ridged noise as the normal creases; fine grain near; emissive cold bounce (uGlow) in the
    chamber falling off with depth (exp(-s/7.5)).
  - jambs: higher-frequency notches + a buttress jutting into the +l jamb at 3 m.
  - exit-path clearance after changes: >= 4.93 m (s<=2), >= 5.72 m deeper.
- [x] after restart (on fce26bb): tsc clean, vitest 107/107. Build timings (node, CPU time via
  process.cpuUsage, wall clock is meaningless under the shared 2-CPU load): high 244 steps, 900 ms CPU
  total, max step 38 ms CPU; low 136 steps, 605 ms, max 31 ms. 42.6k tris (high), 2 draw calls.
- [ ] final evidence: r2_{front,threequarter,wide,approach,inside,closeup} at 1920x1080 and
  r2_c1..c12 at 960x540 (preview, PREVIEWS=1 build on :5333) — running /tmp/runfinal.sh
