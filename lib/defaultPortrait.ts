import { contourPathFromImageFile } from "@/lib/contourFromImage";
import { fetchOpenCvNeonLineartAsDataUrl } from "@/lib/fetchOpenCvNeonLineart";
import { useBrianStore } from "@/lib/store";

export const DEFAULT_PORTRAIT_PUBLIC_PATH = "/default-portrait.png";

/**
 * Load bundled default portrait, run the same contour + line-art pipeline as uploads,
 * and push into the store (FFT origin = image center).
 */
export async function reloadDefaultPortrait(): Promise<void> {
  const res = await fetch(DEFAULT_PORTRAIT_PUBLIC_PATH);
  if (!res.ok) throw new Error(`Missing ${DEFAULT_PORTRAIT_PUBLIC_PATH}`);
  const blob = await res.blob();
  const file = new File([blob], "default-portrait.png", { type: blob.type || "image/png" });
  const edgeThreshold = useBrianStore.getState().edgeThreshold;
  const [contour, openCvLineArt] = await Promise.all([
    contourPathFromImageFile(file, {
      edgeThreshold,
      maxSide: 280,
      samplePoints: 384,
    }),
    fetchOpenCvNeonLineartAsDataUrl(file),
  ]);
  const { path, fftOrigin, width, height } = contour;
  useBrianStore.getState().setSourcePath(path, {
    fftOrigin,
    imageSize: { w: width, h: height },
    lineArtDataUrl: openCvLineArt,
  });
  useBrianStore.getState().setOriginalImageSrc(DEFAULT_PORTRAIT_PUBLIC_PATH);
}
