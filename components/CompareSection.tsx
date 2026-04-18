"use client";

import { epicyclePosition } from "@/lib/fourier";
import { useBrianStore } from "@/lib/store";
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
  const model = useBrianStore((s) => s.model);
  const sourcePath = useBrianStore((s) => s.sourcePath);
  const maxTerms = useBrianStore((s) => s.maxTerms);
  const originalImageSrc = useBrianStore((s) => s.originalImageSrc);
  const lineArtDataUrl = useBrianStore((s) => s.lineArtDataUrl);

  const fourierSvg = useMemo(() => {
    if (!model) return "";
    const pts: string[] = [];
    const n = 200;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2;
      const p = epicyclePosition(model, t, maxTerms);
      const x = 50 + p.x * 0.2;
      const y = 50 + p.y * 0.2;
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
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
    <section className="mx-auto max-w-6xl px-4 py-24">
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-heading text-center text-3xl font-bold text-slate-900 sm:text-4xl"
      >
        Photo · neon · traced loop · Fourier sketch
      </motion.h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600">
        Four snapshots of the same run: your raster, the OpenCV neon PNG from the bundle, the closed polyline the
        browser FFT samples (chained Canny path), and one full turn of the sparse epicycle sum at your current term cap.
      </p>

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
