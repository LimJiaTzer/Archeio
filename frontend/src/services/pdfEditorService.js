import { PDFDocument, degrees } from 'pdf-lib';

/**
 * Helper to convert a Base64 data URL to an ArrayBuffer synchronously.
 * This is 100% offline and bypasses any Content Security Policy (CSP) fetch restrictions.
 * 
 * @param {string} dataUrl 
 * @returns {ArrayBuffer}
 */
export const dataUrlToArrayBuffer = (dataUrl) => {
  const base64 = dataUrl.split(',')[1];
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Compiles a new PDF document from a list of pages with rotations and placed signatures on the client-side.
 * 
 * @param {Array} pagesList - Array of page items: { id, file, originalPageNum, rotation }
 * @param {Object} placedSignatures - Mapping of pageId -> signatureObject: { img, x, y, width, height }
 * @param {Object} pageDimensions - Rendered canvas page dimensions: { width, height }
 * @returns {Promise<Blob>} - Resolves to the compiled PDF Blob.
 */
export const compilePDF = async (pagesList, placedSignatures, pageDimensions) => {
  if (!pagesList || pagesList.length === 0) {
    throw new Error('No pages to export.');
  }

  const mergedDoc = await PDFDocument.create();
  const loadedCache = new Map(); // Cache source documents to prevent redundant reads

  for (const pageItem of pagesList) {
    // Load source document into cache if not already loaded
    if (!loadedCache.has(pageItem.file)) {
      const fileBytes = await pageItem.file.arrayBuffer();
      const doc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
      loadedCache.set(pageItem.file, doc);
    }

    const srcDoc = loadedCache.get(pageItem.file);
    const [copiedPage] = await mergedDoc.copyPages(srcDoc, [pageItem.originalPageNum - 1]);
    
    // Apply Rotations
    if (pageItem.rotation !== 0) {
      copiedPage.setRotation(degrees(pageItem.rotation));
    }

    // Embed placed signatures (supports single objects or arrays of objects)
    const sigs = placedSignatures[pageItem.id];
    if (sigs) {
      const sigList = Array.isArray(sigs) ? sigs : [sigs];
      for (const sig of sigList) {
        // Decode PNG signature bytes offline if it is a data URL (bypasses CSP restrictions)
        let sigImageBytes;
        if (sig.img.startsWith('data:')) {
          sigImageBytes = dataUrlToArrayBuffer(sig.img);
        } else {
          sigImageBytes = await fetch(sig.img).then(res => res.arrayBuffer());
        }
        
        const embeddedSig = await mergedDoc.embedPng(sigImageBytes);

        const { width: pWidth, height: pHeight } = copiedPage.getSize();
        
        // Determine actual dimensions based on rotation
        const isRotatedOrtho = pageItem.rotation === 90 || pageItem.rotation === 270;
        const actualPDFWidth = isRotatedOrtho ? pHeight : pWidth;
        const actualPDFHeight = isRotatedOrtho ? pWidth : pHeight;

        // Map canvas overlay coordinates back to PDF space
        const pdfX = (sig.x / 100) * actualPDFWidth;
        const pdfY = actualPDFHeight - (((sig.y / 100) + (sig.height / pageDimensions.height)) * actualPDFHeight);
        const pdfWidth = (sig.width / pageDimensions.width) * actualPDFWidth;
        const pdfHeight = (sig.height / pageDimensions.height) * actualPDFHeight;

        // Apply rotation transformation adjustment for drawn signature overlay
        if (pageItem.rotation === 90) {
          copiedPage.drawImage(embeddedSig, {
            x: actualPDFHeight - pdfY - pdfHeight,
            y: pdfX,
            width: pdfHeight,
            height: pdfWidth,
          });
        } else if (pageItem.rotation === 180) {
          copiedPage.drawImage(embeddedSig, {
            x: actualPDFWidth - pdfX - pdfWidth,
            y: actualPDFHeight - pdfY - pdfHeight,
            width: pdfWidth,
            height: pdfHeight,
          });
        } else if (pageItem.rotation === 270) {
          copiedPage.drawImage(embeddedSig, {
            x: pdfY,
            y: actualPDFHeight - pdfX - pdfWidth,
            width: pdfHeight,
            height: pdfWidth,
          });
        } else {
          copiedPage.drawImage(embeddedSig, {
            x: pdfX,
            y: pdfY,
            width: pdfWidth,
            height: pdfHeight,
          });
        }
      }
    }

    mergedDoc.addPage(copiedPage);
  }

  const finalPdfBytes = await mergedDoc.save();
  return new Blob([finalPdfBytes], { type: 'application/pdf' });
};
