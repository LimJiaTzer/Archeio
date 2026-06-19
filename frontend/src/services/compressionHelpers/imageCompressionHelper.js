import { svgToRaster } from '../imageConversionServices/svgToRaster';
import { extractGifFrames, extractIcoFrames } from '../imageConversionServices/extractFrames';

export const normalizeImageForCompression = async (file) => {
  const type = file.type;
  const name = file.name.toLowerCase();

  if (type === 'image/svg+xml' || name.endsWith('.svg')) {
    return await svgToRaster(file, 'image/png');
  }

  if (type === 'image/gif' || name.endsWith('.gif')) {
    const frames = await extractGifFrames(file);

    if (!frames || frames.length === 0) {
      throw new Error('Could not extract GIF frame.');
    }

    return frames[0];
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

export const compressRasterWithCanvas = async (blob, outputMime, ratio) => {
  const img = await loadImageFromBlob(blob);

  const canvas = document.createElement('canvas');

  const scale = Math.max(0.2, 1 - ratio / 150); // make actual use of the slider (can change 150 depending on how aggressive max compression) 

  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));

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