# Compression tests

## Coverage

- `Compress.test.jsx` covers synthetic image/audio/video uploads, category
  routing, the complete JPG workflow, output selection, batch and per-file
  ratios, returning to the batch default, isolated removal, edit flattening,
  corrupt-item isolation, unsupported files, near-limit metadata, Unicode
  names, downloads, repeated compression, and fresh state after removal.
- `ImageCompressionDropdown.test.jsx` covers estimated-size refreshes,
  per-file slider state, batch-default restoration, proportional resize,
  independent dimensions, and handing crop/text metadata back from the image
  editor.
- `ImagePreviewService.test.js` covers PNG MIME preservation, low/high
  compression estimates, resize calculations, slider extremes, tiny images,
  and corrupt-image rejection.
- `compressService.test.js` covers JPG, HEIC, SVG, animated GIF, PDF,
  DOCX/PPTX/XLSX, fake MP3, and fake MP4 routing and output metadata.

All fixtures are generated in memory. The MP3, MP4, HEIC, SVG, PDF, and Office
files are deliberately synthetic: these tests verify routing, UI state,
requests, MIME types, names, and callbacks—not real codec playback or document
integrity.

## Deliberately omitted / future tests

- A file over 100 MB cannot yet be tested as rejected because `Compress.jsx`
  does not currently enforce the advertised upload limit.
- A per-file reset test is not present because the compression queue currently
  offers `Remove` but no per-file `Reset` control.
- Real transparency pixels, readable PDFs, playable media, and valid Office
  archives require small binary fixtures or browser/backend integration tests.
  The synthetic suite only verifies that their MIME-specific pathways remain
  intact.
- Invalid resize values are not rejected by the current controls. The browser
  number input accepts them and the canvas helper clamps dimensions to at least
  one pixel.

Run this folder:

```sh
npm run test:unit -- tests/compression
```
