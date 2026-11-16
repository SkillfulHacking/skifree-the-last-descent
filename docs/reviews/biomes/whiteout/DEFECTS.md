# Whiteout Ridge — defect tracker (full production, Pass 5 final brief)

Severity: **C** critical · **M** major · **m** minor. Status: OPEN · CLAIMED (fixed in code, awaiting
independent verification on a frozen candidate) · VERIFIED (confirmed by an independent reviewer on the
named build) · ACCEPTED (documented known issue). The verification column is filled only from independent
review or committed tests, never from the developer's own judgement of a render.

Sources: the slice self-review (`slice/SLICE_REVIEW.md`), the baseline capture of the slice build
(`baseline/`, build `aca6d44`, harness `tools/biome_evidence.mjs`, SwiftShader 1280×720), the original
spec (Pass 4 brief §"Location 3 — Whiteout Ridge", Pass 5 brief Phase 4) and the full-production brief.

## Acceptance criteria common to every visual item
- Judged from **real browser renders of the integrated build** (`tools/whiteout_evidence.mjs`), from the
  player's third-person camera wherever the item is visible in play, on **fresh seeds** not used in tuning.
- No floating meshes, no visible seams, no clipping, no hard billboard edges; works at 1366×768, 1920×1080
  and 2560×1440.
- Reviewers A (art) / C (cinematic) / F (critic) must not list it again on the candidate build.

| ID | Sev | Area | Defect | Source | Acceptance criteria | Repair | Verification | Status |
|---|---|---|---|---|---|---|---|---|
| W-001 | M | terrain | The course still reads as a valley: a single huge snow wall on one side, a flat fog plane on the other | slice #1; baseline 02, 03, 09 | From the gameplay camera, the ground visibly falls away on the drop side (flank, valley below) and the other side is a broken rocky crest with sky above it, on ≥ 3 fresh seeds; A/F say "ridge, not valley". Alpine/Fjord heights bit-identical (golden tests) | b1691d7 (`terrain.ridge`) | unit: whiteout_ridge (cross-section, rim clear of piste) | CLAIMED |
| W-002 | M | terrain/physics | No cornices; the drop edge is undefined; no rule for skiing off a ridge | brief §2 | Corniced rim mesh seated in the snow (never floating: unit), breaks in places; rim wands readable in fog; a skier who goes over is returned to the piste with a cue, never stranded; autopilot never triggers it; no new launches/pins | b1691d7 (cornice, wands, RIDGE_GUARD) | unit: whiteout_ridge (cornice bedding, rim guard, autopilot 0 relocations) | CLAIMED |
| W-003 | M | art | Rock reads as scattered cubes/pebbles; no wind-carved formations | baseline 02–04 | Crest tors, rim bands and flank buttresses from scanned CC0 rock, bedded (unit); the obstacle rocks on the piste read as rock, not cubes | 55dd257 (ridgeRocks.ts) | unit: whiteout_ridge (rock bedding, off-piste) | CLAIMED (tors) / OPEN (obstacle rocks) |
| W-004 | M | art | Far ranges render as a sawtooth silhouette | baseline 04, 07, 09 (top edge) | No regular zig-zag crest line in any capture | — | — | OPEN |
| W-005 | M | art | Regular diagonal drift stripes across the snow (obvious procedural pattern) | baseline 02, 03 | No regular stripe pattern at 50–500 m in third-person shots | — | — | OPEN |
| W-006 | M | weather | The storm is a fog slider and a grey dome: no moving cloud, no approaching front | slice #4; brief §3 | A storm wall stands on the windward horizon ≥ 20 s before every front (unit) and visibly crosses the ridges; the cloud deck drifts with the wind and its shadows move over the terrain; clearing tears the deck open | b1691d7 (sky.ts) | unit: whiteout_ridge (storm wall timing) | CLAIMED |
| W-007 | M | weather | No directional blowing snow, no ground spindrift | brief §3 | Wind-aligned streaks in a storm, low spindrift and surface snow snakes in the gameplay camera; counts bounded per quality preset | b1691d7 (blowingSnow.ts, `sf_spindrift`) | — | CLAIMED |
| W-008 | M | hazard art | The wind-drift hazard reads as a smooth grey berm; a translucent striped "ghost wall" in the chase frame | baseline 04, 09 | Drifts read as wind-built snow (sastrugi, crest, lee) with no translucent planes, in third person | — | — | OPEN |
| W-009 | M | Yeti | White Yeti on white storm; the distance-based darkening may read as an artificial colour change | slice #2; brief §5 | Readable at 20–60 m in a storm from the chase camera and the rear view, without an obvious colour shift as he closes in | — | — | OPEN (needs storm-chase evidence) |
| W-010 | M | cave | The encounter is the generic Alpine cave in clear weather | brief §6; baseline 07, 08 | Whiteout dressing (rimed granite, ice glaze, snow off the brow, spindrift), storm in the encounter, no clipping or grounding change, cinematic verified frame by frame on Sprint, Standard, Endurance, Expedition and Endless caves | 2d8f8d6 (stormCave.ts) | — | CLAIMED (Sprint only so far) |
| W-011 | M | finish | Rescue station is a box blockout; no people; victory beat order differs from the brief; lantern beat never captured | slice; brief §7 | Rebuilt station (architecture, snow load, equipment, searchlight, rescuers); 7 beats in order; lantern beat captured frame-accurately; no missing props, clipping or broken transitions | 22566b3 | — | CLAIMED |
| W-012 | M | weather | Fronts on a near-regular ~90 s cycle forever (a metronome on long runs) | brief §8 | ≥ 3 front types per hour of play, spacing coefficient of variation > 0.25 (unit) | 2d8f8d6 (FRONT_TYPES) | unit: whiteout (metronome test) | CLAIMED |
| W-013 | M | evidence | The generic harness's long-distance shot is under the terrain for Whiteout | baseline 06 | A Whiteout capture plan with weather phases, vistas, cave beats, storm chase, Hard fog, victory beats | tools/whiteout_evidence.mjs | — | CLAIMED |
| W-014 | M | gameplay | The value of reading the weather is unmeasured (sheltered vs exposed, wait vs enter, brake before low visibility) | brief §4 | Headless A/B on fresh seeds: an informed driver beats a weather-blind one by a measurable margin with no extra crashes; per-decision breakdown | — | — | OPEN |
| W-015 | M | difficulty | Difficulty ladder unmeasured after the ridge change (Alpine → Fjord → Whiteout; Relaxed/Normal/Hard distinct; Normal not an automatic win; Hard skilled can win) | brief §4–5 | Measured on fresh seeds per difficulty and length | — | — | OPEN |
| W-016 | M | course | All lengths (Sprint → Endless), refuges, caves and finish valid with the ridge; Endless memory flat; Daily reproducible | brief §8 | Headless runs of every length; Endless heap flat over 40 km; Daily/seed reproducibility tests | — | — | OPEN |
| W-017 | M | perf | No measurements of the weather systems' cost vs Alpine/Fjord | brief §12 | CPU frame-time p50/p95/p99, streaming spikes, draw calls, particles; GPU stated as unmeasurable here | — | — | OPEN |
| W-018 | M | tests | No Whiteout browser tests | brief §11 | Playwright specs covering selection, storms, drifts, Hard snowballs in fog, cave, rescue arrival, victory | — | — | OPEN |
| W-019 | M | start | The Alpine start hut and gate arch are reused at the summit | baseline 02 | A Whiteout start (storm-hut / rescue-cache look) | — | — | OPEN |
| W-020 | m | refuge | Refuges reuse the Alpine ski-patrol cabin ("Storm hut") | spec ("Whiteout: illuminated rescue stations") | An illuminated rescue-station refuge | — | — | OPEN |
| W-021 | m | audio | Weather intensity audio unreviewed (wind by storm phase, blizzard roar, shelter calm) | brief §3 | Audio reviewer notes; captions for fronts already exist | — | — | OPEN |
| W-022 | m | Hard | The baseline harness saw no snowball throw on its Hard pass | baseline 09b | A throw and its landing ring captured in fog | — | — | OPEN |
