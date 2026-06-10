import { txtToPdf } from './txtToPdf';

/**
 * Strips basic RTF tags to get plain text.
 * @param {string} rtf 
 * @returns {string}
 */
function stripRTF(rtf) {
  // Simple regex-based RTF stripping. Not perfect but handles basic cases.
  if (!rtf) return '';
  return rtf
    .replace(/\\rtf1|\\ansi|\\ansicpg\d+|\\deff\d+|\\deflang\d+/g, '')
    .replace(/\{\\fonttbl[\s\S]*?\}/g, '')
    .replace(/\{\\colortbl[\s\S]*?\}/g, '')
    .replace(/\{\\stylesheet[\s\S]*?\}/g, '')
    .replace(/\\viewkind\d+|\\uc\d+|\\pard|\\plain|\\f\d+|\\fs\d+|\\lang\d+|\\b|\\i|\\u\d+|\\'[\da-f]{2}/g, '')
    .replace(/[\{\}]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n\n+/g, '\n')
    .trim();
}

/**
 * Converts RTF to PDF.
 * @param {File} file 
 * @returns {Promise<Blob>}
 */
export const rtfToPdf = async (file) => {
  const textContent = await file.text();
  const plainText = stripRTF(textContent);
  return await txtToPdf(plainText);
};
