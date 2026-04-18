"use client";

import { reloadDefaultPortrait } from "@/lib/defaultPortrait";
import { useEffect, useState } from "react";

/**
 * Loads `/default-portrait.png` once on mount (contour + DFT) so math matches the photo
 * before the rest of the pipeline UI mounts.
 */
export function PortraitGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reloadDefaultPortrait();
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load default portrait.");
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-[min(60vh,520px)] flex-col items-center justify-center gap-3 bg-stone-50 px-4 py-20 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-600 border-t-transparent" aria-hidden />
        <p className="text-sm text-slate-600">Loading default portrait and tracing contours…</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <p className="mx-auto max-w-prose px-4 py-3 text-center font-mono text-xs leading-relaxed text-amber-900">
          {error} — showing built-in demo curve until you upload.
        </p>
      )}
      {children}
    </>
  );
}
