"use client";

import { FourierVisualizer } from "@/components/FourierVisualizer";
import { epicyclePosition } from "@/lib/fourier";
import { useBrianStore } from "@/lib/store";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { useId, useMemo, useState } from "react";

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

function FourierTraceSvg({ className }: { className?: string }) {
  const gradId = useId().replace(/:/g, "");
  const model = useBrianStore((s) => s.model);
  const maxTerms = useBrianStore((s) => s.maxTerms);
  const d = useMemo(() => {
    if (!model) return "";
    const pts: string[] = [];
    for (let i = 0; i <= 140; i++) {
      const t = (i / 140) * Math.PI * 2;
      const p = epicyclePosition(model, t, maxTerms);
      const x = 50 + p.x * 0.17;
      const y = 50 + p.y * 0.17;
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ") + " Z";
  }, [model, maxTerms]);
  if (!d) return <div className={className} />;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path d={d} fill="none" stroke={`url(#${gradId})`} strokeWidth="0.65" />
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0891b2" />
          <stop offset="50%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#db2777" />
        </linearGradient>
      </defs>
    </svg>
  );
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
            <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-cyan-50 via-violet-50 to-fuchsia-50">
              <div
                className="pointer-events-none absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 20% 30%, rgba(6,182,212,0.35) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(139,92,246,0.3) 0%, transparent 40%)",
                }}
              />
              <FourierTraceSvg className="relative z-[1] h-48 w-full max-w-sm opacity-90" />
              <p className="relative z-[1] mt-2 px-4 text-center text-[11px] text-slate-600">
                Stylized preview — full neon Sobel pass runs on upload in the worker-style pipeline.
              </p>
            </div>
          )}
          {key === "image" && (
            <div className="relative flex h-full w-full flex-col items-stretch justify-center overflow-hidden rounded-xl border border-dashed border-stone-300 bg-stone-100/80">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.7)_0%,transparent_40%)]" />
              <svg viewBox="0 0 100 100" className="relative z-[1] mx-auto h-52 w-full max-w-sm" aria-hidden>
                <rect x="4" y="4" width="92" height="92" rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.4" />
                {sourceD && (
                  <path
                    d={sourceD}
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="0.45"
                    strokeOpacity="0.85"
                    className="translate-x-0"
                  />
                )}
              </svg>
              <p className="relative z-[1] mt-1 px-4 pb-2 text-center text-[11px] text-slate-600">
                Image stack placeholder — path overlay mirrors the current store curve (demo silhouette until you upload).
              </p>
            </div>
          )}
        </DeckCard>
      ))}
    </div>
  );
}
