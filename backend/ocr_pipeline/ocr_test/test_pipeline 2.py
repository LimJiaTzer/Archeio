import unittest
from unittest.mock import patch

import cv2
import numpy as np

from ocr_pipeline.models import (
    NativeTable,
    NativeTextLine,
    NativeTextSpan,
    PageInput,
    Region,
)
from ocr_pipeline.pipeline import (
    _apply_best_table_result,
    _assign_heading_hierarchy,
    _assign_region_alignments,
    _normalized_native_table_rows,
    _numbering_depth,
    analyze_document,
)
from ocr_pipeline.style import TextStyle


def _png() -> bytes:
    success, encoded = cv2.imencode(".png", np.full((200, 300, 3), 255, dtype=np.uint8))
    if not success:
        raise RuntimeError("Could not make test image")
    return encoded.tobytes()


class PipelineTests(unittest.TestCase):
    def test_native_pdf_text_bypasses_ocr_and_resolves_headings(self):
        lines = [
            NativeTextLine([20, 20, 200, 45], [NativeTextSpan("1. Overview", [20, 20, 200, 45], 18, bold=True)], 0),
            NativeTextLine([20, 70, 260, 90], [NativeTextSpan("Exact PDF text", [20, 70, 260, 90], 11)], 1),
        ]
        layout_regions = [
            Region(kind="paragraph_title", bbox=[15, 15, 210, 50], order=0),
            Region(kind="text", bbox=[15, 65, 270, 95], order=1),
        ]
        page = PageInput(_png(), native_lines=lines, dpi=300, preserve_geometry=True)

        with patch("ocr_pipeline.pipeline.analyze_layout", return_value=layout_regions), patch(
            "ocr_pipeline.pipeline.recognize_lines", side_effect=AssertionError("OCR should be skipped")
        ):
            document = analyze_document([page])

        heading, paragraph = document.pages[0].regions
        self.assertEqual(heading.heading_level, 1)
        self.assertEqual(paragraph.text, "Exact PDF text")
        self.assertEqual(paragraph.source, "pdf_text")
        self.assertEqual(paragraph.ocr_confidence, 1.0)

    def test_native_text_wins_overlap_and_ocr_only_supplements_empty_geometry(self):
        native = NativeTextLine(
            [20, 20, 90, 38],
            [NativeTextSpan("Exact", [20, 20, 90, 38], 11)],
            0,
        )
        layout_regions = [Region(
            kind="text",
            bbox=[10, 10, 290, 100],
            order=0,
            metadata={"paddle_ocr_lines": [
                {
                    "bbox": [18, 18, 180, 40],
                    "text": "Incorrect and much longer OCR replacement",
                    "confidence": 0.99,
                },
                {
                    "bbox": [20, 55, 180, 75],
                    "text": "OCR-only second line",
                    "confidence": 0.8,
                },
            ]},
        )]
        page = PageInput(
            _png(), native_lines=[native], dpi=300, preserve_geometry=True
        )

        with patch("ocr_pipeline.pipeline.analyze_layout", return_value=layout_regions), patch(
            "ocr_pipeline.pipeline.recognize_lines",
            side_effect=AssertionError("assigned page OCR should be reused"),
        ):
            region = analyze_document([page]).pages[0].regions[0]

        self.assertEqual(region.text, "Exact\nOCR-only second line")
        self.assertNotIn("Incorrect", region.text)
        self.assertEqual(region.source, "hybrid")
        self.assertTrue(region.native_text)

    def test_native_line_ownership_uses_smallest_matching_text_block(self):
        title_line = NativeTextLine(
            [30, 20, 140, 38],
            [NativeTextSpan("Specific title", [30, 20, 140, 38], 16, bold=True)],
            0,
        )
        body_line = NativeTextLine(
            [30, 60, 240, 78],
            [NativeTextSpan("Body line", [30, 60, 240, 78], 11)],
            1,
        )
        # The broad body is deliberately first and contains both lines.
        layout_regions = [
            Region(kind="text", bbox=[10, 10, 290, 100], order=1),
            Region(kind="paragraph_title", bbox=[20, 12, 160, 45], order=0),
        ]
        page = PageInput(
            _png(),
            native_lines=[title_line, body_line],
            dpi=300,
            preserve_geometry=True,
        )

        with patch("ocr_pipeline.pipeline.analyze_layout", return_value=layout_regions), patch(
            "ocr_pipeline.pipeline.recognize_lines",
            side_effect=AssertionError("native regions must bypass OCR"),
        ):
            regions = analyze_document([page]).pages[0].regions

        by_kind = {region.kind: region for region in regions}
        self.assertEqual(by_kind["paragraph_title"].text, "Specific title")
        self.assertEqual(by_kind["text"].text, "Body line")

    def test_native_table_text_is_not_duplicated_by_broad_text_block(self):
        cell_line = NativeTextLine(
            [40, 40, 90, 58],
            [NativeTextSpan("Cell", [40, 40, 90, 58], 11)],
            0,
        )
        table = NativeTable([30, 30, 200, 90], [["Cell"]])
        layout_regions = [
            Region(
                kind="text",
                bbox=[10, 10, 290, 120],
                order=0,
                metadata={"paddle_ocr_lines": []},
            ),
            Region(kind="table", bbox=[30, 30, 200, 90], order=1),
        ]
        page = PageInput(
            _png(),
            native_lines=[cell_line],
            native_tables=[table],
            dpi=300,
            preserve_geometry=True,
        )

        with patch("ocr_pipeline.pipeline.analyze_layout", return_value=layout_regions), patch(
            "ocr_pipeline.pipeline.recognize_lines",
            side_effect=AssertionError("assigned empty page OCR should be reused"),
        ):
            regions = analyze_document([page]).pages[0].regions

        text_region = next(region for region in regions if region.kind == "text")
        table_region = next(region for region in regions if region.kind == "table")
        self.assertEqual(text_region.text, "")
        self.assertEqual(table_region.res["rows"], [["Cell"]])

    def test_paddle_table_structure_is_not_overwritten_by_fragmented_pdf_grid(self):
        paddle_html = (
            "<table>"
            "<tr><th>Stakeholder</th><th>Benefits</th></tr>"
            "<tr><td>Individual Users</td><td>Convenience and tracking</td></tr>"
            "</table>"
        )
        region = Region(
            kind="table",
            bbox=[10, 10, 290, 190],
            role="table",
            res={"html": paddle_html, "content": ""},
        )
        fragmented_native = NativeTable(
            [10, 10, 290, 190],
            [
                ["Stakeholder", "", "Benefits", ""],
                ["", "", "", ""],
                ["Individual Users", "", "1. Convenience", ""],
                ["", "", "menstrual cycle", ""],
                ["", "", "tracking.", ""],
            ],
        )

        _apply_best_table_result(region, fragmented_native)

        self.assertEqual(region.res["html"], paddle_html)
        self.assertNotIn("rows", region.res)
        self.assertEqual(region.metadata["table_source"], "paddle_structure")
        self.assertEqual(region.metadata["native_table_candidate_shape"], [4, 2])

    def test_native_table_fallback_removes_empty_grid_rows_and_columns(self):
        rows = [
            ["Name", "", "Score", ""],
            ["", "", "", ""],
            ["Ada", "", "100", ""],
        ]
        self.assertEqual(
            _normalized_native_table_rows(rows),
            [["Name", "Score"], ["Ada", "100"]],
        )

        region = Region(kind="table", bbox=[0, 0, 100, 100], role="table")
        _apply_best_table_result(region, NativeTable([0, 0, 100, 100], rows))

        self.assertEqual(region.res["rows"], [["Name", "Score"], ["Ada", "100"]])
        self.assertEqual(region.metadata["table_source"], "pdf_table_fallback")

    def test_preprocessing_scale_updates_effective_dpi_for_crops(self):
        layout_regions = [Region(kind="figure", bbox=[20, 20, 100, 80])]
        doubled = np.full((400, 600, 3), 255, dtype=np.uint8)

        with patch("ocr_pipeline.pipeline.pre.preprocess_image", return_value=doubled), patch(
            "ocr_pipeline.pipeline.analyze_layout", return_value=layout_regions
        ):
            region = analyze_document([PageInput(_png(), dpi=150)]).pages[0].regions[0]

        self.assertAlmostEqual(region.metadata["source_image_dpi"], 150)
        self.assertAlmostEqual(region.metadata["effective_dpi"], 300)
        self.assertAlmostEqual(region.metadata["source_dpi"], 300)

    def test_scanned_region_keeps_normalized_ocr_confidence(self):
        layout_regions = [Region(
            kind="text",
            bbox=[10, 10, 290, 80],
            order=0,
            metadata={"paddle_ocr_lines": [{
                "bbox": [15, 15, 160, 35],
                "text": "Recognized text",
                "confidence": 0.87,
            }]},
        )]
        with patch("ocr_pipeline.pipeline.analyze_layout", return_value=layout_regions), patch(
            "ocr_pipeline.pipeline.recognize_lines", side_effect=AssertionError("page OCR should be reused")
        ):
            document = analyze_document([PageInput(_png())])

        region = document.pages[0].regions[0]
        self.assertEqual(region.text, "Recognized text")
        self.assertAlmostEqual(region.ocr_confidence, 0.87)
        self.assertEqual(region.source, "paddle_ocr")

    def test_empty_v3_assignment_uses_parser_content_without_second_ocr(self):
        layout_regions = [Region(
            kind="text",
            bbox=[10, 10, 290, 80],
            order=0,
            text="Parser block content",
            metadata={"paddle_ocr_available": True, "paddle_ocr_lines": []},
        )]
        with patch("ocr_pipeline.pipeline.analyze_layout", return_value=layout_regions), patch(
            "ocr_pipeline.pipeline.recognize_lines", side_effect=AssertionError("crop OCR must not run")
        ):
            document = analyze_document([PageInput(_png())])

        region = document.pages[0].regions[0]
        self.assertEqual(region.text, "Parser block content")
        self.assertEqual(region.source, "paddle_block_content")

    def test_heading_numbering_uses_context_and_does_not_treat_year_as_outline(self):
        self.assertIsNone(_numbering_depth("2026 Results"))
        self.assertEqual(_numbering_depth("1. Overview"), 1)
        self.assertEqual(_numbering_depth("2.3 Details"), 2)
        headings = [
            Region("paragraph_title", [0, 0, 100, 20], role="heading", text="I. Scope", style=TextStyle(18, (0, 0, 0), True, False)),
            Region("paragraph_title", [0, 30, 100, 50], role="heading", text="A. Inputs", style=TextStyle(16, (0, 0, 0), True, False)),
            Region("paragraph_title", [0, 60, 100, 80], role="heading", text="(a) Required", style=TextStyle(14, (0, 0, 0), True, False)),
        ]

        _assign_heading_hierarchy(headings)

        self.assertEqual([region.heading_level for region in headings], [1, 2, 3])

    def test_promotes_short_bold_recovered_native_block_to_heading(self):
        body = Region(
            "text", [10, 50, 290, 90], role="paragraph", text="Body copy",
            style=TextStyle(11, (0, 0, 0), False, False),
        )
        recovered = Region(
            "native_text", [10, 10, 150, 35], role="paragraph", text="Recovered title",
            style=TextStyle(16, (0, 0, 0), True, False),
            metadata={"recovered_without_layout": True},
        )

        _assign_heading_hierarchy([recovered, body])

        self.assertEqual(recovered.role, "heading")
        self.assertEqual(recovered.metadata["role_source"], "native_style")
        self.assertEqual(recovered.heading_level, 1)

    def test_alignment_ignores_page_wide_title_as_column_peer(self):
        def line(text, bbox):
            return NativeTextLine(bbox, [NativeTextSpan(text, bbox, 11)], 0)

        title = Region(
            "doc_title", [5, 5, 295, 35], role="document_title",
            lines=[line("Centered title", [90, 10, 210, 30])],
        )
        left = Region(
            "text", [10, 50, 140, 100], role="paragraph",
            lines=[line("left", [10, 55, 100, 70]), line("column", [10, 75, 120, 90])],
        )
        right = Region(
            "text", [160, 50, 290, 100], role="paragraph",
            lines=[line("right", [160, 55, 250, 70]), line("column", [160, 75, 270, 90])],
        )
        right_peer = Region(
            "text", [160, 110, 290, 150], role="paragraph",
            lines=[line("more", [160, 115, 250, 130])],
        )

        _assign_region_alignments([title, left, right, right_peer], 300)

        self.assertEqual(title.alignment, "center")
        self.assertEqual(left.alignment, "left")
        self.assertEqual(right.alignment, "left")

    def test_justification_requires_consistent_non_final_line_edges(self):
        def line(text, bbox):
            return NativeTextLine(bbox, [NativeTextSpan(text, bbox, 11)], 0)

        paragraph = Region(
            "text", [10, 10, 290, 100], role="paragraph",
            lines=[
                line("first", [10, 15, 290, 30]),
                line("second", [10, 40, 288, 55]),
                line("last", [10, 65, 180, 80]),
            ],
        )

        _assign_region_alignments([paragraph], 300)

        self.assertEqual(paragraph.alignment, "justify")


if __name__ == "__main__":
    unittest.main()
