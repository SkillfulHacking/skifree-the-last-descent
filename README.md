# SkiFree — The Last Descent

A third-person 3D skiing survival game for the browser, built with **Three.js + TypeScript + Vite**.
You ski down a mountain at speed. Partway down, a Yeti bursts out of a cliffside cave, and you have
to outrun it to the ski resort at the bottom.

It is an original reimagining of the premise of the 1991 Windows game *SkiFree*. No assets from that
game are used. Every model, texture, animation, sound effect and music cue is generated procedurally
at runtime by code in this repository, so the game has no binary asset files.

## Quick start

Requirements: **Node.js 20+** and a desktop browser with **WebGL2** (current Chrome, Edge, Firefox or Safari).

```bash
npm install
npm run dev          # http://localhost:5173 — development server with hot reload
```

Production build:

```bash
npm run build        # type-check (strict) + bundle into dist/
npm run preview      # serve dist/ on http://localhost:4173
```

`dist/` is a static site that any web server can host. It makes no network requests at runtime:
there is no CDN, no API key and no telemetry.

## Controls

| Action | Keyboard | Controller (Xbox / PlayStation) |
|---|---|---|
| Steer | A / D or ← / → | Left stick (analog) |
| French fry (tuck — faster, less steering) | W / ↑ | Right trigger RT / R2 (analog) |
| Pizza (snowplow brake) | S / ↓ | Left trigger LT / L2 (analog) |
| Drift / aggressive carve (needs speed) | Left Shift | RB / R1 |
| Pop — hold to crouch, release to jump | Space | A / ✕ |
| Recover after a crash | R | Y / △ |
| Look back (hold) | C | B / ○ |
| Pause / menu | Esc | Start / Options |
| Camera look (optional) | Mouse drag | Right stick |

- You never need the mouse during gameplay.
- On-screen prompts switch to whichever device you used last.
- Keyboard keys can be remapped, and the stick dead zone, steering and camera sensitivity and camera
  inversion can be changed, under **Controls**. That screen also has a live controller tester.
- Browsers only allow sound after a key press or click, so a gamepad-only player has to press one key
  or click once to hear audio.

## Options worth knowing

- **Course:** choose "The Last Descent" (classic) or **Daily** (a new deterministic mountain each day) on the main menu.
- **Chase helpers:** a "BEHIND YOU" rear-view window appears when the Yeti is within about 110 m. You can turn it off in Settings.
- **Accessibility:** sound captions, interface text size, camera shake, reduce camera motion, reduce flashes, and tutorial on/off.

## How a run plays out

The game moves to each phase when you reach a point on the course, not after a set time.

1. **Summit:** a short intro, then contextual tutorial prompts for steering, pizza, french fries,
   drift and the pop jump.
2. **Free skiing:** open alpine slopes, then forest, moguls, rollers, kickers, ice, deep powder and
   cliff drops.
3. **Foreshadowing:** huge footprints across the piste, snapped trees, a clawed warning sign, distant
   growls, and the ambient sound dropping away.
4. **The cave:** a roughly 16-second cinematic in which the Yeti emerges and roars. The simulation is
   frozen while it plays. You can skip it after you have seen it once.
5. **The chase:** the music, camera and HUD all change as the Yeti closes in.
6. **The ending:** if the Yeti catches you, it eats you, comically and without gore. If you reach the
   resort, you get the victory sequence: hockey-stop, cheering crowd, the Yeti leaving in disgust,
   the trophy, and a crane shot over the whole mountain. Either way you see your stats and personal
   bests, and you can retry without reloading.

## Project layout

```
src/
  core/        seeded RNG/noise, settings & save data, shared types
  world/       heightfield + course layout (course.ts), terrain streaming/LOD, snow shader,
               vegetation, sky/lighting, cave & story props, start area, resort + guests
  physics/     skier physics (fixed 120 Hz), obstacle generation + spatial hash
  player/      procedural rigged skier model + pose/IK system
  yeti/        Yeti model (skinned, shell fur) + pursuit AI + spawn
  camera/      third-person follow camera
  cinematic/   timeline/shot system, cave reveal, defeat and victory sequences
  game/        App shell, World, GameSession (one run), RunState machine, headless simulate()
  fx/          particles, ski tracks
  audio/       Web Audio synthesis: SFX, ambience, adaptive music
  input/       keyboard / gamepad abstraction
  ui/          HUD, menus, styles
  debug/       autopilot used by tests
preview/       standalone model/audio test benches (skier, yeti, resort, audio)
tests/unit/    Vitest: physics, game state, input, persistence, world fairness, pursuit balance, audio
tests/e2e/     Playwright: menu, full loop (cave → caught → retry → victory), pause, gamepad hot-plug
docs/          design notes, asset/licence register, reviews, screenshots, changelog, known issues
```

## Tests

```bash
npm test             # unit tests (Vitest)
npm run build && npm run test:e2e   # browser tests (Playwright)
```

- The e2e tests use a local Chrome at `/usr/bin/google-chrome` by default. Set `PW_CHROME=` to point
  at another browser, or leave it empty to use Playwright's bundled Chromium
  (`npx playwright install chromium`).
- They force software WebGL (SwiftShader) so they can run on machines without a GPU, so frame rates
  during the tests mean nothing.
- They drive the game through a hidden debug harness, which is enabled only when `?debug` is in the URL:
  teleports, deterministic fast-forward, autopilot, a cinematic seek and a free camera. None of it is
  reachable from the normal UI.

## Performance

- **Graphics presets:** Low / Medium / High / Ultra, under Settings. A preset change takes effect on
  your next run.
- **Live stats:** turn on "Show performance stats" in Settings to see FPS, CPU frame time, draw calls,
  triangles, GPU resource counts and JS heap.
- **What has been measured:** this project was built and tested in a GPU-less container. The only
  measurements so far are scene complexity (draw calls and triangles) and correctness. No frame rates
  have been measured on real hardware. See `docs/KNOWN_ISSUES.md`.

## Documentation

- `docs/DESIGN.md` covers the architecture, the physics model and the pursuit balance.
- `docs/ASSETS_AND_LICENSES.md` is the asset register: everything is procedural, and it lists the
  third-party code.
- `docs/reviews/` holds the critical review reports.
- `docs/KNOWN_ISSUES.md` lists the gaps that remain.
- `CHANGELOG.md` is the development log.
