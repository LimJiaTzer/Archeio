import { getOutputInfo } from '../lib/fileTypes';

// Image compression logic 
export const compressImage = ({
  file,
  ratio,
  format,
  setDownloadUrl,
  setCompressedFileName,
  setResult,
  setCompressing,
}) => {
  const reader = new FileReader();

  reader.onload = (e) => {
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');

        let scale = 1.0;
        if (ratio > 75) {
            scale = 0.7;
        } else if (ratio > 50) {
            scale = 0.85;
        }

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create canvas context');

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // quality range = [0.05, 0.95] 
        const quality = Math.max(0.05, Math.min(0.95, (100 - ratio) / 100));

        // Output type form dictionary in compressService.js 
        const outputType = getOutputInfo(format, 'images');
        if (!outputType) {
          throw new Error(`${format} output is not supported yet`);
        }

        const dataUrl =
          outputType.mime === 'image/png'
            ? canvas.toDataURL(outputType.mime)
            : canvas.toDataURL(outputType.mime, quality);

        const base64Str = dataUrl.split(',')[1];
        const actualCompressedBytes = atob(base64Str).length;
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

        const savedPercentage = Math.round(
          ((file.size - actualCompressedBytes) / file.size) * 100
        );

        setDownloadUrl(dataUrl);
        setCompressedFileName(`${baseName}_compressed.${outputType.ext}`);
        setResult({
          originalSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          compressedSize:
            (actualCompressedBytes / 1024 / 1024).toFixed(2) + ' MB',
          ratio: Math.max(0, savedPercentage) + '%',
        });
        setCompressing(false);
      } catch (err) {
        console.error('Image compression error:', err);
        setCompressing(false);
        alert(err.message);
      }
    };

    img.onerror = () => {
      setCompressing(false);
      alert('This image type cannot be loaded by the browser.');
    };

    img.src = e.target?.result;
  };

  reader.onerror = () => {
    setCompressing(false);
    alert('Error reading file.');
  };

  reader.readAsDataURL(file);
};


// TODO: Introduce batch processing next time 
// TODO: Extension --> allow for rendering and adjusting of quality of output pdf 
// PDF compression logic

const PDFJS_VERSION = '3.11.174';
const PDFJS_CDN     = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER  = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
const PDFLIB_CDN    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload  = resolve;
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(s);
  });

const getPdfjsLib = async () => {
  await loadScript(PDFJS_CDN);
  const lib = window.pdfjsLib;
  if (!lib) throw new Error('pdfjsLib not found on window after script load');
  lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return lib;
};

const getPdfLib = async () => {
  if (window.PDFLib) return window.PDFLib;
  await loadScript(PDFLIB_CDN);
  if (!window.PDFLib) throw new Error('PDFLib not found on window after script load');
  return window.PDFLib;
};
 
/**
 * Map the 0-100 "compression ratio" slider to concrete render/quality settings.
 *
 * ratio = 0   → lossless-ish  (keep original DPI, high JPEG quality)
 * ratio = 100 → maximum crush (low DPI, low JPEG quality)
 *
 * The DPI used for rendering controls how many pixels PDF.js puts on the canvas;
 * lower DPI = smaller canvas = smaller JPEG regardless of quality setting.
 */
const ratioToSettings = (ratio) => {
  if (ratio <= 10) return { dpi: 150, jpegQuality: 0.92 }; // very light touch
  if (ratio <= 25) return { dpi: 144, jpegQuality: 0.85 };
  if (ratio <= 50) return { dpi: 120, jpegQuality: 0.75 }; // balanced (default)
  if (ratio <= 75) return { dpi: 96,  jpegQuality: 0.60 }; // strong
  return              { dpi: 72,  jpegQuality: 0.45 };      // maximum
};
 
/**
 * Render one PDF page to a canvas and return it as a JPEG Uint8Array.
 *
 * @param {PDFPageProxy} page      - PDF.js page object
 * @param {number}       dpi       - target render resolution
 * @param {number}       quality   - JPEG quality in [0, 1]
 * @returns {Promise<Uint8Array>}
 */
const pageToJpegBytes = (page, dpi, quality) =>
  new Promise((resolve, reject) => {
    const BASE_DPI = 72; // PDF user-space is 72 pt/inch
    const scale    = dpi / BASE_DPI;
    const viewport = page.getViewport({ scale });
 
    const canvas = document.createElement('canvas');
    canvas.width  = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
 
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Could not create canvas context'));
 
    // White background so transparent PDFs compress well as JPEG
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
 
    page
      .render({ canvasContext: ctx, viewport })
      .promise.then(() => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Canvas toBlob failed'));
            blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)));
          },
          'image/jpeg',
          quality
        );
      })
      .catch(reject);
  });
 
/**
 * Compress a PDF file by rasterising every page to a JPEG at the given
 * compression ratio and reassembling into a new PDF with pdf-lib.
 *
 * @param {object} params
 * @param {File}     params.file
 * @param {number}   params.ratio               - 0 (light) … 100 (maximum)
 * @param {Function} params.setDownloadUrl
 * @param {Function} params.setCompressedFileName
 * @param {Function} params.setResult
 * @param {Function} params.setCompressing
 * @param {Function} [params.onProgress]        - optional (currentPage, totalPages)
 */
export const compressDocument = async ({
  file,
  ratio = 50,
  setDownloadUrl,
  setCompressedFileName,
  setResult,
  setCompressing,
  onProgress,
}) => {
  try {
    // ── 1. Read the file as an ArrayBuffer ─────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
 
    // ── 2. Load PDF.js and open the document ───────────────────────────────
    const pdfjsLib = await getPdfjsLib();
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
 
    if (totalPages === 0) throw new Error('PDF has no pages.');
 
    // ── 3. Derive render settings from the compression ratio ───────────────
    const { dpi, jpegQuality } = ratioToSettings(ratio);
 
    // ── 4. Render every page → JPEG bytes ──────────────────────────────────
    const pageJpegs = []; // Array<{ bytes: Uint8Array, width: number, height: number }>
 
    for (let i = 1; i <= totalPages; i++) {
      const page     = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: dpi / 72 });
      const bytes    = await pageToJpegBytes(page, dpi, jpegQuality);
 
      pageJpegs.push({
        bytes,
        width:  Math.round(viewport.width),
        height: Math.round(viewport.height),
      });
 
      onProgress?.(i, totalPages);
    }
 
    // ── 5. Assemble the output PDF with pdf-lib ────────────────────────────
    const { PDFDocument } = await getPdfLib();
    const outPdf = await PDFDocument.create();
 
    // PDF points: 1 pt = 1/72 inch. At `dpi` DPI, each canvas pixel = 72/dpi pt.
    const pixelsToPt = (px) => (px * 72) / dpi;
 
    for (const { bytes, width, height } of pageJpegs) {
      const jpgImage = await outPdf.embedJpg(bytes);
      const ptWidth  = pixelsToPt(width);
      const ptHeight = pixelsToPt(height);
 
      const page = outPdf.addPage([ptWidth, ptHeight]);
 
      // Draw the JPEG flush to fill the whole page
      page.drawImage(jpgImage, { x: 0, y: 0, width: ptWidth, height: ptHeight });
    }
 
    // ── 6. Serialise and report results ────────────────────────────────────
    const compressedBytes = await outPdf.save();
    const blob            = new Blob([compressedBytes], { type: 'application/pdf' });
    const downloadUrl     = URL.createObjectURL(blob);
 
    const baseName = file.name.replace(/\.pdf$/i, '');
    const savedPct = Math.round(
      ((file.size - compressedBytes.byteLength) / file.size) * 100
    );
 
    setDownloadUrl(downloadUrl);
    setCompressedFileName(`${baseName}_compressed.pdf`);
    setResult({
      originalSize:   (file.size / 1024 / 1024).toFixed(2) + ' MB',
      compressedSize: (compressedBytes.byteLength / 1024 / 1024).toFixed(2) + ' MB',
      ratio:          Math.max(0, savedPct) + '%',
    });
    setCompressing(false);
  } catch (err) {
    console.error('PDF compression error:', err);
    setCompressing(false);
    alert('PDF compression failed: ' + err.message);
  }
};


export const compressAudio = () => {
  alert('Audio compression not supported yet.');
  // TODO:
};

// Video compression logic 
export const compressVideo = () => {
  alert('Video compression not supported yet.');
  // TODO: 
};


