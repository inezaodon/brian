import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { LenisRoot } from "@/components/LenisRoot";

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fourier portrait paths & epicycle studio",
  description:
    "Extract a closed edge loop from a portrait, approximate it with a sparse discrete Fourier transform in the browser, and visualize or export the epicycle sum.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${space.variable} ${inter.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <LenisRoot>{children}</LenisRoot>
      </body>
    </html>
  );
}
