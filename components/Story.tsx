"use client";

import { motion } from "framer-motion";

export function Story() {
  return (
    <section id="story" className="relative mx-auto max-w-3xl px-4 py-24">
      <motion.h2
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        className="font-heading text-3xl font-bold text-slate-900 sm:text-4xl"
      >
        Why I did this
      </motion.h2>
      <div className="mt-10 space-y-6 text-lg leading-relaxed text-slate-600">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.05 }}
        >
          We were learning Fourier series in class. So I asked myself:{" "}
          <span className="font-medium text-slate-800">can I reconstruct an image using pure math?</span>
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.12 }}
        >
          Naturally, I chose my professor.
        </motion.p>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="font-mono text-sm text-cyan-800/90"
        >
          (The curve is mathematically honest. The ethics are… debatable.)
        </motion.p>
      </div>
    </section>
  );
}
