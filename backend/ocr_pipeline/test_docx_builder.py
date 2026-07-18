import io
import unittest

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH

from ocr_pipeline.docx_builder import build_docx
from ocr_pipeline.layout import Region
from ocr_pipeline.pipeline import _classify_region, _infer_alignment
from ocr_pipeline.style import TextStyle


class DocxBuilderTests(unittest.TestCase):
    def test_classifies_layout_regions_and_alignment(self):
        self.assertEqual(_classify_region(Region(kind="title", bbox=[0, 0, 1, 1])), "heading")
        self.assertEqual(_classify_region(Region(kind="text", bbox=[0, 0, 1, 1])), "paragraph")
        self.assertEqual(_classify_region(Region(kind="list", bbox=[0, 0, 1, 1])), "list")
        self.assertEqual(_infer_alignment([420, 80, 1180, 160], 1600), "center")
        self.assertEqual(_infer_alignment([120, 180, 1320, 230], 1600), "left")

    def test_preserves_region_semantics_and_text_style(self):
        region = Region(
            kind="title",
            bbox=[300, 80, 1300, 160],
            role="heading",
            text="Centered heading",
            alignment="center",
            style=TextStyle(
                font_size_pt=18,
                color_rgb=(10, 20, 30),
                bold=True,
                italic_guess=False,
            ),
        )

        document = Document(io.BytesIO(build_docx([region])))
        paragraph = document.paragraphs[0]
        run = paragraph.runs[0]

        self.assertEqual(paragraph.style.name, "Heading 1")
        self.assertEqual(paragraph.alignment, WD_ALIGN_PARAGRAPH.CENTER)
        self.assertEqual(run.text, "Centered heading")
        self.assertTrue(run.bold)
        self.assertEqual(run.font.size.pt, 18)


if __name__ == "__main__":
    unittest.main()
