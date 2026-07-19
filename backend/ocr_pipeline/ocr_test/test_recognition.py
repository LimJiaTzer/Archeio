import json
import unittest

from ocr_pipeline import recognition


class _ModernResult:
    def __init__(self, payload, as_json_string=False):
        value = {"res": payload}
        self.json = json.dumps(value) if as_json_string else value


class _ModernEngine:
    def __init__(self, result):
        self.result = result
        self.called_with = None

    def predict(self, image):
        self.called_with = image
        return (item for item in self.result)


class _LegacyEngine:
    def __init__(self, result):
        self.result = result
        self.called_with = None

    def ocr(self, image, cls=False):
        self.called_with = (image, cls)
        return self.result


class RecognitionAdapterTests(unittest.TestCase):
    def setUp(self):
        self.previous_engine = recognition._ocr_engine

    def tearDown(self):
        recognition._ocr_engine = self.previous_engine

    def test_normalizes_v3_ocr_result_and_orders_rows(self):
        result = _ModernResult({
            "rec_texts": ["right", "second row", "left"],
            "rec_scores": [0.92, 0.81, 0.97],
            "rec_polys": [
                [[60, 10], [100, 10], [100, 20], [60, 20]],
                [[5, 40], [80, 40], [80, 50], [5, 50]],
                [[5, 11], [45, 11], [45, 21], [5, 21]],
            ],
        })
        engine = _ModernEngine([result])
        recognition._ocr_engine = engine

        lines = recognition.recognize_lines("image")

        self.assertEqual([line["text"] for line in lines], ["left", "right", "second row"])
        self.assertEqual(lines[0]["bbox"], [5.0, 11.0, 45.0, 21.0])
        self.assertEqual(lines[1]["confidence"], 0.92)
        self.assertEqual(engine.called_with, "image")

    def test_accepts_v3_json_string_and_rectangular_rec_boxes(self):
        result = _ModernResult({
            "rec_texts": ["boxed"],
            "rec_scores": [0.75],
            "rec_boxes": [[1, 2, 30, 12]],
        }, as_json_string=True)

        lines = recognition.normalize_ocr_result([result])

        self.assertEqual(lines, [{
            "bbox": [1.0, 2.0, 30.0, 12.0],
            "polygon": [[1.0, 2.0], [30.0, 2.0], [30.0, 12.0], [1.0, 12.0]],
            "text": "boxed",
            "confidence": 0.75,
        }])

    def test_normalizes_legacy_v2_nested_result(self):
        legacy_result = [[
            [[[50, 2], [90, 2], [90, 12], [50, 12]], ("world", 0.8)],
            [[[2, 2], [42, 2], [42, 12], [2, 12]], ("hello", 0.9)],
        ]]
        engine = _LegacyEngine(legacy_result)
        recognition._ocr_engine = engine

        lines = recognition.recognize_lines("crop")

        self.assertEqual([line["text"] for line in lines], ["hello", "world"])
        self.assertEqual(lines[0]["confidence"], 0.9)
        self.assertEqual(engine.called_with, ("crop", False))

    def test_handles_direct_v3_dict_missing_scores_or_boxes(self):
        lines = recognition.normalize_ocr_result({
            "rec_texts": ["text only", ""],
            "rec_scores": [],
        })

        self.assertEqual(len(lines), 1)
        self.assertEqual(lines[0]["text"], "text only")
        self.assertIsNone(lines[0]["confidence"])
        self.assertEqual(lines[0]["bbox"], [0.0, 0.0, 0.0, 0.0])

    def test_handles_empty_and_malformed_results(self):
        self.assertEqual(recognition.normalize_ocr_result(None), [])
        self.assertEqual(recognition.normalize_ocr_result([None, {"res": {}}]), [])

    def test_orders_multi_column_lines_down_each_column(self):
        lines = [
            {"text": "R1", "bbox": [60, 10, 100, 20]},
            {"text": "L2", "bbox": [0, 30, 40, 40]},
            {"text": "R2", "bbox": [60, 30, 100, 40]},
            {"text": "L1", "bbox": [0, 10, 40, 20]},
        ]

        ordered = recognition._reading_order(lines)

        self.assertEqual([line["text"] for line in ordered], ["L1", "L2", "R1", "R2"])


if __name__ == "__main__":
    unittest.main()
