import { getOutputInfo } from '../lib/fileTypes';
import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from 'pdf-lib';

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

const loadImageBlob = (blob) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load PDF image stream.'));
    };

    img.src = url;
  });

const compressPdfImageStream = async (node, ratio) => {
  try {
    const { dict } = node;

    const widthVal = dict.get(PDFName.of('Width'));
    const heightVal = dict.get(PDFName.of('Height'));
    if (!widthVal || !heightVal) return null;

    const width = widthVal.asNumber();
    const height = heightVal.asNumber();

    const filter = dict.get(PDFName.of('Filter'));
    const colorSpace = dict.get(PDFName.of('ColorSpace'));

    const isDCT =
      filter === PDFName.of('DCTDecode') ||
      filter?.toString?.().includes('DCTDecode');

    let rawBytes;

    if (isDCT) {
      rawBytes = node.contents;
    } else if (typeof node.getUncompressedContents === 'function') {
      rawBytes = node.getUncompressedContents();
    } else {
      return null;
    }

    if (!rawBytes || !(rawBytes instanceof Uint8Array)) return null;

    let imgSource = null;

    if (isDCT) {
      const blob = new Blob([rawBytes], { type: 'image/jpeg' });
      imgSource = await loadImageBlob(blob);
    } else {
      const isRGB =
        colorSpace === PDFName.of('DeviceRGB') ||
        colorSpace?.toString?.().includes('DeviceRGB');

      const isGray =
        colorSpace === PDFName.of('DeviceGray') ||
        colorSpace?.toString?.().includes('DeviceGray');

      if (!isRGB && !isGray) return null;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const imageData = ctx.createImageData(width, height);
      const totalPixels = width * height;

      let srcIdx = 0;
      let dstIdx = 0;

      if (isRGB && rawBytes.length >= totalPixels * 3) {
        for (let i = 0; i < totalPixels; i++) {
          imageData.data[dstIdx] = rawBytes[srcIdx];
          imageData.data[dstIdx + 1] = rawBytes[srcIdx + 1];
          imageData.data[dstIdx + 2] = rawBytes[srcIdx + 2];
          imageData.data[dstIdx + 3] = 255;

          srcIdx += 3;
          dstIdx += 4;
        }
      } else if (isGray && rawBytes.length >= totalPixels) {
        for (let i = 0; i < totalPixels; i++) {
          const g = rawBytes[srcIdx];

          imageData.data[dstIdx] = g;
          imageData.data[dstIdx + 1] = g;
          imageData.data[dstIdx + 2] = g;
          imageData.data[dstIdx + 3] = 255;

          srcIdx += 1;
          dstIdx += 4;
        }
      } else {
        return null;
      }

      ctx.putImageData(imageData, 0, 0);
      imgSource = canvas;
    }

    const quality = Math.max(0.1, Math.min(0.9, (100 - ratio) / 100));

    let scale = 1.0;
    if (ratio > 75) scale = 0.5;
    else if (ratio > 50) scale = 0.75;
    else scale = 0.9;

    const outWidth = Math.max(8, Math.round(width * scale));
    const outHeight = Math.max(8, Math.round(height * scale));

    const outCanvas = document.createElement('canvas');
    outCanvas.width = outWidth;
    outCanvas.height = outHeight;

    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return null;

    outCtx.drawImage(imgSource, 0, 0, outWidth, outHeight);

    const compressedBytes = await new Promise((resolve) => {
      outCanvas.toBlob(async (blob) => {
        if (!blob) return resolve(null);
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, 'image/jpeg', quality);
    });

    if (!compressedBytes) return null;

    if (compressedBytes.length >= node.contents.length) {
      return null;
    }

    return {
      bytes: compressedBytes,
      width: outWidth,
      height: outHeight,
    };
  } catch (err) {
    console.warn('Could not compress PDF image stream:', err);
    return null;
  }
};

// TODO: Introduce batch processing next time 
// TODO: Extension --> allow for rendering and adjusting of quality of output pdf 
// PDF compression logic 
export const compressDocument = async ({
  file,
  ratio,
  format,
  setDownloadUrl,
  setCompressedFileName,
  setResult,
  setCompressing,
}) => {
  try {
    setCompressing(true);

    if (format !== 'PDF') {
      throw new Error('Only PDF to PDF compression is supported for now.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    // const indirectObjects = pdfDoc.context.enumerateKeysAndValues();
    const indirectObjects = pdfDoc.context.indirectObjects;

    for (const [ref, node] of indirectObjects) {
      if (!(node instanceof PDFRawStream)) continue;

      const subtype = node.dict.get(PDFName.of('Subtype'));

      if (subtype !== PDFName.of('Image')) continue;

      const result = await compressPdfImageStream(node, ratio);

      if (!result) continue;

      const newRawStream = PDFRawStream.of(node.dict, result.bytes);

      newRawStream.dict.set(PDFName.of('Width'), PDFNumber.of(result.width));
      newRawStream.dict.set(PDFName.of('Height'), PDFNumber.of(result.height));
      newRawStream.dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
      newRawStream.dict.delete(PDFName.of('DecodeParms'));

      // pdfDoc.context.set(ref, newRawStream);
      pdfDoc.context.indirectObjects.set(ref, newRawStream);
    }

    const compressedPdfBytes = await pdfDoc.save({
      useObjectStreams: true,
      updateMetadata: false,
    });

    const compressedBlob = new Blob([compressedPdfBytes], {
      type: 'application/pdf',
    });

    const downloadUrl = URL.createObjectURL(compressedBlob);

    const baseName =
      file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

    setDownloadUrl(downloadUrl);
    setCompressedFileName(`${baseName}_compressed.pdf`);

    const savedPercentage = Math.round(
      ((file.size - compressedBlob.size) / file.size) * 100
    );

    setResult({
      originalSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      compressedSize: (compressedBlob.size / 1024 / 1024).toFixed(2) + ' MB',
      ratio: Math.max(0, savedPercentage) + '%',
    });
  } catch (err) {
    console.error('PDF compression error:', err);
    alert('Failed to compress PDF: ' + err.message);
  } finally {
    setCompressing(false);
  }
};


// Audio compression logic 
export const compressAudio = () => {
  alert('Audio compression not supported yet.');
  // TODO:
};

// Video compression logic 
export const compressVideo = () => {
  alert('Video compression not supported yet.');
  // TODO: 
};


