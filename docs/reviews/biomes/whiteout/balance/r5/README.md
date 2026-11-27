# Round 5 balance: Hard ranges (W-094) and Normal pursuit (W-095)

Owner's decisions 1 and 2 (`round-5/OWNER_DECISIONS.md`) apply.

The engine was the full headless game (`src/game/simulate.ts`), with hazard streaming on.

Seeds:
- **Tuning:** `R5T-01…24`.
- **Validation:** `R5V-01…24`. These are fresh seeds, unused while tuning.

Data:
- `data/tuning/`: every candidate tried.
- `data/validate/`: the chosen settings.
- `data/before/`: round-4 settings on the same R5V seeds (via `tests/sim/tune.ts`).
- `data/w095_repro_*.jsonl`: the W-095 reproduction.

## What changed

The location's Yeti pace and environment are scoped per difficulty. Nothing reacts to how the player is skiing.

| Location | Normal | Hard | Mechanism |
|---|---|---|---|
| Alpine | unchanged (×1.05 location pace) | Yeti pace ×1.09 on Hard only | `BiomeTerrain.difficultyPace` (new), read through `yetiSpeedFor` |
| Fjord | unchanged | unchanged | explicit `difficultyPace: {}`, so it no longer inherits Alpine's |
| Whiteout | Yeti pace ×1.06 on Normal only | the storm, not the Yeti: hazard intensity 1.1 (was 0.8), building to ×1.5 between 3 and 8 km | `difficultyPace.normal`; `hazards.intensity.hard`; `hazards.builds` (new: fixed by position along the course) |

- **The global Yeti speed** (`YETI.baseSpeed`) and the catch-up rule are untouched. So are the hand-off physics.
- **Ceiling:** every pace stays under the documented +33% ceiling. `tests/unit/difficulty_pace.test.ts` pins the paces.

## Why longer courses came out easier

Sprint and Standard each have one encounter, chased to the finish:

- A winning expert's lead settles at about 85–120 m. The Yeti's catch-up pressure holds it there.
- Once it settles, a clean skier faces almost no risk per kilometre.
- The extra 7 km of Standard therefore added little risk.
- At 12 seeds per cell, "Standard above Sprint" (Whiteout reader 75% / 83%) was within sampling noise. Reviewer B's 40 seeds had Standard below Sprint.

**Fix: the weather builds down the mountain on Whiteout Hard.** Past 3 km the storm grows, so a long descent carries real risk per kilometre. The Sprint course (3 km) and the Yeti are untouched by it.

Why intensity, not headwind or a Hard pace:
- Headwind slows every skier uniformly. Above 0.0014 the Classic Hard Sprint course is lost.
- A Hard-only Yeti pace on Whiteout (×1.03 to ×1.05) also lost Classic Hard Sprint.
- Intensity adds risk per kilometre: stronger blizzard knocks and drift drag. It punishes mistakes rather than making a clean run impossible.

## Results on fresh seeds (24 per cell), before → after

Expert driver, frozen from round 4: progressive tuck, poles, Fjord reading; the Whiteout weather reader.

| | Hard Sprint | Hard Standard | Classic Hard (Sprint / Standard, closest gap) |
|---|---|---|---|
| Alpine | 88% → **83%** | 79% → **50%** | won 38 m / won 44 m |
| Fjord (unchanged) | – → 83% | – → 50% | won 7 m / won 36 m |
| Whiteout, weather reader | **100% → 79%** | 67% → **46%** | won 20 m / won 17 m |
| Whiteout, blind | 29% → 25% | 8% → 0% | lost / lost |

A second expert policy, binary tuck (XTUCK=0):

| | Hard Sprint | Hard Standard |
|---|---|---|
| Alpine | 58% | 8% |
| Fjord | 75% | 29% |
| Whiteout, weather reader | 71% | 25% |

**Against the owner's ranges** (Sprint 50–75%, Standard 25–50%, as objectives, not quotas):
- **Standard:** within the range for both expert policies everywhere except Alpine's binary-tuck driver (8%).
- **Sprint:** at or just above the top of the range for the progressive-tuck expert (79–83%). It is inside the range for binary tuck.
- **The two seed sets differ by about ±10 points:**
  - Alpine Hard Sprint is 58% on R5T and 83% on R5V.
  - The settings were not tuned further to these seeds.
- **Classic Hard:** an expert wins every course. Fjord Classic Hard Sprint (7 m) is unchanged from round 4 and still thin.

**Normal for the expert:** 24/24 everywhere, except Whiteout blind (87% / 62%) and Fjord Standard (23/24).

## Whiteout Normal pursuit (W-095)

**Reproduced on round-4 code** (`data/w095_repro_*.jsonl`, Classic + 8 seeds). A competent weather reader was caught 0/9 on both lengths. His closest gap was the starting gap: about 45 m, never closer.

**Full course, competent weather reader** (SLOPPY: one sloppy turn every 12 s, the rest expert), 24 fresh seeds:

| | Round 4 | Round 5 | Alpine, unchanged (reference) |
|---|---|---|---|
| Sprint: wins | 22/24 | 15/24 | 21/24 |
| Sprint: median closest gap | 43 m (the start gap) | 18 m | 40 m |
| Sprint: runs inside 45 m | 14/24 | 21/24 | 18/24 |
| Sprint: runs inside 25 m | 4/24 | 14/24 | 7/24 |
| Standard: wins | 23/24 | 14/24 | 14/24 |
| Standard: median closest gap | 43 m | 16 m | 12 m |
| Standard: runs inside 25 m | 1/24 | 14/24 | 14/24 |

**First 1.5 km of the chase, by behaviour** (`data/validate/tension.jsonl`, Classic + 8 fresh seeds):

| Behaviour | Caught | Closest gap |
|---|---|---|
| Clean skier | never | 45 m Sprint, 52 m Standard (median) |
| Late crash (20 s in) | 2/9, 2/9 | 25 m (round 4: 0/9, 43 m) |
| Early crash | 3/9, 1/9 | 18–19 m |
| Poor route | 8/9, 6/9 | – |
| Slow arrival | 0/9 | 32 m |

The light "competent" pattern does not close the gap inside the first 1.5 km on any location, Alpine included. Its pressure comes later in the run (the table above).

**Normal against Hard, competent skier:**
- Normal: Alpine 88% / 58%, Fjord 71% / 38%, Whiteout 62% / 56%.
- Hard: 1–12% Sprint and 0% Standard everywhere.

**The weather-reading advantage holds:**
- Normal: reader 100% / 100% against blind 87% / 62%.
- Hard: reader 79% / 46% against blind 25% / 0%.

## Limits

- These are model drivers, not people: three expert or competent policies plus the seven tension behaviours.
- The SLOPPY competent player is a fixed pattern.
- Human playtests would settle how the pursuit feels.
- Browser-to-simulator parity was measured in round 4 (4 of 5 pairs matched); it was not re-run this round.
