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
import io
from typing import List
import numpy as np
from docx import Document

from . import preprocess as pre
from .layout import analyze_layout, Region
from .style import extract_style
from .docx_builder import add_regions_to_docx
from .recognition import recognize_lines


def _infer_alignment(bbox: list, page_width: int) -> str:
    """Infer paragraph alignment from a layout region's horizontal margins."""
    x1, _, x2, _ = [int(value) for value in bbox]
    region_width = x2 - x1
    left_margin = x1
    right_margin = page_width - x2

    # A narrow region with similar left and right margins is a centered title
    # or label. Full-width body regions naturally stay left-aligned.
    if region_width <= page_width * 0.78 and abs(left_margin - right_margin) <= page_width * 0.08:
        return "center"
    if left_margin >= page_width * 0.28 and right_margin <= page_width * 0.08:
        return "right"
    return "left"


def _classify_region(region: Region) -> str:
    """Normalize PP-Structure labels into the document roles we export."""
    return {
        "title": "heading",
        "text": "paragraph",
        "list": "list",
        "table": "table",
        "figure": "figure",
    }.get(region.kind, "paragraph")


def _ocr_region_text(img: np.ndarray, bbox: list) -> str:
    h, w = img.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox]
    x1, y1 = max(x1, 0), max(y1, 0)
    x2, y2 = min(x2, w), min(y2, h)
    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        return ""

    return " ".join(line[1][0] for line in recognize_lines(crop))


def analyze_image(image_bytes: bytes) -> List[Region]:
    """Return layout regions enriched with semantic role, OCR text, and style."""
    img = pre.preprocess(image_bytes)
    regions = analyze_layout(img)

    for region in regions:
        region.role = _classify_region(region)
        if region.role in ("table", "figure"):
            continue
        region.text = _ocr_region_text(img, region.bbox)
        region.style = extract_style(img, region.bbox)
        region.alignment = _infer_alignment(region.bbox, img.shape[1])

    return regions


def image_to_text(image_bytes: bytes) -> str:
    regions = analyze_image(image_bytes)
    lines = [
        region.text
        for region in regions
        if region.text.strip()
    ]
    return "\n".join(lines)


def image_to_docx(image_bytes: bytes) -> bytes:
    return images_to_docx([image_bytes])


def images_to_docx(image_pages: List[bytes]) -> bytes:
    """Create one editable DOCX from one or more rasterized document pages."""
    doc = Document()
    for page_index, image_bytes in enumerate(image_pages):
        if page_index:
            doc.add_page_break()
        add_regions_to_docx(doc, analyze_image(image_bytes))

    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()
