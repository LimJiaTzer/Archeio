# QR Code Creator tests

## Coverage

- `QRCodeCreator.test.jsx` verifies that user input updates the QR engine and
  that downloads request the selected artifact format.
- `qrCodePayload.test.js` verifies link, text, Wi-Fi, phone, and email payloads,
  including reserved-character escaping.
- `qr-code.e2e.spec.js` generates a real QR code, decodes it, and validates the
  downloaded PNG bytes in Chromium.

The renderer is mocked in the component test because jsdom has no complete
canvas implementation. Playwright provides the real rendering boundary.

Run the Vitest tests in this folder:

```sh
npm run test:unit -- tests/qr-code
```

Run its browser smoke test:

```sh
npm run test:e2e -- tests/qr-code
```
