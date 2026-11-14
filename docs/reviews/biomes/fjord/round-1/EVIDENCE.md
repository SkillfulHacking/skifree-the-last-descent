# Fjord Coast — round-1 evidence

## Build

- Rendered from commit **`f8519ca`** (branch `pass4-fjord`): `npx vite build`, served with
  `npx vite preview --port 4471 --strictPort`. All captures below used that one `dist/`.
- Later commits on the branch until these captures finished touch only `docs/reviews/**` and
  `tools/biome_evidence.mjs` (`git diff --stat f8519ca HEAD -- src` is empty). The `sha` field in
  each `manifest*.json` is the HEAD at the moment that capture started, so later manifests name an
  evidence-only commit (`cb87428`, `13914a2`); `+dirty` in the Alpine manifest means evidence PNGs
  were uncommitted when it started.
- Renderer: Google Chrome via Playwright, SwiftShader (software WebGL), quality preset `high`,
  `?debug` harness. Page errors recorded during every capture: none (`errors: []` in each manifest).
- Course: `classic:sprint` (3 km, seed 20261106), difficulty Normal except where noted, rear view on.

## How the shots are produced

All by `tools/biome_evidence.mjs <biome> classic:sprint <outDir> <WxH> http://127.0.0.1:4471 <shots>`.
The `?debug` hooks used: `menuFocus('Location')`, `startRun(true)`, `teleport(z, v)`, `hold(true)`
(simulation paused; steps only via `frames(n)` at 1/30 s), `freeCam(pos, look, fov)` (kept ≥ 2.5 m
above local terrain), `hud(false)`, `toCave()`, `seenCave(false)`, `toChase()`, `autopilot('skilled')`,
`placeYeti(gap)`, `setCourse(..., { difficulty: 'hard' })`. Camera position/FOV, phase and z of every
shot are in the manifests.

| Manifest | Contents |
|---|---|
| `manifest.json` | the 1920×1080 `all` run (4400 s). Its entries for 09b/09c describe the first attempt, which ended on the results screen; those two files were then replaced (see below) |
| `manifest-snowball.json` | 1920×1080 re-capture of 09b/09c with the corrected Yeti placement (`b76513d`) |
| `manifest-1366x768.json`, `manifest-2560x1440.json` | `menu,summit,finish` runs at the other two resolutions |

## Files — 1920×1080 (brief §9 numbering)

| File | What it shows | How |
|---|---|---|
| `01_menu.png` | Main menu with the Location row (Fjord Coast) focused; the location preview renders behind the menu | `menuFocus('Location')`, menu camera |
| `02_summit.png` | Start gate area and the first part of the run, the cliff rim and the fjord beyond | `freeCam` 62 m above the start, looking down the run over the rim, FOV 56 |
| `03_mid_mountain.png` | Mid-mountain terrain at z = 1500 m with tree groups and the fjord to one side | `teleport(1500)`, `freeCam` 30 m above the piste looking across/down, FOV 52 |
| `04_signature_hazard.png` | `sea-gust` hazard (id 24576) in its active phase, with its windsock telegraph, beside the piste | hazard list from `hazards()`, teleport 160 m before it, `frames()` until phase `active`, low `freeCam` beside it, FOV 50 |
| `04b_hazard_rock.png` | `scoured-rock` hazard: a bare-rock patch beside the racing line | `teleport`, low `freeCam` 7 m above the snow, FOV 50 |
| `05_material.png` | Terrain material near the cliff rim at z = 1080 m (snow surface, rim, wall rock) | `freeCam` 1.7 m above the snow beside `coast.rimX(z)`, FOV 62 |
| `06_long_distance.png` | Coastal cliff wall and the open fjord from over the water, z ≈ 900 m | `freeCam` 1500 m out from the route, 340 m above sea level, FOV 55 |
| `07_yeti_cave.png` | Yeti sea-cave entrance with the Fjord dressing (basalt columns, icicles, boat, net) before the encounter | `teleport(trigger − 75)`, `freeCam` 26 m in front of the mouth, FOV 50 |
| `08_yeti_cinematic.png` | Cave cinematic at t ≈ 9.5 s: the Yeti emerging at the cave mouth (letterboxed) | `toCave()`, `frames()` to cinematic time 9.5 s; cinematic camera |
| `08b_yeti_cinematic.png` | Cave cinematic at t ≈ 14.6 s: over-the-shoulder view from the skier toward the cave | `frames()` to 14.6 s; cinematic camera |
| `09_pursuit.png` | Ordinary chase gameplay on Normal: follow camera, HUD, rear-view inset with the Yeti, caption | `autopilot('skilled')`, `placeYeti(18)`, 40 frames; game camera |
| `09b_hard_snowball.png` | Hard mode, ordinary chase: Yeti ~32 m behind in the rear-view inset during a throw; the landing-zone marker (vertical light column) ahead of the skier | `setCourse(hard)`, `autopilot('skilled')`, `placeYeti(34)`, `frames()` until `yetiThrowT > 0.55`; game camera (FOV ~69) |
| `09c_hard_snowball_marker.png` | Same run 12 frames later: Yeti ~31 m behind in the inset, landing marker still standing ahead (the script names this the in-flight frame; the ball itself is small at this distance) | 12 more frames; game camera |
| `10_finish.png` | Harbour finish from above the run-out: finish arch, rows of coloured waterfront houses, lighthouse, sea | `teleport(L − 260)`, `freeCam` 30 m up behind the finish line, FOV 56 |
| `10b_finish_ground.png` | Harbour finish at eye level beyond the line: houses, lamp posts, string lights, people | `freeCam` 3.2 m above the snow 18 m past the line, FOV 58 |
| `11_victory_trophy.png` | Victory cinematic, trophy hand-off on the harbour front (letterboxed) | `teleport(L − 50, 22)`, `autopilot`, `frames()` to cinematic 9.6 s |
| `11b_victory_celebration.png` | Victory cinematic, celebration beat: wooden hot tub on the quay with fire and figures, lighthouse behind | `frames()` to 13.4 s |
| `11c_victory_reveal.png` | Victory cinematic, closing shot from the sea back toward the cliff and harbour, title "You survived the mountain" | `frames()` to 19.5 s |

## Files — other resolutions

| File | What it shows | How |
|---|---|---|
| `01_menu_1366x768.png`, `01_menu_2560x1440.png` | As `01_menu.png` at that viewport | same script, `menu` |
| `02_summit_1366x768.png`, `02_summit_2560x1440.png` | As `02_summit.png` | same script, `summit` |
| `10_finish_1366x768.png`, `10_finish_2560x1440.png` | As `10_finish.png` | same script, `finish` |
| `10b_finish_ground_1366x768.png`, `10b_finish_ground_2560x1440.png` | As `10b_finish_ground.png` (extra; produced by the `finish` step) | same script, `finish` |

## Alpine baseline (`docs/reviews/biomes/alpine-baseline/`)

Same script, same build, `alpine classic:sprint`, 1920×1080, `all` (`manifest.json`, 4420 s, no
page errors). Files use the same names as above (no `04b`). Notes on what the shared script
produces for Alpine:

- `04_signature_hazard.png`: Alpine registers no hazard kinds, so the script frames a kicker.
- `05_material.png`: without a coast the material camera sits at the piste edge (trees in front).
- `06_long_distance.png`: the coast camera formula falls back to a point 1500 m beside the route;
  the frame shows a slope and sky.
- `09b`/`09c`: the throw predicate (`yetiThrowT > 0.55` with the Yeti within 45 m) was not met
  within 1500 frames (logged `throw false`); the frames show Hard-mode chase gameplay with a
  snowball impact burst around the skier and the Yeti ~95 m behind in the rear-view inset.
- `11c_victory_reveal.png`: at t = 19.5 s the Alpine victory has ended and the results panel is shown.
