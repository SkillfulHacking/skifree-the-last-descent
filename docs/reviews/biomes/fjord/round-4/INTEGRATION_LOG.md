# Fjord round 4 — integration log (lead)

Worktree `/home/claude/sf-fjord`, branch `pass4-fjord`. Running log so a successor can continue.

## Done
1. `bee1388` merge `origin/main` (083d0b5, PR #4 + release verification). One conflict:
   `tests/e2e/menu.spec.ts` (screenshot comment/timeout) → main's version.
2. `2155197` merge `fjord-art-r4` (26f5fa0): additive (src/world/art/**, tools/artbake, tools/artscene,
   docs). `npx tsc --noEmit` clean after both merges.

## Next
- vitest baseline after the merges
- integrate cliff kit (biome flag, Mountain height override, streaming through World budget)
- basalt portal as Fjord cave dressing; review changes P-M2, P-M5, P-M6, p1–p4
- Phase B regressions (cave luminance, seaward cinematic, water at grazing angles)
- wind gate visuals; full regression; freeze + evidence
3. vitest after merges: 21 files, 300 tests pass (219 s).
4. Cliff kit in the game (WIP commit): `terrain.coast.cliffKit` (Fjord on). `Mountain.heightAt` →
   `kitHeight` beyond the rim (backing, hamlet strand flats, round-3 heightfield islands kept beyond
   foot+260 m, far shore unchanged); `Mountain.coastHeight` = round-3 height; `cliffKitWeight(z)`
   (0 at headland crests ±520 m and the finish harbour). `src/world/art/cliffModel.ts` (pure model,
   split out of cliffKit.ts; strand carve-out P-M6), `cliffSegmentSteps` (sliced builder; bench
   snow lip p1; gentler AO p6), `src/world/art/cliffStream.ts` (streamed via FjordScenery.pump on
   the shared budget; one material per water level; LOD 520/1400 m). Rock material: thin ice line,
   no snow in the spray zone (p2), Node-safe placeholders. Vegetation: no trees on the backing.
   Hamlet houses placed from the kit foot (16–58 m out).
5. `13dcc2d` (WIP): cave shell = new `basalt_massive` bake (tools/artbake/bake.mjs `SETS=basalt_massive
   SHARP_FROM=/tmp/sharpdir/node_modules node tools/artbake/bake.mjs`; sharp installed in /tmp/sharpdir,
   not in the shared node_modules), columns = baked `basalt` set with per-column tone; old basalt
   shader (×0.32/×0.5 light multipliers) removed; no snow cushions; sparser lintel. Surf ribbon along
   each segment's real waterline (cliffStream foam). Water: grazing-angle fix (Phase B item 4).
   Fjord-only `terrain.rangeSoft` (rounded far-range summits, ≥ 350 m beyond the piste edge).
   Sea framing for the cave cinematic: `views/seaFraming.ts` (stations scored by open-water share
   of the frame, computed in the dressing's slices; `seaShots` on the dressing group). Wind gate
   lee/notch skins + funnelled spindrift (hazardViews gateSkins). Debug `teleport(z, speed, x?, heading?)`.
   Evidence tool: 12/12b wind gate, 13 gap, 14 viewpoint, 15 cornice relocation, 16 Expedition arm.
   Kit continuity fixes: rim limiter (≤ 20 m/m), talus beyond the face foot, fjord head excluded.
   Islands decision: keep the round-3 heightfield islands everywhere (one island language per frame);
   the art-branch island meshes (IslandSet) are not used in the game (reviewer: islands "mixed /
   about the same", composition of the current scatter more pleasing; drums/cakes/saucer defects).

Workflow notes: capture against `npm run build` + `npx vite preview --port 4471` (NOT the dev
server: HMR reloads kill a running capture when sources change).
6. (after a server restart) unit fixes: crest shoulder 2:1 for the first 2 m past the rim then
   ≤ 20 m/m (fjord_cornice.test: a skier stopped at b=0.5 was held by the steep kit backing).
   Sea framing record (tests/unit/fjord_r4_integration): classic Sprint cave z 260: emerge 0.11,
   leap 0.07 water share; custom Standard caves (R4I1–4, z 960): no station sees the water
   (the mouth sits 30–70 m below the rim, mouth faces inland; crane stations up to 75 m tried, none)
   → those keep the three-quarter shot. Known gap.
7. Iteration captures (1280×720, /tmp, not committed) checked by eye: cave shell median ≈ 42/255,
   shell flank ≈ 34, columns ≈ 49, chamber ≈ 1 (iter2 crop medians); chamber sun gate added after a
   sunlit inner wall showed as a tan slab; 08/08b now hold the Yeti with the fjord in frame
   (classic Sprint cave); 11h plunge water reads as water; gate lee ripples + notch glaze visible.
   Full vitest after these: 304 tests, 1 failure (lintel count expectation, updated: intentional).
## Next
- freeze: tsc, vitest, build, full Playwright (PW_PORT=4472) → TESTS.md; candidate SHA
- evidence from the candidate (fresh build + preview 4471): 1920 all + 1366/2560 menu,summit,finish
- frames harness on the candidate → EVIDENCE.md
8. Perf fix (`fjord high 24 km` CPU replay: >16 ms 129 → 2, >33 ms 44 → 0): cliff backing on a 4 m
   column grid (column cache thrash), per-ray slices in the sea framing.
9. Poly Haven CC0 scans (product owner's download, converted outside the repo): packed with
   `tools/artbake/pack_scans.py` (1K albedo+AO / NHR). Rock Face 03 → cave shell (regraded dark,
   4 m tiles; in-game crop medians shell 42/36, columns 45, chamber 2 at 1280×720) and cliff kit
   (regraded cold grey, 9 m tiles). Cliff Side tried on the cliffs: regular bedding tiled into a
   pinstripe → not used, not committed. Aerial Rocks 02 / Coast Sand Rocks 02 not used (no mesh in
   the game takes the rock material there). Interim `basalt_massive` bake removed.
