"use client";

import { Controls } from "@/components/Controls";
import { FourierVisualizer } from "@/components/FourierVisualizer";
import { useResponsiveCanvasSize } from "@/hooks/useResponsiveCanvasSize";
import { useSketchStore } from "@/lib/store";
import { motion } from "framer-motion";

export function Playground() {
  const originalImageSrc = useSketchStore((s) => s.originalImageSrc);
  const lineArtDataUrl = useSketchStore((s) => s.lineArtDataUrl);
  const canvas = useResponsiveCanvasSize({ maxWidth: 560, aspect: 560 / 400, minWidth: 280, minHeight: 200 });

  return (
    <section id="experiment" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center"
      >
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-800/80">Playground</p>
        <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 sm:text-4xl">
          Tune the same pipeline interactively
        </h2>
        <div className="mx-auto mt-4 max-w-2xl space-y-4 text-left text-sm leading-relaxed text-slate-600 sm:text-center">
          <p>
            <a
              href="#pipeline-four-up"
              className="font-medium text-cyan-800 underline-offset-2 hover:underline"
            >
              Pipeline overview
            </a>{" "}
            above walks photo → neon → DFT polyline → epicycle trace. This section runs <strong>that same path</strong>{" "}
            through the live sketch, previews, and sliders.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-left sm:mx-auto sm:max-w-xl sm:pl-6 sm:text-left">
            <li>
              <strong className="text-slate-800">Server bundle</strong> — uploading calls{" "}
              <code className="text-slate-800">/api/portrait_pipeline</code>: OpenCV builds the neon PNG, Canny edge
              mask, and the stitched closed polyline the FFT will eat.
            </li>
            <li>
              <strong className="text-slate-800">Browser FFT</strong> — the app resamples the path, subtracts the FFT
              origin (image centre on upload), zero-pads, and keeps the strongest frequency bins for the epicycle sum.
            </li>
            <li>
              <strong className="text-slate-800">Controls</strong> — terms, speed, line weight, feature regions, edge
              threshold (next upload), and vector / path / circle toggles all recompute or redraw immediately.
            </li>
            <li>
              <strong className="text-slate-800">Export</strong> —{" "}
              <a href="#export" className="font-medium text-cyan-800 underline-offset-2 hover:underline">
                Desmos-ready equations
              </a>{" "}
              and plain text come from the current sparse model (defaults include{" "}
              <span className="font-mono text-slate-800">139</span> terms). Legacy worker notes live in{" "}
              <code className="text-slate-800">Downloads/fourier-worker.js</code>.
            </li>
          </ol>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mt-10 grid min-w-0 gap-4 sm:grid-cols-2"
      >
        <div className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <p className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">Original input</p>
          <div className="mt-2 flex max-h-56 min-h-[140px] items-center justify-center bg-stone-50">
            {originalImageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={originalImageSrc}
                alt="Image fed to the contour pipeline"
                className="max-h-56 w-full min-w-0 object-contain"
              />
            ) : (
              <p className="px-4 text-center text-xs text-slate-400">Loading default portrait…</p>
            )}
          </div>
        </div>
        <div className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-slate-950 p-3 shadow-sm">
          <p className="text-center font-mono text-[10px] uppercase tracking-wider text-slate-400">
            Neon line art (OpenCV)
          </p>
          <div className="mt-2 flex max-h-56 min-h-[140px] items-center justify-center">
            {lineArtDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lineArtDataUrl} alt="Neon line art preview" className="max-h-56 w-full min-w-0 object-contain" />
            ) : (
              <p className="px-4 text-center text-xs text-slate-500">Awaiting pipeline…</p>
            )}
          </div>
        </div>
      </motion.div>

      <div className="mt-10 grid min-w-0 gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="flex min-h-[min(360px,50dvh)] items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-white p-3 shadow-sm sm:p-4"
        >
          <div className="flex w-full min-w-0 flex-col items-center gap-2">
            <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Fourier sketch (live)</p>
            <div ref={canvas.ref} className="w-full min-w-0 max-w-[560px]">
              <FourierVisualizer
                width={canvas.width}
                height={canvas.height}
                theme="light"
                className="w-full max-w-full rounded-lg"
              />
            </div>
          </div>
        </motion.div>
        <Controls />
      </div>
    </section>
  );
}
