/**
 * High-quality “neon line art” from **pre-simplified** grayscale (same signal as Sobel for edges):
 * Sobel → NMS → robust tone map → multi-radius bloom → unsharp → ridge boost →
 * cyan–violet–magenta grading on a deep base. Optional internal supersample for thin edges.
 */

function sobelGradients(gray: Float32Array, w: number, h: number) {
  const gx = new Float32Array(w * h);
  const gy = new Float32Array(w * h);
  const mag = new Float32Array(w * h);
  const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gxv = 0;
      let gyv = 0;
      let idx = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const v = gray[(y + j) * w + (x + i)];
          gxv += v * kx[idx];
          gyv += v * ky[idx];
          idx++;
        }
      }
      const i = y * w + x;
      gx[i] = gxv;
      gy[i] = gyv;
      mag[i] = Math.hypot(gxv, gyv);
    }
  }
  return { gx, gy, mag };
}

function nonMaxSuppression(mag: Float32Array, gx: Float32Array, gy: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const M = mag[i];
      if (M <= 0) continue;
      const Gx = gx[i];
      const Gy = gy[i];
      const angle = (Math.atan2(Gy, Gx) * 180) / Math.PI;
      const a = ((angle + 180) % 180 + 180) % 180;
      let n1 = 0;
      let n2 = 0;
      if ((a >= 0 && a < 22.5) || a >= 157.5) {
        n1 = mag[i - 1];
        n2 = mag[i + 1];
      } else if (a >= 22.5 && a < 67.5) {
        n1 = mag[i - 1 + w];
        n2 = mag[i + 1 - w];
      } else if (a >= 67.5 && a < 112.5) {
        n1 = mag[i - w];
        n2 = mag[i + w];
      } else {
        n1 = mag[i + 1 + w];
        n2 = mag[i - 1 - w];
      }
      out[i] = M >= n1 && M >= n2 ? M : 0;
    }
  }
  return out;
}

function boxBlurFloat(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const tmp = new Float32Array(w * h);
  const size = 2 * r + 1;
  const inv = 1 / size;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dx = -r; dx <= r; dx++) {
        const xx = Math.min(w - 1, Math.max(0, x + dx));
        s += src[y * w + xx];
      }
      tmp[y * w + x] = s * inv;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        s += tmp[yy * w + x];
      }
      dst[y * w + x] = s * inv;
    }
  }
}

function percentiles(samples: number[], lo: number, hi: number): { loV: number; hiV: number } {
  if (samples.length === 0) return { loV: 0, hiV: 1 };
  samples.sort((a, b) => a - b);
  const loIdx = Math.floor((samples.length - 1) * lo);
  const hiIdx = Math.ceil((samples.length - 1) * hi);
  return { loV: samples[loIdx], hiV: samples[Math.min(samples.length - 1, hiIdx)] };
}

function toneMap(nms: Float32Array, w: number, h: number): { tone: Float32Array; bloomBase: Float32Array } {
  const n = w * h;
  const sample: number[] = [];
  const step = Math.max(1, Math.floor(n / 12000));
  for (let i = 0; i < n; i += step) {
    if (nms[i] > 1e-6) sample.push(nms[i]);
  }
  const { loV, hiV } = percentiles(sample.length ? sample : [0], 0.04, 0.995);
  const span = Math.max(hiV - loV, 1e-5);
  const tone = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let t = (nms[i] - loV) / span;
    t = Math.max(0, Math.min(1, t));
    t = t * t * (3 - 2 * t);
    tone[i] = t ** 0.38;
  }
  const bloomBase = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    bloomBase[i] = tone[i] ** 1.15;
  }
  return { tone, bloomBase };
}

function addBloom(tone: Float32Array, bloomBase: Float32Array, w: number, h: number): Float32Array {
  const n = w * h;
  const b1 = new Float32Array(n);
  const b2 = new Float32Array(n);
  const acc = new Float32Array(n);
  boxBlurFloat(bloomBase, b1, w, h, 3);
  boxBlurFloat(bloomBase, b2, w, h, 8);
  for (let i = 0; i < n; i++) {
    const glow = b1[i] * 0.55 + b2[i] * 0.35;
    acc[i] = Math.min(1, tone[i] * 1.05 + glow * 0.95);
  }
  return acc;
}

function unsharp(combined: Float32Array, w: number, h: number, amount: number): Float32Array {
  const n = w * h;
  const blur = new Float32Array(n);
  boxBlurFloat(combined, blur, w, h, 1);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.max(0, Math.min(1, combined[i] + (combined[i] - blur[i]) * amount));
  }
  return out;
}

function ridgeBoost(combined: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  out.set(combined);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let m = combined[y * w + x];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          m = Math.max(m, combined[(y + dy) * w + (x + dx)]);
        }
      }
      const i = y * w + x;
      out[i] = Math.min(1, combined[i] * 0.55 + m * 0.45);
    }
  }
  return out;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function upscaleBilinear(src: Float32Array, w: number, h: number, w2: number, h2: number): Float32Array {
  const dst = new Float32Array(w2 * h2);
  for (let y2 = 0; y2 < h2; y2++) {
    for (let x2 = 0; x2 < w2; x2++) {
      const fx = ((x2 + 0.5) / w2) * w - 0.5;
      const fy = ((y2 + 0.5) / h2) * h - 0.5;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);
      const xa = Math.max(0, Math.min(w - 1, x0));
      const ya = Math.max(0, Math.min(h - 1, y0));
      const v00 = src[ya * w + xa];
      const v10 = src[ya * w + x1];
      const v01 = src[y1 * w + xa];
      const v11 = src[y1 * w + x1];
      const v = (1 - tx) * (1 - ty) * v00 + tx * (1 - ty) * v10 + (1 - tx) * ty * v01 + tx * ty * v11;
      dst[y2 * w2 + x2] = v;
    }
  }
  return dst;
}

function downscaleBilinearRGBA(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Uint8ClampedArray {
  const dst = new Uint8ClampedArray(dw * dh * 4);
  for (let y2 = 0; y2 < dh; y2++) {
    for (let x2 = 0; x2 < dw; x2++) {
      const fx = ((x2 + 0.5) / dw) * sw - 0.5;
      const fy = ((y2 + 0.5) / dh) * sh - 0.5;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const x1 = Math.min(sw - 1, x0 + 1);
      const y1 = Math.min(sh - 1, y0 + 1);
      const xa = Math.max(0, Math.min(sw - 1, x0));
      const ya = Math.max(0, Math.min(sh - 1, y0));
      const o = (y2 * dw + x2) * 4;
      for (let c = 0; c < 4; c++) {
        const i00 = (ya * sw + xa) * 4 + c;
        const i10 = (ya * sw + x1) * 4 + c;
        const i01 = (y1 * sw + xa) * 4 + c;
        const i11 = (y1 * sw + x1) * 4 + c;
        const v =
          (1 - tx) * (1 - ty) * src[i00] +
          tx * (1 - ty) * src[i10] +
          (1 - tx) * ty * src[i01] +
          tx * ty * src[i11];
        dst[o + c] = Math.round(Math.max(0, Math.min(255, v)));
      }
    }
  }
  return dst;
}

export function buildNeonLineArtRgba(gray: Float32Array, w: number, h: number): Uint8ClampedArray {
  const { gx, gy, mag } = sobelGradients(gray, w, h);
  const nms = nonMaxSuppression(mag, gx, gy, w, h);
  const { tone, bloomBase } = toneMap(nms, w, h);
  let combined = addBloom(tone, bloomBase, w, h);
  combined = unsharp(combined, w, h, 0.42);
  combined = ridgeBoost(combined, w, h);

  const bloomOnly = new Float32Array(w * h);
  boxBlurFloat(combined, bloomOnly, w, h, 6);
  for (let i = 0; i < w * h; i++) {
    bloomOnly[i] = Math.min(1, bloomOnly[i] * 0.65);
  }

  const rgba = new Uint8ClampedArray(w * h * 4);
  const baseR = 5;
  const baseG = 8;
  const baseB = 18;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const v = combined[i];
      const b = bloomOnly[i];
      const gxv = gx[i];
      const gyv = gy[i];
      const ang = Math.atan2(gyv, gxv);
      const swirl = 0.5 + 0.5 * Math.sin(ang * 2.1 + (x + y) * 0.02);
      const cr = lerp(32, 180, swirl);
      const cg = lerp(210, 100, swirl * 0.85);
      const cb = lerp(255, 255, 0.65 + 0.35 * swirl);
      const hot = v * v;
      let R = baseR + v * cr * 0.95 + hot * 70 + b * 140;
      let G = baseG + v * cg * 0.95 + hot * 45 + b * 35;
      let B = baseB + v * cb * 0.95 + hot * 30 + b * 200;
      R += b * 55 * (0.5 + 0.5 * Math.sin(ang * 3));
      G -= b * 25;
      B += b * 40;
      R = Math.max(0, Math.min(255, R));
      G = Math.max(0, Math.min(255, G));
      B = Math.max(0, Math.min(255, B));
      const o = i * 4;
      rgba[o] = R;
      rgba[o + 1] = G;
      rgba[o + 2] = B;
      rgba[o + 3] = 255;
    }
  }
  return rgba;
}

function rgbaToPngDataUrl(rgba: Uint8ClampedArray, w: number, h: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const copy = new Uint8ClampedArray(rgba.length);
  copy.set(rgba);
  ctx.putImageData(new ImageData(copy, w, h), 0, 0);
  return canvas.toDataURL("image/png");
}

/**
 * Neon preview from the same simplified grayscale used for contour Sobel.
 * Supersamples when the working image is small so strokes stay smooth after downscale.
 */
export function renderNeonLineArtDataUrl(simplifiedGray: Float32Array, w: number, h: number): string {
  const maxDim = Math.max(w, h);
  const scale = maxDim < 360 ? Math.min(2.25, 520 / maxDim) : 1;
  if (scale <= 1.01) {
    const rgba = buildNeonLineArtRgba(simplifiedGray, w, h);
    return rgbaToPngDataUrl(rgba, w, h);
  }
  const sw = Math.min(560, Math.round(w * scale));
  const sh = Math.min(560, Math.round(h * scale));
  const big = upscaleBilinear(simplifiedGray, w, h, sw, sh);
  const rgbaBig = buildNeonLineArtRgba(big, sw, sh);
  const rgbaSmall = downscaleBilinearRGBA(rgbaBig, sw, sh, w, h);
  return rgbaToPngDataUrl(rgbaSmall, w, h);
}
