"use client";

import { FourierVisualizer } from "@/components/FourierVisualizer";
import { useBrianStore } from "@/lib/store";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { useMemo, useState } from "react";

export type DeckKey = "sketch" | "contour" | "line" | "image";

const META: Record<DeckKey, { title: string; subtle: string }> = {
  sketch: { title: "Sketch", subtle: "Epicycle trace (Fourier sum)" },
  contour: { title: "Contour", subtle: "Binary mask used for FFT paths" },
  line: { title: "Line art", subtle: "Neon Sobel preview (shape-first)" },
  image: { title: "Image", subtle: "Scaled input · pipeline, then path overlay" },
};

function pathToSvgD(path: { x: number; y: number }[], close: boolean) {
  if (!path.length) return "";
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of path) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const bw = maxX - minX || 1;
  const bh = maxY - minY || 1;
  const s = 82 / Math.max(bw, bh);
  const pts: string[] = [];
  path.forEach((p, i) => {
    const x = 50 + (p.x - (minX + maxX) / 2) * s;
    const y = 50 + (p.y - (minY + maxY) / 2) * s;
    pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  });
  return pts.join(" ") + (close ? " Z" : "");
}

function DeckCard({
  deckKey,
  index,
  total,
  onMoveLeft,
  onMoveRight,
  children,
}: {
  deckKey: DeckKey;
  index: number;
  total: number;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  children: React.ReactNode;
}) {
  const meta = META[deckKey];
  const isNeon = deckKey === "line";
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-24px" }}
      className={`flex flex-col overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_12px_40px_-12px_rgba(15,23,42,0.08)] ${isNeon ? "ring-1 ring-cyan-200/40" : ""}`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-stone-100 bg-stone-50/80 px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-semibold tracking-tight text-slate-900">{meta.title}</h3>
          <p className="mt-0.5 text-xs leading-snug text-slate-500">{meta.subtle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-stone-200 bg-white p-0.5 shadow-sm">
          <button
            type="button"
            title="Move panel left"
            aria-label={`Move ${meta.title} left`}
            disabled={index === 0}
            onClick={onMoveLeft}
            className="rounded-md p-1.5 text-slate-500 hover:bg-stone-100 hover:text-slate-800 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-0.5 text-slate-300" aria-hidden>
            <GripVertical className="h-4 w-4" />
          </span>
          <button
            type="button"
            title="Move panel right"
            aria-label={`Move ${meta.title} right`}
            disabled={index >= total - 1}
            onClick={onMoveRight}
            className="rounded-md p-1.5 text-slate-500 hover:bg-stone-100 hover:text-slate-800 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-[280px] flex-1 items-center justify-center p-3 sm:min-h-[300px]">{children}</div>
    </motion.article>
  );
}

export function VisualDeck() {
  const [order, setOrder] = useState<DeckKey[]>(["sketch", "contour", "line", "image"]);
  const sourcePath = useBrianStore((s) => s.sourcePath);
  const originalImageSrc = useBrianStore((s) => s.originalImageSrc);
  const lineArtDataUrl = useBrianStore((s) => s.lineArtDataUrl);

  const sourceD = useMemo(() => pathToSvgD(sourcePath, true), [sourcePath]);

  function swap(key: DeckKey, dir: -1 | 1) {
    setOrder((o) => {
      const i = o.indexOf(key);
      const j = i + dir;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  return (
    <div className="mx-auto mt-12 grid max-w-6xl gap-6 sm:grid-cols-2">
      {order.map((key, index) => (
        <DeckCard
          key={key}
          deckKey={key}
          index={index}
          total={order.length}
          onMoveLeft={() => swap(key, -1)}
          onMoveRight={() => swap(key, 1)}
        >
          {key === "sketch" && (
            <div className="flex h-full w-full max-w-[420px] flex-col items-center justify-center">
              <FourierVisualizer width={380} height={260} theme="light" className="rounded-xl border border-stone-200" />
              <p className="mt-2 text-center text-[11px] text-slate-500">Live canvas — same state as the playground.</p>
            </div>
          )}
          {key === "contour" && (
            <div className="flex h-full w-full flex-col items-center justify-center bg-emerald-50/60">
              <svg viewBox="0 0 100 100" className="h-52 w-full max-w-sm text-emerald-700/85" aria-hidden>
                <rect x="0" y="0" width="100" height="100" fill="#ecfdf5" />
                {sourceD ? (
                  <path d={sourceD} fill="none" stroke="currentColor" strokeWidth="0.55" />
                ) : (
                  <path
                    d="M30 50 L70 50 M50 30 L50 70"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="0.35"
                    strokeDasharray="2 2"
                  />
                )}
              </svg>
              <p className="mt-2 px-4 text-center text-[11px] text-slate-600">
                Edge mask topology — largest 8-connected blob, greedy walk, then resample.
              </p>
            </div>
          )}
          {key === "line" && (
            <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-xl bg-slate-900">
              {lineArtDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lineArtDataUrl}
                  alt="Sobel magnitude as neon line art"
                  className="h-full max-h-56 w-full max-w-sm object-contain"
                />
              ) : (
                <div className="flex h-48 w-full items-center justify-center bg-slate-800 text-xs text-slate-400">
                  Line art preview loads with the portrait…
                </div>
              )}
              <p className="absolute bottom-2 left-2 right-2 text-center text-[11px] text-slate-300">
                Same neon Sobel preview recipe as the static worker (shape-forward, dilated strength).
              </p>
            </div>
          )}
          {key === "image" && (
            <div className="relative flex h-full w-full flex-col items-stretch justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-900/5">
              {originalImageSrc ? (
                <div className="relative mx-auto aspect-square w-full max-w-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={originalImageSrc}
                    alt="Input image scaled for processing"
                    className="h-full w-full rounded-lg object-contain"
                  />
                  <svg
                    viewBox="0 0 100 100"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                    preserveAspectRatio="xMidYMid meet"
                    aria-hidden
                  >
                    {sourceD && (
                      <path
                        d={sourceD}
                        fill="none"
                        stroke="rgba(34,211,238,0.85)"
                        strokeWidth="0.55"
                        vectorEffect="non-scaling-stroke"
                      />
                    )}
                  </svg>
                </div>
              ) : (
                <p className="p-6 text-center text-xs text-slate-500">Original image appears after the portrait loads…</p>
              )}
              <p className="mt-2 px-4 pb-2 text-center text-[11px] text-slate-600">
                Scaled raster + traced loop overlay (same path fed to the FFT).
              </p>
            </div>
          )}
        </DeckCard>
      ))}
    </div>
  );
}
