import type { Point2 } from "./fourier";

export type PortraitPipelineResponse = {
  width: number;
  height: number;
  fftOrigin: Point2;
  path: Point2[];
  edgeMaskPngBase64: string;
  lineArtPngBase64: string;
  error?: string;
};

function pngBase64ToDataUrl(b64: string): string {
  return `data:image/png;base64,${b64}`;
}

/**
 * Full OpenCV portrait bundle: Canny edge mask, resampled path (FFT input), neon line-art PNG.
 * Same route on Vercel (`api/portrait_pipeline.py`) and locally (`app/api/portrait_pipeline`).
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
} | null> {
  const url = process.env.NEXT_PUBLIC_PORTRAIT_PIPELINE_API ?? "/api/portrait_pipeline";
  const form = new FormData();
  form.append("image", file);
  form.append("edgeThreshold", String(opts?.edgeThreshold ?? 105));
  form.append("maxSide", String(opts?.maxSide ?? 280));
  form.append("samplePoints", String(opts?.samplePoints ?? 384));
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
    };
  } catch {
    return null;
  }
}
