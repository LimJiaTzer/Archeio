import mammoth from 'mammoth';
import { htmlToPdf } from './htmlToPdf';

/**
 * Converts DOCX to PDF by first converting to HTML.
 * @param {File} file 
 * @returns {Promise<Blob>}
 */
export const docxToPdf = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Convert docx to HTML
  const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
  const html = result.value; // The generated HTML
  
  // Use htmlToPdf to convert the HTML to PDF
  return await htmlToPdf(html, file.name.replace('.docx', '.pdf'));
};
