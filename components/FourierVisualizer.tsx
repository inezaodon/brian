"use client";

import { epicyclePosition, type FourierModel } from "@/lib/fourier";
import { useBrianStore } from "@/lib/store";
import { useEffect, useRef } from "react";

type Props = {
  className?: string;
  width: number;
  height: number;
  /** Light canvas matches the rest of the airy UI; dark is available for embeds. */
  theme?: "light" | "dark";
};

function boundsForTerms(m: FourierModel, cap: number) {
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

function unionBounds(models: FourierModel[], cap: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const m of models) {
    const b = boundsForTerms(m, cap);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }
  return { minX, minY, maxX, maxY };
}

export function FourierVisualizer({ className, width, height, theme = "light" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const model = useBrianStore((s) => s.model);
  const regionModels = useBrianStore((s) => s.regionModels);
  const featureRegions = useBrianStore((s) => s.featureRegions);
  const maxTerms = useBrianStore((s) => s.maxTerms);
  const speed = useBrianStore((s) => s.speed);
  const showCircles = useBrianStore((s) => s.showCircles);
  const showPath = useBrianStore((s) => s.showPath);
  const showVectors = useBrianStore((s) => s.showVectors);
  const lineWidth = useBrianStore((s) => s.lineWidth);
  const scrub = useBrianStore((s) => s.scrub);
  const tRef = useRef(0);
  const traceRefs = useRef<{ x: number; y: number }[][]>([]);

  const useMulti = featureRegions > 1 && regionModels.length > 0;
  const models = useMulti ? regionModels : model ? [model] : [];
  const modelsRef = useRef(models);
  modelsRef.current = models;

  useEffect(() => {
    traceRefs.current = modelsRef.current.map(() => []);
  }, [model, regionModels, featureRegions, maxTerms, regionModels.length]);

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

    function frame() {
      const ms = modelsRef.current;
      if (ms.length === 0) return;
      const refN = Math.max(...ms.map((m) => m.fftN), 64);
      const w = width;
      const h = height;
      c.fillStyle = theme === "light" ? "#f1f5f9" : "#06060a";
      c.fillRect(0, 0, w, h);

      const { minX, minY, maxX, maxY } = unionBounds(ms, maxTerms);
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

      while (traceRefs.current.length < ms.length) traceRefs.current.push([]);
      traceRefs.current.length = ms.length;

      if (showCircles || showVectors) {
        ms.forEach((m, ri) => {
          const hue = (ri * 53) % 360;
          const C = map(m.centroid);
          let x = C.x;
          let y = C.y;
          for (let k = 0; k < Math.min(cap, m.coeffsRe.length); k++) {
            const ck = m.coeffsRe[k];
            const sk = m.coeffsIm[k];
            const freq = m.freqs[k];
            const r = Math.hypot(ck, sk) * scale;
            const angle = freq * t + Math.atan2(sk, ck);
            const nx = x + r * Math.cos(angle);
            const ny = y + r * Math.sin(angle);
            if (showCircles && r > 0.4) {
              c.strokeStyle =
                theme === "light"
                  ? `hsla(${hue}, 35%, 55%, 0.14)`
                  : `hsla(${hue}, 40%, 70%, 0.1)`;
              c.lineWidth = 1;
              c.beginPath();
              c.arc(x, y, r, 0, Math.PI * 2);
              c.stroke();
            }
            if (showVectors) {
              c.strokeStyle =
                theme === "light"
                  ? `hsla(${hue}, 75%, 42%, 0.32)`
                  : `hsla(${hue}, 80%, 60%, 0.24)`;
              c.lineWidth = 1;
              c.beginPath();
              c.moveTo(x, y);
              c.lineTo(nx, ny);
              c.stroke();
            }
            x = nx;
            y = ny;
          }
        });
      }

      if (showPath) {
        ms.forEach((m, ri) => {
          const tr = traceRefs.current[ri];
          if (!tr) return;
          const p0 = epicyclePosition(m, t, cap);
          tr.unshift(map(p0));
          if (tr.length > 8000) tr.pop();
        });

        ms.forEach((m, ri) => {
          const tr = traceRefs.current[ri];
          if (!tr || tr.length < 2) return;
          const lim = Math.max(2, Math.floor(tr.length * scrub));
          const hue = (ri * 53) % 360;
          c.beginPath();
          for (let i = 0; i < lim; i++) {
            const p = tr[i];
            if (!p) continue;
            if (i === 0) c.moveTo(p.x, p.y);
            else c.lineTo(p.x, p.y);
          }
          c.strokeStyle =
            theme === "light"
              ? `hsl(${hue} 62% 38%)`
              : `hsl(${hue} 70% 62%)`;
          c.lineWidth = lineWidth;
          c.lineJoin = "round";
          c.lineCap = "round";
          c.stroke();
        });
      }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [
    model,
    regionModels,
    featureRegions,
    maxTerms,
    speed,
    showCircles,
    showPath,
    showVectors,
    lineWidth,
    scrub,
    width,
    height,
    theme,
  ]);

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
