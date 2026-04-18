"""Single OpenCV pipeline: edge mask, DFT path (preferably from neon line art), and neon PNG."""

from __future__ import annotations

import base64
import logging
from typing import Any

import cv2
import numpy as np

from cv_neon.pipeline import run_pipeline

_log = logging.getLogger(__name__)


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
    gray = cv2.cvtColor(line_bgr, cv2.COLOR_BGR2GRAY)
    mx = np.max(line_bgr, axis=2)
    lab = cv2.cvtColor(line_bgr, cv2.COLOR_BGR2LAB)
    L = lab[:, :, 0]
    hsv = cv2.cvtColor(line_bgr, cv2.COLOR_BGR2HSV)

    cyan = cv2.inRange(hsv, (72, 25, 25), (118, 255, 255))

    gray_blur = cv2.GaussianBlur(gray, (0, 0), sigmaX=3)
    mx_blur = cv2.GaussianBlur(mx.astype(np.float32), (0, 0), sigmaX=3)

    m1 = (gray > 12).astype(np.uint8) * 255
    m2 = (mx > 18).astype(np.uint8) * 255
    m3 = (L > 15).astype(np.uint8) * 255
    m4 = (gray_blur > 8).astype(np.uint8) * 255
    m5 = (mx_blur > 12).astype(np.uint8) * 255

    m = cv2.bitwise_or(m1, m2)
    m = cv2.bitwise_or(m, m3)
    m = cv2.bitwise_or(m, m4)
    m = cv2.bitwise_or(m, m5)
    m = cv2.bitwise_or(m, cyan)

    k_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k_close, iterations=3 + dilate_iters)
    m = cv2.morphologyEx(
        m,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
        iterations=1,
    )
    return m


def _path_from_binary_mask(
    mask_u8: np.ndarray,
    sample_points: int,
    min_area: float,
) -> list[dict[str, float]] | None:
    h, w = mask_u8.shape
    contours, _ = cv2.findContours(mask_u8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None

    filled = np.zeros((h, w), dtype=np.uint8)
    for cnt in contours:
        if cv2.contourArea(cnt) >= min_area * 0.15:
            cv2.drawContours(filled, [cnt], -1, 255, thickness=cv2.FILLED)

    if filled.sum() == 0:
        return None

    close_k = max(7, int(min(w, h) * 0.06))
    close_k = close_k | 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_k, close_k))
    closed = cv2.morphologyEx(filled, cv2.MORPH_CLOSE, kernel, iterations=3)
    closed = cv2.morphologyEx(closed, cv2.MORPH_DILATE, kernel, iterations=1)

    outer, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not outer:
        return None
    best = max(outer, key=cv2.contourArea)
    if cv2.contourArea(best) < min_area:
        return None

    pts = best.reshape(-1, 2).astype(np.float64)
    try:
        samp = resample_closed_polyline(pts, sample_points)
    except ValueError:
        return None
    return _path_dict_from_pts(samp)


def _verify_path_on_line_art(
    line_bgr: np.ndarray,
    path: list[dict[str, float]],
    stride: int = 4,
    radius: int = 5,
    threshold: float = 0.55,
) -> bool:
    if len(path) < 16:
        return False
    gray = cv2.cvtColor(line_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (0, 0), sigmaX=radius * 0.6)
    h, w = blurred.shape
    ok = 0
    total = 0
    for i in range(0, len(path), stride):
        p = path[i]
        x = int(np.clip(round(p["x"]), 0, w - 1))
        y = int(np.clip(round(p["y"]), 0, h - 1))
        x0, x1 = max(0, x - radius), min(w, x + radius + 1)
        y0, y1 = max(0, y - radius), min(h, y + radius + 1)
        patch = blurred[y0:y1, x0:x1]
        total += 1
        if patch.size > 0 and int(patch.max()) > 18:
            ok += 1
    return total > 0 and (ok / total) >= threshold


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
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)
    edges = cv2.Canny(blurred, canny_low, canny_high)

    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return fallback_circle_path(w, h, sample_points), edges

    filled = np.zeros((h, w), dtype=np.uint8)
    for cnt in contours:
        if cv2.contourArea(cnt) >= min_area * 0.1:
            cv2.drawContours(filled, [cnt], -1, 255, thickness=cv2.FILLED)

    if filled.sum() == 0:
        return fallback_circle_path(w, h, sample_points), edges

    close_k = max(7, int(min(w, h) * 0.06)) | 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_k, close_k))
    closed = cv2.morphologyEx(filled, cv2.MORPH_CLOSE, kernel, iterations=3)
    closed = cv2.morphologyEx(closed, cv2.MORPH_DILATE, kernel, iterations=1)

    outer, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not outer:
        return fallback_circle_path(w, h, sample_points), edges

    best = max(outer, key=cv2.contourArea)
    if cv2.contourArea(best) < min_area:
        return fallback_circle_path(w, h, sample_points), closed

    pts = best.reshape(-1, 2).astype(np.float64)
    try:
        samp = resample_closed_polyline(pts, sample_points)
        return _path_dict_from_pts(samp), closed
    except ValueError:
        return fallback_circle_path(w, h, sample_points), edges


def build_portrait_bundle(
    bgr: np.ndarray,
    *,
    max_side: int = 420,
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
    cand0 = _path_from_binary_mask(mask0, sample_points, min_area)
    ok0 = cand0 is not None and _verify_path_on_line_art(line_bgr, cand0)

    if cand0 is None:
        _log.warning("portrait_bundle: line-art mask produced no valid contour (mask0)")
    elif not ok0:
        _log.warning(
            "portrait_bundle: line-art path failed proximity verification (len=%d, trying dilated mask)",
            len(cand0),
        )

    if ok0:
        path_list = cand0
        edge_for_png = mask0
        path_source = "lineArt"
        line_art_verify = True
    else:
        mask1 = _binary_mask_from_neon(line_bgr, dilate_iters=1)
        cand1 = _path_from_binary_mask(mask1, sample_points, min_area * 0.85)
        ok1 = cand1 is not None and _verify_path_on_line_art(line_bgr, cand1)
        if cand1 is None:
            _log.warning("portrait_bundle: dilated line-art mask produced no valid contour (mask1)")
        elif not ok1:
            _log.warning(
                "portrait_bundle: dilated line-art path failed proximity verification (len=%d)",
                len(cand1),
            )
        if ok1:
            path_list = cand1
            edge_for_png = mask1
            path_source = "lineArt"
            line_art_verify = True
        else:
            _log.warning(
                "portrait_bundle: fell back to photoCanny path (canny_low=%d, canny_high=%d)",
                canny_low,
                canny_high,
            )
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
