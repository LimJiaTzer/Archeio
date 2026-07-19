"""Verify the local OCR runtime and optionally populate Paddle model caches."""
import argparse
import os
import platform
import sys


def verify_installation() -> None:
    import cv2
    import bs4
    import fastapi
    import fitz
    import latex2mathml
    import mathml2omml
    import numpy
    import paddle
    import paddleocr
    import PIL
    import docx
    import pillow_avif
    import pillow_heif

    if not hasattr(paddleocr, "PPStructureV3"):
        raise RuntimeError("PaddleOCR 3.x with PPStructureV3 is required.")

    print(f"Python {platform.python_version()} ({platform.machine()})")
    print(f"PaddlePaddle {paddle.__version__}")
    print(f"PaddleOCR {paddleocr.__version__}")
    print(f"FastAPI {fastapi.__version__}")
    print(f"OpenCV {cv2.__version__}")
    print(f"PyMuPDF {fitz.VersionBind}")
    print(f"Pillow {PIL.__version__}")
    print(f"python-docx {docx.__version__}")
    print(f"NumPy {numpy.__version__}")

    # Imports above are also intentional checks for conversion-only packages
    # that do not expose a stable public version attribute.
    del bs4, latex2mathml, mathml2omml, pillow_avif, pillow_heif


def download_models() -> None:
    # Skip PaddleX's preliminary host probe. Missing files are still downloaded
    # from the configured model source and failures remain visible to setup.
    os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
    os.environ.setdefault("OCR_ENGINE", "paddle_v3")
    os.environ.setdefault("OCR_DEVICE", "cpu")

    from ocr_pipeline.layout import get_engine
    from ocr_pipeline.recognition import get_ocr_engine

    print("Initializing PP-StructureV3 layout, table, formula, and OCR models...")
    get_engine()
    get_ocr_engine()
    print("OCR models are ready. Paddle will reuse its local model cache.")


def main() -> int:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--verify-only", action="store_true")
    mode.add_argument("--download-models", action="store_true")
    args = parser.parse_args()

    try:
        verify_installation()
        if args.download_models:
            download_models()
    except Exception as exc:
        print(f"OCR bootstrap failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
