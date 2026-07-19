"""Extract raster pages and lossless text spans from PDF uploads."""
import math
import os
import re
import unicodedata
from collections.abc import Iterator

import fitz

from .models import NativeTable, NativeTextLine, NativeTextSpan, PageInput


PDF_RENDER_DPI = 300
MAX_PDF_PAGE_PIXELS = int(os.getenv("OCR_MAX_PDF_PAGE_PIXELS", "40000000"))
MAX_PDF_TOTAL_PIXELS = int(os.getenv("OCR_MAX_PDF_TOTAL_PIXELS", "500000000"))
_DEFAULT_FONT_SIZE_PT = 11.0
_MAX_FONT_SIZE_PT = 512.0
_PDF_SUBSET_PREFIX = re.compile(r"^[A-Z]{6}\+(.+)$")


def _clean_span_text(value: object) -> str:
    """Remove control bytes without discarding valid non-Latin PDF text."""
    if not isinstance(value, str):
        return ""

    cleaned = []
    for character in unicodedata.normalize("NFC", value):
        if character in "\t\r\n":
            cleaned.append(" ")
        elif unicodedata.category(character) != "Cc":
            cleaned.append(character)
    return "".join(cleaned)


def _has_usable_text(text: str) -> bool:
    """Reject replacement-glyph-only spans while retaining symbols and math."""
    for character in text:
        if character.isspace() or character == "\ufffd":
            continue
        if unicodedata.category(character) != "Co":
            return True
    return False


def _font_family(value: object) -> str:
    family = str(value or "").strip()
    match = _PDF_SUBSET_PREFIX.match(family)
    return match.group(1) if match else family


def _font_size(value: object) -> float:
    try:
        size = float(value)
    except (TypeError, ValueError):
        return _DEFAULT_FONT_SIZE_PT
    if not math.isfinite(size) or size <= 0:
        return _DEFAULT_FONT_SIZE_PT
    return min(size, _MAX_FONT_SIZE_PT)


def _rgb_from_pdf_color(value: int) -> tuple[int, int, int]:
    try:
        value = int(value or 0) & 0xFFFFFF
    except (TypeError, ValueError):
        value = 0
    return ((value >> 16) & 255, (value >> 8) & 255, value & 255)


def _safe_rect(value: object) -> fitz.Rect | None:
    try:
        rect = fitz.Rect(value)
    except (TypeError, ValueError):
        return None
    coordinates = (rect.x0, rect.y0, rect.x1, rect.y1)
    if not all(math.isfinite(coordinate) for coordinate in coordinates):
        return None
    if rect.is_empty or rect.is_infinite:
        return None
    return rect


def _rendered_rect(
    bbox: object,
    transform: fitz.Matrix,
    render_bounds: fitz.Rect,
) -> fitz.Rect | None:
    rect = _safe_rect(bbox)
    if rect is None:
        return None
    rect = (rect * transform) & render_bounds
    return None if rect.is_empty or rect.is_infinite else rect


def _span_is_visible(span: dict) -> bool:
    try:
        if "alpha" in span and int(span["alpha"]) <= 0:
            return False
    except (TypeError, ValueError):
        return False

    # Older PyMuPDF versions did not expose alpha. In those versions the
    # filled/stroked bits are the best indication of PDF render mode 3 text.
    if "alpha" not in span and "char_flags" in span:
        try:
            paint_flags = fitz.mupdf.FZ_STEXT_FILLED | fitz.mupdf.FZ_STEXT_STROKED
            if not int(span["char_flags"]) & paint_flags:
                return False
        except (AttributeError, TypeError, ValueError):
            pass
    return True


def _extract_native_lines(
    page: fitz.Page,
    matrix: fitz.Matrix,
    render_bounds: fitz.Rect,
) -> list[NativeTextLine]:
    """Read embedded PDF text before rasterization destroys its fidelity."""
    result = []
    text_flags = fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES
    page_dict = page.get_text("dict", flags=text_flags, sort=False)
    transform = page.rotation_matrix * matrix
    for block_index, block in enumerate(page_dict.get("blocks", [])):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = []
            for span in line.get("spans", []):
                if not _span_is_visible(span):
                    continue

                text = _clean_span_text(span.get("text", ""))
                if not text:
                    continue
                rect = _rendered_rect(span.get("bbox"), transform, render_bounds)
                if rect is None:
                    continue
                try:
                    flags = int(span.get("flags", 0))
                except (TypeError, ValueError):
                    flags = 0
                spans.append(NativeTextSpan(
                    text=text,
                    bbox=[rect.x0, rect.y0, rect.x1, rect.y1],
                    font_size_pt=_font_size(span.get("size")),
                    font_family=_font_family(span.get("font")),
                    color_rgb=_rgb_from_pdf_color(span.get("color", 0)),
                    bold=bool(flags & fitz.TEXT_FONT_BOLD),
                    italic=bool(flags & fitz.TEXT_FONT_ITALIC),
                ))
            if not spans or not _has_usable_text("".join(span.text for span in spans)):
                continue

            # Derive the line bounds from retained spans. The original line
            # may include invisible text that we deliberately filtered out.
            line_rect = fitz.Rect(spans[0].bbox)
            for span in spans[1:]:
                line_rect |= fitz.Rect(span.bbox)
            try:
                native_block_index = int(block.get("number", block_index))
            except (TypeError, ValueError):
                native_block_index = block_index
            result.append(NativeTextLine(
                bbox=[line_rect.x0, line_rect.y0, line_rect.x1, line_rect.y1],
                spans=spans,
                block_index=native_block_index,
            ))
    return result


def _extract_native_tables(
    page: fitz.Page,
    matrix: fitz.Matrix,
    render_bounds: fitz.Rect,
) -> list[NativeTable]:
    """Extract editable cell text from ruled, born-digital PDF tables."""
    find_tables = getattr(page, "find_tables", None)
    if not callable(find_tables):
        return []

    transform = page.rotation_matrix * matrix
    result = []
    for table in find_tables().tables:
        rect = _rendered_rect(table.bbox, transform, render_bounds)
        if rect is None:
            continue
        rows = table.extract()
        if not rows or not any(any(cell for cell in row) for row in rows):
            continue
        result.append(NativeTable(
            bbox=[rect.x0, rect.y0, rect.x1, rect.y1],
            rows=[
                [str(cell).strip() if cell is not None else "" for cell in row]
                for row in rows
            ],
        ))
    return result


def _annotation_rgb(annotation: fitz.Annot) -> tuple[int, int, int]:
    colors = annotation.colors or {}
    components = colors.get("stroke") or colors.get("fill") or (1.0, 1.0, 0.0)
    if len(components) == 1:
        components = (components[0], components[0], components[0])
    if len(components) < 3:
        return (255, 255, 0)
    return tuple(max(0, min(255, int(round(float(value) * 255)))) for value in components[:3])


def _apply_pdf_highlights(
    page: fitz.Page,
    lines: list[NativeTextLine],
    matrix: fitz.Matrix,
    render_bounds: fitz.Rect,
) -> None:
    transform = page.rotation_matrix * matrix
    for annotation in page.annots() or []:
        if annotation.type[0] != fitz.PDF_ANNOT_HIGHLIGHT:
            continue
        highlight = _rendered_rect(annotation.rect, transform, render_bounds)
        if highlight is None:
            continue
        color = _annotation_rgb(annotation)
        for line in lines:
            for span in line.spans:
                span_rect = fitz.Rect(span.bbox)
                intersection = span_rect & highlight
                if not intersection.is_empty and intersection.get_area() / span_rect.get_area() >= 0.15:
                    span.highlight_rgb = color


def iter_pdf_page_inputs(file_bytes: bytes, max_pages: int) -> Iterator[PageInput]:
    """Yield rendered PDF pages so the OCR worker can release each raster.

    Keeping this lazy matters for the 50-page limit: retaining every 300-DPI
    PNG until analysis starts can consume substantially more memory than the
    uploaded PDF itself.
    """
    if max_pages < 1:
        raise ValueError("The PDF page limit must be at least one.")

    try:
        pdf = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise ValueError("Could not read the PDF.") from exc

    try:
        if pdf.needs_pass:
            raise ValueError("Password-protected PDFs are not supported.")
        if not pdf.page_count:
            raise ValueError("The PDF has no pages.")
        if pdf.page_count > max_pages:
            raise ValueError(f"PDFs are limited to {max_pages} pages per OCR request.")

        matrix = fitz.Matrix(PDF_RENDER_DPI / 72, PDF_RENDER_DPI / 72)
        total_pixels = 0
        for page_index, page in enumerate(pdf):
            expected_width = int(math.ceil(page.rect.width * PDF_RENDER_DPI / 72))
            expected_height = int(math.ceil(page.rect.height * PDF_RENDER_DPI / 72))
            expected_pixels = expected_width * expected_height
            total_pixels += expected_pixels
            if expected_pixels > MAX_PDF_PAGE_PIXELS:
                raise ValueError(
                    f"PDF page {page_index + 1} exceeds the {MAX_PDF_PAGE_PIXELS:,}-pixel render limit."
                )
            if total_pixels > MAX_PDF_TOTAL_PIXELS:
                raise ValueError(
                    f"The PDF exceeds the {MAX_PDF_TOTAL_PIXELS:,}-pixel total render limit."
                )
            try:
                pixmap = page.get_pixmap(matrix=matrix, alpha=False)
            except Exception as exc:
                raise ValueError(f"Could not render PDF page {page_index + 1}.") from exc

            # A malformed or unusual embedded text layer should not prevent
            # the raster page from proceeding through OCR.
            bounds = fitz.Rect(pixmap.irect)
            try:
                native_lines = _extract_native_lines(page, matrix, bounds)
                _apply_pdf_highlights(page, native_lines, matrix, bounds)
            except Exception:
                native_lines = []
            try:
                native_tables = _extract_native_tables(page, matrix, bounds)
            except Exception:
                native_tables = []
            yield PageInput(
                image_bytes=pixmap.tobytes("png"),
                page_index=page_index,
                native_lines=native_lines,
                native_tables=native_tables,
                dpi=PDF_RENDER_DPI,
                preserve_geometry=True,
            )
    finally:
        pdf.close()


def pdf_to_page_inputs(file_bytes: bytes, max_pages: int) -> list[PageInput]:
    """Materialized compatibility wrapper used by callers that need a list."""
    return list(iter_pdf_page_inputs(file_bytes, max_pages))
