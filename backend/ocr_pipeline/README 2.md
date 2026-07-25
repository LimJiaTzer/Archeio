# OCR pipeline

The converter uses a structured document representation (`models.py`) as its
source of truth. Markdown is available as an export/debug view, but is not used
as the intermediate format because it cannot retain geometry, confidence,
mixed text runs, highlights, merged cells, or fallback images.

## Processing stages

1. `pdf_source.py` lazily renders PDFs at 300 DPI and preserves usable embedded
   text spans, font metadata, highlight annotations, and native table cells.
2. `preprocess.py` applies EXIF orientation, reads sane image DPI, lazily splits
   multi-page TIFF/image frames, and cleans raster pages. Rendered PDF pages
   with native geometry bypass deskewing so PDF/image coordinates stay aligned.
3. `layout.py` runs PP-StructureV3 and retains semantic labels, confidence,
   structured table/formula output, and reading order. Page OCR lines are
   assigned to one most-specific block so overlapping parser boxes cannot
   duplicate text.
4. `pipeline.py` routes each region independently:
   - Exact PDF spans win conflicts; OCR can only fill uncovered geometry.
   - Scanned text uses PP-OCRv5 and retains line confidence.
   - Paddle's table model owns logical row/column structure. Cleaned native PDF
     tables are used only when Paddle has no structured table result.
   - Formulas retain FormulaNet LaTeX plus a crop from the analyzed page.
   - Figures, charts, diagrams, seals, and logos use analyzed-page crops.
5. Heading levels are resolved across the whole document. Paddle identifies
   coarse `doc_title` and `paragraph_title` roles, but does not return reliable
   H1/H2/H3 levels. Explicit numbering and outline context are used first,
   followed by document-wide font-size clusters.
6. `docx_builder.py` emits native Word paragraphs, H1-H6 styles, mixed font
   runs, literal list markers, captions, bounded editable tables, highlights,
   real section headers/footers, embedded assets, and editable OMML math. Any
   unsupported formula/table still falls back to its analyzed-page crop.

## Runtime options

- `OCR_ENGINE=paddle_v3` selects PP-StructureV3 explicitly.
- `OCR_DEVICE=cpu` is the supported Mac setting. CUDA GPU requires a supported
  non-macOS PaddlePaddle GPU installation.
- `OCR_ENABLE_FORMULA_RECOGNITION=true` is the accuracy default. Set it to
  `false` for faster CPU startup and exact formula-image fallback only.
- `OCR_TEXT_CLEANUP_URL` optionally enables one text-only cleanup pass through
  an OpenAI-compatible chat-completions endpoint. Set
  `OCR_TEXT_CLEANUP_MODEL` and, when needed, `OCR_TEXT_CLEANUP_API_KEY`. Native
  PDF text, images, tables, and document geometry are never sent to this step.
  This is an optional, lossy correction pass: proposed edits must remain close
  to the OCR text and preserve standalone numeric values. Configure the guard
  with `OCR_TEXT_CLEANUP_MIN_SIMILARITY` (default `0.55`).
- `MAX_OCR_UPLOAD_BYTES` limits OCR uploads in both the Node proxy and FastAPI
  service (default 100 MB). `OCR_MIN_IMAGE_WIDTH` controls raster upscaling
  (default 1600). `OCR_TEXT_DET_LIMIT_SIDE_LEN` controls Paddle's detector-side
  resize (default 2048, bounded to 960-4096). For dense tiny text, raise both
  values together, for example 2400 and 3072; this trades CPU time for detail.
  `OCR_MAX_IMAGE_PIXELS`, `OCR_MAX_IMAGE_TOTAL_PIXELS`,
  `OCR_MAX_PDF_PAGE_PIXELS`, and `OCR_MAX_PDF_TOTAL_PIXELS` bound decoded and
  rendered page memory.

`npm run setup` initializes the required models up front. Paddle stores them in
its per-user cache (normally `~/.paddlex/official_models`) and later runs reuse
them. `npm run setup:without-models` skips this large download, in which case
the first accurate-mode conversion initializes the cache instead.
