# OCR tests

## Coverage

- `Ocr.test.jsx` covers multiple upload, duplicate suppression, sequential
  conversion, isolated failures, generated DOCX selection, and preview
  rendering.
- `ocrUtils.test.js` covers supported sources, deduplication keys, output names,
  and zoom bounds.
- `ocr.e2e.spec.js` covers the multi-file frontend workflow and real
  `docx-preview` rendering against a mocked OCR HTTP response.

Paddle inference is intentionally absent here. FastAPI and document-pipeline
tests live in `backend/ocr_pipeline/ocr_test`; heavyweight model quality checks
remain separate from pull-request CI.

Run the Vitest tests in this folder:

```sh
npm run test:unit -- tests/ocr
```

Run its browser smoke test:

```sh
npm run test:e2e -- tests/ocr
```
