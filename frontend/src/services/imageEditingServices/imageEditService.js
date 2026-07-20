export const applyImageQuickAction = async ({
  file,
  action,
  outputType = 'image/png',
}) => {
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

    if (!ctx) {
      throw new Error('Could not create image canvas');
    }

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
      file: new File([blob], file.name, {
        type: blob.type,
        lastModified: Date.now(),
      }),
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

  if (!ctx) {
    throw new Error('Could not create image canvas');
  }

  canvas.width = Math.max(1, Math.round(sourceWidth));
  canvas.height = Math.max(1, Math.round(sourceHeight));

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
    file: new File([blob], file.name, {
      type: blob.type,
      lastModified: Date.now(),
    }),
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
  if (!file) {
    throw new Error('No image file provided');
  }

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

    if (!ctx) {
      throw new Error('Could not create image canvas');
    }

    const cssFilterMap = {
      none: 'none',
      pop: 'saturate(1.35) contrast(1.12) brightness(1.04)',
      bw: 'grayscale(1) contrast(1.18)',
      cool:
        'saturate(1.08) contrast(1.08) hue-rotate(190deg) brightness(0.98)',
      chrome: 'saturate(1.55) contrast(1.2) brightness(1.06)',
      film:
        'sepia(0.22) contrast(0.92) brightness(1.06) saturate(0.95)',
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

export const renderImageWithOverlays = async ({
  file,
  textLayers = [],
  annotationStrokes = [],
  cropPercent = null,
  outputType = 'image/png',
}) => {
  if (!file) {
    throw new Error('No image file provided');
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await loadImage(imageUrl);

    // First render the complete edited image. The crop is applied only after
    // annotations and text have been drawn onto their full-image coordinates.
    const fullCanvas = document.createElement('canvas');
    const fullCtx = fullCanvas.getContext('2d');

    if (!fullCtx) {
      throw new Error('Could not create image canvas');
    }

    fullCanvas.width = image.naturalWidth;
    fullCanvas.height = image.naturalHeight;

    fullCtx.drawImage(image, 0, 0);

    annotationStrokes.forEach((stroke) => {
      if (!stroke.points || stroke.points.length < 2) return;

      fullCtx.save();
      fullCtx.strokeStyle = stroke.color || '#f97316';
      fullCtx.lineWidth =
        stroke.size || Math.max(4, fullCanvas.width * 0.006);
      fullCtx.lineCap = 'round';
      fullCtx.lineJoin = 'round';

      fullCtx.beginPath();
      fullCtx.moveTo(stroke.points[0].x, stroke.points[0].y);

      stroke.points.slice(1).forEach((point) => {
        fullCtx.lineTo(point.x, point.y);
      });

      fullCtx.stroke();
      fullCtx.restore();
    });

    textLayers.forEach((layer) => {
      if (!layer.text?.trim()) return;

      const fontSize =
        layer.fontSize || Math.round(fullCanvas.width * 0.06);

      fullCtx.save();

      fullCtx.font = `700 ${fontSize}px ${
        layer.fontFamily || 'Arial, sans-serif'
      }`;
      fullCtx.textAlign = 'center';
      fullCtx.textBaseline = 'middle';

      fullCtx.lineWidth = Math.max(2, fontSize * 0.08);
      fullCtx.strokeStyle =
        layer.strokeColor || 'rgba(0, 0, 0, 0.55)';
      fullCtx.fillStyle = layer.color || '#ffffff';

      fullCtx.translate(layer.x, layer.y);
      fullCtx.rotate(
        ((layer.rotation || 0) * Math.PI) / 180
      );
      const lines = layer.text.split('\n');
      const lineHeight = fontSize * 1.2;
      const totalHeight = (lines.length - 1) * lineHeight;

      lines.forEach((line, index) => {
        const y =
          index * lineHeight - totalHeight / 2;

        fullCtx.strokeText(line, 0, y);
        fullCtx.fillText(line, 0, y);
      });

      fullCtx.restore();
    });

    const safeCrop = normaliseCropPercent(cropPercent);
    const hasCrop = !isFullCropPercent(safeCrop);

    let outputCanvas = fullCanvas;

    if (hasCrop) {
      const sourceX = (fullCanvas.width * safeCrop.x) / 100;
      const sourceY = (fullCanvas.height * safeCrop.y) / 100;
      const sourceWidth =
        (fullCanvas.width * safeCrop.width) / 100;
      const sourceHeight =
        (fullCanvas.height * safeCrop.height) / 100;

      const croppedCanvas = document.createElement('canvas');
      const croppedCtx = croppedCanvas.getContext('2d');

      if (!croppedCtx) {
        throw new Error('Could not create crop canvas');
      }

      croppedCanvas.width = Math.max(
        1,
        Math.round(sourceWidth)
      );
      croppedCanvas.height = Math.max(
        1,
        Math.round(sourceHeight)
      );

      croppedCtx.drawImage(
        fullCanvas,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        croppedCanvas.width,
        croppedCanvas.height
      );

      outputCanvas = croppedCanvas;
    }

    const blob = await canvasToBlob(outputCanvas, outputType);

    return {
      blob,
      file: new File([blob], file.name, {
        type: blob.type,
        lastModified: Date.now(),
      }),
      previewUrl: URL.createObjectURL(blob),
      width: outputCanvas.width,
      height: outputCanvas.height,
      sizeBytes: blob.size,
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

const normaliseCropPercent = (cropPercent) => {
  if (!cropPercent) {
    return {
      unit: '%',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    };
  }

  const x = clampNumber(
    Number(cropPercent.x) || 0,
    0,
    100
  );

  const y = clampNumber(
    Number(cropPercent.y) || 0,
    0,
    100
  );

  const width = clampNumber(
    Number(cropPercent.width) || 100,
    0,
    100 - x
  );

  const height = clampNumber(
    Number(cropPercent.height) || 100,
    0,
    100 - y
  );

  return {
    unit: '%',
    x,
    y,
    width: Math.max(0.01, width),
    height: Math.max(0.01, height),
  };
};

const isFullCropPercent = (cropPercent) => {
  if (!cropPercent) return true;

  return (
    Math.abs(cropPercent.x) < 0.01 &&
    Math.abs(cropPercent.y) < 0.01 &&
    Math.abs(cropPercent.width - 100) < 0.01 &&
    Math.abs(cropPercent.height - 100) < 0.01
  );
};

const clampNumber = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error('Failed to load image'));

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

//   if (!file) {
//     throw new Error('No image file provided');
//   }

//   const imageUrl = URL.createObjectURL(file);

//   try {
//     const image = await loadImage(imageUrl);

//     const originalWidth = image.naturalWidth;
//     const originalHeight = image.naturalHeight;

//     const swapsDimensions =
//       action === 'rotate-left' || action === 'rotate-right';

//     const canvas = document.createElement('canvas');
//     const ctx = canvas.getContext('2d');

//     canvas.width = swapsDimensions ? originalHeight : originalWidth;
//     canvas.height = swapsDimensions ? originalWidth : originalHeight;

//     ctx.save();

//     if (action === 'rotate-right') {
//       ctx.translate(canvas.width, 0);
//       ctx.rotate(Math.PI / 2);
//     }

//     if (action === 'rotate-left') {
//       ctx.translate(0, canvas.height);
//       ctx.rotate(-Math.PI / 2);
//     }

//     if (action === 'flip-horizontal') {
//       ctx.translate(canvas.width, 0);
//       ctx.scale(-1, 1);
//     }

//     if (action === 'flip-vertical') {
//       ctx.translate(0, canvas.height);
//       ctx.scale(1, -1);
//     }

//     ctx.drawImage(image, 0, 0);
//     ctx.restore();

//     const blob = await canvasToBlob(canvas, outputType);

//     return {
//       blob,
//       file: new File([blob], file.name, { type: blob.type }),
//       previewUrl: URL.createObjectURL(blob),
//       width: canvas.width,
//       height: canvas.height,
//       sizeBytes: blob.size,
//     };
//   } finally {
//     URL.revokeObjectURL(imageUrl);
//   }
// };

// export const applyImageCrop = async ({
//   file,
//   imageElement,
//   crop,
//   outputType = 'image/png',
// }) => {
//   if (!file) {
//     throw new Error('No image file provided');
//   }

//   if (!imageElement || !crop?.width || !crop?.height) {
//     throw new Error('No crop area provided');
//   }

//   const scaleX = imageElement.naturalWidth / imageElement.width;
//   const scaleY = imageElement.naturalHeight / imageElement.height;

//   const sourceX = crop.x * scaleX;
//   const sourceY = crop.y * scaleY;
//   const sourceWidth = crop.width * scaleX;
//   const sourceHeight = crop.height * scaleY;

//   const canvas = document.createElement('canvas');
//   const ctx = canvas.getContext('2d');

//   canvas.width = Math.round(sourceWidth);
//   canvas.height = Math.round(sourceHeight);

//   ctx.drawImage(
//     imageElement,
//     sourceX,
//     sourceY,
//     sourceWidth,
//     sourceHeight,
//     0,
//     0,
//     canvas.width,
//     canvas.height
//   );

//   const blob = await canvasToBlob(canvas, outputType);

//   return {
//     blob,
//     file: new File([blob], file.name, { type: blob.type }),
//     previewUrl: URL.createObjectURL(blob),
//     width: canvas.width,
//     height: canvas.height,
//     sizeBytes: blob.size,
//   };
// };

// export const applyImageFilter = async ({
//   file,
//   filter,
//   outputType = 'image/png',
// }) => {
//   const imageUrl = URL.createObjectURL(file);

//   try {
//     const image = await new Promise((resolve, reject) => {
//       const img = new Image();

//       img.onload = () => resolve(img);
//       img.onerror = reject;

//       img.src = imageUrl;
//     });

//     const canvas = document.createElement('canvas');
//     canvas.width = image.naturalWidth;
//     canvas.height = image.naturalHeight;

//     const ctx = canvas.getContext('2d');

//     const cssFilterMap = {
//       none: 'none',
//       pop: 'saturate(1.35) contrast(1.12) brightness(1.04)',
//       bw: 'grayscale(1) contrast(1.18)',
//       cool: 'saturate(1.08) contrast(1.08) hue-rotate(190deg) brightness(0.98)',
//       chrome: 'saturate(1.55) contrast(1.2) brightness(1.06)',
//       film: 'sepia(0.22) contrast(0.92) brightness(1.06) saturate(0.95)',
//     };

//     ctx.filter = cssFilterMap[filter] || 'none';
//     ctx.drawImage(image, 0, 0);

//     const blob = await new Promise((resolve) => {
//       canvas.toBlob(resolve, outputType, 0.95);
//     });

//     if (!blob) {
//       throw new Error('Could not apply image filter');
//     }

//     const filteredFile = new File([blob], file.name, {
//       type: outputType,
//       lastModified: Date.now(),
//     });

//     return {
//       file: filteredFile,
//       previewUrl: URL.createObjectURL(blob),
//     };
//   } finally {
//     URL.revokeObjectURL(imageUrl);
//   }
// };

// export const renderImageWithOverlays = async ({
//   file,
//   textLayers = [],
//   annotationStrokes = [],
//   outputType = 'image/png',
// }) => {
//   if (!file) {
//     throw new Error('No image file provided');
//   }

//   const imageUrl = URL.createObjectURL(file);

//   try {
//     const image = await loadImage(imageUrl);

//     const canvas = document.createElement('canvas');
//     const ctx = canvas.getContext('2d');

//     canvas.width = image.naturalWidth;
//     canvas.height = image.naturalHeight;

//     ctx.drawImage(image, 0, 0);

//     annotationStrokes.forEach((stroke) => {
//       if (!stroke.points || stroke.points.length < 2) return;

//       ctx.save();
//       ctx.strokeStyle = stroke.color || '#f97316';
//       ctx.lineWidth = stroke.size || Math.max(4, canvas.width * 0.006);
//       ctx.lineCap = 'round';
//       ctx.lineJoin = 'round';

//       ctx.beginPath();
//       ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

//       stroke.points.slice(1).forEach((point) => {
//         ctx.lineTo(point.x, point.y);
//       });

//       ctx.stroke();
//       ctx.restore();
//     });

//     textLayers.forEach((layer) => {
//       if (!layer.text?.trim()) return;

//       const fontSize = layer.fontSize || Math.round(canvas.width * 0.06);

//       ctx.save();
//       ctx.font = `700 ${fontSize}px ${layer.fontFamily || 'Arial, sans-serif'}`;
//       ctx.textAlign = 'center';
//       ctx.textBaseline = 'middle';

//       ctx.lineWidth = Math.max(2, fontSize * 0.08);
//       ctx.strokeStyle = layer.strokeColor || 'rgba(0, 0, 0, 0.55)';
//       ctx.fillStyle = layer.color || '#ffffff';

//       ctx.strokeText(layer.text, layer.x, layer.y);
//       ctx.fillText(layer.text, layer.x, layer.y);

//       ctx.restore();
//     });

//     const blob = await canvasToBlob(canvas, outputType);

//     return {
//       blob,
//       file: new File([blob], file.name, { type: blob.type }),
//       previewUrl: URL.createObjectURL(blob),
//       width: canvas.width,
//       height: canvas.height,
//       sizeBytes: blob.size,
//     };
//   } finally {
//     URL.revokeObjectURL(imageUrl);
//   }
// };


// const loadImage = (src) => {
//   return new Promise((resolve, reject) => {
//     const image = new Image();

//     image.onload = () => resolve(image);
//     image.onerror = () => reject(new Error('Failed to load image'));

//     image.src = src;
//   });
// };

// const canvasToBlob = (canvas, type) => {
//   return new Promise((resolve, reject) => {
//     canvas.toBlob(
//       (blob) => {
//         if (!blob) {
//           reject(new Error('Failed to create edited image'));
//           return;
//         }

//         resolve(blob);
//       },
//       type,
//       0.92
//     );
//   });
// };