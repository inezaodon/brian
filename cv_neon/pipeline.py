"""Portrait → neon line-art (OpenCV + NumPy). Used by CLI, Vercel, and `portrait_bundle` (typically ~420px max side)."""

from __future__ import annotations

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
