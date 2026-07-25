import unittest
from unittest.mock import patch

import fitz

from ocr_pipeline.pdf_source import (
    PDF_RENDER_DPI,
    _clean_span_text,
    _font_family,
    pdf_to_page_inputs,
)


def _document_bytes(document: fitz.Document, **kwargs) -> bytes:
    try:
        return document.tobytes(**kwargs)
    finally:
        document.close()


class PdfSourceTests(unittest.TestCase):
    def test_extracts_native_text_style_and_rendered_page(self):
        document = fitz.open()
        page = document.new_page(width=144, height=72)
        page.insert_text(
            (12, 30),
            "Styled text",
            fontname="hebi",
            fontsize=14,
            color=(0.2, 0.4, 0.6),
        )

        pages = pdf_to_page_inputs(_document_bytes(document), max_pages=2)

        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0].page_index, 0)
        self.assertTrue(pages[0].image_bytes.startswith(b"\x89PNG"))
        pixmap = fitz.Pixmap(pages[0].image_bytes)
        self.assertEqual((pixmap.width, pixmap.height), (600, 300))

        self.assertEqual(len(pages[0].native_lines), 1)
        span = pages[0].native_lines[0].spans[0]
        self.assertEqual(span.text, "Styled text")
        self.assertEqual(span.font_family, "Helvetica-BoldOblique")
        self.assertAlmostEqual(span.font_size_pt, 14)
        self.assertEqual(span.color_rgb, (51, 102, 153))
        self.assertTrue(span.bold)
        self.assertTrue(span.italic)

    def test_maps_rotated_crop_coordinates_into_png_space(self):
        document = fitz.open()
        page = document.new_page(width=200, height=100)
        page.insert_text((20, 30), "Rotated", fontsize=12)
        page.set_cropbox(fitz.Rect(10, 10, 190, 90))
        page.set_rotation(90)
        pdf_bytes = _document_bytes(document)

        pages = pdf_to_page_inputs(pdf_bytes, max_pages=1)
        pixmap = fitz.Pixmap(pages[0].image_bytes)
        self.assertEqual((pixmap.width, pixmap.height), (334, 750))

        source = fitz.open(stream=pdf_bytes, filetype="pdf")
        try:
            source_page = source[0]
            raw_bbox = source_page.get_text("dict")["blocks"][0]["lines"][0]["spans"][0]["bbox"]
            scale = fitz.Matrix(PDF_RENDER_DPI / 72, PDF_RENDER_DPI / 72)
            expected = fitz.Rect(raw_bbox) * source_page.rotation_matrix * scale
        finally:
            source.close()

        actual = pages[0].native_lines[0].spans[0].bbox
        for coordinate, expected_coordinate in zip(actual, expected):
            self.assertAlmostEqual(coordinate, expected_coordinate, places=3)
        self.assertGreater(actual[0], pixmap.width / 2)
        self.assertLessEqual(actual[2], pixmap.width)

    def test_ignores_invisible_pdf_text(self):
        document = fitz.open()
        page = document.new_page()
        page.insert_text((20, 30), "Visible")
        page.insert_text((20, 60), "Hidden OCR layer", render_mode=3)

        pages = pdf_to_page_inputs(_document_bytes(document), max_pages=1)

        extracted = "\n".join(line.text for line in pages[0].native_lines)
        self.assertIn("Visible", extracted)
        self.assertNotIn("Hidden OCR layer", extracted)

    def test_returns_raster_page_when_pdf_has_no_text(self):
        document = fitz.open()
        document.new_page(width=100, height=100)

        pages = pdf_to_page_inputs(_document_bytes(document), max_pages=1)

        self.assertEqual(pages[0].native_lines, [])
        self.assertTrue(pages[0].image_bytes.startswith(b"\x89PNG"))

    def test_rejects_invalid_limits_large_and_password_protected_pdfs(self):
        document = fitz.open()
        document.new_page()
        with self.assertRaisesRegex(ValueError, "at least one"):
            pdf_to_page_inputs(_document_bytes(document), max_pages=0)

        document = fitz.open()
        document.new_page()
        document.new_page()
        with self.assertRaisesRegex(ValueError, "limited to 1 page"):
            pdf_to_page_inputs(_document_bytes(document), max_pages=1)

        document = fitz.open()
        document.new_page()
        encrypted = _document_bytes(
            document,
            encryption=fitz.PDF_ENCRYPT_AES_256,
            owner_pw="owner-password",
            user_pw="user-password",
        )
        with self.assertRaisesRegex(ValueError, "Password-protected"):
            pdf_to_page_inputs(encrypted, max_pages=1)

    def test_sanitizes_controls_without_losing_document_characters(self):
        self.assertEqual(_clean_span_text("A\x00\tB x\u00b2 \u4e2d"), "A B x\u00b2 \u4e2d")
        self.assertEqual(_font_family("ABCDEF+Calibri"), "Calibri")

    def test_rejects_page_and_document_pixel_budgets_before_rendering(self):
        document = fitz.open()
        document.new_page(width=144, height=144)
        pdf_bytes = _document_bytes(document)
        with patch("ocr_pipeline.pdf_source.MAX_PDF_PAGE_PIXELS", 100):
            with self.assertRaisesRegex(ValueError, "page 1 exceeds"):
                pdf_to_page_inputs(pdf_bytes, max_pages=1)

        document = fitz.open()
        document.new_page(width=72, height=72)
        document.new_page(width=72, height=72)
        pdf_bytes = _document_bytes(document)
        with patch("ocr_pipeline.pdf_source.MAX_PDF_TOTAL_PIXELS", 100_000):
            with self.assertRaisesRegex(ValueError, "total render limit"):
                pdf_to_page_inputs(pdf_bytes, max_pages=2)


if __name__ == "__main__":
    unittest.main()
