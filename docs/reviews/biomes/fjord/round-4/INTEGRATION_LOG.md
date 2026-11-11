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
