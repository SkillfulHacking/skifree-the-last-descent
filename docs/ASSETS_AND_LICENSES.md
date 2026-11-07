# Asset & licence register

## Third-party code

| Package | Version | Licence | Used for |
|---|---|---|---|
| three | 0.187 | MIT | Rendering. Also its addons `Sky`, `BufferGeometryUtils` and `OrbitControls`, the last used only in the preview benches. |
| vite | 8.x | MIT | Dev server and bundler (build-time only). |
| typescript | 7.x | Apache-2.0 | Type checking (build-time only). |
| vitest | 5.x | MIT | Unit tests (dev only). |
| @playwright/test | 1.65 | Apache-2.0 | Browser tests (dev only). |

The production bundle ships only `three`, under the MIT licence.

## Art, animation, audio

**Every visual and audio asset is generated procedurally at runtime by original code in this
repository.** No external models, textures, HDRIs, fonts, sound files or music are downloaded or
bundled. This is deliberate: the development environment had no network access beyond package
registries, and it avoids every licensing question.

| Asset | Source |
|---|---|
| Terrain, snow, ice and rock materials | `src/world/course.ts`, `src/world/snowMaterial.ts` (noise functions and shader code) |
| Pines, rocks, logs, stumps | `src/world/props.ts` |
| Sky | three.js `Sky` addon (Preetham model), MIT |
| Skier model, rig and animation | `src/player/**` |
| Yeti model, shell fur and animation | `src/yeti/**` |
| Cave, warning sign, footprints | `src/world/Cave.ts` (canvas-drawn texture, original wording) |
| Resort, lodge, trophy, guests | `src/world/Resort.ts`, `src/world/resort/**` (canvas-drawn textures, original branding: "THE LAST LODGE", "THE LAST DESCENT") |
| All sound effects and music | `src/audio/**` (Web Audio synthesis, original compositions) |
| UI typography | System font stack (no web fonts) |

## Relationship to SkiFree

*SkiFree* (1991) was created by Chris Pirih. This project borrows the premise: a skier, obstacles,
and a Yeti that chases you. It uses none of the original's graphics, sprites, sounds, code or
character designs. "SkiFree — The Last Descent" is a working title; before any public or commercial
release, check whether the name can be used.
