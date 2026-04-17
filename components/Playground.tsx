"use client";

import { Controls } from "@/components/Controls";
import { FourierVisualizer } from "@/components/FourierVisualizer";
import { motion } from "framer-motion";

export function Playground() {
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
          Terms, speed, toggles, stroke — everything hot-swaps. Uploads use the same blur → Sobel → adaptive mask →
          8-connected contour → greedy ordering as the original worker (largest blob, then arc-length resample).{" "}
          <a href="#export" className="font-medium text-cyan-800 underline-offset-2 hover:underline">
            Desmos export &amp; plain text
          </a>{" "}
          are in the next section.
        </p>
      </motion.div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
        >
          <FourierVisualizer width={560} height={400} theme="light" className="max-w-full rounded-lg" />
        </motion.div>
        <Controls />
      </div>
    </section>
  );
}
