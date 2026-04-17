"use client";

import { motion } from "framer-motion";
import { useBrianStore } from "@/lib/store";
import { epicyclePosition } from "@/lib/fourier";
import { useMemo } from "react";

const steps = [
  { title: "Original idea", body: "Start with a closed curve — here, a stylized silhouette standing in for lecture-hall legend." },
  { title: "Extracted path", body: "Resample along arc length so the loop has evenly spaced samples for the DFT." },
  { title: "Fourier coefficients", body: "FFT → sort bins by energy → keep the strongest harmonics. Each one is a spinning vector." },
  { title: "Reconstruction", body: "Sum those rotating vectors; the pen tip traces the face again — with ghosts of circles orbiting it." },
];

export function Steps() {
  const model = useBrianStore((s) => s.model);
  const maxTerms = useBrianStore((s) => s.maxTerms);
  const svgPath = useMemo(() => {
    if (!model) return "";
    const pts: string[] = [];
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * Math.PI * 2;
      const p = epicyclePosition(model, t, maxTerms);
      const x = 50 + p.x * 0.18;
      const y = 50 + p.y * 0.18;
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ") + " Z";
  }, [model, maxTerms]);

  return (
    <section className="mx-auto max-w-5xl px-4 py-24">
      <motion.h2
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        className="font-heading text-center text-3xl font-bold text-white sm:text-4xl"
      >
        Four beats of the joke
      </motion.h2>
      <div className="mt-16 grid gap-10 md:grid-cols-2">
        {steps.map((s, i) => (
          <motion.article
            key={s.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[0_0_40px_rgba(34,211,238,0.06)] backdrop-blur-md"
          >
            <div className="font-mono text-xs text-cyan-300/80">Step {i + 1}</div>
            <h3 className="mt-2 font-heading text-xl font-semibold text-white">{s.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{s.body}</p>
            {i === 3 && model && (
              <svg viewBox="0 0 100 100" className="mt-4 h-28 w-full text-cyan-400/50">
                <path d={svgPath} fill="none" stroke="currentColor" strokeWidth="0.6" />
              </svg>
            )}
          </motion.article>
        ))}
      </div>
    </section>
  );
}
