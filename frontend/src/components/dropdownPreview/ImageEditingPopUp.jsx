import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { applyImageQuickAction, applyImageCrop, applyImageFilter } from '../../services/imageEditingServices/imageEditService';
import { AnimatePresence, motion } from 'framer-motion';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  X,
  Undo2,
  Redo2,
  Crop,
  WandSparkles,
  Pencil,
  Type,
  Square,
  SlidersHorizontal,
  Check,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
} from 'lucide-react';

export default function ImageEditorModal({
  isOpen,
  onClose,
  item,
  previewUrl,
  originalPreviewUrl,
  originalFile,
  initialCrop,
  compressedPreviewUrl,
  onApply,
}) {
  const [baseFile, setBaseFile] = useState(null);
  const [basePreviewUrl, setBasePreviewUrl] = useState(null);

  const [editedFile, setEditedFile] = useState(null);
  const [editedPreviewUrl, setEditedPreviewUrl] = useState(null);
  const [isEditing, setIsEditing] = useState(false);

  // for cropping 
  const imageRef = useRef(null);
  const handedOffPreviewUrlRef = useRef(null); 

  const [activeTool, setActiveTool] = useState(null);
  const [crop, setCrop] = useState(null);
  const [completedCrop, setCompletedCrop] = useState(null);
  const [completedPercentCrop, setCompletedPercentCrop] = useState(null);
  const [appliedCropPercent, setAppliedCropPercent] = useState(null);
  const [resetToOriginalPending, setResetToOriginalPending] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('none');

  const getFullCrop = () => ({
    unit: '%',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });

  const percentCropToPixelCrop = (percentCrop, image) => ({
    unit: 'px',
    x: (image.width * percentCrop.x) / 100,
    y: (image.height * percentCrop.y) / 100,
    width: (image.width * percentCrop.width) / 100,
    height: (image.height * percentCrop.height) / 100,
  });

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    setBaseFile(item.editedFile || item.file);
    setBasePreviewUrl(previewUrl);

    setEditedFile(null);
    setEditedPreviewUrl(null);

    setActiveTool(null);
    setCrop(null);
    setCompletedCrop(null);
    setCompletedPercentCrop(null);
    setAppliedCropPercent(initialCrop || null);
    setResetToOriginalPending(false);
    setSelectedFilter('none');

    handedOffPreviewUrlRef.current = null;
  }, [isOpen, item.file, item.editedFile, previewUrl, initialCrop]);

  const isFullImageCrop = () => {
    const percentCrop = completedPercentCrop || crop;

    if (!percentCrop) return false;

    return (
      Math.round(percentCrop.x) === 0 &&
      Math.round(percentCrop.y) === 0 &&
      Math.round(percentCrop.width) === 100 &&
      Math.round(percentCrop.height) === 100
    );
  };

  const commitCrop = async () => {
    if (!completedCrop || !imageRef.current) {
      return null;
    }

    if (isFullImageCrop()) {
      if (
        editedPreviewUrl &&
        editedPreviewUrl !== handedOffPreviewUrlRef.current
      ) {
        URL.revokeObjectURL(editedPreviewUrl);
      }

      const fullCrop = getFullCrop();

      setEditedFile(null);
      setEditedPreviewUrl(null);
      setAppliedCropPercent(fullCrop);
      setResetToOriginalPending(true);

      setActiveTool(null);
      setCrop(null);
      setCompletedCrop(null);
      setCompletedPercentCrop(null);

      return {
        file: originalFile || item.file,
        previewUrl: originalPreviewUrl || item.previewUrl || previewUrl,
        cropPercent: fullCrop,
        resetToOriginal: true,
      };
    }

    const sourceFile = originalFile || item.file;
    const cropPercentToSave = completedPercentCrop || crop;

    const result = await applyImageCrop({
      file: sourceFile,
      imageElement: imageRef.current,
      crop: completedCrop,
      outputType: item.file.type || 'image/png',
    });

    if (
      editedPreviewUrl &&
      editedPreviewUrl !== handedOffPreviewUrlRef.current
    ) {
      URL.revokeObjectURL(editedPreviewUrl);
    }

    setEditedFile(result.file);
    setEditedPreviewUrl(result.previewUrl);
    setAppliedCropPercent(cropPercentToSave);
    setResetToOriginalPending(false);

    setActiveTool(null);
    setCrop(null);
    setCompletedCrop(null);
    setCompletedPercentCrop(null);

    return {
      ...result,
      cropPercent: cropPercentToSave,
      resetToOriginal: false,
    };
  };

  // filter 
  const filterOptions = [
    {
      id: 'none',
      label: 'None',
      css: 'none',
    },
    {
      id: 'pop',
      label: 'Pop',
      css: 'saturate(1.35) contrast(1.12) brightness(1.04)',
    },
    {
      id: 'bw',
      label: 'Greyscale',
      css: 'grayscale(1) contrast(1.18)',
    },
    {
      id: 'cool',
      label: 'Cool',
      css: 'saturate(1.08) contrast(1.08) hue-rotate(190deg) brightness(0.98)',
    },
    {
      id: 'chrome',
      label: 'Chrome',
      css: 'saturate(1.55) contrast(1.2) brightness(1.06)',
    },
    {
      id: 'film',
      label: 'Film',
      css: 'sepia(0.22) contrast(0.92) brightness(1.06) saturate(0.95)',
    },
  ];

  const commitFilter = async () => {
    if (selectedFilter === 'none') {
      return null;
    }

    const sourceFile =
      editedFile ||
      (resetToOriginalPending ? originalFile : baseFile) ||
      item.file;

    const result = await applyImageFilter({
      file: sourceFile,
      filter: selectedFilter,
      outputType: item.file.type || 'image/png',
    });

    if (
      editedPreviewUrl &&
      editedPreviewUrl !== handedOffPreviewUrlRef.current
    ) {
      URL.revokeObjectURL(editedPreviewUrl);
    }

    setEditedFile(result.file);
    setEditedPreviewUrl(result.previewUrl);
    setSelectedFilter('none');
    setResetToOriginalPending(false);

    return result;
  };

const getFilterCss = (filterId) => {
  return filterOptions.find((filter) => filter.id === filterId)?.css || 'none';
};

  const handleQuickAction = async (action) => {
    try {
      setIsEditing(true);

      const sourceFile =
        editedFile ||
        (resetToOriginalPending ? originalFile : baseFile) ||
        item.file;

      const result = await applyImageQuickAction({
        file: sourceFile,
        action,
        outputType: item.file.type || 'image/png',
      });

      if (
        editedPreviewUrl &&
        editedPreviewUrl !== handedOffPreviewUrlRef.current
      ) {
        URL.revokeObjectURL(editedPreviewUrl);
      }

      setEditedFile(result.file);
      setEditedPreviewUrl(result.previewUrl);
      setResetToOriginalPending(false);
    } catch (error) {
      console.error(`${action} failed:`, error);
    } finally {
      setIsEditing(false);
    }
  };

  const handleResetImageToOriginal = () => {
    if (
      editedPreviewUrl &&
      editedPreviewUrl !== handedOffPreviewUrlRef.current
    ) {
      URL.revokeObjectURL(editedPreviewUrl);
    }

    const fullCrop = getFullCrop();

    setEditedFile(null);
    setEditedPreviewUrl(null);
    setAppliedCropPercent(fullCrop);
    setResetToOriginalPending(true);

    setCrop(fullCrop);
    setCompletedPercentCrop(fullCrop);

    if (imageRef.current) {
      setCompletedCrop(percentCropToPixelCrop(fullCrop, imageRef.current));
    } else {
      setCompletedCrop(null);
    }
  };

  const handleApplyCrop = async () => {
    try {
      setIsEditing(true);
      await commitCrop();
    } catch (error) {
      console.error('Crop failed:', error);
    } finally {
      setIsEditing(false);
    }
  };

  const handleCropImageLoad = (e) => {
    const image = e.currentTarget;

    imageRef.current = image;

    const nextCrop = crop || appliedCropPercent || initialCrop || getFullCrop();

    setCrop(nextCrop);
    setCompletedPercentCrop(nextCrop);
    setCompletedCrop(percentCropToPixelCrop(nextCrop, image));
  };

  // for restting crop 
  const handleResetEdits = () => {
    if (
      editedPreviewUrl &&
      editedPreviewUrl !== handedOffPreviewUrlRef.current
    ) {
      URL.revokeObjectURL(editedPreviewUrl);
    }

    setEditedFile(null);
    setEditedPreviewUrl(null);

    setActiveTool(null);
    setCrop(null);
    setCompletedCrop(null);
    setCompletedPercentCrop(null);
    setResetToOriginalPending(false);
  };

  if (typeof document === 'undefined') return null;

  const normalImageUrl = resetToOriginalPending
    ? originalPreviewUrl || item.previewUrl || previewUrl
    : editedPreviewUrl || basePreviewUrl || previewUrl;

  const cropImageUrl = originalPreviewUrl || item.previewUrl || previewUrl;

  const imageUrl = activeTool === 'crop'
    ? cropImageUrl
    : normalImageUrl;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="image-editor-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/90 backdrop-blur-2xl p-4 md:p-8"
          onClick={onClose}
        >
          <motion.div
            key="image-editor-container"
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-[32px] bg-white shadow-2xl"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-stone-200 bg-white px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-stone-900">
                  Edit image
                </p>
                <p className="truncate text-xs font-medium text-stone-400">
                  {item?.file?.name}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                aria-label="Close image editor"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-center gap-3 border-b border-stone-200 bg-white px-4 py-3">
              <button
                type="button"
                onClick={() => null}
                className="flex h-10 w-10 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-200 hover:text-stone-950"
                aria-label="Undo"
              >
                <Undo2 className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => null}
                className="flex h-10 w-10 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-200 hover:text-stone-950"
                aria-label="Redo"
              >
                <Redo2 className="h-5 w-5" />
              </button>

              <div className="mx-2 h-8 w-px bg-stone-200" />

              <button
                type="button"
                onClick={() => {
                  const nextTool = activeTool === 'crop' ? null : 'crop';

                  setActiveTool(nextTool);

                  if (nextTool === 'crop') {
                    const nextCrop = appliedCropPercent || initialCrop || getFullCrop();

                    setCrop(nextCrop);
                    setCompletedCrop(null);
                    setCompletedPercentCrop(null);
                  }
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                  activeTool === 'crop'
                    ? 'bg-stone-100 text-stone-950'
                    : 'text-stone-600 hover:bg-stone-200 hover:text-stone-950'
                }`}
                aria-label="Crop"
              >
                <Crop className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTool(activeTool === 'filter' ? null : 'filter');
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                  activeTool === 'filter'
                    ? 'bg-stone-100 text-stone-950'
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950'
                }`}
                aria-label="Filter"
              >
                <WandSparkles className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => null}
                className="flex h-10 w-10 items-center justify-center rounded-full text-stone-900 transition hover:bg-stone-200"
                aria-label="Draw"
              >
                <Pencil className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => null}
                className="flex h-10 w-10 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-200 hover:text-stone-950"
                aria-label="Add text"
              >
                <Type className="h-5 w-5" />
              </button>

              {/* <button
                type="button"
                onClick={() => null}
                className="flex h-10 w-10 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-100 hover:text-stone-950"
                aria-label="Shape"
              >
                <Square className="h-5 w-5" />
              </button> */}
            </div>

            {/* Main editor body */}
            <div className="grid min-h-0 flex-1 grid-cols-1 bg-stone-50 md:grid-cols-[minmax(0,1fr)_320px]">
              {/* Image canvas area */}
              <div className="flex min-h-0 h-full flex-col items-center justify-center overflow-hidden p-4">
                {activeTool === 'filter' && (
                  <div className="mb-4 flex w-full justify-center overflow-x-auto px-2">
                    <div className="flex items-center gap-5">
                      {filterOptions.map((filter) => {
                        const isSelected = selectedFilter === filter.id;
                        const filterPreviewUrl = normalImageUrl;

                        return (
                          <button
                            key={filter.id}
                            type="button"
                            onClick={() => setSelectedFilter(filter.id)}
                            className="flex shrink-0 flex-col items-center gap-2"
                          >
                            <div
                              className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 transition ${
                                isSelected
                                  ? 'border-emerald-600'
                                  : 'border-transparent'
                              }`}
                            >
                              {filterPreviewUrl ? (
                                <img
                                  src={filterPreviewUrl}
                                  alt={`${filter.label} filter preview`}
                                  className="h-full w-full object-cover"
                                  style={{ filter: filter.css }}
                                />
                              ) : (
                                <div className="h-full w-full bg-stone-100" />
                              )}

                              {isSelected && (
                                <div className="absolute inset-0 flex items-center justify-center bg-emerald-700/45 text-white">
                                  <Check className="h-7 w-7" />
                                </div>
                              )}
                            </div>

                            <span
                              className={`text-sm font-bold ${
                                isSelected ? 'text-emerald-700' : 'text-stone-500'
                              }`}
                            >
                              {filter.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="relative flex min-h-0 max-h-full w-full max-w-full flex-1 items-center justify-center rounded-2xl bg-white p-4 shadow-xl">
                  {imageUrl ? (
                    activeTool === 'crop' ? (
                      <div className="flex h-full w-full items-center justify-center overflow-hidden">
                        <ReactCrop
                          crop={crop}
                          onChange={(newCrop, newPercentCrop) => {
                            setCrop(newPercentCrop);
                          }}
                          onComplete={(newCompletedCrop, newPercentCrop) => {
                            setCompletedCrop(newCompletedCrop);
                            setCompletedPercentCrop(newPercentCrop);
                          }}
                          minWidth={30}
                          minHeight={30}
                          keepSelection
                          className="archeio-crop max-h-full max-w-full"
                        >
                          <img
                            ref={imageRef}
                            src={imageUrl}
                            alt={item?.file?.name || 'Image being edited'}
                            onLoad={handleCropImageLoad}
                            className="block max-h-[calc(90vh-360px)] max-w-full object-contain"
                          />
                        </ReactCrop>
                      </div>
                    ) : (
                      <img
                        src={imageUrl}
                        alt={item?.file?.name || 'Image being edited'}
                        className="block max-h-full max-w-full rounded-xl object-contain"
                        style={{
                          filter: activeTool === 'filter' ? getFilterCss(selectedFilter) : 'none',
                        }}
                      />
                    )
                  ) : (
                    <div className="flex h-[400px] w-[600px] max-w-full items-center justify-center rounded-xl bg-stone-100 text-sm font-semibold text-stone-400">
                      Image preview unavailable
                    </div>
                  )}
                </div>

                {activeTool === 'crop' && (
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTool(null);
                        setCrop(null);
                        setCompletedCrop(null);
                        setCompletedPercentCrop(null);
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200 hover:text-stone-950 active:scale-[0.98]"
                      aria-label="Cancel crop"
                    >
                      <X className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleResetImageToOriginal}
                      className="rounded-full bg-stone-100 px-5 py-2.5 text-sm font-bold text-stone-600 transition hover:bg-stone-200 hover:text-stone-950 active:scale-[0.98]"
                    >
                      Reset
                    </button>

                    <button
                      type="button"
                      disabled={!completedCrop || isEditing}
                      onClick={handleApplyCrop}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-600 text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
                      aria-label="Apply crop"
                    >
                      <Check className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Right settings panel */}
              <div className="border-t border-stone-200 bg-white p-5 md:border-l md:border-t-0">
                <div className="mb-5 flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-orange-600" />
                  <h3 className="text-sm font-bold text-stone-900">
                    Editing tools
                  </h3>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-stone-200 p-4">
                    <p className="mb-2 text-sm font-bold text-stone-800">
                      Quick actions
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickAction('rotate-left')}
                        className="flex items-center justify-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-200 hover:text-stone-950"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Rotate left
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickAction('rotate-right')}
                        className="flex items-center justify-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-200 hover:text-stone-950"
                      >
                        <RotateCw className="h-4 w-4" />
                        Rotate right
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickAction('flip-horizontal')}
                        className="flex items-center justify-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-200 hover:text-stone-950"
                      >
                        <FlipHorizontal className="h-4 w-4" />
                        Flip H
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickAction('flip-vertical')}
                        className="flex items-center justify-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600 transition hover:bg-stone-200 hover:text-stone-950"
                      >
                        <FlipVertical className="h-4 w-4" />
                        Flip V
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200 p-4">
                    <p className="mb-2 text-sm font-bold text-stone-800">
                      Current mode
                    </p>

                    {activeTool === 'crop' ? (
                      <p className="text-xs leading-relaxed text-stone-500">
                        Drag the corners or edges to choose the area you want to keep. 
                      </p>
                    ) : activeTool === 'filter' ? (
                      <p className="text-xs leading-relaxed text-stone-500">
                        Choose a filter above the image. 
                      </p>
                    ) : (
                      <p className="text-xs leading-relaxed text-stone-500">
                        Choose crop, filter, draw, or text from the toolbar.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="flex items-center justify-between border-t border-stone-200 bg-white px-5 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-sm font-bold text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isEditing}
                onClick={async () => {
                  try {
                    setIsEditing(true);

                    if (activeTool === 'crop' && completedCrop) {
                      const cropResult = await commitCrop();

                      if (cropResult) {
                        if (!cropResult.resetToOriginal) {
                          handedOffPreviewUrlRef.current = cropResult.previewUrl;
                        }

                        onApply({
                          file: cropResult.file,
                          previewUrl: cropResult.previewUrl,
                          cropPercent: cropResult.cropPercent,
                          resetToOriginal: cropResult.resetToOriginal,
                        });
                        return;
                      }
                    }

                    if (activeTool === 'filter' && selectedFilter !== 'none') {
                      const filterResult = await commitFilter();

                      if (filterResult) {
                        handedOffPreviewUrlRef.current = filterResult.previewUrl;

                        onApply({
                          file: filterResult.file,
                          previewUrl: filterResult.previewUrl,
                          cropPercent: appliedCropPercent || initialCrop,
                          resetToOriginal: false,
                        });
                        return;
                      }
                    }

                    if (resetToOriginalPending) {
                      onApply({
                        file: originalFile || item.file,
                        previewUrl: originalPreviewUrl || item.previewUrl || previewUrl,
                        cropPercent: getFullCrop(),
                        resetToOriginal: true,
                      });
                      return;
                    }

                    if (editedFile && editedPreviewUrl) {
                      handedOffPreviewUrlRef.current = editedPreviewUrl;

                      onApply({
                        file: editedFile,
                        previewUrl: editedPreviewUrl,
                        cropPercent: appliedCropPercent || initialCrop,
                        resetToOriginal: false,
                      });
                      return;
                    }

                    onClose();
                  } catch (error) {
                    console.error('Apply changes failed:', error);
                  } finally {
                    setIsEditing(false);
                  }
                }}
                className="flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]"
              >
                <Check className="h-4 w-4" />
                Apply changes
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}