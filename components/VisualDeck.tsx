"use client";

import { FourierVisualizer } from "@/components/FourierVisualizer";
import { useBrianStore } from "@/lib/store";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
import { useMemo, useState } from "react";

export type DeckKey = "sketch" | "contour" | "line" | "image";

const META: Record<DeckKey, { title: string; subtle: string }> = {
  sketch: { title: "Sketch", subtle: "Epicycle trace (Fourier sum)" },
  contour: { title: "Contour", subtle: "OpenCV edge mask + DFT loop (same tracing as FFT)" },
  line: { title: "Line art", subtle: "OpenCV neon (same portrait bundle as contour)" },
  image: { title: "Image", subtle: "Scaled input + DFT path in image coordinates" },
};

/** Path in raster pixel coordinates (matches `lastImageSize` / edge mask). */
function pathToSvgPixelD(path: { x: number; y: number }[], close: boolean) {
  if (!path.length) return "";
  const pts = path.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`);
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
      <div className="relative flex min-h-[280px] flex-1 items-center justify-center overflow-y-auto p-3 sm:min-h-[300px]">
        {children}
      </div>
    </motion.article>
  );
}

export function VisualDeck() {
  const [order, setOrder] = useState<DeckKey[]>(["sketch", "contour", "line", "image"]);
  const sourcePath = useBrianStore((s) => s.sourcePath);
  const originalImageSrc = useBrianStore((s) => s.originalImageSrc);
  const lineArtDataUrl = useBrianStore((s) => s.lineArtDataUrl);
  const edgeMaskDataUrl = useBrianStore((s) => s.edgeMaskDataUrl);
  const lastImageSize = useBrianStore((s) => s.lastImageSize);

  const pathPixelD = useMemo(() => pathToSvgPixelD(sourcePath, true), [sourcePath]);
  const procW = lastImageSize?.w ?? 0;
  const procH = lastImageSize?.h ?? 0;
  const hasProcSize = procW > 0 && procH > 0;

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
              {edgeMaskDataUrl && hasProcSize ? (
                <div
                  className="relative w-full max-w-sm overflow-hidden rounded-lg border border-emerald-200/90 bg-emerald-950 shadow-inner"
                  style={{ aspectRatio: `${procW} / ${procH}` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={edgeMaskDataUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                  {pathPixelD ? (
                    <svg
                      viewBox={`0 0 ${procW} ${procH}`}
                      className="pointer-events-none absolute inset-0 h-full w-full text-cyan-300"
                      preserveAspectRatio="xMidYMid meet"
                      aria-hidden
                    >
                      <path
                        d={pathPixelD}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={Math.max(1.2, Math.min(procW, procH) * 0.006)}
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  ) : null}
                </div>
              ) : (
                <svg viewBox="0 0 100 100" className="h-52 w-full max-w-sm text-emerald-700/85" aria-hidden>
                  <rect x="0" y="0" width="100" height="100" fill="#ecfdf5" />
                  <path
                    d="M30 50 L70 50 M50 30 L50 70"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="0.35"
                    strokeDasharray="2 2"
                  />
                </svg>
              )}
              <p className="mt-2 px-4 text-center text-[11px] text-slate-600">
                White pixels: OpenCV Canny edges (after the same Gaussian blur as neon). Cyan: largest outer contour,
                arc-length resampled — this polyline is exactly what the DFT consumes.
              </p>
            </div>
          )}
          {key === "line" && (
            <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-xl bg-slate-900">
              {lineArtDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lineArtDataUrl}
                  alt="OpenCV neon line art"
                  className="h-full max-h-56 w-full max-w-sm object-contain"
                />
              ) : (
                <div className="flex h-48 w-full items-center justify-center bg-slate-800 text-xs text-slate-400">
                  Line art loads when OpenCV `/api/portrait_pipeline` succeeds…
                </div>
              )}
              <p className="absolute bottom-2 left-2 right-2 text-center text-[11px] text-slate-300">
                Same Python bundle as contour: blur → Canny → findContours → glow / HSV boost. Neon may show several
                simplified contours; the DFT uses one largest outer loop on the Canny mask.
              </p>
            </div>
          )}
          {key === "image" && (
            <div className="relative flex h-full w-full flex-col items-stretch justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-900/5">
              {originalImageSrc ? (
                <div
                  className="relative mx-auto w-full max-w-sm"
                  style={hasProcSize ? { aspectRatio: `${procW} / ${procH}` } : { minHeight: "12rem" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={originalImageSrc}
                    alt="Input image scaled for processing"
                    className="absolute inset-0 h-full w-full rounded-lg object-contain"
                  />
                  {pathPixelD && hasProcSize ? (
                    <svg
                      viewBox={`0 0 ${procW} ${procH}`}
                      className="pointer-events-none absolute inset-0 h-full w-full"
                      preserveAspectRatio="xMidYMid meet"
                      aria-hidden
                    >
                      <path
                        d={pathPixelD}
                        fill="none"
                        stroke="rgba(34,211,238,0.9)"
                        strokeWidth={Math.max(1.2, Math.min(procW, procH) * 0.006)}
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  ) : null}
                </div>
              ) : (
                <p className="p-6 text-center text-xs text-slate-500">Original image appears after the portrait loads…</p>
              )}
              <p className="mt-2 px-4 pb-2 text-center text-[11px] text-slate-600">
                Raster at processing aspect ratio; cyan overlay is the same resampled loop passed to the FFT.
              </p>
            </div>
          )}
        </DeckCard>
      ))}
    </div>
  );
}
