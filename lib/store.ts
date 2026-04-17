import { create } from "zustand";
import type { FourierModel, Point2 } from "./fourier";
import { buildDemoProfessorPath } from "./demoPath";
import { buildFourierModel } from "./fourier";

const DEFAULT_SAMPLES = 384;
const DEFAULT_SPARSE = 400;

type BrianState = {
  sourcePath: Point2[];
  model: FourierModel | null;
  /** Public path or blob: URL for the raster shown next to traces. */
  originalImageSrc: string | null;
  /** PNG data URL from OpenCV neon pipeline (`/api/neon_lineart`). */
  lineArtDataUrl: string | null;
  /** PNG data URL: browser Sobel-percentile edge mask (same raster used to trace the DFT loop). */
  edgeMaskDataUrl: string | null;
  /** Set after raster upload — echoed in Desmos export header (legacy worker size). */
  lastImageSize: { w: number; h: number } | null;
  /** Used for the next image upload (legacy worker default ≈ 105). */
  edgeThreshold: number;
  maxTerms: number;
  speed: number;
  showCircles: boolean;
  showPath: boolean;
  showVectors: boolean;
  lineWidth: number;
  scrub: number;
  setMaxTerms: (n: number) => void;
  setSpeed: (s: number) => void;
  setEdgeThreshold: (n: number) => void;
  setShowCircles: (v: boolean) => void;
  setShowPath: (v: boolean) => void;
  setShowVectors: (v: boolean) => void;
  setLineWidth: (w: number) => void;
  setScrub: (s: number) => void;
  setOriginalImageSrc: (src: string | null) => void;
  /** Pass `fftOrigin` / `imageSize` / `lineArtDataUrl` / `edgeMaskDataUrl`. */
  setSourcePath: (
    path: Point2[],
    options?: {
      fftOrigin?: Point2;
      imageSize?: { w: number; h: number } | null;
      lineArtDataUrl?: string | null;
      edgeMaskDataUrl?: string | null;
    },
  ) => void;
  resetDemo: () => void;
};

function computeModel(path: Point2[], fftOrigin?: Point2): FourierModel {
  return buildFourierModel(path, DEFAULT_SAMPLES, DEFAULT_SPARSE, fftOrigin);
}

const demo = buildDemoProfessorPath();

export const useBrianStore = create<BrianState>((set, get) => ({
  sourcePath: demo,
  model: computeModel(demo),
  originalImageSrc: null,
  lineArtDataUrl: null,
  edgeMaskDataUrl: null,
  lastImageSize: null,
  edgeThreshold: 105,
  maxTerms: 120,
  speed: 1,
  showCircles: true,
  showPath: true,
  showVectors: true,
  lineWidth: 2,
  scrub: 1,
  setMaxTerms: (n) => {
    set({ maxTerms: n });
  },
  setSpeed: (s) => set({ speed: s }),
  setEdgeThreshold: (n) => set({ edgeThreshold: Math.min(255, Math.max(20, n)) }),
  setOriginalImageSrc: (src) => {
    const prev = get().originalImageSrc;
    if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
    set({ originalImageSrc: src });
  },
  setShowCircles: (v) => set({ showCircles: v }),
  setShowPath: (v) => set({ showPath: v }),
  setShowVectors: (v) => set({ showVectors: v }),
  setLineWidth: (w) => set({ lineWidth: w }),
  setScrub: (s) => set({ scrub: Math.max(0, Math.min(1, s)) }),
  setSourcePath: (path, options) => {
    const model = computeModel(path, options?.fftOrigin);
    const patch: Partial<
      Pick<BrianState, "sourcePath" | "model" | "lastImageSize" | "lineArtDataUrl" | "edgeMaskDataUrl">
    > = {
      sourcePath: path,
      model,
    };
    if (options && "imageSize" in options) {
      patch.lastImageSize = options.imageSize ?? null;
    }
    if (options && "lineArtDataUrl" in options) {
      patch.lineArtDataUrl = options.lineArtDataUrl ?? null;
    }
    if (options && "edgeMaskDataUrl" in options) {
      patch.edgeMaskDataUrl = options.edgeMaskDataUrl ?? null;
    }
    set(patch);
  },
  resetDemo: () => {
    void import("./defaultPortrait").then((m) => m.reloadDefaultPortrait());
  },
}));
