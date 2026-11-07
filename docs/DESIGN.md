# Design & technical notes

## Architecture

| Layer | Module(s) | Notes |
|---|---|---|
| App shell | `game/App.ts` | Renderer, loading, menus, settings, run lifecycle, perf overlay, hidden debug harness (`?debug`). |
| World (persistent) | `game/World.ts` | Built once per quality preset and reused across runs, so retrying needs no reload. Holds the terrain, vegetation, environment, cave, resort and FX. |
| Run | `game/GameSession.ts` | Created fresh for every run. Covers the fixed-step simulation, phase progression, events → FX/audio/camera, cinematics and scoring. |
| Phase logic | `game/RunState.ts` | Pure state machine, unit-tested. |
| Terrain | `world/course.ts`, `world/TerrainRenderer.ts`, `world/snowMaterial.ts` | Deterministic heightfield function (shared by rendering, physics and AI), chunk streaming with LOD and skirts, procedural PBR snow/ice/rock shader. |
| Physics | `physics/SkierPhysics.ts`, `physics/obstacles.ts` | Fixed 120 Hz, deterministic, renderer-independent. |
| Characters | `player/SkierModel.ts`, `yeti/YetiModel.ts` | Procedural rigged meshes plus procedural animation driven by `SkierPose` / `YetiAnimState`. |
| AI | `yeti/YetiAI.ts` | Pure pursuit model, unit-tested and simulated headlessly. |
| Cinematics | `cinematic/*` | `Timeline` of shots (eased / bezier camera moves) plus fire-once events. |
| Audio | `audio/*` | Web Audio synthesis only. The graph builders accept any `BaseAudioContext`, so they can be rendered offline in tests. |

The rendering loop runs at display rate, and the simulation steps in fixed increments of 1/120 s,
capped at 12 steps per frame. Visual positions are interpolated between physics states. Physics
results do not depend on frame rate: the unit tests check that identical inputs produce identical
positions.

## World

- **Course:** 3 km from summit to resort, with about 917 m of vertical drop.
  - Z increases downhill, and Z is the progress metric for every phase.
  - The slope profile is specified as a list of key points (degrees by Z) and integrated, so the
    height is C¹-continuous.
- **Cross-section:**
  - a gentle bowl on the piste;
  - valley walls that ease in, then steepen into ridged rock;
  - distant ranges built from ridged multifractal noise.
- **Features:**
  - moguls, rollers and wind drifts;
  - kickers, generated deterministically per seed and alternating between on-route and optional
    side features;
  - three cliff bands, always on the side away from the primary line;
  - a cliff with the cave notch cut into it.
- **Primary route** (`routeX`): a meandering line that is guaranteed clear of solid obstacles within
  ±6 m. This is unit-tested across seeds. Trees, rocks, logs and stumps are placed with jittered-grid
  sampling, with density driven by altitude (an open summit, forest lower down), clumping noise and
  distance from the piste.
- **Surfaces:** ice, powder and groomed weights come from the same functions in physics and in the
  shader, so what you see is what you ski on.
- **Terrain mesh:**
  - 128 m chunks at LOD steps of 1, 2, 4, 8 and 16 m, chosen by distance;
  - chunks are built in time-sliced jobs, and the old LOD stays visible until the new one is ready,
    so nothing pops into a hole;
  - skirts hide cracks between neighbouring LODs;
  - a coarse far-field mesh with a hole for the corridor;
  - the cave chunk is pinned to full detail.

## Skier physics (simplified, physically motivated)

- **Gravity:** gravity projected onto the terrain tangent plane.
- **Heading and grip:** the skis have a heading; velocity is split into an along-ski part and a
  lateral part. Lateral velocity decays at a grip rate:
  - carve 9.5/s; drift 3.8/s;
  - multiplied by surface: ice ×0.32, powder ×0.85.
- **Energy:** the edge force is perpendicular to the ski. Grip rotates the velocity toward the ski
  axis with a skid loss, and never adds energy. This is unit-tested: you cannot carve your way uphill.
- **Resistance:**
  - Coulomb snow friction μ, by surface;
  - quadratic air drag, upright 0.0085 versus tuck 0.004 (k = ½ρC_dA/m);
  - extra drag in powder.
- **Pizza:** a progressive braking deceleration of 3.8 + 0.12·v, enough to stop on the main 20° pitches. Steering stays available; you lose
  some steering authority but gain edge grip.
- **French fries:** lower drag (so the advantage grows with v²) and 50% less steering authority. Top
  speed is set by slope and drag: about 30 m/s on the 25° gully.
- **Drift:** needs at least 9 m/s. It lowers grip, raises turn rate ×2.2 and adds a speed bleed of
  0.4 m/s², and carving returns smoothly when you let go. At 20 m/s it changes the direction of
  travel about 65% faster than carving, at about 72% of the speed.
- **Compressions:** concave transitions that drive the skis into the snow cost up to 8% of speed and
  load the legs and camera.
- **Jumps:** takeoff happens when the terrain falls away faster than gravity can follow. The test
  compares the ballistic continuation of the last path slope against the next terrain sample, which
  avoids smoothed-normal artefacts at crests. Flight is ballistic with drag; there is no air control,
  and spins are for style only. The pop is charged by holding and fires on release, grounded only,
  with a cooldown.
- **Landing:** judged by impact speed into the surface (v·n) and by how well the skis line up with
  the direction of travel:
  - soft below 8 m/s;
  - hard at 8 m/s or more (speed loss, wobble, camera shake);
  - crash above 11.5 m/s, or when landing sideways at speed.
- **Collisions:** each obstacle has a solid core plus soft branches on trees.
  - Light contact slides you along it.
  - A heavy hit bounces you, loses speed and makes you wobble.
  - A catastrophic hit is a crash. Thresholds differ by type: trees about 8.5 m/s, boulders 9, logs 6.
  - Small rocks and stumps knock you about. Logs and rocks can be jumped over.
  - Unit tests check that you never pass through a trunk, even at 45 m/s.

## Pursuit balance (`yeti/YetiAI.ts`)

- **Speed limits:** the Yeti's ground speed is capped and its acceleration is limited (base 16.5 m/s,
  acceleration 6.5 m/s², cap 27 m/s). On gentle ground (below 12°) it is capped at 13 + 0.5·slope.
- **Terrain effects:** it loses up to 12% on steep pitches, 22% off-piste and up to 35% in tree
  canopy. It is relatively strong on gentle ground, where skis are slow.
- **Pressure:** beyond a 60 m gap it digs in, up to +9 m/s, plus up to +7 m/s (and +6 on the cap)
  beyond 105–170 m, which keeps a fast skier's lead at about 170 m or less. It warms up over the
  first 4 s of the chase. If the skier ends up uphill of it, it turns around and goes straight for
  them.
- **Lunge:** within 13 m it lunges (+7 m/s for 0.75 s, with a 3.2 s cooldown).
- **Capture:** a real 3D proximity check below 2.7 m, which a skier high in the air can evade.
- **Navigation:** it follows the route corridor when far away and homes in on the skier (with lead)
  when close. It steers around trunks and boulders, and ploughs through canopy at reduced speed, so it
  never gets permanently stuck. Unit-tested.
- **Fairness:** `game/simulate.ts` runs whole descents headlessly against autopilot styles, and the
  results are asserted in tests:

| Style | Outcome (default, 42, 7777 and a daily seed) |
|---|---|
| skilled (tucks whenever lined up) | escapes on all four; min gap 31–57 m, max gap ≈ 170 m, finishes ≈ 112 m ahead |
| skilled with injected crashes (at 20 s; at 30 + 60 s; at 50 s) | escapes (finishing 77–114 m ahead) |
| intermediate (tucks on clean straights only, checks speed) | escapes on all four |
| average (never tucks) | escapes by 3 m on the default seed; caught on the others |
| careless | caught on all four |

The unit tests assert the default-seed results, the crash cases, the max-gap cap and one seed-42
case. The other seeds were checked with an ad-hoc simulation run.

These are perfect-line bots; human players crash and take wider lines. A crash costs roughly
110–125 m of gap when the player gets up promptly, and up to the full 3.2 s auto get-up otherwise.

## Cinematics

- **Timeline:** a list of shots, each a camera move evaluated per frame (so it can track moving
  actors), plus fire-once events. Skipping fires every remaining event in order, which makes the end
  state the same as watching it through.
- **Cave reveal:** 12 beats annotated in `CaveCinematic.ts`. The simulation is frozen throughout; the
  skier's velocity is kept and resumes when the camera swings back into third person.
- **Defeat and victory:** run on top of the live world. The outcome is locked in `RunState` before
  they start.

## Accessibility & comfort

- Camera shake can be scaled from 0 to 100%.
- **Reduce camera motion** narrows the speed-FOV range and damps shake.
- **Reduce flashes** softens the Yeti eye glow and the proximity pulse.
- Tutorial prompts can be turned off.
- Remappable keys.
- Analog dead zone and sensitivity settings.
- An optional camera orbit that recentres itself.
