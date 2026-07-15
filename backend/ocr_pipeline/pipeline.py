"""
Stage-by-stage pipeline: image -> styled, editable docx.
Ties together preprocess (Stage 1) -> layout (Stage 2) -> per-region OCR
and style (Stage 3) -> docx assembly (Stage 7).

Text/title regions are re-OCR'd here with the plain PaddleOCR recognizer
instead of using PP-Structure's own embedded `res` text -- verified on
identical pixels that PP-Structure's embedded OCR drops the spaces between
words ("Hello!MynameisMuhammadWajid...") while the plain PaddleOCR().ocr()
call on the same crop does not ("Hello! My name is Muhammad Wajid...").
Table regions are unaffected by this bug (table HTML comes from a separate
submodule) and are passed straight to docx_builder.
"""
from typing import Dict
import numpy as np

from . import preprocess as pre
from .layout import analyze_layout, Region
from .style import extract_style, TextStyle
from .docx_builder import build_docx
from .simple_pipeline import get_ocr_engine, sort_ocr_boxes


def _ocr_region_text(img: np.ndarray, bbox: list) -> str:
    h, w = img.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox]
    x1, y1 = max(x1, 0), max(y1, 0)
    x2, y2 = min(x2, w), min(y2, h)
    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        return ""

    result = get_ocr_engine().ocr(crop, cls=False)
    if not result or not result[0]:
        return ""

    sorted_result = sort_ocr_boxes(result[0])
    return " ".join(line[1][0] for line in sorted_result)


def _process_regions(image_bytes: bytes):
    """Shared by image_to_text() and image_to_docx() -- one preprocessing
    + layout + per-region OCR/style pass, reused by both callers."""
    img = pre.preprocess(image_bytes)
    regions = analyze_layout(img)

    region_texts: Dict[int, str] = {}
    region_styles: Dict[int, TextStyle] = {}

    for region in regions:
        if region.kind in ("table", "figure"):
            continue
        region_texts[region.order] = _ocr_region_text(img, region.bbox)
        region_styles[region.order] = extract_style(img, region.bbox)

    return regions, region_texts, region_styles


def image_to_text(image_bytes: bytes) -> str:
    regions, region_texts, _ = _process_regions(image_bytes)
    lines = [
        region_texts[r.order]
        for r in regions
        if region_texts.get(r.order, "").strip()
    ]
    return "\n".join(lines)


def image_to_docx(image_bytes: bytes) -> bytes:
    regions, region_texts, region_styles = _process_regions(image_bytes)
    return build_docx(regions, region_texts, region_styles)
