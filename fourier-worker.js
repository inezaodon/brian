/* eslint-disable no-restricted-globals */
// Heavy image work + DFT with progress ticks (runs in a Web Worker).

function grayscaleFromImageData(imageData) {
  const d = imageData.data;
  const g = new Float32Array(imageData.width * imageData.height);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    g[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  return g;
}

function boxBlurH(src, dst, w, h, r) {
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

function boxBlurV(src, dst, w, h, r) {
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

/**
 * Strong smoothing + light blend with original: keeps global shape, drops fine texture.
 */
function simplifyGrayscale(gray, w, h) {
  const tmp = new Float32Array(w * h);
  const a = new Float32Array(w * h);
  a.set(gray);
  const passes = 3;
  const r = 2;
  for (let p = 0; p < passes; p++) {
    boxBlurH(a, tmp, w, h, r);
    boxBlurV(tmp, a, w, h, r);
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) {
    out[i] = 0.62 * a[i] + 0.38 * gray[i];
  }
  return out;
}

function sobelMagnitudeFloat(gray, w, h) {
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

/** Sampled percentile for adaptive edge cutoff (thresholdSlider 20–255 → stricter when higher). */
function percentileFromMag(mag, p) {
  const sample = [];
  const step = Math.max(1, Math.floor(mag.length / 8000));
  for (let i = 0; i < mag.length; i += step) sample.push(mag[i]);
  sample.sort((a, b) => a - b);
  const idx = Math.min(sample.length - 1, Math.max(0, Math.floor((sample.length - 1) * p)));
  return sample[idx];
}

function binaryEdgesFromMagnitude(mag, w, h, edgeThreshold) {
  const out = new Uint8Array(w * h);
  const tNorm = (edgeThreshold - 20) / (255 - 20);
  const p = 0.88 + tNorm * 0.11;
  const cutoff = percentileFromMag(mag, p);
  for (let i = 0; i < mag.length; i++) {
    out[i] = mag[i] >= cutoff ? 255 : 0;
  }
  return out;
}

/** RGBA cyan “neon line” preview from magnitude (for UI animation). */
function lineArtRgbaFromMagnitude(mag, w, h) {
  let maxM = 1e-6;
  for (let i = 0; i < mag.length; i++) {
    if (mag[i] > maxM) maxM = mag[i];
  }
  const inv = 1 / maxM;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < mag.length; i++) {
    const t = Math.min(1, mag[i] * inv);
    const a = Math.floor(255 * Math.pow(t, 0.55));
    const o = i * 4;
    rgba[o] = 20;
    rgba[o + 1] = 230;
    rgba[o + 2] = 255;
    rgba[o + 3] = a;
  }
  return rgba;
}

const PATH_COUNT = 10;
/** Suggested max harmonics per path (largest blobs → more terms), clamped to sample count N. */
const PATH_TERM_CAPS = [200, 120, 40, 40, 25, 25, 30, 50, 35, 20];
const DX8 = [-1, 0, 1, -1, 1, -1, 0, 1];
const DY8 = [-1, -1, -1, 0, 0, 1, 1, 1];

/**
 * 8-connected components on binary edge mask. Returns list of { pixels: {x,y}[] }.
 */
function connectedEdgeComponents(edges, w, h) {
  const visited = new Uint8Array(w * h);
  const out = [];
  const stack = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!edges[i] || visited[i]) continue;
      const pixels = [];
      visited[i] = 1;
      stack.push(x, y);
      while (stack.length) {
        const cy = stack.pop();
        const cx = stack.pop();
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

function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Build a mostly continuous ordering by greedily visiting nearest unvisited pixel.
 * For sparse edge components this is much better than centroid-angle sorting.
 */
function orderComponentGreedy(pts) {
  if (pts.length <= 2) return pts.slice();
  const used = new Uint8Array(pts.length);
  let startIdx = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x < pts[startIdx].x) startIdx = i;
  }
  const ordered = [];
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

/**
 * Resample an ordered polyline to M equally spaced arc-length points (closed loop).
 */
function resampleByArcLength(pts, M) {
  const n = pts.length;
  if (n === 0 || M <= 0) return [];
  if (n === 1) return Array.from({ length: M }, () => ({ x: pts[0].x, y: pts[0].y }));

  const segLens = new Float32Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segLens[i] = len;
    total += len;
  }
  if (total <= 1e-6) return pts.slice(0, Math.min(M, pts.length));

  const out = [];
  let seg = 0;
  let segStart = 0;
  for (let m = 0; m < M; m++) {
    const target = (m / M) * total;
    while (seg < n - 1 && segStart + segLens[seg] < target) {
      segStart += segLens[seg];
      seg++;
    }
    const a = pts[seg];
    const b = pts[(seg + 1) % n];
    const len = Math.max(1e-6, segLens[seg]);
    const u = (target - segStart) / len;
    out.push({
      x: a.x + (b.x - a.x) * u,
      y: a.y + (b.y - a.y) * u,
    });
  }
  return out;
}

/**
 * Uniform subsample a polyline to at most maxPts (preserves order).
 */
function subsampleOrdered(pts, maxPts) {
  if (pts.length === 0) return [];
  if (pts.length <= maxPts) return pts;
  const out = [];
  const step = (pts.length - 1) / (maxPts - 1);
  for (let i = 0; i < maxPts; i++) out.push(pts[Math.round(i * step)]);
  return out;
}

/**
 * Iterative radix-2 Cooley-Tukey FFT (in-place arrays).
 */
function fftComplexInPlace(re, im) {
  const N = re.length;
  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1;
    const ang = (-2 * Math.PI) / len;
    const wLenRe = Math.cos(ang);
    const wLenIm = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let wRe = 1;
      let wIm = 0;
      for (let j2 = 0; j2 < half; j2++) {
        const uRe = re[i + j2];
        const uIm = im[i + j2];
        const vRe = re[i + j2 + half] * wRe - im[i + j2 + half] * wIm;
        const vIm = re[i + j2 + half] * wIm + im[i + j2 + half] * wRe;
        re[i + j2] = uRe + vRe;
        im[i + j2] = uIm + vIm;
        re[i + j2 + half] = uRe - vRe;
        im[i + j2 + half] = uIm - vIm;
        const nwRe = wRe * wLenRe - wIm * wLenIm;
        const nwIm = wRe * wLenIm + wIm * wLenRe;
        wRe = nwRe;
        wIm = nwIm;
      }
    }
  }
}

function sparseTermsFromFft(zRe, zIm, topK) {
  const N = nextPow2(zRe.length);
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  re.set(zRe);
  im.set(zIm);
  fftComplexInPlace(re, im);

  const invN = 1 / N;
  const freqs = [];
  for (let k = 0; k < N; k++) freqs.push(k <= N / 2 ? k : k - N);
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => {
    const ma = re[a] * re[a] + im[a] * im[a];
    const mb = re[b] * re[b] + im[b] * im[b];
    return mb - ma;
  });
  const keep = order.slice(0, Math.min(topK, N));
  keep.sort((a, b) => Math.abs(freqs[a]) - Math.abs(freqs[b]));

  const outFreq = new Int16Array(keep.length);
  const outRe = new Float32Array(keep.length);
  const outIm = new Float32Array(keep.length);
  for (let i = 0; i < keep.length; i++) {
    const k = keep[i];
    outFreq[i] = freqs[k];
    outRe[i] = re[k] * invN;
    outIm[i] = im[k] * invN;
  }
  return { fftN: N, outFreq, outRe, outIm };
}

self.onmessage = (e) => {
  const { bitmap, edgeThreshold, maxPoints, targetW, targetH } = e.data;
  if (!bitmap || !targetW || !targetH) {
    if (bitmap && typeof bitmap.close === "function") bitmap.close();
    self.postMessage({ type: "error", message: "Invalid worker payload" });
    return;
  }

  try {
    const w = targetW;
    const h = targetH;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    self.postMessage({ type: "progress", percent: 15, stage: "Reading pixels…" });

    const imageData = ctx.getImageData(0, 0, w, h);
    const gray = grayscaleFromImageData(imageData);

    self.postMessage({ type: "progress", percent: 22, stage: "Simplifying (shape-preserving blur)…" });

    const simplified = simplifyGrayscale(gray, w, h);

    self.postMessage({ type: "progress", percent: 30, stage: "Sobel on simplified image…" });

    const mag = sobelMagnitudeFloat(simplified, w, h);

    const lineArtRgba = lineArtRgbaFromMagnitude(mag, w, h);
    self.postMessage(
      {
        type: "previewLineArt",
        w,
        h,
        lineArt: lineArtRgba,
      },
      [lineArtRgba.buffer]
    );

    self.postMessage({ type: "progress", percent: 38, stage: "Thresholding edges for contours…" });

    const edges = binaryEdgesFromMagnitude(mag, w, h, edgeThreshold);

    self.postMessage({ type: "progress", percent: 44, stage: "Segmenting edge contours…" });

    const components = connectedEdgeComponents(edges, w, h);
    components.sort((a, b) => b.pixels.length - a.pixels.length);
    const selected = components.slice(0, PATH_COUNT).filter((c) => c.pixels.length >= 8);

    if (selected.length === 0) {
      self.postMessage({
        type: "error",
        message: "No usable edge contours (need ≥8 pixels per region). Lower the edge threshold.",
      });
      return;
    }

    const perPathMax = Math.max(8, Math.floor(maxPoints / Math.max(1, selected.length)));
    const cx = w / 2;
    const cy = h / 2;

    const pathsOut = [];
    const transfers = [];

    let pathIndex = 0;
    const totalPaths = selected.length;
    const progressBase = 0.52;
    const progressSpan = 0.45;

    for (const comp of selected) {
      const ordered = orderComponentGreedy(comp.pixels);
      const pts = resampleByArcLength(ordered, perPathMax);
      const N = pts.length;
      const zRe = new Float32Array(N);
      const zIm = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        zRe[i] = pts[i].x - cx;
        zIm[i] = pts[i].y - cy;
      }

      const fracStart = progressBase + (progressSpan * pathIndex) / totalPaths;
      const fracEnd = progressBase + (progressSpan * (pathIndex + 1)) / totalPaths;
      self.postMessage({
        type: "progress",
        percent: 100 * fracStart,
        stage: `FFT path ${pathIndex + 1}/${totalPaths}…`,
      });

      const termCap = Math.min(
        PATH_TERM_CAPS[pathIndex] != null ? PATH_TERM_CAPS[pathIndex] : 40,
        nextPow2(N)
      );
      const { fftN, outFreq, outRe, outIm } = sparseTermsFromFft(zRe, zIm, termCap);
      self.postMessage({
        type: "progress",
        percent: Math.min(99, 100 * fracEnd),
        stage: `FFT path ${pathIndex + 1}/${totalPaths} done`,
      });
      pathsOut.push({
        N: fftN,
        pointCount: N,
        termCap,
        freqs: outFreq,
        coeffsRe: outRe,
        coeffsIm: outIm,
      });
      transfers.push(outFreq.buffer, outRe.buffer, outIm.buffer);
      pathIndex += 1;
    }

    const edgePreview = edges.buffer;
    transfers.push(edgePreview);

    self.postMessage(
      {
        type: "done",
        w,
        h,
        pathCount: pathsOut.length,
        paths: pathsOut.map((p) => ({
          N: p.N,
          pointCount: p.pointCount,
          termCap: p.termCap,
          freqs: p.freqs,
          coeffsRe: p.coeffsRe,
          coeffsIm: p.coeffsIm,
        })),
        edgePreview,
      },
      transfers
    );
  } catch (err) {
    if (bitmap && typeof bitmap.close === "function") {
      try {
        bitmap.close();
      } catch (_) {
        /* ignore */
      }
    }
    self.postMessage({ type: "error", message: err && err.message ? err.message : String(err) });
  }
};
