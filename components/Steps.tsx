"use client";

import { VisualDeck } from "@/components/VisualDeck";
import { motion } from "framer-motion";

const beats = [
  { k: "01", t: "Original idea", d: "Photo or silhouette → raster pipeline." },
  { k: "02", t: "Extracted path", d: "Blur, Sobel, mask, greedy chain, arc-length samples." },
  { k: "03", t: "Fourier coefficients", d: "Complex z_j, zero-pad, FFT, sparse magnitude pick." },
  { k: "04", t: "Reconstruction", d: "Rotating phasors chained; tip redraws the loop." },
];

export function Steps() {
  return (
    <section id="pipeline" className="mx-auto max-w-6xl px-4 py-24">
      <motion.h2
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        className="font-heading text-center text-3xl font-bold text-slate-900 sm:text-4xl"
      >
        Visual deck — four canvases
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mx-auto mt-4 max-w-2xl text-center text-sm leading-relaxed text-slate-600"
      >
        Same layout spirit as the old Fourier Studio: sketch, OpenCV contour mask + path, neon line art, and the image
        stack —{" "}
        <span className="font-medium text-slate-800">reorder panels</span> with the arrows (like shuffle-left / right).
        The hero stays clean; the heavy drawing lives here and in the playground.
      </motion.p>

      <VisualDeck />

      <div className="mx-auto mt-14 grid max-w-4xl gap-3 sm:grid-cols-2">
        {beats.map((b, i) => (
          <motion.div
            key={b.k}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-stone-200 bg-white/90 px-4 py-3 shadow-sm"
          >
            <div className="font-mono text-[10px] uppercase tracking-wider text-cyan-700/90">{b.k}</div>
            <div className="mt-1 font-heading text-sm font-semibold text-slate-900">{b.t}</div>
            <p className="mt-1 text-xs leading-snug text-slate-600">{b.d}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
