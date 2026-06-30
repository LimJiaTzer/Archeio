import { useEffect } from 'react';
import BeforeAfterImageSlider from './BeforeAfterImageSlider';
import { createImageCompressionPreview } from './ImagePreviewService';

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

  useEffect(() => {
    if (!item.file || item.fileInfo.category !== 'images') return;

    let cancelled = false;
    let generatedUrl = '';

    updatePreviewItem(item.id, {
      previewLoading: true,
    });

    const timeoutId = setTimeout(async () => {
      try {
        const preview = await createImageCompressionPreview({
          file: item.file,
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
    item.fileInfo.category,
    item.format,
    effectiveRatio,
    item.resizeEnabled,
    item.maxWidth,
    item.maxHeight,
    item.maintainAspectRatio,
  ]);

  const compressedSize =
    item.result?.compressedSizeBytes || item.result?.compressedSize;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[1.4fr_1fr]">
        <BeforeAfterImageSlider
          originalUrl={item.previewUrl}
          compressedUrl={
            item.downloadUrl || item.compressedPreviewUrl || item.previewUrl
          }
          originalSize={formatBytes(item.file?.size)}
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

        <div className="space-y-5 rounded-xl border border-stone-200 p-4">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-bold text-stone-800">
                Compresison 
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
              <span>Better quality</span>
              <span>Smaller size</span>
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

          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-stone-800">
                Resize optional
              </p>

              <button
                type="button"
                onClick={() =>
                  updateFileItem(item.id, {
                    resizeEnabled: !item.resizeEnabled,
                  })
                }
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
                      onChange={(e) =>
                        updateFileItem(item.id, {
                          maxWidth: e.target.value,
                        })
                      }
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
                      onChange={(e) =>
                        updateFileItem(item.id, {
                          maxHeight: e.target.value,
                        })
                      }
                      placeholder="1080"
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <label className="mt-3 flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    checked={item.maintainAspectRatio ?? true}
                    onChange={(e) =>
                      updateFileItem(item.id, {
                        maintainAspectRatio: e.target.checked,
                      })
                    }
                    className="accent-orange-600"
                  />
                  Maintain aspect ratio
                </label>
              </>
            )}
          </div>

          <div className="rounded-lg bg-orange-50 p-3 text-sm font-bold text-stone-800">
            Estimated size:{' '}
            <span className="text-orange-600">
              {compressedSize || 'After compression'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCompressionDetails;