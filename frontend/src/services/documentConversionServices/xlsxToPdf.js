import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

export const xlsxToPdf = async (file) => {
  return new Promise(async (resolve, reject) => {
    let sandbox = null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      sandbox = document.createElement('div');
      sandbox.style.position = 'fixed';
      sandbox.style.top = '0';
      sandbox.style.left = '0';
      sandbox.style.width = '900px'; 
      sandbox.style.zIndex = '-9999';
      sandbox.style.background = '#ffffff';
      sandbox.style.padding = '30px';

      // Inject clean Excel-like styling into the temporary sandbox
      const style = document.createElement('style');
      style.innerHTML = `
        h2 { font-family: sans-serif; color: #107c41; margin-top: 20px; border-bottom: 2px solid #107c41; padding-bottom: 5px; }
        table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 11px; margin-bottom: 40px; page-break-inside: auto; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        th { background-color: #f3f3f3; color: #333; font-weight: bold; border: 1px solid #bbb; padding: 6px; text-align: left; }
        td { border: 1px solid #ddd; padding: 6px; white-space: nowrap; }
        tr:nth-child(even) { background-color: #f9f9f9; }
      `;
      sandbox.appendChild(style);

      // Loop through all sheets in the workbook and build HTML structures
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        const sheetTitle = document.createElement('h2');
        sheetTitle.innerText = sheetName;
        sandbox.appendChild(sheetTitle);

        const tableContainer = document.createElement('div');
        tableContainer.innerHTML = XLSX.utils.sheet_to_html(worksheet);
        sandbox.appendChild(tableContainer);
      });

      document.body.appendChild(sandbox);
      await new Promise((res) => setTimeout(res, 400)); // Paint delay

      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      await doc.html(sandbox, {
        callback: (pdfDoc) => {
          document.body.removeChild(sandbox);
          resolve(pdfDoc.output('blob'));
        },
        margin: [30, 30, 30, 30],
        autoPaging: 'text',
        width: 535,
        windowWidth: 900
      });
    } catch (err) {
      if (sandbox?.parentNode) document.body.removeChild(sandbox);
      reject(err);
    }
  });
};