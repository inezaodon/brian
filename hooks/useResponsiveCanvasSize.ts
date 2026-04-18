"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Observes a wrapper width and returns canvas dimensions capped at maxWidth,
 * preserving aspect ratio (width / height).
 */
export function useResponsiveCanvasSize(opts: {
  maxWidth: number;
  aspect: number;
  minWidth?: number;
  minHeight?: number;
}) {
  const { maxWidth, aspect, minWidth = 260, minHeight = 160 } = opts;
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({
    w: maxWidth,
    h: Math.max(minHeight, Math.round(maxWidth / aspect)),
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const cw = el.clientWidth;
      const w = Math.floor(Math.min(maxWidth, Math.max(minWidth, cw)));
      const h = Math.max(minHeight, Math.round(w / aspect));
      setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxWidth, aspect, minWidth, minHeight]);

  return { ref, width: size.w, height: size.h };
}
