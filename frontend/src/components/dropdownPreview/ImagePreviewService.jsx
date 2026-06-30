// To help compress the preview on the fly as you change the slider 
export const createImageCompressionPreview = ({
  file,
  ratio,
  format,
  resizeEnabled = false,
  maxWidth = null,
  maxHeight = null,
  maintainAspectRatio = true,
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
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

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
            width: targetWidth,
            height: targetHeight,
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