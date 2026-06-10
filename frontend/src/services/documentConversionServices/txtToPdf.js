import { jsPDF } from 'jspdf';

/**
 * Converts plain text to PDF.
 * @param {File|string} fileOrText 
 * @returns {Promise<Blob>}
 */
export const txtToPdf = async (fileOrText) => {
  let text = '';
  if (fileOrText instanceof File) {
    text = await fileOrText.text();
  } else {
    text = fileOrText;
  }

  const doc = new jsPDF();
  
  // Set margins and font
  const margin = 10;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxLineWidth = pageWidth - margin * 2;
  
  doc.setFont('helvetica');
  doc.setFontSize(12);

  // Split text into lines that fit the page width
  const lines = doc.splitTextToSize(text, maxLineWidth);
  
  // Draw lines onto pages
  let cursorY = margin;
  const pageHeight = doc.internal.pageSize.getHeight();

  lines.forEach(line => {
    if (cursorY + 10 > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
    }
    doc.text(line, margin, cursorY + 5);
    cursorY += 7; // Line spacing
  });

  return doc.output('blob');
};
