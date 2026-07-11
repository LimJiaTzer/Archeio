
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
  initialTextLayers = [],
  initialAnnotationStrokes = [],
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

  const [cropSourceFile, setCropSourceFile] = useState(null);
  const [cropSourcePreviewUrl, setCropSourcePreviewUrl] = useState(null);

  const imageStageRef = useRef(null);
  const displayImageRef = useRef(null);
  const overlayRef = useRef(null);

  const [textLayers, setTextLayers] = useState([]);
  const [annotationStrokes, setAnnotationStrokes] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [draggingTextId, setDraggingTextId] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState(null);
  const [textDraft, setTextDraft] = useState('Text');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textSize, setTextSize] = useState(48);
  const [brushColor, setBrushColor] = useState('#f97316');
  const [brushSize, setBrushSize] = useState(8);
  const [naturalImageSize, setNaturalImageSize] = useState({
    width: 0,
    height: 0,
  });
  const [overlayBounds, setOverlayBounds] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });

  const createLayerId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()}`;
  };

  const updateOverlayBounds = () => {
    const stage = imageStageRef.current;
    const image = displayImageRef.current;

    if (!stage || !image) return;

    const stageRect = stage.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();

    setOverlayBounds({
      left: imageRect.left - stageRect.left,
      top: imageRect.top - stageRect.top,
      width: imageRect.width,
      height: imageRect.height,
    });
  };

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
    setCropSourceFile(null);
    setCropSourcePreviewUrl(null);

    setTextLayers(initialTextLayers || []);
    setAnnotationStrokes(initialAnnotationStrokes || []);
    setSelectedTextId(null);
    setDraggingTextId(null);
    setIsDrawing(false);
    setCurrentStroke(null);

    handedOffPreviewUrlRef.current = null;
  }, [
    isOpen,
    item.file,
    item.editedFile,
    previewUrl,
    initialCrop,
    initialTextLayers,
    initialAnnotationStrokes,
  ]);

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

    if (isFullImageCrop() && !cropSourceFile) {
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

    const sourceFile = cropSourceFile || originalFile || item.file;
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
    setSelectedFilter('none');

    // The crop source already contains the visible text and annotations.
    setTextLayers([]);
    setAnnotationStrokes([]);
    setCurrentStroke(null);

    setCropSourceFile(null);
    setCropSourcePreviewUrl(null);

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

  const loadImageFromUrl = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not load image for editing.'));
      image.src = url;
    });

  const canvasToFile = (canvas, outputType, fileName) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not create the edited image.'));
            return;
          }

          resolve(
            new File([blob], fileName, {
              type: outputType,
              lastModified: Date.now(),
            })
          );
        },
        outputType,
        0.95
      );
    });

  const prepareLatestImageForCrop = async () => {
    const sourceUrl = normalImageUrl;

    if (!sourceUrl) {
      throw new Error('Image preview unavailable.');
    }

    const image = await loadImageFromUrl(sourceUrl);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not create the crop preview.');
    }

    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;

    context.filter = getFilterCss(selectedFilter);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.filter = 'none';

    annotationStrokes.forEach((stroke) => {
      if (!stroke.points?.length) return;

      context.beginPath();
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.size;
      context.lineCap = 'round';
      context.lineJoin = 'round';

      stroke.points.forEach((point, index) => {
        if (index === 0) {
          context.moveTo(point.x, point.y);
        } else {
          context.lineTo(point.x, point.y);
        }
      });

      context.stroke();
    });

    textLayers.forEach((layer) => {
      context.save();
      context.fillStyle = layer.color;
      context.font = `700 ${layer.fontSize}px ${
        layer.fontFamily || 'Arial, sans-serif'
      }`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.shadowColor = 'rgba(0,0,0,0.65)';
      context.shadowBlur = 6;
      context.shadowOffsetY = 2;
      context.fillText(layer.text, layer.x, layer.y);
      context.restore();
    });

    const outputType = item.file.type || 'image/png';
    const sourceName = item.file.name || 'edited-image.png';
    const extension = outputType.split('/')[1] || 'png';
    const baseName = sourceName.replace(/\.[^/.]+$/, '') || 'edited-image';

    const file = await canvasToFile(
      canvas,
      outputType,
      `${baseName}-crop-source.${extension}`
    );
    const previewUrl = URL.createObjectURL(file);

    if (
      cropSourcePreviewUrl &&
      cropSourcePreviewUrl !== handedOffPreviewUrlRef.current
    ) {
      URL.revokeObjectURL(cropSourcePreviewUrl);
    }

    setCropSourceFile(file);
    setCropSourcePreviewUrl(previewUrl);

    return {
      file,
      previewUrl,
    };
  };

  const openCropTool = async () => {
    try {
      setIsEditing(true);

      await prepareLatestImageForCrop();

      const nextCrop =
        appliedCropPercent ||
        initialCrop ||
        getFullCrop();

      setCrop(nextCrop);
      setCompletedCrop(null);
      setCompletedPercentCrop(null);
      setActiveTool('crop');
    } catch (error) {
      console.error('Failed to prepare image for crop:', error);
    } finally {
      setIsEditing(false);
    }
  };

  useEffect(() => {
    if (!isOpen || activeTool === 'crop') return;

    const frameId = requestAnimationFrame(updateOverlayBounds);
    const observer = new ResizeObserver(updateOverlayBounds);

    if (imageStageRef.current) {
      observer.observe(imageStageRef.current);
    }

    if (displayImageRef.current) {
      observer.observe(displayImageRef.current);
    }

    window.addEventListener('resize', updateOverlayBounds);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener('resize', updateOverlayBounds);
    };
  }, [
    isOpen,
    activeTool,
    selectedFilter,
    editedPreviewUrl,
    basePreviewUrl,
    previewUrl,
  ]);

  const getImagePointFromEvent = (event) => {
    const overlay = overlayRef.current;

    if (!overlay || !naturalImageSize.width || !naturalImageSize.height) {
      return null;
    }

    const rect = overlay.getBoundingClientRect();

    const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height));

    return {
      x: (x / rect.width) * naturalImageSize.width,
      y: (y / rect.height) * naturalImageSize.height,
    };
  };

  const addTextLayer = () => {
    const width =
      naturalImageSize.width ||
      displayImageRef.current?.naturalWidth ||
      1000;
    const height =
      naturalImageSize.height ||
      displayImageRef.current?.naturalHeight ||
      1000;

    const newLayer = {
      id: createLayerId(),
      text: textDraft || 'Text',
      x: width / 2,
      y: height / 2,
      fontSize: textSize,
      color: textColor,
      fontFamily: 'Arial, sans-serif',
    };

    setTextLayers((prev) => [...prev, newLayer]);
    setSelectedTextId(newLayer.id);
  };

  const updateSelectedTextLayer = (patch) => {
    if (!selectedTextId) return;

    setTextLayers((prev) =>
      prev.map((layer) =>
        layer.id === selectedTextId ? { ...layer, ...patch } : layer
      )
    );
  };

  const removeSelectedTextLayer = () => {
    if (!selectedTextId) return;

    setTextLayers((prev) =>
      prev.filter((layer) => layer.id !== selectedTextId)
    );
    setSelectedTextId(null);
  };

  const handleCanvasPointerDown = (event) => {
    if (activeTool !== 'draw') return;

    const point = getImagePointFromEvent(event);
    if (!point) return;

    event.currentTarget.setPointerCapture(event.pointerId);

    setCurrentStroke({
      id: createLayerId(),
      color: brushColor,
      size: brushSize,
      points: [point],
    });
    setIsDrawing(true);
  };

  const handleCanvasPointerMove = (event) => {
    if (draggingTextId) {
      const point = getImagePointFromEvent(event);
      if (!point) return;

      setTextLayers((prev) =>
        prev.map((layer) =>
          layer.id === draggingTextId
            ? { ...layer, x: point.x, y: point.y }
            : layer
        )
      );
      return;
    }

    if (!isDrawing || activeTool !== 'draw') return;

    const point = getImagePointFromEvent(event);
    if (!point) return;

    setCurrentStroke((prev) =>
      prev
        ? {
            ...prev,
            points: [...prev.points, point],
          }
        : prev
    );
  };

  const handleCanvasPointerUp = (event) => {
    if (draggingTextId) {
      setDraggingTextId(null);
      return;
    }

    if (currentStroke && currentStroke.points.length > 1) {
      setAnnotationStrokes((prev) => [...prev, currentStroke]);
    }

    if (
      event.currentTarget.hasPointerCapture &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setCurrentStroke(null);
    setIsDrawing(false);
  };

  const clearAnnotationStrokes = () => {
    setAnnotationStrokes([]);
    setCurrentStroke(null);
  };

  const handleQuickAction = async (action) => {
    try {
      setIsEditing(true);

      if (activeTool === 'filter' && selectedFilter !== 'none') {
        await commitFilter();
      }

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

  const cropImageUrl =
    cropSourcePreviewUrl ||
    editedPreviewUrl ||
    basePreviewUrl ||
    originalPreviewUrl ||
    item.previewUrl ||
    previewUrl;

  const imageUrl = activeTool === 'crop'
    ? cropImageUrl
    : normalImageUrl;

  const changeTool = async (nextTool) => {
    try {
      setIsEditing(true);

      if ( // ned to specifically save filter cos clicking on filters is just showing it thru CSS and not yet actually commited 
        activeTool === 'filter' &&
        selectedFilter !== 'none' &&
        nextTool !== 'filter'
      ) {
        await commitFilter();
      }

      setActiveTool(nextTool);
    } catch (error) {
      console.error('Failed to change editing tool:', error);
    } finally {
      setIsEditing(false);
    }
  };

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
                  if (activeTool === 'crop') {
                    setActiveTool(null);
                    setCrop(null);
                    setCompletedCrop(null);
                    setCompletedPercentCrop(null);
                    return;
                  }

                  openCropTool();
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
                  changeTool(activeTool === 'filter' ? null : 'filter');
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
                onClick={() => {
                  changeTool(activeTool === 'draw' ? null : 'draw');
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                  activeTool === 'draw'
                    ? 'bg-stone-100 text-stone-950'
                    : 'text-stone-600 hover:bg-stone-200 hover:text-stone-950'
                }`}
                aria-label="Draw"
              >
                <Pencil className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  changeTool(activeTool === 'text' ? null : 'text');
                }}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                  activeTool === 'text'
                    ? 'bg-stone-100 text-stone-950'
                    : 'text-stone-600 hover:bg-stone-200 hover:text-stone-950'
                }`}
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
                <div ref={imageStageRef} className="relative flex min-h-0 max-h-full w-full max-w-full flex-1 items-center justify-center rounded-2xl bg-white p-4 shadow-xl">
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
                      <>
                        <img
                          ref={displayImageRef}
                          src={imageUrl}
                          alt={item?.file?.name || 'Image being edited'}
                          onLoad={(event) => {
                            setNaturalImageSize({
                              width: event.currentTarget.naturalWidth,
                              height: event.currentTarget.naturalHeight,
                            });
                            requestAnimationFrame(updateOverlayBounds);
                          }}
                          draggable={false}
                          className="block max-h-full max-w-full rounded-xl object-contain"
                          style={{
                            filter: activeTool === 'filter' ? getFilterCss(selectedFilter) : 'none',
                          }}
                        />

                        {naturalImageSize.width > 0 &&
                          naturalImageSize.height > 0 &&
                          overlayBounds.width > 0 &&
                          overlayBounds.height > 0 && (
                            <div
                              ref={overlayRef}
                              className={`absolute z-10 touch-none ${
                                activeTool === 'draw' ? 'cursor-crosshair' : ''
                              }`}
                              style={{
                                left: overlayBounds.left,
                                top: overlayBounds.top,
                                width: overlayBounds.width,
                                height: overlayBounds.height,
                                pointerEvents:
                                  activeTool === 'draw' || activeTool === 'text'
                                    ? 'auto'
                                    : 'none',
                              }}
                              onPointerDown={handleCanvasPointerDown}
                              onPointerMove={handleCanvasPointerMove}
                              onPointerUp={handleCanvasPointerUp}
                              onPointerCancel={handleCanvasPointerUp}
                            >
                              <svg
                                className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
                                viewBox={`0 0 ${naturalImageSize.width} ${naturalImageSize.height}`}
                                preserveAspectRatio="none"
                              >
                                {[...annotationStrokes, currentStroke]
                                  .filter(Boolean)
                                  .map((stroke) => (
                                    <polyline
                                      key={stroke.id}
                                      points={stroke.points
                                        .map((point) => `${point.x},${point.y}`)
                                        .join(' ')}
                                      fill="none"
                                      stroke={stroke.color}
                                      strokeWidth={stroke.size}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  ))}
                              </svg>

                              {textLayers.map((layer) => {
                                const isSelected = selectedTextId === layer.id;

                                return (
                                  <button
                                    key={layer.id}
                                    type="button"
                                    onPointerDown={(event) => {
                                      if (activeTool !== 'text') return;

                                      event.stopPropagation();
                                      event.currentTarget.setPointerCapture(
                                        event.pointerId
                                      );
                                      setSelectedTextId(layer.id);
                                      setDraggingTextId(layer.id);
                                    }}
                                    onPointerUp={(event) => {
                                      event.stopPropagation();
                                      setDraggingTextId(null);
                                    }}
                                    className={`absolute -translate-x-1/2 -translate-y-1/2 select-none rounded-md px-1 font-bold ${
                                      isSelected
                                        ? 'ring-2 ring-orange-500'
                                        : ''
                                    }`}
                                    style={{
                                      left: `${
                                        (layer.x / naturalImageSize.width) * 100
                                      }%`,
                                      top: `${
                                        (layer.y / naturalImageSize.height) * 100
                                      }%`,
                                      color: layer.color,
                                      fontFamily:
                                        layer.fontFamily || 'Arial, sans-serif',
                                      fontSize: `${Math.max(
                                        12,
                                        (layer.fontSize /
                                          naturalImageSize.width) *
                                          overlayBounds.width
                                      )}px`,
                                      textShadow:
                                        '0 2px 6px rgba(0,0,0,0.65)',
                                      pointerEvents:
                                        activeTool === 'text'
                                          ? 'auto'
                                          : 'none',
                                    }}
                                  >
                                    {layer.text}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                      </>
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

                        if (
                          cropSourcePreviewUrl &&
                          cropSourcePreviewUrl !== handedOffPreviewUrlRef.current
                        ) {
                          URL.revokeObjectURL(cropSourcePreviewUrl);
                        }

                        setCropSourceFile(null);
                        setCropSourcePreviewUrl(null);
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

                {activeTool === 'draw' && (
                  <div className="mt-4 flex w-full max-w-2xl items-center justify-center gap-4 rounded-full bg-stone-950 px-5 py-3 shadow-lg">
                    <input
                      type="color"
                      value={brushColor}
                      onChange={(event) => setBrushColor(event.target.value)}
                      className="h-10 w-10 cursor-pointer rounded-full border-0 bg-transparent"
                      aria-label="Brush colour"
                    />

                    <input
                      type="range"
                      min="2"
                      max="60"
                      value={brushSize}
                      onChange={(event) =>
                        setBrushSize(Number(event.target.value))
                      }
                      className="w-full accent-orange-500"
                      aria-label="Brush size"
                    />

                    <button
                      type="button"
                      onClick={clearAnnotationStrokes}
                      className="shrink-0 rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/20"
                    >
                      Clear
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
                    ) : activeTool === 'draw' ? (
                      <p className="text-xs leading-relaxed text-stone-500">
                        Draw directly on the image.
                      </p>
                    ) : activeTool === 'text' ? (
                      <p className="text-xs leading-relaxed text-stone-500">
                        Add text, select it, then drag it around the image.
                      </p>
                    ) : (
                      <p className="text-xs leading-relaxed text-stone-500">
                        Choose crop, filter, draw, or text from the toolbar.
                      </p>
                    )}
                  </div>

                  {activeTool === 'text' && (
                    <div className="rounded-2xl border border-stone-200 p-4">
                      <p className="mb-2 text-sm font-bold text-stone-800">
                        Text
                      </p>

                      <input
                        type="text"
                        value={
                          selectedTextId
                            ? textLayers.find(
                                (layer) => layer.id === selectedTextId
                              )?.text || ''
                            : textDraft
                        }
                        onChange={(event) => {
                          const value = event.target.value;

                          if (selectedTextId) {
                            updateSelectedTextLayer({ text: value });
                          } else {
                            setTextDraft(value);
                          }
                        }}
                        className="mb-3 w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
                        placeholder="Enter text"
                      />

                      <div className="mb-3 grid grid-cols-2 gap-2">
                        <input
                          type="color"
                          value={
                            selectedTextId
                              ? textLayers.find(
                                  (layer) => layer.id === selectedTextId
                                )?.color || textColor
                              : textColor
                          }
                          onChange={(event) => {
                            setTextColor(event.target.value);
                            updateSelectedTextLayer({
                              color: event.target.value,
                            });
                          }}
                          className="h-10 w-full rounded-lg"
                        />

                        <input
                          type="number"
                          min="12"
                          max="160"
                          value={
                            selectedTextId
                              ? textLayers.find(
                                  (layer) => layer.id === selectedTextId
                                )?.fontSize || textSize
                              : textSize
                          }
                          onChange={(event) => {
                            const size = Number(event.target.value);

                            setTextSize(size);
                            updateSelectedTextLayer({ fontSize: size });
                          }}
                          className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-orange-500"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={addTextLayer}
                          className="flex-1 rounded-xl bg-orange-600 px-3 py-2 text-xs font-bold text-white hover:bg-orange-700"
                        >
                          Add text
                        </button>

                        <button
                          type="button"
                          onClick={removeSelectedTextLayer}
                          className="rounded-xl bg-stone-100 px-3 py-2 text-xs font-bold text-stone-600 hover:bg-stone-200"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
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
                          textLayers,
                          annotationStrokes,
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
                          textLayers,
                          annotationStrokes,
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
                        textLayers,
                        annotationStrokes,
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
                        textLayers,
                        annotationStrokes,
                      });
                      return;
                    }

                    if (
                      textLayers.length > 0 ||
                      annotationStrokes.length > 0 ||
                      initialTextLayers.length > 0 ||
                      initialAnnotationStrokes.length > 0
                    ) {
                      onApply({
                        cropPercent: appliedCropPercent || initialCrop,
                        resetToOriginal: false,
                        textLayers,
                        annotationStrokes,
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
