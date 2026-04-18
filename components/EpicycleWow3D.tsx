"use client";

import { epicyclePosition } from "@/lib/fourier";
import { useSketchStore } from "@/lib/store";
import { Line, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";

function Ribbon() {
  const model = useSketchStore((s) => s.model);
  const maxTerms = useSketchStore((s) => s.maxTerms);

  const points = useMemo(() => {
    if (!model) return [] as THREE.Vector3[];
    const n = 420;
    const raw: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const p = epicyclePosition(model, t, maxTerms);
      raw.push(
        new THREE.Vector3(p.x * 0.045, -p.y * 0.045, Math.sin(i * 0.055) * 1.15),
      );
    }
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const v of raw) {
      minX = Math.min(minX, v.x);
      maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z);
      maxZ = Math.max(maxZ, v.z);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    return raw.map((v) => new THREE.Vector3(v.x - cx, v.y - cy, v.z - cz));
  }, [model, maxTerms]);

  if (!model || points.length === 0) return null;

  return (
    <group>
      <Line points={points} color="#0e7490" lineWidth={1.8} transparent opacity={0.92} />
    </group>
  );
}

export function EpicycleWow3D() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-24">
      <div className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-800/80">Wow feature</p>
        <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900 sm:text-4xl">3D ribbon of the same curve</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">
          The same Fourier trace in 3D: XY follow the sketch, Z wiggles with arc length, and the ribbon is centered in
          the scene. <span className="font-medium text-slate-800">Drag</span> to rotate the view, scroll or pinch to
          zoom (wheel does not scroll the page while the pointer is here).
        </p>
      </div>
      <div
        data-lenis-prevent
        className="mt-8 h-[min(72vh,620px)] min-h-[300px] w-full cursor-grab overflow-hidden rounded-2xl border border-stone-200 bg-slate-100 shadow-md shadow-slate-300/40 touch-manipulation active:cursor-grabbing"
      >
        <Canvas
          className="h-full min-h-[280px] w-full touch-manipulation"
          style={{ height: "100%", width: "100%" }}
          camera={{ position: [0, 2, 11], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={["#e8eef7"]} />
          <ambientLight intensity={0.55} />
          <pointLight position={[10, 10, 10]} intensity={0.65} color="#38bdf8" />
          <Ribbon />
          <OrbitControls
            makeDefault
            target={[0, 0, 0]}
            enableDamping
            dampingFactor={0.06}
            enableZoom
            zoomSpeed={0.85}
            minDistance={5}
            maxDistance={28}
            enablePan
            screenSpacePanning
          />
        </Canvas>
      </div>
    </section>
  );
}
