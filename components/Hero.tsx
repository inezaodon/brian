"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 pb-16 pt-24"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_50%_-20%,rgba(125,211,252,0.35),transparent_55%),radial-gradient(ellipse_70%_60%_at_100%_0%,rgba(196,181,253,0.25),transparent_50%),radial-gradient(ellipse_60%_50%_at_0%_100%,rgba(251,207,232,0.2),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] [background-size:48px_48px]"
        aria-hidden
      />

      <div className="relative z-10 flex max-w-2xl flex-col items-center text-center sm:max-w-3xl">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-3 font-mono text-xs uppercase tracking-[0.28em] text-cyan-800/80"
        >
          Fourier curves from images
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.02, duration: 0.55 }}
          className="font-heading text-3xl font-bold leading-[1.12] tracking-tight text-slate-900 sm:text-5xl md:text-[2.75rem]"
        >
          Epicycles that trace a portrait edge loop
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="mt-6 max-w-2xl space-y-4 text-left text-base leading-relaxed text-slate-600 sm:text-center sm:text-lg"
        >
          <p>
            <span className="font-medium text-slate-800">What this does.</span> Upload a portrait (or load the bundled
            example). A Python/OpenCV service finds edge contours, stitches them into one closed polyline, and returns
            evenly spaced samples. In your browser, those samples become complex numbers; a radix-2 FFT yields Fourier
            coefficients. The live view sums rotating vectors—epicycles—so their tip redraws the same path you can
            also export as equations.
          </p>
          <p>
            <span className="font-medium text-slate-800">Why Fourier.</span> Any reasonable closed curve can be
            expressed as a sum of harmonics: each term is a small circle turning at an integer multiple of the base
            rate. Low frequencies capture coarse shape; high frequencies follow detail. This app keeps the strongest
            bins (sparse spectrum), orders them by frequency, and animates the same sum the canvas and 3D ribbon use.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.38 }}
          className="mt-10"
        >
          <Button
            size="lg"
            onClick={() => document.getElementById("experiment")?.scrollIntoView({ behavior: "smooth" })}
          >
            Open interactive demo
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
