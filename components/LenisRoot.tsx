"use client";

import Lenis from "lenis";
import "lenis/dist/lenis.css";
import { useEffect } from "react";

export function LenisRoot({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("lenis");
    const lenis = new Lenis({
      smoothWheel: true,
      lerp: 0.12,
      autoRaf: true,
    });
    return () => {
      root.classList.remove("lenis");
      lenis.destroy();
    };
  }, []);
  return <>{children}</>;
}
