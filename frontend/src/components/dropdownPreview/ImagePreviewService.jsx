// To help compress the preview on the fly as you change the slider 
import { renderImageWithOverlays } from '../../services/imageEditingServices/imageEditService';

// To help compress the preview on the fly as you change the slider 
export const createImageCompressionPreview = async ({
  file,
  ratio,
  format,
  resizeEnabled = false,
  maxWidth = null,
  maxHeight = null,
  maintainAspectRatio = true,
  cropPercent = null,
  textLayers = [],
  annotationStrokes = [],
}) => {
  if (!file) {
    throw new Error('No image file provided');
  }

  const hasOverlays =
    textLayers.length > 0 || annotationStrokes.length > 0;
  const hasCrop = !isFullCropPercent(cropPercent);

  let renderedEditResult = null;
  let previewSourceFile = file;

  try {
    // The left preview and the compressed preview must start from the exact
    // same pixels, including annotation, text, and the metadata-only crop.
    if (hasOverlays || hasCrop) {
      renderedEditResult = await renderImageWithOverlays({
        file,
        textLayers,
        annotationStrokes,
        cropPercent,
        outputType: 'image/png',
      });

      previewSourceFile = renderedEditResult.file;
    }

    const compressedPreview = await compressPreviewFile({
      file: previewSourceFile,
      ratio,
      format,
      resizeEnabled,
      maxWidth,
      maxHeight,
      maintainAspectRatio,
    });

    return {
      ...compressedPreview,
      sourcePreviewUrl: renderedEditResult?.previewUrl || null,
      sourceSizeBytes: previewSourceFile.size,
      sourceWidth:
        renderedEditResult?.width ?? compressedPreview.originalWidth,
      sourceHeight:
        renderedEditResult?.height ?? compressedPreview.originalHeight,
    };
  } catch (error) {
    if (renderedEditResult?.previewUrl) {
      URL.revokeObjectURL(renderedEditResult.previewUrl);
    }

    throw error;
  }
};

const compressPreviewFile = ({
  file,
  ratio,
  format,
  resizeEnabled,
  maxWidth,
  maxHeight,
  maintainAspectRatio,
}) => {
  return new Promise((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(imageUrl);

      let targetWidth = img.width;
      let targetHeight = img.height;

      if (resizeEnabled && (maxWidth || maxHeight)) {
        const widthLimit = maxWidth || img.width;
        const heightLimit = maxHeight || img.height;

        if (maintainAspectRatio) {
          const scale = Math.min(
            widthLimit / img.width,
            heightLimit / img.height,
            1
          );

          targetWidth = Math.round(img.width * scale);
          targetHeight = Math.round(img.height * scale);
        } else {
          targetWidth = widthLimit;
          targetHeight = heightLimit;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, targetWidth);
      canvas.height = Math.max(1, targetHeight);

      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Failed to create image preview canvas'));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const outputMimeType =
        format === 'png'
          ? 'image/png'
          : format === 'webp'
            ? 'image/webp'
            : 'image/jpeg';

      const quality = Math.max(0.1, Math.min(0.92, 1 - ratio / 100));

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create image preview'));
            return;
          }

          const previewUrl = URL.createObjectURL(blob);

          resolve({
            previewUrl,
            sizeBytes: blob.size,
            width: canvas.width,
            height: canvas.height,
            originalWidth: img.width,
            originalHeight: img.height,
          });
        },
        outputMimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = imageUrl;
  });
};

const isFullCropPercent = (cropPercent) => {
  if (!cropPercent) return true;

  return (
    Math.abs(Number(cropPercent.x) || 0) < 0.01 &&
    Math.abs(Number(cropPercent.y) || 0) < 0.01 &&
    Math.abs((Number(cropPercent.width) || 100) - 100) < 0.01 &&
    Math.abs((Number(cropPercent.height) || 100) - 100) < 0.01
  );
};

//   file,
//   ratio,
//   format,
//   resizeEnabled = false,
//   maxWidth = null,
//   maxHeight = null,
//   maintainAspectRatio = true,
// }) => {
//   return new Promise((resolve, reject) => {
//     const imageUrl = URL.createObjectURL(file);
//     const img = new Image();

//     img.onload = () => {
//       URL.revokeObjectURL(imageUrl);

//       let targetWidth = img.width;
//       let targetHeight = img.height;

//       if (resizeEnabled && (maxWidth || maxHeight)) {
//         const widthLimit = maxWidth || img.width;
//         const heightLimit = maxHeight || img.height;

//         if (maintainAspectRatio) {
//           const scale = Math.min(
//             widthLimit / img.width,
//             heightLimit / img.height,
//             1
//           );

//           targetWidth = Math.round(img.width * scale);
//           targetHeight = Math.round(img.height * scale);
//         } else {
//           targetWidth = widthLimit;
//           targetHeight = heightLimit;
//         }
//       }

//       const canvas = document.createElement('canvas');
//       canvas.width = targetWidth;
//       canvas.height = targetHeight;

//       const ctx = canvas.getContext('2d');
//       ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

//       const outputMimeType =
//         format === 'png'
//           ? 'image/png'
//           : format === 'webp'
//             ? 'image/webp'
//             : 'image/jpeg';

//       const quality = Math.max(0.1, Math.min(0.92, 1 - ratio / 100));

//       canvas.toBlob(
//         (blob) => {
//           if (!blob) {
//             reject(new Error('Failed to create image preview'));
//             return;
//           }

//           const previewUrl = URL.createObjectURL(blob);

//           resolve({
//             previewUrl,
//             sizeBytes: blob.size,
//             width: targetWidth,
//             height: targetHeight,
//           });
//         },
//         outputMimeType,
//         quality
//       );
//     };

//     img.onerror = () => {
//       URL.revokeObjectURL(imageUrl);
//       reject(new Error('Failed to load image'));
//     };

//     img.src = imageUrl;
//   });
// };