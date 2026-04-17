#!/usr/bin/env python3
"""Read an image, emit JSON bundle (path, edge mask, line art) on stdout for the Node API route."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

import cv2

from cv_neon.portrait_bundle import build_portrait_bundle


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("-i", "--input", type=Path, required=True)
    p.add_argument("--max-side", type=int, default=280)
    p.add_argument("--sample-points", type=int, default=384)
    p.add_argument("--edge-threshold", type=int, default=105)
    args = p.parse_args()
    if not args.input.is_file():
        print(json.dumps({"error": "input not found"}), file=sys.stderr)
        return 1
    bgr = cv2.imread(str(args.input), cv2.IMREAD_COLOR)
    if bgr is None:
        print(json.dumps({"error": "could not decode image"}), file=sys.stderr)
        return 1
    bundle = build_portrait_bundle(
        bgr,
        max_side=args.max_side,
        sample_points=args.sample_points,
        edge_threshold=args.edge_threshold,
    )
    sys.stdout.write(json.dumps(bundle))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
