# OCR pipeline tests

## Test layers

- `test_preprocess.py` and `test_pdf_source.py`: input validation, page limits,
  image orientation, PDF text extraction, highlights, and resource budgets.
- `test_layout.py`, `test_recognition.py`, and `test_tables.py`: Paddle result
  normalization, reading order, region ownership, formulas, and table structure.
- `test_pipeline.py`: integration of native PDF content with OCR/layout results.
- `test_docx_builder.py` and `test_markdown_builder.py`: generated document
  structure, styles, formulas, tables, headers, and embedded assets.
- `test_text_cleanup.py`: optional text-only cleanup service boundaries.
- `test_api_helpers.py` and `test_api_endpoints.py`: upload limits, supported
  formats, multipart responses, filenames, and error mapping.

## Model boundary

Pull-request tests mock Paddle model inference. They verify Archeio's contracts
without downloading model weights or depending on model drift. Real-model
accuracy belongs in the manually triggered benchmark workflow.

Run from `backend` with:

```sh
../venv/bin/python3 -m unittest discover -s ocr_pipeline/ocr_test -p 'test_*.py'
```

Tests must generate small fixtures in memory and must not write model caches or
temporary documents into the repository.

