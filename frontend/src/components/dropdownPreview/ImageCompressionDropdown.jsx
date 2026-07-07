import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import BeforeAfterImageSlider from './BeforeAfterImageSlider';
import { createImageCompressionPreview } from './ImagePreviewService';
import ImageEditorModal from './ImageEditingPopUp'; 

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const ImageCompressionDetails = ({
  item,
  effectiveRatio,
  updateFileItem,
  updatePreviewItem,
}) => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const originalWidth = item.fileInfo?.width;
  const originalHeight = item.fileInfo?.height;

  const aspectRatio =
    originalWidth && originalHeight
      ? originalWidth / originalHeight
      : null;

  const sourceFile = item.editedFile || item.file;
  const sourcePreviewUrl = item.editedPreviewUrl || item.previewUrl;
  
  // handle resets in case you mess up aspect ratio 
  const resetToOriginalDimensions = () => {
    updateFileItem(item.id, {
      maxWidth: originalWidth ?? '',
      maxHeight: originalHeight ?? '',
    });
  };

  const handleMaxWidthChange = (e) => {
    const maxWidth = e.target.value;

    if (!item.maintainAspectRatio || !aspectRatio || maxWidth === '') {
      updateFileItem(item.id, {
        maxWidth,
      });
      return;
    }

    updateFileItem(item.id, {
      maxWidth,
      maxHeight: Math.round(Number(maxWidth) / aspectRatio),
    });
  };

  const handleMaxHeightChange = (e) => {
    const maxHeight = e.target.value;

    if (!item.maintainAspectRatio || !aspectRatio || maxHeight === '') {
      updateFileItem(item.id, {
        maxHeight,
      });
      return;
    }

    updateFileItem(item.id, {
      maxHeight,
      maxWidth: Math.round(Number(maxHeight) * aspectRatio),
    });
  };

  useEffect(() => {
    if (!(item.editedFile || item.file) || item.fileInfo.category !== 'images') return;

    let cancelled = false;
    let generatedUrl = '';

    updatePreviewItem(item.id, {
      previewLoading: true,
    });

    const timeoutId = setTimeout(async () => {
      try {
        const preview = await createImageCompressionPreview({
          file: sourceFile,
          ratio: effectiveRatio,
          format: item.format,
          resizeEnabled: item.resizeEnabled,
          maxWidth: item.maxWidth ? Number(item.maxWidth) : null,
          maxHeight: item.maxHeight ? Number(item.maxHeight) : null,
          maintainAspectRatio: item.maintainAspectRatio,
        });

        if (cancelled) {
          URL.revokeObjectURL(preview.previewUrl);
          return;
        }

        generatedUrl = preview.previewUrl;

        if (item.compressedPreviewUrl) {
          URL.revokeObjectURL(item.compressedPreviewUrl);
        }

        updatePreviewItem(item.id, {
          compressedPreviewUrl: preview.previewUrl,
          estimatedSize: preview.sizeBytes,
          previewWidth: preview.width,
          previewHeight: preview.height,
          previewLoading: false,
        });
      } catch (error) {
        if (!cancelled) {
          updatePreviewItem(item.id, {
            previewLoading: false,
          });
        }
      }
    }, 300); // 300ms lagtime so it doesnt recompress every slider movement 

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);

      if (generatedUrl) {
        URL.revokeObjectURL(generatedUrl);
      }
    };
  }, [
    item.id,
    item.file,
    item.editedFile,
    item.fileInfo.category,
    item.format,
    effectiveRatio,
    item.resizeEnabled,
    item.maxWidth,
    item.maxHeight,
    item.maintainAspectRatio,
  ]);

  const compressedSizeText = item.downloadUrl
    ? item.result?.compressedSize
    : item.previewLoading
      ? 'Generating preview...'
      : item.estimatedSize
        ? formatBytes(item.estimatedSize)
        : 'Preview pending';

  return (
    <>
      <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          
          {/* Component one : img preview */}
          <div className="md:col-span-2">
            <BeforeAfterImageSlider
              originalUrl={sourcePreviewUrl}
              compressedUrl={
                item.downloadUrl ||
                item.compressedPreviewUrl ||
                sourcePreviewUrl
              }
              originalSize={formatBytes(sourceFile?.size)}
              compressedSize={
                item.previewLoading
                  ? 'Generating preview...'
                  : item.downloadUrl
                    ? item.result?.compressedSize
                    : item.estimatedSize
                      ? formatBytes(item.estimatedSize)
                      : 'Preview pending'
              }
            />
          </div>

          {/* Component two : compression lvl + edit button */}
          <div className="rounded-xl border border-stone-200 p-4">
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditorOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-stone-100 text-stone-600 transition hover:bg-stone-200 hover:text-stone-950 active:scale-[0.98]"
              >
                <Pencil className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => setIsEditorOpen(true)}
                className="flex h-10 items-center text-sm font-semibold text-stone-500 transition hover:text-stone-800"
              >
                Edit image
              </button>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-bold text-stone-800">
                Compression 
              </label>

              <span className="text-sm font-bold text-orange-600">
                {effectiveRatio}%
              </span>
            </div>

            <input
              type="range"
              min="20"
              max="90"
              value={effectiveRatio}
              onChange={(e) =>
                updateFileItem(item.id, {
                  customRatio: Number(e.target.value),
                  useCustomSettings: true,
                })
              }
              className="w-full accent-orange-600"
            />

            <div className="mt-1 flex justify-between text-xs text-stone-500">
              <span>↑ quality</span>
              <span>↓ size</span>
            </div>

            {item.useCustomSettings && (
              <button
                type="button"
                onClick={() =>
                  updateFileItem(item.id, {
                    customRatio: null,
                    useCustomSettings: false,
                  })
                }
                className="mt-2 text-xs font-bold text-orange-600 hover:text-orange-700"
              >
                Use batch default
              </button>
            )}
          </div>

          {/* Component three : resize */}
          <div className="rounded-xl border border-stone-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-stone-800">
                Resize optional
              </p>

              <button
                type="button"
                onClick={() => {
                  const nextResizeEnabled = !item.resizeEnabled;

                  updateFileItem(item.id, {
                    resizeEnabled: nextResizeEnabled,
                    maintainAspectRatio: true,
                    maxWidth: originalWidth ?? '',
                    maxHeight: originalHeight ?? '',
                  });
                }}
                className={`h-6 w-11 rounded-full p-1 transition ${
                  item.resizeEnabled ? 'bg-orange-500' : 'bg-stone-300'
                }`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white transition ${
                    item.resizeEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            {item.resizeEnabled && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-stone-500">
                      Max Width
                    </label>
                    <input
                      type="number"
                      value={item.maxWidth ?? ''}
                      onChange={handleMaxWidthChange}
                      placeholder="1920"
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
                    />  
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-stone-500">
                      Max Height
                    </label>
                    <input
                      type="number"
                      value={item.maxHeight ?? ''}
                      onChange={handleMaxHeightChange}
                      placeholder="1080"
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <label className="mt-3 flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={item.maintainAspectRatio ?? true}
                    onChange={(e) => {
                      const checked = e.target.checked;

                      if (!checked || !aspectRatio) {
                        updateFileItem(item.id, {
                          maintainAspectRatio: checked,
                        });
                        return;
                      }

                      updateFileItem(item.id, {
                        maintainAspectRatio: true,
                        maxHeight: item.maxWidth
                          ? Math.round(Number(item.maxWidth) / aspectRatio)
                          : originalHeight ?? '',
                      });
                    }}
                    className="accent-orange-600"
                  />
                  Maintain aspect ratio
                </label>
              </>
            )}

            <div className="rounded-lg bg-orange-50 p-3 text-sm font-bold text-stone-800">
              Estimated size:{' '}
              <span className="text-orange-600">
                {compressedSizeText}
              </span>
            </div>
          </div>
        </div>
      </div>

      <ImageEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        item={item}
        previewUrl={item.editedPreviewUrl || item.previewUrl}
        originalPreviewUrl={item.previewUrl}
        originalFile={item.file}
        initialCrop={item.editedCrop}
        initialTextLayers={item.textLayers || []}
        initialAnnotationStrokes={item.annotationStrokes || []}
        compressedPreviewUrl={item.compressedPreviewUrl}
        onApply={({
          file,
          previewUrl,
          cropPercent,
          resetToOriginal,
          textLayers,
          annotationStrokes,
        }) => {
          if (previewUrl && item.editedPreviewUrl && item.editedPreviewUrl !== previewUrl) {
            URL.revokeObjectURL(item.editedPreviewUrl);
          }

          if (resetToOriginal) {
            updatePreviewItem(item.id, {
              editedFile: null,
              editedPreviewUrl: '',
              editedCrop: null,

              textLayers: textLayers ?? item.textLayers ?? [],
              annotationStrokes: annotationStrokes ?? item.annotationStrokes ?? [],

              result: null,
              downloadUrl: '',
              compressedFileName: '',
              compressedPreviewUrl: '',
              estimatedSize: null,
              previewLoading: false,
              status: 'idle',
            });

            setIsEditorOpen(false);
            return;
          }

          updatePreviewItem(item.id, {
            ...(file && previewUrl
              ? {
                  editedFile: file,
                  editedPreviewUrl: previewUrl,
                }
              : {}),

            editedCrop: cropPercent ?? item.editedCrop,

            textLayers: textLayers ?? item.textLayers ?? [],
            annotationStrokes: annotationStrokes ?? item.annotationStrokes ?? [],

            result: null,
            downloadUrl: '',
            compressedFileName: '',
            compressedPreviewUrl: '',
            estimatedSize: null,
            previewLoading: false,
            status: 'idle',
          });

          setIsEditorOpen(false);
        }}
      />
    </>
  );
};

export default ImageCompressionDetails;