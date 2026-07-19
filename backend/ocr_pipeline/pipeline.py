"""Document analysis pipeline: pixels/PDF spans -> structured IR -> DOCX."""
from collections import Counter
import io
import re
from statistics import median
from typing import Iterable, List, Sequence

import cv2
import numpy as np
from docx import Document

from . import preprocess as pre
from .docx_builder import add_page_to_docx
from .layout import analyze_layout
from .models import (
    DocumentIR,
    NativeTextLine,
    NativeTextSpan,
    NativeTable,
    PageIR,
    PageInput,
    Region,
)
from .recognition import recognize_lines
from .reading_order import reading_order
from .style import TextStyle, extract_style
from .text_cleanup import cleanup_document_text


_TEXT_ROLES = {
    "document_title",
    "heading",
    "paragraph",
    "list",
    "caption",
    "page_header",
    "page_footer",
    "page_number",
    "footnote",
    "code",
}


def _infer_alignment(bbox: list, page_width: int) -> str:
    """Infer paragraph alignment from a layout region's horizontal margins."""
    x1, _, x2, _ = [int(value) for value in bbox]
    region_width = x2 - x1
    left_margin = x1
    right_margin = page_width - x2

    if region_width <= page_width * 0.78 and abs(left_margin - right_margin) <= page_width * 0.08:
        return "center"
    if left_margin >= page_width * 0.28 and right_margin <= page_width * 0.08:
        return "right"
    if (
        region_width >= page_width * 0.85
        and left_margin <= page_width * 0.08
        and right_margin <= page_width * 0.08
    ):
        return "justify"
    return "left"


def _assign_region_alignments(regions: Sequence[Region], page_width: int) -> None:
    """Infer alignment from comparable column peers and recognized line edges."""
    for region in regions:
        page_alignment = _infer_alignment(region.bbox, page_width)
        region_width = max(1, region.bbox[2] - region.bbox[0])
        peers = []
        for candidate in regions:
            if candidate is region or candidate.role in {
                "figure", "header_figure", "footer_figure", "table", "formula"
            }:
                continue
            candidate_width = max(1, candidate.bbox[2] - candidate.bbox[0])
            width_ratio = min(region_width, candidate_width) / max(region_width, candidate_width)
            if width_ratio < 0.55:
                # A page-wide title does not define either narrow column below.
                continue
            overlap = max(
                0,
                min(region.bbox[2], candidate.bbox[2])
                - max(region.bbox[0], candidate.bbox[0]),
            )
            if overlap / min(region_width, candidate_width) >= 0.45:
                peers.append(candidate)
        column_left = min(candidate.bbox[0] for candidate in [region, *peers])
        column_right = max(candidate.bbox[2] for candidate in [region, *peers])
        column_width = max(1, column_right - column_left)
        local_bbox = [
            region.bbox[0] - column_left,
            region.bbox[1],
            region.bbox[2] - column_left,
            region.bbox[3],
        ]
        local_alignment = _infer_alignment(local_bbox, column_width)
        alignment = local_alignment if peers and column_width <= page_width * 0.75 else page_alignment

        valid_lines = [
            line for line in region.lines
            if len(line.bbox) == 4 and line.bbox[2] > line.bbox[0]
        ]
        if len(valid_lines) == 1:
            line_left, _, line_right, _ = [float(value) for value in valid_lines[0].bbox]
            line_center = (line_left + line_right) / 2
            center_tolerance = max(5.0, column_width * 0.05)
            if (
                line_right - line_left <= column_width * 0.78
                and abs(line_center - (column_left + column_right) / 2) <= center_tolerance
            ):
                alignment = "center"
        elif len(valid_lines) >= 2:
            lefts = [float(line.bbox[0]) for line in valid_lines]
            rights = [float(line.bbox[2]) for line in valid_lines]
            centers = [(left + right) / 2 for left, right in zip(lefts, rights)]
            edge_tolerance = max(4.0, column_width * 0.035)
            center_tolerance = max(5.0, column_width * 0.05)
            centers_are_aligned = (
                max(centers) - min(centers) <= center_tolerance
                and abs(median(centers) - (column_left + column_right) / 2) <= center_tolerance
            )
            right_edges_are_aligned = max(rights) - min(rights) <= edge_tolerance
            left_edges_are_aligned = max(lefts) - min(lefts) <= edge_tolerance
            median_line_width = median(right - left for left, right in zip(lefts, rights))
            if centers_are_aligned and (
                not (left_edges_are_aligned and right_edges_are_aligned)
                or median_line_width <= column_width * 0.78
            ):
                alignment = "center"
            elif right_edges_are_aligned and not left_edges_are_aligned:
                alignment = "right"
            elif left_edges_are_aligned and not right_edges_are_aligned:
                alignment = "left"

            # Justification is only defensible when at least two non-final
            # lines reach the same right edge and every line shares a left edge.
            if len(valid_lines) >= 3:
                non_final_rights = rights[:-1]
                if (
                    left_edges_are_aligned
                    and max(non_final_rights) - min(non_final_rights) <= edge_tolerance
                    and min(non_final_rights) >= column_right - edge_tolerance * 1.5
                ):
                    alignment = "justify"

        never_justify = {
            "document_title", "heading", "caption", "page_header", "page_footer",
            "page_number", "footnote", "code",
        }
        if region.role in never_justify and alignment == "justify":
            alignment = "left"
        elif region.role in {"paragraph", "list"} and alignment == "justify" and len(valid_lines) < 3:
            alignment = "left"
        region.alignment = alignment


def _classify_region(region: Region) -> str:
    """Normalize every known PP-Structure label into an export role.

    Paddle distinguishes document and paragraph titles, but it does not expose
    Word-style H1/H2/H3 levels. Those are assigned later, across all pages.
    """
    return {
        "doc_title": "document_title",
        "title": "heading",
        "paragraph_title": "heading",
        "section_title": "heading",
        "abstract_title": "heading",
        "reference_title": "heading",
        "content_title": "heading",
        "text": "paragraph",
        "abstract": "paragraph",
        "content": "paragraph",
        "reference": "paragraph",
        "reference_content": "paragraph",
        "aside_text": "paragraph",
        "list": "list",
        "table": "table",
        "formula": "formula",
        "formula_number": "caption",
        "figure_title": "caption",
        "table_title": "caption",
        "chart_title": "caption",
        "figure_table_chart_title": "caption",
        "header": "page_header",
        "footer": "page_footer",
        "number": "page_number",
        "footnote": "footnote",
        "algorithm": "code",
        "figure": "figure",
        "image": "figure",
        "chart": "figure",
        "flowchart": "figure",
        "seal": "figure",
        "header_image": "header_figure",
        "footer_image": "footer_figure",
    }.get(region.kind, "paragraph")


def _numbering_marker(text: str) -> tuple[str, int | None] | None:
    """Return a strong outline marker without mistaking years for headings."""
    normalized = text.strip()
    markdown = re.match(r"^(#{1,6})\s+", normalized)
    if markdown:
        return "markdown", len(markdown.group(1))

    decimal = re.match(r"^(\d+(?:\.\d+)+)(?:[.)])?\s+", normalized)
    if decimal:
        return "decimal", min(6, decimal.group(1).count(".") + 1)
    decimal = re.match(r"^(\d+)[.)]\s+", normalized)
    if decimal:
        return "decimal", 1

    if re.match(r"^[IVXLCDM]+[.)]\s+", normalized):
        return "roman", None
    if re.match(r"^[A-Z][.)]\s+", normalized):
        return "upper_alpha", None
    if re.match(r"^\([a-z]\)\s*", normalized):
        return "lower_alpha_parenthetical", None
    if re.match(r"^\(\d+\)\s*", normalized):
        return "number_parenthetical", None
    return None


def _numbering_depth(text: str) -> int | None:
    """Infer a conventional standalone depth; document context refines it."""
    marker = _numbering_marker(text)
    if marker is None:
        return None
    scheme, explicit = marker
    if explicit is not None:
        return explicit
    return {
        "roman": 1,
        "upper_alpha": 2,
        "lower_alpha_parenthetical": 3,
        "number_parenthetical": 3,
    }.get(scheme)


def _infer_heading_level(text: str, font_size_pt: float) -> int:
    """Backward-compatible single-heading estimate used before global resolution."""
    numbered = _numbering_depth(text)
    if numbered is not None:
        return numbered
    if font_size_pt >= 20:
        return 1
    if font_size_pt >= 14:
        return 2
    return 3


def _font_size_clusters(regions: Sequence[Region]) -> list[float]:
    sizes = sorted(
        {
            round(float(region.style.font_size_pt), 1)
            for region in regions
            if region.role == "heading" and region.style
        },
        reverse=True,
    )
    clusters: list[list[float]] = []
    for size in sizes:
        if clusters and abs(clusters[-1][0] - size) <= 1.0:
            clusters[-1].append(size)
        else:
            clusters.append([size])
    return [sum(cluster) / len(cluster) for cluster in clusters[:6]]


def _promote_recovered_native_headings(regions: Sequence[Region]) -> None:
    """Recover obvious styled PDF headings missed by the layout detector."""
    body_sizes = [
        float(region.style.font_size_pt)
        for region in regions
        if region.role in {"paragraph", "list"}
        and region.style
        and not region.metadata.get("recovered_without_layout")
    ]
    if not body_sizes:
        body_sizes = [
            float(region.style.font_size_pt)
            for region in regions
            if region.role in {"paragraph", "list"} and region.style
        ]
    body_size = median(body_sizes) if body_sizes else 11.0
    for region in regions:
        style = region.style
        lines = [line for line in region.text.splitlines() if line.strip()]
        if (
            region.role == "paragraph"
            and region.metadata.get("recovered_without_layout")
            and style
            and style.bold
            and float(style.font_size_pt) >= max(body_size + 1.5, body_size * 1.15)
            and len(lines) <= 2
            and len(region.text.strip()) <= 140
        ):
            region.role = "heading"
            region.metadata["role_source"] = "native_style"


def _assign_heading_hierarchy(regions: Sequence[Region]) -> None:
    """Resolve H1-H6 using strong numbering and document-wide visual ranks."""
    _promote_recovered_native_headings(regions)
    clusters = _font_size_clusters(regions)
    seen_schemes: set[str] = set()
    previous_level: int | None = None
    for region in regions:
        if region.role != "heading":
            region.heading_level = None
            continue

        marker = _numbering_marker(region.text)
        if marker is not None:
            scheme, explicit_level = marker
            if explicit_level is not None:
                level = explicit_level
            elif scheme == "roman":
                level = 1
            elif scheme == "upper_alpha":
                level = 2 if "roman" in seen_schemes else 1
            elif scheme in {"lower_alpha_parenthetical", "number_parenthetical"}:
                if "upper_alpha" in seen_schemes:
                    level = 3 if "roman" in seen_schemes else 2
                elif previous_level is not None:
                    level = min(6, previous_level + 1)
                else:
                    level = 2
            else:
                level = 1
            region.heading_level = max(1, min(6, level))
            region.metadata["heading_level_source"] = "numbering"
            seen_schemes.add(scheme)
            previous_level = region.heading_level
            continue

        if region.kind in {"abstract_title", "reference_title", "content_title"}:
            region.heading_level = 1
            region.metadata["heading_level_source"] = "paddle_label"
            previous_level = region.heading_level
            continue

        size = float(region.style.font_size_pt) if region.style else 11.0
        if clusters:
            visual_level = min(
                range(1, len(clusters) + 1),
                key=lambda level: abs(clusters[level - 1] - size),
            )
            region.heading_level = min(
                visual_level,
                previous_level + 1 if previous_level is not None else visual_level,
            )
            region.metadata["heading_level_source"] = "document_font_size"
        else:
            region.heading_level = _infer_heading_level(region.text, size)
            if previous_level is not None:
                region.heading_level = min(region.heading_level, previous_level + 1)
            region.metadata["heading_level_source"] = "fallback"
        previous_level = region.heading_level


def _crop_figure(
    layout_img: np.ndarray,
    bbox: list,
    source_img: np.ndarray | None = None,
    padding_px: int = 6,
) -> bytes | None:
    """Encode a region from page pixels, mapping scale when needed."""
    source_img = source_img if source_img is not None else layout_img
    layout_height, layout_width = layout_img.shape[:2]
    height, width = source_img.shape[:2]
    x1, y1, x2, y2 = [int(value) for value in bbox]
    scale_x, scale_y = width / layout_width, height / layout_height
    source_padding = max(0, int(round(padding_px * max(scale_x, scale_y))))
    x1 = max(0, int(round(x1 * scale_x)) - source_padding)
    y1 = max(0, int(round(y1 * scale_y)) - source_padding)
    x2 = min(width, int(round(x2 * scale_x)) + source_padding)
    y2 = min(height, int(round(y2 * scale_y)) + source_padding)
    if x2 <= x1 or y2 <= y1:
        return None

    crop = source_img[y1:y2, x1:x2]
    success, encoded = cv2.imencode(".png", crop)
    return encoded.tobytes() if success else None


def _overlap_fraction(first: Sequence[float], second: Sequence[float]) -> float:
    """Return the fraction of `first` covered by `second`."""
    ax1, ay1, ax2, ay2 = [float(value) for value in first]
    bx1, by1, bx2, by2 = [float(value) for value in second]
    area = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    if not area:
        return 0.0
    intersection = max(0.0, min(ax2, bx2) - max(ax1, bx1)) * max(
        0.0, min(ay2, by2) - max(ay1, by1)
    )
    return intersection / area


def _assign_native_lines_to_regions(
    regions: Sequence[Region],
    native_lines: Sequence[NativeTextLine],
) -> dict[int, list[NativeTextLine]]:
    """Assign each PDF line once, independent of Paddle block iteration order.

    Layout models sometimes emit a broad body block behind a smaller title
    block. Both contain the title's centre, so a greedy first-match assignment
    makes the outcome depend on parser order. Among blocks that meaningfully
    cover a line, the smallest text-bearing block is the most specific owner.
    """
    assignments: dict[int, list[NativeTextLine]] = {}
    text_regions = [
        (index, region)
        for index, region in enumerate(regions)
        if region.role in _TEXT_ROLES
    ]
    structural_regions = [
        region
        for region in regions
        if region.role in {
            "table", "formula", "figure", "header_figure", "footer_figure"
        }
    ]
    for line in native_lines:
        line_width = max(0.0, float(line.bbox[2]) - float(line.bbox[0]))
        line_height = max(0.0, float(line.bbox[3]) - float(line.bbox[1]))
        if line_width <= 0 or line_height <= 0:
            continue
        # Text embedded inside a native table or over an image belongs to that
        # structural region. Let its dedicated exporter consume it so a broad
        # background text block cannot duplicate the same content.
        if any(
            _overlap_fraction(line.bbox, region.bbox) >= 0.5
            for region in structural_regions
        ):
            continue
        center_x = (float(line.bbox[0]) + float(line.bbox[2])) / 2
        center_y = (float(line.bbox[1]) + float(line.bbox[3])) / 2
        candidates = []
        for index, region in text_regions:
            x1, y1, x2, y2 = [float(value) for value in region.bbox]
            line_coverage = _overlap_fraction(line.bbox, region.bbox)
            center_inside = (
                x1 - 4 <= center_x <= x2 + 4
                and y1 - 4 <= center_y <= y2 + 4
            )
            if line_coverage < 0.5 and not (
                center_inside and line_coverage >= 0.3
            ):
                continue
            region_area = max(1.0, (x2 - x1) * (y2 - y1))
            candidates.append((region_area, -line_coverage, index))
        if candidates:
            _, _, owner = min(candidates)
            assignments.setdefault(owner, []).append(line)

    for lines in assignments.values():
        lines[:] = reading_order(lines, lambda line: line.bbox)
    return assignments


def _meaningful_line_overlap(
    first: Sequence[float],
    second: Sequence[float],
) -> bool:
    """Whether two OCR/native line boxes describe the same page content."""
    return max(
        _overlap_fraction(first, second),
        _overlap_fraction(second, first),
    ) >= 0.3


def _native_table_for_region(
    region: Region,
    native_tables: Sequence[NativeTable],
) -> NativeTable | None:
    candidates = [
        (max(_overlap_fraction(table.bbox, region.bbox), _overlap_fraction(region.bbox, table.bbox)), table)
        for table in native_tables
    ]
    if not candidates:
        return None
    overlap, table = max(candidates, key=lambda item: item[0])
    return table if overlap >= 0.3 else None


def _normalized_native_table_rows(rows: object) -> list[list[str]]:
    """Remove finder-only blank grid lines without changing cell ownership."""
    if not isinstance(rows, (list, tuple)) or not rows:
        return []
    if not all(isinstance(row, (list, tuple)) for row in rows):
        return []

    width = max((len(row) for row in rows), default=0)
    if width <= 0:
        return []
    rectangular = [
        [str(cell).strip() if cell is not None else "" for cell in row]
        + [""] * (width - len(row))
        for row in rows
    ]
    rectangular = [row for row in rectangular if any(row)]
    if not rectangular:
        return []

    populated_columns = [
        column
        for column in range(width)
        if any(row[column] for row in rectangular)
    ]
    return [
        [row[column] for column in populated_columns]
        for row in rectangular
    ]


def _has_structured_paddle_table(result: object) -> bool:
    """Whether PP-Structure produced a table the DOCX builder can consume."""
    if not isinstance(result, dict):
        return False

    candidates = [result.get("html"), result.get("content")]
    structured = result.get("structured")
    if isinstance(structured, dict):
        candidates.extend((structured.get("pred_html"), structured.get("html")))

    for candidate in candidates:
        if not isinstance(candidate, str) or not candidate.strip():
            continue
        normalized = candidate.lower()
        if (
            "<table" in normalized
            and "<tr" in normalized
            and ("<td" in normalized or "<th" in normalized)
        ):
            return True
        lines = [line.strip() for line in candidate.splitlines() if line.strip()]
        if len(lines) >= 2 and "|" in lines[0] and re.search(
            r"(?:^|\|)\s*:?-{3,}:?\s*(?:\||$)",
            lines[1],
        ):
            return True
    return False


def _apply_best_table_result(
    region: Region,
    native_table: NativeTable | None,
) -> None:
    """Keep model-derived structure; use PDF grid extraction as fallback only.

    PyMuPDF ``find_tables`` follows every ruling line in the PDF. Decorative
    rules and text-wrap boundaries can therefore become empty columns and
    continuation rows. PP-Structure's table model is explicitly trained to
    recover logical cells, so a usable Paddle result must not be overwritten
    by that geometric grid.
    """
    if _has_structured_paddle_table(region.res):
        region.metadata["table_source"] = "paddle_structure"
        if native_table is not None:
            normalized = _normalized_native_table_rows(native_table.rows)
            region.metadata["native_table_candidate_shape"] = [
                len(normalized),
                len(normalized[0]) if normalized else 0,
            ]
        return

    if native_table is None:
        region.metadata["table_source"] = "visual_fallback"
        return

    rows = _normalized_native_table_rows(native_table.rows)
    if not rows:
        region.metadata["table_source"] = "visual_fallback"
        return

    region.res = {"rows": rows, "content": ""}
    region.source = "pdf_table"
    region.ocr_confidence = 1.0
    region.metadata["table_source"] = "pdf_table_fallback"


def _style_from_lines(lines: Sequence[NativeTextLine]) -> TextStyle:
    spans = [span for line in lines for span in line.spans if span.text]
    if not spans:
        return TextStyle(11, (0, 0, 0), False, False)

    weighted_sizes = []
    for span in spans:
        weighted_sizes.extend([span.font_size_pt] * max(1, len(span.text.strip())))
    family = Counter(
        span.font_family for span in spans if span.font_family
    ).most_common(1)
    color = Counter(span.color_rgb for span in spans).most_common(1)[0][0]
    highlight = Counter(
        span.highlight_rgb for span in spans if span.highlight_rgb is not None
    ).most_common(1)
    visible_chars = max(1, sum(len(span.text.strip()) for span in spans))
    bold_chars = sum(len(span.text.strip()) for span in spans if span.bold)
    italic_chars = sum(len(span.text.strip()) for span in spans if span.italic)
    return TextStyle(
        font_size_pt=float(median(weighted_sizes)),
        color_rgb=color,
        bold=bold_chars / visible_chars >= 0.5,
        italic_guess=italic_chars / visible_chars >= 0.5,
        font_family=family[0][0] if family else None,
        highlight_rgb=highlight[0][0] if highlight else None,
    )


def _looks_like_list(text: str) -> bool:
    return any(
        re.match(r"^\s*(?:[\u2022\u25e6\u25aa*-]|\d+[.)]|[A-Za-z][.)])\s+", line)
        for line in text.splitlines()
        if line.strip()
    )


def _normalized_ocr_lines(
    img: np.ndarray,
    bbox: list,
    block_index: int,
    recognized_items: Sequence[dict] | None = None,
    dpi: int = 200,
) -> tuple[list[NativeTextLine], float | None]:
    """OCR a region and preserve each recognized line and score."""
    height, width = img.shape[:2]
    x1, y1, x2, y2 = [int(value) for value in bbox]
    x1, y1 = max(x1, 0), max(y1, 0)
    x2, y2 = min(x2, width), min(y2, height)
    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        return [], None

    normalized = []
    scores = []
    items = recognized_items if recognized_items is not None else recognize_lines(crop)
    offset_x = 0 if recognized_items is not None else x1
    offset_y = 0 if recognized_items is not None else y1
    for item in items:
        if isinstance(item, dict):
            text = str(item.get("text", "")).strip()
            local_bbox = item.get("bbox") or [0, 0, x2 - x1, y2 - y1]
            confidence = item.get("confidence")
        else:
            # Compatibility with the previous V2-shaped utility while local
            # environments transition to the normalized adapter.
            text = str(item[1][0]).strip()
            points = item[0]
            local_bbox = [
                min(point[0] for point in points),
                min(point[1] for point in points),
                max(point[0] for point in points),
                max(point[1] for point in points),
            ]
            confidence = item[1][1] if len(item[1]) > 1 else None
        if not text:
            continue

        absolute_bbox = [
            float(local_bbox[0]) + offset_x,
            float(local_bbox[1]) + offset_y,
            float(local_bbox[2]) + offset_x,
            float(local_bbox[3]) + offset_y,
        ]
        style = extract_style(img, absolute_bbox, dpi=dpi)
        score = float(confidence) if confidence is not None else 0.0
        normalized.append(NativeTextLine(
            bbox=absolute_bbox,
            block_index=block_index,
            spans=[NativeTextSpan(
                text=text,
                bbox=absolute_bbox,
                font_size_pt=style.font_size_pt,
                color_rgb=style.color_rgb,
                bold=style.bold,
                italic=style.italic_guess,
                highlight_rgb=style.highlight_rgb,
                confidence=score,
            )],
        ))
        if confidence is not None:
            scores.append(score)
    return normalized, (sum(scores) / len(scores) if scores else None)


def _block_content_line(
    img: np.ndarray,
    region: Region,
    block_index: int,
    dpi: int,
) -> list[NativeTextLine]:
    """Preserve V3 parser text when its page OCR assignment is empty."""
    text = region.text.strip()
    if not text:
        return []
    style = extract_style(img, region.bbox, dpi=dpi)
    bbox = [float(value) for value in region.bbox]
    return [NativeTextLine(
        bbox=bbox,
        block_index=block_index,
        spans=[NativeTextSpan(
            text=text,
            bbox=bbox,
            font_size_pt=style.font_size_pt,
            color_rgb=style.color_rgb,
            bold=style.bold,
            italic=style.italic_guess,
            highlight_rgb=style.highlight_rgb,
            confidence=region.ocr_confidence or 0.0,
        )],
    )]


def _region_text(lines: Sequence[NativeTextLine]) -> str:
    return "\n".join(line.text for line in lines if line.text).strip()


def _nearest_order(region: Region, existing: Sequence[Region]) -> float:
    if not existing:
        return 0.0
    center_x = (region.bbox[0] + region.bbox[2]) / 2
    center_y = (region.bbox[1] + region.bbox[3]) / 2
    nearest = min(
        existing,
        key=lambda candidate: (
            ((candidate.bbox[0] + candidate.bbox[2]) / 2 - center_x) ** 2
            + ((candidate.bbox[1] + candidate.bbox[3]) / 2 - center_y) ** 2
        ),
    )
    return nearest.order + (-0.25 if center_y < nearest.bbox[1] else 0.25)


def _add_unmatched_native_blocks(
    regions: list[Region],
    native_lines: Sequence[NativeTextLine],
    used_line_ids: set[int],
    page_index: int,
    page_width: int,
    page_height: int,
) -> None:
    """Recover embedded PDF text blocks missed by layout detection."""
    excluded = [
        region
        for region in regions
        if region.role in {"table", "formula", "figure", "header_figure", "footer_figure"}
    ]
    grouped: dict[int, list[NativeTextLine]] = {}
    for line in native_lines:
        if id(line) in used_line_ids:
            continue
        if any(_overlap_fraction(line.bbox, region.bbox) >= 0.3 for region in excluded):
            continue
        grouped.setdefault(line.block_index, []).append(line)

    for block_lines in grouped.values():
        block_lines = reading_order(block_lines, lambda line: line.bbox)
        bbox = [
            int(min(line.bbox[0] for line in block_lines)),
            int(min(line.bbox[1] for line in block_lines)),
            int(max(line.bbox[2] for line in block_lines)),
            int(max(line.bbox[3] for line in block_lines)),
        ]
        text = _region_text(block_lines)
        if not text:
            continue
        role = "paragraph"
        if bbox[1] <= page_height * 0.04:
            role = "page_header"
        elif bbox[3] >= page_height * 0.96:
            role = "page_footer"
        elif _looks_like_list(text):
            role = "list"
        recovered = Region(
            kind="native_text",
            bbox=bbox,
            page_index=page_index,
            role=role,
            text=text,
            lines=block_lines,
            style=_style_from_lines(block_lines),
            alignment=_infer_alignment(bbox, page_width),
            native_text=True,
            source="pdf_text",
            ocr_confidence=1.0,
            metadata={"recovered_without_layout": True},
        )
        recovered.order = _nearest_order(recovered, regions)
        regions.append(recovered)


def analyze_page(page: PageInput) -> PageIR:
    """Analyze one prepared page, preferring lossless PDF text per region."""
    source_img = pre.load_image(page.image_bytes)
    # Rendered PDF pages are already clean, upright, and high-resolution. Not
    # deskewing them keeps Paddle and native PDF coordinates in the same space.
    has_native_geometry = bool(page.native_lines or page.native_tables)
    img = (
        source_img.copy()
        if page.preserve_geometry and has_native_geometry
        else pre.preprocess_image(source_img)
    )
    working_dpi = pre.effective_dpi(source_img, img, page.dpi)
    regions = analyze_layout(img)
    used_line_ids: set[int] = set()

    for region in regions:
        region.page_index = page.page_index
        region.role = _classify_region(region)
        # Crops and scanned-text boxes use working-image pixels. Carry their
        # effective DPI so DOCX physical sizes stay stable after OCR upscaling.
        region.metadata["source_image_dpi"] = page.dpi
        region.metadata["source_dpi"] = working_dpi
        region.metadata["effective_dpi"] = working_dpi
    native_assignments = _assign_native_lines_to_regions(
        regions, page.native_lines
    )
    for block_index, region in enumerate(regions):
        if region.role in {"figure", "header_figure", "footer_figure", "formula", "table"}:
            # Crop the exact coordinate space analyzed by Paddle. This avoids
            # incorrect figure crops after image deskewing.
            region.image_bytes = _crop_figure(img, region.bbox)
            if region.role == "table":
                native_table = _native_table_for_region(region, page.native_tables)
                _apply_best_table_result(region, native_table)
            continue

        if region.role not in _TEXT_ROLES:
            continue

        native = native_assignments.get(block_index, [])
        if native:
            used_line_ids.update(id(line) for line in native)
            missing_paddle_lines = []
            for item in region.metadata.get("paddle_ocr_lines", []):
                item_bbox = item.get("bbox")
                if not isinstance(item_bbox, (list, tuple)) or len(item_bbox) != 4:
                    continue
                # The PDF text layer is exact text, even when it is shorter or
                # disagrees with OCR. Paddle only fills genuinely uncovered
                # geometry; it never replaces an overlapping native line.
                if not any(
                    _meaningful_line_overlap(item_bbox, line.bbox)
                    for line in native
                ):
                    missing_paddle_lines.append(item)

            supplemental, supplemental_confidence = _normalized_ocr_lines(
                img,
                region.bbox,
                block_index,
                recognized_items=missing_paddle_lines,
                dpi=working_dpi,
            ) if missing_paddle_lines else ([], None)
            region.lines = reading_order(
                [*native, *supplemental],
                lambda line: line.bbox,
            )
            region.text = _region_text(region.lines)
            region.style = _style_from_lines(region.lines)
            region.native_text = True
            region.source = "hybrid" if supplemental else "pdf_text"
            if supplemental:
                native_weight = len(native)
                ocr_weight = len(supplemental)
                region.ocr_confidence = (
                    native_weight + (supplemental_confidence or 0.0) * ocr_weight
                ) / max(1, native_weight + ocr_weight)
            else:
                region.ocr_confidence = 1.0
        else:
            parser_content = region.text
            page_ocr_available = (
                region.metadata.get("paddle_ocr_available") is True
                or "paddle_ocr_lines" in region.metadata
            )
            paddle_lines = (
                region.metadata.get("paddle_ocr_lines", [])
                if page_ocr_available
                else None
            )
            region.lines, region.ocr_confidence = _normalized_ocr_lines(
                img,
                region.bbox,
                block_index,
                recognized_items=paddle_lines,
                dpi=working_dpi,
            )
            if (
                page_ocr_available
                and not region.lines
                and parser_content.strip()
                and not region.metadata.get("paddle_block_content_shadowed")
            ):
                region.text = parser_content
                region.lines = _block_content_line(
                    img, region, block_index, working_dpi
                )
                region.source = "paddle_block_content"
            else:
                region.source = "paddle_ocr"
            region.text = _region_text(region.lines)
            region.style = (
                _style_from_lines(region.lines)
                if region.lines
                else extract_style(img, region.bbox, dpi=working_dpi)
            )

        if region.role == "paragraph" and _looks_like_list(region.text):
            region.role = "list"
            region.metadata["role_source"] = "list_prefix"

    if page.native_lines:
        _add_unmatched_native_blocks(
            regions,
            page.native_lines,
            used_line_ids,
            page.page_index,
            img.shape[1],
            img.shape[0],
        )

    _assign_region_alignments(regions, img.shape[1])

    regions.sort(key=lambda region: (region.order, region.bbox[1], region.bbox[0]))
    for order, region in enumerate(regions):
        region.order = order
    return PageIR(page_index=page.page_index, regions=regions)


def analyze_image(
    image_bytes: bytes,
    page_index: int = 0,
    native_lines: Sequence[NativeTextLine] | None = None,
    preserve_geometry: bool = False,
    dpi: int = 200,
) -> List[Region]:
    """Compatibility entry point returning the enriched regions for one page."""
    page = PageInput(
        image_bytes=image_bytes,
        page_index=page_index,
        native_lines=list(native_lines or []),
        preserve_geometry=preserve_geometry,
        dpi=dpi,
    )
    regions = analyze_page(page).regions
    _assign_heading_hierarchy(regions)
    return regions


def analyze_document(pages: Iterable[PageInput]) -> DocumentIR:
    page_irs = [analyze_page(page) for page in pages]
    document = DocumentIR(pages=page_irs)
    cleanup_errors = cleanup_document_text(document)
    if cleanup_errors:
        for page in page_irs:
            if page.regions:
                page.regions[0].metadata["text_cleanup_errors"] = cleanup_errors
    _assign_heading_hierarchy([
        region for page in page_irs for region in page.regions
    ])
    return document


def image_to_text(image_bytes: bytes) -> str:
    return "\n".join(
        region.text for region in analyze_image(image_bytes) if region.text.strip()
    )


def document_ir_to_docx(document_ir: DocumentIR) -> bytes:
    doc = Document()
    for page_position, page in enumerate(document_ir.pages):
        add_page_to_docx(doc, page.regions, new_section=page_position > 0)
    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


def pages_to_docx(pages: Iterable[PageInput]) -> bytes:
    return document_ir_to_docx(analyze_document(pages))


def image_to_docx(image_bytes: bytes) -> bytes:
    return images_to_docx([image_bytes])


def images_to_docx(image_pages: List[bytes]) -> bytes:
    """Create one editable DOCX from one or more raster document pages."""
    return pages_to_docx(
        PageInput(image_bytes=image, page_index=index)
        for index, image in enumerate(image_pages)
    )
