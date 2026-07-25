import io
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image

from ocr_pipeline.preprocess import (
    effective_dpi,
    image_to_page_inputs,
    load_image,
    upscale_if_small,
)


class PreprocessTests(unittest.TestCase):
    def test_rejects_decoded_image_pixel_bomb_before_opencv_decode(self):
        buffer = io.BytesIO()
        Image.new("RGB", (11, 10), "white").save(buffer, format="PNG")

        with patch("ocr_pipeline.preprocess.MAX_IMAGE_PIXELS", 100):
            with self.assertRaisesRegex(ValueError, "pixel OCR limit"):
                load_image(buffer.getvalue())

    def test_applies_exif_orientation_and_preserves_sensible_dpi(self):
        buffer = io.BytesIO()
        exif = Image.Exif()
        exif[274] = 6  # rotate 90 degrees clockwise
        Image.new("RGB", (10, 20), "white").save(
            buffer, format="JPEG", dpi=(144, 144), exif=exif
        )

        pages = image_to_page_inputs(buffer.getvalue(), max_pages=5)

        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0].image_bytes, buffer.getvalue())
        normalized = load_image(pages[0].image_bytes)
        self.assertEqual(normalized.shape[:2], (10, 20))
        self.assertAlmostEqual(pages[0].dpi, 144, delta=1)

    def test_decodes_every_multipage_tiff_frame(self):
        buffer = io.BytesIO()
        first = Image.new("RGB", (12, 8), "red")
        second = Image.new("RGB", (12, 8), "blue")
        first.save(
            buffer,
            format="TIFF",
            save_all=True,
            append_images=[second],
            dpi=(300, 300),
        )

        pages = image_to_page_inputs(buffer.getvalue(), max_pages=5)

        self.assertEqual([page.page_index for page in pages], [0, 1])
        self.assertTrue(all(abs(page.dpi - 300) < 1 for page in pages))
        first_bgr = load_image(pages[0].image_bytes)
        second_bgr = load_image(pages[1].image_bytes)
        self.assertGreater(first_bgr[0, 0, 2], first_bgr[0, 0, 0])
        self.assertGreater(second_bgr[0, 0, 0], second_bgr[0, 0, 2])

    def test_rejects_multipage_image_over_page_limit(self):
        buffer = io.BytesIO()
        first = Image.new("RGB", (2, 2), "white")
        first.save(
            buffer,
            format="TIFF",
            save_all=True,
            append_images=[Image.new("RGB", (2, 2), "white")],
        )

        with self.assertRaisesRegex(ValueError, "limited to 1 pages"):
            image_to_page_inputs(buffer.getvalue(), max_pages=1)

    def test_direct_decoder_rejects_multipage_input_instead_of_dropping_frames(self):
        buffer = io.BytesIO()
        first = Image.new("RGB", (2, 2), "white")
        first.save(
            buffer,
            format="TIFF",
            save_all=True,
            append_images=[Image.new("RGB", (2, 2), "white")],
        )

        with self.assertRaisesRegex(ValueError, "must be split"):
            load_image(buffer.getvalue())

    def test_effective_dpi_tracks_isotropic_upscale(self):
        source = np.zeros((100, 200, 3), dtype=np.uint8)
        working = np.zeros((250, 500, 3), dtype=np.uint8)

        self.assertEqual(effective_dpi(source, working, 96), 240)

    def test_configured_minimum_width_controls_upscale(self):
        source = np.zeros((100, 200, 3), dtype=np.uint8)

        with patch("ocr_pipeline.preprocess.MIN_IMAGE_WIDTH", 500):
            working = upscale_if_small(source)

        self.assertEqual(working.shape[:2], (250, 500))
        self.assertEqual(effective_dpi(source, working, 96), 240)


if __name__ == "__main__":
    unittest.main()
