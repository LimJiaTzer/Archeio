import { svgToRaster } from '../imageConversionServices/svgToRaster';
import {
  extractGifFrameData,
  extractIcoFrames,
  isGifFile,
} from '../imageConversionServices/extractFrames';
import {
  encodeGifFrames,
  loadBlobImage,
} from '../imageConversionServices/rasterToGif';

export const normalizeImageForCompression = async (
  file,
  selectedFrames = null
) => {
  const type = file.type;
  const name = file.name.toLowerCase();

  if (type === 'image/svg+xml' || name.endsWith('.svg')) {
    return await svgToRaster(file, 'image/png');
  }

  if (isGifFile(file)) {
    const gif = await extractGifFrameData(file);
    const frames = selectGifFrames(gif.frames, selectedFrames);

    if (!frames || frames.length === 0) {
      throw new Error('Could not extract GIF frame.');
    }

    return frames[0].blob;
  }

  if (
    type === 'image/x-icon' ||
    type === 'image/vnd.microsoft.icon' ||
    name.endsWith('.ico')
  ) {
    const frames = await extractIcoFrames(file);

    if (!frames || frames.length === 0) {
      throw new Error('Could not extract ICO image.');
    }

    return frames[0];
  }

  return file;
};

export const compressRasterWithCanvas = async (
  blob,
  outputMime,
  ratio,
  {
    resizeEnabled = false,
    maxWidth = null,
    maxHeight = null,
    maintainAspectRatio = true,
  } = {}
) => {
  const img = await loadImageFromBlob(blob);

  const canvas = document.createElement('canvas');

  const resized = getResizedDimensions({
    width: img.width,
    height: img.height,
    resizeEnabled,
    maxWidth,
    maxHeight,
    maintainAspectRatio,
  });
  const scale = Math.max(0.2, 1 - ratio / 150);

  canvas.width = Math.max(1, Math.round(resized.width * scale));
  canvas.height = Math.max(1, Math.round(resized.height * scale));

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not create canvas context');
  }

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const quality = Math.max(0.05, Math.min(0.95, (100 - ratio) / 100));

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (compressedBlob) => {
        if (!compressedBlob) {
          reject(new Error('Image compression failed.'));
          return;
        }

        resolve(compressedBlob);
      },
      outputMime,
      outputMime === 'image/png' ? undefined : quality
    );
  });
};

export const compressAnimatedGif = async ({
  file,
  ratio,
  resizeEnabled = false,
  maxWidth = null,
  maxHeight = null,
  maintainAspectRatio = true,
  selectedFrames = null,
}) => {
  const gif = await extractGifFrameData(file);
  const frames = selectGifFrames(gif.frames, selectedFrames);
  const resized = getResizedDimensions({
    width: gif.width,
    height: gif.height,
    resizeEnabled,
    maxWidth,
    maxHeight,
    maintainAspectRatio,
  });
  const compressionScale = Math.max(0.2, 1 - ratio / 150);
  const width = Math.max(1, Math.round(resized.width * compressionScale));
  const height = Math.max(1, Math.round(resized.height * compressionScale));
  const quality = 1 + ratio / 5;

  const blob = await encodeGifFrames({
    frames,
    width,
    height,
    repeat: gif.repeat,
    quality,
    drawFrame: async (frame) => {
      const image = await loadBlobImage(frame.blob);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Could not create a GIF compression canvas.');
      }

      context.drawImage(image, 0, 0, width, height);
      return canvas;
    },
  });

  return {
    blob,
    width,
    height,
    originalWidth: gif.width,
    originalHeight: gif.height,
    frameCount: frames.length,
  };
};

const selectGifFrames = (frames, selectedFrames) => {
  if (selectedFrames === null || selectedFrames === undefined) {
    return frames;
  }

  if (selectedFrames.length === 0) {
    throw new Error('Select at least one GIF frame.');
  }

  const selectedIndexes = new Set(selectedFrames);
  const selected = frames.filter((_, index) => selectedIndexes.has(index));

  if (selected.length === 0) {
    throw new Error('The selected GIF frames are unavailable.');
  }

  return selected;
};

const getResizedDimensions = ({
  width,
  height,
  resizeEnabled,
  maxWidth,
  maxHeight,
  maintainAspectRatio,
}) => {
  if (!resizeEnabled || (!maxWidth && !maxHeight)) {
    return { width, height };
  }

  const widthLimit = Number(maxWidth) || width;
  const heightLimit = Number(maxHeight) || height;

  if (!maintainAspectRatio) {
    return {
      width: Math.max(1, widthLimit),
      height: Math.max(1, heightLimit),
    };
  }

  const scale = Math.min(widthLimit / width, heightLimit / height, 1);

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export const loadImageFromBlob = async (blob) => {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const img = new Image();

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () =>
        reject(new Error('This image type cannot be loaded by the browser.'));
      img.src = objectUrl;
    });

    return img;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
