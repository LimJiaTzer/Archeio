"""
Stage 2: Layout analysis
PP-StructureV2 (PaddleOCR's layout model) — CPU inference, no GPU required
at document-batch speeds. Detects regions and classifies them as
text / title / table / figure / list, each with a bounding box.
"""
from dataclasses import dataclass, field
from typing import Any, List, Optional
import numpy as np

from paddleocr import PPStructure


# Loaded once per process (module-level singleton) — model init is the
# expensive part, so we don't want to pay it per-request.
_engine: Optional[PPStructure] = None


def get_engine() -> PPStructure:
    global _engine
    if _engine is None:
        _engine = PPStructure(
            show_log=False,
            image_orientation=False,
            layout=True,
            table=True,          # table structure recognition is bundled here
            # PP-Structure's own per-region OCR (ocr=True) drops spaces
            # between words in its `res` text -- pipeline.py re-OCRs
            # text/title regions itself instead. Table HTML generation
            # (verified) is unaffected by this flag.
            ocr=False,
            use_gpu=False,       # explicit — this whole stage is CPU-only
        )
    return _engine


@dataclass
class Region:
    kind: str                         # Raw PP-Structure type.
    bbox: List[int]                   # [x1, y1, x2, y2]
    res: object = field(default=None) # Raw PP-Structure result for tables.
    order: int = 0                    # Reading-order index.
    role: str = "paragraph"          # heading | paragraph | list | table | figure
    text: str = ""                   # OCR text for text-bearing regions.
    alignment: str = "left"           # left | center | right
    style: Optional[Any] = None        # TextStyle, attached during enrichment.


def analyze_layout(img: np.ndarray) -> List[Region]:
    """Run PP-StructureV2 and return normalized Region objects, sorted
    top-to-bottom / left-to-right (a reasonable default reading order for
    single/two-column documents)."""
    engine = get_engine()
    result = engine(img)

    regions: List[Region] = []
    for item in result:
        bbox = item.get("bbox")
        kind = item.get("type", "text")
        regions.append(Region(kind=kind, bbox=bbox, res=item.get("res")))

    regions.sort(key=lambda r: (r.bbox[1], r.bbox[0]))
    for i, r in enumerate(regions):
        r.order = i

    return regions
