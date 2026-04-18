import { fetchPortraitPipeline } from "@/lib/fetchPortraitPipeline";
import { useSketchStore } from "@/lib/store";

export const DEFAULT_PORTRAIT_PUBLIC_PATH = "/default-portrait.png";

/**
 * Load bundled default portrait, run the OpenCV portrait bundle (path + mask + line art),
 * and push into the store (FFT origin = image center).
 */
export async function reloadDefaultPortrait(): Promise<void> {
  const res = await fetch(DEFAULT_PORTRAIT_PUBLIC_PATH);
  if (!res.ok) throw new Error(`Missing ${DEFAULT_PORTRAIT_PUBLIC_PATH}`);
  const blob = await res.blob();
  const file = new File([blob], "default-portrait.png", { type: blob.type || "image/png" });
  const edgeThreshold = useSketchStore.getState().edgeThreshold;
  const bundle = await fetchPortraitPipeline(file, {
    edgeThreshold,
    maxSide: 420,
    samplePoints: 512,
  });
  if (!bundle) throw new Error("Portrait pipeline unavailable (Python/OpenCV).");
  const { path, fftOrigin, width, height, edgeMaskDataUrl, lineArtDataUrl } = bundle;
  useSketchStore.getState().setSourcePath(path, {
    fftOrigin,
    imageSize: { w: width, h: height },
    lineArtDataUrl,
    edgeMaskDataUrl,
  });
  useSketchStore.getState().setOriginalImageSrc(DEFAULT_PORTRAIT_PUBLIC_PATH);
}
