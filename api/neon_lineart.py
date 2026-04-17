"""
Vercel Python serverless function: POST multipart field `image` → PNG neon line-art.

Requires root `requirements.txt` (opencv-python-headless, numpy). Same pipeline as
`scripts/portrait_neon_lineart.py` via `cv_neon.pipeline`.
"""

from __future__ import annotations

import re
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

_repo_root = Path(__file__).resolve().parent.parent
_rp = str(_repo_root)
if _rp not in sys.path:
    sys.path.insert(0, _rp)

import cv2
import numpy as np

from cv_neon.pipeline import run_pipeline

MAX_BYTES = 12 * 1024 * 1024


def _extract_image_bytes(body: bytes, content_type: str) -> bytes | None:
    if "multipart/form-data" not in content_type.lower():
        return None
    m = re.search(r"boundary=(?P<b>[^;\s]+)", content_type, re.I)
    if not m:
        return None
    b = m.group("b").strip().strip('"').encode("ascii", errors="ignore")
    if not b:
        return None
    delimiter = b"--" + b
    for part in body.split(delimiter):
        if b'name="image"' not in part and b"name='image'" not in part:
            continue
        sep = part.find(b"\r\n\r\n")
        if sep == -1:
            sep = part.find(b"\n\n")
            if sep == -1:
                continue
            off = sep + 2
        else:
            off = sep + 4
        data = part[off:]
        if data.endswith(b"\r\n"):
            data = data[:-2]
        elif data.endswith(b"\n"):
            data = data[:-1]
        return data.strip() or None
    return None


def _default_pipeline(bgr: np.ndarray) -> np.ndarray:
    return run_pipeline(
        bgr,
        use_sobel=False,
        canny_low=48,
        canny_high=148,
        sobel_thresh=96.0,
        blur_ksize=7,
        blur_sigma=0.0,
        min_area=120.0,
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


class handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_POST(self) -> None:  # noqa: N802
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_BYTES:
                self.send_error(413 if length > MAX_BYTES else 400)
                return
            body = self.rfile.read(length)
            ct = self.headers.get("Content-Type", "")
            raw = _extract_image_bytes(body, ct)
            if not raw:
                self.send_error(400, "Expected multipart/form-data with field image")
                return
            arr = np.frombuffer(raw, dtype=np.uint8)
            bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if bgr is None:
                self.send_error(400, "Could not decode image")
                return
            out = _default_pipeline(bgr)
            ok, buf = cv2.imencode(".png", out)
            if not ok:
                self.send_error(500, "Encode failed")
                return
            png = buf.tobytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(png)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(png)
        except Exception:
            self.send_error(503, "OpenCV pipeline error")

    def log_message(self, format: str, *args: object) -> None:
        return
