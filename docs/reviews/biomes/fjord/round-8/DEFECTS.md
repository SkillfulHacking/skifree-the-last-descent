# Fjord Coast — defect tracker

Severity: C critical · M major · m minor. Status: OPEN · FIXED (verified) · CLAIMED (fixed in code, awaiting
Round-4 verification on the frozen candidate) · ACCEPTED (documented known issue).
Sources: round-3 (final) reviews `final/REVIEW_*.md`, art-scene review `round-4/artscene/REVIEW_artscene.md`,
Round-4 logs. Verification evidence column is filled only from independent review or committed tests.

| ID | Sev | Subsystem | Defect | Repro / source | Repair commit | Verification | Status |
|---|---|---|---|---|---|---|---|
| F-001 | C | engine physics | Cliff/cave walls launch the skier (15→60 m/s up, 8.5 s air); Alpine too | B final §1; cave sweep | 37e30f9, 8faa17a (engine-cliff, PR #6) | tests/unit/terrain_contact.test.ts; 1,080-run sweep 123→0 | CLAIMED |
| F-002 | M | Fjord physics | Cornice friction dead zone traps skiers (87/5,600) | B final §1 | 6b44459, 3cca991 | fjord_cornice.test.ts (5,600 stops); 28,840-approach stress | VERIFIED FIXED (B r4: 0/1,630) |
| F-003 | M | cave art | Sea cave renders near-black after R4 cave move | A M1, C #1, F #2 | 13dcc2d…f8747ce, d837618 | integration-log crop medians (not independent) | VERIFIED FIXED (A, C, F r4) |
| F-004 | M | cinematic | Fjord cave shots lose sea framing (`seaward` false) | C #2 | views/seaFraming.ts (R4) | fjord_r4_integration test; custom Standard caves still no sea | CLAIMED (partial) |
| F-005 | M | water | Cold-plunge water reads as snow at grazing angles | A M3, C, F #4 | R4 water grazing fix | integration-log eyeball only | VERIFIED FIXED (A, C, F r4) |
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
| F-016 | m | UI | Menu/HUD don't scale at 1440p+ | E | f49855b (autoUiScale) | tests/unit/ui_scale.test.ts; candidate res-2560 shots; menu.spec 2560 fit | VERIFIED (E r4: menu); rear view fixed in 129110b |
| F-017 | m | QA | Squall caption throttle per kind hides consecutive squalls | E #1 | eb8a3b2 (per squall) | — | VERIFIED FIXED (E r4) |
| F-018 | m | difficulty | Relaxed hazard intensity 0.25 erased the mechanic | B, F | eb8a3b2 (0.5) | — | CLAIMED |
| F-019 | m | perf | Snowball beam shader compiles mid-chase | D #5 | 4fb9bd0 | — | VERIFIED FIXED (D r4) |
| F-020 | m | test/QA | Browser suite never run on the integrated R4 build | RECOVERY.md | — | round-4/TESTS.md: 19/19 browser, 306/306 unit on the candidate | FIXED |
| F-021 | **C** | engine physics | Wall rule leaves a skier pinned in a pocket at a cave mouth, no rescue (Alpine + Fjord, ~2.5 % of cave-side approaches) | B r4 #1, E r4 #1 | 2e1bfbf (pinWatchdog, no frozen velocity) | tests/unit/pin_rescue.test.ts; E's trap probe on fjord-r4b: 0/864 + 0/864 unrecovered (was 24 + 25); B's pinsweep 0 | CLAIMED |
| F-022 | M | difficulty | Hard step Alpine→Fjord too steep; long Normal runs too tight | B r4 #2, E r4 #2 | 2e1bfbf (Hard 1.0, ×0.85 ≥ 20 km) | fjord_gameplay test | CLAIMED |
| F-023 | M | cave art | Lintel column ends float over the mouth; net sheet floats; prism grid reads as blockout | A M8, C #2, F #1, D | 96621e1, a3c… (lintel removed, net off, clumped causeways) | r5a/07 | CLAIMED |
| F-024 | M | cinematic | Cave shots show the sea only on Sprint caves (0/10 Standard+) | C r4 #1 | fjord-r4b (high/far stations, tilted frames, telephoto) | C's seashots: emerge 15/18, leap 13/18 (was 7/7) | CLAIMED |
| F-025 | M | cinematic | Catch shot (11) looks inland | C r4 #3 | fjord-r4b (profile from up-slope, fjord behind) | round-5 shots | CLAIMED |
| F-026 | M | art | Cliff detail tile lattice / pinstripe at distance | A M6, D #2, F #3; A r5–r7 m5, F r7 D1 | 96621e1 + 129110b; 3296cbe — root cause found with a pixel probe: in the evidence harness the debug free camera is applied after the world update, so the cliff stream kept the skier-side finest LOD (9–22 m strata ledges) and `06` showed it from 1.3 km; every earlier material change missed it. The harness now hands the scenery the real viewpoint and flushes the builds (gameplay and cinematic cameras are set before the update). Also: the ~11 m strata band fades past 300 m | scratch r8j vs r8a; round-8 06 | CLAIMED |
| F-027 | M | art | Needle face on the valley walls in the reveal | A M1 | fjord-r4b (rangeSoft on wall relief) | round-5 11c/11i | CLAIMED |
| F-028 | M | art | Harbour headland: white streaks on a vertical face | A M2; A r5–r7, F r7 D1 | r6 bare-wall tone; 3296cbe (steep coast faces are rock; seeps rarer, grey-blue) | round-8 10/11c | CLAIMED |
| F-029 | M | art | Summit sugarloaf blocks the sea view | A M3 | — | — | OPEN |
| F-030 | M | art | Scoured rock = untextured plates | A M5 | fjord-r4b (scanned rock material) | r5a/04b | CLAIMED |
| F-031 | M | art | No foam / wet line at shores | A M7 | fjord-r4b + 129110b (terrain surf scales with distance; foam on cliff kit) | round-5 | CLAIMED |
| F-032 | m | art | Repeated boulder chips on inland walls; repeated house model in plunge backdrop; regimented waterfront | A M9, C #4, F r7 D8 | round 8b: waterfront fronts stepped, eaves-to-sea buildings, varied roofs; the chips are open | round-8 10/11 | OPEN (partial) |
| F-033 | M | perf | No production-build frame times for the candidate | D r4 #1 | — | round-5 perf harness at the shipped 6 ms budget + live-site check | OPEN |
| F-034 | m | perf | Cliff materials per water level never freed; normals double-lossy; unused gneiss shipped; rock textures not preloaded | D r4 minors | cliffStream frees materials no live segment uses (r4b); the rest open | — | OPEN (partial) |
| F-035 | m | QA | Squalls entered mid-gust get no warning | E r4 | — | — | OPEN |
| F-036 | M | art | White folded slab / flattened disc on the sea in `06` and the menu | A r6 M1, A7-M1, F r7 D1 | 3296cbe, 73a9568: pixel probes named a stretched Namaqualand Cliff 02 scan (`06`) and the Mountainside scan (menu ribbons); neither, nor Boulders 01, is shipped — every island is a boulder scan at ≤ 1:3 | round-8 01/06 | CLAIMED |
| F-037 | M | cinematic | Gull beat (`08c`) shows bare rock under "[gulls scream and scatter]" | C r7 #2, F r7 D2 | d4f7f0b (the beat frames the gulls on the boulder crowns) | round-8 08c | CLAIMED |
| F-038 | M | cinematic | Coastal reveal is dry on ~20 % of Standard caves, inside the terrain on a late Endurance cave, never shows the cave | C r7 #1 | d4f7f0b (shared coastalReveal: clearance + ≥ 0.1 water or no reveal; fjord_reveal.test.ts on 7 courses) — the cave is still not in the reveal | round-8 standard set | CLAIMED (partial) |
| F-039 | M | difficulty | Alpine→Fjord step on Sprint within seed noise (Fjord faster on some seeds) | F r6 D4, F r7 D3 | — | F's critg runs | OPEN |
| F-040 | m | art | Cave boulders perch on the snow (no collar / contact shade) | C r7, F r7 D4 | seaCave bedding at 0.5 r (r7) | — | OPEN |
| F-041 | m | art | Hamlet strand flat at the cliff foot reads as a bright wedge at 1.3 km | own probe r8 | — | round-8 06 | OPEN |
| F-042 | m | cinematic | Victory details: trophy hides the presenter's head; splash crown rim; regimented waterfront | F r7 D6–D8, C r7 | — | — | OPEN |
