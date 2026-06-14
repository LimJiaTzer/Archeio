import { renderAsync } from 'docx-preview';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

window.html2canvas = html2canvas;

/**
 * Converts DOCX to PDF with rendering safeguards to prevent blank outputs.
 * @param {File} file 
 * @returns {Promise<Blob>}
 */
export const docxToPdf = async (file) => {
  return new Promise(async (resolve, reject) => {
    let sandbox = null;
    try {
      // 1. Create a safer container hidden safely behind the viewport
      sandbox = document.createElement('div');
      sandbox.style.position = 'fixed';
      sandbox.style.top = '0';
      sandbox.style.left = '0';
      sandbox.style.width = '850px';   // Standard layout wrapper width
      sandbox.style.height = 'auto';
      sandbox.style.zIndex = '-9999'; // Places it behind your visible website app
      sandbox.style.background = '#ffffff';
      sandbox.style.opacity = '1';    // CRITICAL: html2canvas generates blank images if opacity is 0
      document.body.appendChild(sandbox);

      // 2. Render the document layout tree
      await renderAsync(file, sandbox, undefined, {
        inWrapper: false,
        ignoreWidth: false,
        ignoreHeight: false,
      });

      // 3. The Secret Sauce: Wait for the browser to calculate layout and paint
      // This ensures text-wrapping and image dimensions compute above 0px height.
      await new Promise((res) => setTimeout(res, 400));

      // Debug check: If this is 0, the element is layout-collapsed
      if (sandbox.clientHeight === 0) {
        throw new Error("Sandbox rendering height collapsed to 0px.");
      }

      // 4. Compile to PDF via jsPDF
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'pt',
        format: 'a4',
      });

      await doc.html(sandbox, {
        callback: function (pdfDoc) {
          // 5. Clean up the DOM element completely
          if (sandbox && sandbox.parentNode) {
            document.body.removeChild(sandbox);
          }
          resolve(pdfDoc.output('blob'));
        },
        margin: [30, 30, 30, 30],
        autoPaging: 'text',
        x: 0,
        y: 0,
        width: 535, 
        windowWidth: 850 // Matches the exact width of our sandbox layout
      });

    } catch (error) {
      // Emergency DOM clean up if the sequence breaks
      if (sandbox && sandbox.parentNode) {
        document.body.removeChild(sandbox);
      }
      console.error('Client-side DOCX conversion failed:', error);
      reject(error);
    }
  });
};