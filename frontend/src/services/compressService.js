import { getOutputInfo } from '../lib/fileTypes';
import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

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

        setDownloadUrl(dataUrl);

        const base64Str = dataUrl.split(',')[1];
        const actualCompressedBytes = atob(base64Str).length;

        const baseName =
          file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

        setCompressedFileName(`${baseName}_compressed.${outputType.ext}`);

        const savedPercentage = Math.round(
          ((file.size - actualCompressedBytes) / file.size) * 100
        );

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

/*
1. Read uploaded PDF
2. Load PDF using pdfjs
3. For pages 1 to last page:
   - get page
   - render page onto canvas
   - convert canvas to compressed JPEG
   - add JPEG into new PDF
4. Turn new PDF into Blob
5. Set everything else
  - DownloadURL
  - fileName
  - Result sizes and stuff
  - setCompressing(false)
*/
// for now no searchable doc --> Link OCR to this also 
// OCR will be done seperately / linked with this site 
// TODO: Extension --> allow for rendering and adjusting of quality of output pdf 
// Fixed compression level for now 
export const compressDocument = async ({ // needs to be async 
  file,
  format,
  // ratio,
  setDownloadUrl,
  setCompressedFileName,
  setResult,
  setCompressing,
}) => {
  try {
    const outputType = getOutputInfo(format, 'documents');

    if (!outputType || format !== 'PDF') {
      throw new Error('Only PDF to PDF compression is supported for now.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // resolution and compression hardcoded for now; can make use of ratio in future 
    const renderScale = 1.0;
    const jpegQuality = 0.6;

    let newPdf = null;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: renderScale });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      const imgData = canvas.toDataURL('image/jpeg', jpegQuality);

      const orientation =
        viewport.width > viewport.height ? 'landscape' : 'portrait';

      if (!newPdf) {
        newPdf = new jsPDF({
          orientation,
          unit: 'pt',
          format: [viewport.width, viewport.height],
        });
      } else {
        newPdf.addPage([viewport.width, viewport.height], orientation);
      }

      newPdf.addImage(
        imgData,
        'JPEG',
        0,
        0,
        viewport.width,
        viewport.height
      );
    }

    const compressedBlob = newPdf.output('blob');
    const downloadUrl = URL.createObjectURL(compressedBlob);

    const baseName =
      file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

    setDownloadUrl(downloadUrl);
    setCompressedFileName(`${baseName}_compressed.${outputType.ext}`);

    const savedPercentage = Math.round(
      ((file.size - compressedBlob.size) / file.size) * 100
    );

    setResult({
      originalSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      compressedSize: (compressedBlob.size / 1024 / 1024).toFixed(2) + ' MB',
      ratio: Math.max(0, savedPercentage) + '%',
    });

    setCompressing(false);
  } catch (err) {
    console.error('PDF compression error:', err);
    setCompressing(false);
    alert(err.message);
  }
};

export const compressAudio = () => {
  alert('Audio compression not supported yet.');
  // TODO:
};

export const compressVideo = () => {
  alert('Video compression not supported yet.');
  // TODO: 
};


