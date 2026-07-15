import { describe, it, expect, vi, beforeEach } from 'vitest';
import { compilePDF, dataUrlToArrayBuffer } from '../pdfEditorService';
import { PDFDocument, degrees } from 'pdf-lib';

// Mock global window atob for the dataUrlToArrayBuffer test
if (typeof window === 'undefined') {
  global.window = {};
}
global.window.atob = vi.fn((str) => Buffer.from(str, 'base64').toString('binary'));

// Mock pdf-lib methods
vi.mock('pdf-lib', () => {
  const mockCopiedPage = {
    setRotation: vi.fn(),
    getSize: vi.fn(() => ({ width: 800, height: 600 })),
    drawImage: vi.fn(),
  };

  const mockDoc = {
    copyPages: vi.fn(async () => [mockCopiedPage]),
    embedPng: vi.fn(async () => 'mock-embedded-png'),
    addPage: vi.fn(),
    save: vi.fn(async () => new Uint8Array([1, 2, 3])),
  };

  return {
    PDFDocument: {
      create: vi.fn(async () => mockDoc),
      load: vi.fn(async () => mockDoc),
    },
    degrees: vi.fn((deg) => deg),
  };
});

describe('pdfEditorService', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('dataUrlToArrayBuffer', () => {
    it('should correctly convert a base64 data URL to an ArrayBuffer', () => {
      // "Hello" in base64 is "SGVsbG8="
      const dataUrl = 'data:image/png;base64,SGVsbG8=';
      const buffer = dataUrlToArrayBuffer(dataUrl);
      
      expect(buffer).toBeInstanceOf(ArrayBuffer);
      const uint8View = new Uint8Array(buffer);
      // 'H'=72, 'e'=101, 'l'=108, 'l'=108, 'o'=111
      expect(uint8View[0]).toBe(72);
      expect(uint8View[4]).toBe(111);
    });
  });

  describe('compilePDF', () => {
    it('should throw an error if pagesList is empty', async () => {
      await expect(compilePDF([], {}, {})).rejects.toThrow('No pages to export.');
      await expect(compilePDF(null, {}, {})).rejects.toThrow('No pages to export.');
    });

    it('should compile a PDF from a list of pages without signatures', async () => {
      // Mock File object
      const mockFile = new File(['dummy-pdf'], 'test.pdf', { type: 'application/pdf' });
      mockFile.arrayBuffer = vi.fn(async () => new ArrayBuffer(8));

      const pagesList = [
        { id: 'page-1', file: mockFile, originalPageNum: 1, rotation: 0 },
        { id: 'page-2', file: mockFile, originalPageNum: 2, rotation: 90 },
      ];

      const result = await compilePDF(pagesList, {}, { width: 500, height: 500 });
      
      // Verify pdf-lib create/load was called
      expect(PDFDocument.create).toHaveBeenCalled();
      expect(PDFDocument.load).toHaveBeenCalled();
      
      // Verify a Blob is returned
      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('application/pdf');
    });

    it('should apply correct mathematical transformations for drawn signatures', async () => {
      const mockFile = new File(['dummy-pdf'], 'test.pdf', { type: 'application/pdf' });
      mockFile.arrayBuffer = vi.fn(async () => new ArrayBuffer(8));

      const pagesList = [
        { id: 'page-1', file: mockFile, originalPageNum: 1, rotation: 0 },
      ];

      const placedSignatures = {
        'page-1': [
          { img: 'data:image/png;base64,SGVsbG8=', x: 50, y: 50, width: 100, height: 100 }
        ]
      };

      const pageDimensions = { width: 500, height: 500 };

      await compilePDF(pagesList, placedSignatures, pageDimensions);
      
      // We expect the mock doc's create method to have been called.
      // We can grab the mock doc returned by PDFDocument.create to check assertions
      const mockDocInstance = await PDFDocument.create();
      const mockPageInstance = (await mockDocInstance.copyPages())[0];

      // Verify that the signature was embedded and drawn
      expect(mockDocInstance.embedPng).toHaveBeenCalled();
      expect(mockPageInstance.drawImage).toHaveBeenCalled();
      
      // Check the exact coordinates calculated by the compilePDF logic.
      // pdf width = 800, pdf height = 600, canvas = 500x500
      // sig = 100x100 at 50%, 50%
      // Expected PDF X: (50/100) * 800 = 400
      // Expected PDF Width: (100/500) * 800 = 160
      // Expected PDF Height: (100/500) * 600 = 120
      // Expected PDF Y: 600 - ((50/100) + (100/500)) * 600 = 600 - (0.5 + 0.2)*600 = 600 - 420 = 180
      expect(mockPageInstance.drawImage).toHaveBeenCalledWith(
        'mock-embedded-png',
        { x: 400, y: 180, width: 160, height: 120 }
      );
    });
  });
});
