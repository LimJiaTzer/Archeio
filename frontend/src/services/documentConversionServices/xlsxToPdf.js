import * as XLSX from 'xlsx';
import { htmlToPdf } from './htmlToPdf';

/**
 * Converts XLSX to PDF by first converting to an HTML Table.
 * @param {File} file 
 * @returns {Promise<Blob>}
 */
export const xlsxToPdf = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  // Combine all sheets into one HTML string or just take the first one?
  // Let's take the first one for simplicity, or iterate through them.
  let fullHtml = '';
  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const html = XLSX.utils.sheet_to_html(worksheet);
    fullHtml += `<h3>Sheet: ${sheetName}</h3>` + html + '<hr/>';
  });

  return await htmlToPdf(fullHtml, file.name.replace('.xlsx', '.pdf'));
};
