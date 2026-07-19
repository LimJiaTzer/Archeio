import json
import unittest
from unittest.mock import patch

from ocr_pipeline.models import DocumentIR, PageIR, Region
from ocr_pipeline.text_cleanup import cleanup_document_text


class _Response:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


class TextCleanupTests(unittest.TestCase):
    def test_cleans_only_scanned_text_and_preserves_structure(self):
        scanned = Region(
            kind="text",
            bbox=[0, 0, 10, 10],
            source="paddle_ocr",
            role="paragraph",
            text="Algoritbm analysls",
            ocr_confidence=0.72,
        )
        native = Region(
            kind="text",
            bbox=[0, 0, 10, 10],
            source="pdf_text",
            role="paragraph",
            text="Exact native text",
        )
        document = DocumentIR([PageIR(0, [scanned, native])])
        response = _Response({
            "choices": [{"message": {"content": json.dumps({
                "regions": [{"id": "0:0", "text": "Algorithm analysis"}]
            })}}]
        })

        with patch.dict("os.environ", {
            "OCR_TEXT_CLEANUP_URL": "http://localhost/v1/chat/completions",
            "OCR_TEXT_CLEANUP_MODEL": "tiny-model",
        }), patch("ocr_pipeline.text_cleanup.urlopen", return_value=response):
            errors = cleanup_document_text(document)

        self.assertEqual(errors, [])
        self.assertEqual(scanned.text, "Algorithm analysis")
        self.assertEqual(native.text, "Exact native text")
        self.assertEqual(scanned.metadata["text_cleanup_model"], "tiny-model")

    def test_endpoint_failure_does_not_fail_conversion(self):
        region = Region(
            kind="text",
            bbox=[0, 0, 10, 10],
            source="paddle_ocr",
            role="paragraph",
            text="OCR text",
        )
        document = DocumentIR([PageIR(0, [region])])
        with patch.dict("os.environ", {"OCR_TEXT_CLEANUP_URL": "http://localhost"}), patch(
            "ocr_pipeline.text_cleanup.urlopen", side_effect=OSError("offline")
        ):
            errors = cleanup_document_text(document)
        self.assertEqual(region.text, "OCR text")
        self.assertEqual(errors, ["offline"])

    def test_cleans_parser_block_content_but_not_native_pdf_text(self):
        parser_region = Region(
            kind="text",
            bbox=[0, 0, 10, 10],
            source="paddle_block_content",
            role="paragraph",
            text="Algoritbm analysls",
        )
        native_region = Region(
            kind="text",
            bbox=[0, 20, 10, 30],
            source="pdf_text",
            role="paragraph",
            text="Exact native text",
        )
        document = DocumentIR([PageIR(0, [parser_region, native_region])])
        response = _Response({
            "choices": [{"message": {"content": json.dumps({
                "regions": [{"id": "0:0", "text": "Algorithm analysis"}]
            })}}]
        })

        with patch.dict("os.environ", {
            "OCR_TEXT_CLEANUP_URL": "http://localhost/v1/chat/completions",
        }), patch("ocr_pipeline.text_cleanup.urlopen", return_value=response):
            errors = cleanup_document_text(document)

        self.assertEqual(errors, [])
        self.assertEqual(parser_region.text, "Algorithm analysis")
        self.assertEqual(native_region.text, "Exact native text")

    def test_rejects_hallucinated_rewrites_and_changed_numbers(self):
        changed_number = Region(
            kind="text",
            bbox=[0, 0, 10, 10],
            source="paddle_ocr",
            role="paragraph",
            text="Revenue was 2024 dollars",
        )
        rewritten = Region(
            kind="text",
            bbox=[0, 0, 10, 10],
            source="paddle_ocr",
            role="paragraph",
            text="The system records user preferences",
        )
        document = DocumentIR([PageIR(0, [changed_number, rewritten])])
        response = _Response({
            "choices": [{"message": {"content": json.dumps({
                "regions": [
                    {"id": "0:0", "text": "Revenue was 2025 dollars"},
                    {"id": "0:1", "text": "A completely unrelated sentence appears"},
                ]
            })}}]
        })

        with patch.dict("os.environ", {
            "OCR_TEXT_CLEANUP_URL": "http://localhost/v1/chat/completions",
        }), patch("ocr_pipeline.text_cleanup.urlopen", return_value=response):
            cleanup_document_text(document)

        self.assertEqual(changed_number.text, "Revenue was 2024 dollars")
        self.assertEqual(rewritten.text, "The system records user preferences")


if __name__ == "__main__":
    unittest.main()
