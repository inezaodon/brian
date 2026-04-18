"use client";

import { epicyclePosition } from "@/lib/fourier";
import { useSketchStore } from "@/lib/store";
import { motion } from "framer-motion";
import { useMemo } from "react";
import type { ReactNode } from "react";

/** Uniform square frame so photos, neon, and SVGs align across the four columns. */
function CompareFrame({ tone, children }: { tone: "light" | "dark"; children: ReactNode }) {
  const shell =
    tone === "dark"
      ? "border-slate-700/80 bg-slate-900"
      : "border-stone-200/90 bg-stone-50";
  return (
    <div
      className={`relative mt-2 aspect-square w-full max-h-64 min-h-0 overflow-hidden rounded-xl border ${shell}`}
    >
      <div className="absolute inset-0 flex items-center justify-center p-1.5 sm:p-2">{children}</div>
    </div>
  );
}

export function CompareSection() {
  const model = useSketchStore((s) => s.model);
  const sourcePath = useSketchStore((s) => s.sourcePath);
  const maxTerms = useSketchStore((s) => s.maxTerms);
  const originalImageSrc = useSketchStore((s) => s.originalImageSrc);
  const lineArtDataUrl = useSketchStore((s) => s.lineArtDataUrl);

  /** Same centering + scale as the DFT polyline so the trace sits in the middle of the 100×100 viewBox. */
  const fourierSvg = useMemo(() => {
    if (!model) return "";
    const n = 200;
    const samples: { x: number; y: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2;
      const p = epicyclePosition(model, t, maxTerms);
      samples.push({ x: p.x, y: p.y });
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of samples) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const bw = maxX - minX || 1;
    const bh = maxY - minY || 1;
    const s = 80 / Math.max(bw, bh);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const pts: string[] = [];
    samples.forEach((p, i) => {
      const x = 50 + (p.x - cx) * s;
      const y = 50 + (p.y - cy) * s;
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    });
    return pts.join(" ");
  }, [model, maxTerms]);

  const sourceSvg = useMemo(() => {
    if (!sourcePath.length) return "";
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of sourcePath) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const bw = maxX - minX || 1;
    const bh = maxY - minY || 1;
    const s = 80 / Math.max(bw, bh);
    const pts: string[] = [];
    sourcePath.forEach((p, i) => {
      const x = 50 + (p.x - (minX + maxX) / 2) * s;
      const y = 50 + (p.y - (minY + maxY) / 2) * s;
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    });
    return pts.join(" ") + " Z";
  }, [sourcePath]);

  return (
    <section
      id="pipeline-four-up"
      className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24"
      aria-labelledby="pipeline-four-heading"
    >
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center font-mono text-xs uppercase tracking-[0.28em] text-cyan-800/80"
      >
        Pipeline overview
      </motion.p>
      <motion.h2
        id="pipeline-four-heading"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-2 font-heading text-center text-3xl font-bold text-slate-900 sm:text-4xl"
      >
        Photo · neon · traced loop · Fourier sketch
      </motion.h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600">
        The row below is one end-to-end run: each square matches a stage from pixels to the curve the epicycles redraw.
      </p>
      <motion.ol
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mx-auto mt-8 max-w-3xl list-decimal space-y-3 pl-5 text-left text-sm leading-relaxed text-slate-600 sm:pl-6"
      >
        <li>
          <span className="font-medium text-slate-800">Photo</span> — the raster you upload (or the bundled default).
          Everything downstream uses this resolution and aspect after the server resizes the long edge.
        </li>
        <li>
          <span className="font-medium text-slate-800">Neon (OpenCV)</span> — blur, Canny edges, contour cleanup, then
          glow / HSV styling in Python. It is a <em>preview</em> of line energy; the DFT path is built separately from
          stitched Canny chains so eyes, nose, and outline can all contribute.
        </li>
        <li>
          <span className="font-medium text-slate-800">DFT polyline</span> — the exact closed polyline returned by the
          portrait bundle: many contours from <span className="font-mono text-slate-800">RETR_LIST</span>, stitched by
          nearest-neighbour endpoints, resampled to fixed arc-length samples. Those <span className="font-mono text-slate-800">(x, y)</span>{" "}
          points become complex numbers <span className="font-mono text-slate-800">z_j</span> for the FFT.
        </li>
        <li>
          <span className="font-medium text-slate-800">Epicycle trace</span> — one full parameter turn of the sparse sum
          of rotating vectors whose amplitudes and phases come from the browser DFT. It should match the polyline when
          enough terms are kept; fewer terms smooth the sketch.
        </li>
      </motion.ol>

      <div className="mt-10 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <div className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">1 · Photo</div>
          <CompareFrame tone="light">
            {originalImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={originalImageSrc} alt="" className="h-full w-full object-contain object-center" />
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </CompareFrame>
        </div>
        <div className="min-w-0 rounded-2xl border border-stone-200 bg-slate-950 p-3 shadow-sm">
          <div className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-400">
            2 · Neon (OpenCV)
          </div>
          <CompareFrame tone="dark">
            {lineArtDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lineArtDataUrl} alt="" className="h-full w-full object-contain object-center" />
            ) : (
              <span className="text-xs text-slate-500">—</span>
            )}
          </CompareFrame>
        </div>
        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <div className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">
            3 · DFT polyline
          </div>
          <CompareFrame tone="light">
            <svg viewBox="0 0 100 100" className="h-full w-full text-emerald-700/90" preserveAspectRatio="xMidYMid meet">
              <rect width="100" height="100" fill="#fafafa" rx="4" />
              <path d={sourceSvg} fill="none" stroke="currentColor" strokeWidth="0.5" />
            </svg>
          </CompareFrame>
        </div>
        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <div className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">
            4 · Epicycle trace
          </div>
          <CompareFrame tone="light">
            <svg viewBox="0 0 100 100" className="h-full w-full text-cyan-700/90" preserveAspectRatio="xMidYMid meet">
              <rect width="100" height="100" fill="#fafafa" rx="4" />
              <path d={fourierSvg} fill="none" stroke="currentColor" strokeWidth="0.55" />
            </svg>
          </CompareFrame>
        </div>
      </div>
    </section>
  );
}
