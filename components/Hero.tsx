"use client";

import { FourierVisualizer } from "@/components/FourierVisualizer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export function Hero() {
  const [dims, setDims] = useState({ w: 720, h: 480 });

  useEffect(() => {
    function r() {
      setDims({
        w: Math.min(780, window.innerWidth - 32),
        h: Math.min(560, Math.floor(window.innerHeight * 0.52)),
      });
    }
    r();
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);

  return (
    <section className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(34,211,238,0.18),transparent_55%),radial-gradient(ellipse_60%_50%_at_100%_50%,rgba(167,139,250,0.12),transparent)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.55%22/%3E%3C/svg%3E')]" />

      <div className="absolute inset-0 flex items-center justify-center">
        <FourierVisualizer width={dims.w} height={dims.h} className="opacity-90" />
      </div>

      <div className="relative z-10 flex max-w-4xl flex-col items-center text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-3 font-mono text-xs uppercase tracking-[0.35em] text-cyan-300/80"
        >
          Brian — a Fourier series prank
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.6 }}
          className="font-heading text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl md:text-7xl"
        >
          I turned my professor into math.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.55 }}
          className="mt-5 max-w-xl text-lg text-zinc-400 sm:text-xl"
        >
          A Fourier series reconstruction of a real human — live epicycles, real DFT, zero permission slips.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45 }}
          className="mt-10"
        >
          <Button
            size="lg"
            onClick={() => document.getElementById("experiment")?.scrollIntoView({ behavior: "smooth" })}
          >
            Start the experiment
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
