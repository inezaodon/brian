/**
 * Image → closed contour path, matching the legacy `fourier-worker.js` pipeline:
 *
 * 1. **Grayscale** — ITU-R BT.601 luminance (0.299R + 0.587G + 0.114B).
 * 2. **Shape-preserving simplify** — separable box blur (2 passes, radius 2), then
 *    `0.52·blur + 0.48·raw` to drop fine texture while keeping global edges.
 * 3. **Sobel magnitude** — 3×3 kernels Gx, Gy on the simplified image; store √(Gx² + Gy²).
 * 4. **Adaptive threshold** — binary mask: Sobel magnitude ≥ a **percentile** of sampled
 *    magnitudes. The legacy `edgeThreshold` slider (20–255) maps to percentile
 *    `p = 0.88 + ((thr−20)/(255−20))·0.11` (stricter edges when the slider is higher).
 * 5. **8-connected components** — flood-fill each foreground blob of edge pixels.
 * 6. **Largest blob** — sort by pixel count; we keep the **largest** region (same spirit
 *    as legacy’s “main face” path; legacy also emitted up to 10 paths — here one loop).
 * 7. **Greedy chain order** — start at the leftmost pixel, repeatedly append the nearest
 *    unused pixel (Euclidean). This orders a sparse edge set into a walkable polyline
 *    (better than sorting by angle from the centroid for portraits).
 * 8. **Arc-length resample** — `M` evenly spaced samples along the closed polyline for a
 *    stable DFT input rate.
 *
 * **FFT origin (legacy):** complex samples are `z_j = (x_j - W/2) + i(y_j - H/2)` using
 * the **image center**, not the centroid of the path — returned as `fftOrigin` for `buildFourierModel`.
 */

import type { Point2 } from "./fourier";
import { resampleByArcLength } from "./fourier";

export type ContourFromImageOptions = {
  maxSide?: number;
  /** Legacy range 20–255; higher = fewer, stronger edges (default 105). */
  edgeThreshold?: number;
  /** Points along the closed loop after arc-length resampling (default 320). */
  samplePoints?: number;
};

export type ContourFromImageResult = {
  path: Point2[];
  fftOrigin: Point2;
  width: number;
  height: number;
};

const DX8 = [-1, 0, 1, -1, 1, -1, 0, 1];
const DY8 = [-1, -1, -1, 0, 0, 1, 1, 1];

function grayscaleFromImageData(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    g[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return g;
}

function boxBlurH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const size = 2 * r + 1;
  const inv = 1 / size;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let dx = -r; dx <= r; dx++) {
        const xx = Math.min(w - 1, Math.max(0, x + dx));
        sum += src[y * w + xx];
      }
      dst[y * w + x] = sum * inv;
    }
  }
}

function boxBlurV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const size = 2 * r + 1;
  const inv = 1 / size;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        sum += src[yy * w + x];
      }
      dst[y * w + x] = sum * inv;
    }
  }
}

/** Strong smoothing + light blend with original: keeps global shape, drops fine texture. */
function simplifyGrayscale(gray: Float32Array, w: number, h: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const a = new Float32Array(w * h);
  a.set(gray);
  const passes = 2;
  const r = 2;
  for (let p = 0; p < passes; p++) {
    boxBlurH(a, tmp, w, h, r);
    boxBlurV(tmp, a, w, h, r);
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) {
    out[i] = 0.52 * a[i] + 0.48 * gray[i];
  }
  return out;
}

function sobelMagnitudeFloat(gray: Float32Array, w: number, h: number): Float32Array {
  const mag = new Float32Array(w * h);
  const kx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const ky = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let gx = 0;
      let gy = 0;
      let idx = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const v = gray[(y + j) * w + (x + i)];
          gx += v * kx[idx];
          gy += v * ky[idx];
          idx++;
        }
      }
      mag[y * w + x] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

function percentileFromMag(mag: Float32Array, p: number): number {
  const sample: number[] = [];
  const step = Math.max(1, Math.floor(mag.length / 8000));
  for (let i = 0; i < mag.length; i += step) sample.push(mag[i]);
  sample.sort((a, b) => a - b);
  const idx = Math.min(sample.length - 1, Math.max(0, Math.floor((sample.length - 1) * p)));
  return sample[idx];
}

function binaryEdgesFromMagnitude(
  mag: Float32Array,
  w: number,
  h: number,
  edgeThreshold: number,
): Uint8Array {
  const out = new Uint8Array(w * h);
  const tNorm = (edgeThreshold - 20) / (255 - 20);
  const p = 0.88 + tNorm * 0.11;
  const cutoff = percentileFromMag(mag, p);
  for (let i = 0; i < mag.length; i++) {
    out[i] = mag[i] >= cutoff ? 255 : 0;
  }
  return out;
}

type Pixel = { x: number; y: number };

/** 8-connected components on binary edge mask. */
function connectedEdgeComponents(edges: Uint8Array, w: number, h: number): { pixels: Pixel[] }[] {
  const visited = new Uint8Array(w * h);
  const out: { pixels: Pixel[] }[] = [];
  const stack: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!edges[i] || visited[i]) continue;
      const pixels: Pixel[] = [];
      visited[i] = 1;
      stack.push(x, y);
      while (stack.length) {
        const cy = stack.pop()!;
        const cx = stack.pop()!;
        pixels.push({ x: cx, y: cy });
        for (let d = 0; d < 8; d++) {
          const nx = cx + DX8[d];
          const ny = cy + DY8[d];
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (!edges[ni] || visited[ni]) continue;
          visited[ni] = 1;
          stack.push(nx, ny);
        }
      }
      if (pixels.length > 0) out.push({ pixels });
    }
  }
  return out;
}

/** Greedily visit nearest unvisited pixel (legacy `orderComponentGreedy`). */
function orderComponentGreedy(pts: Pixel[]): Pixel[] {
  if (pts.length <= 2) return pts.slice();
  const used = new Uint8Array(pts.length);
  let startIdx = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x < pts[startIdx].x) startIdx = i;
  }
  const ordered: Pixel[] = [];
  let curIdx = startIdx;
  used[curIdx] = 1;
  ordered.push(pts[curIdx]);
  for (let step = 1; step < pts.length; step++) {
    let best = -1;
    let bestD2 = Infinity;
    const cx = pts[curIdx].x;
    const cy = pts[curIdx].y;
    for (let j = 0; j < pts.length; j++) {
      if (used[j]) continue;
      const dx = pts[j].x - cx;
      const dy = pts[j].y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = j;
      }
    }
    if (best < 0) break;
    used[best] = 1;
    ordered.push(pts[best]);
    curIdx = best;
  }
  return ordered;
}

function fallbackCirclePath(w: number, h: number, samplePoints: number): Point2[] {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.35;
  const circle: Point2[] = [];
  for (let i = 0; i < 120; i++) {
    const t0 = (i / 120) * Math.PI * 2;
    circle.push({ x: cx + Math.cos(t0) * r, y: cy + Math.sin(t0) * r });
  }
  return resampleByArcLength(circle, samplePoints);
}

/**
 * Raster image → largest closed contour, with legacy preprocessing and ordering.
 */
export async function contourPathFromImageFile(
  file: File,
  options: ContourFromImageOptions = {},
): Promise<ContourFromImageResult> {
  const maxSide = options.maxSide ?? 240;
  const edgeThreshold = Math.min(255, Math.max(20, options.edgeThreshold ?? 105));
  const samplePoints = options.samplePoints ?? 320;

  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(64, Math.round(bmp.width * scale));
  const h = Math.max(64, Math.round(bmp.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bmp.close();
    throw new Error("Could not get canvas context");
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = grayscaleFromImageData(data, w, h);
  const simplified = simplifyGrayscale(gray, w, h);
  const mag = sobelMagnitudeFloat(simplified, w, h);
  const edges = binaryEdgesFromMagnitude(mag, w, h, edgeThreshold);

  const components = connectedEdgeComponents(edges, w, h);
  components.sort((a, b) => b.pixels.length - a.pixels.length);
  const fftOrigin: Point2 = { x: w / 2, y: h / 2 };

  const selected = components.find((c) => c.pixels.length >= 8);
  if (!selected) {
    return {
      path: fallbackCirclePath(w, h, samplePoints),
      fftOrigin,
      width: w,
      height: h,
    };
  }

  const ordered = orderComponentGreedy(selected.pixels);
  const path = resampleByArcLength(ordered, samplePoints);
  return { path, fftOrigin, width: w, height: h };
}
