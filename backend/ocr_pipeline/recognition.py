"""Shared PaddleOCR recognition utilities for layout regions."""
from typing import Any

from paddleocr import PaddleOCR

_ocr_engine: PaddleOCR | None = None


def get_ocr_engine() -> PaddleOCR:
    global _ocr_engine
    if _ocr_engine is None:
        print("[recognition] Initializing PaddleOCR engine (CPU)...")
        _ocr_engine = PaddleOCR(use_angle_cls=False, lang="en", use_gpu=False, show_log=False)
    return _ocr_engine


def recognize_lines(image: Any) -> list:
    """Recognize an image crop and return lines in natural reading order."""
    result = get_ocr_engine().ocr(image, cls=False)
    if not result or not result[0]:
        return []

    boxes = []
    for line in result[0]:
        points = line[0]
        xs = [point[0] for point in points]
        ys = [point[1] for point in points]
        min_y, max_y = min(ys), max(ys)
        boxes.append({
            "min_x": min(xs),
            "center_y": (min_y + max_y) / 2,
            "height": max_y - min_y,
            "raw": line,
        })

    boxes.sort(key=lambda box: box["center_y"])
    median_height = sorted(box["height"] for box in boxes)[len(boxes) // 2]
    line_threshold = median_height * 0.6
    rows = []

    for box in boxes:
        for row in rows:
            if abs(box["center_y"] - row["center_y"]) < line_threshold:
                row["boxes"].append(box)
                break
        else:
            rows.append({"center_y": box["center_y"], "boxes": [box]})

    ordered = []
    for row in rows:
        ordered.extend(box["raw"] for box in sorted(row["boxes"], key=lambda box: box["min_x"]))
    return ordered
