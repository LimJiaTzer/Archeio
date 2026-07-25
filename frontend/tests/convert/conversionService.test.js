import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  convertAudio,
  convertDocument,
  convertImage,
  convertVideo,
  extractFrames,
  zipBlobs,
} from '../../src/services/conversionService';
import { rasterToRaster } from '../../src/services/imageConversionServices/rasterToRaster';
import { anyToHeic } from '../../src/services/imageConversionServices/anyToHeic';
import {
  extractGifFrames,
  extractIcoFrames,
} from '../../src/services/imageConversionServices/extractFrames';

vi.mock('@ffmpeg/util', () => ({
  fetchFile: vi.fn(async () => new Uint8Array([1, 2])),
  toBlobURL: vi.fn(async (url) => `blob:${url}`),
}));

vi.mock('../../src/services/imageConversionServices/rasterToRaster', () => ({
  rasterToRaster: vi.fn(async (_file, toMime) => new Blob(['raster'], { type: toMime })),
}));

vi.mock('../../src/services/imageConversionServices/anyToHeic', () => ({
  anyToHeic: vi.fn(async () => new Blob(['heic'], { type: 'image/heic' })),
}));

vi.mock('../../src/services/imageConversionServices/extractFrames', () => ({
  extractGifFrames: vi.fn(async () => [new Blob(['gif-frame'], { type: 'image/png' })]),
  extractIcoFrames: vi.fn(async () => [new Blob(['ico-frame'], { type: 'image/png' })]),
}));

const createFfmpeg = () => ({
  loaded: true,
  writeFile: vi.fn(),
  exec: vi.fn(),
  readFile: vi.fn(async () => new Uint8Array([7, 8, 9])),
});

describe('conversion service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:converted');
  });

  it('routes raster and HEIC conversions with correct output metadata', async () => {
    const png = new File(['png'], 'photo.png', { type: 'image/png' });
    const jpeg = new File(['jpeg'], 'portrait.jpg', { type: 'image/jpeg' });

    await expect(convertImage(png, 'JPEG')).resolves.toMatchObject({
      convertedFileName: 'photo_converted.jpg',
      downloadUrl: 'blob:converted',
    });
    expect(rasterToRaster).toHaveBeenCalledWith(png, 'image/jpeg');

    await expect(convertImage(jpeg, 'HEIC')).resolves.toMatchObject({
      convertedFileName: 'portrait_converted.heic',
    });
    expect(anyToHeic).toHaveBeenCalledWith(jpeg);
  });

  it('rejects unsupported conversions instead of renaming the source bytes', async () => {
    const unknown = new File(['source'], 'source.bin', { type: 'application/octet-stream' });

    await expect(convertDocument(unknown, 'DOCX')).rejects.toThrow(
      'Conversion from application/octet-stream',
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('constructs deterministic FFmpeg commands for audio and video-to-audio', async () => {
    const audioEngine = createFfmpeg();
    const videoEngine = createFfmpeg();

    const audioResult = await convertAudio(
      new File(['audio'], 'track.wav', { type: 'audio/wav' }),
      'MP3',
      { current: audioEngine },
    );
    expect(audioEngine.exec).toHaveBeenCalledWith(['-i', 'track.wav', 'output.mp3']);
    expect(audioResult.convertedFileName).toBe('track_converted.mp3');

    const videoResult = await convertVideo(
      new File(['video'], 'clip.mp4', { type: 'video/mp4' }),
      'AAC',
      { current: videoEngine },
    );
    expect(videoEngine.exec).toHaveBeenCalledWith(['-i', 'clip.mp4', '-vn', 'output.aac']);
    expect(videoResult.convertedFileName).toBe('clip_converted.aac');
  });

  it('dispatches frame extraction only for GIF and ICO sources', async () => {
    const gif = new File(['gif'], 'animated.gif', { type: 'image/gif' });
    const ico = new File(['ico'], 'icon.ico', { type: 'image/vnd.microsoft.icon' });

    expect(await extractFrames(gif)).toHaveLength(1);
    expect(await extractFrames(ico)).toHaveLength(1);
    expect(await extractFrames(new File(['png'], 'still.png', { type: 'image/png' }))).toEqual([]);
    expect(extractGifFrames).toHaveBeenCalledWith(gif);
    expect(extractIcoFrames).toHaveBeenCalledWith(ico);
  });

  it('creates a ZIP containing every selected frame with stable names', async () => {
    const frames = [
      new Blob(['one'], { type: 'image/png' }),
      new Blob(['two'], { type: 'image/png' }),
    ];

    const result = await zipBlobs(frames, 'animation', 'PNG');
    const zipBlob = URL.createObjectURL.mock.calls.at(-1)[0];
    const archive = await JSZip.loadAsync(await zipBlob.arrayBuffer());

    expect(Object.keys(archive.files)).toEqual(['frame_1.png', 'frame_2.png']);
    expect(await archive.file('frame_1.png').async('string')).toBe('one');
    expect(result.convertedFileName).toBe('animation_frames.zip');
  });
});
