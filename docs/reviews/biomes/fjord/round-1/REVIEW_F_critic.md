# Fjord Coast, round 1: Reviewer F (Hostile Game Critic)

- **Reviewer:** F, Hostile Game Critic
- **Nature of review:** model-based reviewer (same model family as the developers; not external)
- **Build:** `f8519ca` (branch `pass4-fjord`). `git diff --stat f8519ca HEAD -- src` is empty, so the source I read matches the build in the screenshots.
- **Date:** 2026-11-10
- **Evidence used:** every 1920×1080 PNG in `round-1/`, compared with the matching shot in `alpine-baseline/`. I also read the source under `src/world/biomes/fjord/**`, `src/world/hazards/*`, `src/world/profile.ts` and `src/game/simulate.ts`. I ran one headless simulation script (`scratch/review-f/compare.test.ts`, results in `scratch/review-f/out.txt`). It covers 2 biomes × 5 seeds × 3 difficulties × 3 autopilot styles, Sprint length, and for Fjord on Normal it also re-runs each case with the environment switched off (`environment: null`).

## Verdict: FAIL

Fjord Coast has a real identity when you look at it from a cinematic or free camera. The sea-cliff wall in `06_long_distance.png`, the sea reveal in `11c_victory_reveal.png` and the menu preview all look good. As a game, though, it plays the same as Alpine. In my headless runs, all Fjord-specific physics together (the squalls, the scoured rock, the crosswind and the cornice) changed Sprint finish times by at most 0.9 s out of about 150–165 s, and did not change a single outcome. The classic Sprint has **one** sea squall in 3 km, and it can only affect you while you are in the air. From the gameplay camera the location is mostly a white slope with a thin strip of sea on the horizon (`09_pursuit.png`). The art up close is unfinished: the houses are untextured boxes with one window each, the basalt columns are flat-shaded prisms, the hot-tub quay is a plain brown plane, and there are hard-edged beige quads in the sky. The Yeti cave cinematic reuses the Alpine one shot for shot. None of my eight categories reaches 9/10, and most are well below it.

## Scores (critic's point of view)

| Category | Score | Justification |
|---|---:|---|
| Visual art direction | **5.5** | The wide shots are good: the stratified cliff in `06`, the sea reveal in `11c`, and the warm low sun on the menu. Up close it looks like programmer art: the box houses in `10_finish`, the flat prisms and toy boat in `07`, the brown-plane quay and sprite fire in `11b`. There are also hard-edged beige quads in the sky (`04b`, `06`) and ice chunks scattered evenly to the horizon in every sea shot. |
| Environmental uniqueness | **6.5** | With the HUD hidden you would recognise the location in free-cam and cinematic shots (sea, harbour, lighthouse). You often would not from the player camera (`09`, `09b`). The START arch, the hut and the fence posts in `02_summit` are identical to Alpine `02`. The cave rock in `07` is the Alpine mesh tinted beige. |
| Skiing and hazard mechanics | **4** | The hazards have no effect in play. Turning the whole Fjord environment off changes nothing beyond ±0.9 s (`out.txt`). The squall only acts on an airborne skier and pushes at most 2.5 m sideways (`hazards.ts:5–9`, `fjord.test.ts:236`). The rock patches are placed so they are never on the racing line (`hazards.ts:92–99`). Neither hazard can knock you down or create real risk. |
| Difficulty and fairness | **5** | It is fair, but it does not feel like a 2/5 location. Skilled and intermediate drivers win every Fjord Sprint, on every difficulty, with exactly the same times and minimum gaps (42–57 m) as on Relaxed, and their times are within a few seconds of Alpine's. The only difference is that careless drivers are caught on Fjord Relaxed (5/5 seeds), where on Alpine Relaxed they are caught on 3/5 and the other 2 time out. That gap comes from the course layout, not from the hazards: the no-environment runs give the same catch times. |
| Cinematics | **6** | The victory has real coastal ideas: a lighthouse trophy, a hot tub on the quay, and a reveal from the sea. But `11b` is the weakest frame in the whole evidence set, and the cave cinematic (`08` against Alpine `08`) has the same camera, pose and timing. The only change is a black slab blocking the left fifth of the frame. |
| Performance and stability | 7 (low confidence) | All manifests record `errors: []`. I cannot judge frame rate from SwiftShader captures, and that is outside my role. |
| Accessibility and controls | 7 (low confidence) | Controls are unchanged from Alpine. The caption "[heavy footsteps behind you]" appears in `09`. The windsock telegraph is visible in `04`, but it is small and placed beside the piste. |
| Overall player experience | **5** | Fjord is a nice backdrop for a run that plays like Alpine. The brief asks for "beautiful enough that players want to slow down and explore", but the gameplay view gives you nothing to slow down for, and the reward for exploring is two viewpoints per Sprint. |

## Defects

1. **Critical: the signature hazards make no difference to gameplay.**
   Evidence: `scratch/review-f/out.txt`. For Fjord on Normal, 5 seeds × 3 styles, runs with and without the environment end with the same outcome, crash count (0) and minimum gap in every case. Time differences range from 0.0 to 0.9 s. The classic Sprint places `gusts=1 rocks=14` (same file). The squall's effect only applies when `!grounded` (`hazards.ts:5–9, 54–60`). The rocks are placed beside the racing line and never on it (`hazards.ts:92–99`). The brief (§4) says a hazard must be "fairly balanced" and must produce decisions; neither hazard asks the player to decide anything.
   Fix: make the squall act on grounded skiers on exposed ridgeline and rim segments too: a modest lateral push that can be read from the windsock and steered against. Give it 3–5 placements per Sprint, including on the racing line. Put at least some scoured rock where the fastest line crosses it, so the player has to choose between the line and the speed loss. Then show a measurable time spread between a skier who reads the hazards and one who ignores them.

2. **Critical: biome difficulty 2/5 is not delivered.**
   Evidence: `out.txt`. Skilled and intermediate Fjord times are 148–164 s; Alpine's are 149–163 s. Fjord produces the same minimum gaps on Relaxed, Normal and Hard for competent drivers. The only harder result (careless drivers caught on Relaxed) also happens with the environment off, so it comes from the course layout. The brief (§2) says "Difficulty must emerge primarily from the environment and the decisions it forces".
   Fix: follows from defect 1. Add one environment-driven decision every 300–500 m (gust timing on a jump, choosing between ridgeline and rock, a narrow cornice line), tuned so an intermediate driver loses noticeably more time on Fjord than on Alpine.

3. **Major: hard-edged beige quads in the sky.**
   Evidence: `04b_hazard_rock.png`, a flat beige trapezoid above the horizon around (720–1070, 155–200). `06_long_distance.png`, a hard-edged beige rectangle around (1170–1405, 420–550). The colour matches the sun-haze tint. My best guess is that these are the camera-facing sea-mist sprites in `views/mist.ts`, rendering without their soft alpha falloff. If so, the "occasional sea mist" in the brief currently shows up as a rendering bug. It may be specific to SwiftShader, but it is in the evidence and has to be ruled out on a GPU.
   Fix: confirm what the object is and its alpha path. Clamp sprite edges so the alpha always reaches 0 at the edge of the quad, and recapture.

4. **Major: the finish buildings and props are placeholder art.**
   Evidence: in `10_finish.png` and `10b_finish_ground.png`, about 25 houses use the same untextured gabled box with a single white square window and no visible door, laid out in two copy-paste rows. The harbour ground is blotchy grey with hard-edged patches. In `11b_victory_celebration.png` the quay is an untextured brown plane, the fire is a flat orange sprite, the boat is a primitive hull and box, the cliff behind is a flat grey wall, and a rock floats in the sky at about (862, 150). A figure in the tub seems to clip through the tub wall around (990, 660). Compare Alpine `10` and `11`: a timber lodge with interior, a podium, branded banners and ski racks. The Fjord finish is clearly lower-fidelity than the location it is meant to outdo.
   Fix: give the houses varied facades, doors, windows, trim and docks on stilts. Model a real wooden quay and boardwalk with planks. Use a particle or mesh fire. Make the moored boats readable in the finish wide shot (none are visible in `10`). Fix the floating rock and the tub clipping.

5. **Major: the Yeti cave cinematic reuses Alpine's.**
   Evidence: `08_yeti_cinematic.png` and Alpine `08_yeti_cinematic.png` have the same camera, the same Yeti pose and frame position, and the same cave throat. The only difference is a dark untextured basalt slab with a net texture covering the left ~20% of frame. Brief §2: "A biome-appropriate cave and Yeti encounter".
   Fix: give the sea cave its own beat (spray or surf in the cave mouth, the Yeti climbing out over the beached boat or net, a camera set on the water side) and keep the dressing out of the lens.

6. **Major: the location's identity is barely visible from the gameplay camera.**
   Evidence: in `09_pursuit.png`, `09b` and `09c`, about 75% of the frame is featureless white snow and the sea is a thin band on the horizon. Alpine `09` actually looks richer (dense forest, valley walls). Players spend most of their time in this view.
   Fix: route more of the course along the rim so the sea and the cliff drop sit in the camera's lower third. Add dressing near the piste (cairns, wind-bent pines, rock outcrops, shelters) and widen the sea views.

7. **Major: the start area is reused from Alpine.**
   Evidence: `02_summit.png` against Alpine `02_summit.png`: the same START arch, the same brown hut with snowy roof, the same line of fence posts in the same arrangement. Brief §2: "A recognizable start and finish".
   Fix: build a coastal start, for example a wooden flag mast, a cairn gate, a red-painted shelter or a ridge-top lookout.

8. **Major: the sea-cave dressing is placeholder.**
   Evidence: in `07_yeti_cave.png` the basalt columns are untextured, flat-shaded hexagonal prisms. The fishing boat is a white wedge with a brown box cabin, sitting on snow with no water anywhere near (for a "sea cave"). An orange buoy appears to float in mid-air at about (308, 787). Loose hexagonal stones are scattered across the snow in front of it (`08b`).
   Fix: texture and bevel the columns, add water or tide ice at the mouth, put the boat on a slipway or on ice, and ground the buoys.

9. **Minor: the floating ice reads as confetti.**
   Evidence: in `02`, `03`, `04`, `05`, `06` and `11c`, white chunks are spread evenly to the horizon. It looks like Arctic pack ice in a "clear-sky Scandinavian fjord", and it hides the "distant islands" the brief asks for. The opposite shore of the fjord is missing in most gameplay-height shots: the horizon is open sea.
   Fix: cut the density sharply, cluster the chunks near the cliffs, and replace most of them with a few proper skerries and islands with snow caps.

10. **Minor: the cliff faces look stretched and have stuck-on boulders.**
    Evidence: the vertical streaks on the cliff in `06` and `11c`, and boulders sitting on the vertical face in `11c` (around (1735, 325) and (1710, 600)).
    Fix: use triplanar or vertical-UV rock on the wall, and keep scatter off faces steeper than about 60°.

11. **Minor: the victory trophy shot reuses the Alpine one.**
    Evidence: `11_victory_trophy.png` against Alpine `11`: the same arms-up pose and camera. The lighthouse trophy is a good idea, but the "fish-crate podium" in the beat list (`harbourVictory.ts:7`) is two small boxes behind the skier and does not read.
    Fix: frame the podium and harbour as the set, and vary the pose or camera.

Note: `harbourVictory.ts:3–5` describes a playful beat where the Yeti recoils from the fish racks. None of the captures shows it, so I cannot credit it. Capture it in round 2.

## What works

- `06_long_distance.png` and `11c_victory_reveal.png` are the strongest images in the project so far: they have scale, a recognisable silhouette and good haze.
- The menu preview (`01_menu.png`) immediately tells you "coastal".
- The victory concept (lighthouse trophy, badestamp hot tub, reveal from the sea) is on-brief, and so is the coastal audio design (`audio/coastal.ts`: surf, gulls, gust cues).
- The systems underneath are well engineered: deterministic placement, streaming, a cornice guard so you cannot ski off the cliff, viewpoints that stay optional, and `ridgeline` added as an alternate-line type (`biome.ts`, `altTypes`). The problems are tuning and art, not architecture.

## Brief compliance (Fjord section, from the critic's point of view)

| Bullet | Status | Evidence |
|---|---|---|
| Enormous coastal cliffs | done (wide shots) / partial (gameplay) | `06`, `11c`; barely visible in `09` |
| Cold blue ocean water | done | `01`, `03`, `05` |
| Distant islands | partial | mostly ice chunks; real islands only in `11c` |
| Snowy mountain peaks | done | `06`, `11c` |
| Clear skies, excellent visibility | done | all exterior shots |
| Rocky coastal outcrops | partial | the rim rocks in `05` are generic |
| Sparse evergreen forests at elevation | done | `02`, `03` |
| Colourful shoreline architecture | partial | present but box placeholders (`10`, `10b`) |
| Occasional sea mist | partial or defective | the probable mist sprites show as hard quads (`04b`, `06`) |
| Dramatic views across the fjord | partial | cinematic cameras only |
| Large open downhill runs | done | `02`, `03`, `09` (too empty, if anything) |
| Scenic branching paths / ridgeline shortcuts | partial | code supports it (`altTypes` includes `ridgeline`); not shown in evidence |
| Gentle coastal crosswinds | done but ineffective | airborne-only, ≤2.5 m drift; 0 outcome change |
| Exposed coastal rocks | done but ineffective | never on the racing line; ≤0.9 s effect |
| Small terrain gaps and jumps | partial | uses the existing kickers/cliffs; nothing Fjord-specific |
| Optional exploration bonuses | done | 2 lookouts on the classic Sprint, `ScenicLocationDiscovered`, Scenic Route achievement |
| Harbour finish (boardwalk, colourful buildings, fishing boats, distant ships, ocean horizon) | partial | houses and ocean present; boats and ships not readable in `10`; boardwalk not visible |
| Victory: ocean pull-back reveal | done | `11c` |
| Coastal trophy plus playful après | partial | lighthouse trophy (`11`); hot tub (`11b`) is low-fidelity |
| Not the Alpine resort under different lighting | done (finish) / missing (start, cave cinematic) | `02` and `08` match Alpine |
| Difficulty from environment, not from the Yeti | missing in practice | `out.txt`: the environment changes no outcome |
