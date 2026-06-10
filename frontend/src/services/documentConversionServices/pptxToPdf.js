import JSZip from 'jszip';
import { txtToPdf } from './txtToPdf';

/**
 * Basic PPTX to PDF conversion (Text only).
 * Highly destructive to layout, but extracts meaningful content.
 * @param {File} file 
 * @returns {Promise<Blob>}
 */
export const pptxToPdf = async (file) => {
  const zip = await JSZip.loadAsync(file);
  let allText = '';

  // PPTX slides are in ppt/slides/slideN.xml
  const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
  
  // Sort slides numerically
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)\.xml/)[1]);
    const numB = parseInt(b.match(/slide(\d+)\.xml/)[1]);
    return numA - numB;
  });

  for (const name of slideFiles) {
    const content = await zip.file(name).async('string');
    // Simple regex to extract text within <a:t> tags
    const textMatches = content.match(/<a:t>([\s\S]*?)<\/a:t>/g);
    if (textMatches) {
      const slideText = textMatches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
      const slideNum = name.match(/slide(\d+)\.xml/)[1];
      allText += `--- Slide ${slideNum} ---\n${slideText}\n\n`;
    }
  }

  if (!allText) {
    allText = "Could not extract text from PPTX.";
  }

  return await txtToPdf(allText);
};
