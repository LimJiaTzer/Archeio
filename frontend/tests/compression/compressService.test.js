import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  compressAudio,
  compressDocument,
  compressImage,
  compressVideo,
} from '../../src/services/compressService';
import {
  compressAnimatedGif,
  compressRasterWithCanvas,
  normalizeImageForCompression,
} from '../../src/services/compressionHelpers/imageCompressionHelper';
import {
  createFakeFile,
  createFakeImage,
  MIME_TYPES,
} from './fakeFiles';

const mocks = vi.hoisted(() => ({
  ffmpeg: {
    loaded: true,
    load: vi.fn(),
    writeFile: vi.fn(),
    exec: vi.fn(),
    readFile: vi.fn(async () => new Uint8Array([1, 2, 3, 4])),
  },
  fetchFile: vi.fn(async () => new Uint8Array([8, 9])),
  convertDocument: vi.fn(),
}));

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {
    constructor() {
      return mocks.ffmpeg;
    }
  },
}));

vi.mock('@ffmpeg/util', () => ({
  fetchFile: mocks.fetchFile,
}));

vi.mock('../../src/services/conversionService', () => ({
  convertMedia: vi.fn(),
  convertImage: vi.fn(),
  convertDocument: mocks.convertDocument,
}));

vi.mock('../../src/services/imageConversionServices/svgToRaster', () => ({
  svgToRaster: vi.fn(),
}));

vi.mock('../../src/services/imageConversionServices/extractFrames', () => ({
  extractGifFrames: vi.fn(),
  extractIcoFrames: vi.fn(),
  isGifFile: vi.fn((file) => file?.type === 'image/gif'),
}));

vi.mock('../../src/services/imageConversionServices/rasterToRaster', () => ({
  rasterToRaster: vi.fn(),
}));

vi.mock('../../src/services/imageConversionServices/rasterToGif', () => ({
  rasterToGif: vi.fn(async () => new Blob(['gif'], { type: 'image/gif' })),
}));

vi.mock('../../src/services/imageConversionServices/pngToIco', () => ({
  pngToIco: vi.fn(async () => new Blob(['ico'], { type: 'image/x-icon' })),
}));

vi.mock('../../src/services/compressionHelpers/rasterToAvif', () => ({
  rasterToAvif: vi.fn(async () => new Blob(['avif'], { type: 'image/avif' })),
}));

vi.mock(
  '../../src/services/compressionHelpers/imageCompressionHelper',
  () => ({
    normalizeImageForCompression: vi.fn(),
    compressRasterWithCanvas: vi.fn(),
    compressAnimatedGif: vi.fn(),
  })
);

const createCallbacks = () => ({
  setDownloadUrl: vi.fn(),
  setCompressedFileName: vi.fn(),
  setResult: vi.fn(),
  setCompressing: vi.fn(),
  setWarning: vi.fn(),
});

const fileInfo = (category, format) => ({
  category,
  format,
});

describe('compression service', () => {
  let createdBlobs;

  beforeEach(() => {
    vi.clearAllMocks();
    createdBlobs = [];
    URL.createObjectURL = vi.fn((blob) => {
      createdBlobs.push(blob);
      return `blob:compressed-${createdBlobs.length}`;
    });
    URL.revokeObjectURL = vi.fn();
    globalThis.alert = vi.fn();
    globalThis.fetch = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    normalizeImageForCompression.mockImplementation(async (file) => file);
    compressRasterWithCanvas.mockImplementation(
      async (_file, outputMime) =>
        new Blob([new Uint8Array(128)], { type: outputMime })
    );
    compressAnimatedGif.mockResolvedValue({
      blob: new Blob([new Uint8Array(256)], { type: 'image/gif' }),
      width: 320,
      height: 180,
      originalWidth: 640,
      originalHeight: 360,
      frameCount: 3,
    });
    mocks.ffmpeg.loaded = true;
    mocks.ffmpeg.readFile.mockResolvedValue(
      new Uint8Array([1, 2, 3, 4])
    );

    globalThis.Audio = class {
      duration = 10;

      set src(_value) {
        queueMicrotask(() => this.onloadedmetadata?.());
      }
    };
  });

  it('runs ordinary JPG compression through normalisation and canvas', async () => {
    const file = createFakeImage('photo.jpg');
    const callbacks = createCallbacks();

    await compressImage({
      file,
      ratio: 75,
      format: 'JPG',
      fileInfo: fileInfo('images', 'JPG'),
      ...callbacks,
    });

    expect(normalizeImageForCompression).toHaveBeenCalledWith(file, null);
    expect(compressRasterWithCanvas).toHaveBeenCalledWith(
      file,
      'image/jpeg',
      75,
      expect.objectContaining({ resizeEnabled: false })
    );
    expect(callbacks.setCompressedFileName)
      .toHaveBeenCalledWith('photo_compressed.jpg');
    expect(createdBlobs.at(-1).type).toBe('image/jpeg');
    expect(callbacks.setResult).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['HEIC', 'camera.heic', MIME_TYPES.heic],
    ['SVG', 'vector.svg', MIME_TYPES.svg],
  ])(
    'uses the normalisation pathway for %s input',
    async (format, name, type) => {
      const file = createFakeImage(name, type);
      const callbacks = createCallbacks();
      const normalised = new Blob(['normalised'], { type: 'image/png' });
      normalizeImageForCompression.mockResolvedValueOnce(normalised);

      await compressImage({
        file,
        ratio: 60,
        format: 'PNG',
        fileInfo: fileInfo('images', format),
        ...callbacks,
      });

      expect(normalizeImageForCompression).toHaveBeenCalledWith(file, null);
      expect(compressRasterWithCanvas.mock.calls[0][0]).toBe(normalised);
      expect(callbacks.setCompressedFileName).toHaveBeenCalledWith(
        `${name.slice(0, name.lastIndexOf('.'))}_compressed.png`
      );
    }
  );

  it('keeps animated GIF output on the multi-frame compressor', async () => {
    const file = createFakeImage('animation.gif', MIME_TYPES.gif);
    const callbacks = createCallbacks();

    await compressImage({
      file,
      ratio: 80,
      format: 'GIF',
      fileInfo: fileInfo('images', 'GIF'),
      selectedFrames: [0, 2],
      ...callbacks,
    });

    expect(compressAnimatedGif).toHaveBeenCalledWith(
      expect.objectContaining({
        file,
        ratio: 80,
        selectedFrames: [0, 2],
      })
    );
    expect(normalizeImageForCompression).not.toHaveBeenCalled();
    expect(createdBlobs.at(-1).type).toBe('image/gif');
  });

  it('emits the correct MIME type and extension for JPG to PNG', async () => {
    const callbacks = createCallbacks();

    await compressImage({
      file: createFakeImage('portrait.jpg'),
      ratio: 50,
      format: 'PNG',
      fileInfo: fileInfo('images', 'JPG'),
      ...callbacks,
    });

    expect(compressRasterWithCanvas.mock.calls[0][1]).toBe('image/png');
    expect(createdBlobs.at(-1).type).toBe('image/png');
    expect(callbacks.setCompressedFileName)
      .toHaveBeenCalledWith('portrait_compressed.png');
  });

  it('posts PDF compression and keeps the PDF artifact metadata', async () => {
    const callbacks = createCallbacks();
    const file = createFakeFile({
      name: 'report.pdf',
      type: MIME_TYPES.pdf,
      size: 4096,
    });
    fetch.mockResolvedValue({
      ok: true,
      blob: vi.fn(async () =>
        new Blob([new Uint8Array(256)], { type: MIME_TYPES.pdf })
      ),
    });

    await compressDocument({
      file,
      ratio: 75,
      format: 'PDF',
      fileInfo: fileInfo('documents', 'PDF'),
      ...callbacks,
    });

    expect(fetch.mock.calls[0][0]).toMatch(/\/compress-pdf$/);
    expect(fetch.mock.calls[0][1].method).toBe('POST');
    expect(createdBlobs.at(-1).type).toBe(MIME_TYPES.pdf);
    expect(callbacks.setCompressedFileName)
      .toHaveBeenCalledWith('report_compressed.pdf');
  });

  it.each([
    ['DOCX', 'notes.docx', MIME_TYPES.docx],
    ['PPTX', 'slides.pptx', MIME_TYPES.pptx],
    ['XLSX', 'table.xlsx', MIME_TYPES.xlsx],
  ])(
    'routes native %s compression through the Office endpoint',
    async (format, name, type) => {
      const callbacks = createCallbacks();
      const file = createFakeFile({ name, type, size: 4096 });
      fetch.mockResolvedValue({
        ok: true,
        blob: vi.fn(async () =>
          new Blob([new Uint8Array(256)], { type })
        ),
      });

      await compressDocument({
        file,
        ratio: 60,
        format,
        fileInfo: fileInfo('documents', format),
        ...callbacks,
      });

      expect(fetch.mock.calls[0][0]).toMatch(/\/compress-office$/);
      expect(createdBlobs.at(-1).type).toBe(type);
      expect(callbacks.setCompressedFileName).toHaveBeenCalledWith(
        `${name.slice(0, name.lastIndexOf('.'))}_compressed.${format.toLowerCase()}`
      );
    }
  );

  it('handles a fake MP3 Blob and produces audio metadata', async () => {
    const callbacks = createCallbacks();
    const file = createFakeFile({
      name: 'synthetic.mp3',
      type: MIME_TYPES.mp3,
      size: 8192,
    });

    await compressAudio({
      file,
      ratio: 75,
      format: 'MP3',
      fileInfo: fileInfo('audio', 'MP3'),
      ...callbacks,
    });

    expect(mocks.ffmpeg.writeFile).toHaveBeenCalledWith(
      'synthetic.mp3',
      expect.any(Uint8Array)
    );
    expect(mocks.ffmpeg.exec).toHaveBeenCalledWith([
      '-i',
      'synthetic.mp3',
      '-b:a',
      '7k',
      'compressed_audio.mp3',
    ]);
    expect(createdBlobs.at(-1).type).toBe(MIME_TYPES.mp3);
    expect(callbacks.setCompressedFileName)
      .toHaveBeenCalledWith('synthetic_compressed.mp3');
  });

  it('handles a fake MP4 Blob and selects video compression options', async () => {
    const callbacks = createCallbacks();
    const file = createFakeFile({
      name: 'synthetic.mp4',
      type: MIME_TYPES.mp4,
      size: 16384,
    });

    await compressVideo({
      file,
      ratio: 75,
      format: 'MP4',
      fileInfo: fileInfo('video', 'MP4'),
      ...callbacks,
    });

    expect(mocks.ffmpeg.exec).toHaveBeenCalledWith([
      '-i',
      'synthetic.mp4',
      '-vcodec',
      'libx264',
      '-crf',
      '31',
      '-preset',
      'ultrafast',
      '-acodec',
      'aac',
      '-b:a',
      '128k',
      'compressed_video.mp4',
    ]);
    expect(createdBlobs.at(-1).type).toBe(MIME_TYPES.mp4);
    expect(callbacks.setCompressedFileName)
      .toHaveBeenCalledWith('synthetic_compressed.mp4');
  });
});
