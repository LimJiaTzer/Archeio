import JSZip from 'jszip';
import { jsPDF } from 'jspdf';

export const epubToPdf = async (file) => {
  return new Promise(async (resolve, reject) => {
    let sandbox = null;
    try {
      const zip = await JSZip.loadAsync(file);
      let cumulativeHtml = '';

      // Extract all readable markup resources
      for (const [filename, fileData] of Object.entries(zip.files)) {
        if (filename.endsWith('.xhtml') || filename.endsWith('.html')) {
          let textChunk = await fileData.async('text');
          // Clean out restrictive <head> parameters that lock sizing rules
          textChunk = textChunk.replace(/<head>[\s\S]*?<\/head>/gi, '');
          cumulativeHtml += `<div class="epub-chapter">${textChunk}</div>`;
        }
      }

      sandbox = document.createElement('div');
      sandbox.style.position = 'fixed';
      sandbox.style.top = '0';
      sandbox.style.left = '0';
      sandbox.style.width = '800px';
      sandbox.style.zIndex = '-9999';
      sandbox.style.background = '#ffffff';
      sandbox.innerHTML = cumulativeHtml;

      // Stylize to mimic a clean physical book layout
      const style = document.createElement('style');
      style.innerHTML = `
        .epub-chapter { page-break-after: always; padding: 20px; }
        p { font-family: Georgia, serif; font-size: 14px; line-height: 1.6; text-align: justify; text-indent: 2em; margin: 0 0 10px 0; }
        h1, h2, h3 { font-family: sans-serif; text-align: center; margin-top: 30px; }
      `;
      sandbox.appendChild(style);

      document.body.appendChild(sandbox);
      await new Promise((res) => setTimeout(res, 500));

      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      await doc.html(sandbox, {
        callback: (pdfDoc) => {
          document.body.removeChild(sandbox);
          resolve(pdfDoc.output('blob'));
        },
        margin: [50, 50, 50, 50],
        autoPaging: 'text',
        width: 495,
        windowWidth: 800
      });
    } catch (err) {
      if (sandbox?.parentNode) document.body.removeChild(sandbox);
      reject(err);
    }
  });
};