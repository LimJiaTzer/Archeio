import { pptxToHtml } from '@jvmr/pptx-to-html';
import { jsPDF } from 'jspdf';

export const pptxToPdf = async (file) => {
  return new Promise(async (resolve, reject) => {
    let sandbox = null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Generates an array of individual HTML strings, one per slide
      const slidesHtmlArray = await pptxToHtml(arrayBuffer, { width: 960, height: 540 });

      sandbox = document.createElement('div');
      sandbox.style.position = 'fixed';
      sandbox.style.top = '0';
      sandbox.style.left = '0';
      sandbox.style.width = '960px'; // Set to match widescreen layout canvas rules
      sandbox.style.zIndex = '-9999';
      sandbox.style.background = '#ffffff';

      // Assemble slide segments with hardware-enforced CSS page breaks
      slidesHtmlArray.forEach((slideHtml) => {
        const slideWrapper = document.createElement('div');
        slideWrapper.style.width = '960px';
        slideWrapper.style.height = '540px';
        slideWrapper.style.position = 'relative';
        slideWrapper.style.pageBreakAfter = 'always'; // Forces jsPDF to split here
        slideWrapper.innerHTML = slideHtml;
        sandbox.appendChild(slideWrapper);
      });

      document.body.appendChild(sandbox);
      await new Promise((res) => setTimeout(res, 500)); // Extra buffer time for visual assets

      // Initialize an explicit landscape presentation PDF layout
      const doc = new jsPDF({
        orientation: 'l',
        unit: 'pt',
        format: [960, 540]
      });

      await doc.html(sandbox, {
        callback: (pdfDoc) => {
          document.body.removeChild(sandbox);
          resolve(pdfDoc.output('blob'));
        },
        margin: [0, 0, 0, 0], // PowerPoint layouts look best borderless (bleed edges)
        autoPaging: 'slice',
        width: 960,
        windowWidth: 960
      });
    } catch (err) {
      if (sandbox?.parentNode) document.body.removeChild(sandbox);
      reject(err);
    }
  });
};