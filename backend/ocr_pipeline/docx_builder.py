"""
Stage 7: Document assembly.
Takes the ordered list of Regions (with OCR text + style attached) and
writes a real .docx using python-docx. Tables come in as HTML from
PP-Structure's table module and get mapped to native docx tables.
"""
import io
from typing import List
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from bs4 import BeautifulSoup

from .layout import Region
from .style import TextStyle


def _apply_run_style(run, style: TextStyle):
    run.font.size = Pt(style.font_size_pt)
    run.font.bold = style.bold
    run.font.italic = style.italic_guess
    r, g, b = style.color_rgb
    run.font.color.rgb = RGBColor(r, g, b)


def _add_table_from_html(doc: Document, html: str):
    """PP-Structure table output is HTML; parse rows/cells and build a
    native docx table so it stays editable."""
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.find_all("tr")
    if not rows:
        return

    n_cols = max(len(r.find_all(["td", "th"])) for r in rows)
    table = doc.add_table(rows=len(rows), cols=n_cols)
    table.style = "Table Grid"

    for i, row in enumerate(rows):
        cells = row.find_all(["td", "th"])
        for j, cell in enumerate(cells):
            # colspan/rowspan merging is a known gap for v1 — most simple
            # tables don't need it; revisit if your documents do
            table.cell(i, j).text = cell.get_text(strip=True)


def add_regions_to_docx(doc: Document, regions: List[Region]) -> None:
    """Append one OCR page's regions to an existing document."""
    for region in regions:
        if region.role == "table":
            html = (region.res or {}).get("html", "") if isinstance(region.res, dict) else ""
            if html:
                _add_table_from_html(doc, html)
            continue

        if region.role == "figure":
            # Phase 1: figures/diagrams stay as a placeholder paragraph.
            # Diagram→editable-shape reconstruction is Phase 3.
            doc.add_paragraph("[figure — diagram reconstruction pending]")
            continue

        text = region.text.strip()
        if not text:
            continue

        para = doc.add_paragraph()
        if region.role == "heading":
            para.style = doc.styles["Heading 1"]
        elif region.role == "list":
            para.style = doc.styles["List Bullet"]
        para.alignment = {
            "center": WD_ALIGN_PARAGRAPH.CENTER,
            "right": WD_ALIGN_PARAGRAPH.RIGHT,
        }.get(region.alignment, WD_ALIGN_PARAGRAPH.LEFT)

        run = para.add_run(text)
        if region.style:
            _apply_run_style(run, region.style)


def build_docx(regions: List[Region]) -> bytes:
    """Build a DOCX from one OCR page's ordered regions."""
    doc = Document()
    add_regions_to_docx(doc, regions)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
