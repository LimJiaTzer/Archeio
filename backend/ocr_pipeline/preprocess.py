"""
Stage 1: Preprocessing
Pure OpenCV, CPU-only, no models. Deskew + denoise + normalize input
so downstream layout/OCR models get a clean, consistent image.
"""
import cv2
import numpy as np


def load_image(image_bytes: bytes) -> np.ndarray:
    """Decode raw bytes (from an upload) into a BGR numpy array."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image — unsupported format or corrupt file")
    return img


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


def upscale_if_small(img: np.ndarray, min_width: int = 1600) -> np.ndarray:
    """OCR accuracy drops sharply below ~150dpi-equivalent resolution."""
    h, w = img.shape[:2]
    if w >= min_width:
        return img
    scale = min_width / w
    return cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)


def preprocess(image_bytes: bytes) -> np.ndarray:
    """Full preprocessing pipeline: decode -> upscale -> deskew -> denoise."""
    img = load_image(image_bytes)
    img = upscale_if_small(img)
    img = deskew(img)
    img = denoise(img)
    return img
