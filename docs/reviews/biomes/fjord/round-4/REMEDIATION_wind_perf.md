# Fjord Coast, round 4: Phase D (wind decisions) and Phase E (streaming performance)

- **Branch:** `pass4-fjord`, from `7698f77`. Commits: `eb8a3b2` (wind gates), `4fb9bd0` (shared
  streaming budget), and the commit that adds this document and the data.
- **Scope:** gameplay and engine modules only. No Fjord art/view files were touched
  (`src/world/biomes/fjord/views/**`, `look/**`, `cinematic/**`). The lead integrates this into the
  round-4 candidate build; nothing here is a claim about the integrated build until it is re-run there.
- **Alpine:** gameplay unchanged (goldens and engine-cliff identity tests pass; Alpine has no hazards,
  so none of the wind code runs there). Alpine *frame streaming* does change: it shares the new
  World.update budget (Phase E).
- **Checks:** `npx tsc --noEmit` clean; `npx vitest run`: 20 files, 296 tests pass.
- **Seeds:** tuned on `W4T1`–`W4T10` (and the unit-test seeds). **All tables below are on
  `W4V01`–`W4V16` (Sprint) and `W4V01`–`W4V06` (Standard), never used for tuning.**
- **Timing caveat:** Node CPU on a shared 2-CPU machine (another agent's Playwright run was active).
  Simulation results are deterministic; frame times are CPU-side replay measurements, **not** frame
  rates, GPU times, upload costs or shader-compile times.

## Phase D — the wind as a decision

### What was wrong (critic F D1, B r3 D3/D4)
Reading a squall lane was worth 0.29 s per Sprint on Normal: the only counter was a fixed 3.5 m
upwind hold, and most of the cost was a gust drag everyone paid. Relaxed (intensity 0.25) switched
the mechanic off; Hard equalled Normal. Re-measured on this round's fresh seeds with the round-3
build (`data/before_7698f77_squall_read_sprint_W4V.jsonl`):

| Round 3 build, Sprint, 16 fresh seeds | squall-blind reader − reader | seeds where reading helped |
|---|---|---|
| Relaxed | **−0.67 s** (reading was a loss) | 0/16 |
| Normal | **+0.26 s** (−2.75 … +2.21) | 8/16 |
| Hard | +0.36 s; wins 13 (reader) vs 15 (blind) | 5/12 |

### Design: wind gates
Squall lanes are replaced by **wind gates** (`src/world/biomes/fjord/hazards.ts`):

- **What the player sees:** a rib of two wind-scoured outcrops on the racing line (8.5 m apart), a
  windsock on the sea side, spindrift over the notch, a rising whoosh and a caption
  ("a squall builds off the sea — take the lee of the rocks, or the notch in the lull").
- **Two ways past it:**
  - **Notch** (sea side): the gust funnels between the rib and the sea. In a gust it pushes a
    grounded skier onshore onto the rib, leans on them (the old gust drag, now only here), and a
    gust that catches a **tucked** skier catches their skis (a once-per-gate knock: −9 % speed and a
    wobble; a braced, untucked skier has no knock and less slip). In the lull it is free.
  - **Lee** (land side): sheltered (no push, no drag, no knock) but drift-loaded: a small, certain
    cost (extra drag and friction).
  - Riding over the rib is the slowest of all.
- **The decision:** notch in the lull, lee in a gust — or, in the notch during a gust, brace
  (stand up) and hold upwind. Neither fixed policy wins (tables below).
- **Readability:** the squall cycle went from short pulses (2.4 / 1.3 / 2.6 / 0.9 s) to readable
  spells (dormant 5.5, **telegraph 2.4**, active 6.0, recovery 1.0 s). With a decision point
  ~1.5–2 s before the notch, the simple human rule "windsock lifting or flying → lee, limp →
  notch" is right ~80 % of the time (`cue` policy); the full value needs a player who has learnt the
  cycle (`read`).
- **Gates need straight line:** a gate is only placed where the racing line stays within 3 m of its
  chord over 80 m, so both ways past the rib are skiable lines (inside the obstacle-free lane).
- **Placement floor:** ≥ 4 gates per ~1 km group where the course leaves room; measured 3–8 gates
  per Sprint plus 3–7 jump squalls (≥ 7 wind decisions per Sprint: unit test). On 4 of 10 Sprint
  layouts checked there is one stretch of 600–1045 m without a wind decision (encounter/cave
  stretches and kicker clusters exclude gates).
- **Jumps:** the landing rock past a squall jump moved from 2.5 to 4 m onshore (B r3 defect 7), so a
  calm or upwind take-off clears it and the gust is what puts you on it. Choices there: wait for
  the lull, take off upwind, or (on Hard) skip the line.
- **Game difficulty vs biome difficulty:** the layout is identical on every difficulty (course codes
  unchanged). Difficulty scales the punishment only: **Relaxed 0.5** (push, drag, knock and drift;
  the rock itself at 0.25 — wider margins for a skier who rides over it), **Normal 1, Hard 1.2**.
  The choice still pays on Relaxed (below).
- **Plumbing:** `EnvQuery.tuck` / `HazardContact.tuck` (optional; the knock reads it), `sea-gust`
  severity `knock` (telegraph 2.4 s ≥ the 0.8 s rule, audio cue present). Squall captions are
  throttled per squall, not per kind (E r3 D1).

### Measured decision value (fresh seeds)
Harness: `harness/wind.test.ts` (the reader autopilot `tests/sim/readerDriver.ts` with a wind
policy; it reads rock and takes alternate lines in every policy, so only the wind handling differs).
Policies: `read` (knows the cycle; lee iff the predicted gust in the notch > 0.3), `cue` (windsock
now), `ignore` (wind-blind: the short way, the notch), `wrong` (inverse of read), `lee` (always),
`notch` (always, braced and holding upwind in a gust — round 3's counter). Raw:
`data/wind_sprint_W4V.jsonl` (624 runs), `data/wind_standard_W4V.jsonl` (96 runs).

**Sprint, 16 seeds** — Δt = policy − read on seeds both won (mean [min … max]), seeds slower than read:

| difficulty | cue | ignore | wrong | always lee | always notch (braced) |
|---|---|---|---|---|---|
| Relaxed | +0.55 [−0.20 … +1.09] 14/16 | +0.83 [−0.58 … +2.30] 14/16 | +1.65 [+0.56 … +3.06] 16/16 | +0.84 [+0.22 … +1.66] 16/16 | +2.31 [+0.33 … +4.11] 16/16 |
| Normal | +0.82 [−0.07 … +2.20] 15/16 | **+2.06** [+0.50 … +3.86] **16/16** | **+3.70** [+1.27 … +6.77] 16/16 | +1.45 [−0.06 … +2.83] 15/16 | +2.66 [+0.77 … +5.98] 16/16 |
| Hard | +0.82 (12 paired) | +1.79 (12) | +3.81 (12) | +3.15 (10) | +1.95 (13) |

Hard Sprint wins (of 16): read 13, cue 14, ignore 13, wrong 14, lee 12, notch 15. **Hard Sprint
outcomes are not monotonic in reading** — the snowball barrage makes them chaotic (as F found in
round 3); the time deltas are positive on average but individual seeds swing ±5–15 s.

**Standard, 6 seeds:**

| difficulty | read | cue | ignore | wrong | always lee |
|---|---|---|---|---|---|
| Normal (Δt) | 481.6 s, 6/6 | +4.11 (6/6 slower) | **+11.23** (6/6) | +14.86 (6/6) | +6.73 (6/6) |
| Hard (wins) | **6/6**, gap 39.3 m | 3/6, gap 17.6 | **4/6**, gap 27.4 | **2/6**, gap 7.4 | 3/6, gap 22.9 |

Reading: on Normal Sprint, choosing correctly is worth ~2 s against ignoring the wind, ~3.7 s
against choosing wrongly, and ~1.5 s against always taking the safe lee — on every fresh seed. On
Standard it is 7–15 s, and on Hard Standard it decides outcomes (6/6 vs 2–4/6). On Relaxed it is
still ~0.8–1.7 s per Sprint (round 3: −0.67 s). The human `cue` rule captures about 40–60 % of the
value of perfect reading.

### Ladder: Alpine vs Fjord (fresh seeds, environment on)
Paired = Fjord − Alpine time on seeds both locations won (mean). Alpine has no wind, so the Alpine
column for `cue`/`ignore` is Alpine's reader.

| Sprint, 16 seeds | read | cue | ignore | skilled | intermediate | average (wins A / F) |
|---|---|---|---|---|---|---|
| Relaxed | +0.81 s (16/16 both) | +1.36 | +1.64 | +1.31 | +0.06 | **4 / 6** |
| Normal | **+1.85** | +2.67 | +3.92 | **+7.39** | +6.13 | 1 / 0 |
| Hard (wins A / F, gap A / F) | 14 / 13, 38.6 / 35.2 m (paired time −1.77 s, 11 seeds) | 14 / 14 | 14 / 13 | **13 / 12**, 35.7 / 31.3 m | **7 / 2** | 0 / 0 |

| Standard, 6 seeds | read | cue | ignore | skilled |
|---|---|---|---|---|
| Normal | +10.7 s | +14.8 | +21.9 | +35.9 |
| Hard (wins A / F) | 5 / **6** (+15.8 s paired) | 5 / 3 | 5 / 4 | 6 / 3 |

- **Normal:** the Fjord is harder than Alpine for every competent driver at Sprint and Standard.
  Per-seed course differences (−12 … +22 s per Sprint) are still larger than the mean ladder for the
  best reader (+1.85 s).
- **Hard:** fewer wins and smaller gaps than Alpine for every Sprint driver; at Standard for every
  driver but the perfect reader, who wins 6/6 against Alpine's 5/6 (slower, +15.8 s, but the Hard
  outcome is dominated by snowball luck). Not robust for a perfect-cycle reader.
- **Relaxed:** approachable — competent drivers within ~+0–1.6 s of Alpine; the never-tucking
  `average` driver wins 6/16 (Alpine 4/16). The unit test (12 seeds) has `average` 2/12 on Relaxed vs
  0/12 on Normal. Relaxed is not "switched off": the wind choice is still worth 0.8–1.7 s per Sprint.
- **Sprint vs Alpine:** a Sprint now has 3–8 gates and 3–7 jump squalls whose correct side depends
  on the windsock; a wind-blind competent skier is 3.9–7.4 s slower than in Alpine on Normal.
- **Crashes:** 0 in 624 Sprint runs, 2 "hard landing" in 96 Standard runs (gap/jump landings by the
  autopilot, as in round 3). No hazard-caused crash.

### Reproduce
```
OUT=x.jsonl LENS=sprint SEEDS=W4V01,...,W4V16 DIFFS=relaxed,normal,hard \
  DRIVERS=read,cue,ignore,wrong,lee,notch,skilled,intermediate,average \
  npx vitest run --config docs/reviews/biomes/fjord/round-4/harness/vitest.config.ts docs/reviews/biomes/fjord/round-4/harness/wind.test.ts
node docs/reviews/biomes/fjord/round-4/harness/table.mjs x.jsonl
```

## Phase E — streaming performance (integrated World, CPU-side replay)

### Method
`harness/frames.test.ts` drives the **real `World`** (not a re-implementation of its update order)
in Node with a stub renderer (`tests/support/fakeRenderer.ts`): `World.create`, then
`updateOrigin` + `update` every frame, 0.5 m per frame (30 m/s at 60 fps) down Endless. It times
each frame with per-thread CPU (`process.threadCpuUsage`) and wall clock, and each consumer with
wrappers. Before (`7698f77`, extracted with `git archive`) and after ran **concurrently, paired**, on
the same machine. Wall clock was dominated by CPU contention (two replays plus another agent's
Playwright on 2 CPUs: wall maxima of 0.6–1.3 s are scheduler stalls), so **the CPU column is the
measurement**; wall is shown for completeness. Data: `perf/frames_summary.json`
(distributions, histograms, the 25 worst frames with per-consumer breakdown, peak queues).

**Not measured (no GPU here):** draw submission, GPU uploads of new geometry/textures, shader
compiles, GPU frame time. Nothing below is a frame rate.

### Where the spikes came from (before, frames > 16 ms CPU, by dominant consumer)

| | Fjord high | Alpine high | Fjord low |
|---|---|---|---|
| `World.stream` → obstacle band generation (visual window, 16–28 ms per 256 m band on the coast, one band in one frame) | 76 | 93 | 38 |
| vegetation band build (indivisible, 10–14 ms) coinciding | 9 | – | – |
| caves / dressing slices | 5 | – | 1 |
| terrain | 2 | – | 1 |

Reviewer D's coincidence finding holds (each consumer had its own budget and they stacked), but in
this replay of the real World the largest single source was the **unbudgeted obstacle band
generation for the visual window** (`World.stream`), not a Fjord view: it fires every 256 m in both
locations and costs more on the coast (`heightAt` with the coast).

### Changes
- **One shared budget per frame** (`src/core/frameBudget.ts`, `World.update`): 6 ms, handed out in
  priority order — terrain corridor, visual obstacle bands, vegetation, hazard views, caves and
  dressings, scenery, shelters, far terrain. Each runs only while budget remains; time-sliced
  builders (`makeTick`, `dressingTicker`) also end their slice when the frame budget is spent, so at
  most one unit overruns. A consumer starved for 8 frames gets one minimal slice (one per frame), so
  nothing waits forever.
- **Obstacle bands in slices** (`generateBandSteps`): identical output (unit test, Alpine and Fjord,
  any slice size); `ensure` (physics window) finishes a pending job synchronously.
- **Terrain:** slices by sample count (≈256–384 `heightAt`) instead of 4 rows of any width; the
  vertex, index and skirt passes are sliced; far tiles build their index as a typed array (same 16-bit
  width as before) and yield before `computeVertexNormals`; corridor and far-field pumps are separate
  consumers.
- **Low preset:** the finer coastal far tiles (art R3) are off on low (D r3 defect 2).
- **Snowball throw slot** (alphaMap beam, ring, fill, trail) created at construction and kept visible
  for the start-of-run compile; hidden on the first frame (D r3 defect 5; unit test).
- Hazard view pump no longer forces a view when the budget is spent.

### Results (CPU per frame, ms; p50 / p90 / p99 / max; counts over 16 and 33 ms)

| Run | Distance | CPU p50 / p90 / p99 / max | > 16 | > 33 | wall p50 / p90 / p99 / max | wall > 16 | wall > 33 |
|---|---|---|---|---|---|---|---|
| Fjord high, before | 24 km | 3.42 / 5.32 / 8.08 / 44.1 | **92** | **23** | 5.36 / 10.94 / 36.85 / 1265 | 1585 | 526 |
| Fjord high, after | 24 km | 3.36 / 4.91 / 7.79 / 19.6 | **4** | **0** | 5.37 / 10.36 / 30.0 / 776 | 1251 | 432 |
| Alpine high, before | 24 km | 1.24 / 4.04 / 6.28 / 43.6 | **93** | **19** | 3.49 / 8.20 / 20.32 / 1033 | 700 | 298 |
| Alpine high, after | 24 km | 1.60 / 4.01 / 6.13 / 19.7 | **1** | **0** | 3.72 / 8.08 / 17.40 / 641 | 562 | 210 |
| Fjord low, before | 12 km | 0.00 / 4.04 / 6.80 / 43.7 | **41** | **9** | 0.19 / 8.36 / 21.07 / 690 | 412 | 135 |
| Fjord low, after | 12 km | 0.00 / 4.05 / 6.38 / 18.6 | **3** | **0** | 0.76 / 8.26 / 17.28 / 730 | 292 | 66 |

(p50 0.00 on low: most low frames do no streaming work and fall below the thread-CPU clock's
resolution there.)

- Fjord's CPU frames over 16 ms: **92 → 4 per 24 km**; over 33 ms: **23 → 0**; max 44 → 20 ms.
  Alpine: 93 → 1, 19 → 0. Fjord now matches Alpine's pre-change p99 and is within ~3 frames of
  Alpine after.
- The remaining > 16 ms frames: 3 are one vegetation band build (13–15 ms, indivisible), 1 a
  terrain slice.
- Throughput: no queue grew without bound (peak pending terrain 169 chunks+tiles vs 130 before,
  hazard views ≤ 3, scenery ≤ 1); the unit test drives Fjord 2 km and checks every queue drains.
- Resident terrain on Fjord low after 12 km: **562 → 414 kt** (finer far tiles off on low).

### Not done / open (Phase E)
- Vegetation `buildBand` is still one indivisible unit (10–15 ms on high) — the source of 3 of the
  4 remaining spikes. Next step: slice it like the obstacle bands.
- A scoured-rock view is still indivisible (D r3 defect 3); the hazard view pump now waits for
  budget, so it no longer stacks.
- Harbour draw/triangle budget on low (D r3 defect 4) is art-owned; not touched.
- GPU-side costs (uploads of the newly built geometry, shader compiles, draw calls) are not
  measurable here. The budget limits CPU work per frame; the GPU upload of a finished chunk still
  happens in the frame it is first drawn.
- A SwiftShader browser measurement was not taken: another agent's Playwright run held the browser
  for the whole session.
