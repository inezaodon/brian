"""OpenCV portrait neon line-art pipeline (shared by CLI and Vercel serverless)."""

from .pipeline import run_pipeline

__all__ = ["run_pipeline"]
