# Cross-biome quality scorecard

All reviewers are **model-based reviewers** (other instances of the same model family as the
developers, each in a fresh, isolated context, given the build, screenshots, source and the brief
but not the developers' self-assessment). They are not external human reviewers.
Target for every category: 9/10. A location is approved only when every category meets the target
in the **final** round, on the latest commit.

Scores: A art · B physics/gameplay · C cinematics · D tech/perf · E QA/accessibility · F critic.
`(lc)` = reviewer marked low confidence (outside their speciality). The **bold** score is the
owning reviewer's score for that category and is the one that gates.

## Alpine Valley (1/5) — baseline
Not re-reviewed this pass (existing location; unchanged, verified by golden terrain tests).
Evidence: `docs/reviews/biomes/alpine-baseline/`.

## Fjord Coast (2/5)

### Round 1 — build `f8519ca` — **FAIL** (all six reviewers)

| Category | A | B | C | D | E | F | Gate |
|---|---|---|---|---|---|---|---|
| Visual art direction | **6** | 7 (lc) | 6.5 | 7 (lc) | 7 (lc) | 5.5 | ✗ |
| Environmental uniqueness | **7** | 6 | 7 | 8 (lc) | 8 (lc) | 6.5 | ✗ |
| Skiing and hazard mechanics | 6 (lc) | **5.5** | 7 (lc) | 7.5 (lc) | 8 | 4 | ✗ |
| Difficulty and fairness | 7 (lc) | **5** | 7 (lc) | 7.5 (lc) | 7 | 5 | ✗ |
| Cinematics | 7 | n/a | **5.5** | 7.5 (lc) | 7 (lc) | 6 | ✗ |
| Performance and stability | 7.5 (lc) | 7 (lc) | 7 (lc) | **6.5** | 8 | 7 (lc) | ✗ |
| Accessibility and controls | 7 (lc) | 7 (lc) | 7 (lc) | 7.5 (lc) | **7** | 7 (lc) | ✗ |
| Overall player experience | 6.5 | 5.5 | 6.5 | 7 (lc) | 7.5 | **5** | ✗ |

Reports: `fjord/round-1/REVIEW_{A_art,B_physics,C_cinematic,D_tech,E_qa,F_critic}.md`.
Critical: sky artefact (peach rectangle, `06`/`04b`); signature hazards have no measurable effect (F).
Major themes: islands read as ice floes; monotonous stretched cliff; Alpine start area and cave
reused; victory script largely the Alpine one; crude après set; scenery hitches and streamed point
lights; missing water on far fjord arms (Expedition/Endless); viewpoints all inside chases;
cliff soft-lock over the cornice; Fjord harder than Alpine for non-experts because of flatter,
powder-heavier terrain; Fjord-specific branches/gaps missing.

### Round 2 — build `aec1812` — **FAIL** (all six reviewers; large improvement)

| Category | A | B | C | D | E | F | Gate |
|---|---|---|---|---|---|---|---|
| Visual art direction | **7** | 7.5 (lc) | 7 | 7.5 (lc) | 8 (lc) | 6.5 | ✗ |
| Environmental uniqueness | **7.5** | 7.5 | 7.5 | 8.5 (lc) | 8.5 (lc) | 7 | ✗ |
| Skiing and hazard mechanics | 6.5 (lc) | **8** | 7 (lc) | 8 (lc) | 8.5 | 5.5 | ✗ |
| Difficulty and fairness | 7 (lc) | **7.5** | 7 (lc) | 8 (lc) | 8 | 5 | ✗ |
| Cinematics | 7 | n/a | **7** | 8 (lc) | 8 (lc) | 6.5 | ✗ |
| Performance and stability | 7 (lc) | 8 (lc) | 7 (lc) | **7.5** | 8 | 7 (lc) | ✗ |
| Accessibility and controls | 7.5 (lc) | 8 (lc) | 7 (lc) | 7.5 (lc) | **8.5** | 7.5 (lc) | ✗ |
| Overall player experience | 7 | 7.5 | 7 | 7.5 (lc) | 8 | **6** | ✗ |

Fixed (verified by reviewers): sky artefact, cliff soft-lock, viewpoints inside chases, scenery
hitches (mostly), streamed lights, far-arm water, captions, wording, code input, flat starts, après set.
Remaining: difficulty ladder inverted on fresh seeds (Fjord easier than Alpine at Standard+);
viewpoint placement bug + only one viewpoint per course; signature mechanic still slight; cave
encounter still Alpine choreography/shape with no sea; cliff crest cones/smearing/snow strip; far-field
faceting; harbour water edge; trophy floating; fish gag shot from behind; reveal framing/timing;
splash decal; mist seams on water; single-frame rock-view and sea-cave builds; heavy start/harbour.

### Round 3 (final) — build `aba21bc` — **FAIL** (all six reviewers; not approved, not merged)

| Category | A | B | C | D | E | F | Gate |
|---|---|---|---|---|---|---|---|
| Visual art direction | **6.5** | 7.5 (lc) | 7.5 | – | 8.5 (lc) | 7 | ✗ |
| Environmental uniqueness | **7.5** | 8.5 | 8 | – | 9 (lc) | 8 | ✗ |
| Skiing and hazard mechanics | 6 (lc) | **7.5** | 7 (lc) | – | 8.5 | 6.5 | ✗ |
| Difficulty and fairness | 7 (lc) | **8** | 7 (lc) | – | 8.5 | 7 | ✗ |
| Cinematics | 6.5 | n/a | **7.5** | – | 8.5 (lc) | 6.5 | ✗ |
| Performance and stability | 7 (lc) | 8.5 (lc) | 7 (lc) | **8.5** | 8.5 | 7 (lc) | ✗ |
| Accessibility and controls | 7 (lc) | 8 (lc) | 7 (lc) | – | **8.5** | 7.5 (lc) | ✗ |
| Overall player experience | 6.5 | 8 | 7.5 | – | 8.5 | **7** | ✗ |

(D scored only its own category this round.)
Fixed this round (verified): difficulty ladder no longer inverted at Standard/Endurance; signature
squalls cost real time (blind −6 s/Sprint) with no hazard crashes; viewpoints restored (≈3/Sprint,
7.5/Standard) and order-independent; sea fills the gameplay frame; quay wall; victory staging
(gag, trophy, plunge, reveal timing); budgeted hazard views, sliced cave dressing/shelters; mist seams.
**Regressions from merging the two round-3 branches (not caught before capture):** sea-side caves
render near-black and the Fjord cave shots fall back to non-sea framing; cornice friction increase
traps skiers (87/5,600 charged-jump approaches); plunge water reads as snow at grazing angles.
Still open: cliff crest spikes/smearing, island repetition, scoured-rock view looks placeholder, squall
is mostly a time tax (thin decision), Sprint ladder thin, Relaxed hazard intensity 0.25 blurs biome vs game
difficulty, summed per-frame streaming spikes (156 frames >16 ms per 24 km vs Alpine 34), cave-wall
launch bug (engine-wide, also Alpine), menu/HUD not scaling at 1440p+, minor caption throttling.

### Round 4 — build `8d19542` (code = `c0ea8ae`) — **FAIL** (all six; Critical found; PR #5 stays draft)

| Category | A | B | C | D | E | F | Gate |
|---|---|---|---|---|---|---|---|
| Visual art direction | **7** | 7 (lc) | 7.5 | 7.5 (lc) | 8 (lc) | 7 | ✗ (< 8 preview bar) |
| Environmental uniqueness | **7.5** | 8.5 | 8 | 8.5 (lc) | 8.5 (lc) | 8 | ✗ |
| Skiing and hazard mechanics | 6 (lc) | **6.5** | 7 (lc) | 8.5 (lc) | 7 | 7.5 | ✗ |
| Difficulty and fairness | 7 (lc) | **7** | 7 (lc) | 8 (lc) | 7 | 7.5 | ✗ |
| Cinematics | 7 | 7 (lc) | **8** | 8 (lc) | 8 (lc) | 7 | ✗ |
| Performance and stability | 7 (lc) | 7 (lc) | 7 (lc) | **8.5** | 7 | 7 (lc) | ✗ |
| Accessibility and controls | 7.5 (lc) | 7.5 (lc) | 7 (lc) | 8 (lc) | **8** | 7.5 (lc) | ✗ |
| Overall player experience | 7 | 7 | 7.5 | 8 (lc) | 7 | **7.5** | ✗ (< 8 preview bar) |

Fixed (verified): black cave (F-003), plunge water (F-005), cliff-wall launch itself (0/2,880 >3 s air),
cornice trap (0/1,630), wind gates a real choice (+2.4 s blind / +4.3 s wrong on 10/10 seeds), Relaxed ladder,
menu scale at 1440p, squall caption throttle, Scenic Route real journey, every finite length finishes,
Endless memory flat. **Critical (B, confirmed by E):** the wall rule leaves a skier pinned in a pocket at a
cave mouth (Alpine and Fjord, ~2.5 %), no rescue. Major: Hard (1.2) step from Alpine too steep (B, E);
islands still saucers/loaves (A, F); cliff detail tiling lattice (A, D, F); cave dressing reads as blockout
(lintel blocks floating, net, prism grid: A, C, F); needle crest in the reveal (A); harbour headland snow
streaks (A); sea framing only on Sprint caves (C); catch shot faces inland (C); no candidate perf from the
production build (D). Evidence gaps: res-1366/res-2560 and perf were late (rendering on a 2-CPU box).
Remediation → round 5 (branch `fjord-r4b`).

### Round 5 — build `e2ce964` — **FAIL** at the gate (visual reviewers A, C, F; B/D/E not run — see note)

| Category | A | C | F | Gate |
|---|---|---|---|---|
| Visual art direction | **7.5** | 7.5 | 7 | ✗ (< 8) |
| Environmental uniqueness | **7.5** | 8 | 8 | ✗ |
| Skiing and hazard mechanics | 6.5 (lc) | 7 (lc) | 7.5 | ✗ |
| Difficulty and fairness | 7 (lc) | 7 (lc) | 7.5 | ✗ |
| Cinematics | 7 | **8** | 7.5 | ✗ |
| Performance and stability | 7 (lc) | 7 (lc) | 7 (lc) | ✗ |
| Accessibility and controls | 7 (lc) | 7 (lc) | 7.5 (lc) | ✗ |
| Overall player experience | 7 | 7.5 | **7.5** | ✗ (< 8) |

Verified fixed: the round-4 Critical (pinned skier — F's 360 runs, unit tests), Hard Sprint step (F: 11/12 = Alpine),
floating lintel and net, scoured rock textured, reveal needles softened, cliff lattice gone, foam line present.
Not fixed / not visible: islands (heightfield shapes barely changed on screen: A, F), cave dressing still reads as
props (A, C, F), harbour headland streaks, summit dome, repeated house model, catch shot still has no sea,
cave sea framing on Standard+ (C: 0/15 after the steep frames were removed; the cinematic ignores the chosen tilt).
B, D and E were not run this round: with A and F below the bar the gate cannot be met on this build, and the
art category has now moved only 6.5 → 7 → 7.5 over three rounds of heightfield/shader tuning (F's Overall
7 → 7.5 → 7.5). Per the brief, the methodology changes before the next round (authored meshes for islands,
cave dressing and the harbour headland instead of further heightfield/shader tuning).

### Round 6 — build `5c28419` — **FAIL** at the gate (A, C, F; methodology change: scanned CC0 rock)

| Category | A | C | F | Gate |
|---|---|---|---|---|
| Visual art direction | **7.5** | 7.5 | 7.5 | ✗ (< 8) |
| Environmental uniqueness | **8** | 8 | 8.5 | ✗ |
| Skiing and hazard mechanics | 6.5 (lc) | 7 (lc) | 7.5 | ✗ |
| Difficulty and fairness | 7 (lc) | 7 (lc) | 7.5 | ✗ |
| Cinematics | 6.5 | **7.5** | 7.5 | ✗ |
| Performance and stability | 7 (lc) | 7 (lc) | 7 (lc) | ✗ |
| Accessibility and controls | 7 (lc) | 7 (lc) | 7.5 (lc) | ✗ |
| Overall player experience | 7 | 7.5 | **7.5** | ✗ (< 8) |

Verified: the islands are fixed — scanned rock replaced the loaves/saucers on screen (A, F); the hex
causeway and floating wreckage are gone. New faults: a lone portal column ("monolith"), drums and bones
left in the cave dressing, boulders not bedded, icicles on bare rock; the coastal reveal for non-Sprint caves
showed no coast (camera too high, aimed into the hill); the Sprint emergence got smaller (30° stations);
the catch shot still/again faced inland (the sea lies along the skier→presenter line); a stretched island
scan read as a flat slab (06); the menu lost its islands (scans loaded after its only `want()`). F expects
Overall 8 once the cave props, the catch shot and the hero cliff are fixed on screen. B/D/E not run (gate
already failed). Round-6 capture stopped after the main 1080 set.

## Whiteout Ridge, Frozen Frontier, Volcanic Expanse
Not started.
