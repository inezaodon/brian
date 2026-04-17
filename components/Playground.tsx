"use client";

import { Controls } from "@/components/Controls";
import { FourierVisualizer } from "@/components/FourierVisualizer";
import { useBrianStore } from "@/lib/store";
import { motion } from "framer-motion";

export function Playground() {
  const originalImageSrc = useBrianStore((s) => s.originalImageSrc);
  const lineArtDataUrl = useBrianStore((s) => s.lineArtDataUrl);

  return (
    <section id="experiment" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center"
      >
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-800/80">Playground</p>
        <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 sm:text-4xl">Twist the prank in real time</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600">
          Terms, speed, toggles, stroke — everything hot-swaps. Pipeline matches your worker: 3× blur simplify, Sobel,
          percentile mask, greedy chain, arc-length samples (see <code className="text-slate-800">Downloads/fourier-worker.js</code>
          ).{" "}
          <a href="#export" className="font-medium text-cyan-800 underline-offset-2 hover:underline">
            Desmos export &amp; plain text
          </a>{" "}
          follow.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-10 grid gap-4 sm:grid-cols-2"
      >
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <p className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">Original input</p>
          <div className="mt-2 flex max-h-56 min-h-[140px] items-center justify-center bg-stone-50">
            {originalImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={originalImageSrc}
                alt="Image fed to the contour pipeline"
                className="max-h-56 w-full object-contain"
              />
            ) : (
              <p className="px-4 text-center text-xs text-slate-400">Loading default portrait…</p>
            )}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-slate-950 p-3 shadow-sm">
          <p className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Neon line art (OpenCV)
          </p>
          <div className="mt-2 flex max-h-56 min-h-[140px] items-center justify-center">
            {lineArtDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lineArtDataUrl} alt="Neon line art preview" className="max-h-56 w-full object-contain" />
            ) : (
              <p className="px-4 text-center text-xs text-slate-500">Awaiting pipeline…</p>
            )}
          </div>
        </div>
      </motion.div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
        >
          <div className="flex w-full flex-col items-center gap-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Fourier sketch (live)</p>
            <FourierVisualizer width={560} height={400} theme="light" className="max-w-full rounded-lg" />
          </div>
        </motion.div>
        <Controls />
      </div>
    </section>
  );
}
