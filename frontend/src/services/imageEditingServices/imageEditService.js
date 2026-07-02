export const applyImageQuickAction = async ({ file, action, outputType = 'image/png' }) => {
  if (!file) {
    throw new Error('No image file provided');
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(imageUrl);

    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;

    const swapsDimensions =
      action === 'rotate-left' || action === 'rotate-right';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = swapsDimensions ? originalHeight : originalWidth;
    canvas.height = swapsDimensions ? originalWidth : originalHeight;

    ctx.save();

    if (action === 'rotate-right') {
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
    }

    if (action === 'rotate-left') {
      ctx.translate(0, canvas.height);
      ctx.rotate(-Math.PI / 2);
    }

    if (action === 'flip-horizontal') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    if (action === 'flip-vertical') {
      ctx.translate(0, canvas.height);
      ctx.scale(1, -1);
    }

    ctx.drawImage(image, 0, 0);
    ctx.restore();

    const blob = await canvasToBlob(canvas, outputType);

    return {
      blob,
      file: new File([blob], file.name, { type: blob.type }),
      previewUrl: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
      sizeBytes: blob.size,
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

export const applyImageCrop = async ({
  file,
  imageElement,
  crop,
  outputType = 'image/png',
}) => {
  if (!file) {
    throw new Error('No image file provided');
  }

  if (!imageElement || !crop?.width || !crop?.height) {
    throw new Error('No crop area provided');
  }

  const scaleX = imageElement.naturalWidth / imageElement.width;
  const scaleY = imageElement.naturalHeight / imageElement.height;

  const sourceX = crop.x * scaleX;
  const sourceY = crop.y * scaleY;
  const sourceWidth = crop.width * scaleX;
  const sourceHeight = crop.height * scaleY;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = Math.round(sourceWidth);
  canvas.height = Math.round(sourceHeight);

  ctx.drawImage(
    imageElement,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const blob = await canvasToBlob(canvas, outputType);

  return {
    blob,
    file: new File([blob], file.name, { type: blob.type }),
    previewUrl: URL.createObjectURL(blob),
    width: canvas.width,
    height: canvas.height,
    sizeBytes: blob.size,
  };
};

export const applyImageFilter = async ({
  file,
  filter,
  outputType = 'image/png',
}) => {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = reject;

      img.src = imageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    const ctx = canvas.getContext('2d');

    const cssFilterMap = {
      none: 'none',
      pop: 'saturate(1.35) contrast(1.12) brightness(1.04)',
      bw: 'grayscale(1) contrast(1.18)',
      cool: 'saturate(1.08) contrast(1.08) hue-rotate(190deg) brightness(0.98)',
      chrome: 'saturate(1.55) contrast(1.2) brightness(1.06)',
      film: 'sepia(0.22) contrast(0.92) brightness(1.06) saturate(0.95)',
    };

    ctx.filter = cssFilterMap[filter] || 'none';
    ctx.drawImage(image, 0, 0);

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, outputType, 0.95);
    });

    if (!blob) {
      throw new Error('Could not apply image filter');
    }

    const filteredFile = new File([blob], file.name, {
      type: outputType,
      lastModified: Date.now(),
    });

    return {
      file: filteredFile,
      previewUrl: URL.createObjectURL(blob),
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};


const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));

    image.src = src;
  });
};

const canvasToBlob = (canvas, type) => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create edited image'));
          return;
        }

        resolve(blob);
      },
      type,
      0.92
    );
  });
};