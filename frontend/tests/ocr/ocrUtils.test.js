import { describe, expect, it } from 'vitest';
import {
  MAX_OCR_ZOOM,
  MIN_OCR_ZOOM,
  clampOcrZoom,
  isSupportedOcrSource,
  ocrDocumentName,
  ocrSourceKey,
} from '../../src/lib/ocrUtils';

describe('OCR page utilities', () => {
  it.each([
    ['scan.pdf', 'application/octet-stream'],
    ['scan.PNG', 'application/octet-stream'],
    ['scan.tiff', 'image/tiff'],
  ])('accepts supported source %s', (name, type) => {
    expect(isSupportedOcrSource({ name, type })).toBe(true);
  });

  it('rejects unsupported files', () => {
    expect(isSupportedOcrSource({ name: 'archive.zip', type: 'application/zip' })).toBe(false);
  });

  it('builds stable deduplication and DOCX names', () => {
    const file = { name: 'lecture.scan.pdf', size: 10, lastModified: 20 };
    expect(ocrSourceKey(file)).toBe('lecture.scan.pdf:10:20');
    expect(ocrDocumentName(file)).toBe('lecture.scan.docx');
  });

  it('clamps zoom at both supported boundaries', () => {
    expect(clampOcrZoom(0)).toBe(MIN_OCR_ZOOM);
    expect(clampOcrZoom(10)).toBe(MAX_OCR_ZOOM);
    expect(clampOcrZoom(1.25)).toBe(1.25);
  });
});
