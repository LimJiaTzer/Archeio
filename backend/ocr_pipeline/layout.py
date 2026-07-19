"""
Stage 2: Layout analysis
The pipeline can read either PP-StructureV2's legacy output or the richer
PP-StructureV3 parsing output. V3 is selected with OCR_ENGINE=paddle_v3 and
will become the production default after its clean-environment benchmark.
"""
import json
import math
import os
from collections.abc import Iterable, Mapping, Sequence
from typing import Any, List, Optional
import numpy as np

from .models import Region
from .reading_order import reading_order


# Loaded once per process (module-level singleton) — model init is the
# expensive part, so we don't want to pay it per-request.
_engine: Optional[Any] = None


def _env_flag(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() not in {"0", "false", "no", "off"}


def formula_recognition_enabled() -> bool:
    """FormulaNet is accurate but expensive, so expose an explicit switch."""
    return _env_flag("OCR_ENABLE_FORMULA_RECOGNITION", True)


def text_detection_limit() -> int:
    """Bound the OCR detector resize while allowing a dense-scan profile."""
    try:
        configured = int(os.getenv("OCR_TEXT_DET_LIMIT_SIDE_LEN", "2048"))
    except ValueError:
        configured = 2048
    return max(960, min(4096, configured))


def selected_engine() -> str:
    """Return an explicit engine, or select the installed PaddleOCR generation."""
    configured = os.getenv("OCR_ENGINE")
    if configured:
        return configured.strip().lower()

    # This lets the current V2 virtual environment keep running while a fresh
    # V3 environment automatically uses the new parser after installation.
    import paddleocr
    return "paddle_v3" if hasattr(paddleocr, "PPStructureV3") else "paddle_v2"


def get_engine() -> Any:
    global _engine
    if _engine is None:
        if selected_engine() == "paddle_v2":
            from paddleocr import PPStructure
            _engine = PPStructure(
                show_log=False,
                image_orientation=False,
                layout=True,
                table=True,
                ocr=False,
                use_gpu=False,
            )
        elif selected_engine() == "paddle_v3":
            try:
                from paddleocr import PPStructureV3
            except ImportError as exc:
                raise RuntimeError(
                    "PaddleOCR 3.x is required for OCR_ENGINE=paddle_v3. "
                    "Install backend/requirements.txt in a fresh virtual environment."
                ) from exc

            # Charts stay as exact source crops. Formula recognition is enabled
            # by default for accurate math and can be disabled for a fast CPU
            # profile with OCR_ENABLE_FORMULA_RECOGNITION=false.
            _engine = PPStructureV3(
                device=os.getenv("OCR_DEVICE", "cpu"),
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
                # These are constructor options because V3 loads model
                # modules immediately. Passing False only to predict() is
                # too late and still downloads/initializes FormulaNet.
                use_formula_recognition=formula_recognition_enabled(),
                use_chart_recognition=False,
                use_table_recognition=True,
            )
        else:
            raise ValueError("OCR_ENGINE must be 'paddle_v3' or 'paddle_v2'.")
    return _engine


def _json_value(value: Any) -> Any:
    """Resolve callable/JSON-text result values without assuming one API shape."""
    if callable(value):
        try:
            value = value()
        except TypeError:
            return None
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return None
    return value


def _mapping_value(value: Any) -> Mapping[str, Any] | None:
    """Normalize a Paddle result-like value into a mapping when possible."""
    candidates = [value]
    if not isinstance(value, Mapping):
        candidates.extend([getattr(value, "json", None), getattr(value, "to_dict", None)])

    for candidate in candidates:
        candidate = _json_value(candidate)
        if not isinstance(candidate, Mapping):
            continue
        # Paddle's JSON properties conventionally wrap their actual fields in
        # a single ``res`` key. Only unwrap a pure wrapper so a legitimate
        # domain field named ``res`` is not discarded.
        while set(candidate) == {"res"}:
            nested = _json_value(candidate.get("res"))
            if not isinstance(nested, Mapping):
                break
            candidate = nested
        return candidate
    return None


def _as_items(value: Any) -> list[Any]:
    """Materialize sequence-like Paddle fields without NumPy truth testing."""
    value = _json_value(value)
    if value is None:
        return []
    if hasattr(value, "tolist"):
        value = value.tolist()
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return list(value)
    if isinstance(value, Iterable) and not isinstance(value, (Mapping, str, bytes, bytearray)):
        return list(value)
    return []


def _mapping_items(value: Any) -> list[Mapping[str, Any]]:
    """Return only valid mapping records from a result list."""
    items = []
    for item in _as_items(value):
        mapping = _mapping_value(item)
        if mapping is not None:
            items.append(mapping)
    return items


def _first_present(mapping: Mapping[str, Any], *keys: str) -> Any:
    """Read the first non-None field without truth testing NumPy arrays."""
    for key in keys:
        value = mapping.get(key)
        if value is not None:
            return value
    return None


def _prediction_payload(prediction: Any) -> Mapping[str, Any]:
    """Extract a PP-StructureV3 payload across PaddleOCR result variants."""
    # PaddleX result classes inherit from ``dict``, but their raw mapping can
    # contain LayoutBlock objects. Prefer their JSON projection, which exposes
    # those blocks as stable dictionaries, before falling back to the mapping.
    candidates = [
        getattr(prediction, "json", None),
        getattr(prediction, "to_dict", None),
        prediction,
    ]
    for candidate in candidates:
        payload = _mapping_value(candidate)
        if payload is not None:
            # Remote/service adapters sometimes retain status metadata beside
            # the conventional ``res`` wrapper.
            nested = _mapping_value(payload.get("res"))
            if nested is not None:
                payload = nested
            return payload
    raise RuntimeError("PP-StructureV3 returned an unsupported result format.")


def _finite_float(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _bbox_iou(first: list, second: list) -> float:
    """Return intersection-over-union for two rectangular boxes."""
    ax1, ay1, ax2, ay2 = [float(value) for value in first]
    bx1, by1, bx2, by2 = [float(value) for value in second]
    width = max(0.0, min(ax2, bx2) - max(ax1, bx1))
    height = max(0.0, min(ay2, by2) - max(ay1, by1))
    intersection = width * height
    if not intersection:
        return 0.0
    first_area = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    second_area = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = first_area + second_area - intersection
    return intersection / union if union else 0.0


def _matching_layout_box(
    payload: Mapping[str, Any],
    kind: str,
    bbox: list,
) -> Mapping[str, Any] | None:
    """Match a parsed block to the detector record that owns its score."""
    layout_result = _mapping_value(payload.get("layout_det_res"))
    boxes = _mapping_items(layout_result.get("boxes")) if layout_result else []
    best_box = None
    best_score = 0.0
    for candidate in boxes:
        candidate_bbox = _box_from_coordinates(
            _first_present(candidate, "coordinate", "bbox")
        )
        if candidate_bbox is None:
            continue
        overlap = _bbox_iou(bbox, candidate_bbox)
        label = candidate.get("label") or candidate.get("type")
        # Labels disambiguate nearby captions and assets. Still permit a
        # geometry-only match because model versions sometimes rename labels.
        rank = overlap + (1.0 if label == kind else 0.0)
        if overlap > 0.05 and rank > best_score:
            best_box = candidate
            best_score = rank
    return best_box


def _matching_result(items: object, bbox: list) -> Mapping[str, Any] | None:
    """Find table/formula output whose geometry overlaps a parsed block."""
    best = None
    best_overlap = 0.0
    for item in _mapping_items(items):
        candidate_bbox = _box_from_coordinates(
            _first_present(
                item,
                "bbox",
                "coordinate",
                "table_bbox",
                "formula_bbox",
                "dt_polys",
            )
        )
        if candidate_bbox is None:
            continue
        overlap = _bbox_iou(bbox, candidate_bbox)
        if overlap > best_overlap:
            best = item
            best_overlap = overlap
    return best if best_overlap > 0.05 else None


def _mean_scores(result: Mapping[str, Any] | None) -> float | None:
    if not result:
        return None
    ocr_result = _mapping_value(result.get("table_ocr_pred")) or result
    scores = _as_items(ocr_result.get("rec_scores"))
    values = []
    for score in scores:
        number = _finite_float(score)
        if number is not None:
            values.append(number)
    return sum(values) / len(values) if values else None


def _box_from_coordinates(value: object) -> list[float] | None:
    if hasattr(value, "tolist"):
        value = value.tolist()
    if not isinstance(value, (list, tuple)):
        return None
    # Formula JSON in some PaddleX releases serializes ``dt_polys`` as a
    # one-element tuple containing the rectangular box.
    while len(value) == 1 and isinstance(value[0], (list, tuple)):
        value = value[0]
    if len(value) == 4:
        coordinates = [_finite_float(item) for item in value]
        if all(item is not None for item in coordinates):
            return coordinates
    points = value
    if len(points) == 8 and all(_finite_float(item) is not None for item in points):
        points = [points[index:index + 2] for index in range(0, 8, 2)]
    if not points or not all(isinstance(point, (list, tuple)) and len(point) >= 2 for point in points):
        return None
    xs = [_finite_float(point[0]) for point in points]
    ys = [_finite_float(point[1]) for point in points]
    if any(value is None for value in (*xs, *ys)):
        return None
    return [min(xs), min(ys), max(xs), max(ys)]


def _page_ocr_lines(payload: Mapping[str, Any]) -> tuple[bool, list[dict]]:
    """Normalize PP-Structure's page OCR once before assigning block owners."""
    ocr = _mapping_value(payload.get("overall_ocr_res"))
    if ocr is None:
        return False, []
    def values(key: str) -> list:
        return _as_items(ocr.get(key))

    texts = values("rec_texts")
    scores = values("rec_scores")
    coordinates = []
    for key in ("rec_polys", "dt_polys", "rec_boxes"):
        coordinates = values(key)
        if coordinates:
            break
    lines: list[dict] = []
    for index, text in enumerate(texts):
        if index >= len(coordinates) or not str(text).strip():
            continue
        line_bbox = _box_from_coordinates(coordinates[index])
        if line_bbox is None:
            continue
        confidence = _finite_float(scores[index]) if index < len(scores) else None
        lines.append({
            "bbox": line_bbox,
            "text": str(text).strip(),
            "confidence": confidence,
        })
    return True, lines


_NON_TEXT_BLOCK_LABELS = {
    "table",
    "formula",
    "image",
    "chart",
    "figure",
    "flowchart",
    "seal",
    "header_image",
    "footer_image",
}


def _line_coverage(line_bbox: list, block_bbox: list) -> float:
    """Return the fraction of an OCR line covered by a parsing block."""
    x1, y1, x2, y2 = [float(value) for value in line_bbox]
    bx1, by1, bx2, by2 = [float(value) for value in block_bbox]
    area = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    if not area:
        return 0.0
    intersection = max(0.0, min(x2, bx2) - max(x1, bx1)) * max(
        0.0, min(y2, by2) - max(y1, by1)
    )
    return intersection / area


def _assign_ocr_lines_to_blocks(
    payload: Mapping[str, Any],
    blocks: list[Mapping[str, Any]],
) -> tuple[bool, dict[int, list[dict]]]:
    """Assign each page OCR line to at most one text-bearing parsing block.

    Parsing output can contain nested/overlapping boxes. Independent matching
    duplicates a title in both its small title box and a large text container,
    so ownership is resolved globally and the smallest adequate block wins.
    """
    available, lines = _page_ocr_lines(payload)
    assignments = {index: [] for index in range(len(blocks))}
    if not available:
        return False, assignments

    candidates = []
    for index, block in enumerate(blocks):
        bbox = _box_from_coordinates(block.get("block_bbox"))
        kind = block.get("block_label", "text")
        if (
            kind in _NON_TEXT_BLOCK_LABELS
            or bbox is None
            or len(bbox) != 4
        ):
            continue
        area = max(1.0, float(bbox[2] - bbox[0]) * float(bbox[3] - bbox[1]))
        candidates.append((index, bbox, area))

    for line in lines:
        line_bbox = line["bbox"]
        center_x = (line_bbox[0] + line_bbox[2]) / 2
        center_y = (line_bbox[1] + line_bbox[3]) / 2
        owners = []
        for index, bbox, area in candidates:
            coverage = _line_coverage(line_bbox, bbox)
            inside = (
                bbox[0] - 4 <= center_x <= bbox[2] + 4
                and bbox[1] - 4 <= center_y <= bbox[3] + 4
            )
            if not inside and coverage < 0.2:
                continue
            owners.append(((int(inside), coverage, -area), index))
        if owners:
            _, owner = max(owners, key=lambda candidate: candidate[0])
            assignments[owner].append(line)

    for index, assigned in assignments.items():
        assignments[index] = reading_order(assigned, lambda line: line["bbox"])
    return True, assignments


def _block_content_is_shadowed(
    block_index: int,
    blocks: list[Mapping[str, Any]],
    assignments: dict[int, list[dict]],
) -> bool:
    """Detect parser content already owned by a nested overlapping block."""
    if assignments.get(block_index):
        return False
    block = blocks[block_index]
    bbox = _box_from_coordinates(block.get("block_bbox"))
    content = "".join(
        character.lower()
        for character in str(block.get("block_content", ""))
        if character.isalnum()
    )
    if not bbox or len(content) < 4:
        return False

    overlapping_text = []
    for owner, lines in assignments.items():
        if owner == block_index:
            continue
        for line in lines:
            if _line_coverage(line["bbox"], bbox) >= 0.5:
                overlapping_text.append(line["text"])
    candidate = "".join(
        character.lower()
        for character in " ".join(overlapping_text)
        if character.isalnum()
    )
    if not candidate:
        return False
    shorter, longer = sorted((content, candidate), key=len)
    return len(shorter) / len(longer) >= 0.8 and shorter in longer


def _column_reading_order(regions: List[Region], page_width: int) -> List[Region]:
    """Order fallback output vertically within left-to-right columns."""
    del page_width  # Geometry supplies the effective page span.
    return reading_order(regions, lambda region: region.bbox)


def _analyze_v2(img: np.ndarray) -> List[Region]:
    """Normalize the legacy PP-StructureV2 list-of-dictionaries response."""
    result = get_engine()(img)

    regions: List[Region] = []
    for item in result:
        bbox = item.get("bbox")
        if not bbox or len(bbox) != 4:
            continue
        kind = item.get("type", "text")
        score = item.get("score")
        regions.append(Region(
            kind=kind,
            bbox=[int(value) for value in bbox],
            res=item.get("res"),
            confidence=float(score) if score is not None else None,
        ))

    regions = _column_reading_order(regions, img.shape[1])
    for i, r in enumerate(regions):
        r.order = i

    return regions


def _analyze_v3(img: np.ndarray) -> List[Region]:
    """Normalize PP-StructureV3 blocks while preserving its reading order."""
    predictions = get_engine().predict(
        img,
        use_formula_recognition=formula_recognition_enabled(),
        use_chart_recognition=False,
        use_table_recognition=True,
        # Markdown formatting turns formula-image references into HTML strings
        # (for example `<div><img ...>`). The DOCX builder consumes raw block
        # content and source crops instead, so do not inject presentation markup.
        format_block_content=False,
        # The default detector limit is 960px, which needlessly downsamples
        # dense notes and multi-column sheets before OCR.
        text_det_limit_side_len=text_detection_limit(),
        text_det_limit_type="max",
    )
    try:
        prediction = next(iter(predictions))
    except StopIteration:
        return []

    payload = _prediction_payload(prediction)
    blocks = _mapping_items(payload.get("parsing_res_list"))
    overall_ocr_available, ocr_assignments = _assign_ocr_lines_to_blocks(payload, blocks)
    regions: List[Region] = []
    structured_indexes = {"table": 0, "formula": 0}
    for fallback_order, block in enumerate(blocks):
        bbox = _box_from_coordinates(block.get("block_bbox"))
        if bbox is None:
            continue
        content = block.get("block_content", "") or ""
        kind = str(block.get("block_label", "text")).lower()
        order = block.get("block_order")
        detector_box = _matching_layout_box(payload, kind, bbox)
        score = detector_box.get("score") if detector_box else None
        structured_result = None
        if kind == "table":
            structured_items = _mapping_items(payload.get("table_res_list"))
            structured_result = _matching_result(structured_items, bbox)
            if structured_result is None and structured_indexes[kind] < len(structured_items):
                structured_result = structured_items[structured_indexes[kind]]
            structured_indexes[kind] += 1
        elif kind == "formula":
            structured_items = _mapping_items(payload.get("formula_res_list"))
            structured_result = _matching_result(structured_items, bbox)
            if structured_result is None and structured_indexes[kind] < len(structured_items):
                structured_result = structured_items[structured_indexes[kind]]
            structured_indexes[kind] += 1

        result = {"content": content}
        if structured_result:
            result["structured"] = structured_result
            result["html"] = structured_result.get("pred_html", "") or ""
        normalized_order = _finite_float(order)
        normalized_score = _finite_float(score)
        regions.append(Region(
            kind=kind,
            bbox=[int(value) for value in bbox],
            # The V3 table block content is Markdown/HTML depending on the
            # selected formatter. The builder handles both representations.
            res=result,
            text=content if kind not in {"table", "image", "chart"} else "",
            formula_latex=((structured_result or {}).get("rec_formula") or content) if kind == "formula" else "",
            order=int(normalized_order) if normalized_order is not None else fallback_order,
            confidence=normalized_score,
            ocr_confidence=_mean_scores(structured_result) if kind == "table" else None,
            metadata={
                "block_id": block.get("block_id"),
                "paddle_order": int(normalized_order) if normalized_order is not None else None,
                "layout_detection": detector_box or {},
                "paddle_ocr_available": overall_ocr_available,
                "paddle_ocr_lines": ocr_assignments.get(fallback_order, []),
                "paddle_block_content_shadowed": _block_content_is_shadowed(
                    fallback_order,
                    blocks,
                    ocr_assignments,
                ),
            },
        ))

    paddle_orders = [region.metadata.get("paddle_order") for region in regions]
    if (
        all(order is not None for order in paddle_orders)
        and len(set(paddle_orders)) == len(paddle_orders)
    ):
        regions.sort(key=lambda region: region.metadata["paddle_order"])
    else:
        regions = _column_reading_order(regions, img.shape[1])
    for order, region in enumerate(regions):
        region.order = order
    return regions


def analyze_layout(img: np.ndarray) -> List[Region]:
    """Run the configured layout engine and return normalized regions."""
    if selected_engine() == "paddle_v3":
        return _analyze_v3(img)
    return _analyze_v2(img)
