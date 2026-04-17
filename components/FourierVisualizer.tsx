"use client";

import { epicyclePosition } from "@/lib/fourier";
import { useBrianStore } from "@/lib/store";
import { useEffect, useRef } from "react";

type Props = {
  className?: string;
  width: number;
  height: number;
};

export function FourierVisualizer({ className, width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const model = useBrianStore((s) => s.model);
  const maxTerms = useBrianStore((s) => s.maxTerms);
  const speed = useBrianStore((s) => s.speed);
  const showCircles = useBrianStore((s) => s.showCircles);
  const showPath = useBrianStore((s) => s.showPath);
  const showVectors = useBrianStore((s) => s.showVectors);
  const lineWidth = useBrianStore((s) => s.lineWidth);
  const scrub = useBrianStore((s) => s.scrub);
  const tRef = useRef(0);
  const traceRef = useRef<{ x: number; y: number }[]>([]);

  useEffect(() => {
    traceRef.current = [];
  }, [model, maxTerms]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !model) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    const c = ctx2d;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;
    const refN = Math.max(model.fftN, 64);

    function boundsForTerms(m: NonNullable<typeof model>, cap: number) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const samples = 240;
      for (let i = 0; i <= samples; i++) {
        const tt = (i / samples) * Math.PI * 2;
        const p = epicyclePosition(m, tt, cap);
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      return { minX, minY, maxX, maxY };
    }

    function frame() {
      const m = model;
      if (!m) return;
      const w = width;
      const h = height;
      c.fillStyle = "#06060a";
      c.fillRect(0, 0, w, h);

      const { minX, minY, maxX, maxY } = boundsForTerms(m, maxTerms);
      const pad = 28;
      const bw = maxX - minX || 1;
      const bh = maxY - minY || 1;
      const scale = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
      const ox = w / 2 - ((minX + maxX) / 2) * scale;
      const oy = h / 2 - ((minY + maxY) / 2) * scale;
      const map = (p: { x: number; y: number }) => ({
        x: ox + p.x * scale,
        y: oy + p.y * scale,
      });

      tRef.current += ((2 * Math.PI) / refN) * speed * 0.4;
      const t = tRef.current;
      const cap = maxTerms;

      if (showCircles || showVectors) {
        const C = map(m.centroid);
        let x = C.x;
        let y = C.y;
        for (let k = 0; k < cap; k++) {
          const ck = m.coeffsRe[k];
          const sk = m.coeffsIm[k];
          const freq = m.freqs[k];
          const r = Math.hypot(ck, sk) * scale;
          const angle = freq * t + Math.atan2(sk, ck);
          const nx = x + r * Math.cos(angle);
          const ny = y + r * Math.sin(angle);
          if (showCircles && r > 0.4) {
            c.strokeStyle = "rgba(148, 163, 184, 0.12)";
            c.lineWidth = 1;
            c.beginPath();
            c.arc(x, y, r, 0, Math.PI * 2);
            c.stroke();
          }
          if (showVectors) {
            c.strokeStyle = "rgba(34, 211, 238, 0.22)";
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(nx, ny);
            c.stroke();
          }
          x = nx;
          y = ny;
        }
      }

      if (showPath) {
        const p0 = epicyclePosition(m, t, cap);
        traceRef.current.unshift(map(p0));
        if (traceRef.current.length > 10000) traceRef.current.pop();
        const lim = Math.max(2, Math.floor(traceRef.current.length * scrub));
        c.beginPath();
        for (let i = 0; i < lim; i++) {
          const p = traceRef.current[i];
          if (!p) continue;
          if (i === 0) c.moveTo(p.x, p.y);
          else c.lineTo(p.x, p.y);
        }
        const g = c.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, "#22d3ee");
        g.addColorStop(0.45, "#a78bfa");
        g.addColorStop(1, "#f472b6");
        c.strokeStyle = g;
        c.lineWidth = lineWidth;
        c.lineJoin = "round";
        c.lineCap = "round";
        c.stroke();
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [model, maxTerms, speed, showCircles, showPath, showVectors, lineWidth, scrub, width, height]);

  if (!model) return <div className={className} style={{ width, height }} />;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width, height, touchAction: "none" }}
      aria-label="Fourier epicycle drawing"
    />
  );
}
