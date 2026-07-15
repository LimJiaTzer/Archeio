import tempfile
import shutil
import os
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.responses import Response, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pdf_converter import convert_to_pdf, LIBREOFFICE_FORMATS, EPUB_FORMATS
from ocr_pipeline.pipeline import image_to_docx
from ocr_pipeline.simple_pipeline import image_to_text as simple_image_to_text
from ocr_pipeline.simple_pipeline import image_to_docx_simple

app = FastAPI(title="Archeio API")


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
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"):
        raise HTTPException(400, f"Unsupported image format: {ext}")

    try:
        image_bytes = await file.read()
        docx_bytes = image_to_docx(image_bytes)
    except Exception as e:
        print(f"OCR-to-docx failed: {str(e)}")
        raise HTTPException(500, f"Conversion failed: {str(e)}")

    out_name = os.path.splitext(file.filename)[0] + ".docx"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
    )

# Text-only preview using the simplified, layout-free pipeline (whole-page
# OCR, no region cropping).
@app.post("/ocr/simple-preview")
async def ocr_simple_preview_endpoint(file: UploadFile):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"):
        raise HTTPException(400, f"Unsupported image format: {ext}")

    try:
        image_bytes = await file.read()
        text = simple_image_to_text(image_bytes)
    except Exception as e:
        print(f"Simple OCR preview failed: {str(e)}")
        raise HTTPException(500, f"Simple OCR preview failed: {str(e)}")

    return {"text": text, "engine": "paddleocr-simple"}

# Full docx download using the simplified, layout-free pipeline.
@app.post("/convert/simple-to-docx")
async def simple_image_to_docx_endpoint(file: UploadFile):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"):
        raise HTTPException(400, f"Unsupported image format: {ext}")

    try:
        image_bytes = await file.read()
        docx_bytes = image_to_docx_simple(image_bytes)
    except Exception as e:
        print(f"Simple OCR-to-docx failed: {str(e)}")
        raise HTTPException(500, f"Conversion failed: {str(e)}")

    out_name = os.path.splitext(file.filename)[0] + ".docx"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{out_name}"'},
    )

