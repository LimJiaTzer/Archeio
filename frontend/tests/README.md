# Frontend test suites

All maintained frontend tests are grouped by product feature:

| Folder | Feature |
| --- | --- |
| `convert` | File conversion |
| `pdf-editor` | PDF editing and export |
| `qr-code` | QR code creation |
| `ocr` | OCR upload, conversion, and DOCX preview |
| `compression` | File compression, image previews, and compression settings |
| `image-editor` | Standalone image editing, state persistence, and export |

Each feature folder owns its component tests, service or helper tests, browser
smoke test, and documentation. Shared documents are generated in memory by
`fixtures/documents.js`; do not commit large binary fixtures.

File suffixes identify the runner:

- `*.test.js` and `*.test.jsx` run with Vitest.
- `*.e2e.spec.js` runs with Playwright.

Run all Vitest tests with `npm run test:unit`. Run all browser smoke tests with
`npm run test:e2e`.
