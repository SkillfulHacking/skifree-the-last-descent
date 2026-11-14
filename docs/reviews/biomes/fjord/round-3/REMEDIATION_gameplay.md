# Fjord Coast, round 3: gameplay, terrain, tech and QA remediation

- **Scope:** reviewers B, D, E and F (mechanics) from round 2, and the art developer's terrain
  requests R1, R3, R4, R5 (`round-2/REMEDIATION_art.md`). Art, cinematics and the art-owned view
  files are handled on `pass4-fjord-art`.
- **Branch:** `pass4-fjord`, from `0d6180b`. Commits: `e4ca1c3`, `5e0319e`, `929cb4c`, `43f5283`,
  `ec49d47`, `04888e0`, `b6c7666` and the commit that adds this document and the balance data
  (`balance_r3.jsonl`: 1,056 runs on R3V; `balance_r3_sprint_pool.jsonl`).
- **Alpine:** unchanged. Every new knob is optional and Fjord-only; the golden-height tests in
  `biome.test.ts` pass and the Alpine rows in the tables below are the same simulation as before.
- **Checks:** `npx tsc --noEmit` clean; `npx vitest run` 17 files, 271 tests pass (see §8).
- **Method:** headless (Node + Vitest). Everything is measured on seeds that did not exist in round 2:
  - `T1`–`T10`: tuning seeds (I tuned on these);
  - `R3H1`–`R3H8`: first held-out set — used for **one** retune after it showed the Sprint ladder
    was not robust (§2.3); reported as such;
  - `R3V1`–`R3V8`: final validation set, never used for tuning. **The committed balance table is on
    these.**
- **Timing caveat:** Node main-thread CPU on a shared 2-CPU machine (a Playwright capture job ran
  most of the time). Not frame times.

## 1. Summary of what changed

| # | Finding | Change | Before (round 2) → after (round 3), fresh seeds |
|---|---|---|---|
| B N1, F2 | Fjord (2/5) easier than Alpine (1/5) | Terrain to Alpine parity + environment carries the difference; hazard intensity by game difficulty (Yeti untouched) | see §2 |
| F1, B4 | Signature mechanic slight; 0-lane Sprints | Lanes planned per ~1 km with a floor; bigger, longer squalls with a gust drag; jump squalls with a landing rock | lanes per Sprint **0–3 → 4–7**; env cost blind skilled vs reader: §2 |
| B N3 | Airborne squall negligible | Direct airborne push (`airPushX`) over squall jumps, and a landing rock | landing drift median **0.28 m → ~2.6 m** (1.1–5.6 m) |
| E1 | `lookouts()` stopped after the first cave on small queries | finite courses look at all encounters; Endless resumes | streamed Endurance **1 of 3 → all**; walk-in-40 m-windows and reverse-band tests |
| B N2, E2 | One viewpoint per Sprint/Standard | chase-side viewpoints beside the line where the rim is close, ≤ ~0.3 s detour | Sprint **1 → 1–4 (mean 2.5)**, Standard **1 → 2–9 (mean 5.9)** |
| B5, N3 | Spines on 8/22 ridgelines; gaps never in Sprint, no risk | spines on ridgeline + cliffside, bowed to the open side, fast snow; gap 9.5–11.5 m with style points and pole markers | spines usable on **41/41** exposed segments; Sprint gaps **0/8 → 5/8 courses**; falling in below ~18 m/s untucked |
| B N4 | way round a rock runs into boulders | rock edge (not centre) keeps 8.5 m from the line on coasts | min edge-to-way-round clearance ≥ 2.5 m by construction (test) |
| R1 | sea a thin strip in gameplay | rim follows the racing line on open stretches; flatter sea-side cross-section; lower berm | route→rim median **105 m → 59–61 m** |
| R3 | far-field faceting on the walls | coastal far tiles beside the corridor at 32 m (welded edges) | 64 → 32 m within \|x\| ≤ 3 km |
| R4 | cave not by the sea | Fjord caves on the sea side, rim 72 m behind the cliff base | all Fjord caves side −1 (test) |
| R5 | quay far from the finish | `quayZ` 190 → 120 | |
| D new 1 | rock views 12–53 ms in one frame | views built on a 2 ms/frame budget; ground grid; preallocated merge | rock view CPU per view under load: p50 3.5 ms (D: ~20 ms median wall-clock); one view per frame at least, not a band |
| D new 2 | sea-cave dressing in one frame | `CavePresentation.dressSteps` sliced hook; `dress` gets its own frame | hook for the art developer (§5) |
| D new 5 | harbour/start preset scaling | `StartDressing` gets `{ quality }`; finish builder already had it | plumbing |
| D new 6 | shelter build 9–31 ms | sliced `CoastalShelter` + `RefugeDefinition.buildSteps` | whole p50 17.8 ms → slices p50 1.2 ms (max 24 ms: one `house()`) |
| D new 7 | rear-view water slots | arms within the far plane ahead, then within the rear camera, then the rest | test every 97 m on Expedition |
| D new 8 | snowball glint compiled mid-chase | created at session start and compiled by App | |
| D new 9 | coastal shader full cost on low | low-preset variant + shore noise only near the water | own program key |
| E3 | rock caption hides squall warnings | caption priorities and per-kind throttles | |
| E4 | faint labels | rear-view label on a dark pill; multiplier larger, outlined | |
| E5 | gully untelegraphed | gap-marker poles and pennants (cosmetic hazard view) | |
| E6 | e2e result line, forced clicks | real clicks with transitions disabled; result line §8 | |

## 2. Difficulty ladder (B N1, F2)

### 2.1 What was wrong
Round 2's terrain (`minSlope 14`, highspeed-heavy mix, swing 0.8) made the Fjord the faster course,
so the environment's few seconds could not make it harder. Round-3 baseline on my tuning seeds
confirmed it (Fjord competent 145.0 s vs Alpine 152.4 s per Sprint; Standard 457 vs 483 s).

### 2.2 Changes
- **Terrain to parity** (`fjord/biome.ts`): `slopeScale 0.92`, `minSlope 11`, `swingScale 1`, a
  segment mix much closer to Alpine's (ridgeline still the most common exposed type), run-in 8°.
  Measured route gradient on R3H seeds: Sprint 14.8° (Alpine 14.8°), Standard 15.8° (16.5°),
  Endurance 15.5° (16.2°). No-input start stalls (E's `start.test.ts`, 30 seeds): Fjord **1/30**,
  Alpine 2/30 (round 2: 0/30 with a 9.5° run-in; I traded one stall for less free speed).
- **The environment does the rest** (`fjord/hazards.ts`):
  - squall lanes planned per group of 4 bands (~1 km): every band whose exposure roll comes up,
    then the most exposed remaining spots until there are **3 per group**; radius 26 m; cycle
    dormant 2.4 / telegraph 1.3 / active 2.6 / recovery 0.9 s; grounded side-slip 3.6 m/s and a
    **gust drag** (0.006 v² at the peak) that everyone pays — the decision is how to cross;
  - every lane has its lee rock planned with it (round 2 lost some at band edges);
  - jump squalls (70 % of kickers and gap take-offs) push an airborne skier onshore (5 m/s²) onto a
    **landing rock** placed where a skier who took off along the line comes down, a few metres onshore;
  - rock on the line 0.55 → 0.7 per band.
- **Hazard intensity by game difficulty** (`HazardSetup.intensity`, `BiomeEnvironment(…, { difficulty })`):
  Relaxed 0.25, Normal 1, Hard 1.0. The layout is identical on every difficulty (course codes
  describe one course); only how hard squalls push/drag and rock drags changes. The Yeti is not touched.
- `simulate.ts` and the World pass the difficulty; the harness passes it too.

### 2.3 Process (honest record)
1. Tuned on `T1`–`T10` (Sprint) / `T1`–`T6` (Standard).
2. First held-out check on `R3H1`–`R3H8`: Standard was clearly harder, but **Sprint was not**
   (Normal competent 158.2 → 157.4 s; Hard 15 vs 17 wins). Per-seed Sprint times differ by up to
   ±15 s between the two locations' courses — far more than the environment — so one retune
   (bigger, longer squalls with the gust drag; lee rock 3.5 m onshore) was made with R3H in view.
3. Final validation on `R3V1`–`R3V8`, below. No tuning after it.

### 2.4 Final table (R3V1–R3V8, never used for tuning)

#### sprint — 8 seeds (R3V1, R3V2, R3V3, R3V4, R3V5, R3V6, R3V7, R3V8)

Cells: wins/runs · mean winning time · mean minimum Yeti gap in the chase (m).

| location | difficulty | env | reader | skilled | intermediate | average | cautious | careless |
|---|---|---|---|---|---|---|---|---|
| alpine | relaxed | on | 8/8 · 158.4 s · gap 47.1 | 8/8 · 159.7 s · gap 47.1 | 8/8 · 160.6 s · gap 47.1 | 0/8 · gap 2.7 | 0/8 · gap 2.7 | 0/8 · gap 2.8 |
| fjord | relaxed | on | 8/8 · 153.8 s · gap 46.6 | 8/8 · 154.3 s · gap 46.5 | 8/8 · 154.7 s · gap 46.5 | 2/8 · 204.4 s · gap 10.8 | 0/8 · gap 2.7 | 0/8 · gap 2.9 |
| fjord | relaxed | off | 8/8 · 151.8 s · gap 46.7 | 8/8 · 152.7 s · gap 46.7 | 8/8 · 153.2 s · gap 46.7 | 2/8 · 203.7 s · gap 11.5 | 1/8 · 217.0 s · gap 3.1 | 0/8 · gap 2.9 |
| alpine | normal | on | 8/8 · 158.4 s · gap 47.1 | 8/8 · 159.7 s · gap 47.1 | 8/8 · 160.6 s · gap 47.1 | 0/8 · gap 2.8 | 0/8 · gap 2.8 | 0/8 · gap 2.8 |
| fjord | normal | on | 8/8 · 155.4 s · gap 46.6 | 8/8 · 159.8 s · gap 44.3 | 8/8 · 160.0 s · gap 44.4 | 0/8 · gap 2.8 | 0/8 · gap 2.8 | 0/8 · gap 2.8 |
| fjord | normal | off | 8/8 · 151.8 s · gap 46.7 | 8/8 · 152.7 s · gap 46.7 | 8/8 · 153.2 s · gap 46.7 | 0/8 · gap 2.7 | 0/8 · gap 2.8 | 0/8 · gap 2.8 |
| alpine | hard | on | 7/8 · 166.1 s · gap 35.1 | 6/8 · 165.2 s · gap 35.0 | 1/8 · 175.8 s · gap 5.1 | 0/8 · gap 2.8 | 0/8 · gap 2.8 | 0/8 · gap 2.8 |
| fjord | hard | on | 6/8 · 165.1 s · gap 27.1 | 6/8 · 166.7 s · gap 32.1 | 1/8 · 170.4 s · gap 6.7 | 0/8 · gap 2.8 | 0/8 · gap 2.8 | 0/8 · gap 2.8 |

Ladder (environment on): wins, mean minimum gap, and mean time on the seeds both locations won.

| difficulty | group | Alpine wins | Fjord wins | Alpine gap | Fjord gap | paired-won time Alpine → Fjord |
|---|---|---|---|---|---|---|
| relaxed | competent (reader, skilled, intermediate) | 24/24 | 24/24 | 47.1 | 46.5 | 159.6 → 154.3 s (24) |
| relaxed | weaker (average, cautious) | 0/16 | 2/16 | 2.7 | 6.8 | – |
| normal | competent (reader, skilled, intermediate) | 24/24 | 24/24 | 47.1 | 45.1 | 159.6 → 158.4 s (24) |
| normal | weaker (average, cautious) | 0/16 | 0/16 | 2.8 | 2.8 | – |
| hard | competent (reader, skilled, intermediate) | 14/24 | 13/24 | 25.1 | 21.9 | 164.6 → 168.6 s (10) |
| hard | weaker (average, cautious) | 0/16 | 0/16 | 2.8 | 2.8 | – |

Fjord environment on − off (same seed and difficulty; Δt over runs both won; flips = outcome changes off → on):

| driver | pairs won | mean Δt (s) | min Δt | max Δt | win→caught | caught→win |
|---|---|---|---|---|---|---|
| reader | 16 | 2.8 | -0.7 | 5.2 | 0 | 0 |
| skilled | 16 | 4.4 | 0.9 | 13.0 | 0 | 0 |
| intermediate | 16 | 4.2 | 0.8 | 13.0 | 0 | 0 |
| average | 2 | 0.7 | 0.5 | 0.8 | 0 | 0 |
| cautious | 0 | – | – | – | 1 | 0 |
| careless | 0 | – | – | – | 0 | 0 |

#### standard — 8 seeds (R3V1, R3V2, R3V3, R3V4, R3V5, R3V6, R3V7, R3V8)

Cells: wins/runs · mean winning time · mean minimum Yeti gap in the chase (m).

| location | difficulty | env | reader | skilled | intermediate | average | cautious | careless |
|---|---|---|---|---|---|---|---|---|
| alpine | relaxed | on | 8/8 · 474.4 s · gap 48.2 | 8/8 · 479.6 s · gap 48.2 | 8/8 · 484.9 s · gap 48.1 | 0/8 · gap 2.7 | 0/8 · gap 2.7 | 0/8 · gap 2.8 |
| fjord | relaxed | on | 8/8 · 478.7 s · gap 50.3 | 8/8 · 483.7 s · gap 50.2 | 8/8 · 485.7 s · gap 50.2 | 0/8 · gap 2.8 | 0/8 · gap 2.7 | 0/8 · gap 2.8 |
| fjord | relaxed | off | 8/8 · 475.6 s · gap 50.4 | 8/8 · 479.4 s · gap 50.4 | 8/8 · 481.8 s · gap 50.4 | 0/8 · gap 2.8 | 0/8 · gap 2.8 | 0/8 · gap 2.8 |
| alpine | normal | on | 8/8 · 474.4 s · gap 48.2 | 8/8 · 479.6 s · gap 48.2 | 8/8 · 484.9 s · gap 48.1 | 0/8 · gap 2.7 | 0/8 · gap 2.8 | 0/8 · gap 2.9 |
| fjord | normal | on | 8/8 · 485.1 s · gap 50.1 | 8/8 · 502.7 s · gap 49.7 | 8/8 · 505.2 s · gap 49.6 | 0/8 · gap 2.8 | 0/8 · gap 2.8 | 0/8 · gap 2.8 |
| fjord | normal | off | 8/8 · 475.6 s · gap 50.4 | 8/8 · 479.4 s · gap 50.4 | 8/8 · 481.8 s · gap 50.4 | 0/8 · gap 2.8 | 0/8 · gap 2.8 | 0/8 · gap 2.8 |
| alpine | hard | on | 4/8 · 501.5 s · gap 21.1 | 3/8 · 501.8 s · gap 15.3 | 0/8 · gap 2.7 | 0/8 · gap 2.8 | 0/8 · gap 2.9 | 0/8 · gap 2.8 |
| fjord | hard | on | 8/8 · 516.5 s · gap 33.3 | 4/8 · 524.3 s · gap 17.9 | 0/8 · gap 2.8 | 0/8 · gap 2.8 | 0/8 · gap 2.8 | 0/8 · gap 2.8 |

Ladder (environment on): wins, mean minimum gap, and mean time on the seeds both locations won.

| difficulty | group | Alpine wins | Fjord wins | Alpine gap | Fjord gap | paired-won time Alpine → Fjord |
|---|---|---|---|---|---|---|
| relaxed | competent (reader, skilled, intermediate) | 24/24 | 24/24 | 48.2 | 50.2 | 479.6 → 482.7 s (24) |
| relaxed | weaker (average, cautious) | 0/16 | 0/16 | 2.7 | 2.7 | – |
| normal | competent (reader, skilled, intermediate) | 24/24 | 24/24 | 48.2 | 49.8 | 479.6 → 497.7 s (24) |
| normal | weaker (average, cautious) | 0/16 | 0/16 | 2.7 | 2.8 | – |
| hard | competent (reader, skilled, intermediate) | 7/24 | 12/24 | 13.0 | 18.0 | 503.2 → 524.4 s (5) |
| hard | weaker (average, cautious) | 0/16 | 0/16 | 2.8 | 2.8 | – |

Fjord environment on − off (same seed and difficulty; Δt over runs both won; flips = outcome changes off → on):

| driver | pairs won | mean Δt (s) | min Δt | max Δt | win→caught | caught→win |
|---|---|---|---|---|---|---|
| reader | 16 | 6.3 | 0.7 | 14.1 | 0 | 0 |
| skilled | 16 | 13.8 | 2.3 | 31.1 | 0 | 0 |
| intermediate | 16 | 13.6 | 2.4 | 28.8 | 0 | 0 |
| average | 0 | – | – | – | 0 | 0 |
| cautious | 0 | – | – | – | 0 | 0 |
| careless | 0 | – | – | – | 0 | 0 |

#### endurance — 8 seeds (R3V1, R3V2, R3V3, R3V4, R3V5, R3V6, R3V7, R3V8)

Cells: wins/runs · mean winning time · mean minimum Yeti gap in the chase (m).

| location | difficulty | env | reader | skilled | intermediate | average | cautious | careless |
|---|---|---|---|---|---|---|---|---|
| alpine | relaxed | on | 8/8 · 960.1 s · gap 47.3 | 8/8 · 969.0 s · gap 47.4 | 8/8 · 979.0 s · gap 47.3 | 0/8 · gap 2.7 | 0/8 · gap 2.7 | 0/8 · gap 2.8 |
| fjord | relaxed | on | 8/8 · 975.3 s · gap 46.2 | 8/8 · 983.1 s · gap 47.4 | 8/8 · 988.3 s · gap 47.3 | 0/8 · gap 2.7 | 0/8 · gap 2.8 | 0/8 · gap 2.8 |
| alpine | normal | on | 8/8 · 960.1 s · gap 47.3 | 8/8 · 969.0 s · gap 47.4 | 8/8 · 979.0 s · gap 47.3 | 0/8 · gap 2.7 | 0/8 · gap 2.7 | 0/8 · gap 2.8 |
| fjord | normal | on | 8/8 · 990.5 s · gap 43.0 | 8/8 · 1024.8 s · gap 42.3 | 8/8 · 1025.5 s · gap 45.1 | 0/8 · gap 2.7 | 0/8 · gap 2.8 | 0/8 · gap 2.8 |
| alpine | hard | on | 6/8 · 1014.1 s · gap 34.6 | 6/8 · 1023.8 s · gap 23.6 | 0/8 · gap 2.7 | 0/8 · gap 2.8 | 0/8 · gap 2.8 | 0/8 · gap 2.8 |
| fjord | hard | on | 4/8 · 1055.9 s · gap 12.4 | 4/8 · 1078.4 s · gap 13.9 | 0/8 · gap 2.7 | 0/8 · gap 2.8 | 0/8 · gap 2.8 | 0/8 · gap 2.8 |

Ladder (environment on): wins, mean minimum gap, and mean time on the seeds both locations won.

| difficulty | group | Alpine wins | Fjord wins | Alpine gap | Fjord gap | paired-won time Alpine → Fjord |
|---|---|---|---|---|---|---|
| relaxed | competent (reader, skilled, intermediate) | 24/24 | 24/24 | 47.3 | 47.0 | 969.4 → 982.2 s (24) |
| relaxed | weaker (average, cautious) | 0/16 | 0/16 | 2.7 | 2.7 | – |
| normal | competent (reader, skilled, intermediate) | 24/24 | 24/24 | 47.3 | 43.4 | 969.4 → 1013.6 s (24) |
| normal | weaker (average, cautious) | 0/16 | 0/16 | 2.7 | 2.8 | – |
| hard | competent (reader, skilled, intermediate) | 12/24 | 8/24 | 20.3 | 9.7 | 1014.5 → 1064.1 s (7) |
| hard | weaker (average, cautious) | 0/16 | 0/16 | 2.8 | 2.8 | – |

Crash reasons (all runs): {"fjord: hard landing":5,"fjord: tripped on a log":2,"alpine: hard landing":2}; runs: 1056

#### Sprint pooled over 26 seeds (T1–T10, R3H1–R3H8, R3V1–R3V8), final code, environment on

Wins (Alpine / Fjord) and mean time over the seeds both locations won. The T and R3H seeds were used
for tuning, so this is supporting evidence only; it is here because single 8-seed Sprint sets flip
with the luck of the course draw (per seed the two locations' courses differ by up to ±15 s).
Raw: `round-3/balance_r3_sprint_pool.jsonl`.

| difficulty | driver | wins A / F | time A → F (both won) |
|---|---|---|---|
| relaxed | reader | 26 / 26 | 155.1 → 154.0 s (−0.7 %) |
| relaxed | skilled | 26 / 26 | 156.2 → 154.9 s (−0.9 %) |
| relaxed | intermediate | 26 / 26 | 157.1 → 155.3 s (−1.1 %) |
| relaxed | average | 6 / 7 | – |
| normal | reader | 26 / 26 | 155.1 → 155.8 s (+0.4 %) |
| normal | skilled | 26 / 26 | 156.2 → 160.4 s (+2.7 %) |
| normal | intermediate | 26 / 26 | 157.1 → 160.7 s (+2.2 %) |
| normal | average | 1 / 0 | – |
| hard | reader | 23 / 21 | 161.7 → 164.2 s (+1.5 %) |
| hard | skilled | 22 / 21 | 162.1 → 168.8 s (+4.1 %) |
| hard | intermediate | 6 / 6 | – |


Raw runs: `round-3/balance_r3.jsonl` (one JSON line per run). Reproduce:
```
OUT=x.jsonl LENS=sprint SEEDS=R3V1,...,R3V8 ENV=on npx vitest run --config tests/review/vitest.config.ts tests/review/fjord_r3_balance.test.ts
OUT=x.jsonl LENS=sprint SEEDS=... BIOMES=fjord DIFFS=relaxed,normal ENV=off npx vitest run --config tests/review/vitest.config.ts tests/review/fjord_r3_balance.test.ts
node tests/review/fjord_r3_table.mjs x.jsonl
```

**Reading the tables (honest):**

| Length | Normal (competent) | Hard (competent wins A / F) | Relaxed (competent) | Weaker on Relaxed vs Normal (Fjord) |
|---|---|---|---|---|
| Sprint (R3V) | 159.6 → 158.4 s (**−0.8 %**, not harder) | 14 / 13 (time +2.4 %) | Fjord 3.3 % faster | average 2/8 vs 0/8 |
| Sprint (26 seeds) | +0.4 % reader, +2.2–2.7 % others | 51 / 48 | Fjord ~1 % faster | average 7/26 vs 0/26 |
| Standard (R3V) | 479.6 → 497.7 s (**+3.8 %**) | 7 / **12** (Fjord *easier* on Hard here) | +0.6 % | 0/8 vs 0/8 (Alpine: 0/8 too) |
| Endurance (R3V) | 969.4 → 1013.6 s (**+4.6 %**) | 12 / 8 | +1.3 % | 0/8 vs 0/8 (Alpine: 0/8 too) |

- **Normal**: the Fjord is clearly harder than Alpine at Standard and Endurance (+3.8 %, +4.6 % for
  competent skiers, all seeds won), and only marginally at Sprint (pooled +0.4 % for the reader,
  +2–3 % for the hazard-blind; on R3V alone, −0.8 %). The round-2 inversion (Fjord 3–5 % *faster*)
  is gone, but the Sprint margin is within the seed-to-seed noise of 8 courses.
- **Hard**: harder at Endurance (8 vs 12 competent wins), even at Sprint, and **easier at Standard on
  R3V** (12 vs 7; the Fjord reader wins 8/8, Alpine 4/8). Not robust.
- **Relaxed**: by design the hazards act at a quarter strength, so competent times are within ±3 % of
  Alpine (Fjord slightly faster at Sprint). Weaker skiers: Sprint average wins 2/8 (R3V) and 7/26
  (pooled) on Relaxed against 0 on Normal — "clearly more often on Relaxed" holds at Sprint; at
  Standard and Endurance a skier who never tucks loses on every difficulty in both locations (the
  chase length decides; Alpine is the same).
- **Environment on − off**: costs the hazard-blind skilled skier +4.4 s per Sprint and +13.8 s per
  Standard, the reader +2.8 s and +6.3 s — clearly larger for the blind, as required (round 2:
  reader 0.4 s, blind 2.5 s per Sprint). No outcome flips for competent drivers on R3V Sprint and
  Standard; 1 cautious Relaxed Sprint win became a catch.
- **Crashes** in 1,056 runs: Fjord 5 "hard landing" (jump/gap landings by bots that do not adjust to
  the landing), 2 "tripped on a log"; Alpine 2 "hard landing". No hazard-caused crash.

## 3. Signature mechanic (F1, B4, B N3)

| | Round 2 | Round 3 (R3H seeds) |
|---|---|---|
| Squall lanes per Sprint | 0–3 (R4: 0) | **4–7** (`counts.test`; floor tested in `fjord_r3.test.ts`) |
| Squall lanes per Standard | ~14 | 17–24 |
| Jump squalls per Sprint / Standard | — | 2–7 / 8–16, each with a landing rock |
| Rock across the line per Standard | ~15 | 5–12 |
| Airborne drift over a squall jump (lull vs gust) | median 0.28 m | median ~2.6 m (1.1–5.6 m, 10 jumps) |
| Reader's counter to a lane | hold 2.5 m upwind | hold 3.5 m upwind (still clear of the lee rock: test) |

The env on/off deltas per driver are in §2.4: the hazard-blind skilled skier pays several seconds per
Sprint, the reader about one; Relaxed squalls push at a quarter strength.

## 4. Viewpoints, spines, gaps, rock (B N2–N4, E1–E2, E5)

- **E1 bug** (`coast.ts lookouts`): a finite course looks at all of its encounters
  (`P.encounters(-∞, finishZ)`), so placement never stops early; Endless generates stretch by
  stretch and resumes on later queries. Tests: walk every length in 40 m windows, generate obstacle
  bands far end first, and compare with one big query; obstacle layout identical forward vs reverse.
- **Density**: free-stretch viewpoints as before, plus **chase viewpoints** where the rim runs close
  to the line: a platform 15–20 m off the line on the sea side, 37 m inside the crest (outside the
  cornice), only where the ground is groomed, smooth and not climbing, away from kickers, cliff bands
  and alternate lines; obstacles keep the swerve clear. A player passing 4 m inside the discovery
  radius and back loses **≤ 0.30 s** (worst of 23 chase viewpoints on 3 seeds × Sprint/Standard;
  test `a chase viewpoint costs at most ~0.3 s`). Counts on R3H: Sprint 1–4 (mean 2.5), Standard 2–9
  (mean 5.9), Endurance 8–20. Ids unchanged in form (`vp-<seed36>-<len>-<z>`); `docs/PROGRESSION.md`
  updated.
- **Spines** (`profile.ts`): ridgeline **and cliffside** segments; bow 0.42 × half-width to the side
  that keeps it furthest from the swinging racing line (the sea-side ridge unless the inland side is
  clearly better), clamped `RIM_LINE_CLEAR` (44 m) inside the rim; wind-packed snow friction ×0.3.
  R3H: usable on **41/41** exposed segments (B: 8/22). Saving against the route, tucking follower:
  Sprint mean **+0.71 s** (−0.49…+2.22), Standard mean **+0.58 s** (−1.14…+2.30) — honest: a spine
  with a gap can be slower if you take the gap badly.
- **Gaps**: gully 9.5–11.5 m long, 2.0–2.4 m deep, kicker 1.4–1.7 m. R3H: Sprint **5/8 courses**
  have one (round 2: 0/8), Standard 21 gaps on 8 courses. Untucked approach (start speed → share that
  fell in, speed lost): 10 m/s 20/21 (−3.6 m/s), 14 m/s 14/21 (−3.1), 18 m/s 8/21 (−2.5), 22 m/s 2/21,
  26 m/s 1/21. No crash, everyone skis out (test). Clearing scores `GAP CLEARED` 150 / clean 300 ×
  multiplier; dropping in gets a caption. **Markers**: a cosmetic `gap-marker` hazard kind with banded
  poles at both ends of the lip and far edge and a pennant line across the lip (my hazard views);
  cosmetic kinds produce no physics and no gameplay events.
- **N4**: on coasts a rock or boulder's *edge* keeps 8.5 m from the line (round 2: centre 7.5 m), so
  the reader's way round (≤ 6 m out) keeps ≥ 2.5 m. The jump-landing rock follows the line's bend
  (a bug found while testing put it on the line).

## 5. Terrain requests (R1, R3, R4, R5)

- **R1** (`coast.ts`): `CoastParams.nearRim [46, 72]`: on open stretches the rim crest runs 46–72 m
  from the racing line (cached on an 8 m grid); near the start, caves, refuges and the finish it keeps
  to the piste edge. `RIM_LINE_CLEAR = 44`: no racing line, alternate line, off-route kicker or cliff
  band within 44 m of the crest (profile `seaBound`); hazards beside the line stay out of the cornice.
  The sea side of the piste is flatter (cross-section ×0.4) and the berm lower (2.5–4.5 m), so the
  rim and the sea sit low in the chase frame. Cornice made firmer (drag 0.12, friction ×10) because
  the old climb to a distant rim had been doing part of the stopping; the round-2 safety tests pass
  (straight-at-the-cliff runs stopped; 162 charged pops: 3 relocations, none stranded).
  Route→rim median **105 → 59–61 m**; ≥ 60 % of open-stretch samples within 75 m (test).
  **Note for art:** the rim can now run inside the piste's nominal half-width on the sea side;
  anything placed by `halfWidth` alone on −X (e.g. snowball landing clamp, groomed-piste shading)
  may sit in the cornice zone.
- **R3** (`TerrainRenderer`, coastal only): far tiles within |x| ≤ 3072 m use 32 m steps; their outer
  edges are welded to the 64 m neighbours (no T-junction cracks). ~4× vertices for those tiles; sliced
  every 4 rows. Not visually verified (no browser) — art to recapture.
- **R4**: Fjord `caveSide: -1`. Around a sea-side cave (±90 m, fading by 170 m) the sea side gets the
  ordinary valley hillside the cave contract expects (full wall and cross-section), and the rim runs
  72 m behind the cave cliff's base line (±150 m, fading by 260 m). Tests: guard 0 at the mouth, ledge
  and exit path; Yeti spawns on the ledge and leaps onto the piste; the cave builds. **Not visually
  verified** — the art developer should recapture 07/08/08b; if the hill reads wrong, setting
  `caveSide` back to 1 restores round 2 exactly.
- **R5**: `quayZ` 120 (test bounds updated); the harbour layout is relative to `zq`.
- **R2** (soften the inland crest) was not in my brief this round and is not done.

## 6. Tech (D)

- **Hazard views** (`presentation/hazardViews.ts`): `HazardLayer` queues views; `pump(ms, focusZ)`
  builds nearest first for ≥ 1 view per call, `flush()` at load/teleport; `World` pumps 2 ms/frame.
  Rock view: one ground grid (1.5 m cells, ~360 samples instead of ~1,100 `heightAt`), skin within
  0.15 m of the snow (test), `mergeSimple` preallocated. CPU per rock view under load: p50 3.5 ms,
  p90 8.9, max 16.8 ms.
- **Sea-cave dressing slicing hook** (`presentation/cave.ts`): `CavePresentation.dressSteps?(ctx)`
  — a generator that `yield`s between pieces and returns the same `CaveDressing` as `dress`;
  `dressingTicker(ms)` helps yield on a budget. `World` steps dressing jobs one slice per frame after
  the cave's own slices (`stepCaves`), finishes them synchronously when the cinematic needs the cave
  (`caveFor`) or when loading, and calls `job.return()` if the cave streams out (put partial disposal
  in a `finally`). Without `dressSteps`, `dress` still runs in a frame of its own. **Art: implement
  `dressSteps` in `seaCave.ts` (yield after column clusters, hull, nets, each canvas texture).**
- **Shelter**: `CoastalShelter.sliced()` (yields after the board texture, gate, hut, wind wall,
  before the merge; disposes on abandon); `RefugeDefinition.buildSteps`; `World` slices refuges more
  than 600 m ahead. Largest slice is still one `house()` (art-owned `buildings.ts`).
- **Start/harbour preset plumbing**: `StartDressing(m, group, wood, { quality })`, `new StartArea(m,
  quality)`; `FinishBuildContext.quality` already existed. The content LODs are art's.
- **Rear-view water** (`water.ts`): priority = arms ahead within 12 km, arms behind within 2.5 km,
  then the rest. The water shader's z `discard` is removed (the quad is clipped geometrically).
- **Snowball glint**: `GameSession` creates the held ball and glint at session start (below the
  course) and `App` compiles `session.warmupObjects` before the first frame.
- **Low preset coastal shader** (`snowMaterial.ts`): on low, the gneiss drops the two fine noises
  and master joints; for every preset the wash/spray/surf noise is evaluated only within 30 m of the
  water (it is zero above ~28 m), surf skipped on low. Program key `…:fjord:low`; Alpine key
  unchanged. GLSL not compiled here (no GL) — checked as text only.

## 7. QA (E)

- **Captions**: `Hud.caption(text, s, { soft, priority })`: soft captions never hide the Yeti's; a
  higher-priority soft caption replaces a lower one on screen. Priorities: ambient (surf) 0, report
  (rock, gully) 1, warning (squall ahead, viewpoint) 2; throttles are per kind (3 s), so a rock
  scrape can no longer mute the next squall warning.
- **Labels**: rear-view "BEHIND YOU" on a dark pill (12 px), the multiplier 17 px, outlined, on a
  dark chip.
- **e2e**: `menu.spec.ts` clicks go through a `click()` helper: CSS transitions off for the test,
  `toBeVisible`, then a real click (Playwright's actionability checks) instead of `force: true`.

## 8. Test record

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 17 files, 271 tests, all pass (after the final tune, commit `b6c7666`).
- New: `tests/unit/fjord_r3.test.ts` (lane floor and lee rock, airborne squall, gap stake, rim/line
  clearance, sea-side caves, rock grid, sliced shelter, rear water, low shader key); viewpoint tests
  rewritten in `fjord_gameplay.test.ts` (placement rules, query-order independence, obstacle-order
  independence, ≤ 0.3 s detour, counts on 12 seeds); Relaxed-vs-Normal test on 12 seeds.
- Playwright `tests/e2e/menu.spec.ts` (`PW_PORT=4472`): **not run** — the art developer's evidence capture (`tools/biome_evidence.mjs`, Chromium on port 4481) held the CPU for the whole session, and the brief reserves it for them. The `click()` helper change in `menu.spec.ts` is therefore unverified in a browser; if it fails, restore `force: true` on the affected clicks.

## 9. Open issues

1. **Ladder not robust at Sprint, and inverted on Hard Standard (R3V).** Normal Standard/Endurance
   are clearly harder than Alpine; Sprint is at parity to +3 % depending on the driver and the seed
   set; Hard Standard on R3V favours the Fjord. Seed-to-seed course variance (±15 s per Sprint) is
   larger than the environment's effect, so 8 seeds cannot show a 2 % ladder reliably. Next levers,
   in order: (a) Hard hazard intensity 1.15 (it was 1.1 before the last retune, when Hard Standard was
   6/18 vs 11/18 on T seeds); (b) more decisions per km at Sprint (lanes/jumps already floor at
   3 per km); (c) a balance assertion over ≥ 20 seeds per length rather than 8.
2. **Relaxed competent skiers are as fast in the Fjord as in Alpine** (Relaxed intensity 0.25 keeps
   weaker skiers winning at Sprint). If reviewers read "harder at every difficulty" strictly, raising
   Relaxed intensity trades directly against the Relaxed-average wins.
3. **Spine savings are modest** (mean +0.6–0.7 s, some spines slower when the gap is taken badly).
4. **R3/R4 visuals not verified** in a browser (no captures by me): far-tile welding, the sea-side
   cave hill and the rim close to the line need the art developer's recapture (07, 08, 08b, 09, 06).
   `caveSide: 1` restores round-2 caves exactly if needed.
5. **Rim inside the piste's nominal half-width** on the sea side: code that uses `halfWidth` alone on
   −X (snowball landing clamp `src/yeti/Snowballs.ts clampToPiste`, groomed-piste shading) may put
   things into the cornice zone. Not changed (not my files).
6. **Art follow-ups:** implement `dressSteps` in `seaCave.ts`; the largest shelter slice is one
   `house()` (≤ 24 ms under load); harbour/start content LODs on the `quality` now passed in; style
   the gap-marker poles if wanted; R2 (inland crest) not done.
7. **GLSL** of the low-preset coastal variant checked as text only (no GL here).
8. **Playwright** menu e2e not run (CPU reserved for captures).
