import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { applyImageQuickAction, applyImageFilter } from '../../services/imageEditingServices/imageEditService';
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

  // Temporary preview URLs only. These never replace the full image file.
  const [cropPreviewUrl, setCropPreviewUrl] = useState(null);
  const [croppedDisplayPreviewUrl, setCroppedDisplayPreviewUrl] = useState(null);

  const imageStageRef = useRef(null);
  const displayImageRef = useRef(null);
  const overlayRef = useRef(null);

  const [textLayers, setTextLayers] = useState([]);
  const [annotationStrokes, setAnnotationStrokes] = useState([]);
  const [selectedTextId, setSelectedTextId] = useState(null);
  const [editingTextId, setEditingTextId] = useState(null);
  const [draggingTextId, setDraggingTextId] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState(null);
  const [brushHue, setBrushHue] = useState(25);
  const [brushSliderValue, setBrushSliderValue] = useState(44);
  const [brushSize, setBrushSize] = useState(10);

  const DEFAULT_TEXT_COLOR = '#ffffff';
  const DEFAULT_TEXT_SIZE = 48;
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

  // Annotation and text share one undo/redo history.
  // Crop, filter, rotation, and flip actions are intentionally excluded.
  const overlayUndoStackRef = useRef([]);
  const overlayRedoStackRef = useRef([]);
  const textDragSnapshotRef = useRef(null);
  const textEditSnapshotRef = useRef(null);
  const textTransformSnapshotRef = useRef(null);
  const textTransformCleanupRef = useRef(null);
  const textLayersRef = useRef([]);
  const annotationStrokesRef = useRef([]);
  const [, setOverlayHistoryVersion] = useState(0);
  const OVERLAY_HISTORY_LIMIT = 50;

  useEffect(() => {
    textLayersRef.current = textLayers;
  }, [textLayers]);

  useEffect(() => {
    annotationStrokesRef.current = annotationStrokes;
  }, [annotationStrokes]);

  useEffect(() => {
    return () => {
      if (textTransformCleanupRef.current) {
        textTransformCleanupRef.current();
      }
    };
  }, []);

  const createLayerId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random()}`;
  };

  const cloneTextLayers = (layers) => {
    return layers.map((layer) => ({ ...layer }));
  };

  const cloneAnnotationStrokes = (strokes) => {
    return strokes.map((stroke) => ({
      ...stroke,
      points: (stroke.points || []).map((point) => ({ ...point })),
    }));
  };

  const createOverlaySnapshot = () => ({
    textLayers: cloneTextLayers(textLayersRef.current),
    annotationStrokes: cloneAnnotationStrokes(annotationStrokesRef.current),
  });

  const overlaySnapshotsAreEqual = (first, second) => {
    return JSON.stringify(first) === JSON.stringify(second);
  };

  const refreshOverlayHistoryButtons = () => {
    setOverlayHistoryVersion((version) => version + 1);
  };

  const clearOverlayHistory = () => {
    overlayUndoStackRef.current = [];
    overlayRedoStackRef.current = [];
    textDragSnapshotRef.current = null;
    textEditSnapshotRef.current = null;
    textTransformSnapshotRef.current = null;

    if (textTransformCleanupRef.current) {
      textTransformCleanupRef.current();
    }

    refreshOverlayHistoryButtons();
  };

  const pushOverlayUndoSnapshot = (snapshot) => {
    if (!snapshot) return;

    overlayUndoStackRef.current.push(snapshot);

    if (overlayUndoStackRef.current.length > OVERLAY_HISTORY_LIMIT) {
      overlayUndoStackRef.current.shift();
    }

    // Any new text or annotation edit starts a new history branch.
    overlayRedoStackRef.current = [];
    refreshOverlayHistoryButtons();
  };

  const restoreOverlaySnapshot = (snapshot) => {
    if (!snapshot) return;

    const restoredTextLayers = cloneTextLayers(snapshot.textLayers);
    const restoredAnnotationStrokes = cloneAnnotationStrokes(
      snapshot.annotationStrokes
    );

    textLayersRef.current = restoredTextLayers;
    annotationStrokesRef.current = restoredAnnotationStrokes;

    setTextLayers(restoredTextLayers);
    setAnnotationStrokes(restoredAnnotationStrokes);

    // Undo/redo restores content, not temporary interaction state.
    setSelectedTextId(null);
    setEditingTextId(null);
    setDraggingTextId(null);
    setIsDrawing(false);
    setCurrentStroke(null);
  };

  const handleUndoOverlay = () => {
    if (isEditing || overlayUndoStackRef.current.length === 0) {
      return;
    }

    overlayRedoStackRef.current.push(createOverlaySnapshot());

    if (overlayRedoStackRef.current.length > OVERLAY_HISTORY_LIMIT) {
      overlayRedoStackRef.current.shift();
    }

    const previousSnapshot = overlayUndoStackRef.current.pop();
    restoreOverlaySnapshot(previousSnapshot);
    refreshOverlayHistoryButtons();
  };

  const handleRedoOverlay = () => {
    if (isEditing || overlayRedoStackRef.current.length === 0) {
      return;
    }

    overlayUndoStackRef.current.push(createOverlaySnapshot());

    if (overlayUndoStackRef.current.length > OVERLAY_HISTORY_LIMIT) {
      overlayUndoStackRef.current.shift();
    }

    const nextSnapshot = overlayRedoStackRef.current.pop();
    restoreOverlaySnapshot(nextSnapshot);
    refreshOverlayHistoryButtons();
  };

  const beginTextEditHistory = (textId = selectedTextId) => {
    if (!textId || textEditSnapshotRef.current) return;

    textEditSnapshotRef.current = createOverlaySnapshot();
  };

  const commitTextEditHistory = (
    nextTextLayers = textLayersRef.current
  ) => {
    const beforeChange = textEditSnapshotRef.current;
    textEditSnapshotRef.current = null;

    const afterChange = {
      textLayers: cloneTextLayers(nextTextLayers),
      annotationStrokes: cloneAnnotationStrokes(
        annotationStrokesRef.current
      ),
    };

    if (
      beforeChange &&
      !overlaySnapshotsAreEqual(beforeChange, afterChange)
    ) {
      pushOverlayUndoSnapshot(beforeChange);
    }
  };

  const finishTextDrag = () => {
    const beforeChange = textDragSnapshotRef.current;
    textDragSnapshotRef.current = null;

    if (
      beforeChange &&
      !overlaySnapshotsAreEqual(beforeChange, createOverlaySnapshot())
    ) {
      pushOverlayUndoSnapshot(beforeChange);
    }

    setDraggingTextId(null);
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
    setCropPreviewUrl(null);
    setCroppedDisplayPreviewUrl(null);

    const startingTextLayers = (initialTextLayers || []).map(
      (layer) => ({
        ...layer,
        rotation: layer.rotation || 0,
      })
    );
    const startingAnnotationStrokes = initialAnnotationStrokes || [];

    textLayersRef.current = startingTextLayers;
    annotationStrokesRef.current = startingAnnotationStrokes;

    setTextLayers(startingTextLayers);
    setAnnotationStrokes(startingAnnotationStrokes);
    setSelectedTextId(null);
    setEditingTextId(null);
    setDraggingTextId(null);
    setIsDrawing(false);
    setCurrentStroke(null);

    handedOffPreviewUrlRef.current = null;

    overlayUndoStackRef.current = [];
    overlayRedoStackRef.current = [];
    textDragSnapshotRef.current = null;
    textEditSnapshotRef.current = null;
    textTransformSnapshotRef.current = null;

    if (textTransformCleanupRef.current) {
      textTransformCleanupRef.current();
    }

    refreshOverlayHistoryButtons();
  }, [
    isOpen,
    item.file,
    item.editedFile,
    previewUrl,
    initialCrop,
    initialTextLayers,
    initialAnnotationStrokes,
  ]);

  const isFullCropPercent = (percentCrop) => {
    if (!percentCrop) return true;

    return (
      Math.round(percentCrop.x) === 0 &&
      Math.round(percentCrop.y) === 0 &&
      Math.round(percentCrop.width) === 100 &&
      Math.round(percentCrop.height) === 100
    );
  };

  const isFullImageCrop = () => {
    return isFullCropPercent(completedPercentCrop || crop);
  };

  const clearCropPreview = () => {
    if (
      cropPreviewUrl &&
      cropPreviewUrl !== handedOffPreviewUrlRef.current
    ) {
      URL.revokeObjectURL(cropPreviewUrl);
    }

    setCropPreviewUrl(null);
  };

  const commitCrop = async () => {
    const cropPercentToSave =
      completedPercentCrop ||
      crop ||
      appliedCropPercent ||
      initialCrop ||
      getFullCrop();

    // Crop is metadata only inside the editor. The full image file is kept.
    setAppliedCropPercent(cropPercentToSave);

    if (!isFullCropPercent(cropPercentToSave)) {
      setResetToOriginalPending(false);
    }

    clearCropPreview();

    setActiveTool(null);
    setCrop(null);
    setCompletedCrop(null);
    setCompletedPercentCrop(null);

    return {
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

  const canvasToPreviewUrl = (canvas, outputType) =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Could not create the edited image preview.'));
            return;
          }

          resolve(URL.createObjectURL(blob));
        },
        outputType,
        0.95
      );
    });

  const prepareLatestImageForCrop = async (
    sourceUrlOverride = null,
    filterIdOverride = selectedFilter
  ) => {
    const sourceUrl =
      sourceUrlOverride ||
      (resetToOriginalPending
        ? originalPreviewUrl || item.previewUrl || previewUrl
        : editedPreviewUrl || basePreviewUrl || previewUrl);

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

    setNaturalImageSize({
      width: image.naturalWidth,
      height: image.naturalHeight,
    });

    context.filter = getFilterCss(filterIdOverride);
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
      if (!layer.text?.trim()) return;

      context.save();
      context.translate(layer.x, layer.y);
      context.rotate(((layer.rotation || 0) * Math.PI) / 180);
      context.fillStyle = layer.color;
      context.font = `700 ${layer.fontSize}px ${
        layer.fontFamily || 'Arial, sans-serif'
      }`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.shadowColor = 'rgba(0,0,0,0.65)';
      context.shadowBlur = 6;
      context.shadowOffsetY = 2;
      context.fillText(layer.text, 0, 0);
      context.restore();
    });

    const outputType = item.file.type || 'image/png';
    const previewUrlForCrop = await canvasToPreviewUrl(canvas, outputType);

    clearCropPreview();
    setCropPreviewUrl(previewUrlForCrop);

    return previewUrlForCrop;
  };

  const openCropTool = async () => {
    try {
      setIsEditing(true);

      let sourceUrlOverride = null;

      // A selected filter is only a CSS preview until it is committed.
      if (activeTool === 'filter' && selectedFilter !== 'none') {
        const filterResult = await commitFilter();
        sourceUrlOverride = filterResult?.previewUrl || null;
      }

      await prepareLatestImageForCrop(sourceUrlOverride, 'none');

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
    if (!isOpen) return;

    const sourceUrl = resetToOriginalPending
      ? originalPreviewUrl || item.previewUrl || previewUrl
      : editedPreviewUrl || basePreviewUrl || previewUrl;

    const cropPercent =
      appliedCropPercent ||
      initialCrop ||
      getFullCrop();

    let generatedUrl = null;
    let cancelled = false;

    const createDisplayPreview = async () => {
      if (!sourceUrl || isFullCropPercent(cropPercent)) {
        setCroppedDisplayPreviewUrl((previousUrl) => {
          if (
            previousUrl &&
            previousUrl !== handedOffPreviewUrlRef.current
          ) {
            URL.revokeObjectURL(previousUrl);
          }

          return null;
        });
        return;
      }

      try {
        const image = await loadImageFromUrl(sourceUrl);

        if (cancelled) return;

        setNaturalImageSize({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });

        const sourceX = (image.naturalWidth * cropPercent.x) / 100;
        const sourceY = (image.naturalHeight * cropPercent.y) / 100;
        const sourceWidth = (image.naturalWidth * cropPercent.width) / 100;
        const sourceHeight = (image.naturalHeight * cropPercent.height) / 100;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Could not create the cropped display preview.');
        }

        canvas.width = Math.max(1, Math.round(sourceWidth));
        canvas.height = Math.max(1, Math.round(sourceHeight));

        context.drawImage(
          image,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );

        generatedUrl = await canvasToPreviewUrl(
          canvas,
          item.file.type || 'image/png'
        );

        if (cancelled) {
          URL.revokeObjectURL(generatedUrl);
          return;
        }

        setCroppedDisplayPreviewUrl((previousUrl) => {
          if (
            previousUrl &&
            previousUrl !== handedOffPreviewUrlRef.current
          ) {
            URL.revokeObjectURL(previousUrl);
          }

          return generatedUrl;
        });
      } catch (error) {
        console.error('Failed to create cropped display preview:', error);
      }
    };

    createDisplayPreview();

    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    resetToOriginalPending,
    editedPreviewUrl,
    basePreviewUrl,
    previewUrl,
    originalPreviewUrl,
    item.previewUrl,
    item.file.type,
    appliedCropPercent,
    initialCrop,
  ]);

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
    croppedDisplayPreviewUrl,
    appliedCropPercent,
    initialCrop,
  ]);

  const getImagePointFromEvent = (event) => {
    const overlay = overlayRef.current;

    if (!overlay || !naturalImageSize.width || !naturalImageSize.height) {
      return null;
    }

    const rect = overlay.getBoundingClientRect();
    const activeCropPercent =
      appliedCropPercent ||
      initialCrop ||
      getFullCrop();

    const cropX =
      (naturalImageSize.width * activeCropPercent.x) / 100;
    const cropY =
      (naturalImageSize.height * activeCropPercent.y) / 100;
    const cropWidth =
      (naturalImageSize.width * activeCropPercent.width) / 100;
    const cropHeight =
      (naturalImageSize.height * activeCropPercent.height) / 100;

    const localX = Math.max(
      0,
      Math.min(event.clientX - rect.left, rect.width)
    );
    const localY = Math.max(
      0,
      Math.min(event.clientY - rect.top, rect.height)
    );

    return {
      x: cropX + (localX / rect.width) * cropWidth,
      y: cropY + (localY / rect.height) * cropHeight,
    };
  };

  const updateTextLayer = (textId, patch) => {
    if (!textId) return;

    setResetToOriginalPending(false);

    setTextLayers((prev) => {
      const nextLayers = prev.map((layer) =>
        layer.id === textId ? { ...layer, ...patch } : layer
      );

      textLayersRef.current = nextLayers;
      return nextLayers;
    });
  };

  const addTextLayer = () => {
    // Do not create several empty text inputs on top of one another.
    // Clicking the text tool again while typing simply refocuses that input.
    if (editingTextId) {
      document.querySelector(
        `[data-text-input-id="${editingTextId}"]`
      )?.focus();
      return;
    }

    const beforeChange = createOverlaySnapshot();

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
      text: '',
      x: width / 2,
      y: height / 2,
      fontSize: DEFAULT_TEXT_SIZE,
      color: DEFAULT_TEXT_COLOR,
      fontFamily: 'Arial, sans-serif',
      rotation: 0,
    };

    const nextLayers = [...textLayersRef.current, newLayer];

    // Creation and typing are recorded as one undoable text action.
    textEditSnapshotRef.current = beforeChange;
    textLayersRef.current = nextLayers;

    setTextLayers(nextLayers);
    setSelectedTextId(newLayer.id);
    setEditingTextId(newLayer.id);
    setResetToOriginalPending(false);
  };

  const confirmTextLayer = (textId, textValue = null) => {
    if (!textId) return;

    const currentLayer = textLayersRef.current.find(
      (layer) => layer.id === textId
    );

    if (!currentLayer) {
      setEditingTextId(null);
      setSelectedTextId(null);
      textEditSnapshotRef.current = null;
      return;
    }

    const nextText =
      typeof textValue === 'string'
        ? textValue
        : currentLayer.text;

    const nextLayers = nextText.trim()
      ? textLayersRef.current.map((layer) =>
          layer.id === textId
            ? { ...layer, text: nextText }
            : layer
        )
      : textLayersRef.current.filter(
          (layer) => layer.id !== textId
        );

    textLayersRef.current = nextLayers;
    setTextLayers(nextLayers);
    setEditingTextId(null);

    // Confirmation deselects the layer. Clicking it again reveals the
    // rotation and resize handles, matching the WhatsApp-style workflow.
    setSelectedTextId(null);
    commitTextEditHistory(nextLayers);
  };

  const startEditingTextLayer = (textId) => {
    if (!textId) return;

    beginTextEditHistory(textId);
    setSelectedTextId(textId);
    setEditingTextId(textId);
    setDraggingTextId(null);
  };

  const removeSelectedTextLayer = () => {
    if (!selectedTextId) return;

    const beforeChange = createOverlaySnapshot();
    const nextLayers = textLayersRef.current.filter(
      (layer) => layer.id !== selectedTextId
    );

    textLayersRef.current = nextLayers;
    setTextLayers(nextLayers);
    setEditingTextId((currentId) =>
      currentId === selectedTextId ? null : currentId
    );
    setSelectedTextId(null);
    pushOverlayUndoSnapshot(beforeChange);
  };

  const finishTextTransform = () => {
    const beforeChange = textTransformSnapshotRef.current;
    textTransformSnapshotRef.current = null;

    if (
      beforeChange &&
      !overlaySnapshotsAreEqual(beforeChange, createOverlaySnapshot())
    ) {
      pushOverlayUndoSnapshot(beforeChange);
    }
  };

  const beginTextTransform = (event, layer, transformType) => {
    if (activeTool !== 'text') return;

    event.preventDefault();
    event.stopPropagation();

    const transformHandle = event.currentTarget;
    const pointerId = event.pointerId;

    if (textTransformCleanupRef.current) {
      textTransformCleanupRef.current();
    }

    const layerElement = transformHandle.closest(
      '[data-text-layer-id]'
    );

    if (!layerElement) return;

    transformHandle.setPointerCapture?.(pointerId);

    const bounds = layerElement.getBoundingClientRect();
    const centreX = bounds.left + bounds.width / 2;
    const centreY = bounds.top + bounds.height / 2;

    const startRotation = layer.rotation || 0;
    const startFontSize =
      layer.fontSize || DEFAULT_TEXT_SIZE;

    const startPointerAngle = Math.atan2(
      event.clientY - centreY,
      event.clientX - centreX
    );

    const startPointerDistance = Math.max(
      1,
      Math.hypot(
        event.clientX - centreX,
        event.clientY - centreY
      )
    );

    setSelectedTextId(layer.id);
    setEditingTextId(null);
    setDraggingTextId(null);
    setResetToOriginalPending(false);

    textTransformSnapshotRef.current =
      createOverlaySnapshot();

    let hasFinished = false;

    const handlePointerMove = (moveEvent) => {
      if (
        hasFinished ||
        moveEvent.pointerId !== pointerId
      ) {
        return;
      }

      moveEvent.preventDefault();

      if (transformType === 'resize') {
        const currentDistance = Math.max(
          1,
          Math.hypot(
            moveEvent.clientX - centreX,
            moveEvent.clientY - centreY
          )
        );

        const scale =
          currentDistance / startPointerDistance;

        const nextFontSize = Math.min(
          160,
          Math.max(12, startFontSize * scale)
        );

        updateTextLayer(layer.id, {
          fontSize: nextFontSize,
        });

        return;
      }

      const currentPointerAngle = Math.atan2(
        moveEvent.clientY - centreY,
        moveEvent.clientX - centreX
      );

      const angleDifference =
        ((currentPointerAngle - startPointerAngle) *
          180) /
        Math.PI;

      updateTextLayer(layer.id, {
        rotation: startRotation + angleDifference,
      });
    };

    const cleanup = () => {
      window.removeEventListener(
        'pointermove',
        handlePointerMove,
        true
      );

      window.removeEventListener(
        'pointerup',
        handlePointerUp,
        true
      );

      window.removeEventListener(
        'pointercancel',
        handlePointerUp,
        true
      );

      window.removeEventListener(
        'blur',
        handleWindowBlur
      );

      if (
        transformHandle.hasPointerCapture?.(pointerId)
      ) {
        transformHandle.releasePointerCapture(pointerId);
      }

      if (
        textTransformCleanupRef.current === cleanup
      ) {
        textTransformCleanupRef.current = null;
      }
    };

    const finishTransform = (finishEvent = null) => {
      if (hasFinished) return;

      if (
        finishEvent?.pointerId !== undefined &&
        finishEvent.pointerId !== pointerId
      ) {
        return;
      }

      hasFinished = true;

      cleanup();
      finishTextTransform();
    };

    const handlePointerUp = (upEvent) => {
      finishTransform(upEvent);
    };

    const handleWindowBlur = () => {
      finishTransform();
    };

    textTransformCleanupRef.current = cleanup;

    window.addEventListener(
      'pointermove',
      handlePointerMove,
      {
        capture: true,
        passive: false,
      }
    );

    window.addEventListener(
      'pointerup',
      handlePointerUp,
      true
    );

    window.addEventListener(
      'pointercancel',
      handlePointerUp,
      true
    );

    window.addEventListener(
      'blur',
      handleWindowBlur
    );
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleDeleteSelectedText = (event) => {
      const target = event.target;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (
        isTyping ||
        activeTool !== 'text' ||
        !selectedTextId ||
        (event.key !== 'Delete' && event.key !== 'Backspace')
      ) {
        return;
      }

      event.preventDefault();
      removeSelectedTextLayer();
    };

    window.addEventListener('keydown', handleDeleteSelectedText);

    return () => {
      window.removeEventListener('keydown', handleDeleteSelectedText);
    };
  }, [isOpen, activeTool, selectedTextId]);

  const handleCanvasPointerDown = (event) => {
    if (activeTool === 'text') {
      if (event.target === event.currentTarget) {
        document.activeElement?.blur();
        setSelectedTextId(null);
      }

      return;
    }

    if (activeTool !== 'draw') return;

    const point = getImagePointFromEvent(event);
    if (!point) return;

    event.currentTarget.setPointerCapture(event.pointerId);

    setResetToOriginalPending(false);

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

      setTextLayers((prev) => {
        const nextLayers = prev.map((layer) =>
          layer.id === draggingTextId
            ? { ...layer, x: point.x, y: point.y }
            : layer
        );

        textLayersRef.current = nextLayers;
        return nextLayers;
      });
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
      finishTextDrag();
      return;
    }

    if (currentStroke && currentStroke.points.length > 1) {
      const beforeChange = createOverlaySnapshot();

      setAnnotationStrokes((prev) => [...prev, currentStroke]);
      pushOverlayUndoSnapshot(beforeChange);
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
    if (annotationStrokes.length === 0) return;

    const beforeChange = createOverlaySnapshot();

    setAnnotationStrokes([]);
    setCurrentStroke(null);
    pushOverlayUndoSnapshot(beforeChange);
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

  const handleResetCropOnly = () => {
    const fullCrop = getFullCrop();

    // Only reset the crop selection. Keep filters, text, annotations,
    // rotations, flips, and every other edit unchanged.
    setCrop(fullCrop);
    setCompletedPercentCrop(fullCrop);

    if (imageRef.current) {
      setCompletedCrop(percentCropToPixelCrop(fullCrop, imageRef.current));
    } else {
      setCompletedCrop(null);
    }
  };

  const handleResetImageToOriginal = () => {
    if (
      editedPreviewUrl &&
      editedPreviewUrl !== handedOffPreviewUrlRef.current
    ) {
      URL.revokeObjectURL(editedPreviewUrl);
    }

    clearCropPreview();

    if (
      croppedDisplayPreviewUrl &&
      croppedDisplayPreviewUrl !== handedOffPreviewUrlRef.current
    ) {
      URL.revokeObjectURL(croppedDisplayPreviewUrl);
    }

    const fullCrop = getFullCrop();
    const originalUrl =
      originalPreviewUrl ||
      item.previewUrl ||
      previewUrl;

    setBaseFile(originalFile || item.file);
    setBasePreviewUrl(originalUrl);

    setEditedFile(null);
    setEditedPreviewUrl(null);
    setCroppedDisplayPreviewUrl(null);

    setAppliedCropPercent(fullCrop);
    setResetToOriginalPending(true);
    setSelectedFilter('none');

    textLayersRef.current = [];
    annotationStrokesRef.current = [];

    setTextLayers([]);
    setAnnotationStrokes([]);
    setSelectedTextId(null);
    setEditingTextId(null);
    setDraggingTextId(null);
    setIsDrawing(false);
    setCurrentStroke(null);
    clearOverlayHistory();

    setActiveTool(null);
    setCrop(null);
    setCompletedCrop(null);
    setCompletedPercentCrop(null);
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
    handleResetImageToOriginal();
  };

  if (typeof document === 'undefined') return null;

  const normalImageUrl = resetToOriginalPending
    ? originalPreviewUrl || item.previewUrl || previewUrl
    : editedPreviewUrl || basePreviewUrl || previewUrl;

  const activeCropPercent =
    appliedCropPercent ||
    initialCrop ||
    getFullCrop();

  const displayImageUrl =
    !isFullCropPercent(activeCropPercent) && croppedDisplayPreviewUrl
      ? croppedDisplayPreviewUrl
      : normalImageUrl;

  const imageUrl = activeTool === 'crop'
    ? cropPreviewUrl || normalImageUrl
    : displayImageUrl;

  const cropViewBox = {
    x: (naturalImageSize.width * activeCropPercent.x) / 100,
    y: (naturalImageSize.height * activeCropPercent.y) / 100,
    width:
      (naturalImageSize.width * activeCropPercent.width) / 100,
    height:
      (naturalImageSize.height * activeCropPercent.height) / 100,
  };

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

  const brushColourStops = [
    { position: 0, colour: '#f43f5e' },
    { position: 11, colour: '#d946ef' },
    { position: 22, colour: '#6366f1' },
    { position: 33, colour: '#3b82f6' },
    { position: 44, colour: '#22d3ee' },
    { position: 54, colour: '#84cc16' },
    { position: 64, colour: '#fde047' },
    { position: 74, colour: '#fb923c' },
    { position: 84, colour: '#000000' },
    { position: 92, colour: '#737373' },
    { position: 100, colour: '#ffffff' },
  ];

  const BRUSH_SIZES = [
    { value: 3, iconSize: 5 },
    { value: 10, iconSize: 8 },
    { value: 16, iconSize: 11 },
    { value: 30, iconSize: 15 },
    { value: 50, iconSize: 19 },
  ];

  const getBrushColorFromSlider = (value) => {
    const safeValue = Math.min(Math.max(Number(value), 0), 100);

    // Find the two colour stops surrounding the slider position.
    const rightStop =
      brushColourStops.find(
        (stop) => stop.position >= safeValue
      ) || brushColourStops[brushColourStops.length - 1];

    const rightIndex = brushColourStops.indexOf(rightStop);
    const leftStop =
      brushColourStops[Math.max(0, rightIndex - 1)];

    if (leftStop.position === rightStop.position) {
      return leftStop.colour;
    }

    // Position between the left and right stops, from 0 to 1.
    const progress =
      (safeValue - leftStop.position) /
      (rightStop.position - leftStop.position);

    const leftRgb = hexToRgb(leftStop.colour);
    const rightRgb = hexToRgb(rightStop.colour);

    const red = Math.round(
      leftRgb.red +
        (rightRgb.red - leftRgb.red) * progress
    );

    const green = Math.round(
      leftRgb.green +
        (rightRgb.green - leftRgb.green) * progress
    );

    const blue = Math.round(
      leftRgb.blue +
        (rightRgb.blue - leftRgb.blue) * progress
    );

    return `rgb(${red}, ${green}, ${blue})`;
  };

  const hexToRgb = (hex) => {
    const value = hex.replace('#', '');

    return {
      red: parseInt(value.slice(0, 2), 16),
      green: parseInt(value.slice(2, 4), 16),
      blue: parseInt(value.slice(4, 6), 16),
    };
  };

  const brushColor =
    getBrushColorFromSlider(brushSliderValue);

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
              {(activeTool === 'draw' || activeTool === 'text') && (
                <>
                  <button
                    type="button"
                    onClick={handleUndoOverlay}
                    disabled={
                      isEditing || overlayUndoStackRef.current.length === 0
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-200 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Undo text or annotation"
                  >
                    <Undo2 className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleRedoOverlay}
                    disabled={
                      isEditing || overlayRedoStackRef.current.length === 0
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-200 hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Redo text or annotation"
                  >
                    <Redo2 className="h-5 w-5" />
                  </button>

                  <div className="mx-2 h-8 w-px bg-stone-200" />
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  if (activeTool === 'crop') {
                    clearCropPreview();
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
                onClick={async () => {
                  if (activeTool !== 'text') {
                    await changeTool('text');
                  }

                  addTextLayer();
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
                {/* Top bar when filter is active */}
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

                {/* Image display */}
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
                            if (isFullCropPercent(activeCropPercent)) {
                              setNaturalImageSize({
                                width: event.currentTarget.naturalWidth,
                                height: event.currentTarget.naturalHeight,
                              });
                            }

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
                              className={`absolute z-10 overflow-hidden touch-none ${
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
                                viewBox={`${cropViewBox.x} ${cropViewBox.y} ${cropViewBox.width} ${cropViewBox.height}`}
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
                                const isEditingText = editingTextId === layer.id;
                                const displayFontSize = Math.max(
                                  12,
                                  (layer.fontSize / cropViewBox.width) *
                                    overlayBounds.width
                                );

                                return (
                                  <div
                                    key={layer.id}
                                    data-text-layer-id={layer.id}
                                    onPointerDown={(event) => {
                                      if (
                                        activeTool !== 'text' ||
                                        isEditingText
                                      ) {
                                        return;
                                      }

                                      event.stopPropagation();
                                      event.currentTarget.setPointerCapture(
                                        event.pointerId
                                      );
                                      textDragSnapshotRef.current =
                                        createOverlaySnapshot();
                                      setSelectedTextId(layer.id);
                                      setDraggingTextId(layer.id);
                                    }}
                                    onPointerUp={(event) => {
                                      if (isEditingText) return;

                                      event.stopPropagation();
                                      finishTextDrag();
                                    }}
                                    onPointerCancel={(event) => {
                                      if (isEditingText) return;

                                      event.stopPropagation();
                                      finishTextDrag();
                                    }}
                                    onDoubleClick={(event) => {
                                      if (activeTool !== 'text') return;

                                      event.stopPropagation();
                                      startEditingTextLayer(layer.id);
                                    }}
                                    className={`absolute select-none rounded-xl px-2 py-1 font-bold ${
                                      isSelected && activeTool === 'text'
                                        ? 'ring-2 ring-lime-400'
                                        : ''
                                    }`}
                                    style={{
                                      left: `${
                                        ((layer.x - cropViewBox.x) /
                                          cropViewBox.width) *
                                        100
                                      }%`,
                                      top: `${
                                        ((layer.y - cropViewBox.y) /
                                          cropViewBox.height) *
                                        100
                                      }%`,
                                      color: layer.color,
                                      fontFamily:
                                        layer.fontFamily || 'Arial, sans-serif',
                                      fontSize: `${displayFontSize}px`,
                                      textShadow:
                                        '0 2px 6px rgba(0,0,0,0.65)',
                                      transform: `translate(-50%, -50%) rotate(${
                                        layer.rotation || 0
                                      }deg)`,
                                      transformOrigin: 'center',
                                      pointerEvents:
                                        activeTool === 'text'
                                          ? 'auto'
                                          : 'none',
                                    }}
                                  >
                                    {isEditingText ? (
                                      <>
                                        <textarea
                                          autoFocus
                                          data-text-input-id={layer.id}
                                          value={layer.text}
                                          rows={1}
                                          onPointerDown={(event) => {
                                            event.stopPropagation();
                                          }}
                                          onChange={(event) => {
                                            updateTextLayer(layer.id, {
                                              text: event.target.value,
                                            });

                                            // Automatically expand vertically as more lines are added.
                                            event.currentTarget.style.height = 'auto';
                                            event.currentTarget.style.height =
                                              `${event.currentTarget.scrollHeight}px`;
                                          }}
                                          onKeyDown={(event) => {
                                            if (event.key === 'Escape') {
                                              event.preventDefault();
                                              event.stopPropagation();
                                              event.currentTarget.blur();
                                              return;
                                            }

                                            if (event.key === 'Enter') {
                                              const wantsNewLine =
                                                event.shiftKey ||
                                                event.altKey ||
                                                event.ctrlKey ||
                                                event.metaKey;

                                              if (wantsNewLine) {
                                                // Do nothing: textarea inserts a newline naturally.
                                                return;
                                              }

                                              // Plain Enter confirms the text.
                                              event.preventDefault();
                                              event.stopPropagation();
                                              event.currentTarget.blur();
                                            }
                                          }}
                                          onBlur={(event) => {
                                            confirmTextLayer(
                                              layer.id,
                                              event.currentTarget.value
                                            );
                                          }}
                                          className="
                                            min-w-[180px]
                                            max-w-[70vw]
                                            resize-none
                                            overflow-hidden
                                            rounded-xl
                                            border-2
                                            border-lime-400
                                            bg-transparent
                                            px-3
                                            py-2
                                            text-center
                                            font-bold
                                            outline-none
                                            placeholder:text-white/70
                                          "
                                          placeholder="Type something"
                                          style={{
                                            color: layer.color,
                                            fontFamily:
                                              layer.fontFamily || 'Arial, sans-serif',
                                            fontSize: `${displayFontSize}px`,
                                            textShadow:
                                              '0 2px 6px rgba(0,0,0,0.65)',
                                          }}
                                        />

                                        <button
                                          type="button"
                                          onPointerDown={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            confirmTextLayer(
                                              layer.id,
                                              layer.text
                                            );
                                          }}
                                          className="absolute -top-12 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border-2 border-stone-900 bg-white text-stone-900 shadow-lg"
                                          aria-label="Confirm text"
                                        >
                                          <Check className="h-5 w-5" />
                                        </button>
                                      </>
                                    ) : (
                                      <span className="block cursor-move whitespace-pre">
                                        {layer.text}
                                      </span>
                                    )}

                                    {isSelected &&
                                      !isEditingText &&
                                      activeTool === 'text' && (
                                        <>
                                          <button
                                            type="button"
                                            onPointerDown={(event) =>
                                              beginTextTransform(
                                                event,
                                                layer,
                                                'rotate'
                                              )
                                            }
                                            className="absolute -top-12 left-1/2 flex h-9 w-9 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border-2 border-stone-900 bg-white text-stone-900 shadow-lg active:cursor-grabbing"
                                            aria-label="Rotate text"
                                          >
                                            <RotateCw className="h-5 w-5" />
                                          </button>

                                          <button
                                            type="button"
                                            onPointerDown={(event) =>
                                              beginTextTransform(
                                                event,
                                                layer,
                                                'resize'
                                              )
                                            }
                                            className="absolute -bottom-4 -right-4 flex h-8 w-8 cursor-nwse-resize items-center justify-center rounded-full border-2 border-stone-900 bg-white text-sm font-black text-stone-900 shadow-lg"
                                            aria-label="Resize text"
                                          >
                                            ↘
                                          </button>
                                        </>
                                      )}
                                  </div>
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

                {/* Bottom bar when crop is active */}
                {activeTool === 'crop' && (
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTool(null);
                        setCrop(null);
                        setCompletedCrop(null);
                        setCompletedPercentCrop(null);

                        clearCropPreview();
                      }}
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200 hover:text-stone-950 active:scale-[0.98]"
                      aria-label="Cancel crop"
                    >
                      <X className="h-5 w-5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleResetCropOnly}
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

                {/* Bottom bar when annotation is active */}
                {activeTool === 'draw' && (
                  <div className="mt-4 flex w-full max-w-2xl items-center justify-center gap-4 rounded-full bg-stone-950 px-5 py-3 shadow-lg">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={brushSliderValue}
                      onChange={(event) =>
                        setBrushSliderValue(Number(event.target.value))
                      }
                      className="colour-slider w-full cursor-pointer appearance-none"
                      style={{
                        '--thumb-colour': brushColor,
                        background: `
                          linear-gradient(
                            to right,
                            #f43f5e 0%,
                            #d946ef 11%,
                            #6366f1 22%,
                            #3b82f6 33%,
                            #22d3ee 44%,
                            #84cc16 54%,
                            #fde047 64%,
                            #fb923c 74%,
                            #000000 84%,
                            #737373 92%,
                            #ffffff 100%
                          )
                        `,
                      }}
                      aria-label="Brush colour"
                    />

                    <div className="flex items-center justify-center gap-3">
                      {BRUSH_SIZES.map(({ value, iconSize }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setBrushSize(value)}
                          className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                            brushSize === value
                              ? 'border-orange-500 bg-gray-700 ring-2 ring-orange-500'
                              : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
                          }`}
                          aria-label={`Brush size ${value}`}
                        >
                          {/* The span IS the white circle icon */}
                          <span
                            className="rounded-full bg-white"
                            style={{
                              width: `${iconSize}px`,
                              height: `${iconSize}px`,
                            }}
                          />
                        </button>
                      ))}
                    </div>


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
                        Type directly on the image. Click confirmed text to move, resize, or rotate it.
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 text-sm font-bold text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleResetEdits}
                  className="rounded-xl px-4 py-2 text-sm font-bold text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                >
                  Reset
                </button>
              </div>

              <button
                type="button"
                disabled={isEditing}
                onClick={async () => {
                  try {
                    setIsEditing(true);

                    let cropPercentToApply =
                      appliedCropPercent ||
                      initialCrop ||
                      getFullCrop();
                    let shouldResetToOriginal = resetToOriginalPending;

                    if (activeTool === 'crop') {
                      const cropResult = await commitCrop();

                      if (cropResult) {
                        cropPercentToApply = cropResult.cropPercent;

                        if (!isFullCropPercent(cropResult.cropPercent)) {
                          shouldResetToOriginal = false;
                        }
                      }
                    }

                    let latestFile =
                      editedFile ||
                      baseFile ||
                      item.file;
                    let latestPreviewUrl =
                      editedPreviewUrl ||
                      basePreviewUrl ||
                      previewUrl;

                    if (activeTool === 'filter' && selectedFilter !== 'none') {
                      const filterResult = await commitFilter();

                      if (filterResult) {
                        latestFile = filterResult.file;
                        latestPreviewUrl = filterResult.previewUrl;
                        shouldResetToOriginal = false;
                        handedOffPreviewUrlRef.current =
                          filterResult.previewUrl;
                      }
                    }

                    const committedTextLayers = textLayers.filter(
                      (layer) => layer.text?.trim()
                    );

                    if (
                      committedTextLayers.length > 0 ||
                      annotationStrokes.length > 0
                    ) {
                      shouldResetToOriginal = false;
                    }

                    if (shouldResetToOriginal) {
                      latestFile = originalFile || item.file;
                      latestPreviewUrl =
                        originalPreviewUrl ||
                        item.previewUrl ||
                        previewUrl;
                    } else if (
                      latestPreviewUrl &&
                      latestPreviewUrl !== handedOffPreviewUrlRef.current
                    ) {
                      handedOffPreviewUrlRef.current = latestPreviewUrl;
                    }

                    // cropPercent remains metadata. Compression applies the crop later.
                    onApply({
                      file: latestFile,
                      previewUrl: latestPreviewUrl,
                      cropPercent: cropPercentToApply,
                      resetToOriginal: shouldResetToOriginal,
                      textLayers: committedTextLayers,
                      annotationStrokes,
                    });
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
