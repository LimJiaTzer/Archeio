# Convert tests

## Coverage

- `Convert.test.jsx` covers multiple-file upload, persistent upload controls,
  batch conversion, isolated failures, and queue reset.
- `conversionService.test.js` covers converter routing, FFmpeg commands,
  unsupported conversions, and ZIP contents.
- `fileTypes.test.js` covers MIME, extension, and output-format contracts.
- `convert.e2e.spec.js` performs a real canvas-backed PNG-to-JPEG conversion
  and validates the downloaded bytes in Chromium.

Component tests mock codec engines. Service tests validate routing and
artifacts, while Playwright owns browser canvas and download behavior.

Run the Vitest tests in this folder:

```sh
npm run test:unit -- tests/convert
```

Run its browser smoke test:

```sh
npm run test:e2e -- tests/convert
```
