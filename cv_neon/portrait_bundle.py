"""Single OpenCV pipeline: edge mask, DFT path (preferably from neon line art), and neon PNG."""

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


def _path_dict_from_pts(samp: np.ndarray) -> list[dict[str, float]]:
    return [{"x": float(samp[i, 0]), "y": float(samp[i, 1])} for i in range(samp.shape[0])]


def _binary_mask_from_neon(line_bgr: np.ndarray, dilate_iters: int = 0) -> np.ndarray:
    """
    Combine luminance, channel max, LAB L, and cyan HSV hints so we latch onto drawn strokes + glow.
    """
    gray = cv2.cvtColor(line_bgr, cv2.COLOR_BGR2GRAY)
    mx = np.max(line_bgr, axis=2)
    lab = cv2.cvtColor(line_bgr, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0]
    hsv = cv2.cvtColor(line_bgr, cv2.COLOR_BGR2HSV)
    cyan = cv2.inRange(hsv, (78, 35, 35), (112, 255, 255))

    m1 = (gray > 16).astype(np.uint8) * 255
    m2 = (mx > 24).astype(np.uint8) * 255
    m3 = (L > 20).astype(np.uint8) * 255
    m = cv2.bitwise_or(m1, m2)
    m = cv2.bitwise_or(m, m3)
    m = cv2.bitwise_or(m, cyan)

    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k, iterations=2 + dilate_iters)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), iterations=1)
    return m


def _path_from_binary_mask(
    mask_u8: np.ndarray,
    sample_points: int,
    min_area: float,
) -> list[dict[str, float]] | None:
    contours, _ = cv2.findContours(mask_u8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return None
    best = max(contours, key=cv2.contourArea)
    if cv2.contourArea(best) < min_area:
        return None
    pts = best.reshape(-1, 2).astype(np.float64)
    try:
        samp = resample_closed_polyline(pts, sample_points)
    except ValueError:
        return None
    return _path_dict_from_pts(samp)


def _verify_path_on_line_art(line_bgr: np.ndarray, path: list[dict[str, float]], stride: int = 4) -> bool:
    """Sample points along the path; require most samples to land on bright line-art pixels."""
    if len(path) < 16:
        return False
    gray = cv2.cvtColor(line_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape
    ok = 0
    total = 0
    for i in range(0, len(path), stride):
        p = path[i]
        x = int(np.clip(round(p["x"]), 0, w - 1))
        y = int(np.clip(round(p["y"]), 0, h - 1))
        total += 1
        if int(gray[y, x]) > 18 or int(np.max(line_bgr[y, x])) > 24:
            ok += 1
    return total > 0 and (ok / total) >= 0.68


def _photo_canny_path_and_edges(
    img: np.ndarray,
    canny_low: int,
    canny_high: int,
    sample_points: int,
    min_area: float,
    w: int,
    h: int,
) -> tuple[list[dict[str, float]], np.ndarray]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    k = 7 | 1
    blurred = cv2.GaussianBlur(gray, (k, k), 0)
    edges = cv2.Canny(blurred, canny_low, canny_high)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not contours:
        return fallback_circle_path(w, h, sample_points), edges
    best = max(contours, key=cv2.contourArea)
    if cv2.contourArea(best) < min_area:
        return fallback_circle_path(w, h, sample_points), edges
    pts = best.reshape(-1, 2).astype(np.float64)
    try:
        samp = resample_closed_polyline(pts, sample_points)
        return _path_dict_from_pts(samp), edges
    except ValueError:
        return fallback_circle_path(w, h, sample_points), edges


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
    edgeMaskPngBase64, lineArtPngBase64, pathSource, lineArtPathVerify.
    """
    img = resize_to_max_side(bgr, max_side)
    h, w = img.shape[:2]
    canny_low, canny_high = map_edge_threshold_to_canny(edge_threshold)

    if min_area is None:
        min_area = max(80.0, (w * h) * 0.001)

    fallback_path, photo_edges = _photo_canny_path_and_edges(
        img, canny_low, canny_high, sample_points, min_area, w, h
    )

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

    path_list: list[dict[str, float]]
    edge_for_png: np.ndarray
    path_source: str
    line_art_verify = False

    mask0 = _binary_mask_from_neon(line_bgr, dilate_iters=0)
    cand = _path_from_binary_mask(mask0, sample_points, min_area)

    if cand is not None and _verify_path_on_line_art(line_bgr, cand):
        path_list = cand
        edge_for_png = mask0
        path_source = "lineArt"
        line_art_verify = True
    else:
        mask1 = _binary_mask_from_neon(line_bgr, dilate_iters=1)
        cand = _path_from_binary_mask(mask1, sample_points, min_area * 0.85)
        if cand is not None and _verify_path_on_line_art(line_bgr, cand):
            path_list = cand
            edge_for_png = mask1
            path_source = "lineArt"
            line_art_verify = True
        else:
            path_list = fallback_path
            edge_for_png = photo_edges
            path_source = "photoCanny"

    ok_e, edge_buf = cv2.imencode(".png", edge_for_png)
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
        "pathSource": path_source,
        "lineArtPathVerify": line_art_verify,
    }
