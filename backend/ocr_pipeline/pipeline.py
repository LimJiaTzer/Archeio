"""
Stage-by-stage pipeline: image -> styled, editable docx.
Ties together preprocess (Stage 1) -> layout (Stage 2) -> per-region OCR
and style (Stage 3) -> docx assembly (Stage 7).

Text/title regions are re-OCR'd here with the plain PaddleOCR recognizer
instead of trusting either layout engine's own embedded text -- verified on
identical pixels that both PP-Structure's embedded `res` text and
PP-StructureV3's `block_content` drop spaces between words
("Hello!MynameisMuhammadWajid...", "Hello!My name is...and Im a sixteeny...")
while the plain PaddleOCR().ocr() call on the same crop does not ("Hello! My
name is Muhammad Wajid..."). This applies regardless of which layout engine
(paddle_v2 or paddle_v3) is selected. Table regions are unaffected by this bug
(table content comes from a separate table-recognition submodule either way)
and are passed straight to docx_builder.
"""
import io
import re
from typing import List
import cv2
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
    # or label.
    if region_width <= page_width * 0.78 and abs(left_margin - right_margin) <= page_width * 0.08:
        return "center"
    if left_margin >= page_width * 0.28 and right_margin <= page_width * 0.08:
        return "right"
    # A region spanning nearly the full page width with narrow margins on
    # BOTH sides is conventionally justified body text in scanned letters,
    # forms, and reports (verified against PaddleOCR's own native docx
    # export, which classified the equivalent block as JUSTIFY). A region
    # that's merely left-aligned with ragged-right wrapping typically still
    # falls short of the page's right margin, since its longest line rarely
    # happens to reach it -- that case still lands on the plain "left"
    # fallback below.
    if region_width >= page_width * 0.85 and left_margin <= page_width * 0.08 and right_margin <= page_width * 0.08:
        return "justify"
    return "left"


def _classify_region(region: Region) -> str:
    """Normalize PP-Structure labels into the document roles we export."""
    return {
        "title": "heading",
        "paragraph_title": "heading",
        "doc_title": "heading",
        "section_title": "heading",
        "text": "paragraph",
        "list": "list",
        "table": "table",
        "figure": "figure",
        # PP-StructureV3 names these more specifically. Supporting them here
        # keeps document assembly compatible when the layout backend changes.
        "image": "figure",
        "chart": "figure",
    }.get(region.kind, "paragraph")


def _infer_heading_level(text: str, font_size_pt: float) -> int:
    """Choose a conservative DOCX heading level from title numbering and size.

    Layout classification remains the source of truth that this is a heading.
    Numbering only refines its nesting so an OCR typo cannot turn body text into
    a heading by itself.
    """
    normalized = text.strip()
    if re.match(r"^(?:[IVXLCDM]+|[A-Z])\s*[.)]", normalized):
        return 1
    if re.match(r"^(?:\d+(?:\.\d+)+|\([A-Za-z0-9]+\))", normalized):
        return 3
    if re.match(r"^\d+\s*[.)]", normalized):
        return 2
    if font_size_pt >= 20:
        return 1
    if font_size_pt >= 14:
        return 2
    return 3


def _crop_figure(
    layout_img: np.ndarray,
    bbox: list,
    source_img: np.ndarray | None = None,
    padding_px: int = 6,
) -> bytes | None:
    """Encode an image/figure region directly from the page pixels.

    The crop comes from the decoded source page, rather than OCR output or a
    text reconstruction. Layout runs on a potentially upscaled/deskewed image,
    so its coordinates are mapped back to the source dimensions first.
    """
    source_img = source_img if source_img is not None else layout_img
    layout_height, layout_width = layout_img.shape[:2]
    height, width = source_img.shape[:2]
    x1, y1, x2, y2 = [int(value) for value in bbox]
    scale_x, scale_y = width / layout_width, height / layout_height
    source_padding = max(2, int(round(padding_px * max(scale_x, scale_y))))
    x1 = max(0, int(round(x1 * scale_x)) - source_padding)
    y1 = max(0, int(round(y1 * scale_y)) - source_padding)
    x2 = min(width, int(round(x2 * scale_x)) + source_padding)
    y2 = min(height, int(round(y2 * scale_y)) + source_padding)
    if x2 <= x1 or y2 <= y1:
        return None

    crop = source_img[y1:y2, x1:x2]
    success, encoded = cv2.imencode(".png", crop)
    return encoded.tobytes() if success else None


def _ocr_region_text(img: np.ndarray, bbox: list) -> str:
    h, w = img.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox]
    x1, y1 = max(x1, 0), max(y1, 0)
    x2, y2 = min(x2, w), min(y2, h)
    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        return ""

    return " ".join(line[1][0] for line in recognize_lines(crop))


def analyze_image(image_bytes: bytes, page_index: int = 0) -> List[Region]:
    """Return layout regions enriched with semantic role, OCR text, and style."""
    source_img = pre.load_image(image_bytes)
    img = pre.preprocess_image(source_img)
    regions = analyze_layout(img)

    for region in regions:
        region.page_index = page_index
        region.role = _classify_region(region)
        region.alignment = _infer_alignment(region.bbox, img.shape[1])
        if region.role == "figure":
            region.image_bytes = _crop_figure(img, region.bbox, source_img)
            continue
        if region.role == "table":
            continue
        region.text = _ocr_region_text(img, region.bbox)
        region.style = extract_style(img, region.bbox)
        if region.role == "heading":
            region.heading_level = _infer_heading_level(
                region.text,
                region.style.font_size_pt,
            )

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
        add_regions_to_docx(doc, analyze_image(image_bytes, page_index=page_index))

    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()
