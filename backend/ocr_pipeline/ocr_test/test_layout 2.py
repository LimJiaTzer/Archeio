import json
import unittest
from unittest.mock import patch

import numpy as np

from ocr_pipeline.layout import (
    _assign_ocr_lines_to_blocks,
    _block_content_is_shadowed,
    _column_reading_order,
    _matching_layout_box,
    _matching_result,
    _mean_scores,
    _prediction_payload,
    text_detection_limit,
)
from ocr_pipeline.models import Region


class LayoutNormalizationTests(unittest.TestCase):
    def test_text_detection_limit_is_configurable_and_bounded(self):
        with patch.dict("os.environ", {"OCR_TEXT_DET_LIMIT_SIDE_LEN": "3072"}):
            self.assertEqual(text_detection_limit(), 3072)
        with patch.dict("os.environ", {"OCR_TEXT_DET_LIMIT_SIDE_LEN": "10000"}):
            self.assertEqual(text_detection_limit(), 4096)
        with patch.dict("os.environ", {"OCR_TEXT_DET_LIMIT_SIDE_LEN": "invalid"}):
            self.assertEqual(text_detection_limit(), 2048)

    def test_normalizes_prediction_payload_across_paddle_result_forms(self):
        expected = {"parsing_res_list": [{"block_label": "text"}]}

        class JsonPropertyResult:
            json = {"res": expected}

        class JsonMethodResult(dict):
            # Real PaddleX results inherit from dict, so the JSON projection
            # must win over this intentionally unusable raw mapping.
            def __init__(self):
                super().__init__({"parsing_res_list": [object()]})

            def json(self):
                return json.dumps({"res": expected})

        class ToDictResult:
            json = "not JSON"

            def to_dict(self):
                return {"res": expected}

        predictions = [
            {"res": expected},
            {"status": "ok", "res": expected},
            json.dumps({"res": expected}),
            JsonPropertyResult(),
            JsonMethodResult(),
            ToDictResult(),
        ]
        for prediction in predictions:
            with self.subTest(prediction=type(prediction).__name__):
                self.assertEqual(_prediction_payload(prediction), expected)

    def test_rejects_unsupported_prediction_payload(self):
        with self.assertRaisesRegex(RuntimeError, "unsupported result format"):
            _prediction_payload("not JSON")

    def test_matches_nested_formula_box_and_numpy_layout_box(self):
        formula_results = json.dumps([{
            "rec_formula": "x^2",
            # PaddleX has emitted this one-element wrapper for dt_polys.
            "dt_polys": [[10, 20, 70, 45]],
        }])
        formula = _matching_result(formula_results, [10, 20, 70, 45])
        self.assertIsNotNone(formula)
        self.assertEqual(formula["rec_formula"], "x^2")

        payload = {"layout_det_res": {"boxes": [{
            "label": "formula",
            "score": 0.97,
            "coordinate": np.array([10, 20, 70, 45]),
        }]}}
        detector = _matching_layout_box(payload, "formula", [10, 20, 70, 45])
        self.assertIsNotNone(detector)
        self.assertAlmostEqual(detector["score"], 0.97)

    def test_reads_table_ocr_scores_from_wrapped_result(self):
        result = {
            "table_ocr_pred": {
                "res": {"rec_scores": np.array([0.8, 0.9, np.nan])},
            },
        }
        self.assertAlmostEqual(_mean_scores(result), 0.85)

    def test_assigns_each_ocr_line_to_one_smallest_text_block(self):
        blocks = [
            {"block_label": "text", "block_bbox": [10, 10, 190, 100]},
            {"block_label": "paragraph_title", "block_bbox": [15, 15, 95, 38]},
            {"block_label": "table", "block_bbox": [10, 110, 190, 180]},
        ]
        payload = {"overall_ocr_res": {
            "rec_texts": ["Nested title", "Body text", "Table cell"],
            "rec_scores": [0.99, 0.91, 0.88],
            "rec_boxes": [
                [20, 20, 90, 32],
                [20, 60, 170, 75],
                [20, 125, 80, 140],
            ],
        }}

        available, assignments = _assign_ocr_lines_to_blocks(payload, blocks)

        self.assertTrue(available)
        self.assertEqual([line["text"] for line in assignments[0]], ["Body text"])
        self.assertEqual([line["text"] for line in assignments[1]], ["Nested title"])
        self.assertEqual(assignments[2], [])
        owned = [id(line) for lines in assignments.values() for line in lines]
        self.assertEqual(len(owned), len(set(owned)))

    def test_marks_empty_overlapping_parser_block_as_duplicate_content(self):
        blocks = [
            {"block_label": "text", "block_bbox": [0, 0, 200, 80], "block_content": "Same title"},
            {"block_label": "paragraph_title", "block_bbox": [10, 10, 100, 35], "block_content": "Same title"},
        ]
        payload = {"overall_ocr_res": {
            "rec_texts": ["Same title"],
            "rec_scores": [0.99],
            "rec_boxes": [[15, 15, 95, 30]],
        }}
        _, assignments = _assign_ocr_lines_to_blocks(payload, blocks)

        self.assertTrue(_block_content_is_shadowed(0, blocks, assignments))
        self.assertFalse(_block_content_is_shadowed(1, blocks, assignments))

    def test_ocr_assignment_preserves_column_reading_order(self):
        blocks = [{"block_label": "text", "block_bbox": [0, 0, 110, 60]}]
        payload = {"overall_ocr_res": {
            "rec_texts": ["R1", "L2", "R2", "L1"],
            "rec_scores": [1, 1, 1, 1],
            "rec_boxes": [
                [60, 10, 100, 20], [0, 30, 40, 40],
                [60, 30, 100, 40], [0, 10, 40, 20],
            ],
        }}

        _, assignments = _assign_ocr_lines_to_blocks(payload, blocks)

        self.assertEqual(
            [line["text"] for line in assignments[0]],
            ["L1", "L2", "R1", "R2"],
        )

    def test_geometric_fallback_handles_spanning_title_and_columns(self):
        regions = [
            Region("text", [60, 30, 100, 40]),
            Region("title", [0, 0, 100, 8]),
            Region("text", [0, 10, 40, 20]),
            Region("text", [60, 10, 100, 20]),
            Region("text", [0, 30, 40, 40]),
        ]

        ordered = _column_reading_order(regions, 100)

        self.assertEqual(
            [region.bbox for region in ordered],
            [[0, 0, 100, 8], [0, 10, 40, 20], [0, 30, 40, 40],
             [60, 10, 100, 20], [60, 30, 100, 40]],
        )


if __name__ == "__main__":
    unittest.main()
