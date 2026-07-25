import io
import unittest
import warnings
from contextlib import redirect_stdout
from unittest.mock import patch

warnings.filterwarnings(
    "ignore",
    message="Using `httpx` with `starlette.testclient` is deprecated.*",
)

from fastapi.testclient import TestClient
from PIL import Image

import main


def _png_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (2, 2), "white").save(buffer, format="PNG")
    return buffer.getvalue()


class OcrApiEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_converts_multipart_image_and_returns_named_docx(self):
        with patch("main.pages_to_docx", return_value=b"PK\x03\x04docx") as converter:
            response = self.client.post(
                "/convert/image-to-docx",
                files={"file": ("scan.png", _png_bytes(), "image/png")},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers["content-type"],
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        self.assertIn('filename="scan.docx"', response.headers["content-disposition"])
        self.assertEqual(response.content, b"PK\x03\x04docx")
        converter.assert_called_once()

    def test_rejects_unsupported_and_oversized_uploads(self):
        unsupported = self.client.post(
            "/convert/image-to-docx",
            files={"file": ("archive.zip", b"zip", "application/zip")},
        )
        self.assertEqual(unsupported.status_code, 400)
        self.assertIn("Unsupported OCR format", unsupported.json()["detail"])

        with patch("main.MAX_OCR_UPLOAD_BYTES", 3):
            oversized = self.client.post(
                "/convert/image-to-docx",
                files={"file": ("scan.png", _png_bytes(), "image/png")},
            )
        self.assertEqual(oversized.status_code, 413)

    def test_maps_pipeline_failures_without_leaking_a_traceback(self):
        with redirect_stdout(io.StringIO()):
            with patch("main.pages_to_docx", side_effect=RuntimeError("model failed")):
                response = self.client.post(
                    "/convert/image-to-docx",
                    files={"file": ("scan.png", _png_bytes(), "image/png")},
                )

        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.json()["detail"], "Conversion failed: model failed")


if __name__ == "__main__":
    unittest.main()
