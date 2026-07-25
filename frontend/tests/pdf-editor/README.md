# PDF Editor tests

## Coverage

- `PDFEditor.test.jsx` covers upload, rendering, rotation, export, and reset.
- `pdfEditorService.test.js` creates PDFs in memory, compiles them, reloads the
  result, and verifies page order, dimensions, rotation, and annotation
  coordinates.
- `pdf-editor.e2e.spec.js` exercises PDF.js rendering, rotation, browser export,
  and parseable downloaded output.

PDF.js is mocked only in the component test. Artifact tests use real `pdf-lib`
documents and the browser smoke test uses the real worker.

Run the Vitest tests in this folder:

```sh
npm run test:unit -- tests/pdf-editor
```

Run its browser smoke test:

```sh
npm run test:e2e -- tests/pdf-editor
```
