# Fjord Coast, final round: Reviewer F (Hostile Game Critic)

- **Reviewer:** F, Hostile Game Critic
- **Nature of review:** model-based reviewer (same model family as the developers; not external)
- **Build:** `aba21bc` (branch `pass4-fjord`, worktree `/home/claude/sf-fjord`)
- **Date:** 2026-11-10
- **Evidence used:**
  - Every 1920×1080 PNG in `final/`, compared with the matching `alpine-baseline/` shot and with `round-2/` and `round-3/wip/` where it helped. `res-1366/` (01, 02, 10, 10b). `res-2560/` was still empty when I finished.
  - Source: `src/world/biomes/fjord/**` (mainly `hazards.ts`, `biome.ts`, `views/*`), `src/game/GameSession.ts`, `src/yeti/Snowballs.ts`, `src/progression/achievements.ts`, `tests/sim/readerDriver.ts`.
  - My own headless runs in `scratch/review-f-r3/`, on **12 seeds nobody had used before** (`CRITF01`–`CRITF12`). None of these are the developers' T/R3H/R3V seeds.

    | Script | Output | What it measures |
    |---|---|---|
    | `bal.test.ts` (copy of the developers' harness, my seeds) | `sprint.jsonl` (432 runs), `standard.jsonl` (72 runs) | Alpine vs Fjord, environment on and off |
    | `table.py` | `sprint_table.txt`, `standard_table.txt` | summaries of the runs above |
    | `place.test.ts` | `place.jsonl` | lanes, rocks, viewpoints, gaps and spines per course |
    | `ablate.test.ts`, `ablate2.test.ts` | `ablate*.jsonl` | what each of the reader driver's "reads" is worth |
  - Pixel measurements of the cave shots (PIL, luma).
  - `npx vitest run tests/unit/fjord_r3.test.ts tests/unit/fjord_art.test.ts`: 17/17 pass.
- **How I treated the remediation notes:** as claims only. Every status below comes from my own screenshots, code reading or runs.

## Verdict: FAIL (against the 9/10 target)

This round is the first in which the Fjord plays differently from Alpine, not just looks different.

What improved:
- **The chase frames are unmistakably coastal.** In `09`, `09b` and `09d` the sea fills half the frame, and in `09d` the harbour row comes into view.
- **The environment costs measurable time.** On my fresh seeds it costs a hazard-blind skier +6.9 s per Sprint and +21 s per Standard on Normal.
- **On Hard it changes outcomes.** With the environment on, the skilled bot wins 8/12 instead of 12/12.
- **The difficulty ladder is no longer inverted** on Normal and Hard.
- **The cave cinematic has its own shots.** It no longer reuses Alpine's.
- **The victory's two worst props are fixed:** the floating trophy and the decal splash.

Three problems still keep it below 9:

1. **The signature mechanic is a toll, not a decision.** On Normal, reading the squalls is worth only **0.29 s per Sprint** (`ablate`). Most of the cost is the gust drag that everyone pays.
2. **The merge crushed the sea cave to pure black.** The basalt measures RGB (1, 1, 2). 56–84 % of the frame in `07`, `08`, `08c` and `08d` is near-black. The new cave cinematic plays on a void.
3. **The harbour water at the plunge reads as snow** (`11h`, `11j`).

Several round-2 art residuals are also still open: the cliff striation, the pebble islands and the regimented waterfront.

No category reaches 9 from a critic's point of view.

## Scores (critic's point of view)

| Category | R2 | **Final** | Justification |
|---|---:|---:|---|
| Visual art direction | 6.5 | **7** | **Good:** the chase frames (`09`, `09d`), the finish (`10`, `10b`), the victory (`11`, `11b`, `11e`) and the reveal (`11c`) are coherent and attractive. **Bad:** the cave set renders as a black silhouette, and its "clinker hull" is an unreadable pile of debris (`07`). The cliff is still vertically striated (`06`). The near islands are still dome lenses (`04c`, `01`). The gulls are crude (`08c`). |
| Environmental uniqueness | 7 | **8** | With the HUD hidden you now know where you are in almost every frame, including the chase (`09` vs Alpine `09`) and the cave (`08`, `08b` vs Alpine). The start still uses the Alpine layout, re-propped (`02` vs Alpine `02`). |
| Skiing and hazard mechanics | 5.5 | **6.5** | **The environment now matters:** lanes per Sprint went from 0–3 to 3–7, and on Hard it changes outcomes. **But the squall read is worth 0.3 s on Normal**, and the only counter is the same 3.5 m upwind hold every time. Spines are worth about 1 s on Normal and are slower than the plain line on Hard (−0.85 s). 7 of 12 Sprints have no gap jump. |
| Difficulty and fairness | 5 | **7** | **Fair:** no hazard crashes in 504 runs. **Ladder present:** Normal Sprint +1.6 to +4.9 s, Standard +18 to +32 s; Hard minimum gap 35.5 vs 45.2 m. **Relaxed is flat:** the Fjord is 0.4–1.2 s *faster* than Alpine, with equal wins. **Seed draw dominates:** per-seed course differences of −12 to +24 s swamp the ladder. |
| Cinematics | 6.5 | **6.5** | **Gains:** the cave sequence is a new sequence (`08c` gulls, `08` emergence, `08d` roar, `08b` leap from behind the Yeti). The trophy is now held (`11g`, `11`), and the splash is a real crown (`11h`). **Losses:** three of the four cave shots are 59–84 % black, and the cold plunge appears to land in a snowfield (`11j`). These cancel the gains. |
| Performance and stability | 7 (lc) | 7 (lc) | `manifest.json` has `errors: []`. There are no crashes in my 504 headless runs. I cannot judge frame rate from SwiftShader. |
| Accessibility and controls | 7.5 (lc) | 7.5 (lc) | Captions are now prioritised (`[gulls scream and scatter]`, `[the Yeti gags on a dried cod]`, `[heavy footsteps behind you]` all render on a dark pill). The windsock reads in the chase (`09`, `04`). The squall particles themselves barely read in `04`. Untested in motion. |
| Overall player experience | 6 | **7** | It is now a pleasant destination with a different-feeling run, a funny finish and a genuine sea reveal. What stops it being a 9: the cave, which should be the scariest beat, is a black void; and the moment-to-moment decision set is thin ("hold 3 m left when the sock flies"). |

## My measurements (independent seeds CRITF01–12)

### Sprint: Alpine vs Fjord, environment on and off

`scratch/review-f-r3/sprint_table.txt`. Cells: wins/12 and mean winning time. "Paired" is the Fjord time minus the Alpine time on seeds both won.

| Difficulty | Driver | Alpine | Fjord, env on | Fjord, env off | Paired F − A (range) | Env on − off (range) | Outcome flips (env off → on) |
|---|---|---|---|---|---|---|---|
| Relaxed | reader | 12/12, 155.9 s | 12/12, 155.5 s | 12/12, 154.4 s | −0.4 (−12.2…+16.5) | +1.1 | – |
| Relaxed | skilled | 12/12, 156.8 s | 12/12, 156.0 s | 12/12, 154.8 s | −0.8 | +1.2 | – |
| Relaxed | average | 3/12 | 3/12 | 4/12 | – | – | 1 win → caught |
| Normal | reader | 12/12, 155.9 s | 12/12, 157.5 s | 12/12, 154.4 s | **+1.6** (−9.9…+17.4) | **+3.1** (+0.2…+5.4) | – |
| Normal | skilled | 12/12, 156.8 s | 12/12, 161.7 s | 12/12, 154.8 s | **+4.9** (−8.2…+24.2) | **+6.9** (+4.2…+12.1) | – |
| Normal | intermediate | 12/12, 157.4 s | 12/12, 162.0 s | 12/12, 155.1 s | +4.6 | +7.0 | – |
| Normal | average | 0/12 | 0/12 | 0/12 | – | – | – |
| Hard | reader | 12/12, gap 45.2 m | 12/12, **gap 35.5 m** | 11/12, gap 40.1 m | +3.3 | +3.7 | 1 caught → win (noise, see below) |
| Hard | skilled | 12/12 | **8/12**, gap 30.1 m | 12/12, gap 44.9 m | +2.6 | +8.1 | **4 wins → caught** |
| Hard | intermediate | 3/12 | 3/12 | 3/12 | – | – | 1 each way |

### Standard (6 seeds)

`scratch/review-f-r3/standard_table.txt`.

| Difficulty | Driver | Alpine | Fjord on | Fjord off | F − A | Env on − off |
|---|---|---|---|---|---|---|
| Normal | reader | 6/6, 470.1 s | 6/6, 487.9 s | 6/6, 480.3 s | **+17.8** (+7.5…+34.9, all positive) | +7.6 |
| Normal | skilled | 6/6, 472.9 s | 6/6, 504.3 s | 6/6, 483.3 s | **+31.5** | **+21.0** |
| Hard | reader | 4/6 | 4/6 | 5/6 | +14.5 | +9.5 |
| Hard | skilled | 4/6, gap 28.9 m | 4/6, gap 18.0 m | 6/6, gap 44.7 m | – | +23.0, 2 wins → caught |

### What each read is worth to the reader driver

`ablate.jsonl`, `ablate2.jsonl`. Sprint, Fjord environment on, 12 seeds. Each row switches off one of the reader's reads; the deltas are measured against the full reader.

| Normal | Mean Δt per Sprint (range) | Hard: outcome change |
|---|---|---|
| no squall read | **+0.29 s** (−1.33…+1.86) | 6/12 caught, but non-monotonic: see note |
| no rock read | +1.75 s (+0.26…+6.28) | 1/12 caught |
| no alternate lines (spines, gaps) | +1.06 s (−0.98…+6.22) | Hard Δt −0.85 s (spines *slower*); 2/12 caught |
| no reads at all | +4.20 s | 4/12 caught |
| reader **plus** "stand up in the gust" | **+2.45 s** (standing up is a losing play) | – |

**Note on Hard:** turning off *only* the squall read loses 6/12, but turning off *every* read loses only 4/12. Hard outcomes are therefore partly chaotic: snowball timing amplifies small differences. Read the per-seed Hard flips as noise. The aggregate Hard picture (lower gaps, 8/12 for skilled) is consistent across my runs.

### Placement on my seeds

`place.jsonl`.

| | Sprint (12 courses) | Standard (12 courses) |
|---|---|---|
| Squall lanes | 3–7 (mean 6.0) | 17–24 |
| Airborne (jump) squalls | 2–4 | 9–19 |
| Rock on the line | 2–8 | 15–25 |
| Viewpoints | 1–5 (mean 2.75); every course has one at z 138–193 | 4–9 |
| Gap jumps | **5/12 courses, one each** | 1–5 |
| Alternate-line metres | 300–1704 | 1936–4784 |

The lane floor is not a floor everywhere:
- `CRITF09` has 3 lanes and none in its last 1.37 km.
- `CRITF12` has none after z 1682.
- `CRITF05` has no lane before z 1080, and `CRITF07` none before z 1170.

The cause: lanes are excluded wherever a spine, kicker or cliff band sits (`hazards.ts:145–150`). So the courses with the most alternate lines are the ones with the fewest squalls.

### Cave shots: how black they are

PIL, inside the letterbox.

| Shot | Share of frame with luma < 20 |
|---|---:|
| Fjord `07` | **0.56** |
| Fjord `08` | **0.59** |
| Fjord `08c` | **0.84** |
| Fjord `08d` | **0.78** |
| Alpine `07` | 0.03 |
| Alpine `08` | 0.20 |
| Fjord round-2 `08` | 0.28 |

Basalt face samples in final `07`, e.g. box (1300–1500, 350–450): **RGB (1, 1, 2)**. The pre-merge capture `round-3/wip/r3/07_yeti_cave.png` measured 26–34 on the same face, and the art notes claim 52–77. Both show visible columns and joints that are gone in the final build.

## Round-2 defects (my area): status

| # | R2 defect | Status | My evidence |
|---|---|---|---|
| 1 | Major: signature mechanic too slight | **Partially fixed**, still Major (D1) | Lanes went from 0–3 to 3–7 per Sprint. The blind-skier cost went from 1.4–2.5 s to 6.9 s per Sprint. On Hard it now flips competent outcomes. But the *player-controllable* part of the squall is 0.29 s per Sprint on Normal, the counter is a single fixed move, and the floor fails on spine-heavy courses. |
| 2 | Critical: inverted difficulty ladder | **Fixed on Normal and Hard**; residual Minor on Relaxed (D7) | Normal: Sprint +1.6 to +4.9 s, Standard +17.8 to +31.5 s (all 6 seeds positive). Hard: skilled 8/12 vs 12/12, reader gap 35.5 vs 45.2 m. Relaxed: Fjord −0.4 to −1.2 s, same wins. Per-seed course variance (−12 to +24 s) is still larger than the Sprint ladder. |
| 3 | Major: cave encounter is Alpine's | **Fixed** (composition), with a new defect (D2) | `08` (Yeti beside the tide pool, camera at the mouth), `08b` (behind the Yeti mid-leap, skier small below), `08c` (gulls) and `08d` (low-angle roar under the icicles). None of these exists in Alpine (`08`: frontal; `08b`: over the skier). |
| 4 | Major: sea-cave dressing is a blockout | **Partially fixed**, still Major (D3) | The columns now vary in height and some tops are broken (`07`, right). But the "clinker hull" is unreadable: in my crop of `07` (250–800 × 700–1080) it is a scatter of planks, oar, cylinders and a black prism. The net hangs in mid-air at about (460–540, 740–800). Everything is crushed to black (D2). |
| 5 | Major: trophy floats above the presenter | **Fixed** | `11g`: the trophy sits on a board held in front of the presenter's chest. `11`: the skier holds it aloft. |
| 6 | Major: gameplay view is mostly blank snow | **Fixed** | `09` vs round-2 `09`: the cliff wall left and the sea with islands right fill the upper half. `09d`: the harbour row of coloured houses is visible from the chase. The lower ~45 % is still plain piste, as in Alpine. |
| 7 | Minor: `04b` does not show its subject | **Fixed**, with a new Minor (D6) | `04b` and `04c` now frame rock patches. |
| 8 | Minor: copy-paste pebble islands | **Partially fixed** (D8) | `03` and `05` add a long whaleback (1300–1560 × 330–395), and the distant islands in `10`/`11e` read as ridged islands. The near field in `04`, `04c` and `01` is still evenly spread, snow-capped dome lenses. |
| 9 | Minor: regimented waterfront | **Not fixed** (D9) | `10`: the houses still stand in two clean arcs. `11h`/`11j`: one straight wall of gables with black window holes, and no doors or quay life facing the water. |
| 10 | Minor: start keeps the Alpine layout | **Partially fixed** (D10) | `02` vs Alpine `02`: the gate is still centre-frame, the hut lower-right and a rope line downhill. A windsock is added, and the rope line now curves to the hut. The sea makes the frame read as a different place, but the composition is the same. |
| 11 | Minor: splash is a flat decal | **Fixed**, with a new Major (D4) | `11h`: a translucent crown splash with droplets. See D4 for the water surface. |
| 12 | Minor: doc drift in `PROGRESSION.md` | **Fixed**, with a new Minor (D11) | `docs/PROGRESSION.md:53` now documents `vp-<seed36>-<len>-<z>`. |
| R1/R2 residual | Minor: stretched cliffs, crest cones | **Not fixed** (D5) | `06`: long vertical striation still runs down the whole wall (0–1150 × 0–950), with sawtooth crest spikes (430–1000 × 0–300). `11c` (right half): the same spikes. |

## Defects

### 1. Major: the signature squall is a time tax with almost no decision in it

**Evidence**
- On Normal, a reader that does everything except hold upwind through squalls is only **0.29 s slower** per Sprint (−1.33…+1.86 s over 12 seeds, `ablate.jsonl`).
- The environment's cost to the reader is +3.1 s per Sprint (`sprint_table.txt`). So most of the squall cost is the unavoidable gust drag, `SQUALL.drag` "that everyone pays" (`hazards.ts:56–57`).
- The only counter is a fixed 3.5 m upwind offset (`readerDriver.ts`, sea-gust branch). The other available response, standing up into the gust, *loses* 2.45 s (`ablate2.jsonl`).
- The lane floor fails exactly where there are spines, because lanes are skipped on alternate lines (`hazards.ts:148–149`):
  - `CRITF09`: 3 lanes, none in the last 1.37 km;
  - `CRITF12`: none after z 1682 (`place.jsonl`).
- The spines and gaps that should compound the decision are worth about 1 s on Normal, are slower than the plain line on Hard (−0.85 s), and 7 of 12 Sprints have no gap.

**Why it matters:** brief §2 says difficulty comes from "the decisions it forces". A player cannot feel a 0.3 s skill payoff. What they will feel is "the Fjord is a bit slower".

**Fix**
- Move cost from the unconditional drag into the side-slip consequence. For example, a gust that is not countered sets the skier onto the lee rock and costs 2–3 s; one that is countered costs nothing.
- Give the counter a timing element: brace or edge-set during the active phase, rewarded rather than punished.
- Let lanes sit across spine entries, so the choice is "spine now, through the gust" or "the safe line".
- Target: on Normal, reader vs a squall-blind reader ≥ 2 s per Sprint, with every Sprint having ≥ 1 lane per 600 m.

### 2. Major (new, introduced by the merge): the sea cave renders as a pure black void

**Evidence** (see the darkness table above)
- `07`: 56 % of the frame is luma < 20, and the basalt face is RGB (1, 1, 2). In the `07` frame, the portal colonnade, the lintel of column ends and the cliff face merge into one silhouette.
- The same camera in `round-3/wip/r3/07_yeti_cave.png` (pre-merge) shows a textured basalt face with jointed columns.
- The gameplay branch moved Fjord caves to the sea side (`caveSide: -1`, `REMEDIATION_gameplay.md` §5 R4). The face now looks away from the sun, and the art pass's basalt multipliers then crush it:
  - indirect diffuse × 0.32;
  - direct diffuse × 0.5;
  - specular × 0.25 (`REMEDIATION_art.md` §1).
- `08c`: 84 % black. The gulls are "white on black basalt" only because the basalt is invisible.
- `08d`: 78 % black. `08`: 59 % black; the chamber behind the Yeti is a shapeless void.

**Why it matters:** this is the Yeti's introduction, the scariest beat of the run. It now reads as a lit Yeti in front of a black matte. Neither art developer verified it after the merge: the art notes list "the cave hook's sea-behind branch" as unverified.

**Fix**
- Relight for the sea-side orientation: a cinematic fill or rim light on the portal, and a floor on the basalt's indirect term so columns separate at about luma 30–50.
- Recapture `07`, `08`, `08c` and `08d`, and check the luma histogram.

### 3. Major: sea-cave dressing still reads as blockout at the evidence camera

**Evidence:** `07` lower-left (crop 250–800 × 700–1080).
- The overturned "clinker hull" cannot be identified. It reads as loose planks, a white cylinder, an oar and a black block.
- The net floats unattached in mid-air at about (460–540, 740–800).
- Two white cones lie at the bottom edge, at about (260, 1070) and (540, 1065).
- The column field (900–1780 × 420–1040) is improved but still reads as a crate of black crayons. That is partly D2.

**Fix**
- Frame the hull so its keel line and strakes are legible: a larger silhouette, set upright against the snow.
- Anchor the net to posts or columns.
- Remove the stray cones.

### 4. Major: the cold-plunge water reads as snow

**Evidence**
- `11j`: the skier dives into what looks like a white, matte snowfield under the pier, at (0–1920, 690–960).
- `11h`: the crown splash rises out of the same white plane.
- From above, the same water reads as water (`11b`: dark blue with ripples). The grazing-angle Fresnel or sky reflection washes it to snow colour.

**Why it matters:** this is the payoff of the après gag.

**Fix**
- Clamp the Fresnel or reflection tint near the harbour, or raise the plunge camera a few metres.
- Add a dark water tone, ripples and a wet edge at the quay foot.

### 5. Minor: cliff striation and crest spikes remain (open since round 1)

**Evidence**
- `06`: vertical streaks run the full height of the wall.
- `06` and `11c` (right half): evenly spaced sawtooth crest cones.

**Fix:** the art developer's G2/R2 requests (soften the crest heightfield); reduce the fall-line noise further.

### 6. Minor (new): scoured rock reads as a pile of grey blades with a soot halo

**Evidence**
- `04b` (660–1300 × 515–710): fanned, knife-like grey slabs with a smeared black decal around them.
- `09` (390–660 × 600–640) and `09d` (230–940 × 595–680): flat slabs with dark smudges.

**Fix:** rounder, lower, ice-polished slabs with rime, and a tighter, lighter contact shadow.

### 7. Minor: the ladder disappears on Relaxed, and Hard gets no extra environment

**Evidence**
- `biome.ts:202`: `intensity: { relaxed: 0.25, normal: 1, hard: 1.0 }`.
- Relaxed: the Fjord is 0.4–1.2 s *faster* than Alpine for competent drivers, with equal weak-driver wins (3/12 vs 3/12).

**Fix**
- Relaxed intensity of about 0.5, so the location is still 2/5 there.
- Consider 1.15 on Hard (the developers' own lever (a)).

### 8. Minor: the near islands are still uniform domes

**Evidence:** `04c` (top half), `01`, `04`.

**Fix:** the art developer's G3 request (cliffed islands, skerry chains, fewer and larger groups).

### 9. Minor: the waterfront is still regimented

**Evidence:** `10` (two arcs); `11h`/`11j` (one wall of gables with black window holes, no doors facing the quay).

**Fix:** stagger setbacks; add doors, boat sheds and stacked crates on the water side.

### 10. Minor: the start composition is still Alpine's

**Evidence:** `02` vs Alpine `02`.

**Fix:** as in round 2, put the mast or cairn on a sea-side rise and run the rope along the rim.

### 11. Minor: documentation drift

**Evidence**
- `CHANGELOG.md` has no Fjord entry at all.
- `docs/BIOMES.md:498` describes `sea-gust` only as "squall across jumps". It does not mention grounded lanes, the lane floor or per-difficulty intensity.
- `docs/BIOMES.md:505` points to `tests/review/fjord_balance.test.ts`, not the round-3 harness.

**Fix:** add a Fjord changelog entry; document lanes, intensity and the balance harness.

### 12. Minor: the gulls are crude in a tight close-up

**Evidence:** `08c`, at 31° FOV. Each gull is an egg-shaped body with two needle wings and a stick leg, and all are the same scale (my crop 250–900 × 180–620).

**Fix:** a proper wing silhouette (bent at the wrist, with tapered primaries), size variance and motion blur.

### 13. Minor: odd tangent in the trophy presentation

**Evidence:** `11g`. The crate stack behind the presenter (blue/yellow crate plus an orange buoy, 990–1270 × 595–630) lines up with the presenter's shoulder and reads as a horizontal arm.

**Fix:** move the crates or shift the camera a few degrees.

### 14. Minor: hard-edged white streaks on the menu sea

**Evidence:** `01` (1260–1700 × 700–900) and `res-1366/01` (900–1200 × 495–650): long, straight, diagonal white bands on the water. They are probably mist planes seen edge-on (D's mist seam).

**Fix:** fade the mist by view angle, or break up its edges.

## What works

- **The chase now looks like a coast.** The sea and islands fill half the frame (`09`), and the harbour comes into view near the end (`09d`). This is the biggest single gain since round 1.
- **The environment has teeth on Hard and on long courses.**
  - Hard: the skilled bot wins 8/12 vs 12/12, and the reader's minimum gap drops 45 → 35 m (Sprint).
  - Normal Standard: blind cost +21 s, reader cost +7.6 s.
  - There were no hazard-caused crashes in 504 runs.
- **The cave encounter is the Fjord's own:** gulls, the tide pool, the icicle drop and the leap from behind (`08c`, `08`, `08d`, `08b`). It only needs light (D2).
- **The victory is a real sequence:**
  - the stockfish gag (`11e`, `11f2`);
  - the harbourmaster's presentation and the trophy held aloft (`11g`, `11`);
  - the pier hot tub (`11b`);
  - the crown splash (`11h`);
  - "YOU REACHED THE SEA" over the sea-to-summit reveal (`11c`).
- **Viewpoints are now part of the run.** There are 1–5 per Sprint, worth 500 style points each (`GameSession.ts:11`), within ~0.3 s of the line.
- **The developers' own numbers reproduce on my seeds,** within noise. That includes their honest admission that the Sprint ladder is small.

## Answers to the brief's critic questions

- **Is it fun?** Pleasant, and on Hard it is now tense.
- **Is it meaningfully different from Alpine in gameplay frames?** Yes, visually (`09` vs Alpine `09`). In the hands only on Hard or over long courses.
- **Is it beautiful?** In the wide, chase and finish shots, yes. At the cave, no: it is black (D2).
- **Is there unfinished work?** Yes:
  - the cave lighting after the merge (D2);
  - the hull and net (D3);
  - the plunge water (D4);
  - the cliff striation (D5);
  - the island domes (D8);
  - the `res-2560` captures are missing.
- **Is the signature mechanic interesting?** It is noticeable, not interesting. Reading it is worth 0.3 s on Normal (D1).
- **Is it replayable?** Moderately:
  - viewpoint points and courses vary;
  - the only Fjord achievement ("Scenic Route", `achievements.ts:227–233`) unlocks at the first viewpoint, which on every one of my 12 Sprints is at z 138–193 (the first 200 m);
  - gaps appear on fewer than half the Sprints.
- **Is the difficulty ladder sensible?** On Normal and Hard, yes, and clearly so on Standard. On Relaxed it is flat (D7). The Sprint ladder (1–3 %) is smaller than course-draw variance.
- **Is the Yeti still memorable?** The chase Yeti is unchanged: there is no Fjord-specific behaviour beyond the land-side howl and the snowball clamp (`GameSession.ts:470–471`, `Snowballs.ts`). It feels closer on Hard because of the hazards. Its intro is new but unlit. The cod gag is the memorable new Yeti moment.
- **Is it commercial quality?** The chase, the finish and the victory are close. The cave is not, in this build.

## Brief compliance (Fjord section, critic's point of view)

| Bullet | Status | Evidence |
|---|---|---|
| Enormous coastal cliffs | done (striation residual) | `06`, `11c`, `09` |
| Cold blue ocean water | done (except at grazing angles) | `03`, `05`, `11b`; `11j` reads as snow |
| Distant islands | partial | ridged far islands in `10`/`11e`; dome lenses near (`04c`) |
| Snowy mountain peaks | done | `04`, `02` |
| Clear skies, excellent visibility | done | all exterior shots |
| Rocky coastal outcrops | partial | rock patches in chase frames (`09`, `09d`), but blade-like (D6) |
| Sparse evergreen forests at elevation | done | `09`, `03` |
| Colourful shoreline architecture | done (regimented) | `10`, `09d`, `11h` |
| Occasional sea mist near the water | partial | haze in `10`; edge-on streaks in `01` (D14) |
| Dramatic views across the fjord | done, now in gameplay | `09`, `09b`, `09d`, `11c` |
| Large open downhill runs | done | `03`, `09` |
| Scenic branching paths / ridgeline shortcuts | partial | 300–1704 m of alternate line per Sprint, worth ~1 s on Normal and −0.85 s on Hard (`ablate`) |
| Gentle coastal crosswinds | done | 3–7 lanes per Sprint; a cost, but little decision (D1) |
| Exposed coastal rocks | done | 2–8 on the line per Sprint; reading them is worth 1.75 s |
| Small terrain gaps and jumps | partial | gaps on 5/12 Sprints (`place.jsonl`); not captured in evidence |
| Optional exploration bonuses, not mandatory | done | 1–5 viewpoints per Sprint, 500 pts, ≤ ~0.3 s detour |
| Harbour finish | done | `10`, `10b`, `09d` |
| Victory: ocean pull-back reveal | done | `11i`, `11c` |
| Coastal trophy plus playful après | done (plunge water D4) | `11g`, `11`, `11b`, `11h` |
| Not the Alpine resort under different lighting | done (start composition partial) | `08`/`08b` vs Alpine; `02` (D10) |
| Biome-appropriate cave and Yeti encounter (§2) | partial | new shots, but crushed to black (D2, D3) |
| Difficulty from the environment, gradual progression (§2) | mostly done | Normal and Hard ladder present; Relaxed flat (D7); Sprint margin is within seed noise |
