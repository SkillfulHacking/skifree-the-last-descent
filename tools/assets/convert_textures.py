# Poly Haven texture set (4K originals: diffuse JPG, displacement PNG, OpenGL normal EXR, roughness EXR)
# -> 1K WebP intermediates (<name>_{diff,nor,rough,disp}_1k.webp) for pack_scans.py.
# Part of the reproducible asset pipeline: tools/assets/README.md, `npm run assets:build`.
#   python3 tools/assets/convert_textures.py <setDir with textures/> <outDir> 1024
# Requirements: tools/assets/requirements.txt (numpy, Pillow, OpenEXR).
import sys, os, numpy as np, OpenEXR
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
src, out, size = sys.argv[1], sys.argv[2], int(sys.argv[3])
os.makedirs(out, exist_ok=True)
def exr(p):
    f = OpenEXR.File(p)
    ch = f.parts[0].channels
    if 'RGB' in ch: a = ch['RGB'].pixels
    elif 'RGBA' in ch: a = ch['RGBA'].pixels[..., :3]
    elif all(k in ch for k in 'RGB'): a = np.dstack([ch[k].pixels for k in 'RGB'])
    else:
        k = list(ch)[0]; a = ch[k].pixels
    return np.asarray(a, dtype=np.float32)
def load(p):
    if p.endswith('.exr'):
        a = exr(p)
        return a
    im = Image.open(p)
    return im
name = os.path.basename(src.rstrip('/'))
td = os.path.join(src, 'textures')
for f in sorted(os.listdir(td)):
    p = os.path.join(td, f)
    kind = 'diff' if '_diff_' in f else 'nor' if '_nor_gl_' in f else 'rough' if '_rough_' in f else 'disp' if '_disp_' in f else None
    if not kind: continue
    o = os.path.join(out, f'{name}_{kind}_{size//1024}k.webp')
    if p.endswith('.exr'):
        a = exr(p)
        if kind == 'nor':
            # GL normal map stored linear in [0,1]; encode to 8-bit
            a = np.clip(a, 0, 1); im = Image.fromarray((a[..., :3] * 255 + 0.5).astype(np.uint8), 'RGB')
        else:
            if a.ndim == 3: a = a[..., 0]
            a = np.clip(a, 0, 1); im = Image.fromarray((a * 255 + 0.5).astype(np.uint8), 'L')
    else:
        im = Image.open(p)
        if kind in ('rough', 'disp'):
            if im.mode in ('I;16', 'I;16B', 'I'):
                arr = np.asarray(im, dtype=np.float32); arr = arr / (65535.0 if arr.max() > 255 else 255.0)
                im = Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), 'L')
            else: im = im.convert('L')
        else: im = im.convert('RGB')
    im = im.resize((size, size), Image.LANCZOS)
    lossless = kind == 'nor'
    im.save(o, 'WEBP', quality=88 if not lossless else 90, method=6, lossless=False)
    print(o, os.path.getsize(o))
