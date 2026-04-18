"use client";

import { epicyclePosition } from "@/lib/fourier";
import { useBrianStore } from "@/lib/store";
import { Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function Ribbon() {
  const model = useBrianStore((s) => s.model);
  const maxTerms = useBrianStore((s) => s.maxTerms);
  const group = useRef<THREE.Group>(null);

  const points = useMemo(() => {
    if (!model) return [] as THREE.Vector3[];
    const n = 420;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const p = epicyclePosition(model, t, maxTerms);
      pts.push(
        new THREE.Vector3(p.x * 0.045, -p.y * 0.045, Math.sin(i * 0.055) * 1.15),
      );
    }
    return pts;
  }, [model, maxTerms]);

  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.elapsedTime * 0.14;
  });

  if (!model || points.length === 0) return null;

  return (
    <group ref={group}>
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
          The identical Fourier trace, extruded with a sine wave in Z and orbiting slowly — math as sculpture. Scroll
          or pinch <span className="font-medium text-slate-800">over the canvas</span> to zoom; drag to orbit. If the
          viewer is clipped on a short screen, <span className="font-medium text-slate-800">scroll this panel</span>{" "}
          vertically to see it all (wheel stays inside the panel while the pointer is here).
        </p>
      </div>
      <div
        data-lenis-prevent
        className="mt-8 max-h-[min(88dvh,720px)] w-full cursor-grab overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-2xl border border-stone-200 bg-slate-100 shadow-md shadow-slate-300/40 touch-manipulation scroll-smooth active:cursor-grabbing"
      >
        <div className="h-[min(70vh,560px)] min-h-[280px] w-full min-w-0">
        <Canvas
          className="block h-full w-full touch-manipulation"
          camera={{ position: [0, 0, 9], fov: 45 }}
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={["#e8eef7"]} />
          <ambientLight intensity={0.55} />
          <pointLight position={[10, 10, 10]} intensity={0.65} color="#38bdf8" />
          <Ribbon />
          <OrbitControls
            enableDamping
            dampingFactor={0.06}
            enableZoom
            zoomSpeed={0.85}
            minDistance={4.5}
            maxDistance={26}
            enablePan
            screenSpacePanning
          />
        </Canvas>
        </div>
      </div>
    </section>
  );
}
