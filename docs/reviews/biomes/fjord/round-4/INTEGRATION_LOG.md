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
