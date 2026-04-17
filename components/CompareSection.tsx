"use client";

import { epicyclePosition } from "@/lib/fourier";
import { useBrianStore } from "@/lib/store";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";

export function CompareSection() {
  const model = useBrianStore((s) => s.model);
  const sourcePath = useBrianStore((s) => s.sourcePath);
  const maxTerms = useBrianStore((s) => s.maxTerms);
  const [blend, setBlend] = useState(0.5);

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
    <section className="mx-auto max-w-5xl px-4 py-24">
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-heading text-center text-3xl font-bold text-white sm:text-4xl"
      >
        Side by side
      </motion.h2>
      <p className="mx-auto mt-3 max-w-lg text-center text-sm text-zinc-500">
        Original sampled loop vs Fourier reconstruction. Drag the slider to favor one side.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="text-center font-mono text-xs text-zinc-500">Source path</div>
          <svg viewBox="0 0 100 100" className="mt-2 h-64 w-full text-emerald-400/80">
            <path d={sourceSvg} fill="none" stroke="currentColor" strokeWidth="0.5" />
          </svg>
        </div>
        <div className="relative rounded-2xl border border-white/10 bg-black/40 p-4">
          <div className="text-center font-mono text-xs text-zinc-500">Fourier trace</div>
          <svg viewBox="0 0 100 100" className="mt-2 h-64 w-full text-cyan-400/90">
            <path d={fourierSvg} fill="none" stroke="currentColor" strokeWidth="0.55" />
          </svg>
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent to-black/70"
            style={{ opacity: 1 - blend }}
          />
        </div>
      </div>
      <div className="mx-auto mt-8 max-w-md">
        <label className="text-xs text-zinc-500">Compare blend</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={blend}
          onChange={(e) => setBlend(+e.target.value)}
          className="mt-2 w-full accent-cyan-400"
        />
      </div>
    </section>
  );
}
