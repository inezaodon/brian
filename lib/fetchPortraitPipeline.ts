import type { Point2 } from "./fourier";

export type PortraitPipelineResponse = {
  width: number;
  height: number;
  fftOrigin: Point2;
  path: Point2[];
  edgeMaskPngBase64: string;
  lineArtPngBase64: string;
  /** `chainedCanny` = stitched RETR_LIST edges; `photoCanny` = merged-blob fallback. */
  pathSource?: string;
  /** True when the primary chained-Canny strategy produced a path. */
  lineArtPathVerify?: boolean;
  error?: string;
};

function pngBase64ToDataUrl(b64: string): string {
  return `data:image/png;base64,${b64}`;
}

/**
 * Full OpenCV portrait bundle: resampled path (FFT input, prefer trace from neon line art),
 * edge mask PNG, neon PNG, plus `pathSource` / `lineArtPathVerify` from the server.
 */
export async function fetchPortraitPipeline(
  file: File,
  opts?: { edgeThreshold?: number; maxSide?: number; samplePoints?: number },
): Promise<{
  path: Point2[];
  fftOrigin: Point2;
  width: number;
  height: number;
  edgeMaskDataUrl: string;
  lineArtDataUrl: string;
  pathSource: string;
  lineArtPathVerify: boolean;
} | null> {
  const url = process.env.NEXT_PUBLIC_PORTRAIT_PIPELINE_API ?? "/api/portrait_pipeline";
  const form = new FormData();
  form.append("image", file);
  form.append("edgeThreshold", String(opts?.edgeThreshold ?? 105));
  form.append("maxSide", String(opts?.maxSide ?? 420));
  form.append("samplePoints", String(opts?.samplePoints ?? 512));
  try {
    const res = await fetch(url, { method: "POST", body: form });
    if (!res.ok) return null;
    const j = (await res.json()) as PortraitPipelineResponse;
    if (j.error || !Array.isArray(j.path) || !j.edgeMaskPngBase64 || !j.lineArtPngBase64) return null;
    return {
      path: j.path,
      fftOrigin: j.fftOrigin,
      width: j.width,
      height: j.height,
      edgeMaskDataUrl: pngBase64ToDataUrl(j.edgeMaskPngBase64),
      lineArtDataUrl: pngBase64ToDataUrl(j.lineArtPngBase64),
      pathSource: j.pathSource ?? "unknown",
      lineArtPathVerify: Boolean(j.lineArtPathVerify),
    };
  } catch {
    return null;
  }
}
