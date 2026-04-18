"""
Vercel Python: POST multipart `image` (+ optional `edgeThreshold`) → JSON portrait bundle.
"""

from __future__ import annotations

import json
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

from cv_neon.portrait_bundle import build_portrait_bundle

MAX_BYTES = 12 * 1024 * 1024


def _multipart_parts(body: bytes, content_type: str) -> dict[str, bytes]:
    out: dict[str, bytes] = {}
    if "multipart/form-data" not in content_type.lower():
        return out
    m = re.search(r"boundary=(?P<b>[^;\s]+)", content_type, re.I)
    if not m:
        return out
    b = m.group("b").strip().strip('"').encode("ascii", errors="ignore")
    if not b:
        return out
    delimiter = b"--" + b
    for part in body.split(delimiter):
        name_m = re.search(rb'name="([^"]+)"', part)
        if not name_m:
            continue
        name = name_m.group(1).decode("utf-8", errors="replace")
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
        data = data.strip()
        if data:
            out[name] = data
    return out


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
            parts = _multipart_parts(body, ct)
            raw = parts.get("image")
            if not raw:
                self.send_error(400, "Missing image")
                return
            et = 105
            if "edgeThreshold" in parts:
                try:
                    et = int(parts["edgeThreshold"].decode("utf-8", errors="ignore").strip())
                except ValueError:
                    et = 105
            et = max(20, min(255, et))
            ms = 420
            sp = 512
            if "maxSide" in parts:
                try:
                    ms = max(64, min(512, int(parts["maxSide"].decode("utf-8", errors="ignore").strip())))
                except ValueError:
                    ms = 420
            if "samplePoints" in parts:
                try:
                    sp = max(32, min(640, int(parts["samplePoints"].decode("utf-8", errors="ignore").strip())))
                except ValueError:
                    sp = 512
            arr = np.frombuffer(raw, dtype=np.uint8)
            bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if bgr is None:
                self.send_error(400, "Could not decode image")
                return
            bundle = build_portrait_bundle(
                bgr,
                max_side=ms,
                sample_points=sp,
                edge_threshold=et,
            )
            payload = json.dumps(bundle).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)
        except Exception:
            self.send_error(503, "portrait pipeline error")

    def log_message(self, format: str, *args: object) -> None:
        return
