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

## Whiteout Ridge, Frozen Frontier, Volcanic Expanse
Not started.
