"""Single OpenCV pipeline: edge mask, resampled closed path (DFT input), and neon line-art PNG."""

from __future__ import annotations

import base64
from typing import Any

import cv2
import numpy as np

from cv_neon.pipeline import run_pipeline


def resize_to_max_side(bgr: np.ndarray, max_side: int) -> np.ndarray:
    h, w = bgr.shape[:2]
    scale = min(1.0, max_side / max(w, h))
    nw = max(64, int(round(w * scale)))
    nh = max(64, int(round(h * scale)))
    if nw == w and nh == h:
        return bgr
    return cv2.resize(bgr, (nw, nh), interpolation=cv2.INTER_AREA)


def map_edge_threshold_to_canny(edge_threshold: int) -> tuple[int, int]:
    """Map legacy UI 20–255 to Canny pair (higher → stricter / fewer edges)."""
    t = (float(edge_threshold) - 20.0) / (255.0 - 20.0)
    t = max(0.0, min(1.0, t))
    high = int(90 + t * 110)
    low = max(20, int(high * 0.42))
    return low, high


def resample_closed_polyline(pts: np.ndarray, n_out: int) -> np.ndarray:
    """Uniform arc-length samples on a closed piecewise-linear loop (pts Nx2)."""
    pts = np.asarray(pts, dtype=np.float64).reshape(-1, 2)
    if pts.shape[0] < 3:
        raise ValueError("need at least 3 points")
    if not np.allclose(pts[0], pts[-1], atol=0.5):
        pts = np.vstack([pts, pts[0:1]])
    seg = np.diff(pts, axis=0)
    seg_len = np.sqrt((seg**2).sum(axis=1))
    total = float(seg_len.sum())
    if total < 1e-9:
        return np.tile(pts[0], (n_out, 1))
    cum = np.concatenate([[0.0], np.cumsum(seg_len)])
    targets = (np.arange(n_out, dtype=np.float64) + 0.5) * (total / n_out)
    out = np.zeros((n_out, 2), dtype=np.float64)
    for i, target in enumerate(targets):
        j = int(np.searchsorted(cum, target, side="right") - 1)
        j = max(0, min(j, seg_len.shape[0] - 1))
        t0 = cum[j]
        sl = seg_len[j]
        if sl < 1e-12:
            out[i] = pts[j]
            continue
        u = (target - t0) / sl
        out[i] = pts[j] * (1.0 - u) + pts[j + 1] * u
    return out


def fallback_circle_path(w: int, h: int, n: int) -> list[dict[str, float]]:
    cx = w / 2.0
    cy = h / 2.0
    r = min(w, h) * 0.35
    out: list[dict[str, float]] = []
    for i in range(n):
        t = (i / n) * (2 * np.pi)
        out.append({"x": float(cx + np.cos(t) * r), "y": float(cy + np.sin(t) * r)})
    return out


def build_portrait_bundle(
    bgr: np.ndarray,
    *,
    max_side: int = 280,
    sample_points: int = 384,
    edge_threshold: int = 105,
    min_area: float | None = None,
) -> dict[str, Any]:
    """
    Returns JSON-serializable dict with width, height, fftOrigin, path,
    edgeMaskPngBase64, lineArtPngBase64.
    """
    img = resize_to_max_side(bgr, max_side)
    h, w = img.shape[:2]
    canny_low, canny_high = map_edge_threshold_to_canny(edge_threshold)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    k = 7 | 1
    blurred = cv2.GaussianBlur(gray, (k, k), 0)
    edges = cv2.Canny(blurred, canny_low, canny_high)

    if min_area is None:
        min_area = max(80.0, (w * h) * 0.001)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    path_list: list[dict[str, float]]
    if not contours:
        path_list = fallback_circle_path(w, h, sample_points)
    else:
        best = max(contours, key=cv2.contourArea)
        if cv2.contourArea(best) < min_area:
            path_list = fallback_circle_path(w, h, sample_points)
        else:
            pts = best.reshape(-1, 2).astype(np.float64)
            try:
                samp = resample_closed_polyline(pts, sample_points)
                path_list = [{"x": float(samp[i, 0]), "y": float(samp[i, 1])} for i in range(sample_points)]
            except ValueError:
                path_list = fallback_circle_path(w, h, sample_points)

    line_bgr = run_pipeline(
        img,
        use_sobel=False,
        canny_low=canny_low,
        canny_high=canny_high,
        sobel_thresh=96.0,
        blur_ksize=7,
        blur_sigma=0.0,
        min_area=min_area,
        epsilon_ratio=0.002,
        stroke=2,
        glow_passes=3,
        glow_sigma0=2.2,
        glow_sigma_growth=1.4,
        glow_mix=0.85,
        sharp_mix=1.0,
        hsv_v_gain=1.12,
        hsv_s_gain=1.35,
    )

    ok_e, edge_buf = cv2.imencode(".png", edges)
    ok_l, line_buf = cv2.imencode(".png", line_bgr)
    if not ok_e or not ok_l:
        raise RuntimeError("PNG encode failed")

    return {
        "width": w,
        "height": h,
        "fftOrigin": {"x": w / 2.0, "y": h / 2.0},
        "path": path_list,
        "edgeMaskPngBase64": base64.b64encode(edge_buf.tobytes()).decode("ascii"),
        "lineArtPngBase64": base64.b64encode(line_buf.tobytes()).decode("ascii"),
    }
