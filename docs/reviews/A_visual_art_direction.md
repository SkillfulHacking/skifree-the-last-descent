# Review A — AAA Visual Art Direction

> Internal multi-agent review — separate agent instance of the same model family; not an external/independent human approval.

## What was inspected
- In-game captures (`docs/screenshots/evidence/`): `00_menu`, `01_gameplay_start`, `01_gameplay_z520`, `02_gameplay_sign`, `cave_mouth_close`, `cave_c01/c04/c06/c08/c09/c10/c12`, `cave_chase_8s`, `cave_chase_close`, `cave_d2`, `cave_d4`, `end_v01/v04/v05/v06/v07/v08`, `end_chase_close_avoid`.
- Bench renders (`docs/screenshots/`): `skier_neutral_threequarter`, `skier_closeup_head`, `skier_carveL_front`, `skier_crash_tumble_front`, `yeti_face_front`, `yeti_stand_threequarter`, `yeti_gallop_side`, `yeti_sculpt_nofur`, `resort_guests_faces`.
- Code: `src/world/snowMaterial.ts`, `src/world/Environment.ts`, `src/world/course.ts` (valley profile), `src/world/props.ts`, `src/world/Cave.ts` (grep level).

## Evidence observed
- **Terrain reads as a single procedural trench.** `end_v08_15_5` (aerial) shows the whole course as a symmetric V-channel with uniform-density tree scatter on both walls; no ridgelines, couloirs, cliff bands, benches or tree-line gradient. `course.ts:236` builds the walls from one Gaussian-ish profile + ridged noise, which is exactly what it looks like. `01_gameplay_*`, `02_gameplay_sign` and every chase frame repeat the same composition: flat white floor, two grey walls, sky slot.
- **Valley walls are grey and streaky.** `01_gameplay_start` (right wall), `00_menu`: mid-grey, smeared directional texture, neither snow nor rock. Rock threshold in `snowMaterial.ts` (`rockEdge≈0.30`) plus dark rock albedo greys entire 30–45° faces instead of exposing discrete outcrops.
- **Piste is featureless.** Floor is a near-constant 0.85 grey-white with faint banding; no visible micro-relief, sparkle, or sun/shade modelling. Lighting on the floor is effectively flat (`01_gameplay_z520`, `cave_chase_8s`). Tree shadows only within the 130 m shadow frustum; distant slopes have none.
- **Trees** are stacked open cones with white caps (`end_v06`, `cave_d2`): clean and readable, but identical silhouettes, no dead/young/clustered variation, no ground contact (no snow wells), and hard edge shimmer at distance.
- **Cave** (`cave_c01`, `cave_mouth_close`, `cave_c06`, `cave_c08`): hood is a heap of smooth faceted grey "potato" boulders; in `cave_c01` several boulders visibly float against a flat cliff face with gaps. Interior (`cave_c04`) is a dark flat-shaded tube; icicles are uniform cones. Claw marks are four black bars that read as UI glyphs.
- **Yeti**: sculpt (`yeti_sculpt_nofur`) has good gorilla-like mass; card/shell fur (`yeti_stand_threequarter`, `cave_d2`) gives a credible shaggy silhouette. But the face is a hard-edged grey latex patch pasted onto fur (`yeti_face_front`), eyes catch light asymmetrically (one glowing, one dead socket in `cave_c09`), and the roar close-up is mush. Triangle count 1.4–1.6 M on bench.
- **Yeti absent from the chase.** `cave_chase_8s` (75 m), `cave_chase_close` (22 m), `end_chase_close_avoid` (17 m): the threat is never on screen; only a HUD bar and the word "RUN." convey danger. This is the largest presentation failure.
- **Skier**: tidy stylised model (`skier_neutral_threequarter`, `skier_closeup_head`) — readable pose language, decent puffer banding. Weaknesses: no face/skin anywhere (balaclava + goggles cylinder), plastic uniform jacket shading, no fabric breakup; skis bend like noodles in `skier_crash_tumble_front`. In gameplay the camera holds him tiny and centred (`01_gameplay_z520`), so carve/tuck poses barely register.
- **Resort** (`end_v06`, `resort_guests_faces`): warmest, most finished area — lodge glow, string lights. Guests are chibi/Roblox-adjacent with paddle hands; style clash with the more realistic Yeti.
- **Cinematic issues**: `end_v05` shows a white debug-like ring around the skier; `end_v07` title text overlaps the FINISH banner and the trophy floats beside the skier's hand (code reportedly fixes framing — not captured). `00_menu` clips "Best score" at the left edge.

## Critical defects
1. Yeti not visible during chase gameplay — no threat imagery.
2. Terrain macro-form is a single repeated V-trench; immediately reads procedural.
3. Floating/ungrounded cave boulders and a faceted placeholder-looking cave hood in the hero reveal.

## Major weaknesses
- Flat, low-contrast lighting on snow; no warm-sun/cold-shade separation that defines winter art.
- Grey streaky walls; no rock outcrops/cliff bands.
- Yeti face mask boundary and eye inconsistency.
- Uniform tree density and silhouettes; no forest edge structure.
- Character style inconsistency (chibi guests vs. semi-real Yeti vs. stylised skier).

## Minor issues
- Debug-looking ring (`end_v05`), title/banner overlap (`end_v07`), menu text clip.
- Claw marks read as UI bars. Icicles uniform.
- Ski bend in crash pose. Yeti triangle budget excessive for a browser title.

## Recommended corrections (impact per effort)
1. **Chase camera keeps Yeti in frame.** During chase, bias camera yaw/height so it looks back-over-shoulder when Yeti < 40 m (blend 0.3–0.5 rad), or add a periodic 1.2 s "glance-back" shot; add a rim light (cold blue point light, intensity ~2, distance 15) parented to the Yeti so it pops against snow.
2. **Lighting contrast.** Sun 3.1 → 4.2 with colour (1.0, 0.86, 0.70); hemi 0.4 → 0.25 with sky (0.42, 0.56, 0.95); environmentIntensity 0.45 → 0.3; enable ACES tone mapping at exposure ~0.9. Add a cheap terrain "fake AO/shade" term: darken + blue-shift by `(1 - dot(n, sunDir))` (≈0.25 strength) in `snowMaterial.ts`.
3. **Snow surface response.** Add a view-dependent glitter term (hash of `floor(wp*40)` thresholded at 0.995, × `pow(NdotH,…)`, faded by distance), a fresnel brightening toward grazing angles, and increase bump `amp` for the piste 0.035 → 0.06 with lower-frequency sastrugi; raise snow albedo to ~0.93.
4. **Break the trench.** In `course.ts`, modulate wall steepness and offset per side with low-frequency noise (asymmetric valley), insert 2–3 rock cliff bands (`smoothstep` steps on height × ridged mask), side gullies via domain-warped ridged noise, and a tree-density mask (clusters, gaps, avalanche paths, sparser with altitude).
5. **Rock outcrops not grey walls.** Push `rockEdge` to ~0.42 with stronger noise (±0.12) so rock appears in patches; lighten rock albedo toward (0.35, 0.33, 0.32) with warmer tone; sample triplanar instead of single-plane projection to remove streaks.
6. **Ground the cave.** Raycast each hood boulder down/into the cliff and embed 20–30 % of its radius; add a large displaced backing mesh behind the hood; vary icicle length (0.3–2.2×) and taper; replace claw bars with recessed tapered gouges (bevelled boxes with dark interior).
7. **Yeti face.** Feather the face/fur boundary with fur cards that overlap the mask edge; add a brow ridge and deeper eye sockets; make both eyes share one emissive material (intensity ~0.6). Drop shell layers or card count to bring it under ~300 k tris.
8. **Tree variety.** 4–6 silhouette variants (lean, broken top, sparse, young), random scale 0.6–1.4, a snow well disc at each base, and alpha-to-coverage for distant LOD.
9. **Cleanup.** Remove/soften the stop ring, move victory title above the banner, fix menu clip, clamp ski bend in crash.

## Scores
| Area | Score | Gate | Result |
|---|---|---|---|
| Mountain visuals | 5.0 / 10 | 9.0 | **FAIL** |
| Player character / animation | 6.5 / 10 | 8.5 | **FAIL** |
| Yeti visual design / animation | 6.5 / 10 | 9.0 | **FAIL** |

Overall: competent, coherent stylised indie look; not a modern AAA-adjacent 3D title. The resort is the strongest area; the mountain — the bulk of screen time — is the weakest.

## Unverified evidence
- No motion capture viewed; animation judged from stills only (no foot-slide, blending or secondary-motion verification).
- Fixes claimed after capture (cave darkening, close-chase camera, trophy framing) not seen in images.
- SwiftShader capture may understate AA, shadow softness and shading precision; GPU rendering not observed.
- Yeti grab/leap/eat strips and most resort benches not individually inspected.
