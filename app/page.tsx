"use client";

import { CompareSection } from "@/components/CompareSection";
import { ExportSection } from "@/components/ExportSection";
import dynamic from "next/dynamic";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { HumorAsides } from "@/components/HumorAsides";
import { MathCore } from "@/components/MathCore";
import { Playground } from "@/components/Playground";
import { PortraitGate } from "@/components/PortraitGate";
import { Steps } from "@/components/Steps";
import { Story } from "@/components/Story";

const EpicycleWowDynamic = dynamic(
  () => import("@/components/EpicycleWow3D").then((m) => m.EpicycleWow3D),
  { ssr: false, loading: () => <div className="h-[min(70vh,560px)] w-full animate-pulse rounded-2xl bg-slate-200/90" /> },
);

export default function Home() {
  return (
    <main className="relative min-h-screen bg-[var(--color-background)] text-[var(--color-foreground)]">
      <Hero />
      <PortraitGate>
        <Story />
        <Steps />
        <MathCore />
        <Playground />
        <ExportSection />
        <CompareSection />
        <EpicycleWowDynamic />
        <HumorAsides />
        <Footer />
      </PortraitGate>
    </main>
  );
}
