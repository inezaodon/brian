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

function sobelEdges(gray, w, h, threshold) {
  const out = new Uint8Array(w * h);
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
      const mag = Math.hypot(gx, gy);
      out[y * w + x] = mag > threshold ? 255 : 0;
    }
  }
  return out;
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

/**
 * Order pixels of one component by polar angle around their centroid (separate loop per blob).
 */
function sortByAngleAroundCentroid(pts) {
  if (pts.length === 0) return [];
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  return pts.slice().sort(
    (a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx)
  );
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
 * Full complex DFT of z[n] = re[n] + i im[n].
 * X[k] = (1/N) sum_n z[n] e^{-i 2π k n / N}
 * Reports progress by chunking the outer k loop.
 */
function dftComplexProgress(zRe, zIm, reportEvery, onProgress) {
  const N = zRe.length;
  const outRe = new Float32Array(N);
  const outIm = new Float32Array(N);
  const invN = 1 / N;
  const twoPiOverN = (2 * Math.PI) / N;

  for (let k = 0; k < N; k++) {
    let sumRe = 0;
    let sumIm = 0;
    for (let n = 0; n < N; n++) {
      const angle = -twoPiOverN * k * n;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const zr = zRe[n];
      const zi = zIm[n];
      sumRe += zr * cos - zi * sin;
      sumIm += zr * sin + zi * cos;
    }
    outRe[k] = sumRe * invN;
    outIm[k] = sumIm * invN;
    if (k % reportEvery === 0 || k === N - 1) {
      onProgress(0.65 + (0.3 * (k + 1)) / N);
    }
  }
  return { outRe, outIm };
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

    self.postMessage({ type: "progress", percent: 28, stage: "Sobel edge detection…" });

    const edges = sobelEdges(gray, w, h, edgeThreshold);

    self.postMessage({ type: "progress", percent: 42, stage: "Segmenting edge contours…" });

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
      const ordered = sortByAngleAroundCentroid(comp.pixels);
      const pts = subsampleOrdered(ordered, perPathMax);
      const N = pts.length;
      const zRe = new Float32Array(N);
      const zIm = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        zRe[i] = pts[i].x - cx;
        zIm[i] = pts[i].y - cy;
      }

      const reportEvery = Math.max(1, Math.floor(N / 20));
      const fracStart = progressBase + (progressSpan * pathIndex) / totalPaths;
      const fracEnd = progressBase + (progressSpan * (pathIndex + 1)) / totalPaths;

      const { outRe, outIm } = dftComplexProgress(zRe, zIm, reportEvery, (p) => {
        const inner = (p - 0.65) / 0.3;
        const local = Math.max(0, Math.min(1, inner));
        const pct = 100 * (fracStart + (fracEnd - fracStart) * local);
        self.postMessage({
          type: "progress",
          percent: Math.min(99, pct),
          stage: `DFT path ${pathIndex + 1}/${totalPaths}…`,
        });
      });

      const termCap = Math.min(
        PATH_TERM_CAPS[pathIndex] != null ? PATH_TERM_CAPS[pathIndex] : 40,
        N
      );
      pathsOut.push({
        N,
        pointCount: N,
        termCap,
        coeffsRe: outRe,
        coeffsIm: outIm,
      });
      transfers.push(outRe.buffer, outIm.buffer);
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
