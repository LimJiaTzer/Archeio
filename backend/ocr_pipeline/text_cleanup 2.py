"""Optional text-only OCR correction through an OpenAI-compatible endpoint."""
from difflib import SequenceMatcher
import json
import math
import os
import re
from urllib.request import Request, urlopen

from .models import DocumentIR, Region


_CLEANABLE_ROLES = {"document_title", "heading", "paragraph", "list", "caption"}
_CLEANABLE_SOURCES = {"paddle_ocr", "paddle_block_content"}
_SYSTEM_PROMPT = """You correct OCR transcription errors in document regions.
Fix only obvious character, spacing, and duplicated-fragment errors. Preserve
meaning, numbers, formulas, list markers, and line breaks. Do not summarize,
rewrite, add facts, or change region IDs. Return JSON only in this exact shape:
{"regions":[{"id":"...","text":"..."}]}.
"""


def _candidate_regions(document: DocumentIR) -> list[tuple[str, Region]]:
    candidates = []
    for page in document.pages:
        for index, region in enumerate(page.regions):
            if (
                region.source in _CLEANABLE_SOURCES
                and region.role in _CLEANABLE_ROLES
                and region.text.strip()
            ):
                candidates.append((f"{page.page_index}:{index}", region))
    return candidates


def _batches(
    candidates: list[tuple[str, Region]],
    max_characters: int,
) -> list[list[tuple[str, Region]]]:
    result = []
    current = []
    size = 0
    for item in candidates:
        item_size = len(item[1].text) + 100
        if current and size + item_size > max_characters:
            result.append(current)
            current = []
            size = 0
        current.append(item)
        size += item_size
    if current:
        result.append(current)
    return result


def _json_content(value: str) -> dict:
    value = value.strip()
    fenced = re.fullmatch(r"```(?:json)?\s*([\s\S]*?)\s*```", value, re.IGNORECASE)
    if fenced:
        value = fenced.group(1)
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError("Text cleanup response was not a JSON object.")
    return parsed


def _request_cleanup(batch: list[tuple[str, Region]]) -> dict[str, str]:
    url = os.environ["OCR_TEXT_CLEANUP_URL"]
    payload = {
        "model": os.getenv("OCR_TEXT_CLEANUP_MODEL", "ocr-text-cleaner"),
        "temperature": 0,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": json.dumps({
                    "regions": [
                        {
                            "id": region_id,
                            "role": region.role,
                            "confidence": region.ocr_confidence,
                            "text": region.text,
                        }
                        for region_id, region in batch
                    ]
                }, ensure_ascii=False),
            },
        ],
    }
    headers = {"Content-Type": "application/json"}
    api_key = os.getenv("OCR_TEXT_CLEANUP_API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    timeout = max(1, int(os.getenv("OCR_TEXT_CLEANUP_TIMEOUT_SECONDS", "120")))
    with urlopen(request, timeout=timeout) as response:
        response_body = json.loads(response.read().decode("utf-8"))
    content = response_body["choices"][0]["message"]["content"]
    parsed = _json_content(content)
    updates = parsed.get("regions", [])
    if not isinstance(updates, list):
        raise ValueError("Text cleanup response had no regions list.")
    return {
        str(item["id"]): str(item["text"])
        for item in updates
        if isinstance(item, dict) and "id" in item and "text" in item
    }


def _plausible_correction(original: str, corrected: str) -> bool:
    corrected = corrected.strip()
    if not corrected:
        return False
    original = original.strip()
    length_ratio = len(corrected) / max(1, len(original))
    if not 0.6 <= length_ratio <= 1.4:
        return False

    # Standalone values are facts, not spelling. This deliberately ignores
    # digits embedded in a word (for example a garbled course code) so the
    # cleaner can still repair character confusions around them.
    number_pattern = r"(?<![\w])[-+]?\d+(?:[.,:/-]\d+)*%?(?![\w])"
    if re.findall(number_pattern, original) != re.findall(number_pattern, corrected):
        return False

    comparable_original = re.sub(r"\s+", " ", original).casefold()
    comparable_corrected = re.sub(r"\s+", " ", corrected).casefold()
    try:
        minimum_similarity = float(
            os.getenv("OCR_TEXT_CLEANUP_MIN_SIMILARITY", "0.55")
        )
    except ValueError:
        minimum_similarity = 0.55
    if not math.isfinite(minimum_similarity):
        minimum_similarity = 0.55
    minimum_similarity = max(0.0, min(1.0, minimum_similarity))
    similarity = SequenceMatcher(
        None, comparable_original, comparable_corrected, autojunk=False
    ).ratio()
    return similarity >= minimum_similarity


def cleanup_document_text(document: DocumentIR) -> list[str]:
    """Correct scanned OCR text when configured; never fail the conversion."""
    if not os.getenv("OCR_TEXT_CLEANUP_URL"):
        return []

    candidates = _candidate_regions(document)
    if not candidates:
        return []
    max_characters = max(1000, int(os.getenv("OCR_TEXT_CLEANUP_BATCH_CHARACTERS", "24000")))
    errors = []
    for batch in _batches(candidates, max_characters):
        try:
            updates = _request_cleanup(batch)
        except Exception as exc:
            errors.append(str(exc))
            continue
        for region_id, region in batch:
            corrected = updates.get(region_id)
            if corrected is None or not _plausible_correction(region.text, corrected):
                continue
            if corrected.strip() != region.text.strip():
                region.metadata["text_before_cleanup"] = region.text
                region.metadata["text_cleanup_model"] = os.getenv(
                    "OCR_TEXT_CLEANUP_MODEL", "ocr-text-cleaner"
                )
                region.text = corrected.strip()
                # A cleaned region no longer has one-to-one span text. Retain
                # its aggregate visual style and let the builder emit one run.
                region.lines = []
    return errors
