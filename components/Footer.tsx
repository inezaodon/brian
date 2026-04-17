"use client";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black/40 py-12 text-center">
      <p className="font-heading text-lg text-zinc-300">Brian</p>
      <p className="mt-2 text-sm text-zinc-500">Built with math, curiosity, and a bit of chaos.</p>
      <a
        href="https://github.com/inezaodon/brian"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block font-mono text-sm text-cyan-400/90 underline-offset-4 hover:text-cyan-300 hover:underline"
      >
        GitHub
      </a>
      <p className="mt-6 text-xs text-zinc-600">Legacy static build lives in <code className="text-zinc-500">/legacy</code>.</p>
    </footer>
  );
}
