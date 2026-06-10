import html2pdf from 'html2pdf.js';

/**
 * Converts HTML content (string or element) to a PDF Blob.
 * @param {string|HTMLElement} content 
 * @param {string} filename 
 * @returns {Promise<Blob>}
 */
export const htmlToPdf = async (content, filename = 'document.pdf') => {
  const options = {
    margin: 10,
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  // If content is a string, we might want to wrap it in a div if it's not a full HTML
  let element = content;
  if (typeof content === 'string') {
    element = document.createElement('div');
    element.innerHTML = content;
  }

  // html2pdf.output(type) can return a Blob if used with worker
  const pdfBlob = await html2pdf().from(element).set(options).output('blob');
  return pdfBlob;
};
