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

## Pass 2: licensed-asset investigation (2026-11-07)

The pass-2 brief asked us to investigate licensed assets (PBR textures, trees, characters, HDRIs) for
visual quality, without fabricating any licence. Findings:

- **Network:** only the npm/PyPI/GitHub package registries are reachable from the build machine.
  Asset sites (Poly Haven, ambientCG, Sketchfab, Quixel, etc.) are blocked, so nothing could be
  downloaded from them, and we did not try to route around the block.
- **npm:** `@pmndrs/assets` 1.7.0 (declared CC0) bundles a few Poly Haven HDRIs, Inter fonts,
  test models, and normal maps by "emmelleppi". We could not verify the upstream licence of those
  normal maps from the package alone. Nothing alpine is included (no snow/rock PBR sets, conifers
  or characters), and no other npm package offered alpine assets with a verifiable licence.
- **Decision:** stay fully procedural. Every visual improvement in pass 2 (cave geology, Yeti face
  and fur, trees, terrain shading, atmosphere) is original code in this repository. No third-party
  art is bundled, so no third-party art licence applies. If real scanned assets are wanted later,
  CC0 sources such as Poly Haven and ambientCG are good candidates, but each asset's page must be
  checked and recorded here before use.
