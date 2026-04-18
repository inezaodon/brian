"use client";

import { Button } from "@/components/ui/button";
import { buildDesmosExportText, buildPlainTextExportText, copyToClipboard } from "@/lib/desmosExport";
import { useBrianStore } from "@/lib/store";
import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function ExportSection() {
  const model = useBrianStore((s) => s.model);
  const maxTerms = useBrianStore((s) => s.maxTerms);
  const lastImageSize = useBrianStore((s) => s.lastImageSize);

  const desmosRef = useRef<HTMLTextAreaElement>(null);
  const plainRef = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState<string>("");

  const commented = useMemo(() => {
    if (!model) return "// No model — upload a portrait or use the demo path.\n";
    return buildDesmosExportText(model, maxTerms, {
      imageWidth: lastImageSize?.w,
      imageHeight: lastImageSize?.h,
    });
  }, [model, maxTerms, lastImageSize]);

  const plain = useMemo(() => {
    if (!model) return "No model - upload a portrait or use the demo path.";
    return buildPlainTextExportText(model, maxTerms);
  }, [model, maxTerms]);

  useEffect(() => {
    if (desmosRef.current) desmosRef.current.value = commented;
    if (plainRef.current) plainRef.current.value = plain;
  }, [commented, plain]);

  const refresh = useCallback(() => {
    if (desmosRef.current) desmosRef.current.value = commented;
    if (plainRef.current) plainRef.current.value = plain;
    setStatus("Export text refreshed from current terms / model.");
  }, [commented, plain]);

  const copyDesmos = async () => {
    const t = desmosRef.current?.value ?? commented;
    const r = await copyToClipboard(t, desmosRef.current);
    setStatus(r === "ok" ? "Copied Desmos text to clipboard." : "Clipboard blocked — commented text selected; copy manually.");
  };

  const copyPlain = async () => {
    const t = plainRef.current?.value ?? plain;
    const r = await copyToClipboard(t, plainRef.current);
    setStatus(r === "ok" ? "Copied plain text to clipboard." : "Clipboard blocked — plain text selected; copy manually.");
  };

  return (
    <section id="export" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="text-center"
      >
        <p className="font-mono text-xs uppercase tracking-[0.28em] text-cyan-800/80">Export</p>
        <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 sm:text-4xl">Copy Fourier equations</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600">
          These are the sparse DFT terms as Desmos paste: amplitudes, frequencies, and phases inside{" "}
          <span className="font-mono text-slate-800">X_1(t)</span> and <span className="font-mono text-slate-800">Y_1(t)</span>{" "}
          (not raw <span className="font-mono text-slate-800">(x,y)</span> samples). The portrait pipeline only sends the
          sampled path over the wire; the browser runs the FFT and builds this export.
        </p>
      </motion.div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_320px]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="font-heading text-lg font-semibold text-slate-900">Desmos-ready · commented</h3>
              <p className="text-xs text-slate-500">cx, cy match the FFT origin in the store (image center on upload).</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={copyDesmos}>
                Copy Desmos equations
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={refresh}>
                Refresh export text
              </Button>
            </div>
          </div>
          <textarea
            ref={desmosRef}
            readOnly
            spellCheck={false}
            rows={14}
            defaultValue={commented}
            className="mt-4 w-full resize-y rounded-xl border border-stone-200 bg-stone-50/80 p-4 font-mono text-xs leading-relaxed text-slate-800 focus:border-cyan-400 focus:outline-none"
            placeholder="Process an image or use the demo to generate copy-paste parametric equations…"
          />
        </motion.div>

        <motion.aside
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-col rounded-2xl border border-stone-200 bg-stone-50/90 p-5 shadow-sm"
        >
          <div className="border-b border-stone-200 pb-3">
            <h3 className="font-heading text-lg font-semibold text-slate-900">Plain text</h3>
            <p className="mt-1 text-xs leading-snug text-slate-600">
              <span className="font-mono text-cyan-900">test_coords:</span> long sums split into{" "}
              <span className="font-mono text-slate-800">X_1a, X_1b, …</span> (≤40 terms each), then{" "}
              <span className="font-mono text-slate-800">X_1</span> / <span className="font-mono text-slate-800">Y_1</span>{" "}
              sums; or list <span className="font-mono text-slate-800">A,F,P</span> +{" "}
              <span className="font-mono text-slate-800">sum</span> if &gt;120 terms. Last line is the numeric-origin
              parametric tuple. Set <span className="font-mono text-slate-800">0 ≤ t ≤ 2π</span> on that row in Desmos.
            </p>
          </div>
          <textarea
            ref={plainRef}
            readOnly
            spellCheck={false}
            rows={12}
            defaultValue={plain}
            className="mt-4 min-h-[200px] w-full flex-1 resize-y rounded-xl border border-stone-200 bg-white p-4 font-mono text-xs leading-relaxed text-slate-800 focus:border-cyan-400 focus:outline-none"
            placeholder="Plain-text equations appear here…"
          />
          <Button type="button" className="mt-4 w-full" size="sm" onClick={copyPlain}>
            Copy plain text
          </Button>
        </motion.aside>
      </div>

      {status && (
        <p className="mt-6 text-center font-mono text-xs text-cyan-900" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
