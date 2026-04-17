#!/usr/bin/env python3
"""
Portrait → clean neon line-art (OpenCV + NumPy).

Pipeline lives in `cv_neon.pipeline` (also used by `export_portrait_bundle.py` / `api/portrait_pipeline.py`).

Usage:
  python scripts/portrait_neon_lineart.py --input photo.jpg --output neon.png
  python scripts/portrait_neon_lineart.py -i photo.jpg -o neon.png --sobel --glow-passes 4
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import cv2

from cv_neon.pipeline import run_pipeline


def main() -> int:
    p = argparse.ArgumentParser(description="Portrait → neon line art (OpenCV)")
    p.add_argument("-i", "--input", type=Path, required=True, help="Input image path")
    p.add_argument("-o", "--output", type=Path, required=True, help="Output PNG path")
    p.add_argument("--sobel", action="store_true", help="Use high-threshold Sobel instead of Canny")
    p.add_argument("--canny-low", type=int, default=48, help="Canny low threshold (strong edges)")
    p.add_argument("--canny-high", type=int, default=148, help="Canny high threshold")
    p.add_argument("--sobel-thresh", type=float, default=96.0, help="Sobel magnitude threshold (0–255 scale)")
    p.add_argument("--blur-ksize", type=int, default=7, help="Gaussian blur kernel size (odd)")
    p.add_argument("--blur-sigma", type=float, default=0, help="Gaussian sigma (0 = auto from ksize)")
    p.add_argument("--min-area", type=float, default=120.0, help="Drop contours smaller than this area (px²)")
    p.add_argument("--epsilon-ratio", type=float, default=0.002, help="approxPolyDP epsilon as fraction of perimeter")
    p.add_argument("--stroke", type=int, default=2, help="Contour stroke width (pixels)")
    p.add_argument("--glow-passes", type=int, default=3, help="Recursive Gaussian passes for bloom")
    p.add_argument("--glow-sigma0", type=float, default=2.2, help="Initial Gaussian sigma for glow")
    p.add_argument("--glow-sigma-growth", type=float, default=1.4, help="Sigma increment per glow pass")
    p.add_argument("--glow-mix", type=float, default=0.85, help="Weight of glow layer in composite")
    p.add_argument("--sharp-mix", type=float, default=1.0, help="Weight of sharp line layer")
    p.add_argument("--hsv-v-gain", type=float, default=1.12, help="Value boost on line regions")
    p.add_argument("--hsv-s-gain", type=float, default=1.35, help="Saturation boost on line regions")
    args = p.parse_args()

    if not args.input.is_file():
        print(f"Input not found: {args.input}", file=sys.stderr)
        return 1

    bgr = cv2.imread(str(args.input), cv2.IMREAD_COLOR)
    if bgr is None:
        print(f"Could not read image: {args.input}", file=sys.stderr)
        return 1

    out = run_pipeline(
        bgr,
        use_sobel=args.sobel,
        canny_low=args.canny_low,
        canny_high=args.canny_high,
        sobel_thresh=args.sobel_thresh,
        blur_ksize=args.blur_ksize,
        blur_sigma=args.blur_sigma,
        min_area=args.min_area,
        epsilon_ratio=args.epsilon_ratio,
        stroke=args.stroke,
        glow_passes=args.glow_passes,
        glow_sigma0=args.glow_sigma0,
        glow_sigma_growth=args.glow_sigma_growth,
        glow_mix=args.glow_mix,
        sharp_mix=args.sharp_mix,
        hsv_v_gain=args.hsv_v_gain,
        hsv_s_gain=args.hsv_s_gain,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    if not cv2.imwrite(str(args.output), out):
        print(f"Failed to write: {args.output}", file=sys.stderr)
        return 1
    print(f"Wrote {args.output} ({out.shape[1]}×{out.shape[0]})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
