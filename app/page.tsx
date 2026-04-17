"use client";

import { CompareSection } from "@/components/CompareSection";
import dynamic from "next/dynamic";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { HumorAsides } from "@/components/HumorAsides";
import { MathCore } from "@/components/MathCore";
import { Playground } from "@/components/Playground";
import { Steps } from "@/components/Steps";
import { Story } from "@/components/Story";

const EpicycleWowDynamic = dynamic(
  () => import("@/components/EpicycleWow3D").then((m) => m.EpicycleWow3D),
  { ssr: false, loading: () => <div className="h-[min(70vh,560px)] w-full animate-pulse rounded-2xl bg-zinc-900/80" /> },
);

export default function Home() {
  return (
    <main className="relative">
      <Hero />
      <Story />
      <Steps />
      <MathCore />
      <Playground />
      <CompareSection />
      <EpicycleWowDynamic />
      <HumorAsides />
      <Footer />
    </main>
  );
}
