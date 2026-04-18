/**
 * Desmos / graphing exports — same formulas as `legacy/index.html` (`buildDesmosExport`,
 * `buildPlainTextExport`) and `preview/sketch-only-ui`: one path uses X_1, Y_1 with
 * X(t)=Σ A_k cos(ω_k t + φ_k), Y(t)=Σ A_k sin(ω_k t + φ_k), A_k=|c_k|, φ_k=arg(c_k).
 *
 * **test_coords branch:** large sums are split into X_1a, X_1b, … (≤40 terms each) or,
 * if there are more than 120 terms, into list form `sum(A*cos(F*t+P))` for Desmos
 * performance and parser limits. Ordering is preserved; `cos(0*t+p)` → `cos(p)`.
 */

import type { FourierModel } from "./fourier";

/** Max terms per chunk (spec: 30–50). */
const DESMOS_CHUNK_MAX = 40;

/** Above this, use list + sum() instead of many chunk lines. */
const DESMOS_LIST_THRESHOLD = 120;

export function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

/** ~15–16 sig figs for Desmos (no deliberate rounding to 6 decimals on this branch). */
function formatCoeff(x: number): string {
  if (!Number.isFinite(x)) return "0";
  const s = x.toPrecision(16);
  return s.includes("e") || s.includes("E") ? s : String(Number(s));
}

export type ExportMeta = {
  /** When set, echoed in commented export (worker-sized raster). */
  imageWidth?: number;
  imageHeight?: number;
};

function effectiveCap(model: FourierModel, termLimit: number): number {
  return Math.min(termLimit, model.coeffsRe.length);
}

type TermTriple = { A: number; freq: number; ph: number };

/** Original sparse order; drop only negligible non-DC amplitudes (same as legacy). */
function collectTerms(model: FourierModel, cap: number): TermTriple[] {
  const out: TermTriple[] = [];
  for (let k = 0; k < cap; k++) {
    const freq = model.freqs[k];
    const ck = model.coeffsRe[k];
    const sk = model.coeffsIm[k];
    const A = Math.hypot(ck, sk);
    const ph = Math.atan2(sk, ck);
    if (k > 0 && Math.abs(A) < 1e-8) continue;
    out.push({ A, freq, ph });
  }
  return out;
}

function cosTerm(t: TermTriple): string {
  const A = formatCoeff(t.A);
  const ph = formatCoeff(t.ph);
  if (t.freq === 0) {
    return `${A}*cos(${ph})`;
  }
  const f = Number.isInteger(t.freq) ? String(t.freq) : formatCoeff(t.freq);
  return `${A}*cos(${f}*t+${ph})`;
}

function sinTerm(t: TermTriple): string {
  const A = formatCoeff(t.A);
  const ph = formatCoeff(t.ph);
  if (t.freq === 0) {
    return `${A}*sin(${ph})`;
  }
  const f = Number.isInteger(t.freq) ? String(t.freq) : formatCoeff(t.freq);
  return `${A}*sin(${f}*t+${ph})`;
}

function cleanJoined(parts: string[]): string {
  return parts.join("+").replace(/\+-/g, "-");
}

/** Sequential labels: a, b, …, z, aa, ab, … */
function chunkLabel(i: number): string {
  let s = "";
  let n = i;
  while (true) {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return s;
}

/** Desmos equation lines only (no comments): X/Y chunks or list form, then X_1, Y_1. */
function buildDesmosEquationLines(terms: TermTriple[]): string[] {
  const n = terms.length;
  if (n === 0) return [];

  if (n > DESMOS_LIST_THRESHOLD) {
    const A = terms.map((t) => formatCoeff(t.A)).join(",");
    const F = terms.map((t) => (Number.isInteger(t.freq) ? String(t.freq) : formatCoeff(t.freq))).join(",");
    const P = terms.map((t) => formatCoeff(t.ph)).join(",");
    return [
      `A=[${A}]`,
      `F=[${F}]`,
      `P=[${P}]`,
      "X_1(t)=sum(A * cos(F * t + P))",
      "Y_1(t)=sum(A * sin(F * t + P))",
    ];
  }

  if (n <= DESMOS_CHUNK_MAX) {
    const cosParts = terms.map(cosTerm);
    const sinParts = terms.map(sinTerm);
    return [`X_1(t)=${cleanJoined(cosParts)}`, `Y_1(t)=${cleanJoined(sinParts)}`];
  }

  const lines: string[] = [];
  const nChunks = Math.ceil(n / DESMOS_CHUNK_MAX);
  for (let c = 0; c < nChunks; c++) {
    const slice = terms.slice(c * DESMOS_CHUNK_MAX, (c + 1) * DESMOS_CHUNK_MAX);
    const lab = chunkLabel(c);
    lines.push(`X_1${lab}(t)=${cleanJoined(slice.map(cosTerm))}`);
  }
  for (let c = 0; c < nChunks; c++) {
    const slice = terms.slice(c * DESMOS_CHUNK_MAX, (c + 1) * DESMOS_CHUNK_MAX);
    const lab = chunkLabel(c);
    lines.push(`Y_1${lab}(t)=${cleanJoined(slice.map(sinTerm))}`);
  }
  const xParts = Array.from({ length: nChunks }, (_, c) => `X_1${chunkLabel(c)}(t)`);
  const yParts = Array.from({ length: nChunks }, (_, c) => `Y_1${chunkLabel(c)}(t)`);
  lines.push(`X_1(t)=${xParts.join("+")}`);
  lines.push(`Y_1(t)=${yParts.join("+")}`);
  return lines;
}

/** Commented block for Desmos / notes (legacy `buildDesmosExport`). */
export function buildDesmosExportText(
  model: FourierModel,
  termLimit: number,
  meta: ExportMeta = {},
): string {
  const cap = effectiveCap(model, termLimit);
  const cx = round6(model.centroid.x);
  const cy = round6(model.centroid.y);
  const lines: string[] = [];

  if (cap <= 0) {
    return "// No coefficients — process a path first.\n";
  }

  const terms = collectTerms(model, cap);
  if (terms.length === 0) {
    return "// No usable terms after filtering — raise max terms or use a different path.\n";
  }

  lines.push("// Fourier path (DFT → magnitude/phase). Coordinates centered on FFT origin (image center or centroid).");
  if (meta.imageWidth != null && meta.imageHeight != null) {
    lines.push(`// Image size: ${meta.imageWidth}×${meta.imageHeight}  →  cx=${cx}, cy=${cy}`);
  } else {
    lines.push(`// No raster size (e.g. demo silhouette) — synthesis origin: cx=${cx}, cy=${cy}`);
  }
  lines.push("// Screen / canvas (y down):  x_s = cx + X(t),  y_s = cy + Y(t)");
  lines.push("// Desmos y-up style:        x = cx + X(t),  y = cy - Y(t)   (negate Y)");
  lines.push("// Chunked / list export (test_coords): preserves term order; DC uses cos(p), sin(p).");
  lines.push("");

  lines.push(`// --- Path 1 (${terms.length} terms after drop, cap ${cap}, FFT N=${model.fftN}) ---`);
  for (const eq of buildDesmosEquationLines(terms)) {
    lines.push(eq);
  }
  lines.push("");
  lines.push("// Paste into Desmos: use (cx + X_1(t), cy - Y_1(t)) for y-up.");
  lines.push(`# Parametric (numeric origin): (${cx} + X_1(t), ${cy} - Y_1(t))`);
  lines.push(`(${cx} + X_1(t), ${cy} - Y_1(t)) {0 <= t <= 2 * pi}`);
  return lines.join("\n");
}

/** Desmos plain paste: equation lines (chunked or list) + numeric parametric tuple. */
export function buildPlainTextExportText(model: FourierModel, termLimit: number): string {
  const cap = effectiveCap(model, termLimit);
  if (cap <= 0) {
    return "No coefficients - process a path first.";
  }
  const cx = round6(model.centroid.x);
  const cy = round6(model.centroid.y);
  const terms = collectTerms(model, cap);
  if (terms.length === 0) {
    return "No usable terms after filtering - raise max terms or use a different path.";
  }
  const body = buildDesmosEquationLines(terms);
  const pair = `(${cx} + X_1(t), ${cy} - Y_1(t))`;
  return [...body, pair].join("\n");
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  return false;
}

/** Programmatic copy with execCommand fallback (legacy behavior). */
export async function copyToClipboard(text: string, textarea?: HTMLTextAreaElement | null): Promise<"ok" | "manual"> {
  const ok = await copyText(text);
  if (ok) return "ok";
  if (textarea) {
    textarea.focus();
    textarea.select();
    try {
      if (document.execCommand("copy")) return "ok";
    } catch {
      /* ignore */
    }
  }
  return "manual";
}
