"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

const EQ =
  "f(t) = \\sum_{k} c_k\\, e^{i\\omega_k t} \\;\\;\\Rightarrow\\;\\; \\text{tip traces the outline.}";

export function MathCore() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    katex.render(EQ, ref.current, {
      displayMode: true,
      throwOnError: false,
    });
  }, []);

  return (
    <section className="mx-auto max-w-4xl px-4 py-24">
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-heading text-center text-3xl font-bold text-white sm:text-4xl"
      >
        The heart of it
      </motion.h2>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="mt-10 overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-6 text-center shadow-[inset_0_0_60px_rgba(167,139,250,0.08)]"
      >
        <div ref={ref} className="katex-wrap text-zinc-100" />
      </motion.div>
      <motion.ul
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-8 grid gap-4 text-sm text-zinc-400 sm:grid-cols-3"
      >
        <li className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <span className="font-mono text-cyan-300">Each term</span> — a vector rotating at its own frequency.
        </li>
        <li className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <span className="font-mono text-violet-300">Together</span> — they interfere into a walking pen tip.
        </li>
        <li className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <span className="font-mono text-fuchsia-300">Sparse pick</span> — keep the loudest bins; drop the whisper.
        </li>
      </motion.ul>
    </section>
  );
}
