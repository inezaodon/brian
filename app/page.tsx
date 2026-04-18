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
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-6xl px-4 py-24">
        <div className="mx-auto mt-8 h-[min(72vh,620px)] min-h-[300px] w-full animate-pulse rounded-2xl bg-slate-200/90" />
      </div>
    ),
  },
);

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-[var(--color-background)] text-[var(--color-foreground)]">
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
