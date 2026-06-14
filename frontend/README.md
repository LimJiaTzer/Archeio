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

### 1. Clone the repository
```bash
git clone <repository-url>
cd Archeio
```

### 2. Backend Setup (Node.js)
```bash
cd backend
npm install
```

### 3. Backend Setup (Python Venv)
Required for HEIC conversion logic.
```bash
# From the root directory
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install pillow pillow_heif
```

### 4. Frontend Setup
```bash
cd ../frontend
npm install
```

### 5. Environment Variables
Create a `.env` file in the `frontend` directory:
```env
VITE_API_URL=http://localhost:3001
```

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
