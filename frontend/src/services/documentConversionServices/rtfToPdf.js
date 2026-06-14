import { convertRtfToHtml } from 'rtf-to-html-converter';
import { jsPDF } from 'jspdf';

export const rtfToPdf = async (file) => {
  return new Promise(async (resolve, reject) => {
    let sandbox = null;
    try {
      const textRaw = await file.text();
      const HTMLParsedString = convertRtfToHtml(textRaw);

      sandbox = document.createElement('div');
      sandbox.style.position = 'fixed';
      sandbox.style.top = '0';
      sandbox.style.left = '0';
      sandbox.style.width = '800px';
      sandbox.style.zIndex = '-9999';
      sandbox.style.background = '#ffffff';
      sandbox.style.fontFamily = 'Times New Roman, serif'; // RTF default fallback
      sandbox.style.lineHeight = '1.5';
      sandbox.innerHTML = HTMLParsedString;

      document.body.appendChild(sandbox);
      await new Promise((res) => setTimeout(res, 300));

      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      await doc.html(sandbox, {
        callback: (pdfDoc) => {
          document.body.removeChild(sandbox);
          resolve(pdfDoc.output('blob'));
        },
        margin: [40, 40, 40, 40],
        autoPaging: 'text',
        width: 515,
        windowWidth: 800
      });
    } catch (err) {
      if (sandbox?.parentNode) document.body.removeChild(sandbox);
      reject(err);
    }
  });
};