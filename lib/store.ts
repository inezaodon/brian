import { create } from "zustand";
import type { FourierModel, Point2 } from "./fourier";
import { buildDemoProfessorPath } from "./demoPath";
import { buildFourierModel } from "./fourier";

const DEFAULT_SAMPLES = 384;
const DEFAULT_SPARSE = 400;

type BrianState = {
  sourcePath: Point2[];
  model: FourierModel | null;
  maxTerms: number;
  speed: number;
  showCircles: boolean;
  showPath: boolean;
  showVectors: boolean;
  lineWidth: number;
  scrub: number;
  setMaxTerms: (n: number) => void;
  setSpeed: (s: number) => void;
  setShowCircles: (v: boolean) => void;
  setShowPath: (v: boolean) => void;
  setShowVectors: (v: boolean) => void;
  setLineWidth: (w: number) => void;
  setScrub: (s: number) => void;
  setSourcePath: (path: Point2[]) => void;
  resetDemo: () => void;
};

function computeModel(path: Point2[]): FourierModel {
  return buildFourierModel(path, DEFAULT_SAMPLES, DEFAULT_SPARSE);
}

const demo = buildDemoProfessorPath();

export const useBrianStore = create<BrianState>((set, get) => ({
  sourcePath: demo,
  model: computeModel(demo),
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
  setShowCircles: (v) => set({ showCircles: v }),
  setShowPath: (v) => set({ showPath: v }),
  setShowVectors: (v) => set({ showVectors: v }),
  setLineWidth: (w) => set({ lineWidth: w }),
  setScrub: (s) => set({ scrub: Math.max(0, Math.min(1, s)) }),
  setSourcePath: (path) => {
    const model = computeModel(path);
    set({ sourcePath: path, model });
  },
  resetDemo: () => {
    const p = buildDemoProfessorPath();
    set({ sourcePath: p, model: computeModel(p) });
  },
}));
