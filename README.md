# Archeio

Archeio is a comprehensive web-based file manipulation and conversion tool. It supports a wide range of formats, including documents (Office, PDF, EPUB, RTF), images (including HEIC and SVG), audio, and video.

## 🚀 Features
- **Document Conversion**: Convert DOCX, XLSX, PPTX, RTF, ODT, HTML, and TXT to PDF.
- **Ebook Conversion**: Convert EPUB to PDF.
- **Image Conversion**: High-quality conversion between PNG, JPEG, WEBP, GIF, SVG, ICO, and HEIC.
- **PDF Compression**: Reduce PDF file size using Ghostscript.
- **Audio/Video Processing**: Leverage FFmpeg for media manipulation (client-side).

---

## 🛠 Prerequisites (System Dependencies)

Archeio relies on several powerful open-source engines for server-side processing. You **must** install these on your machine (or server) for the conversion and compression features to work.

### macOS
```bash
# Install via Homebrew
brew install --cask libreoffice calibre
brew install ghostscript
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y libreoffice calibre ghostscript
```

### Windows
1.  **LibreOffice**: Download and install from [libreoffice.org](https://www.libreoffice.org/download/download/).
2.  **Calibre**: Download and install from [calibre-ebook.com](https://calibre-ebook.com/download).
3.  **Ghostscript**: Download and install from [ghostscript.com](https://ghostscript.com/releases/gsdnld.html).
4.  *Note: Ensure the binaries (soffice.exe, ebook-convert.exe, gswin64c.exe) are added to your System PATH.*

---

## ⚙️ Setup Instructions

Install Node.js 20.19+ (or 22.12+) and Python 3.10+ first. The setup command
creates one Python environment at `./venv`; do not create a second PaddleOCR
environment.

### 1. Clone the repository
```bash
git clone <repository-url>
cd Archeio
```

### 2. Run the Setup Wizard
Run the setup wizard to automatically install frontend and backend Node dependencies, configure the Python virtual environment, install Python libraries, and create configuration files:
```bash
npm run setup
```

This installs the frontend and backend npm packages, installs all Python OCR
dependencies (including PaddlePaddle, PaddleOCR with the `doc-parser` extra,
FastAPI, OpenCV, and the DOCX libraries), verifies the installation, and
downloads the PP-StructureV3 model weights. The initial model download is
large and may take several minutes. Paddle stores the weights in its user cache
and reuses them on later runs.

For CI or a limited connection, install packages without preloading weights:

```bash
npm run setup:without-models
```

In that mode, Paddle downloads model weights during the first OCR conversion.
The wizard also checks for LibreOffice, Calibre, and Ghostscript and prints
platform-specific installation instructions when they are missing. These are
system applications and cannot be installed portably by npm.

---

## 🏃‍♂️ Running the Project

You need to run both the frontend and the backend simultaneously.

### Start the Backend
```bash
cd backend
npm run dev
```

### Start the Frontend
```bash
cd frontend
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## 🏗 Architecture
- **Frontend**: React + Vite, Tailwind CSS.
- **Backend**: Node.js (Express) for orchestration and file handling.
- **Conversion Engines**: LibreOffice (Office), Calibre (EPUB), Ghostscript (PDF), Python/Pillow (HEIC).
