import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  annotationPlacementForRotation,
  compilePDF,
  dataUrlToArrayBuffer,
} from '../../src/services/pdfEditorService';

const sourcePdf = async () => {
  const document = await PDFDocument.create();
  document.addPage([200, 300]);
  document.addPage([400, 500]);
  return document.save();
};

const sourceFile = async () => {
  const bytes = await sourcePdf();
  return {
    name: 'source.pdf',
    type: 'application/pdf',
    arrayBuffer: async () => bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ),
  };
};

describe('PDF editor service', () => {
  it('decodes a base64 data URL without a network request', () => {
    expect([...new Uint8Array(dataUrlToArrayBuffer('data:text/plain;base64,SGVsbG8='))])
      .toEqual([72, 101, 108, 108, 111]);
  });

  it('rejects export without pages', async () => {
    await expect(compilePDF([], {}, {})).rejects.toThrow('No pages to export.');
  });

  it('produces a readable PDF with requested page order and rotation', async () => {
    const file = await sourceFile();
    const blob = await compilePDF([
      { id: 'second', file, originalPageNum: 2, rotation: 90, width: 420, height: 525 },
      { id: 'first', file, originalPageNum: 1, rotation: 0, width: 420, height: 630 },
    ], {}, { width: 420, height: 630 });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const result = await PDFDocument.load(bytes);

    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('%PDF');
    expect(result.getPageCount()).toBe(2);
    expect(result.getPage(0).getSize()).toEqual({ width: 400, height: 500 });
    expect(result.getPage(0).getRotation().angle).toBe(90);
    expect(result.getPage(1).getSize()).toEqual({ width: 200, height: 300 });
  });

  it.each([
    [0, { x: 400, y: 180, width: 160, height: 120 }],
    [90, { x: 400, y: 300, width: 160, height: 120 }],
    [180, { x: 240, y: 300, width: 160, height: 120 }],
    [270, { x: 240, y: 380, width: 160, height: 120 }],
  ])('maps annotation geometry at %i degrees', (rotation, expected) => {
    expect(annotationPlacementForRotation({
      annotation: { x: 50, y: 50, width: 100, height: 100 },
      canvasSize: { width: 500, height: 500 },
      pageSize: { width: 800, height: 600 },
      rotation,
    })).toEqual(expected);
  });

  it('rejects annotation placement without usable canvas dimensions', () => {
    expect(() => annotationPlacementForRotation({
      annotation: { x: 0, y: 0, width: 1, height: 1 },
      canvasSize: { width: 0, height: 0 },
      pageSize: { width: 100, height: 100 },
    })).toThrow('Canvas dimensions are required');
  });
});
