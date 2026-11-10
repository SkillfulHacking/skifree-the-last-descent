# SkiFree — The Last Descent

A third-person 3D skiing survival game for the browser, built with **Three.js + TypeScript + Vite**.
You ski down a mountain at speed. Early in the run, a Yeti bursts out of a cliffside cave, and you have
to outrun it to the ski resort at the bottom.

It is an original reimagining of the premise of the 1991 Windows game *SkiFree*. No assets from that
game are used. Every model, texture, animation, sound effect and music cue is generated procedurally
at runtime by code in this repository, so the game has no binary asset files.

**Play online:** https://skillfulhacking.github.io/skifree-the-last-descent/ (deployed from `main` by GitHub Actions; see `.github/workflows/deploy.yml`).

## Locations (biomes)

The mountain's look, vegetation, obstacle mix and terrain character come from a **biome**. Alpine is
the only one so far; `docs/BIOMES.md` explains how to add more. A non-default location is shown in
the menu (a Location row appears once there is more than one) and in course codes as a suffix,
e.g. `DAILY-2026-11-08-STD-N@DUSK`; Alpine codes are unchanged.

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

- **Mountain** (main menu):
  - **The Last Descent** — the fixed classic mountain. At Sprint length it is the original
    hand-tuned 3 km course.
  - **Daily Mountain** — a new deterministic course every UTC day. It rolls over at 00:00 UTC for
    everyone, and the last 14 days can be replayed.
  - **Custom seed** — type any word or number.
- **Length:** Sprint 3 km, **Standard 10 km** (the default), Endurance 20 km, Expedition 50 km, or
  **Endless**. On Endless there is no finish: the Yeti returns again and again, faster each time,
  and refuges along the way bank your score. You can retire from the pause menu and keep the banked
  score.
- **Yeti:** Relaxed / Normal / Hard pursuit difficulty. On **Hard** the Yeti also hurls snowballs during the
  chase. Each one is aimed at (or just ahead of) where you are heading, and its landing zone is marked on
  the snow the moment it is thrown: a red ring with a light column that fills and pulses faster as it
  comes down. Change line to get out of it: the ball is dangerous for the last half-second of its
  fall and the splash, so cutting through the circle as it lands counts as a hit. A direct hit
  staggers you and costs about half your speed; a near miss costs a little. Watch the rear view: the
  Yeti rears up and winds up an overarm throw before each ball leaves its hand.
- **Course codes:** every course has a code, such as `DAILY-2026-11-07-STD` or `SEED-777-END-H`.
  Type a friend's code into the menu to ski the same mountain. Records are kept per code on this
  device only; there is no online leaderboard.
- **Achievements** (main menu): 12 achievements for skill, Yeti escapes, journeys, Daily runs and
  (coming with the new locations) exploration. Cards show progress where it applies, and hidden ones
  read ??? until earned. A small toast announces each unlock during play. Progress is saved in this
  browser only. Runs driven by the `?debug` test harness never count.
- **Locker** (Achievements → Locker): two alternate jacket colourways, Glacier Blue (*Not Today,
  Yeti*) and Pesto Green (*Pizza Party*). Cosmetic only: no effect on how the skier handles.
- **Chase helpers:** a "BEHIND YOU" rear-view window appears when the Yeti is within about 110 m. You can turn it off in Settings.
- **Accessibility:** sound captions, interface text size, camera shake, reduce camera motion, reduce flashes, and tutorial on/off.

## How a run plays out

The game moves to each phase when you reach a point on the course, not after a set time.

Courses are assembled from segment types (beginner, open alpine, forest, ridgeline, basin, chute,
moguls, powder, high-speed, cliffside), each with its own slope, width and hazards. The whole course
comes deterministically from its code. The Yeti's cave is always inside the **first 10 %** of the
course (Sprint: by 300 m; Standard: by 1 km), so on Sprint and Standard you are chased almost all the
way to the resort. On every length you ski free for only about **10 %** of the distance; the Yeti is
on your tail for the rest. Endurance, Expedition and Endless are a chain of chases: each ends at a
**refuge** where the Yeti loses your trail, with a short reprieve (about 600 m) before the next
cave. Endurance has 2 refuges, Expedition 7, and Endless one every 6 km. Wide segments
sometimes have an **alternate line**: a shorter, icy, slightly sunken chute marked with
orange and blue poles. It is faster but has less grip.

1. **Summit:** a short intro, then contextual tutorial prompts for steering, pizza, french fries,
   drift and the pop jump. The tutorial runs on your first playthrough only; turn it back on under
   Settings → Tutorial prompts.
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
  game/        App shell, World, GameSession (one run), RunState machine, headless simulate(),
               gameplay event bus (events.ts) + physics telemetry (telemetry.ts)
  progression/ achievements, persistent stats, versioned progress save, cosmetics
  fx/          particles, ski tracks
  audio/       Web Audio synthesis: SFX, ambience, adaptive music
  input/       keyboard / gamepad abstraction
  ui/          HUD, menus, styles
  debug/       autopilot used by tests
preview/       standalone model/audio test benches (skier, yeti, resort, audio)
tests/unit/    Vitest: physics, game state, input, persistence, world fairness, pursuit balance, audio
tests/e2e/     Playwright: menu, full loop (cave → caught → retry → victory), pause, gamepad hot-plug,
               achievements/locker screens and the no-persistence rule for test runs
docs/          design notes, asset/licence register, reviews, screenshots, changelog, known issues
```

## Tests

```bash
npm test             # unit tests (Vitest)
npm run build && npm run test:e2e   # browser tests (Playwright)
```

- The e2e tests use a local Chrome at `/usr/bin/google-chrome` by default. Set `PW_CHROME=` to point
  at another browser, or leave it empty to use Playwright's bundled Chromium
  (`npx playwright install chromium`). Set `PW_PORT` to serve the build on another port than 4173,
  for example to run two checkouts' suites side by side.
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
- `docs/PROGRESSION.md` covers gameplay events, achievements, the progress save and migrations,
  cosmetics, and the progression plan.
- `docs/ASSETS_AND_LICENSES.md` is the asset register: everything is procedural, and it lists the
  third-party code.
- `docs/reviews/` holds the critical review reports.
- `docs/KNOWN_ISSUES.md` lists the gaps that remain.
- `CHANGELOG.md` is the development log.
- `docs/reviews/pass2/` holds the Pass 2 evidence and reviews: menu metrics and screenshots, cave
  and cinematic frames, the grounding report and visual before/after pairs. The consolidated defect
  tracker is `DEFECTS.md`.
