# Fjord Coast — defect tracker

Severity: C critical · M major · m minor. Status: OPEN · FIXED (verified) · CLAIMED (fixed in code, awaiting
Round-4 verification on the frozen candidate) · ACCEPTED (documented known issue).
Sources: round-3 (final) reviews `final/REVIEW_*.md`, art-scene review `round-4/artscene/REVIEW_artscene.md`,
Round-4 logs. Verification evidence column is filled only from independent review or committed tests.

| ID | Sev | Subsystem | Defect | Repro / source | Repair commit | Verification | Status |
|---|---|---|---|---|---|---|---|
| F-001 | C | engine physics | Cliff/cave walls launch the skier (15→60 m/s up, 8.5 s air); Alpine too | B final §1; cave sweep | 37e30f9, 8faa17a (engine-cliff, PR #6) | tests/unit/terrain_contact.test.ts; 1,080-run sweep 123→0 | CLAIMED |
| F-002 | M | Fjord physics | Cornice friction dead zone traps skiers (87/5,600) | B final §1 | 6b44459, 3cca991 | fjord_cornice.test.ts (5,600 stops); 28,840-approach stress | CLAIMED |
| F-003 | M | cave art | Sea cave renders near-black after R4 cave move | A M1, C #1, F #2 | 13dcc2d…f8747ce, d837618 | integration-log crop medians (not independent) | CLAIMED |
| F-004 | M | cinematic | Fjord cave shots lose sea framing (`seaward` false) | C #2 | views/seaFraming.ts (R4) | fjord_r4_integration test; custom Standard caves still no sea | CLAIMED (partial) |
| F-005 | M | water | Cold-plunge water reads as snow at grazing angles | A M3, C, F #4 | R4 water grazing fix | integration-log eyeball only | CLAIMED |
| F-006 | M | gameplay | Squall is a time tax, not a decision (0.29 s/Sprint) | F #1 | eb8a3b2 (wind gates) | round-4 harness: wrong/ignore +2–3.7 s/Sprint (dev-run) | CLAIMED |
| F-007 | M | perf | Summed streaming spikes (156 >16 ms/24 km vs Alpine 34) | D #1 | 4fb9bd0, cb3ad0c | CPU replay 129→2 (dev-run) | CLAIMED |
| F-008 | M | art | Needle-spike cliff crest, vertical smearing | A M4, F | cliff kit (art-r4 merge), rangeSoft | not yet reviewed in game | CLAIMED |
| F-009 | M | art | Islands: repeated loaves / cakes / saucers | A M6, art-scene P-M3/4 | ac5234a (coast.ts island archetypes) | fjord unit tests; candidate shots 03/06 (round-4/candidate) | CLAIMED |
| F-010 | M | art | Scoured-rock view looks placeholder | A M5, F | gate skins (R4) | — | CLAIMED (partial) |
| F-011 | M | art | Rock reads as concrete/masonry (baked textures) | art-scene P-M1/2 | d837618 + ac5234a (Cliff Side macro, relief, streaks) | candidate shot 06 | CLAIMED |
| F-012 | M | art | Hamlets would float/clip with the cliff kit | art-scene P-M6 | R4 carve-out | — | CLAIMED |
| F-013 | m | art | No foam where cliffs/columns meet water | art-scene P-M5 | cliffStream foam (R4) | — | CLAIMED |
| F-014 | m | cinematic | Cod prop reads as a stick through the Yeti's nose; presenter pose | C | bcc16bd (cod orientation, gag mode, presenter, beacon) | candidate shots 11f/11g/11c | CLAIMED |
| F-015 | m | gameplay | Slow gully drop-ins crash ("hard landing") | B, E final | — (investigated: the two remaining crashes are squall drift mid-air + misalignment; terrain change made it worse, reverted) | scratch gap2 on fjord-r4b | OPEN (minor, accepted for preview) |
| F-016 | m | UI | Menu/HUD don't scale at 1440p+ | E | f49855b (autoUiScale) | tests/unit/ui_scale.test.ts; candidate res-2560 shots; menu.spec 2560 fit | CLAIMED |
| F-017 | m | QA | Squall caption throttle per kind hides consecutive squalls | E #1 | eb8a3b2 (per squall) | — | CLAIMED |
| F-018 | m | difficulty | Relaxed hazard intensity 0.25 erased the mechanic | B, F | eb8a3b2 (0.5) | — | CLAIMED |
| F-019 | m | perf | Snowball beam shader compiles mid-chase | D #5 | 4fb9bd0 | — | CLAIMED |
| F-020 | m | test/QA | Browser suite never run on the integrated R4 build | RECOVERY.md | — | round-4/TESTS.md: 19/19 browser, 306/306 unit on the candidate | FIXED |
