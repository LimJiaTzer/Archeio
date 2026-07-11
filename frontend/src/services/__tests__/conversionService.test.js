import { describe, it, expect, vi, beforeEach } from 'vitest';
import { convertImage } from '../conversionService';

// Mocking the underlying canvas/raster services to isolate `convertImage` mapping logic
vi.mock('../imageConversionServices/rasterToRaster', () => ({
  rasterToRaster: vi.fn(async (file, toMime) => new Blob(['mock-raster'], { type: toMime }))
}));

vi.mock('../imageConversionServices/anyToHeic', () => ({
  anyToHeic: vi.fn(async () => new Blob(['mock-heic'], { type: 'image/heic' }))
}));

// Mock browser URL behavior
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
});

describe('conversionService', () => {
  describe('convertImage mapping', () => {
    it('should route image/png to image/jpeg correctly', async () => {
      const mockFile = new File(['fake-png-content'], 'test.png', { type: 'image/png' });
      
      const result = await convertImage(mockFile, 'JPEG');
      
      expect(result).toBeDefined();
      expect(result.downloadUrl).toBe('blob:mock-url');
      expect(result.convertedFileName).toBe('test_converted.jpg');
    });

    it('should route image/jpeg to image/heic correctly via mapped function', async () => {
      const mockFile = new File(['fake-jpg-content'], 'test.jpg', { type: 'image/jpeg' });
      
      const result = await convertImage(mockFile, 'HEIC');
      
      expect(result).toBeDefined();
      expect(result.convertedFileName).toBe('test_converted.heic');
    });

    it('should throw an error for unsupported format combinations', async () => {
      const mockFile = new File(['fake-content'], 'test.png', { type: 'image/png' });
      
      // Requesting an unknown output format
      await expect(convertImage(mockFile, 'UNKNOWN_FORMAT')).rejects.toThrow(
        /Conversion from image\/png to image\/unknown_format is not supported/
      );
    });
  });
});
