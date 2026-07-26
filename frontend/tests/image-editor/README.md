# Image editor tests

## Coverage

- `ImageEditor.test.jsx` covers non-image upload isolation, upload defaults,
  page-workspace wiring, crop/text/annotation persistence, output-format
  selection, JPG-to-PNG export, GIF output preservation, render failures,
  editable output names, Unicode names, downloads, reset metadata, and fresh
  state for a replacement upload.
- `ImageEditorWorkspace.test.jsx` guards the standalone crop regression: the
  page applies contained image dimensions, uses its page-only crop class, and
  does not pass a fixed `aspect` value to `ReactCrop`.

The files are in-memory `File` and `Blob` objects. Rendering services are
mocked so the suite tests editor state and contracts without depending on real
image codecs.

The page records an error for a non-image selection, but that message is
currently rendered only after an image item exists. The test therefore verifies
that the invalid selection does not enter the workspace; displaying that error
in the empty uploader state remains a UI TODO.

Run this folder:

```sh
npm run test:unit -- tests/image-editor
```
