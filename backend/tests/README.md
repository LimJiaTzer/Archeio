# Node backend tests

These tests exercise the Express boundary used by Convert and OCR:

- Missing-file validation.
- Unsupported conversion rejection and temporary-file cleanup.
- OCR multipart proxy success and upstream error forwarding.
- Safe Unicode `Content-Disposition` filenames.

`server.js` exports the Express app and starts network listeners only when run as
the entry point. Tests therefore never launch Uvicorn. A small local HTTP server
stands in for FastAPI when the proxy stream itself is under test.

Run from `backend` with:

```sh
npm run test
```

