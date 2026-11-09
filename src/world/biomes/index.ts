/**
 * Registration point for additional biomes (locations). Each biome lives in its own module in this
 * folder and calls `registerBiome(...)` at load time; import it here. This module is imported by
 * src/main.ts before the App (and therefore the settings) is created, so stored selections of
 * these biomes survive a reload. The default biome, alpine, is built into src/world/biome.ts.
 *
 * See docs/BIOMES.md.
 */
// import './dusk';
export {};
