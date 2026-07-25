export const MIN_OCR_ZOOM = 0.25;
export const MAX_OCR_ZOOM = 3;
export const OCR_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'];

export const isPdfFile = (file) => (
  file?.type === 'application/pdf' || file?.name?.toLowerCase().endsWith('.pdf')
);

export const isSupportedOcrSource = (file) => {
  const name = file?.name?.toLowerCase() || '';
  return Boolean(
    isPdfFile(file)
    || OCR_IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension)),
  );
};

export const clampOcrZoom = (value) => (
  Math.min(MAX_OCR_ZOOM, Math.max(MIN_OCR_ZOOM, value))
);

export const ocrDocumentName = (file) => (
  `${file.name.replace(/\.[^/.]+$/, '')}.docx`
);

export const ocrSourceKey = (file) => (
  `${file.name}:${file.size}:${file.lastModified}`
);
