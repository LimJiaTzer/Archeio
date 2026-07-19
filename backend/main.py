import tempfile
import shutil
import os
import asyncio
import re
import unicodedata
from collections.abc import Iterable, Iterator
from urllib.parse import quote
from fastapi import FastAPI, UploadFile, HTTPException
from starlette.concurrency import run_in_threadpool
from fastapi.responses import Response, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pdf_converter import convert_to_pdf, LIBREOFFICE_FORMATS, EPUB_FORMATS
from ocr_pipeline.layout import selected_engine
from ocr_pipeline.models import PageInput
from ocr_pipeline.pdf_source import iter_pdf_page_inputs
from ocr_pipeline.pipeline import pages_to_docx
from ocr_pipeline.preprocess import iter_image_page_inputs

app = FastAPI(title="Archeio API")

OCR_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff")
MAX_OCR_PDF_PAGES = 50
MAX_OCR_IMAGE_PAGES = 50


def _positive_int_env(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return value if value > 0 else default


MAX_OCR_UPLOAD_BYTES = _positive_int_env(
    "MAX_OCR_UPLOAD_BYTES", 100 * 1024 * 1024
)
_ocr_conversion_lock = asyncio.Lock()


def attachment_header(file_name: str) -> str:
    """Build a CRLF-safe Content-Disposition value with Unicode support."""
    clean_name = os.path.basename(file_name).replace("\r", "_").replace("\n", "_")
    ascii_name = unicodedata.normalize("NFKD", clean_name).encode("ascii", "ignore").decode()
    ascii_name = re.sub(r'[^A-Za-z0-9._ -]', "_", ascii_name).strip() or "document.docx"
    return (
        f'attachment; filename="{ascii_name}"; '
        f"filename*=UTF-8''{quote(clean_name, safe='')}"
    )


def _request_pages(pages: Iterable[PageInput]) -> Iterator[PageInput]:
    """Translate validation failures raised during lazy decoding to HTTP 400."""
    try:
        yield from pages
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


def prepare_ocr_pages(file_name: str, file_bytes: bytes) -> Iterable[PageInput]:
    """Prepare pixels plus any lossless PDF text layer for document analysis."""
    if len(file_bytes) > MAX_OCR_UPLOAD_BYTES:
        raise HTTPException(
            413,
            f"OCR uploads are limited to {MAX_OCR_UPLOAD_BYTES // 1024 // 1024} MB.",
        )
    ext = os.path.splitext(file_name)[1].lower()
    if ext in OCR_IMAGE_EXTENSIONS:
        return _request_pages(
            iter_image_page_inputs(file_bytes, MAX_OCR_IMAGE_PAGES)
        )
    if ext != ".pdf":
        raise HTTPException(400, f"Unsupported OCR format: {ext}")

    # Opening/rendering is intentionally lazy so a 50-page PDF never retains
    # all page rasters at once. The wrapper preserves request-level errors
    # raised when pages_to_docx advances the iterator in its worker thread.
    return _request_pages(iter_pdf_page_inputs(file_bytes, MAX_OCR_PDF_PAGES))


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to Archeio API"}


@app.get("/ocr/engine")
def ocr_engine_status():
    """Expose the selected parser generation for rollout and benchmark checks."""
    import paddleocr
    return {
        "engine": selected_engine(),
        "paddleocr_version": getattr(paddleocr, "__version__", "unknown"),
    }

@app.post("/convert/to-pdf")
async def convert_endpoint(file: UploadFile):
    ext = os.path.splitext(file.filename)[1].lower()
    
    if ext not in LIBREOFFICE_FORMATS and ext not in EPUB_FORMATS:
        raise HTTPException(400, f"Unsupported format: {ext}")

    # Create a temporary directory that stays alive long enough to serve the file
    tmp_dir = tempfile.mkdtemp()
    input_path = os.path.join(tmp_dir, file.filename)

    try:
        # Save the upload to disk
        with open(input_path, 'wb') as f:
            shutil.copyfileobj(file.file, f)

        pdf_path = convert_to_pdf(input_path, tmp_dir)

        if not os.path.exists(pdf_path):
            raise HTTPException(500, "Conversion produced no output")

        # We return a Response with the content and then clean up
        with open(pdf_path, 'rb') as f:
            content = f.read()
            
        return Response(
            content=content,
            media_type='application/pdf',
            headers={'Content-Disposition': f'attachment; filename="{os.path.basename(pdf_path)}"'}
        )

    except Exception as e:
        print(f"Conversion failed: {str(e)}")
        raise HTTPException(500, f"Conversion failed: {str(e)}")
    finally:
        # Clean up the temporary directory
        shutil.rmtree(tmp_dir, ignore_errors=True)

@app.post("/convert/image-to-docx")
async def image_to_docx_endpoint(file: UploadFile):
    try:
        file_name = file.filename or "upload"
        # Paddle's process-wide model instances are not concurrency-safe. Keep
        # the spooled upload on disk while earlier conversions finish, then
        # read and process one bounded request in the worker at a time.
        async with _ocr_conversion_lock:
            file_bytes = await file.read(MAX_OCR_UPLOAD_BYTES + 1)
            pages = await run_in_threadpool(prepare_ocr_pages, file_name, file_bytes)
            docx_bytes = await run_in_threadpool(pages_to_docx, pages)
    except HTTPException:
        raise
    except Exception as e:
        print(f"OCR-to-docx failed: {str(e)}")
        raise HTTPException(500, f"Conversion failed: {str(e)}")

    out_name = os.path.splitext(file_name)[0] + ".docx"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": attachment_header(out_name)},
    )
