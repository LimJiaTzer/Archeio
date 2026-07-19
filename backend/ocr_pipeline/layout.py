"""
Stage 2: Layout analysis
The pipeline can read either PP-StructureV2's legacy output or the richer
PP-StructureV3 parsing output. V3 is selected with OCR_ENGINE=paddle_v3 and
will become the production default after its clean-environment benchmark.
"""
from dataclasses import dataclass, field
import os
from typing import Any, List, Optional
import numpy as np


# Loaded once per process (module-level singleton) — model init is the
# expensive part, so we don't want to pay it per-request.
_engine: Optional[Any] = None


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

            # Keep expensive optional capabilities off for the first rollout.
            # We retain detected charts/figures as source image crops; table
            # parsing stays on because it produces editable table content.
            _engine = PPStructureV3(
                device="cpu",
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
                # These are constructor options because V3 loads model
                # modules immediately. Passing False only to predict() is
                # too late and still downloads/initializes FormulaNet.
                use_formula_recognition=False,
                use_chart_recognition=False,
                use_table_recognition=True,
            )
        else:
            raise ValueError("OCR_ENGINE must be 'paddle_v3' or 'paddle_v2'.")
    return _engine


@dataclass
class Region:
    kind: str                         # Raw PP-Structure type.
    bbox: List[int]                   # [x1, y1, x2, y2]
    res: object = field(default=None) # Raw PP-Structure result for tables.
    order: int = 0                    # Reading-order index.
    page_index: int = 0               # Zero-based page number in the upload.
    confidence: Optional[float] = None # Layout model confidence, when supplied.
    role: str = "paragraph"          # heading | paragraph | list | table | figure
    heading_level: Optional[int] = None
    text: str = ""                   # OCR text for text-bearing regions.
    alignment: str = "left"           # left | center | right
    style: Optional[Any] = None        # TextStyle, attached during enrichment.
    image_bytes: Optional[bytes] = None # Cropped source pixels for figures.


def _prediction_payload(prediction: Any) -> dict:
    """Extract the JSON dictionary exposed by a PaddleOCR 3 result object."""
    payload = getattr(prediction, "json", prediction)
    if not isinstance(payload, dict):
        raise RuntimeError("PP-StructureV3 returned an unsupported result format.")
    return payload.get("res", payload)


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

    regions.sort(key=lambda r: (r.bbox[1], r.bbox[0]))
    for i, r in enumerate(regions):
        r.order = i

    return regions


def _analyze_v3(img: np.ndarray) -> List[Region]:
    """Normalize PP-StructureV3 blocks while preserving its reading order."""
    predictions = get_engine().predict(
        img,
        use_formula_recognition=False,
        use_chart_recognition=False,
        use_table_recognition=True,
        format_block_content=True,
    )
    try:
        prediction = next(iter(predictions))
    except StopIteration:
        return []

    payload = _prediction_payload(prediction)
    blocks = payload.get("parsing_res_list", [])
    regions: List[Region] = []
    for fallback_order, block in enumerate(blocks):
        bbox = block.get("block_bbox")
        if bbox is None or len(bbox) != 4:
            continue
        content = block.get("block_content", "") or ""
        kind = block.get("block_label", "text")
        order = block.get("block_order")
        regions.append(Region(
            kind=kind,
            bbox=[int(value) for value in bbox],
            # The V3 table block content is Markdown/HTML depending on the
            # selected formatter. The builder handles both representations.
            res={"content": content},
            text=content if kind not in {"table", "image", "chart"} else "",
            order=int(order) if order is not None else fallback_order,
        ))

    regions.sort(key=lambda region: region.order)
    return regions


def analyze_layout(img: np.ndarray) -> List[Region]:
    """Run the configured layout engine and return normalized regions."""
    if selected_engine() == "paddle_v3":
        return _analyze_v3(img)
    return _analyze_v2(img)
