"""
Simplified pipeline: whole-page OCR only, no PPStructure/layout model,
no per-region cropping. This deliberately has far fewer moving parts than
pipeline.py's region-based approach — the goal is to get plain text
extraction and reading order rock-solid first, then layer structure
(tables, style, diagrams) back in once this is verified reliable.

Every step below prints a diagnostic line. Since I can't run PaddleOCR
in my own sandbox to verify this against your real images, these prints
are the fastest way for you to paste server-console output back to me
if something's still wrong -- they tell us exactly where in the pipeline
it went wrong, without needing another round of guessing.
"""
import io
from typing import List
from docx import Document
from paddleocr import PaddleOCR

from . import preprocess as pre

_ocr_engine: PaddleOCR = None


def get_ocr_engine() -> PaddleOCR:
    global _ocr_engine
    if _ocr_engine is None:
        print("[simple_pipeline] Initializing PaddleOCR engine (use_angle_cls=False, CPU)...")
        _ocr_engine = PaddleOCR(use_angle_cls=False, lang="en", use_gpu=False, show_log=False)
    return _ocr_engine


def sort_ocr_boxes(ocr_result):
    """
    Sort raw PaddleOCR line results into reading order (top-to-bottom,
    left-to-right). Each line is: [ [ [x1,y1],[x2,y2],[x3,y3],[x4,y4] ], (text, confidence) ]

    The merge threshold is derived from the MEDIAN box height across the
    whole page, not each bucket's own first box -- anchoring to a single
    box's height let one abnormally tall detection (a merged-line artifact,
    seen on some crops) swallow every subsequent line into its bucket, which
    then got resorted by horizontal position only and scrambled the whole
    page's reading order.
    """
    if not ocr_result:
        return []

    boxes = []
    for line in ocr_result:
        points = line[0]
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        boxes.append({
            'min_x': min_x,
            'center_y': (min_y + max_y) / 2,
            'height': max_y - min_y,
            'raw': line,
        })

    print(f"[sort_ocr_boxes] {len(boxes)} raw boxes detected. "
          f"Raw order center_y values (first 5): {[round(b['center_y'], 1) for b in boxes[:5]]}")

    boxes.sort(key=lambda b: b['center_y'])

    heights = sorted(b['height'] for b in boxes)
    median_height = heights[len(heights) // 2]
    merge_threshold = median_height * 0.6

    lines = []
    for box in boxes:
        placed = False
        for line in lines:
            if abs(box['center_y'] - line['anchor_center_y']) < merge_threshold:
                line['boxes'].append(box)
                placed = True
                break
        if not placed:
            lines.append({
                'anchor_center_y': box['center_y'],
                'boxes': [box],
            })

    lines.sort(key=lambda l: l['anchor_center_y'])

    if len(lines) >= 2:
        print(f"[sort_ocr_boxes] {len(lines)} lines grouped. "
              f"First line center_y={lines[0]['anchor_center_y']:.1f}, "
              f"last line center_y={lines[-1]['anchor_center_y']:.1f} "
              f"({'OK: increasing' if lines[0]['anchor_center_y'] <= lines[-1]['anchor_center_y'] else 'BUG: DECREASING -- reversed order!'})")

    sorted_raw = []
    for line in lines:
        line['boxes'].sort(key=lambda b: b['min_x'])
        for box in line['boxes']:
            sorted_raw.append(box['raw'])

    return sorted_raw


def image_to_lines(image_bytes: bytes) -> List[str]:
    """Preprocess + single OCR pass + sort. Returns a list of text lines
    in reading order. This is the one function both image_to_text() and
    image_to_docx_simple() build on -- keeping a single source of truth
    for ordering logic."""
    img = pre.preprocess(image_bytes)
    print(f"[simple_pipeline] Preprocessed image shape: {img.shape}")

    result = get_ocr_engine().ocr(img, cls=False)
    if not result or not result[0]:
        print("[simple_pipeline] PaddleOCR returned no detections.")
        return []

    print(f"[simple_pipeline] PaddleOCR returned {len(result[0])} raw detections.")
    sorted_result = sort_ocr_boxes(result[0])
    lines = [line[1][0] for line in sorted_result]
    print(f"[simple_pipeline] Final line count: {len(lines)}")
    return lines


def image_to_text(image_bytes: bytes) -> str:
    return "\n".join(image_to_lines(image_bytes))


def image_to_docx_simple(image_bytes: bytes) -> bytes:
    """
    Plain docx: one paragraph per detected line, default styling.
    No fonts/colors/tables/diagrams -- that's intentional for this MVP
    pass. Once ordering is confirmed correct on real documents, style
    and structure get layered back on top of this same line list.
    """
    lines = image_to_lines(image_bytes)

    doc = Document()
    for line in lines:
        if line.strip():
            doc.add_paragraph(line)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
