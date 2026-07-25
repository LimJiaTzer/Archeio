# Archeio testing guide

The maintained automated suite currently covers Convert, PDF Editor, QR Code
Creator, and OCR.

## Test layers

| Layer | Location | Purpose |
| --- | --- | --- |
| Frontend feature | `frontend/tests/<feature>` | Component, service/artifact, and browser tests grouped by product feature |
| Node API | `backend/tests` | Express upload, conversion, and OCR proxy contracts |
| OCR pipeline/API | `backend/ocr_pipeline/ocr_test` | Python document analysis and DOCX generation |

Every feature test directory contains a README describing ownership and
boundaries. Tests should be placed at the lowest layer capable of proving the
behavior. Files ending in `.e2e.spec.js` are reserved for behavior that jsdom
cannot represent and run with Playwright instead of Vitest.

## Commands

From the repository root:

```sh
npm test
npm run test:e2e
```

Focused frontend commands:

```sh
npm --prefix frontend run test:unit
npm --prefix frontend run test:coverage
npm --prefix frontend run lint:features
```

Focused backend commands:

```sh
npm --prefix backend test
npm --prefix backend run test:ocr
```

## Maintenance rules

- Assert public behavior and artifact validity, not internal call order unless
  the call is the integration contract.
- Generate small fixtures in memory.
- Do not commit generated coverage, Playwright reports, downloads, or model
  caches.
- Mock Paddle inference in pull-request tests. Keep real-model quality checks
  separate because they are slow and model-version sensitive.
- Add a regression test before or with every bug fix.
- Avoid snapshots for document output. Parse the PDF, DOCX, ZIP, or QR result
  and assert the structure that matters.
- Coverage is a guardrail, not a target for low-value assertions.
