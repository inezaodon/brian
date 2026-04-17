import type { Point2 } from "./fourier";
import { resampleByArcLength } from "./fourier";

/** Very lightweight edge → ordered loop for playground uploads (best on high-contrast portraits). */
export async function imageFileToClosedPath(file: File, maxSide = 200): Promise<Point2[]> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const w = Math.max(32, Math.round(bmp.width * scale));
  const h = Math.max(32, Math.round(bmp.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const mag = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - 1 - w] +
        gray[i + 1 - w] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i - 1 + w] +
        gray[i + 1 + w];
      const gy =
        -gray[i - 1 - w] -
        2 * gray[i - w] -
        gray[i + 1 - w] +
        gray[i - 1 + w] +
        2 * gray[i + w] +
        gray[i + 1 + w];
      mag[i] = Math.hypot(gx, gy);
    }
  }
  let maxM = 1e-6;
  for (let i = 0; i < mag.length; i++) if (mag[i] > maxM) maxM = mag[i];
  const edges = new Uint8Array(w * h);
  const t = 0.22;
  for (let i = 0; i < mag.length; i++) edges[i] = mag[i] >= maxM * t ? 1 : 0;

  const edgePts: Point2[] = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!edges[i]) continue;
      let neigh = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (edges[i + dy * w + dx]) neigh++;
        }
      }
      if (neigh >= 2) edgePts.push({ x, y });
    }
  }
  if (edgePts.length < 24) {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.35;
    const circle: Point2[] = [];
    for (let i = 0; i < 120; i++) {
      const t0 = (i / 120) * Math.PI * 2;
      circle.push({ x: cx + Math.cos(t0) * r, y: cy + Math.sin(t0) * r });
    }
    return resampleByArcLength(circle, 256);
  }
  let sx = 0;
  let sy = 0;
  for (const p of edgePts) {
    sx += p.x;
    sy += p.y;
  }
  const cx = sx / edgePts.length;
  const cy = sy / edgePts.length;
  edgePts.sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  return resampleByArcLength(edgePts, 320);
}
