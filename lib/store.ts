import { create } from "zustand";
import type { FourierModel, Point2 } from "./fourier";
import { buildDemoProfessorPath } from "./demoPath";
import { buildFourierModel } from "./fourier";
import { buildRegionModels } from "./regionFourier";

const DEFAULT_SAMPLES = 512;
const DEFAULT_SPARSE = 400;

type BrianState = {
  sourcePath: Point2[];
  model: FourierModel | null;
  /** When >1, epicycle canvas uses one model per spatial region (cuts at largest gaps). */
  featureRegions: number;
  regionModels: FourierModel[];
  /** Last FFT origin from portrait upload (image center); used when recomputing regions. */
  lastFftOrigin: Point2 | null;
  /** Public path or blob: URL for the raster shown next to traces. */
  originalImageSrc: string | null;
  /** PNG data URL from OpenCV neon layer (`/api/portrait_pipeline` bundle). */
  lineArtDataUrl: string | null;
  /** PNG data URL: OpenCV Canny edge mask (same run as DFT path + neon in `/api/portrait_pipeline`). */
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
  setFeatureRegions: (n: number) => void;
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

function computeRegionModels(path: Point2[], regionCount: number): FourierModel[] {
  if (regionCount <= 1) return [];
  return buildRegionModels(path, regionCount, DEFAULT_SAMPLES, DEFAULT_SPARSE);
}

const demo = buildDemoProfessorPath();

const DEFAULT_FEATURE_REGIONS = 4;

export const useBrianStore = create<BrianState>((set, get) => ({
  sourcePath: demo,
  model: computeModel(demo),
  featureRegions: DEFAULT_FEATURE_REGIONS,
  regionModels: computeRegionModels(demo, DEFAULT_FEATURE_REGIONS),
  lastFftOrigin: null,
  originalImageSrc: null,
  lineArtDataUrl: null,
  edgeMaskDataUrl: null,
  lastImageSize: null,
  edgeThreshold: 105,
  maxTerms: 139,
  speed: 3,
  showCircles: false,
  showPath: true,
  showVectors: true,
  lineWidth: 1,
  scrub: 1,
  setMaxTerms: (n) => {
    set({ maxTerms: n });
  },
  setFeatureRegions: (n) => {
    const k = Math.max(1, Math.min(12, Math.round(n)));
    const { sourcePath } = get();
    const fft = get().lastFftOrigin ?? undefined;
    set({
      featureRegions: k,
      model: computeModel(sourcePath, fft),
      regionModels: computeRegionModels(sourcePath, k),
    });
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
    const fft = options?.fftOrigin;
    const model = computeModel(path, fft);
    const k = get().featureRegions;
    const regionModels = computeRegionModels(path, k);
    const patch: Partial<
      Pick<
        BrianState,
        | "sourcePath"
        | "model"
        | "regionModels"
        | "lastFftOrigin"
        | "lastImageSize"
        | "lineArtDataUrl"
        | "edgeMaskDataUrl"
      >
    > = {
      sourcePath: path,
      model,
      regionModels,
      lastFftOrigin: fft ? { x: fft.x, y: fft.y } : null,
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
