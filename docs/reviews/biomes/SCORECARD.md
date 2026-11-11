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

## Whiteout Ridge, Frozen Frontier, Volcanic Expanse
Not started.
