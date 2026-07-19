import io
import unittest
from unittest.mock import patch

from PIL import Image
from fastapi import HTTPException

from main import attachment_header, prepare_ocr_pages


def _png_bytes(width: int = 2, height: int = 2) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), "white").save(buffer, format="PNG")
    return buffer.getvalue()


class ApiHelperTests(unittest.TestCase):
    def test_attachment_header_supports_unicode_and_blocks_header_injection(self):
        header = attachment_header('../r\u00e9sum\u00e9"\r\nscan.docx')

        self.assertNotIn("\r", header)
        self.assertNotIn("\n", header)
        self.assertIn('filename="resume___scan.docx"', header)
        self.assertIn("filename*=UTF-8''r%C3%A9sum%C3%A9%22__scan.docx", header)

    def test_prepare_pages_rejects_upload_before_format_processing(self):
        with patch("main.MAX_OCR_UPLOAD_BYTES", 4):
            with self.assertRaises(HTTPException) as raised:
                prepare_ocr_pages("scan.png", _png_bytes())

        self.assertEqual(raised.exception.status_code, 413)

    def test_prepare_pages_expands_multipage_tiff(self):
        buffer = io.BytesIO()
        first = Image.new("RGB", (4, 3), "white")
        first.save(
            buffer,
            format="TIFF",
            save_all=True,
            append_images=[Image.new("RGB", (4, 3), "black")],
            dpi=(200, 200),
        )

        pages = list(prepare_ocr_pages("scan.tiff", buffer.getvalue()))

        self.assertEqual(len(pages), 2)
        self.assertEqual([page.page_index for page in pages], [0, 1])

    def test_lazy_pdf_validation_is_reported_as_bad_request(self):
        pages = prepare_ocr_pages("broken.pdf", b"not a pdf")

        with self.assertRaises(HTTPException) as raised:
            list(pages)

        self.assertEqual(raised.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
