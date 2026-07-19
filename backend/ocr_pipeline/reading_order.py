"""Geometry-only reading order shared by layout and OCR adapters."""
from __future__ import annotations

from collections.abc import Callable, Sequence
from statistics import median
from typing import TypeVar


T = TypeVar("T")
BBoxGetter = Callable[[T], Sequence[float]]


def _valid_bbox(value: Sequence[float]) -> tuple[float, float, float, float] | None:
    if len(value) != 4:
        return None
    x1, y1, x2, y2 = (float(item) for item in value)
    if x2 <= x1 or y2 <= y1:
        return None
    return x1, y1, x2, y2


def _row_order(items: list[tuple[int, T, tuple[float, float, float, float]]]) -> list[T]:
    """Order items by visual rows when no stable column split exists."""
    if len(items) < 2:
        return [item for _, item, _ in items]

    heights = sorted(box[3] - box[1] for _, _, box in items)
    row_threshold = max(2.0, median(heights) * 0.6)
    rows: list[dict] = []
    for entry in sorted(items, key=lambda item: ((item[2][1] + item[2][3]) / 2, item[2][0])):
        center_y = (entry[2][1] + entry[2][3]) / 2
        for row in rows:
            if abs(center_y - row["center_y"]) < row_threshold:
                row["items"].append(entry)
                count = len(row["items"])
                row["center_y"] += (center_y - row["center_y"]) / count
                break
        else:
            rows.append({"center_y": center_y, "items": [entry]})

    return [
        item
        for row in rows
        for _, item, _ in sorted(row["items"], key=lambda entry: (entry[2][0], entry[0]))
    ]


def _best_column_split(
    items: list[tuple[int, T, tuple[float, float, float, float]]],
) -> tuple[
    list[tuple[int, T, tuple[float, float, float, float]]],
    list[tuple[int, T, tuple[float, float, float, float]]],
    list[tuple[int, T, tuple[float, float, float, float]]],
] | None:
    """Find a whitespace split supported by at least two items per column."""
    if len(items) < 4:
        return None

    heights = sorted(box[3] - box[1] for _, _, box in items)
    minimum_gap = max(3.0, median(heights) * 0.45)
    edges = sorted({box[0] for _, _, box in items} | {box[2] for _, _, box in items})
    candidates = []
    for left_edge, right_edge in zip(edges, edges[1:]):
        gap = right_edge - left_edge
        if gap < minimum_gap:
            continue
        midpoint = (left_edge + right_edge) / 2
        left = [entry for entry in items if entry[2][2] <= midpoint]
        right = [entry for entry in items if entry[2][0] >= midpoint]
        if len(left) < 2 or len(right) < 2:
            continue
        spanning = [entry for entry in items if entry not in left and entry not in right]
        balance = min(len(left), len(right)) / max(len(left), len(right))
        # Prefer a real whitespace gutter, balanced columns, and fewer blocks
        # crossing the split. A page title may legitimately cross one gutter.
        score = gap * (0.5 + balance) / (1 + len(spanning))
        candidates.append((score, left, right, spanning))

    if not candidates:
        return None
    _, left, right, spanning = max(candidates, key=lambda candidate: candidate[0])
    return left, right, spanning


def _order_positioned(
    items: list[tuple[int, T, tuple[float, float, float, float]]],
) -> list[T]:
    split = _best_column_split(items)
    if split is None:
        return _row_order(items)

    left, right, spanning = split
    if not spanning:
        return _order_positioned(left) + _order_positioned(right)

    # Full-width titles, captions, and footers divide a multi-column page into
    # vertical bands. Resolve both columns in each band before the spanning row.
    ordered: list[T] = []
    remaining = [*left, *right]
    anchor_rows: list[list[tuple[int, T, tuple[float, float, float, float]]]] = []
    for anchor in sorted(spanning, key=lambda entry: ((entry[2][1] + entry[2][3]) / 2, entry[2][0])):
        center_y = (anchor[2][1] + anchor[2][3]) / 2
        if anchor_rows:
            previous = anchor_rows[-1]
            previous_center = sum((entry[2][1] + entry[2][3]) / 2 for entry in previous) / len(previous)
            threshold = max(2.0, median(entry[2][3] - entry[2][1] for entry in previous) * 0.6)
            if abs(center_y - previous_center) < threshold:
                previous.append(anchor)
                continue
        anchor_rows.append([anchor])

    for anchors in anchor_rows:
        anchor_center = sum((entry[2][1] + entry[2][3]) / 2 for entry in anchors) / len(anchors)
        above = [entry for entry in remaining if (entry[2][1] + entry[2][3]) / 2 < anchor_center]
        if above:
            ordered.extend(_order_positioned(above))
            remaining = [entry for entry in remaining if entry not in above]
        ordered.extend(_row_order(anchors))
    if remaining:
        ordered.extend(_order_positioned(remaining))
    return ordered


def reading_order(items: Sequence[T], bbox_getter: BBoxGetter[T]) -> list[T]:
    """Return natural page order, keeping columns vertical and left-to-right.

    The detector's explicit order should still be preferred when complete. This
    function is the deterministic fallback for OCR lines and incomplete layout
    output. Items without usable geometry retain their input order at the end.
    """
    positioned = []
    unpositioned = []
    for sequence, item in enumerate(items):
        bbox = _valid_bbox(bbox_getter(item))
        if bbox is None:
            unpositioned.append(item)
        else:
            positioned.append((sequence, item, bbox))
    return _order_positioned(positioned) + unpositioned
