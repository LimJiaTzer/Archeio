import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createImageCompressionPreview } from '../../src/components/dropdownPreview/ImagePreviewService';
import { createFakeImage, MIME_TYPES } from './fakeFiles';

vi.mock('../../src/services/imageEditingServices/imageEditService', () => ({
  renderImageWithOverlays: vi.fn(),
}));

vi.mock('../../src/services/compressionHelpers/imageCompressionHelper', () => ({
  compressAnimatedGif: vi.fn(),
}));

vi.mock('../../src/services/imageConversionServices/extractFrames', () => ({
  isGifFile: vi.fn((file) => file?.type === 'image/gif'),
}));

const installImageStub = ({ width = 800, height = 400, fail = false } = {}) => {
  globalThis.Image = class {
    width = width;
    height = height;
    naturalWidth = width;
    naturalHeight = height;

    set src(_value) {
      queueMicrotask(() => {
        if (fail) {
          this.onerror?.(new Error('synthetic image failure'));
        } else {
          this.onload?.();
        }
      });
    }
  };
};

describe('image compression preview service', () => {
  let createdBlobs;

  beforeEach(() => {
    vi.clearAllMocks();
    createdBlobs = [];
    URL.createObjectURL = vi.fn(() => `blob:${createdBlobs.length}`);
    URL.revokeObjectURL = vi.fn();
    installImageStub();

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      drawImage: vi.fn(),
    }));
    HTMLCanvasElement.prototype.toBlob = vi.fn(
      (callback, type, quality = 1) => {
        const size = Math.max(1, Math.round(quality * 1000));
        const blob = new Blob([new Uint8Array(size)], { type });
        createdBlobs.push(blob);
        callback(blob);
      }
    );
  });

  it('keeps PNG output on the alpha-capable PNG MIME pathway', async () => {
    const result = await createImageCompressionPreview({
      file: createFakeImage('transparent.png', MIME_TYPES.png),
      ratio: 50,
      format: 'PNG',
    });

    expect(result.blob.type).toBe('image/png');
    expect(HTMLCanvasElement.prototype.toBlob.mock.calls[0][1])
      .toBe('image/png');
    expect(result).toMatchObject({
      width: 800,
      height: 400,
      originalWidth: 800,
      originalHeight: 400,
    });
  });

  it('produces a smaller synthetic preview at higher compression', async () => {
    const file = createFakeImage('quality.jpg');
    const lowCompression = await createImageCompressionPreview({
      file,
      ratio: 20,
      format: 'JPG',
    });
    const highCompression = await createImageCompressionPreview({
      file,
      ratio: 90,
      format: 'JPG',
    });

    expect(lowCompression.sizeBytes).toBeGreaterThan(
      highCompression.sizeBytes
    );
    expect(lowCompression.blob.type).toBe('image/jpeg');
    expect(highCompression.blob.type).toBe('image/jpeg');
  });

  it('maintains aspect ratio when resizing', async () => {
    const result = await createImageCompressionPreview({
      file: createFakeImage('wide.jpg'),
      ratio: 50,
      format: 'JPG',
      resizeEnabled: true,
      maxWidth: 400,
      maxHeight: 400,
      maintainAspectRatio: true,
    });

    expect(result.width).toBe(400);
    expect(result.height).toBe(200);
  });

  it('uses independent dimensions when aspect ratio is disabled', async () => {
    const result = await createImageCompressionPreview({
      file: createFakeImage('wide.jpg'),
      ratio: 50,
      format: 'JPG',
      resizeEnabled: true,
      maxWidth: 320,
      maxHeight: 240,
      maintainAspectRatio: false,
    });

    expect(result.width).toBe(320);
    expect(result.height).toBe(240);
  });

  it.each([20, 90])(
    'returns a valid blob at the %i slider extreme',
    async (ratio) => {
      const result = await createImageCompressionPreview({
        file: createFakeImage('extreme.jpg'),
        ratio,
        format: 'JPG',
      });

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.sizeBytes).toBeGreaterThan(0);
    }
  );

  it('does not collapse a one-pixel image', async () => {
    installImageStub({ width: 1, height: 1 });

    const result = await createImageCompressionPreview({
      file: createFakeImage('pixel.png', MIME_TYPES.png, 1),
      ratio: 90,
      format: 'PNG',
    });

    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });

  it('rejects corrupt image bytes without leaving the page hanging', async () => {
    installImageStub({ fail: true });

    await expect(
      createImageCompressionPreview({
        file: createFakeImage('corrupt.jpg'),
        ratio: 75,
        format: 'JPG',
      })
    ).rejects.toThrow('Failed to load image');
  });
});
