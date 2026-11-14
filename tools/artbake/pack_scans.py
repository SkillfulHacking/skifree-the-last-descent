# Pack Poly Haven scans (converted WebP) into the rock material layout:
#   <out>_albedo.webp : sRGB diffuse RGB + cavity AO (from displacement) in A
#   <out>_nhr.webp    : normal X, normal Y (OpenGL), height (disp), roughness
import sys, numpy as np
from PIL import Image, ImageFilter
src, name, out = sys.argv[1], sys.argv[2], sys.argv[3]
def L(k): return Image.open(f'{src}/{name}_{k}_1k.webp')
diff = np.asarray(L('diff').convert('RGB')).astype(np.float32) / 255
nor = np.asarray(L('nor').convert('RGB')).astype(np.float32) / 255
disp = np.asarray(L('disp').convert('L')).astype(np.float32) / 255
rough = np.asarray(L('rough').convert('L')).astype(np.float32) / 255
def blur(a, r):
    im = Image.fromarray((a * 65535).astype(np.uint16) if False else (a * 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.BoxBlur(r))).astype(np.float32) / 255
m1, m2 = blur(disp, 6), blur(disp, 24)
ao = np.clip(1 - 3.0 * np.maximum(0, m1 - disp) - 1.5 * np.maximum(0, m2 - disp), 0.4, 1)
alb = np.dstack([diff, ao])
nhr = np.dstack([nor[..., 0], nor[..., 1], disp, rough])
to8 = lambda a: (np.clip(a, 0, 1) * 255 + 0.5).astype(np.uint8)
Image.fromarray(to8(alb), 'RGBA').save(f'{out}_albedo.webp', quality=86, alpha_quality=90, method=6)
Image.fromarray(to8(nhr), 'RGBA').save(f'{out}_nhr.webp', quality=84, alpha_quality=88, method=6)
lin = np.where(diff <= 0.04045, diff / 12.92, ((diff + 0.055) / 1.055) ** 2.4)
print(name, 'mean linear albedo', lin.mean(axis=(0, 1)).round(4), 'lum', round(float((lin @ [0.2126, 0.7152, 0.0722]).mean()), 4))
