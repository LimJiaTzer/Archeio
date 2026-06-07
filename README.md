# Archeío

> Powerful file utilities. All together.

Archeío is a privacy-first document and media utility platform that helps users unlock, convert, compress, and process files through a single streamlined application. The platform combines OCR, file conversion, media processing, and compression tools into one integrated system for both web and mobile.

---
## Quick start

### Prerequisites

- Node.js >= 18
- npm >= 9

### 1. Install

```bash
git clone <repo-url>
cd Archeio/frontend
npm install
```

### 2. Run the App
```npm run dev```

### 3. Open Local URL shown in terminal
Usually ```http://localhost:5173/```


---

## Features

### Core Features

#### Document Format Conversion

* Convert between common document formats
* Examples:

  * Image → Word
  * Word → PDF
  * PDF → Searchable Document

#### File Compression & Editing

* Image compression with adjustable compression levels
* Aspect ratio resizing and optimization
* ZIP archive compression
* Basic media editing and resizing

#### Media Conversion

* MP4 → MP3
* MOV → MP4
* WAV → MP3

---

### Extended Features

#### OCR-Based Document Unlocking

* Extract text from scanned PDFs and images
* Generate searchable documents
* Convert scanned files into editable Word documents

#### Smart Searchable PDFs

* Overlay OCR-generated text onto scanned PDFs
* Enable Ctrl/Cmd + F functionality for scanned documents

#### Batch Processing

* Process multiple files simultaneously

#### Privacy-First Processing

* Temporary file storage
* Automatic file deletion after processing
* Local processing support for sensitive documents

#### Audio to MIDI Conversion

* Convert audio files into MIDI format

---

## Motivation

Modern workflows frequently involve scanned documents, screenshots, lecture slides, receipts, and PDFs containing text that cannot be searched or edited.

Existing solutions are often fragmented across multiple websites, many of which:

* contain intrusive advertisements
* impose usage limitations
* raise privacy concerns
* provide inconsistent user experiences

Archeío aims to solve this problem by consolidating multiple document and media utilities into a single cohesive platform.

---

## Use Cases

### Students

Convert scanned lecture notes and PDFs into searchable documents for faster studying.

### Office Workers

Transform scanned documents into editable Word files without manual retyping.

### Researchers

Search across large collections of scanned papers efficiently.

### General Users

Compress and convert files before uploading or sharing online.

---

## Tech Stack

### Frontend

* React.js
* React Native
* HTML / CSS
* Tailwind CSS

### Backend

* Python
* FastAPI / Flask

### OCR & Document Processing

* Tesseract OCR
* PyPDF
* pdfplumber
* LLM integrations

### File Processing

* Pillow
* OpenCV
* ZIP utilities


## Development Roadmap

### Milestone 1 — Prototype System

* Basic file conversion capabilities 
* Image → Word conversion
* File conversion pipeline
* Basic compression functionality for images and PDF
* Frontend UI implementation

### Milestone 2 — OCR Development

* Complete compression functionality 
* File upload interface
* Backend upload handling
* PDF → searchable text conversion
* OCR extraction for image files
* OCR text export functionality
* Batch file processing

### Milestone 3 — Extended System

* Searchable PDF generation
* Advanced compression settings
* Improved UI/UX
* Secure temporary file handling
* Performance optimization and testing


## Team

### Team Archeío

Lim Jia Tzer
Nathanial Lim Guanning

---
