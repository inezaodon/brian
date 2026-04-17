#!/usr/bin/env python3
"""
Portrait → clean neon line-art (OpenCV + NumPy).

Pipeline (matches your spec):
  1. Grayscale + Gaussian blur (suppress fine noise / beard hairs).
  2. Strong structural edges: Canny (default) or high-threshold Sobel magnitude.
  3. findContours + approxPolyDP, drop tiny / noisy paths.
  4. Draw simplified contours on black with bright cyan strokes.
  5. Recursive Gaussian blur on the line layer for bloom, composite behind sharp lines;
     final HSV boost on line regions for “gas tube” punch.

Usage:
  python scripts/portrait_neon_lineart.py --input photo.jpg --output neon.png
  python scripts/portrait_neon_lineart.py -i photo.jpg -o neon.png --sobel --glow-passes 4
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np


CYAN_BGR = (255, 255, 0)  # B=cyan channel, G=cyan, R=0 in 8-bit BGR


def preprocess(bgr: np.ndarray, blur_ksize: int, blur_sigma: float) -> np.ndarray:
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    k = blur_ksize | 1  # must be odd
    if k < 3:
        k = 3
    blurred = cv2.GaussianBlur(gray, (k, k), blur_sigma)
    return blurred


def edges_canny(gray: np.ndarray, low: int, high: int) -> np.ndarray:
    return cv2.Canny(gray, low, high)


def edges_sobel_strong(gray: np.ndarray, thresh: float) -> np.ndarray:
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    mag = cv2.magnitude(gx, gy)
    mag_n = cv2.normalize(mag, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    _, binary = cv2.threshold(mag_n, int(thresh), 255, cv2.THRESH_BINARY)
    return binary


def simplify_contours(
    edge_binary: np.ndarray,
    min_area: float,
    epsilon_ratio: float,
) -> list[np.ndarray]:
    # RETR_EXTERNAL: outer boundaries only (cleaner for portraits)
    contours, _ = cv2.findContours(edge_binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    out: list[np.ndarray] = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area:
            continue
        peri = cv2.arcLength(cnt, True)
        if peri < 1e-6:
            continue
        eps = epsilon_ratio * peri
        approx = cv2.approxPolyDP(cnt, eps, True)
        if len(approx) < 2:
            continue
        out.append(approx)
    return out


def draw_contours_cyan(
    shape_hw: tuple[int, int],
    contours: list[np.ndarray],
    stroke: int,
) -> np.ndarray:
    h, w = shape_hw
    canvas = np.zeros((h, w, 3), dtype=np.uint8)
    if contours:
        cv2.drawContours(canvas, contours, -1, CYAN_BGR, thickness=stroke, lineType=cv2.LINE_AA)
    return canvas


def recursive_gaussian_glow(
    line_bgr: np.ndarray,
    passes: int,
    sigma0: float,
    sigma_growth: float,
) -> np.ndarray:
    """Blur the (cyan-on-black) line layer repeatedly; larger sigma each pass = softer wide bloom."""
    acc = np.zeros_like(line_bgr, dtype=np.float32)
    layer = line_bgr.astype(np.float32)
    for p in range(passes):
        sigma = sigma0 + p * sigma_growth
        k = int(6 * sigma + 1) | 1
        k = min(k, 31)
        layer = cv2.GaussianBlur(layer, (k, k), sigmaX=sigma, sigmaY=sigma)
        weight = 0.55 / (p + 1) ** 0.85
        acc += layer * weight
    glow = np.clip(acc, 0, 255).astype(np.uint8)
    return glow


def composite_neon(
    glow_bgr: np.ndarray,
    sharp_bgr: np.ndarray,
    glow_mix: float,
    sharp_mix: float,
) -> np.ndarray:
    g = glow_bgr.astype(np.float32) * glow_mix
    s = sharp_bgr.astype(np.float32) * sharp_mix
    out = np.clip(g + s, 0, 255).astype(np.uint8)
    return out


def boost_saturation_brightness(bgr: np.ndarray, line_mask: np.ndarray, v_gain: float, s_gain: float) -> np.ndarray:
    """HSV boost on pixels where mask > 0 (lines + nearby glow)."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV).astype(np.float32)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    m = (line_mask > 0).astype(np.float32)
    s = np.clip(s * (1 + (s_gain - 1) * m), 0, 255)
    v = np.clip(v * (1 + (v_gain - 1) * m), 0, 255)
    hsv[:, :, 1] = s
    hsv[:, :, 2] = v
    return cv2.cvtColor(np.clip(hsv, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR)


def build_line_mask(sharp_bgr: np.ndarray, dilate: int = 5) -> np.ndarray:
    gray = cv2.cvtColor(sharp_bgr, cv2.COLOR_BGR2GRAY)
    _, m = cv2.threshold(gray, 8, 255, cv2.THRESH_BINARY)
    if dilate > 0:
        k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate | 1, dilate | 1))
        m = cv2.dilate(m, k)
    return m


def run_pipeline(
    bgr: np.ndarray,
    *,
    use_sobel: bool,
    canny_low: int,
    canny_high: int,
    sobel_thresh: float,
    blur_ksize: int,
    blur_sigma: float,
    min_area: float,
    epsilon_ratio: float,
    stroke: int,
    glow_passes: int,
    glow_sigma0: float,
    glow_sigma_growth: float,
    glow_mix: float,
    sharp_mix: float,
    hsv_v_gain: float,
    hsv_s_gain: float,
) -> np.ndarray:
    h, w = bgr.shape[:2]
    gray = preprocess(bgr, blur_ksize, blur_sigma)

    if use_sobel:
        edges = edges_sobel_strong(gray, sobel_thresh)
    else:
        edges = edges_canny(gray, canny_low, canny_high)

    contours = simplify_contours(edges, min_area=min_area, epsilon_ratio=epsilon_ratio)
    sharp = draw_contours_cyan((h, w), contours, stroke=stroke)

    glow = recursive_gaussian_glow(sharp, passes=glow_passes, sigma0=glow_sigma0, sigma_growth=glow_sigma_growth)
    merged = composite_neon(glow, sharp, glow_mix=glow_mix, sharp_mix=sharp_mix)

    mask = build_line_mask(sharp, dilate=7)
    final = boost_saturation_brightness(merged, mask, v_gain=hsv_v_gain, s_gain=hsv_s_gain)
    return final


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
