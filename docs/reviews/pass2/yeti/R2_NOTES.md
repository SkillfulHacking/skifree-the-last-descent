# Yeti round-2 progress notes

(Working notes; survive environment restarts. Newest at the bottom.)

## State at pick-up (79a843e)
- WIP already in: shared `uShade` uniform injected into skin/shell/cards/hard/eyes (setShade → k²), warm fur palette,
  shell undercoat capped (uShellMax 3.5 cm), lock cards 19000 @high (4 segs, LOCK_VARIANTS=8 atlas), HEAD_SCALE 1.3 +
  HEAD_LIFT, furred backs of hands/feet, gallop stretched, crawl hind legs under the body, leap pounce pose.
- tsc clean, vitest 107/107 at pick-up.
- Round-1 high tris (preview overlay, incl. shadow pass): 832,212. r2_face_front (WIP) overlay: 817,427.
- Tooling: /tmp/y2/shots.mjs (copy of previous engineer's /tmp/yshot/shots.mjs), vite no-HMR on :5334
  (`npx vite --config /tmp/y2/vcfg/vite.nohmr.mjs --port 5334 --strictPort`), `YPORT=5334 node /tmp/y2/shots.mjs W H outdir name=query ...`

## Session 2 (21:00)
- FOUND: the blue/dark "screen-door" speckle over the fur (A15 dithering, and the speckle that stayed in the dark at
  setShade(0)) is the A2C fur writing fractional alpha into the drawing buffer; headless Chrome composites the canvas
  over the page background (#8fc3ea in preview, #0b1624 in game). Fix: shells+cards draw with colorMask(rgb, no alpha)
  (YetiModel onBeforeRender/onAfterRender). shade=0 crop now exactly (0,0,0) (was max (84,114,135)).
- Main-pass tris at pick-up: 722,423 (body 61.5k, shells 501k (9×55.7k), cards 153.7k, hard 4.7k, eyes 1.5k).
- preview: added hide=<mesh names> to isolate layers.
- Shell lattice stretched along the comb direction (body down/back, head sweeps back): directional dashes.
  Shell root AO 0.6..1. Belly/hips/thigh card weights raised (hips .6, spine1 .55, spine2 .75, thigh .7, chest cut 15%).
- HEAD_SCALE 1.3 → 1.42.
- Gallop: hips pitch .8, lower hips, hands land 1.6 m ahead with a low (×0.75) recovery, feet 0.42 m back. Extended
  phase (t=1.25) reads clearly; collected phase (t=1.07) is still compact but limbs separate.
