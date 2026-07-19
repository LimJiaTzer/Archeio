"""
Stage 3 (style half): derive visual style attributes for a text region.
No model — deterministic computation over the region's pixels and the
layout model's bounding box. This is the "cheap 90%" of style recovery;
font-family matching (the genuinely hard 10%) is intentionally out of
scope for Phase 1 and falls back to a safe system font.
"""
from dataclasses import dataclass
import cv2
import numpy as np


@dataclass
class TextStyle:
    font_size_pt: float
    color_rgb: tuple          # (r, g, b), 0-255
    bold: bool
    italic_guess: bool        # low-confidence heuristic, treat as advisory
    font_family: str | None = None
    highlight_rgb: tuple[int, int, int] | None = None


def estimate_font_size(bbox_height_px: int, dpi: int = 200) -> float:
    pt = bbox_height_px / (max(72, dpi) / 72)
    # Snap to the nearest common size — avoids ugly "13.4pt" outputs
    common_sizes = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48]
    return min(common_sizes, key=lambda s: abs(s - pt))


def estimate_glyph_height_px(crop_bgr: np.ndarray) -> int:
    """Estimate character height without mistaking a multi-line region for one font."""
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    _, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)

    crop_height = crop_bgr.shape[0]
    heights = []
    for x, y, width, height, area in stats[1:]:
        if width < 2 or height < 6 or area < 12:
            continue
        # Ignore borders, photos, and other components that occupy most of
        # the detected layout region rather than representing a glyph.
        if height > crop_height * 0.8:
            continue
        heights.append(height)

    if not heights:
        return max(1, crop_height)
    return int(np.median(heights))


def dominant_text_color(crop_bgr: np.ndarray) -> tuple:
    """
    Sample pixel color of foreground (text) pixels only, using Otsu
    thresholding to separate text from background, then average the
    darker cluster's original color.
    """
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)

    ys, xs = np.where(mask > 0)
    if len(xs) == 0:
        return (0, 0, 0)  # default to black if nothing detected

    pixels = crop_bgr[ys, xs]
    mean_bgr = pixels.mean(axis=0)
    b, g, r = mean_bgr
    return (int(r), int(g), int(b))


def estimate_boldness(crop_bgr: np.ndarray) -> bool:
    """
    Heuristic: bold text has a higher ratio of foreground(ink) pixels to
    bounding-box area than regular weight, at a given font size. This is
    a coarse proxy, not a trained classifier -- good enough to flip a
    binary docx bold flag, not for anything more granular.
    """
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV | cv2.THRESH_OTSU)
    ink_ratio = float(np.count_nonzero(mask)) / mask.size
    return ink_ratio > 0.22  # calibrate this threshold against real samples


def estimate_highlight_color(crop_bgr: np.ndarray) -> tuple[int, int, int] | None:
    """Detect a light, saturated background typical of marker highlighting."""
    hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    mask = (saturation >= 35) & (value >= 165)
    coverage = float(np.count_nonzero(mask)) / mask.size
    if coverage < 0.04 or coverage > 0.85:
        return None
    b, g, r = np.median(crop_bgr[mask], axis=0)
    return (int(r), int(g), int(b))


def extract_style(
    img: np.ndarray,
    bbox: list,
    padding_px: int = 4,
    dpi: int = 200,
) -> TextStyle:
    """
    FIX: zero-padding crops clip anti-aliased glyph edges, which biases
    dominant_text_color() toward edge-blur pixels and can shift the ink
    ratio estimate_boldness() relies on. A small margin keeps the sampled
    pixels representative of the actual glyph, not clipped edges.
    """
    h, w = img.shape[:2]
    x1, y1, x2, y2 = [int(v) for v in bbox]
    x1 = max(x1 - padding_px, 0)
    y1 = max(y1 - padding_px, 0)
    x2 = min(x2 + padding_px, w)
    y2 = min(y2 + padding_px, h)
    crop = img[y1:y2, x1:x2]
    if crop.size == 0:
        return TextStyle(font_size_pt=11, color_rgb=(0, 0, 0), bold=False, italic_guess=False)

    return TextStyle(
        font_size_pt=estimate_font_size(estimate_glyph_height_px(crop), dpi=dpi),
        color_rgb=dominant_text_color(crop),
        bold=estimate_boldness(crop),
        italic_guess=False,  # slant detection deferred — low value for v1
        highlight_rgb=estimate_highlight_color(crop),
    )
