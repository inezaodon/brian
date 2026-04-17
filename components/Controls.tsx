"use client";

import { Button } from "@/components/ui/button";
import { imageFileToClosedPath } from "@/lib/imageToPath";
import { useBrianStore } from "@/lib/store";
import { useState } from "react";

export function Controls() {
  const maxTerms = useBrianStore((s) => s.maxTerms);
  const setMaxTerms = useBrianStore((s) => s.setMaxTerms);
  const speed = useBrianStore((s) => s.speed);
  const setSpeed = useBrianStore((s) => s.setSpeed);
  const showCircles = useBrianStore((s) => s.showCircles);
  const setShowCircles = useBrianStore((s) => s.setShowCircles);
  const showPath = useBrianStore((s) => s.showPath);
  const setShowPath = useBrianStore((s) => s.setShowPath);
  const showVectors = useBrianStore((s) => s.showVectors);
  const setShowVectors = useBrianStore((s) => s.setShowVectors);
  const lineWidth = useBrianStore((s) => s.lineWidth);
  const setLineWidth = useBrianStore((s) => s.setLineWidth);
  const setSourcePath = useBrianStore((s) => s.setSourcePath);
  const resetDemo = useBrianStore((s) => s.resetDemo);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <aside className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Terms (N)</label>
        <input
          type="range"
          min={8}
          max={320}
          value={maxTerms}
          onChange={(e) => setMaxTerms(+e.target.value)}
          className="mt-2 w-full accent-cyan-400"
        />
        <div className="mt-1 font-mono text-sm text-cyan-200">{maxTerms}</div>
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Speed</label>
        <input
          type="range"
          min={0.2}
          max={3}
          step={0.1}
          value={speed}
          onChange={(e) => setSpeed(+e.target.value)}
          className="mt-2 w-full accent-violet-400"
        />
        <div className="mt-1 font-mono text-sm text-violet-200">{speed.toFixed(1)}×</div>
      </div>
      <div>
        <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">Line thickness</label>
        <input
          type="range"
          min={1}
          max={6}
          step={0.5}
          value={lineWidth}
          onChange={(e) => setLineWidth(+e.target.value)}
          className="mt-2 w-full accent-fuchsia-400"
        />
      </div>
      <div className="space-y-3 text-sm text-zinc-300">
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
          className="text-xs text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-zinc-200"
          disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            setMsg(null);
            try {
              const path = await imageFileToClosedPath(f);
              setSourcePath(path);
              setMsg("New path loaded from edges.");
            } catch {
              setMsg("Could not read that image.");
            } finally {
              setBusy(false);
              e.target.value = "";
            }
          }}
        />
        <Button variant="ghost" size="sm" type="button" onClick={() => resetDemo()}>
          Reset professor demo
        </Button>
        {msg && <p className="font-mono text-xs text-cyan-300/90">{msg}</p>}
      </div>
    </aside>
  );
}
