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

Archeio relies on several open-source engines for server-side processing. The
macOS and Linux launcher can install them after asking for permission. They are
required for the corresponding conversion and compression features.

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

Install Node.js 20.19+ (or 22.12+) and Python 3.10–3.13 first. PaddleOCR does
not currently support Python 3.14. The setup command creates one Python
environment at `./venv`; do not create a second PaddleOCR environment.

### 1. Clone the repository
```bash
git clone <repository-url>
cd Archeio
```

### 2. Start Archeio

After installing Node.js and Python, use the single launcher. It installs all
Node and Python dependencies, downloads OCR models, starts the backend and
frontend, and opens Archeio in your default browser.

| Operating system | Launcher |
| --- | --- |
| macOS | Double-click `start.command` (or run `./start.command`) |
| Linux | Run `./start.sh` |
| Windows | Double-click `start.bat` |

When LibreOffice, Calibre, or Ghostscript are missing, the launcher asks
permission to install them on macOS and Linux. On Windows it prints the manual
download links. You can continue without the related Office, EPUB, and PDF
conversion features.

You can also run the setup step by itself:

```bash
npm run setup
```

This installs the frontend and backend npm packages, installs all Python OCR
dependencies (including PaddlePaddle, PaddleOCR with the `doc-parser` extra,
FastAPI, OpenCV, and the DOCX libraries), verifies the installation, and
downloads the PP-StructureV3 model weights. The initial model download is
large and may take several minutes. Paddle stores the weights in its user cache
and reuses them on later runs.

The launchers select the newest installed compatible interpreter, preferring
Python 3.13 and falling back through Python 3.10. They reject Python 3.14. If
`./venv` was previously created with Python 3.14, remove only that generated
virtual-environment folder and rerun the launcher so it can be recreated.

The launcher also checks for LibreOffice, Calibre, and Ghostscript. These are
system applications and cannot be installed portably by npm.

---

## 🏃‍♂️ Running the Project

After the first setup, start both services from the project root:

```bash
npm run dev
```

This directly starts the backend and frontend. For first-time installation,
use `start.command` instead.

---

## 🏗 Architecture
- **Frontend**: React + Vite, Tailwind CSS.
- **Backend**: Node.js (Express) for orchestration and file handling.
- **Conversion Engines**: LibreOffice (Office), Calibre (EPUB), Ghostscript (PDF), Python/Pillow (HEIC).
