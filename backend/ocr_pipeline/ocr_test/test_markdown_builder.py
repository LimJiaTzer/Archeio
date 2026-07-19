import unittest

from ocr_pipeline.markdown_builder import document_to_markdown
from ocr_pipeline.models import DocumentIR, PageIR, Region


class MarkdownBuilderTests(unittest.TestCase):
    def test_exports_structure_formula_and_assets_without_losing_ir(self):
        image = b"image-bytes"
        document = DocumentIR(pages=[PageIR(page_index=0, regions=[
            Region(kind="doc_title", bbox=[0, 0, 1, 1], role="document_title", text="Report"),
            Region(kind="paragraph_title", bbox=[0, 0, 1, 1], role="heading", heading_level=2, text="2.1 Scope"),
            Region(kind="formula", bbox=[0, 0, 1, 1], role="formula", formula_latex="x^2 + y^2"),
            Region(kind="figure", bbox=[0, 0, 1, 1], role="figure", image_bytes=image),
        ])])

        exported = document_to_markdown(document)

        self.assertIn("# Report", exported.markdown)
        self.assertIn("## 2.1 Scope", exported.markdown)
        self.assertIn("x^2 + y^2", exported.markdown)
        self.assertEqual(list(exported.assets.values()), [image])

    def test_exports_native_table_rows_as_markdown(self):
        document = DocumentIR(pages=[PageIR(page_index=0, regions=[
            Region(
                kind="table",
                bbox=[0, 0, 100, 100],
                role="table",
                res={"rows": [["Name", "Value"], ["A|B", "line 1\nline 2"]]},
            ),
        ])])

        exported = document_to_markdown(document)

        self.assertIn("| Name | Value |", exported.markdown)
        self.assertIn("| A\\|B | line 1<br>line 2 |", exported.markdown)
        self.assertNotIn("{'rows'", exported.markdown)

    def test_exports_html_table_cells_without_double_escaping(self):
        document = DocumentIR(pages=[PageIR(page_index=0, regions=[
            Region(
                kind="table",
                bbox=[0, 0, 100, 100],
                role="table",
                res={"html": "<table><tr><th>A|B</th></tr><tr><td>C</td></tr></table>"},
            ),
        ])])

        exported = document_to_markdown(document)

        self.assertIn("| A\\|B |", exported.markdown)
        self.assertNotIn("A\\\\|B", exported.markdown)


if __name__ == "__main__":
    unittest.main()
