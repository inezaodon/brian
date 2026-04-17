"use client";

export function Footer() {
  return (
    <footer className="border-t border-stone-200 bg-white/80 py-12 text-center backdrop-blur-sm">
      <p className="font-heading text-lg text-slate-800">Brian</p>
      <p className="mt-2 text-sm text-slate-600">Built with math, curiosity, and a bit of chaos.</p>
      <a
        href="https://github.com/inezaodon/brian"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block font-mono text-sm text-cyan-800 underline-offset-4 hover:text-cyan-950 hover:underline"
      >
        GitHub
      </a>
      <p className="mt-6 text-xs text-slate-500">
        Legacy static build lives in <code className="text-slate-600">/legacy</code>.
      </p>
    </footer>
  );
}
