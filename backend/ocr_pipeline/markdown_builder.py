"""Optional Markdown projection of the canonical structured document IR."""
from dataclasses import dataclass, field
import re

from bs4 import BeautifulSoup

from .models import DocumentIR, Region


@dataclass
class MarkdownExport:
    markdown: str
    assets: dict[str, bytes] = field(default_factory=dict)


def _table_html_to_markdown(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    rows = []
    for row in soup.find_all("tr"):
        cells = [
            cell.get_text(" ", strip=True)
            for cell in row.find_all(["th", "td"], recursive=False)
        ]
        if cells:
            rows.append(cells)
    return _table_rows_to_markdown(rows)


def _table_rows_to_markdown(rows: object) -> str:
    """Render native/Paddle cell arrays without leaking Python or HTML syntax."""
    if not isinstance(rows, (list, tuple)):
        return ""
    normalized = []
    for row in rows:
        if not isinstance(row, (list, tuple)):
            continue
        normalized.append([
            str(cell if cell is not None else "")
            .replace("\r\n", "\n")
            .replace("\r", "\n")
            .replace("\n", "<br>")
            .replace("|", "\\|")
            .strip()
            for cell in row
        ])
    if not normalized or not any(any(cell for cell in row) for row in normalized):
        return ""
    width = max(len(row) for row in normalized)
    normalized = [row + [""] * (width - len(row)) for row in normalized]
    rendered = ["| " + " | ".join(normalized[0]) + " |"]
    rendered.append("| " + " | ".join(["---"] * width) + " |")
    rendered.extend("| " + " | ".join(row) + " |" for row in normalized[1:])
    return "\n".join(rendered)


def _asset(region: Region, index: int, assets: dict[str, bytes]) -> str:
    if not region.image_bytes:
        return ""
    name = f"page-{region.page_index + 1}-region-{index + 1}.png"
    assets[name] = region.image_bytes
    label = "Formula" if region.role == "formula" else "Figure"
    return f"![{label}]({name})"


def _region_markdown(region: Region, index: int, assets: dict[str, bytes]) -> str:
    text = region.text.strip()
    if region.role == "document_title":
        return f"# {text}" if text else ""
    if region.role == "heading":
        return f"{'#' * min(max(region.heading_level or 1, 1), 6)} {text}" if text else ""
    if region.role == "list":
        lines = [line.text for line in region.lines] if region.lines else text.splitlines()
        rendered = []
        for line in lines:
            value = line.strip()
            if not value:
                continue
            if re.match(r"^(?:[\u2022\u25e6\u25aa*+-]|\d+[.)]|[A-Za-z][.)])\s+", value):
                rendered.append(value)
            else:
                rendered.append(f"- {value}")
        return "\n".join(rendered)
    if region.role == "table":
        result = region.res if isinstance(region.res, dict) else {}
        native_rows = _table_rows_to_markdown(result.get("rows"))
        if native_rows:
            return native_rows
        content = result.get("html") or result.get("content") or ""
        if not isinstance(content, str):
            return ""
        return _table_html_to_markdown(content) if "<table" in content.lower() else content
    if region.role == "formula":
        if region.formula_latex:
            return f"$$\n{region.formula_latex}\n$$"
        return _asset(region, index, assets)
    if region.role == "figure":
        return _asset(region, index, assets)
    if region.role == "caption":
        return f"*{text}*" if text else ""
    if region.role == "code":
        return f"```text\n{text}\n```" if text else ""
    return text


def document_to_markdown(document: DocumentIR) -> MarkdownExport:
    """Export Markdown without treating it as the lossless source of truth."""
    assets: dict[str, bytes] = {}
    pages = []
    for page in document.pages:
        blocks = [
            block
            for index, region in enumerate(page.regions)
            if (block := _region_markdown(region, index, assets))
        ]
        pages.append("\n\n".join(blocks))
    return MarkdownExport(markdown="\n\n---\n\n".join(pages), assets=assets)
