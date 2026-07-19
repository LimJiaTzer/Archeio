import tempfile
import shutil
import os
import fitz
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.responses import Response, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pdf_converter import convert_to_pdf, LIBREOFFICE_FORMATS, EPUB_FORMATS
from ocr_pipeline.layout import selected_engine
from ocr_pipeline.pipeline import image_to_docx, images_to_docx

app = FastAPI(title="Archeio API")

OCR_IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff")
MAX_OCR_PDF_PAGES = 50


def prepare_ocr_pages(file_name: str, file_bytes: bytes) -> list[bytes]:
    """Return an image upload as one page or render every PDF page to PNG."""
    ext = os.path.splitext(file_name)[1].lower()
    if ext in OCR_IMAGE_EXTENSIONS:
        return [file_bytes]
    if ext != ".pdf":
        raise HTTPException(400, f"Unsupported OCR format: {ext}")

    try:
        pdf = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as exc:
        raise HTTPException(400, "Could not read the PDF.") from exc

    try:
        if not pdf.page_count:
            raise HTTPException(400, "The PDF has no pages.")
        if pdf.page_count > MAX_OCR_PDF_PAGES:
            raise HTTPException(400, f"PDFs are limited to {MAX_OCR_PDF_PAGES} pages per OCR request.")

        matrix = fitz.Matrix(200 / 72, 200 / 72)
        return [page.get_pixmap(matrix=matrix, alpha=False).tobytes("png") for page in pdf]
    finally:
        pdf.close()


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
        pages = prepare_ocr_pages(file.filename, await file.read())
        docx_bytes = images_to_docx(pages) if len(pages) > 1 else image_to_docx(pages[0])
    except HTTPException:
        raise
    except Exception as e:
        print(f"OCR-to-docx failed: {str(e)}")
        raise HTTPException(500, f"Conversion failed: {str(e)}")

    out_name = os.path.splitext(file.filename)[0] + ".docx"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
    )
