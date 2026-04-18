/**
 * Split one closed DFT path into several spatial regions (cuts at largest edge gaps),
 * then build one FourierModel per region with its own centroid — local epicycles that
 * cross the canvas less than a single global sum.
 */

import { buildFourierModel, type FourierModel, type Point2 } from "./fourier";

/** Break the K-1 longest edges of the closed polyline so each region is one open chain. */
export function splitClosedPathByLargestGaps(pts: Point2[], regionCount: number): Point2[][] {
  const k = Math.max(1, Math.min(16, Math.floor(regionCount)));
  const n = pts.length;
  if (k <= 1 || n < 8) return [pts];

  type Edge = { from: number; len: number };
  const edges: Edge[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    edges.push({ from: i, len: Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y) });
  }
  edges.sort((a, b) => b.len - a.len);
  const broken = new Set<number>();
  for (const e of edges) {
    if (broken.size >= k - 1) break;
    broken.add(e.from);
  }

  const seen = new Uint8Array(n);
  const chains: Point2[][] = [];
  for (let s = 0; s < n; s++) {
    const predBroken = broken.has((s - 1 + n) % n);
    const outBroken = broken.has(s);
    if (!predBroken || outBroken) continue;
    const ch: Point2[] = [];
    let v = s;
    let guard = 0;
    while (guard++ <= n + 2) {
      if (seen[v]) break;
      seen[v] = 1;
      ch.push(pts[v]);
      if (broken.has(v)) break;
      v = (v + 1) % n;
    }
    if (ch.length >= 2) chains.push(ch);
  }

  if (chains.length === 0) return [pts];

  /** Merge chains shorter than minPts into neighbors (linear order). */
  const minPts = 8;
  let list = chains;
  let iter = 0;
  while (list.some((c) => c.length < minPts) && list.length > 1 && iter++ < list.length * 6) {
    const idx = list.findIndex((c) => c.length < minPts);
    if (idx < 0) break;
    const merged = idx === 0 ? [...list[0], ...list[1]] : [...list[idx - 1], ...list[idx]];
    const next: Point2[][] = [];
    if (idx === 0) {
      next.push(merged);
      for (let j = 2; j < list.length; j++) next.push(list[j]);
    } else {
      for (let j = 0; j < idx - 1; j++) next.push(list[j]);
      next.push(merged);
      for (let j = idx + 1; j < list.length; j++) next.push(list[j]);
    }
    list = next;
  }

  return list.filter((c) => c.length >= 3);
}

function centroidOf(pts: Point2[]): Point2 {
  let sx = 0;
  let sy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
  }
  const n = pts.length;
  return { x: sx / n, y: sy / n };
}

/** Append first point if not already closed. */
function closeForFft(open: Point2[]): Point2[] {
  if (open.length < 2) return open;
  const a = open[0];
  const b = open[open.length - 1];
  if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-4) return open;
  return [...open, { x: a.x, y: a.y }];
}

/**
 * One global model (unchanged contract) plus per-region models when regionCount > 1.
 * Each region uses its own centroid as FFT origin (not the image center).
 */
export function buildRegionModels(
  closedPath: Point2[],
  regionCount: number,
  sampleCount: number,
  sparseCap: number,
): FourierModel[] {
  const chunks = splitClosedPathByLargestGaps(closedPath, regionCount);
  if (chunks.length <= 1) {
    return [];
  }
  const m = chunks.length;
  const perSample = Math.max(48, Math.floor(sampleCount / m));
  const perSparse = Math.max(48, Math.floor(sparseCap / m));
  const out: FourierModel[] = [];
  for (const ch of chunks) {
    const closed = closeForFft(ch);
    const o = centroidOf(ch);
    out.push(buildFourierModel(closed, perSample, perSparse, o));
  }
  return out;
}
