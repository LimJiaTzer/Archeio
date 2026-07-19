"""Version-tolerant PaddleOCR text recognition utilities.

PaddleOCR 2.x returns nested ``[polygon, (text, score)]`` records, while
PaddleOCR 3.x returns ``OCRResult`` objects (or dictionaries) containing
parallel ``rec_texts``, ``rec_scores`` and polygon/box arrays.  The rest of
the application should not need to know which PaddleOCR generation is
installed, so this module normalizes both forms into a stable dictionary.
"""
from __future__ import annotations

import json
import math
import os
from collections.abc import Iterable, Mapping, Sequence
from typing import Any

from paddleocr import PaddleOCR

from .reading_order import reading_order

_ocr_engine: PaddleOCR | None = None


def get_ocr_engine() -> PaddleOCR:
    """Create the installed PaddleOCR generation with CPU-safe arguments."""
    global _ocr_engine
    if _ocr_engine is None:
        print("[recognition] Initializing PaddleOCR engine (CPU)...")
        device = os.getenv("OCR_DEVICE", "cpu")
        try:
            # PaddleOCR 3.x removed ``use_gpu``/``show_log`` and exposes the
            # preprocessing switches under these names.
            _ocr_engine = PaddleOCR(
                lang="en",
                device=device,
                # PP-StructureV3 already uses these cached models. Pinning the
                # fallback avoids PaddleOCR 3.7 silently downloading PP-OCRv6.
                text_detection_model_name="PP-OCRv5_server_det",
                text_recognition_model_name="PP-OCRv5_server_rec",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
        except TypeError:
            # PaddleOCR 2.x constructor.  This branch is intentionally kept
            # local so version checks never leak into pipeline code.
            _ocr_engine = PaddleOCR(
                use_angle_cls=False,
                lang="en",
                use_gpu=device.lower().startswith("gpu"),
                show_log=False,
            )
    return _ocr_engine


def _json_value(value: Any) -> Any:
    if callable(value):
        value = value()
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return value


def _mapping_payload(value: Any) -> Mapping[str, Any] | None:
    """Return the recognition payload from a 3.x OCRResult-like value."""
    if isinstance(value, Mapping):
        payload: Any = value
    else:
        payload = _json_value(getattr(value, "json", None))
        if payload is None:
            payload = _json_value(getattr(value, "to_dict", None))

    if not isinstance(payload, Mapping):
        return None

    # ``OCRResult.json`` wraps the actual fields in ``res``. PP-Structure
    # results may place them in ``overall_ocr_res`` instead.
    while isinstance(payload, Mapping):
        if any(key in payload for key in ("rec_texts", "texts")):
            return payload
        nested = payload.get("res")
        if isinstance(nested, Mapping):
            payload = nested
            continue
        nested = payload.get("overall_ocr_res")
        if isinstance(nested, Mapping):
            payload = nested
            continue
        return None
    return None


def _as_items(value: Any) -> list[Any]:
    """Convert Python/numpy sequence-like values without truth testing them."""
    if value is None:
        return []
    if hasattr(value, "tolist"):
        value = value.tolist()
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return list(value)
    if isinstance(value, Iterable) and not isinstance(value, (Mapping, str, bytes, bytearray)):
        return list(value)
    return []


def _first_sequence(payload: Mapping[str, Any], *keys: str) -> list[Any]:
    for key in keys:
        if key in payload:
            values = _as_items(payload[key])
            if values:
                return values
    return []


def _finite_float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _polygon_from_value(value: Any) -> list[list[float]]:
    values = _as_items(value)
    if len(values) == 4 and all(not _as_items(item) for item in values):
        x1, y1, x2, y2 = (_finite_float(item) for item in values)
        if None not in (x1, y1, x2, y2):
            return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]

    if len(values) == 8 and all(not _as_items(item) for item in values):
        values = [values[index:index + 2] for index in range(0, 8, 2)]

    polygon: list[list[float]] = []
    for point in values:
        coordinates = _as_items(point)
        if len(coordinates) < 2:
            return []
        x = _finite_float(coordinates[0])
        y = _finite_float(coordinates[1])
        if x is None or y is None:
            return []
        polygon.append([x, y])
    return polygon if len(polygon) >= 2 else []


def _normalized_line(
    text: Any,
    confidence: Any,
    coordinates: Any,
) -> dict[str, Any] | None:
    text = str(text).strip() if text is not None else ""
    if not text:
        return None

    polygon = _polygon_from_value(coordinates)
    if polygon:
        xs = [point[0] for point in polygon]
        ys = [point[1] for point in polygon]
        bbox = [min(xs), min(ys), max(xs), max(ys)]
    else:
        bbox = [0.0, 0.0, 0.0, 0.0]

    return {
        "bbox": bbox,
        "polygon": polygon,
        "text": text,
        "confidence": _finite_float(confidence),
    }


def _lines_from_v3(payload: Mapping[str, Any]) -> list[dict[str, Any]]:
    texts = _first_sequence(payload, "rec_texts", "texts")
    scores = _first_sequence(payload, "rec_scores", "scores")
    coordinates = _first_sequence(
        payload,
        "rec_polys",
        "dt_polys",
        "polys",
        "rec_boxes",
        "boxes",
    )

    lines = []
    for index, text in enumerate(texts):
        line = _normalized_line(
            text,
            scores[index] if index < len(scores) else None,
            coordinates[index] if index < len(coordinates) else None,
        )
        if line is not None:
            lines.append(line)
    return lines


def _legacy_line(value: Any) -> dict[str, Any] | None:
    values = _as_items(value)
    if len(values) < 2:
        return None
    polygon = _polygon_from_value(values[0])
    if not polygon:
        return None

    recognition = values[1]
    if isinstance(recognition, Mapping):
        text = recognition.get("text")
        confidence = recognition.get("confidence", recognition.get("score"))
    else:
        recognition_values = _as_items(recognition)
        if not recognition_values:
            return None
        text = recognition_values[0]
        confidence = recognition_values[1] if len(recognition_values) > 1 else None
    return _normalized_line(text, confidence, polygon)


def normalize_ocr_result(result: Any) -> list[dict[str, Any]]:
    """Normalize one complete PaddleOCR result into recognition lines."""
    payload = _mapping_payload(result)
    if payload is not None:
        return _lines_from_v3(payload)

    # Materialize generators once. PaddleOCR 3.x commonly yields results from
    # ``predict`` and probing the same iterator twice would consume it.
    items = _as_items(result)
    legacy = _legacy_line(items)
    if legacy is not None:
        return [legacy]

    lines: list[dict[str, Any]] = []
    for item in items:
        lines.extend(normalize_ocr_result(item))
    return lines


def _reading_order(lines: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Order rows vertically within each left-to-right column."""
    return reading_order(lines, lambda line: line["bbox"])


def recognize_lines(image: Any) -> list[dict[str, Any]]:
    """Recognize an image crop using a stable, confidence-bearing schema."""
    engine = get_ocr_engine()
    predict = getattr(engine, "predict", None)
    if callable(predict):
        result = predict(image)
    else:
        # PaddleOCR 2.x only exposes ``ocr``.
        result = engine.ocr(image, cls=False)
    return _reading_order(normalize_ocr_result(result))
