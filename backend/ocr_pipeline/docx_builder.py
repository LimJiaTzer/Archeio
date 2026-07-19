"""
Stage 7: Document assembly.
Takes the ordered list of Regions (with OCR text + style attached) and
writes a real .docx using python-docx. Tables come in as HTML from
PP-Structure's table module and get mapped to native docx tables.
"""
import io
from typing import List
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from bs4 import BeautifulSoup
from PIL import Image

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


def _add_table_from_markdown(doc: Document, markdown: str):
    """Convert the simple pipe-table format emitted by PP-StructureV3."""
    rows = []
    for line in markdown.splitlines():
        line = line.strip()
        if "|" not in line:
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        # Markdown's second separator row contains only dashes/alignment hints.
        if cells and all(cell.replace(":", "").replace("-", "") == "" for cell in cells):
            continue
        rows.append(cells)

    if not rows:
        return
    table = doc.add_table(rows=len(rows), cols=max(len(row) for row in rows))
    table.style = "Table Grid"
    for row_index, row in enumerate(rows):
        for column_index, value in enumerate(row):
            table.cell(row_index, column_index).text = value


def _add_figure(doc: Document, region: Region) -> None:
    """Embed a detected figure/logo as source pixels, scaled to the page."""
    if not region.image_bytes:
        return

    section = doc.sections[-1]
    max_width = section.page_width - section.left_margin - section.right_margin
    with Image.open(io.BytesIO(region.image_bytes)) as image:
        # The OCR working image is 200 DPI for PDFs (and upscaled to a similar
        # resolution for small scans). Retaining that scale prevents a small
        # logo from becoming a page-width banner while still fitting large
        # figures within Word's printable area.
        preferred_width = Inches(max(0.35, image.width / 200))
    paragraph = doc.add_paragraph()
    paragraph.alignment = {
        "center": WD_ALIGN_PARAGRAPH.CENTER,
        "right": WD_ALIGN_PARAGRAPH.RIGHT,
    }.get(region.alignment, WD_ALIGN_PARAGRAPH.LEFT)
    paragraph.add_run().add_picture(
        io.BytesIO(region.image_bytes),
        width=min(preferred_width, max_width),
    )


def add_regions_to_docx(doc: Document, regions: List[Region]) -> None:
    """Append one OCR page's regions to an existing document."""
    for region in regions:
        if region.role == "table":
            content = region.res or {}
            html = content.get("html", "") if isinstance(content, dict) else ""
            if not html and isinstance(content, dict):
                html = content.get("content", "")
            if html:
                if "<table" in html.lower():
                    _add_table_from_html(doc, html)
                else:
                    _add_table_from_markdown(doc, html)
            continue

        if region.role == "figure":
            _add_figure(doc, region)
            continue

        text = region.text.strip()
        if not text:
            continue

        para = doc.add_paragraph()
        if region.role == "heading":
            level = min(max(region.heading_level or 1, 1), 3)
            para.style = doc.styles[f"Heading {level}"]
        elif region.role == "list":
            para.style = doc.styles["List Bullet"]
        para.alignment = {
            "center": WD_ALIGN_PARAGRAPH.CENTER,
            "right": WD_ALIGN_PARAGRAPH.RIGHT,
            "justify": WD_ALIGN_PARAGRAPH.JUSTIFY,
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
