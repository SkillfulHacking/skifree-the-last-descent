# Round-8 candidate evidence — Fjord Coast

- **Build:** `d1f642b` (branch `pass4-fjord`; working tree clean at capture: the SHA carries no `+dirty`).
- **Captured:** 2026-11-13T14:09:43.425Z by `node tools/biome_evidence.mjs fjord classic:sprint <dir> 1920x1080 http://127.0.0.1:4471 all` against `npm run build` output served by `vite preview` (the production bundle; `?debug` harness only for camera placement).
- **Renderer:** headless Chrome with SwiftShader (software). Judge art and composition, not anti-aliasing or frame rate. 15860 s for 36 shots. Page errors: 0.
- **Course:** Classic · Sprint (3 km), seed of the Classic course, Normal difficulty unless a shot says Hard.
- **Method change in round 8:** `settle()` in the harness lets the frame after a camera move run, then
  hands the scenery the real camera position and flushes the queued scenery builds. Before round 8 the
  debug free camera was applied after the world update, so the cliff stream kept the LOD for the chase
  camera near the skier; distant free-camera shots (notably `06`) showed the finest cliff LOD from
  1.3 km, which a player never sees from there. Gameplay and cinematic cameras are set before the world
  update and are unaffected.
- `probe-long.json`, `probe-menu.json`: the pixel probe's output (which object draws given pixels), kept as
  diagnostic data. Per-shot camera pose, phase, z and cinematic time are in `manifest.json`.
- Other sets (same build): `res-1366/` and `res-2560/` (menu, summit, pursuit, finish), `standard/` (cave and
  cinematic on a Classic · Standard course).

| File | Phase | z (m) | What it shows |
|---|---|---|---|
| `01_menu.png` | menu | — | Main menu, Location row focused; the location preview runs behind the menu |
| `02_summit.png` | learn | 2.185463865401224 | Summit: start gate and the descent ahead |
| `03_mid_mountain.png` | chase | 1500.0065124927348 | Mid-mountain at z=1500 |
| `04_signature_hazard.png` | chase | 281.7552831549047 | sea-gust (id 4096) in its active phase; kinds near: scoured-rock,sea-gust |
| `04b_hazard_rock.png` | chase | 325.32148219347 | scoured-rock (streamed view at x -13, z 445): exposed rock beside the racing line |
| `04c_hazard_rock_mid.png` | chase | 325.32148219347 | scoured-rock from ~100 m (mid-distance readability) |
| `05_material.png` | chase | 1080.0023285533123 | Terrain material close-up at the rim, z=1080 |
| `06_long_distance.png` | chase | 900.015106836885 | Long-distance composition across the valley / fjord |
| `07_yeti_cave.png` | foreshadow | 207.00137182657545 | The Yeti cave with the location dressing, before the encounter |
| `07b_yeti_cave_outlook.png` | foreshadow | 207.00137182657545 | Fjord: the sea cave from inside its mouth, looking out past the basalt portal (the mouth faces inland, toward the piste) |
| `08c_yeti_cinematic_gulls.png` | caveCinematic | 282.12625616063315 | Cave cinematic, t≈2.95 s (Fjord: gulls burst off the basalt portal on the rumble) |
| `08_yeti_cinematic.png` | caveCinematic | 282.12625616063315 | Cave cinematic, t≈9.5 s (Fjord: the emergence seen from inside the sea cave, the Yeti against the fjord) |
| `08d_yeti_cinematic_roar.png` | caveCinematic | 282.12625616063315 | Cave cinematic, t≈11.65 s (Fjord: the roar blows spray and sea smoke out of the mouth; the lintel icicles drop and shatter) |
| `08b_yeti_cinematic.png` | caveCinematic | 282.12625616063315 | Cave cinematic, t≈15.0 s (Fjord: the leap from the ledge, down onto the skier) |
| `09_pursuit.png` | chase | 388.8547359971066 | Ordinary chase gameplay, normal follow camera, rear view showing the Yeti |
| `09d_pursuit_rim.png` | chase | 2420.3671238199763 | Ordinary chase camera where the run passes closest to the rim (z≈2440, 51 m from the cliff edge) |
| `09b_hard_snowball.png` | chase | 1179.8748668979836 | Hard: the Yeti winds up / releases a snowball during ordinary chase gameplay (rear view + landing marker) |
| `09c_hard_snowball_marker.png` | chase | 1188.0511324444878 | Hard: snowball in flight, landing marker on the snow |
| `10_finish.png` | chase | 2740.009521656621 | Finish environment from above the run-out |
| `10b_finish_ground.png` | chase | 2740.009521656621 | Finish environment at eye level |
| `11d_victory_quay.png` | victory | 3020.281286566811 | Victory: onto the quay (low tracking shot down the street to the water) |
| `11e_victory_racks.png` | victory | 3019.785402660341 | Victory: the Yeti arrives at the stockfish rack on the quay |
| `11f_victory_gag.png` | victory | 3019.785402660341 | Victory: the Yeti turns to us and bites the dried cod |
| `11f2_victory_gag_face.png` | victory | 3019.785402660341 | Victory: the gag (his face), the harbour behind |
| `11g_victory_present.png` | victory | 3019.785402660341 | Victory: the harbourmaster presents the trophy in both hands (over the shoulder) |
| `11_victory_trophy.png` | victory | 3019.785402660341 | Victory: the trophy caught and held up (reverse angle) |
| `11b_victory_celebration.png` | victory | 3019.785402660341 | Victory: apres on the pier (tub, bonfire, sauna), the bather sprinting for the edge |
| `11j_victory_plunge.png` | victory | 3019.785402660341 | Victory: the cannonball (tucked, at the top of its arc) |
| `11h_victory_splash.png` | victory | 3019.785402660341 | Victory: the crown splash |
| `11i_victory_reveal_mid.png` | victory | 3019.785402660341 | Victory: the reveal, mid-move |
| `11c_victory_reveal.png` | victory | 3019.785402660341 | Victory: the closing reveal, settled (the start beacon, the title) |
| `12_wind_gate_gust.png` | chase | 779.7489191083247 | Wind gate (id 12288) in the gust (active): windsock flying, spindrift funnelled through the notch (sea side, frame right); drifted lee behind the rib (frame left) |
| `12b_wind_gate_lull.png` | chase | 894.298820930666 | The same wind gate in the lull (dormant): windsock limp, the notch is free |
| `14_viewpoint.png` | chase | 2390.959401616361 | Scenic viewpoint at z≈2491 (chase stretch): the platform and the view over the fjord |
| `15_cornice_relocation.png` | chase | 1345.5297899156499 | Cornice relocation cue: the skier sent over the rim at z≈1350 is put back on the piste (relocated) with the title and caption |
| `16_expedition_arm.png` | chase | 5379.027951592727 | Expedition: ordinary chase gameplay beside fjord arm 1 (z 2802–5748), rear view showing the Yeti |
