# Fourier Epicycle Studio

Browser app that turns a **photo** into **sparse Fourier epicycle** motion: separate contour regions are traced, each path gets a complex FFT with magnitude-sorted terms, and you watch the sum of rotating circles redraw your subject. Includes **Desmos-friendly exports** (annotated and plain ASCII), a **Three.js** orbit view, and a **Web Worker** so the UI stays responsive.

## What you see

| Panel | What it is |
|--------|------------|
| **Sketch** | 2D canvas: epicycles + accumulated trace (Fourier reconstruction). |
| **Line art** | Neon Sobel preview on its own panel (reorder with other preview cards). |
| **Contour** | Binary edge mask used for FFT paths (green on warm paper background). |
| **Image** | Pipeline copy, then scaled photo and optional SVG trace overlay. |
| **3D contour depth** | Three.js: stacked `LineLoop`s in depth; drag to orbit, scroll to zoom, idle auto-rotate. |

## Run locally

Workers need **HTTP** (not `file://`):

```bash
cd /path/to/brian
python3 -m http.server 8765
```

Open **http://localhost:8765/**

## Controls (short)

- **Edge threshold** — higher → fewer, stronger edges (percentile on gradient magnitude).
- **Max sample points** — total samples shared across paths (arc-length resampling).
- **Terms** — cap on sparse harmonics per path (and optional per-path caps).
- **Re-run** — reprocess with current sliders.

## Export

- **Export (with notes)** — commented `X_{k}(t)`, `Y_{k}(t)` plus `cx` / `cy` hints for Desmos (y-up: negate `Y`).
- **Plain text** — ASCII-only `cx=…`, `cy=…`, `X_1(t)=…`, `Y_1(t)=…` for paste into Desmos.

## Stack

- **Vanilla HTML / CSS / JS** — `index.html`
- **Web Worker** — `fourier-worker.js` (Sobel, components, FFT, sparse terms)
- **Three.js** (module CDN) — `OrbitControls` for the 3D panel

## Repo

**GitHub:** [inezaodon/brian](https://github.com/inezaodon/brian)

**Suggested repository “About” description** (paste in GitHub → repo → ⚙ Settings → General):

> Browser Fourier epicycle studio: image to sparse FFT sketch, contour preview, Three.js depth view, Desmos export (plain + notes). Vanilla JS + worker.
