"use client";

import { Button } from "@/components/ui/button";
import { fetchPortraitPipeline } from "@/lib/fetchPortraitPipeline";
import { useBrianStore } from "@/lib/store";
import { useState } from "react";

export function Controls() {
  const maxTerms = useBrianStore((s) => s.maxTerms);
  const setMaxTerms = useBrianStore((s) => s.setMaxTerms);
  const featureRegions = useBrianStore((s) => s.featureRegions);
  const setFeatureRegions = useBrianStore((s) => s.setFeatureRegions);
  const speed = useBrianStore((s) => s.speed);
  const setSpeed = useBrianStore((s) => s.setSpeed);
  const edgeThreshold = useBrianStore((s) => s.edgeThreshold);
  const setEdgeThreshold = useBrianStore((s) => s.setEdgeThreshold);
  const showCircles = useBrianStore((s) => s.showCircles);
  const setShowCircles = useBrianStore((s) => s.setShowCircles);
  const showPath = useBrianStore((s) => s.showPath);
  const setShowPath = useBrianStore((s) => s.setShowPath);
  const showVectors = useBrianStore((s) => s.showVectors);
  const setShowVectors = useBrianStore((s) => s.setShowVectors);
  const lineWidth = useBrianStore((s) => s.lineWidth);
  const setLineWidth = useBrianStore((s) => s.setLineWidth);
  const setSourcePath = useBrianStore((s) => s.setSourcePath);
  const setOriginalImageSrc = useBrianStore((s) => s.setOriginalImageSrc);
  const resetDemo = useBrianStore((s) => s.resetDemo);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <aside className="space-y-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-slate-500">Terms (N)</label>
        <input
          type="range"
          min={8}
          max={320}
          value={maxTerms}
          onChange={(e) => setMaxTerms(+e.target.value)}
          className="mt-2 w-full accent-cyan-600"
        />
        <div className="mt-1 font-mono text-sm text-cyan-800">{maxTerms}</div>
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-slate-500">Feature regions</label>
        <input
          type="range"
          min={1}
          max={12}
          step={1}
          value={featureRegions}
          onChange={(e) => setFeatureRegions(+e.target.value)}
          className="mt-2 w-full accent-teal-600"
        />
        <p className="mt-1 text-[11px] leading-snug text-slate-600">
          1 = one global Fourier path. Higher = split the closed path at the largest gaps, each region gets its own
          centroid and epicycle stack (different hues on the canvas).
        </p>
        <div className="mt-1 font-mono text-sm text-teal-800">{featureRegions}</div>
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-slate-500">Speed</label>
        <input
          type="range"
          min={0.2}
          max={3}
          step={0.1}
          value={speed}
          onChange={(e) => setSpeed(+e.target.value)}
          className="mt-2 w-full accent-violet-600"
        />
        <div className="mt-1 font-mono text-sm text-violet-800">{speed.toFixed(1)}×</div>
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-slate-500">Line thickness</label>
        <input
          type="range"
          min={1}
          max={6}
          step={0.5}
          value={lineWidth}
          onChange={(e) => setLineWidth(+e.target.value)}
          className="mt-2 w-full accent-fuchsia-600"
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label className="text-xs font-medium uppercase tracking-wider text-slate-500">Edge threshold</label>
          <span className="font-mono text-xs text-slate-500">{edgeThreshold}</span>
        </div>
        <input
          type="range"
          min={20}
          max={255}
          value={edgeThreshold}
          onChange={(e) => setEdgeThreshold(+e.target.value)}
          className="mt-2 w-full accent-emerald-600"
        />
        <p className="mt-1 text-[11px] leading-snug text-slate-600">
          Mapped into OpenCV Canny high/low (20–255 → stricter edges when higher). Applies on the next upload to the
          Python portrait bundle (mask, DFT path, neon).
        </p>
      </div>
      <div className="space-y-3 text-sm text-slate-700">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showCircles} onChange={(e) => setShowCircles(e.target.checked)} />
          Show circles
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showPath} onChange={(e) => setShowPath(e.target.checked)} />
          Show path
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showVectors} onChange={(e) => setShowVectors(e.target.checked)} />
          Show vectors
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <input
          type="file"
          accept="image/*"
          className="text-xs text-slate-600 file:mr-2 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-slate-800"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            setMsg(null);
            let objectUrl: string | null = null;
            try {
              objectUrl = URL.createObjectURL(f);
              setOriginalImageSrc(objectUrl);
              const bundle = await fetchPortraitPipeline(f, {
                edgeThreshold,
                maxSide: 420,
                samplePoints: 512,
              });
              if (!bundle) {
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                setOriginalImageSrc(null);
                setMsg("Portrait pipeline failed (install Python deps: pip install -r requirements.txt, then restart dev).");
                return;
              }
              const { path, fftOrigin, width, height, edgeMaskDataUrl, lineArtDataUrl, pathSource } = bundle;
              setSourcePath(path, {
                fftOrigin,
                imageSize: { w: width, h: height },
                lineArtDataUrl,
                edgeMaskDataUrl,
              });
              setMsg(
                pathSource === "chainedCanny"
                  ? "Fourier sketch: all Canny edge chains stitched (eyes, nose, mouth, hair, outline), then DFT + epicycle."
                  : pathSource === "photoCanny"
                    ? "Fourier sketch: chained Canny failed; using merged-blob photo Canny fallback. Try edge threshold."
                    : "Portrait bundle loaded.",
              );
            } catch {
              if (objectUrl) URL.revokeObjectURL(objectUrl);
              setOriginalImageSrc(null);
              setMsg("Could not read that image.");
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
        <Button variant="ghost" size="sm" type="button" onClick={() => resetDemo()}>
          Reset to default portrait
        </Button>
        {msg && <p className="font-mono text-xs text-cyan-800">{msg}</p>}
      </div>
    </aside>
  );
}
