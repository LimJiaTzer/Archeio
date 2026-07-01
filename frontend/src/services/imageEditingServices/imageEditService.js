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