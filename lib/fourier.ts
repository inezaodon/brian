/**
 * Sparse complex FFT epicycle model (legacy `fourier-worker.js` + canvas draw loop).
 *
 * ## Signal
 * A closed curve is sampled at \(N\) points \((x_j,y_j)\) (evenly spaced in **arc length**).
 * Fix an origin \(O\) (legacy uploads: **image center** \((W/2,H/2)\); demo path: **centroid** of samples).
 * Complex samples:
 *
 * \[ z_j = (x_j - O_x) + i\,(y_j - O_y) \]
 *
 * ## Forward transform
 * Pad \(z_j\) to length \(N_{\mathrm{fft}} = 2^{\lceil \log_2 N\rceil}\) (zero fill), run **radix-2 Cooley–Tukey FFT**
 * to obtain bins \(\tilde{X}[k]\). Scale **Fourier coefficients** \(c_k = \tilde{X}[k] / N_{\mathrm{fft}}\) (matches the
 * worker’s `invN` normalization).
 *
 * ## Sparse spectrum
 * Bins are ranked by energy \(|c_k|^2\). Keep the top `sparseCap` indices, then **sort by \(|k|\)** (signed frequency
 * \(k \in \{-N/2,\ldots,N/2-1\}\)) so epicycles chain from low to high |frequency| for a stable drawing order.
 *
 * ## Epicycle synthesis (same as legacy `tick`)
 * Each kept term is a phasor \(c_k = |c_k| e^{i\varphi_k}\) with \(\varphi_k = \arg(c_k)\). The tip position is
 * \(O + \sum_k |c_k| \cos(\omega_k t + \varphi_k)\) in \(x\) and similarly in \(y\), with \(\omega_k = k\) in the
 * code’s time parameter (the UI scales \(t\) per frame via `refN ≈ fftN`).
 */

export type Point2 = { x: number; y: number };

export type FourierModel = {
  fftN: number;
  centroid: Point2;
  freqs: Int16Array;
  coeffsRe: Float32Array;
  coeffsIm: Float32Array;
};

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

function fftComplexInPlace(re: Float32Array, im: Float32Array): void {
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

export function sparseTermsFromFft(
  zRe: Float32Array,
  zIm: Float32Array,
  topK: number,
): Omit<FourierModel, "centroid"> {
  const N = nextPow2(zRe.length);
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  re.set(zRe);
  im.set(zIm);
  fftComplexInPlace(re, im);

  const invN = 1 / N;
  const freqsArr: number[] = [];
  for (let k = 0; k < N; k++) freqsArr.push(k <= N / 2 ? k : k - N);
  const order = Array.from({ length: N }, (_, i) => i).sort((a, b) => {
    const ma = re[a] * re[a] + im[a] * im[a];
    const mb = re[b] * re[b] + im[b] * im[b];
    return mb - ma;
  });
  const keep = order.slice(0, Math.min(topK, N));
  keep.sort((a, b) => Math.abs(freqsArr[a]) - Math.abs(freqsArr[b]));

  const outFreq = new Int16Array(keep.length);
  const outRe = new Float32Array(keep.length);
  const outIm = new Float32Array(keep.length);
  for (let i = 0; i < keep.length; i++) {
    const k = keep[i];
    outFreq[i] = freqsArr[k];
    outRe[i] = re[k] * invN;
    outIm[i] = im[k] * invN;
  }
  return { fftN: N, freqs: outFreq, coeffsRe: outRe, coeffsIm: outIm };
}

export function resampleByArcLength(pts: Point2[], M: number): Point2[] {
  const n = pts.length;
  if (n === 0 || M <= 0) return [];
  if (n === 1) return Array.from({ length: M }, () => ({ ...pts[0] }));

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

  const out: Point2[] = [];
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
 * Closed path → complex samples → sparse FFT model.
 *
 * @param fftOrigin If set, subtract this point from each sample (legacy image uploads use the **image center**).
 *                  If omitted, subtract the **centroid of the arc-length-resampled** polyline (good for synthetic demo paths).
 */
export function buildFourierModel(
  closedPath: Point2[],
  sampleCount: number,
  sparseCap: number,
  fftOrigin?: Point2,
): FourierModel {
  const sampled = resampleByArcLength(closedPath, sampleCount);
  const n = sampled.length;
  let cx: number;
  let cy: number;
  if (fftOrigin) {
    cx = fftOrigin.x;
    cy = fftOrigin.y;
  } else {
    let sx = 0;
    let sy = 0;
    for (const p of sampled) {
      sx += p.x;
      sy += p.y;
    }
    cx = sx / n;
    cy = sy / n;
  }
  const zRe = new Float32Array(n);
  const zIm = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    zRe[i] = sampled[i].x - cx;
    zIm[i] = sampled[i].y - cy;
  }
  const { fftN, freqs, coeffsRe, coeffsIm } = sparseTermsFromFft(zRe, zIm, sparseCap);
  return { fftN, centroid: { x: cx, y: cy }, freqs, coeffsRe, coeffsIm };
}

export function epicycleOffset(
  model: FourierModel,
  t: number,
  termCap: number,
): Point2 {
  const { freqs, coeffsRe, coeffsIm } = model;
  const cap = Math.min(termCap, coeffsRe.length);
  let re = 0;
  let im = 0;
  for (let k = 0; k < cap; k++) {
    const freq = freqs[k];
    const ck = coeffsRe[k];
    const sk = coeffsIm[k];
    const angle = freq * t + Math.atan2(sk, ck);
    const r = Math.hypot(ck, sk);
    re += r * Math.cos(angle);
    im += r * Math.sin(angle);
  }
  return { x: re, y: im };
}

export function epicyclePosition(model: FourierModel, t: number, termCap: number): Point2 {
  const o = epicycleOffset(model, t, termCap);
  return { x: model.centroid.x + o.x, y: model.centroid.y + o.y };
}
