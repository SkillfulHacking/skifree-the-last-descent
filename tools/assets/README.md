# Asset pipeline (build time only)

Every distributable art file — the textures in `src/world/art/textures/` and the meshes in
`src/world/art/models/` — is listed in [`manifest.json`](manifest.json) with its source, licence,
recipe, size and SHA-256. The game never contacts Poly Haven or any other asset site at runtime: the
outputs are committed, bundled by Vite, and served from the game's own origin.

## From a clean checkout

```sh
npm ci                                       # includes the pinned build tools: meshoptimizer, sharp
python3 -m pip install -r tools/assets/requirements.txt   # numpy, Pillow, OpenEXR (texture conversion)
npm run assets:check     # download the originals, rebuild everything, require byte-identical outputs
```

| Command | Network | What it does |
|---|---|---|
| `npm run assets:verify` | none (CI) | committed files match the manifest; no unlisted file in the asset folders; licence metadata present and verified |
| `npm run assets:fetch` | Poly Haven | downloads the originals listed in the manifest into `.asset-cache/` (git-ignored), md5-checked against the API |
| `npm run assets:build` | none | regenerates every output in place from `.asset-cache/` |
| `npm run assets:check` | Poly Haven | fetch + build into a temporary directory; fails unless every output is byte-identical to the committed file |
| `npm run assets:licenses` | Poly Haven | checks the manifest's authors against Poly Haven's `/info` records and writes the `verified` date |
| `npm run check:dist` | none (CI) | after `npm run build`: every bundled asset loads under the Pages base path and is the manifest's bytes |

API requests send the User-Agent `SkiFree-TheLastDescent-dev/1.0 (build-time asset pipeline)`. If an
upstream file changes, `fetch` stops on the md5 mismatch instead of silently producing new outputs.

## Recipes

| Output | Recipe |
|---|---|
| `<set>_albedo.webp`, `<set>_nhr.webp` from a Poly Haven texture set | `convert_textures.py <set> <tmp> 1024` (4K JPG/PNG/EXR → 1K WebP intermediates) → `pack_scans.py <tmp> <set> <out>` (albedo sRGB + cavity AO from displacement in A; normal X/Y OpenGL, height, roughness) |
| `<scan>.skm` from a Poly Haven model | `scan_to_skm.mjs <scan>_1k.gltf <out> 5000` (meshoptimizer: weld, simplify to 5,000 triangles, 16-bit quantised positions; SKM1 format; the scan's own textures are not used) |
| `basalt_albedo.webp`, `basalt_nhr.webp` | `bake_procedural.mjs <out> 1024` with `SETS=basalt` (original code, deterministic) |

Pinned tool versions: meshoptimizer 0.22.0, sharp 0.35.5 (npm, exact); numpy 2.5.3, Pillow 12.3.0,
OpenEXR 3.5.3 (`requirements.txt`). WebP encoding is deterministic for a given libwebp; a different
libwebp may change bytes (then `assets:check` says so).

## Adding an asset

1. Add a source to `manifest.json` (Poly Haven: slug, page, authors from `/info/{slug}`, the files with
   their md5 from `/files/{slug}`; licence `CC0-1.0`), and its outputs with a recipe.
2. `npm run assets:fetch && npm run assets:build`, then put the new outputs' `sha256`/`bytes` in the
   manifest, run `npm run assets:licenses`, and `npm run assets:verify`.
3. Record it in `docs/ASSETS_AND_LICENSES.md`.
