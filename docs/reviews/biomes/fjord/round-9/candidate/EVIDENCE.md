# Round-9 candidate evidence — Fjord Coast

**Candidate: `3bf5a7e`** (branch `pass4-fjord`). Every image here was rendered from the production build
(`npm run build`, served by `vite preview`) by `tools/biome_evidence.mjs` in headless Chrome with SwiftShader
(software rendering: judge art and composition, never frame rate). Page errors in every manifest: 0.

## Which build drew which shot
The capture ran in parts (the machine's environment restarted twice; each part is a fresh browser session):

| Shots | Build | Manifest |
|---|---|---|
| `01`–`06`, `09`, `09d` | `c9ffd1b` | lost with the first restart (the tool writes its manifest at the end of a run); poses are the tool's fixed poses, as in round 8 |
| `09b`, `09c`, `10*`, `11*`, `12*`, `14`, `15`, `16` | `c9ffd1b` | `manifest-snowball_finish_victory_gate_gap_viewpoint_cornice_arm.json` |
| `07`, `07b`, `08*` (Sprint) and all of `standard/` | `3bf5a7e` (the Sprint manifest reads `3bf5a7e+dirty`: when it started, the browser suite had just rewritten tracked screenshot PNGs under `docs/`; no source file was modified) | `manifest-cave_cinematic.json`, `standard/manifest-cave_cinematic.json` |
| `res-1366/`, `res-2560/` (menu, summit, finish) | `c9ffd1b` | their `manifest-menu_summit_finish.json` |

`git diff c9ffd1b 3bf5a7e -- src` touches only `src/world/caveTerrain.ts` (the heightfield just inside a cave
mouth's jamb: a 1 m grid vertex drew a white wedge of snow inside the opening on the Standard cave, over the
Yeti in the emergence shot). (Between `e0e2eca` and `3bf5a7e` the cap's margin was narrowed from 1.5 m to 0.5 m: the wider margin lowered the ground under the rock jamb and opened holes beside the Sprint mouth.) The cave and cinematic shots were re-rendered on `3bf5a7e`; no other shot shows a
cave mouth at a scale where that vertex is visible. The other change in that range is the evidence tool:
`settle()` now also refines the terrain around the skier to its wanted LOD after a camera move (a half-built terrain LOD showed through the Sprint cave mouth in an earlier render).

## Method notes
- `settle()` (since round 8) hands the scenery the real camera position and flushes queued scenery and
  terrain builds after a free-camera move — what a GPU frame loop reaches within about a second.
- Course: Classic · Sprint (3 km) unless the folder says Standard (10 km). Normal difficulty; `09b`/`09c` Hard.
- `probe-*.json`: pixel-probe diagnostics (which object draws given pixels).

## Performance (`perf/`) — CPU only; no GPU claims
- Perf runs below are on `e0e2eca` (identical to `3bf5a7e` except the cave-mouth terrain).
- **Production bundle in Chrome** (`tools/prod_frames.mjs`, 12 km Endless, skilled autopilot, high quality;
  CPU per simulated frame: session, physics, Yeti, hazards, World.update with all streaming at the shipped
  6 ms budget):

| | median | p95 | p99 | max | frames > 8 ms | > 16 ms | > 33 ms | heap |
|---|---|---|---|---|---|---|---|---|
| Fjord | 3 ms | 9.8 | 11.9 | 31.6 | 4785 / 34890 | 27 | 0 | 158.7 MB |
| Alpine | 0.5 ms | 7.5 | 8.2 | 19.1 | 435 / 32849 | 12 | 0 | 121.8 MB |

  The software-rendered frames taken every 240 steps (median 6641 ms Fjord,
  4671 ms Alpine) are SwiftShader numbers and say nothing about a GPU.
- **Node replay of the real World** (round-4 harness, 16 km Endless, high, shipped budget; no scans in Node):
  Fjord median 4.0 ms, p99 11.96, max 27.19, 6 frames > 16 ms, 0 > 33 ms
  (round 8: 55 and 5); Alpine 0.0 / 8.01 / 35.86, 4 and 1.
- Fjord is still heavier than Alpine (its streaming budget is in use most frames: cliffs, islands, hamlets,
  water), but every percentile up to p99 is inside one 60 Hz frame and no frame passed 33 ms in either run.

## Shots with a manifest
| File | Build | Phase | z (m) | What it shows |
|---|---|---|---|---|
| `09b_hard_snowball.png` | c9ffd1b | chase | 1179.8748668979836 | Hard: the Yeti winds up / releases a snowball during ordinary chase gameplay (rear view + landing marker) |
| `09c_hard_snowball_marker.png` | c9ffd1b | chase | 1188.0511324444878 | Hard: snowball in flight, landing marker on the snow |
| `10_finish.png` | c9ffd1b | chase | 2740.009521656621 | Finish environment from above the run-out |
| `10b_finish_ground.png` | c9ffd1b | chase | 2740.009521656621 | Finish environment at eye level |
| `11d_victory_quay.png` | c9ffd1b | victory | 3020.281286566811 | Victory: onto the quay (low tracking shot down the street to the water) |
| `11e_victory_racks.png` | c9ffd1b | victory | 3019.785402660341 | Victory: the Yeti arrives at the stockfish rack on the quay |
| `11f_victory_gag.png` | c9ffd1b | victory | 3019.785402660341 | Victory: the Yeti turns to us and bites the dried cod |
| `11f2_victory_gag_face.png` | c9ffd1b | victory | 3019.785402660341 | Victory: the gag (his face), the harbour behind |
| `11g_victory_present.png` | c9ffd1b | victory | 3019.785402660341 | Victory: the harbourmaster presents the trophy in both hands (over the shoulder) |
| `11_victory_trophy.png` | c9ffd1b | victory | 3019.785402660341 | Victory: the trophy caught and held up (reverse angle) |
| `11b_victory_celebration.png` | c9ffd1b | victory | 3019.785402660341 | Victory: apres on the pier (tub, bonfire, sauna), the bather sprinting for the edge |
| `11j_victory_plunge.png` | c9ffd1b | victory | 3019.785402660341 | Victory: the cannonball (tucked, at the top of its arc) |
| `11h_victory_splash.png` | c9ffd1b | victory | 3019.785402660341 | Victory: the crown splash |
| `11i_victory_reveal_mid.png` | c9ffd1b | victory | 3019.785402660341 | Victory: the reveal, mid-move |
| `11c_victory_reveal.png` | c9ffd1b | victory | 3019.785402660341 | Victory: the closing reveal, settled (the start beacon, the title) |
| `12_wind_gate_gust.png` | c9ffd1b | chase | 779.7489191083247 | Wind gate (id 12288) in the gust (active): windsock flying, spindrift funnelled through the notch (sea side, frame right); drifted lee behind the rib (frame left) |
| `12b_wind_gate_lull.png` | c9ffd1b | chase | 894.298820930666 | The same wind gate in the lull (dormant): windsock limp, the notch is free |
| `14_viewpoint.png` | c9ffd1b | chase | 2390.959401616361 | Scenic viewpoint at z≈2491 (chase stretch): the platform and the view over the fjord |
| `15_cornice_relocation.png` | c9ffd1b | chase | 1345.5297899156499 | Cornice relocation cue: the skier sent over the rim at z≈1350 is put back on the piste (relocated) with the title and caption |
| `16_expedition_arm.png` | c9ffd1b | chase | 5379.027951592727 | Expedition: ordinary chase gameplay beside fjord arm 1 (z 2802–5748), rear view showing the Yeti |
| `07_yeti_cave.png` | e0e2eca | foreshadow | 207.00137182657545 | The Yeti cave with the location dressing, before the encounter |
| `07b_yeti_cave_outlook.png` | e0e2eca | foreshadow | 207.00137182657545 | Fjord: the sea cave from inside its mouth, looking out past the basalt portal (the mouth faces inland, toward the piste) |
| `08c_yeti_cinematic_gulls.png` | e0e2eca | caveCinematic | 282.12625616063315 | Cave cinematic, t≈2.95 s (Fjord: gulls burst off the basalt portal on the rumble) |
| `08_yeti_cinematic.png` | e0e2eca | caveCinematic | 282.12625616063315 | Cave cinematic, t≈9.5 s (Fjord: the emergence seen from inside the sea cave, the Yeti against the fjord) |
| `08d_yeti_cinematic_roar.png` | e0e2eca | caveCinematic | 282.12625616063315 | Cave cinematic, t≈11.65 s (Fjord: the roar blows spray and sea smoke out of the mouth; the lintel icicles drop and shatter) |
| `08b_yeti_cinematic.png` | e0e2eca | caveCinematic | 282.12625616063315 | Cave cinematic, t≈15.0 s (Fjord: the leap from the ledge, down onto the skier) |
| `standard/07_yeti_cave.png` | e0e2eca | foreshadow | 907.0101461104098 | The Yeti cave with the location dressing, before the encounter |
| `standard/07b_yeti_cave_outlook.png` | e0e2eca | foreshadow | 907.0101461104098 | Fjord: the sea cave from inside its mouth, looking out past the basalt portal (the mouth faces inland, toward the piste) |
| `standard/08c_yeti_cinematic_gulls.png` | e0e2eca | caveCinematic | 982.2265020359471 | Cave cinematic, t≈2.95 s (Fjord: gulls burst off the basalt portal on the rumble) |
| `standard/08_yeti_cinematic.png` | e0e2eca | caveCinematic | 982.2265020359471 | Cave cinematic, t≈9.5 s (Fjord: the emergence seen from inside the sea cave, the Yeti against the fjord) |
| `standard/08d_yeti_cinematic_roar.png` | e0e2eca | caveCinematic | 982.2265020359471 | Cave cinematic, t≈11.65 s (Fjord: the roar blows spray and sea smoke out of the mouth; the lintel icicles drop and shatter) |
| `standard/08b_yeti_cinematic.png` | e0e2eca | caveCinematic | 982.2265020359471 | Cave cinematic, t≈15.0 s (Fjord: the leap from the ledge, down onto the skier) |
| `res-1366/01_menu.png` | c9ffd1b | menu | — | Main menu, Location row focused; the location preview runs behind the menu |
| `res-1366/02_summit.png` | c9ffd1b | learn | 2.185463865401224 | Summit: start gate and the descent ahead |
| `res-1366/10_finish.png` | c9ffd1b | chase | 2740.009521656621 | Finish environment from above the run-out |
| `res-1366/10b_finish_ground.png` | c9ffd1b | chase | 2740.009521656621 | Finish environment at eye level |
| `res-2560/01_menu.png` | c9ffd1b | menu | — | Main menu, Location row focused; the location preview runs behind the menu |
| `res-2560/02_summit.png` | c9ffd1b | learn | 2.185463865401224 | Summit: start gate and the descent ahead |
| `res-2560/10_finish.png` | c9ffd1b | chase | 2740.009521656621 | Finish environment from above the run-out |
| `res-2560/10b_finish_ground.png` | c9ffd1b | chase | 2740.009521656621 | Finish environment at eye level |
