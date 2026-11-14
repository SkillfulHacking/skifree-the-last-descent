# Fjord Coast, round 2: Reviewer F (Hostile Game Critic)

- **Reviewer:** F, Hostile Game Critic
- **Nature of review:** model-based reviewer (same model family as the developers; not external)
- **Build:** `aec1812` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`)
- **Date:** 2026-11-10
- **Evidence used:**
  - Every 1920×1080 PNG in `round-2/`, compared side by side with the matching `alpine-baseline/` shot, and with `round-1/` where it helped.
  - `res-1366/02_summit.png`. `res-2560/` did not exist when I finished.
  - Source: `src/world/biomes/fjord/**`, `src/world/coast.ts`, `tests/sim/readerDriver.ts`.
  - My own headless runs in `scratch/review-f-r2/`:
    - `onoff.test.ts` → `onoff.jsonl`, summarised by `table.py`;
    - `place.test.ts` → `place.txt`;
    - `enc.test.ts` → `enc.txt`.
  - I used my round-1 seeds (FJ1, FJ2, FJ3, R4, R5) on purpose, **not** the developers' RB1–RB5, so the balance check does not depend on their seed choice.
  - `npx vitest run tests/unit/fjord_gameplay.test.ts tests/unit/fjord_art.test.ts`: 15/15 pass.
- The remediation notes were read as claims. Every status below comes from my own screenshots, code reading or runs.

## Verdict: FAIL

Round 2 is a real improvement, and in places a large one.
- The sky quads are gone.
- The harbour finish now reads as a Norwegian harbour village instead of a box-house placeholder.
- The victory has its own beats: the stockfish gag, the harbourmaster, the cannonball, and the reveal from the sea.
- From the chase camera you now see the sea and islands at the end of the corridor.
- The hazards now change times and sometimes outcomes.

It is still not 9/10 content, and the problems are central:

1. **The signature mechanic is still minor.**
   - Squall lanes appear 0–3 times per Sprint. R4 has none. The classic Sprint has 2.
   - Ignoring all Fjord hazards costs a competent skier 1.4–2.5 s out of about 147 s (1–1.7 %).
   - It never changes a competent skier's outcome or minimum Yeti gap.
2. **The difficulty progression is inverted on independent seeds.** Fjord (2/5) is easier and faster than Alpine (1/5) for every driver able to finish:
   - Hard, intermediate driver: Alpine 0/5, Fjord 4/5.
   - Relaxed, average driver: Alpine 0/5, Fjord 3/5.
   - Skilled drivers are 9–20 s faster on Fjord.
3. **The cave encounter is still the Alpine one shot for shot** (`08` vs Alpine `08`). The basalt dressing still looks like rows of bollards on a snow slope with no sea in sight.

None of my eight categories reaches 9/10.

## Scores (critic's point of view)

| Category | R1 | **R2** | Justification |
|---|---:|---:|---|
| Visual art direction | 5.5 | **6.5** | The finish (`10`, `10b`, `11b`) and the reveal (`11i`, `11c`) are now attractive and coherent. The cave set (`07`, `08b`) is still clean flat-shaded prisms, a flat beige disc for a hull, and floats lying on snow. The islands are one repeated snow-capped pebble shape spread over the whole sea (`02`, `03`, `05`). The inland wall is faceted and smeared in `11i`/`11c` (right half). |
| Environmental uniqueness | 6.5 | **7** | With the HUD hidden you would now know where you are in `09`, `09b`, `10`, `10b` and `11*`. Not in `08`, which matches Alpine `08` in camera, pose and framing. The start in `02` keeps Alpine's arch + hut + fence layout; only the props changed. |
| Skiing and hazard mechanics | 4 | **5.5** | The environment now measurably matters (+1.4–2.5 s for hazard-blind skiers; 3 outcome flips in 60 Relaxed/Normal runs, all among weak drivers). But the decision is "drift 2.5 m left when the windsock flaps", 0–3 times a run. The reader driver gains only 0.1–0.9 s over environment-off. The spine shortcut saves ~1 s (dev's own figure, `REMEDIATION_gameplay.md` §3 B5). It works, but it is not interesting yet. |
| Difficulty and fairness | 5 | **5** | It is fair: there are no knockdowns, the cornice recovery exists, and viewpoints are out of the chases. But on independent seeds the 2/5 location is easier than the 1/5 location. Seed-to-seed variance (Alpine Hard intermediate: devs 4/5, mine 0/5) is far larger than the whole Fjord environment effect (about 2 s), so "Fjord is harder because of its environment" is not shown. |
| Cinematics | 6 | **6.5** | The victory is much better: the gag (`11e`/`11f`), the reverse-angle trophy (`11`), the après on the pier (`11b`) and the reveal (`11i`, `11c`). It is held back by the trophy floating clear of the presenter's hands and cropped by the letterbox (`11g`), a splash that is a flat grey ring decal (`11h`), and an unchanged cave cinematic (`08`, `08b`). |
| Performance and stability | 7 | 7 (low confidence) | `manifest.json` has `errors: []`. The scenery is now time-sliced, per the developers. I cannot judge frame rate from SwiftShader. |
| Accessibility and controls | 7 | 7.5 (low confidence) | Squall, rock, surf and viewpoint captions were added (`REMEDIATION_gameplay.md` E2). The snowball glint and landing column read in `09b`/`09c`. Controls are unchanged. |
| Overall player experience | 5 | **6** | It is now a pleasant destination to finish and to watch the ending of. The 140-odd seconds in between still play almost like Alpine: same Yeti, same gap profile, very little Fjord-specific decision-making. "Scenic exploration" amounts to **one** viewpoint per Sprint and per Standard, in the first ~200–500 m (`enc.txt`). |

## My measurements (independent seeds)

### Headless chase runs

`scratch/review-f-r2/onoff.jsonl`. Sprint, seeds FJ1, FJ2, FJ3, R4, R5. "Reader" is `tests/sim/readerDriver.ts`.

| diff | driver | Alpine | Fjord env on | Fjord env off | on − off (s, per seed) | outcome flips (off → on) |
|---|---|---|---|---|---|---|
| Relaxed | reader | 5/5 (156.0 s) | 5/5 (143.8 s) | 5/5 (143.4 s) | 0.13–0.88 | none |
| Relaxed | skilled | 5/5 (156.7 s) | 5/5 (147.6 s) | 5/5 (145.6 s) | 1.50–2.53 | none |
| Relaxed | intermediate | 5/5 (158.5 s) | 5/5 (148.8 s) | 5/5 (147.0 s) | 1.41–2.39 | none |
| Relaxed | average | **0/5** | **3/5** | 5/5 | 1.5–2.2 | FJ1, R5 win → caught |
| Relaxed | cautious | 0/5 | 0/5 | 1/5 | – | R4 win → caught |
| Normal | reader / skilled / intermediate | same as Relaxed | same | same | same | none |
| Normal | average | 0/5 | 0/5 | 1/5 | – | R4 win → caught |
| Hard | reader | 5/5 (164.0 s) | 5/5 (150.6 s) | 5/5 | ≤ 5.8 | none |
| Hard | skilled | 5/5 (165.2 s) | 5/5 (153.8 s) | 5/5 | −1.1 to +5.3 | none |
| Hard | intermediate | **0/5** | **4/5** | 4/5 | – | FJ1 caught → win; FJ3 win → caught |
| Hard | average | 0/5 (2 timeouts) | 0/5 | 0/5 | – | – |

Competent drivers keep the same minimum Yeti gap with the environment on and off (e.g. FJ2 50.7/50.7 m, R5 43.1/43.1 m).

### Hazard placement

`scratch/review-f-r2/place.txt`:

| Course | Squall lanes | Rock patches (on the line) |
|---|---:|---:|
| Classic Sprint | 2 (z 728 and 1390) | 18 (6) |
| FJ1 | 3 | 3 on the line |
| FJ2 | 1 | 2 on the line |
| R4 | **0** | 4 on the line |
| Classic Standard | 14 | 63 (15) |

### Viewpoints

`scratch/review-f-r2/enc.txt`:

| Course | Viewpoints |
|---|---|
| Classic Sprint | 1, at z = 158 |
| Classic Standard | 1, at z = 482 |
| Expedition | 8 |

## Round-1 defects (my area): status

| # | R1 defect | Status | My evidence |
|---|---|---|---|
| 1 | CRITICAL: signature hazards make no difference | **Partially fixed** (now Major, D1 below) | Effect went from 0.0–0.9 s to 1.4–2.5 s for the hazard-blind, with 3 flips among weak drivers. Still 0 effect on competent outcomes and gaps, and 0–3 lanes per Sprint. |
| 2 | CRITICAL: biome difficulty 2/5 not delivered | **Not fixed** on independent seeds (D2) | Table above: Fjord ≥ Alpine success for every driver; competent drivers 9–20 s faster on Fjord. |
| 3 | Major: hard-edged beige quads in the sky | **Fixed** | `06_long_distance.png` and `04b_hazard_rock.png` have clean skies. The root cause and fix are plausible (`REMEDIATION_art.md` §1). |
| 4 | Major: placeholder finish buildings and props | **Mostly fixed** (residual Minor D9) | `10`, `10b`, `11b`: varied houses with doors, windows and porches, a cobbled quay, plank boardwalk, piers, boats, and ships on the horizon. Residuals: the houses stand in two regimented arcs in `10`; the waterfront facades in `11h` are a flat wall of black windows with no doors. |
| 5 | Major: cave cinematic reuses Alpine's | **Not fixed** (D3) | `08` vs Alpine `08`: identical camera, Yeti pose and frame position. The only additions are a blue ice puddle and a recolour. `08b` vs Alpine `08b`: same skier-back composition. The gulls, spray and icicle beats are not in any capture. |
| 6 | Major: identity barely visible from the gameplay camera | **Partially fixed** (D6) | `09`, `09b`: sea and islands now close the corridor (vs round-1 `09`, where there was only haze). The lower ~55 % of the frame is still plain white piste, and nothing along the piste says "coast" except the odd rock skin. |
| 7 | Major: start area reused from Alpine | **Partially fixed** (Minor D10) | `02` / `wip/compare_02_summit.png`: red board, grey stone hut and windsock replace the props, but the layout (arch centre, hut right, two fence lines) is the Alpine one. From the evidence camera it still reads as Alpine's start, re-skinned. |
| 8 | Major: sea-cave dressing is placeholder | **Partially fixed** (D4) | `07`: the columns now stand on the ground, but they are untextured, perfectly regular prisms with uniform caps, arranged like bollard rows. The "overturned clinker hull" is a flat beige lens with two sticks at (180–520, 890–975). Floats on a line lie on snow. There is no water at the "sea" cave. |
| 9 | Minor: ice reads as confetti | **Partially fixed** (D8) | `02`, `03`, `05`, `01`: fewer pieces, but each island is the same smooth snow-capped dumpling, evenly spread to the horizon. They read as pebbles, not skerries. `10` and `11c` show real island silhouettes, so the far LOD is better than the near one. |
| 10 | Minor: stretched cliffs and stuck boulders | **Partially fixed** | `06`: the long vertical streaking is still visible across the face. `11i`/`11c` (right half): the inland wall is smeared, with sawtooth ridges. No boulders stuck on the face are visible. |
| 11 | Minor: trophy shot reuses Alpine's | **Fixed**, with a new defect (D5) | `11` is a new composition (harbourmaster foreground, Yeti at the rack behind), but see `11g`. The R1 note "Yeti fish-rack beat not captured" is now captured (`11e`, `11f`). |

## Defects

1. **Major: the signature mechanic is real but too slight to define the location.**
   - Evidence:
     - Squall lanes per Sprint: classic 2, FJ1 3, FJ2 1, R4 **0** (`place.txt`). A whole Fjord Sprint can have no grounded squall at all.
     - The mechanic's total cost to a hazard-blind competent skier is 1.4–2.5 s per Sprint (`onoff.jsonl`).
     - Reading the hazards saves only 0.1–0.9 s over having no hazards, and never changes a competent outcome or minimum gap.
     - The read itself is a ~2.5 m pre-steer (`readerDriver.ts:66–75`), against a 3 m/s slip (`hazards.ts` `SQUALL.slip`).
     - The reader also looks ahead to the *future* phase of the squall (`readerDriver.ts:66–70`), which a player cannot fully see. Its advantage is an upper bound.
   - Why it matters: brief §4 says a hazard must be "fairly balanced", and §2 says difficulty comes from "the decisions it forces". One or two decisions in 150 s does not make a destination.
   - Fix:
     - Guarantee a minimum of 3–4 squall lanes per Sprint (floor the exposure roll per km, not only per band).
     - Chain a lane into a rock or ridge choice so the decision compounds.
     - Raise the stakes from "lose 2 m/s" to "lose the line": e.g. the gust pushes you onto a slower, deeper-snow lane for several seconds, or toward a spine you then cannot take.
     - Target: hazard-blind vs reader ≥ 5 s per Sprint on every seed.

2. **Critical: the difficulty progression is inverted on independent seeds.**
   - Evidence (table above, my seeds):

     | Difficulty, driver | Alpine | Fjord |
     |---|---|---|
     | Hard, intermediate | 0/5 | 4/5 |
     | Relaxed, average | 0/5 | 3/5 |
     | Reader, all difficulties (mean time) | 156.0 s (R/N), 164.1 s (Hard) | 143.8 s (R/N), 150.6 s (Hard): 12–14 s faster |

     On the developers' seeds (`REMEDIATION_gameplay.md` §2) it is the other way round: Hard intermediate 3/5 vs 4/5. So whether Fjord is harder than Alpine depends on the seed. The environment contributes about 2 s; the course layout contributes ±15 s and whole outcomes.
   - Why it matters: brief §2 asks for "a gradual progression of environmental difficulty".
   - Fix:
     - Measure balance over ≥ 20 seeds per biome, not 5, and report the distributions.
     - Make Fjord's extra difficulty come from the environment, as defect 1 describes.
     - Check that the steeper `minSlope: 14` / segment mix (`biome.ts`) is not simply making Fjord the faster course. Fjord times are consistently 8–20 s quicker than Alpine for the same driver.

3. **Major: the cave encounter is still the Alpine cinematic.**
   - Evidence: `08_yeti_cinematic.png` vs Alpine `08_yeti_cinematic.png`: same camera, Yeti pose, scale and position in frame, and cave throat behind. `08b` vs Alpine `08b`: same over-the-skier composition and cave in the centre.
   - Why it matters: the Fjord hook (`seaCaveCinematic.ts`: gulls, spray, icicles) adds particles to the same shots. It does not change the beat. Brief §2 asks for "a biome-appropriate cave and Yeti encounter".
   - Fix: give the Fjord at least one shot that does not exist in Alpine, for example:
     - the Yeti silhouetted against surf inside the cave mouth;
     - an angle from below the rim looking up past the sea;
     - the Yeti tearing out through the net.

     Put the cave on the sea side (the developers' own request R4) so water is in frame. Capture the gull and spray beat in the evidence.

4. **Major: the sea-cave dressing still looks like a blockout.**
   - Evidence, `07_yeti_cave.png`:
     - The columns are smooth, identical-section prisms with equal snow caps, laid out in tidy rows (left 0–540, right 1400–1920).
     - The "hull" is a flat beige disc with two sticks at (180–520, 890–975).
     - Floats lie on bare snow at (85–360, 965–1050).
     - The cave rock is mid-brown with pale blotches. That is not the "near-black basalt" the notes claim (`REMEDIATION_art.md` §6).
   - Fix:
     - Vary the column heights and break their tops: tilted, broken, fallen drums.
     - Model the hull as an actual inverted boat silhouette, at least 2 m high.
     - Darken the rock as specified.
     - Add tide ice or water.

5. **Major: the trophy floats above the presenter's hands.**
   - Evidence: `11g_victory_present.png`. The presenter's gloves are at ear height (around (840, 510) and (1030, 510)). The lighthouse trophy's base is at about y = 380–480, clear above them, and its top is cut off by the letterbox.
   - Cause: the code lerps the trophy to `hand + 0.12 m` (`harbourVictory.ts:251–253`). The hand pose does not reach up to it.
   - This is the presentation money shot.
   - Fix: parent the trophy to the hand bone with a grip offset, lower the camera or use a wider shot so the whole trophy is in frame, and use a "holding out" arm pose.

6. **Major: the gameplay view is still mostly blank snow.**
   - Evidence: `09_pursuit.png`, `09b`, `09c`. The sea now closes the corridor, which is a real gain, but the lower ~55 % of the frame is untextured white piste. Alpine `09` frames the same piste with dense forest on both walls.
   - The rim outcrops and cairns from `REMEDIATION_art.md` §4 are not visible in any chase capture. The developers list routing nearer the rim as open (R1).
   - Fix: as in round 1, route along the rim on straights (R1). Add near-piste coastal dressing at chase distance: cairns, wind-bent pines, drift fences, rime-crusted rocks.

7. **Minor: the `04b` evidence shot does not show its subject.**
   - Evidence: `04b_hazard_rock.png` is labelled "scoured-rock: exposed rock beside the racing line", but no rock patch is in frame.
   - The rock skin can be judged only from the far shot `04` (around (190–540, 720–760)) and `03` (around (1000–1400, 750–880)). There it reads as grey blotches with specks, not as wind-scoured rock.
   - Fix: re-aim the 04b camera at the patch and recapture.

8. **Minor: the islands are copy-paste pebbles.**
   - Evidence: `02`, `03`, `05`, `01`. A dozen near-identical lens-shaped domes with snow tops, all with similar width-to-height ratios, evenly spaced.
   - Fix: vary the forms (some high and craggy, some low skerries, some long whalebacks), cluster them more tightly, and leave open water lanes.

9. **Minor: the waterfront is still regimented.**
   - Evidence:
     - `10`: houses stand in two near-perfect arcs of uniform spacing.
     - `11h`: the waterfront is one continuous wall of facades with black window holes and no doors.
     - `11b`/`11h`: the shoreline band between water and buildings is grey blotchy smear (the R1 "camouflage", now only at the edge).
     - `11h`: the pier ladder floats clear of the pier deck.
   - Fix: stagger setbacks and heights, add doors and gables facing the water, and clean up the shore band shader.

10. **Minor: the start keeps the Alpine layout.**
    - Evidence: `02` vs Alpine `02`: gate at the centre, hut to the right, two fence lines diverging downhill.
    - Fix: change the composition, not only the props. For example, put the mast and cairn on a rise on the sea side, run the rope line along the rim, and make the hut a lookout facing the sea.

11. **Minor: the cannonball splash is a flat decal.**
    - Evidence: in `11h_victory_splash.png` the splash is one opaque grey `RingGeometry` (`harbour.ts:655, 822–824`). The point spray above it is barely visible.
    - Fix: add a crown splash mesh or bright particles and a short white-water patch, and fade the ring faster.

12. **Minor: doc drift.**
    - Evidence: `docs/PROGRESSION.md:53` still documents viewpoint ids as `lookout-<n>`. The code now uses `vp-<seed>-<len>-<z>` (`REMEDIATION_gameplay.md` B7).
    - Fix: update the doc.

## Answers to the brief's critic questions

- **Is it fun?** It is pleasant. The run itself is still Alpine's chase with a different horizon.
- **Meaningfully different from Alpine?**
  - Finish and victory: yes.
  - Start: only cosmetically.
  - Cave encounter: no.
  - Moment-to-moment skiing: barely (D1).
- **Beautiful?** In the wide and finish shots, yes (`06`, `10`, `11b`, `11i`, `11c`). Up close at the cave, no.
- **Shortcuts or unfinished visual work?** Yes: the cave dressing (D4), the floating trophy (D5), the splash decal (D11) and the pebble islands (D8).
- **Is the signature mechanic interesting?** Not yet (D1).
- **Would I replay it?** For the victory sequence once or twice. Nothing in the run changes from one replay to the next enough to bring me back. With one early viewpoint per Sprint, there is little to explore.
- **Does the difficulty progression make sense?** No, on independent seeds (D2).
- **Is the Yeti still a memorable threat?** No more than in Alpine. Competent drivers keep a 43–57 m minimum gap whether the environment is on or off. The new memorable Yeti moment is the comic stockfish gag (`11f`), which works.
- **Commercial quality?** The finish and victory are close to that. The cave and the core loop are not.

## What works

- **The sky artefact is truly fixed** (`06`). The far-plane diagnosis in `REMEDIATION_art.md` §1 is convincing.
- **The harbour finish** (`10`, `10b`) is the best Fjord-specific asset: a coloured-house village street, a cobbled quay, a finish arch reading "MÅL · FINISH", and ships on the horizon.
- **The victory sequence** now has a story:
  - the Yeti gags on stockfish (`11e`, `11f`, with caption);
  - the harbourmaster presents the trophy (`11`);
  - the pier hot tub, sauna and fire (`11b`);
  - a long pull-back from the sea that ends on the summit, with the title landing after the move (`11i`, `11c`).

  This is what round 1 lacked.
- **The hazards now matter.** Changes go in the right direction, with no knockdowns. Viewpoints are out of the chases, and the cornice out-of-bounds recovery exists (unit tests pass).
- **Snowball readability on Hard** is much better (`09b`, `09c`: an orange glint in the rear view and a landing column ahead).

## Brief compliance (Fjord section, critic's point of view)

| Bullet | Status | Evidence |
|---|---|---|
| Enormous coastal cliffs | done | `06`, `11i`, `11c` |
| Cold blue ocean water | done | `01`, `03`, `05` |
| Distant islands | partial | island silhouettes in `10`/`11c`; pebble scatter near the rim (D8) |
| Snowy mountain peaks | done | `04`, `11` |
| Clear skies, excellent visibility | done | all exterior shots |
| Rocky coastal outcrops | partial | not visible in chase frames (D6) |
| Sparse evergreen forests at elevation | done | `02`, `03`, `09` |
| Colourful shoreline architecture | done (minor residuals) | `10`, `10b`, `11b` |
| Occasional sea mist near the water | partial | faint haze in `11i`; no distinct mist banks visible in my frames |
| Dramatic views across the fjord | done | `06`, `11c`; now partly in gameplay (`09`) |
| Large open downhill runs | done | `09` |
| Scenic branching paths / ridgeline shortcuts | partial | spines exist (`place.txt`: 636–1004 m of alternate line per Sprint) but save ~1 s (developers' B5); not shown in any capture |
| Gentle coastal crosswinds | done but slight | 0–3 lanes per Sprint; 1.4–2.5 s total effect (D1) |
| Exposed coastal rocks | done | 2–6 on the line per Sprint, costing 2.0–2.6 m/s through the core (developers' figure, consistent with my on/off deltas) |
| Small terrain gaps and jumps | partial | gap gullies exist (developers: 0–2 per Standard course); none captured |
| Optional exploration bonuses, not mandatory | done but thin | no longer in chases; **one** viewpoint per Sprint/Standard (`enc.txt`) |
| Harbour finish (boardwalk, buildings, boats, ships, horizon) | done | `10`, `10b`, `11b` |
| Victory: ocean pull-back reveal | done | `11i`, `11c` |
| Coastal trophy plus playful après | done, with defects | `11`, `11b`; floating trophy `11g` (D5), splash `11h` (D11) |
| Not the Alpine resort under different lighting | done (finish) / missing (cave cinematic) / partial (start) | `08` = Alpine `08`; `02` layout = Alpine |
| Biome-appropriate cave and Yeti encounter (§2) | partial | dressing only (D3, D4) |
| Difficulty from the environment, gradual progression (§2) | missing | inverted on independent seeds (D2) |
