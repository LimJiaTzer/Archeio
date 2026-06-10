import JSZip from 'jszip';
import { htmlToPdf } from './htmlToPdf';

/**
 * Basic EPUB to PDF conversion by extracting XHTML/HTML content.
 * @param {File} file 
 * @returns {Promise<Blob>}
 */
export const epubToPdf = async (file) => {
  const zip = await JSZip.loadAsync(file);
  let fullHtml = '';

  // EPUB usually has content in OEBPS or similar, with .xhtml or .html files
  // We'll look for all html/xhtml files and concatenate them
  const files = Object.keys(zip.files).filter(name => name.endsWith('.xhtml') || name.endsWith('.html'));
  
  // Sort them if possible? Usually they are named in order
  files.sort();

  for (const name of files) {
    const content = await zip.file(name).async('string');
    // Remove headers/head to avoid multiple html/body tags if concatenating
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) {
      fullHtml += `<div>${bodyMatch[1]}</div><div style="page-break-after: always;"></div>`;
    } else {
      fullHtml += `<div>${content}</div><div style="page-break-after: always;"></div>`;
    }
  }

  if (!fullHtml) {
    throw new Error('Could not extract any content from EPUB.');
  }

  return await htmlToPdf(fullHtml, file.name.replace('.epub', '.pdf'));
};
