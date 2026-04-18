# Fourier portrait studio

Interactive **Next.js** experience: a student reconstructs a professor-shaped curve with **live Fourier epicycles** (sparse DFT, magnitude-sorted harmonics, canvas animation).

## Stack

- **Next.js 16** (App Router) · **TypeScript** · **Tailwind CSS v4**
- **Framer Motion** (scroll + hero motion)
- **React Three Fiber + Drei** (3D ribbon “wow” section, client-only dynamic import)
- **Canvas 2D** Fourier visualizer (`FourierVisualizer`)
- **Zustand** (`lib/store.ts`)
- **KaTeX** (math block)
- **Lenis** (smooth scroll)

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Legacy

The original static **single-file** studio (HTML + worker) is preserved under [`legacy/`](./legacy/) (not used by the Next app).

## Fonts

- **Space Grotesk** — headings  
- **Inter** — body  
- **JetBrains Mono** — math / asides  

## License

Private / educational — adjust as you like.
