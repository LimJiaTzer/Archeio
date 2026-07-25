"""Canonical document representation shared by OCR inputs and exporters."""
from dataclasses import dataclass, field
from typing import Any, List, Optional


@dataclass
class NativeTextSpan:
    text: str
    bbox: List[float]
    font_size_pt: float
    font_family: str = ""
    color_rgb: tuple[int, int, int] = (0, 0, 0)
    bold: bool = False
    italic: bool = False
    highlight_rgb: Optional[tuple[int, int, int]] = None
    confidence: float = 1.0


@dataclass
class NativeTextLine:
    bbox: List[float]
    spans: List[NativeTextSpan]
    block_index: int

    @property
    def text(self) -> str:
        return "".join(span.text for span in self.spans).strip()


@dataclass
class NativeTable:
    bbox: List[float]
    rows: List[List[str]]


@dataclass
class PageInput:
    image_bytes: bytes
    page_index: int = 0
    native_lines: List[NativeTextLine] = field(default_factory=list)
    native_tables: List[NativeTable] = field(default_factory=list)
    # DPI of image_bytes before preprocessing. Scanned pages may be upscaled
    # for OCR; the pipeline derives an effective working DPI from that scale.
    dpi: float = 200.0
    preserve_geometry: bool = False


@dataclass
class Region:
    kind: str
    bbox: List[int]
    res: object = field(default=None)
    order: float = 0
    page_index: int = 0
    confidence: Optional[float] = None
    ocr_confidence: Optional[float] = None
    role: str = "paragraph"
    heading_level: Optional[int] = None
    text: str = ""
    alignment: str = "left"
    style: Optional[Any] = None
    image_bytes: Optional[bytes] = None
    native_text: bool = False
    source: str = "ocr"
    lines: List[NativeTextLine] = field(default_factory=list)
    formula_latex: str = ""
    metadata: dict = field(default_factory=dict)


@dataclass
class PageIR:
    page_index: int
    regions: List[Region]


@dataclass
class DocumentIR:
    pages: List[PageIR]
