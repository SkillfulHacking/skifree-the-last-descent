/**
 * Procedural canvas textures for the resort (wood, stone, planks, signage, particles, env cube).
 * Everything is generated once and cached per module instance.
 */
import * as THREE from 'three';
import { Rand, fbm2, vnoise } from './util';

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2d canvas unavailable');
  return [c, ctx];
}

function tex(c: HTMLCanvasElement, srgb = true, repeat = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

/** Build a tangent-space normal map from a greyscale height buffer (0..1). */
function normalFromHeight(h: Float32Array, w: number, hh: number, strength: number): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(w, hh);
  const img = ctx.createImageData(w, hh);
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w;
      const xr = (x + 1) % w;
      const yu = (y - 1 + hh) % hh;
      const yd = (y + 1) % hh;
      const dx = (h[y * w + xr]! - h[y * w + xl]!) * strength;
      const dy = (h[yd * w + x]! - h[yu * w + x]!) * strength;
      const nx = -dx;
      const ny = dy;
      const nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, false);
}

function heightFromCanvas(ctx: CanvasRenderingContext2D, w: number, h: number): Float32Array {
  const d = ctx.getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = (d[i * 4]! + d[i * 4 + 1]! + d[i * 4 + 2]!) / 765;
  return out;
}

export interface PbrTex {
  map: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
}

/** Log surface: grain runs along canvas Y (= cylinder axis after mapping). */
export function logTexture(size = 512): PbrTex {
  const W = size / 2;
  const H = size;
  const [c, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  const hgt = new Float32Array(W * H);
  const rnd = new Rand(17);
  const knots: Array<[number, number, number]> = [];
  for (let i = 0; i < 6; i++) knots.push([rnd.range(0, W), rnd.range(0, H), rnd.range(4, 9)]);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const v = y / H;
      // warped grain along Y
      let warp = fbm2(u * 6, v * 1.5, 3) * 3.0;
      let kn = 0;
      for (const [kx, ky, kr] of knots) {
        const dx = x - kx;
        const dy = (y - ky) * 0.55;
        const d = Math.hypot(dx, dy);
        if (d < kr * 3) {
          warp += (kr * 3 - d) / (kr * 3) * Math.sin(Math.atan2(dy, dx)) * 0.8;
        }
        if (d < kr) kn = Math.max(kn, 1 - d / kr);
      }
      const g = Math.sin((u * 38 + warp) * Math.PI);
      const fine = vnoise(u * 160, v * 12);
      const grain = 0.5 + 0.5 * g;
      // shrink cracks ("checking"): thin dark vertical lines
      const crack = Math.max(0, 1 - Math.abs(Math.sin((u * 3 + fbm2(u * 2, v * 3, 2) * 0.6) * Math.PI)) * 60) * (fbm2(u * 5, v * 2.5, 2) > 0.55 ? 1 : 0);
      let br = 0.62 + grain * 0.18 + fine * 0.12 - crack * 0.45 - kn * 0.35;
      br *= 0.9 + fbm2(u * 3, v * 0.7, 3) * 0.25;
      const i = (y * W + x) * 4;
      img.data[i] = Math.min(255, 168 * br + 22);
      img.data[i + 1] = Math.min(255, 112 * br + 14);
      img.data[i + 2] = Math.min(255, 62 * br + 8);
      img.data[i + 3] = 255;
      hgt[y * W + x] = grain * 0.4 + fine * 0.3 - crack * 0.9 - kn * 0.2;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c), normal: normalFromHeight(hgt, W, H, 2.2) };
}

/** Log end grain (tree rings). */
export function logEndTexture(): THREE.CanvasTexture {
  const S = 128;
  const [c, ctx] = makeCanvas(S, S);
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x / S - 0.5;
      const dy = y / S - 0.5;
      const r = Math.hypot(dx, dy) * 2 + vnoise(x * 0.08, y * 0.08) * 0.06;
      const ring = 0.5 + 0.5 * Math.sin(r * 55);
      let rr = 214 - ring * 40;
      let gg = 168 - ring * 34;
      let bb = 110 - ring * 26;
      if (r > 0.86) {
        rr = 92;
        gg = 62;
        bb = 40;
      }
      const i = (y * S + x) * 4;
      img.data[i] = rr;
      img.data[i + 1] = gg;
      img.data[i + 2] = bb;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, true, false);
}

/** Fieldstone masonry. */
export function stoneTexture(size = 512): PbrTex {
  const S = size;
  const [c, ctx] = makeCanvas(S, S);
  const rnd = new Rand(91);
  ctx.fillStyle = '#5d5953';
  ctx.fillRect(0, 0, S, S);
  const hctx = makeCanvas(S, S)[1];
  hctx.fillStyle = '#000';
  hctx.fillRect(0, 0, S, S);
  let y = 0;
  while (y < S) {
    const rowH = rnd.range(S * 0.08, S * 0.14);
    let x = -rnd.range(0, S * 0.1);
    while (x < S) {
      const w = rnd.range(S * 0.1, S * 0.24);
      const pad = S * 0.012;
      const base = rnd.range(0.55, 0.9);
      const tint = rnd.next();
      const r = Math.round((122 + tint * 40) * base);
      const g = Math.round((116 + tint * 22) * base);
      const b = Math.round((106 + (1 - tint) * 18) * base);
      for (const dx of [0, S, -S]) {
        for (const dy of [0, S, -S]) {
          const rx = x + pad + dx;
          const ry = y + pad + dy;
          const rw = w - pad * 2;
          const rh = rowH - pad * 2;
          const rad = Math.min(rw, rh) * 0.35;
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.beginPath();
          ctx.roundRect(rx, ry, rw, rh, rad);
          ctx.fill();
          // top-left highlight / bottom shadow for depth
          const grd = ctx.createLinearGradient(rx, ry, rx, ry + rh);
          grd.addColorStop(0, 'rgba(255,255,255,0.18)');
          grd.addColorStop(0.5, 'rgba(255,255,255,0)');
          grd.addColorStop(1, 'rgba(0,0,0,0.25)');
          ctx.fillStyle = grd;
          ctx.fill();
          const hg = hctx.createRadialGradient(rx + rw / 2, ry + rh / 2, 1, rx + rw / 2, ry + rh / 2, Math.max(rw, rh) * 0.6);
          hg.addColorStop(0, '#fff');
          hg.addColorStop(1, '#888');
          hctx.fillStyle = hg;
          hctx.beginPath();
          hctx.roundRect(rx, ry, rw, rh, rad);
          hctx.fill();
        }
      }
      x += w;
    }
    y += rowH;
  }
  // speckle + lichen
  const img = ctx.getImageData(0, 0, S, S);
  for (let yy = 0; yy < S; yy++) {
    for (let xx = 0; xx < S; xx++) {
      const i = (yy * S + xx) * 4;
      const n = (vnoise(xx * 0.15, yy * 0.15) - 0.5) * 30 + (Math.random() - 0.5) * 14;
      img.data[i] = Math.max(0, Math.min(255, img.data[i]! + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1]! + n));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2]! + n));
    }
  }
  ctx.putImageData(img, 0, 0);
  const h = heightFromCanvas(hctx, S, S);
  return { map: tex(c), normal: normalFromHeight(h, S, S, 4) };
}

/** Weathered deck planks; boards run along canvas X. */
export function plankTexture(size = 512): PbrTex {
  const S = size;
  const [c, ctx] = makeCanvas(S, S);
  const img = ctx.createImageData(S, S);
  const hgt = new Float32Array(S * S);
  const boards = 8;
  const rnd = new Rand(5);
  const tones: number[] = [];
  const offs: number[] = [];
  for (let i = 0; i < boards; i++) {
    tones.push(rnd.range(0.8, 1.1));
    offs.push(rnd.range(0, 1));
  }
  for (let y = 0; y < S; y++) {
    const bi = Math.floor((y / S) * boards);
    const by = ((y / S) * boards) % 1;
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const seamX = (u + offs[bi]!) % 1;
      const endGap = seamX < 0.006 ? 1 : 0;
      const gap = by < 0.06 || by > 0.96 || endGap ? 1 : 0;
      const grain = 0.5 + 0.5 * Math.sin((by * 9 + fbm2(u * 4, by * 2 + bi, 3) * 4) * Math.PI);
      const n = vnoise(u * 90, y * 0.4);
      const nail = (Math.hypot(((seamX + 0.03) % 0.5) * S - 8, (by - 0.5) * (S / boards)) < 2.2) ? 1 : 0;
      let br = (0.55 + grain * 0.18 + n * 0.12) * tones[bi]!;
      if (gap) br = 0.18;
      if (nail) br = 0.25;
      const i = (y * S + x) * 4;
      img.data[i] = Math.min(255, 150 * br + 25);
      img.data[i + 1] = Math.min(255, 104 * br + 18);
      img.data[i + 2] = Math.min(255, 68 * br + 12);
      img.data[i + 3] = 255;
      hgt[y * S + x] = gap ? 0 : 0.6 + grain * 0.15 + n * 0.1;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c), normal: normalFromHeight(hgt, S, S, 3) };
}

/** Subtle snow sparkle/lumps (map near white). */
export function snowTexture(): PbrTex {
  const S = 256;
  const [c, ctx] = makeCanvas(S, S);
  const img = ctx.createImageData(S, S);
  const hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = fbm2((x / S) * 8, (y / S) * 8, 4);
      const v = 236 + n * 19;
      const i = (y * S + x) * 4;
      img.data[i] = v - 4;
      img.data[i + 1] = v - 1;
      img.data[i + 2] = 255;
      img.data[i + 3] = 255;
      hgt[y * S + x] = n;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c), normal: normalFromHeight(hgt, S, S, 1.5) };
}

/** Warm window interior (emissive map): lit room seen through glass — beams, lamps, fireplace, curtains. */
export function windowTexture(): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const [c, ctx] = makeCanvas(W, H);
  // back wall: warm with falloff
  const g = ctx.createRadialGradient(W * 0.5, H * 0.62, 6, W * 0.5, H * 0.55, W * 0.75);
  g.addColorStop(0, '#ffd08a');
  g.addColorStop(0.4, '#e98a3c');
  g.addColorStop(1, '#5a240c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // log wall lines inside
  ctx.strokeStyle = 'rgba(90,40,12,0.35)';
  ctx.lineWidth = 3;
  for (let y = 14; y < H * 0.7; y += 18) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // ceiling beams
  ctx.fillStyle = 'rgba(50,20,6,0.8)';
  ctx.fillRect(0, 0, W, H * 0.07);
  for (const x of [0.18, 0.5, 0.82]) ctx.fillRect(W * x - 7, 0, 14, H * 0.12);
  // pendant lamps
  for (const x of [0.3, 0.7]) {
    ctx.strokeStyle = 'rgba(40,15,5,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W * x, 0);
    ctx.lineTo(W * x, H * 0.22);
    ctx.stroke();
    const lg = ctx.createRadialGradient(W * x, H * 0.25, 2, W * x, H * 0.25, 34);
    lg.addColorStop(0, 'rgba(255,250,225,1)');
    lg.addColorStop(0.3, 'rgba(255,210,140,0.7)');
    lg.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(W * x - 40, H * 0.25 - 40, 80, 80);
  }
  // stone fireplace with glowing hearth (centre-right)
  ctx.fillStyle = 'rgba(70,55,45,0.9)';
  ctx.fillRect(W * 0.56, H * 0.35, W * 0.3, H * 0.65);
  const fg = ctx.createRadialGradient(W * 0.71, H * 0.86, 2, W * 0.71, H * 0.86, 36);
  fg.addColorStop(0, '#fff3b0');
  fg.addColorStop(0.4, '#ff9a2a');
  fg.addColorStop(1, '#5a1a04');
  ctx.fillStyle = fg;
  ctx.fillRect(W * 0.62, H * 0.74, W * 0.18, H * 0.2);
  // sofa + armchair silhouettes and a seated figure
  ctx.fillStyle = 'rgba(60,20,8,0.85)';
  ctx.beginPath();
  ctx.roundRect(W * 0.04, H * 0.72, W * 0.46, H * 0.3, 14);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.22, H * 0.64, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(W * 0.18, H * 0.66, 26, 34);
  // curtains
  const cg = ctx.createLinearGradient(0, 0, W * 0.14, 0);
  cg.addColorStop(0, 'rgba(110,22,18,0.95)');
  cg.addColorStop(1, 'rgba(150,35,22,0.0)');
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, W * 0.14, H);
  ctx.save();
  ctx.translate(W, 0);
  ctx.scale(-1, 1);
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, W * 0.14, H);
  ctx.restore();
  return tex(c, true, false);
}

/** Banner for the finish arch. */
export function bannerTexture(): THREE.CanvasTexture {
  const W = 2048;
  const H = 160;
  const [c, ctx] = makeCanvas(W, H);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#13234a');
  bg.addColorStop(1, '#0b1630');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // speed slashes
  const slash = (x: number, w: number, col: string): void => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + 40, 0);
    ctx.lineTo(x + 40 + w, 0);
    ctx.lineTo(x + w, H);
    ctx.closePath();
    ctx.fill();
  };
  // central plate
  ctx.fillStyle = '#e6362b';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 430, H);
  ctx.lineTo(W / 2 - 380, 0);
  ctx.lineTo(W / 2 + 430, 0);
  ctx.lineTo(W / 2 + 380, H);
  ctx.closePath();
  ctx.fill();
  slash(W / 2 - 470, 18, '#ffb02e');
  slash(W / 2 + 448, 18, '#ffb02e');
  slash(W / 2 - 510, 9, '#ffffff');
  slash(W / 2 + 492, 9, '#ffffff');
  // stripes top & bottom
  ctx.fillStyle = '#ffb02e';
  ctx.fillRect(0, 0, W, 6);
  ctx.fillRect(0, H - 6, W, 6);
  // FINISH
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 900 128px "Inter Display", "Inter", "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.save();
  ctx.translate(W / 2, H / 2 + 6);
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowOffsetX = 5;
  ctx.shadowOffsetY = 4;
  const letters = 'FINISH';
  const spacing = 104;
  for (let i = 0; i < letters.length; i++) ctx.fillText(letters[i]!, (i - (letters.length - 1) / 2) * spacing, 0);
  ctx.restore();
  // side branding repeated
  const brand = (cx: number): void => {
    ctx.save();
    ctx.translate(cx, H / 2);
    // mountain glyph
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-250, 34);
    ctx.lineTo(-212, -30);
    ctx.lineTo(-196, -6);
    ctx.lineTo(-180, -36);
    ctx.lineTo(-140, 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#13234a';
    ctx.beginPath();
    ctx.moveTo(-212, -30);
    ctx.lineTo(-202, -14);
    ctx.lineTo(-212, -18);
    ctx.lineTo(-222, -12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffb02e';
    ctx.fillRect(-250, 38, 110, 5);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 22px "Inter", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('T H E   L A S T', -122, -22);
    ctx.font = 'italic 900 50px "Inter Display", "Inter", "Arial Black", Arial, sans-serif';
    ctx.fillText('DESCENT', -124, 18);
    ctx.restore();
  };
  brand(260);
  brand(W - 340);
  return tex(c, true, false);
}

/** Atlas: top = podium backdrop & A-board branding (1024x512), bottom row = podium numbers. */
export function brandAtlas(): THREE.CanvasTexture {
  const W = 1024;
  const H = 1024;
  const [c, ctx] = makeCanvas(W, H);
  // --- Backdrop (0..1024 x 0..512)
  const bg = ctx.createLinearGradient(0, 0, W, 512);
  bg.addColorStop(0, '#0d1a3a');
  bg.addColorStop(1, '#1c3270');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, 512);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let i = -10; i < 30; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 60, 512);
    ctx.lineTo(i * 60 + 280, 0);
    ctx.stroke();
  }
  // big mountain with yeti footprint
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(312, 250);
  ctx.lineTo(432, 70);
  ctx.lineTo(482, 140);
  ctx.lineTo(530, 90);
  ctx.lineTo(712, 250);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#e6362b';
  ctx.beginPath();
  ctx.moveTo(312, 250);
  ctx.lineTo(712, 250);
  ctx.lineTo(712, 262);
  ctx.lineTo(312, 262);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 40px "Inter", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('T H E    L A S T', W / 2, 315);
  ctx.font = 'italic 900 118px "Inter Display", "Inter", "Arial Black", Arial, sans-serif';
  ctx.fillText('DESCENT', W / 2, 400);
  ctx.fillStyle = '#ffb02e';
  ctx.font = '700 26px "Inter", Arial, sans-serif';
  ctx.fillText('SUMMIT  ·  CAVE  ·  FINISH', W / 2, 475);
  // --- A-board strip (0..1024 x 512..640): white/red
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 512, W, 128);
  ctx.fillStyle = '#e6362b';
  ctx.fillRect(0, 512, 170, 128);
  ctx.fillStyle = '#13234a';
  ctx.font = 'italic 900 78px "Inter Display", "Inter", "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THE LAST DESCENT', 200, 580);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(30, 610);
  ctx.lineTo(75, 535);
  ctx.lineTo(95, 565);
  ctx.lineTo(115, 540);
  ctx.lineTo(150, 610);
  ctx.fill();
  // A-board strip 2 (640..768): navy
  ctx.fillStyle = '#13234a';
  ctx.fillRect(0, 640, W, 128);
  ctx.fillStyle = '#ffb02e';
  ctx.fillRect(W - 170, 640, 170, 128);
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 64px "Inter Display", "Inter", Arial, sans-serif';
  ctx.fillText('THE LAST LODGE · APRÈS', 40, 706);
  // --- Numbers (768..1024): three 256 cells + one gold plate
  const nums = ['1', '2', '3'];
  for (let i = 0; i < 3; i++) {
    const x = i * 256;
    ctx.fillStyle = '#13234a';
    ctx.fillRect(x, 768, 256, 256);
    ctx.strokeStyle = '#ffb02e';
    ctx.lineWidth = 10;
    ctx.strokeRect(x + 14, 782, 228, 228);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'italic 900 190px "Inter Display", "Inter", "Arial Black", Arial, sans-serif';
    ctx.fillText(nums[i]!, x + 128, 900);
  }
  // gold engraved plate
  const gg = ctx.createLinearGradient(768, 768, 1024, 1024);
  gg.addColorStop(0, '#f8d77a');
  gg.addColorStop(0.5, '#b8862a');
  gg.addColorStop(1, '#f2cb63');
  ctx.fillStyle = gg;
  ctx.fillRect(768, 768, 256, 256);
  ctx.fillStyle = '#5a3d0c';
  ctx.font = '800 30px "Inter", Arial, sans-serif';
  ctx.fillText('CHAMPION', 896, 880);
  ctx.font = '600 20px "Inter", Arial, sans-serif';
  ctx.fillText('THE LAST DESCENT', 896, 915);
  return tex(c, true, false);
}

/** "THE LAST LODGE" carved wooden sign. */
export function lodgeSignTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 256;
  const [c, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const g = 0.5 + 0.5 * Math.sin((y / H) * 30 + fbm2(x / W * 3, y / H * 6, 3) * 6);
      const br = 0.45 + g * 0.15 + vnoise(x * 0.3, y * 0.05) * 0.1;
      const i = (y * W + x) * 4;
      img.data[i] = 120 * br + 20;
      img.data[i + 1] = 72 * br + 12;
      img.data[i + 2] = 38 * br + 8;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.strokeStyle = 'rgba(30,14,4,0.8)';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, W - 28, H - 28);
  ctx.strokeStyle = 'rgba(255,220,160,0.35)';
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 26, W - 52, H - 52);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 86px "Lora", "DejaVu Serif", Georgia, serif';
  // carved: dark offset then light text
  ctx.fillStyle = 'rgba(25,10,2,0.9)';
  ctx.fillText('THE LAST LODGE', W / 2 + 3, H / 2 + 4);
  ctx.fillStyle = '#f3dfb4';
  ctx.fillText('THE LAST LODGE', W / 2, H / 2);
  ctx.font = '600 26px "Inter", Arial, sans-serif';
  ctx.fillStyle = '#e9c98a';
  ctx.fillText('EST. AT THE BOTTOM OF IT ALL', W / 2, H - 46);
  // little pines
  const pine = (x: number): void => {
    ctx.fillStyle = '#f3dfb4';
    ctx.beginPath();
    ctx.moveTo(x, 50);
    ctx.lineTo(x + 26, 110);
    ctx.lineTo(x - 26, 110);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, 80);
    ctx.lineTo(x + 32, 150);
    ctx.lineTo(x - 32, 150);
    ctx.fill();
    ctx.fillRect(x - 5, 150, 10, 20);
  };
  pine(70);
  pine(W - 70);
  return tex(c, true, false);
}

/** Orange snow fence mesh (alpha). */
export function fenceTexture(): THREE.CanvasTexture {
  const S = 128;
  const [c, ctx] = makeCanvas(S, S);
  ctx.clearRect(0, 0, S, S);
  ctx.strokeStyle = '#ff6a14';
  ctx.lineWidth = 9;
  ctx.lineJoin = 'round';
  // diamond / oval holes pattern (2x2 cells)
  ctx.fillStyle = '#ff6a14';
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'destination-out';
  for (let j = 0; j < 2; j++) {
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 64 + 32, j * 64 + 32, 22, 15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  const t = tex(c, true, true);
  t.anisotropy = 8;
  return t;
}

/** Soft round particle (steam / smoke / glow). */
export function softParticle(): THREE.CanvasTexture {
  const S = 64;
  const [c, ctx] = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return tex(c, false, false);
}

/** A tiny sky/snow environment cube for metals (auto-PMREM'd by three). */
export function envCube(): THREE.CubeTexture {
  const S = 64;
  const faces: HTMLCanvasElement[] = [];
  // order: +x, -x, +y, -y, +z, -z
  for (let f = 0; f < 6; f++) {
    const [c, ctx] = makeCanvas(S, S);
    if (f === 2) {
      const g = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S * 0.7);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.3, '#cfe2ff');
      g.addColorStop(1, '#7fa6d8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    } else if (f === 3) {
      ctx.fillStyle = '#c9d2de';
      ctx.fillRect(0, 0, S, S);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, '#3d6fb8');
      g.addColorStop(0.42, '#bcd3f0');
      g.addColorStop(0.5, '#3a3226');
      g.addColorStop(0.56, '#6b5236');
      g.addColorStop(0.7, '#e8eef6');
      g.addColorStop(1, '#ffffff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
      // warm accents (lodge lights) & dark trees
      ctx.fillStyle = f === 0 ? 'rgba(255,170,80,0.9)' : 'rgba(40,60,45,0.8)';
      ctx.fillRect(S * 0.2, S * 0.45, S * 0.25, S * 0.07);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(S * (0.3 + f * 0.08), S * 0.2, S * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    faces.push(c);
  }
  const t = new THREE.CubeTexture(faces);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
