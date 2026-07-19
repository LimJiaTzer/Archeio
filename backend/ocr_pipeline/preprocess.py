"""
Stage 1: Preprocessing
Pure OpenCV, CPU-only, no models. Deskew + denoise + normalize input
so downstream layout/OCR models get a clean, consistent image.
"""
import io
import math
import os
from collections.abc import Iterator

import cv2
import numpy as np
from PIL import Image, ImageOps

from .models import PageInput


MAX_IMAGE_PIXELS = int(os.getenv("OCR_MAX_IMAGE_PIXELS", "50000000"))
MAX_IMAGE_TOTAL_PIXELS = int(
    os.getenv("OCR_MAX_IMAGE_TOTAL_PIXELS", "500000000")
)
try:
    MIN_IMAGE_WIDTH = max(1, int(os.getenv("OCR_MIN_IMAGE_WIDTH", "1600")))
except ValueError:
    MIN_IMAGE_WIDTH = 1600
DEFAULT_IMAGE_DPI = 200.0
MIN_SENSIBLE_DPI = 36.0
MAX_SENSIBLE_DPI = 2400.0


def _positive_float(value: object) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        return None
    if not math.isfinite(number) or number <= 0:
        return None
    return number


def source_image_dpi(image: Image.Image, default: float = DEFAULT_IMAGE_DPI) -> float:
    """Return a trustworthy scalar DPI from common raster metadata.

    Pillow normally exposes PNG pHYs, JPEG JFIF and TIFF resolution tags as
    ``info["dpi"]``. The TIFF tag fallback covers files whose plugin does not
    populate that convenience field. A single scalar is intentional: OCR
    preprocessing is isotropic and DOCX currently accepts one physical scale.
    """
    candidates = image.info.get("dpi")
    if not candidates:
        try:
            exif = image.getexif()
            x_resolution = exif.get(282)
            y_resolution = exif.get(283)
            if x_resolution and y_resolution:
                candidates = (x_resolution, y_resolution)
                if exif.get(296) == 3:
                    candidates = tuple(
                        float(value) * 2.54 for value in candidates
                    )
        except (AttributeError, TypeError, ValueError, ZeroDivisionError):
            candidates = None
    if not candidates and hasattr(image, "tag_v2"):
        x_resolution = image.tag_v2.get(282)
        y_resolution = image.tag_v2.get(283)
        if x_resolution and y_resolution:
            candidates = (x_resolution, y_resolution)
            # TIFF ResolutionUnit 3 stores pixels per centimetre.
            if image.tag_v2.get(296) == 3:
                candidates = tuple(float(value) * 2.54 for value in candidates)

    if isinstance(candidates, (tuple, list)) and len(candidates) >= 2:
        x_dpi = _positive_float(candidates[0])
        y_dpi = _positive_float(candidates[1])
    else:
        x_dpi = y_dpi = _positive_float(candidates)

    if x_dpi is None or y_dpi is None:
        return float(default)
    if not (
        MIN_SENSIBLE_DPI <= x_dpi <= MAX_SENSIBLE_DPI
        and MIN_SENSIBLE_DPI <= y_dpi <= MAX_SENSIBLE_DPI
    ):
        return float(default)
    # Grossly inconsistent axes are usually malformed metadata, not a scan.
    if max(x_dpi, y_dpi) / min(x_dpi, y_dpi) > 4:
        return float(default)
    return float(round(math.sqrt(x_dpi * y_dpi), 2))


def _oriented_rgb(image: Image.Image) -> Image.Image:
    """Apply EXIF orientation and flatten transparency onto a white page."""
    oriented = ImageOps.exif_transpose(image)
    if "A" in oriented.getbands() or "transparency" in oriented.info:
        rgba = oriented.convert("RGBA")
        background = Image.new("RGBA", rgba.size, "white")
        return Image.alpha_composite(background, rgba).convert("RGB")
    return oriented.convert("RGB")


def iter_image_page_inputs(
    image_bytes: bytes,
    max_pages: int,
) -> Iterator[PageInput]:
    """Yield raster frames without retaining every decoded page in memory."""
    if max_pages < 1:
        raise ValueError("The image page limit must be at least one.")
    try:
        source = Image.open(io.BytesIO(image_bytes))
    except Exception as exc:
        raise ValueError(
            "Could not decode image - unsupported format or corrupt file"
        ) from exc

    total_pixels = 0
    try:
        frame_count = int(getattr(source, "n_frames", 1) or 1)
        if frame_count > max_pages:
            raise ValueError(
                f"Images are limited to {max_pages} pages per OCR request."
            )
        for page_index in range(frame_count):
            try:
                source.seek(page_index)
                width, height = source.size
                pixels = int(width) * int(height)
                if width <= 0 or height <= 0 or pixels > MAX_IMAGE_PIXELS:
                    raise ValueError(
                        f"Image page {page_index + 1} exceeds the "
                        f"{MAX_IMAGE_PIXELS:,}-pixel OCR limit."
                    )
                total_pixels += pixels
                if total_pixels > MAX_IMAGE_TOTAL_PIXELS:
                    raise ValueError(
                        "The image exceeds the "
                        f"{MAX_IMAGE_TOTAL_PIXELS:,}-pixel total OCR limit."
                    )

                dpi = source_image_dpi(source)
                if frame_count == 1:
                    # Preserve bounded JPEG/WebP/TIFF upload bytes. load_image
                    # applies EXIF orientation at analysis time, avoiding a
                    # potentially much larger intermediate PNG.
                    source.verify()
                    page_bytes = image_bytes
                else:
                    # A frame extracted from a multi-page container needs its
                    # own single-page encoding so downstream cannot silently
                    # decode only the first frame again.
                    frame = _oriented_rgb(source.copy())
                    output = io.BytesIO()
                    frame.save(output, format="PNG")
                    page_bytes = output.getvalue()
            except ValueError:
                raise
            except Exception as exc:
                raise ValueError(
                    f"Could not decode image page {page_index + 1}."
                ) from exc
            yield PageInput(
                image_bytes=page_bytes,
                page_index=page_index,
                dpi=dpi,
            )
    finally:
        source.close()


def image_to_page_inputs(image_bytes: bytes, max_pages: int) -> list[PageInput]:
    """Materialized compatibility wrapper; request handling uses the iterator."""
    return list(iter_image_page_inputs(image_bytes, max_pages))


def load_image(image_bytes: bytes) -> np.ndarray:
    """Decode raw bytes (from an upload) into a BGR numpy array."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as source:
            if int(getattr(source, "n_frames", 1) or 1) != 1:
                raise ValueError(
                    "Multi-page images must be split before OCR processing."
                )
            width, height = source.size
            if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
                raise ValueError(
                    f"Image dimensions exceed the {MAX_IMAGE_PIXELS:,}-pixel OCR limit."
                )
            rgb = _oriented_rgb(source.copy())
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("Could not decode image - unsupported format or corrupt file") from exc
    return cv2.cvtColor(np.asarray(rgb), cv2.COLOR_RGB2BGR)


def effective_dpi(
    source_img: np.ndarray,
    working_img: np.ndarray,
    source_dpi: float,
) -> float:
    """Scale source DPI into the pixel coordinate space analyzed by OCR."""
    source_height, source_width = source_img.shape[:2]
    working_height, working_width = working_img.shape[:2]
    if source_width <= 0 or source_height <= 0:
        return float(source_dpi)
    scale_x = working_width / source_width
    scale_y = working_height / source_height
    scale = math.sqrt(max(scale_x, 0.0) * max(scale_y, 0.0))
    if not math.isfinite(scale) or scale <= 0:
        return float(source_dpi)
    return float(source_dpi) * scale


def deskew(img: np.ndarray) -> np.ndarray:
    """
    Estimate skew angle from text-line orientation and rotate to correct it.
    Uses minAreaRect over thresholded foreground pixels — cheap, no model.
    """
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.bitwise_not(gray)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]

    coords = np.column_stack(np.where(thresh > 0))
    if coords.shape[0] < 20:
        return img  # not enough foreground to estimate angle safely

    angle = cv2.minAreaRect(coords)[-1]
    # cv2.minAreaRect returns angle in [-90, 0); normalize to a small correction
    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    # Skip correction for negligible angles — avoids introducing blur on
    # already-straight scans
    if abs(angle) < 0.5:
        return img

    # minAreaRect over the WHOLE foreground mask (text + borders/decorations/
    # background texture) is only a reliable skew estimate when text pixels
    # dominate that mask. A hand-photographed or scanned page is rarely more
    # than a few degrees off -- a large angle here means the estimate locked
    # onto non-text content instead (verified: a worksheet with a decorative
    # border produced an 89.9 degree "correction" that rotated every text
    # line from horizontal to vertical and broke OCR reading order). Better
    # to skip a bad correction than apply one.
    MAX_CORRECTABLE_ANGLE_DEG = 15
    if abs(angle) > MAX_CORRECTABLE_ANGLE_DEG:
        return img

    (h, w) = img.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE
    )
    return rotated


def denoise(img: np.ndarray) -> np.ndarray:
    """Light denoising — fastNlMeans is CPU-cheap at document resolutions."""
    return cv2.fastNlMeansDenoisingColored(img, None, h=5, hColor=5,
                                            templateWindowSize=7, searchWindowSize=21)


def upscale_if_small(img: np.ndarray, min_width: int | None = None) -> np.ndarray:
    """OCR accuracy drops sharply below ~150dpi-equivalent resolution."""
    min_width = MIN_IMAGE_WIDTH if min_width is None else max(1, int(min_width))
    h, w = img.shape[:2]
    if w >= min_width:
        return img
    scale = min_width / w
    return cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)


def preprocess_image(img: np.ndarray) -> np.ndarray:
    """Apply the OCR working-image transforms to an already decoded page."""
    img = upscale_if_small(img)
    img = deskew(img)
    img = denoise(img)
    return img


def preprocess(image_bytes: bytes) -> np.ndarray:
    """Full preprocessing pipeline: decode -> upscale -> deskew -> denoise."""
    return preprocess_image(load_image(image_bytes))
