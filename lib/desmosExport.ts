/**
 * Desmos / graphing exports — same formulas as `legacy/index.html` (`buildDesmosExport`,
 * `buildPlainTextExport`) and `preview/sketch-only-ui`: one path uses X_1, Y_1 with
 * X(t)=Σ A_k cos(ω_k t + φ_k), Y(t)=Σ A_k sin(ω_k t + φ_k), A_k=|c_k|, φ_k=arg(c_k).
 * Screen: x_s = cx + X(t), y_s = cy + Y(t). Desmos y-up: (cx + X(t), cy - Y(t)).
 */

import type { FourierModel } from "./fourier";

export function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

export type ExportMeta = {
  /** When set, echoed in commented export (worker-sized raster). */
  imageWidth?: number;
  imageHeight?: number;
};

function effectiveCap(model: FourierModel, termLimit: number): number {
  return Math.min(termLimit, model.coeffsRe.length);
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

  lines.push("// Fourier path (DFT → magnitude/phase). Coordinates centered on FFT origin (image center or centroid).");
  if (meta.imageWidth != null && meta.imageHeight != null) {
    lines.push(`// Image size: ${meta.imageWidth}×${meta.imageHeight}  →  cx=${cx}, cy=${cy}`);
  } else {
    lines.push(`// No raster size (e.g. demo silhouette) — synthesis origin: cx=${cx}, cy=${cy}`);
  }
  lines.push("// Screen / canvas (y down):  x_s = cx + X(t),  y_s = cy + Y(t)");
  lines.push("// Desmos y-up style:        x = cx + X(t),  y = cy - Y(t)   (negate Y)");
  lines.push("");

  const partsX: string[] = [];
  const partsY: string[] = [];
  for (let k = 0; k < cap; k++) {
    const freq = model.freqs[k];
    const ck = model.coeffsRe[k];
    const sk = model.coeffsIm[k];
    const A = round6(Math.hypot(ck, sk));
    const ph = round6(Math.atan2(sk, ck));
    if (k > 0 && Math.abs(A) < 1e-8) continue;
    partsX.push(`${A}*cos(${freq}*t+${ph})`);
    partsY.push(`${A}*sin(${freq}*t+${ph})`);
  }

  lines.push(`// --- Path 1 (top ${cap} sparse terms, FFT N=${model.fftN}) ---`);
  lines.push(`X_1(t)=${partsX.join("+")}`);
  lines.push(`Y_1(t)=${partsY.join("+")}`);
  lines.push("");
  lines.push("// Paste into Desmos: use (cx + X_1(t), cy - Y_1(t)) for y-up.");
  lines.push("# Paste into Desmos: use (cx + X_1(t), cy - Y_1(t)) for y-up.");
  lines.push("(cx + X_1(t), cy - Y_1(t)) {0 <= t <= 2 * pi}");
  return lines.join("\n");
}

/** ASCII-only lines Desmos can paste (legacy `buildPlainTextExport`). */
export function buildPlainTextExportText(model: FourierModel, termLimit: number): string {
  const cap = effectiveCap(model, termLimit);
  if (cap <= 0) {
    return "No coefficients - process a path first.";
  }
  const lines: string[] = [];
  const cx = round6(model.centroid.x);
  const cy = round6(model.centroid.y);
  lines.push(`cx=${cx}`);
  lines.push(`cy=${cy}`);

  const partsX: string[] = [];
  const partsY: string[] = [];
  for (let j = 0; j < cap; j++) {
    const freq = model.freqs[j];
    const ck = model.coeffsRe[j];
    const sk = model.coeffsIm[j];
    const A = round6(Math.hypot(ck, sk));
    const ph = round6(Math.atan2(sk, ck));
    if (j > 0 && Math.abs(A) < 1e-8) continue;
    partsX.push(`${A}*cos(${freq}*t+${ph})`);
    partsY.push(`${A}*sin(${freq}*t+${ph})`);
  }
  lines.push(`X_1(t)=${partsX.join("+")}`);
  lines.push(`Y_1(t)=${partsY.join("+")}`);
  lines.push("");
  lines.push("# Paste into Desmos: use (cx + X_1(t), cy - Y_1(t)) for y-up.");
  lines.push("(cx + X_1(t), cy - Y_1(t)) {0 <= t <= 2 * pi}");
  return lines.join("\n");
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
