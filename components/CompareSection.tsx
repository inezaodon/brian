"use client";

import { epicyclePosition } from "@/lib/fourier";
import { useBrianStore } from "@/lib/store";
import { motion } from "framer-motion";
import { useMemo } from "react";

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
        Original vs pipeline vs sketch
      </motion.h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600">
        Same order as the static studio: raster in, Sobel line art, resampled contour that the DFT sees, then the
        Fourier trace with your current term cap.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <div className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">1 · Original</div>
          <div className="mt-2 flex aspect-square max-h-64 items-center justify-center bg-stone-50">
            {originalImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={originalImageSrc} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-slate-950 p-3 shadow-sm">
          <div className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-400">
            2 · Line art (enhanced)
          </div>
          <div className="mt-2 flex aspect-square max-h-64 items-center justify-center">
            {lineArtDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lineArtDataUrl} alt="" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-slate-500">—</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <div className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">
            3 · Extracted loop
          </div>
          <svg viewBox="0 0 100 100" className="mt-2 aspect-square max-h-64 w-full text-emerald-700/90">
            <rect width="100" height="100" fill="#fafafa" rx="4" />
            <path d={sourceSvg} fill="none" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <div className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">
            4 · Fourier trace
          </div>
          <svg viewBox="0 0 100 100" className="mt-2 aspect-square max-h-64 w-full text-cyan-700/90">
            <rect width="100" height="100" fill="#fafafa" rx="4" />
            <path d={fourierSvg} fill="none" stroke="currentColor" strokeWidth="0.55" />
          </svg>
        </div>
      </div>
    </section>
  );
}
