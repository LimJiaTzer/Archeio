import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, Trash2, RotateCw, ArrowUp, ArrowDown,
  Plus, Download, Loader2, CheckCircle2, X, ChevronLeft, ChevronRight,
  Brush, Eraser, Undo
} from 'lucide-react';
import Layout from '@/components/Layout';
import FilePreview from '@/components/FilePreview';
import { EditableFileName } from '@/components/EditableFileName';
import { pdfjs } from 'react-pdf'; // re-exports pdfjs-dist, already configured
import { compilePDF } from '@/services/pdfEditorService';

pdfjs.GlobalWorkerOptions.workerSrc =
  `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ─── Module-level cache ────────────────────────────────────────────────────
// Stores loaded pdfjs PDFDocumentProxy objects keyed by File reference.
// This avoids re-reading file bytes every time a page is rotated.
const pdfDocCache = new Map();

// ─── Rendering helper ──────────────────────────────────────────────────────
/**
 * Renders a single PDF page to two canvas snapshots:
 *   - thumbnailUrl  → JPEG data-URL at 56px wide   (sidebar)
 *   - previewUrl    → JPEG data-URL at 420px wide  (main canvas)
 *
 * @param {PDFDocumentProxy} pdfDoc   loaded pdfjs document
 * @param {number}           pageNum  1-indexed page number
 * @param {number}           rotation cumulative rotation in degrees (0/90/180/270)
 * @returns {{ thumbnailUrl, previewUrl, width, height }}
 */
async function renderPage(pdfDoc, pageNum, rotation) {
  const page = await pdfDoc.getPage(pageNum);
  const baseVp = page.getViewport({ scale: 1, rotation });

  // Thumbnail — fit into 56px wide
  const thumbVp = page.getViewport({ scale: 56 / baseVp.width, rotation });
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width  = Math.round(thumbVp.width);
  thumbCanvas.height = Math.round(thumbVp.height);
  await page.render({ canvasContext: thumbCanvas.getContext('2d'), viewport: thumbVp }).promise;
  const thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.6);

  // Preview — fit into 420px wide
  const previewVp = page.getViewport({ scale: 420 / baseVp.width, rotation });
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width  = Math.round(previewVp.width);
  previewCanvas.height = Math.round(previewVp.height);
  await page.render({ canvasContext: previewCanvas.getContext('2d'), viewport: previewVp }).promise;
  const previewUrl = previewCanvas.toDataURL('image/jpeg', 0.85);

  return {
    thumbnailUrl,
    previewUrl,
    width:  Math.round(previewVp.width),
    height: Math.round(previewVp.height),
  };
}

// ─── Component ─────────────────────────────────────────────────────────────
/**
 * pagesList item shape:
 * {
 *   id:             string,   — unique ID for React key / signature mapping
 *   file:           File,     — original File object (kept for pdf-lib export)
 *   originalPageNum:number,   — 1-indexed page within the source file
 *   rotation:       number,   — user-applied rotation: 0 | 90 | 180 | 270
 *   thumbnailUrl:   string|null, — pre-rendered JPEG data-URL (sidebar)
 *   previewUrl:     string|null, — pre-rendered JPEG data-URL (main canvas)
 *   width:          number,   — preview pixel width  (used for signature mapping)
 *   height:         number,   — preview pixel height
 *   isRendering:    boolean,  — true while pdfjs is drawing
 * }
 */
export default function PdfEditor() {
  const [pagesList,         setPagesList]         = useState([]);
  const [activePageIndex,   setActivePageIndex]   = useState(0);
  const [activeTool,        setActiveTool]        = useState('organize');
  const [isExporting,       setIsExporting]       = useState(false);
  const [exportComplete,    setExportComplete]    = useState(false);
  const [exportUrl,         setExportUrl]         = useState('');
  const [exportFile,        setExportFile]        = useState(null);

  // Expanded sidebar & multi-select state
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [selectedPageIds,   setSelectedPageIds]   = useState([]);

  // Drag and drop state for page thumbnails
  const [draggedIdx,        setDraggedIdx]        = useState(null);
  const [dragOverIdx,       setDragOverIdx]       = useState(null);

  // Position jump state
  const [moveToIndexValue,  setMoveToIndexValue]  = useState('');

  // Marquee selection state
  const [selectionBox, setSelectionBox] = useState({ startX: 0, startY: 0, currentX: 0, currentY: 0, active: false });
  const cardRectsRef = useRef([]); // [{ id, rect }]
  const initialSelectionRef = useRef([]);

  const sidebarRef = useRef(null);
  const scrollIntervalRef = useRef(null);
  const scrollDirectionRef = useRef(null);

  const containerRef = useRef(null);

  // Signature state
  const [placedSignatures,  setPlacedSignatures]  = useState({});
  const [sigColor,          setSigColor]          = useState('#000000');
  const sigCanvasRef = useRef(null);
  const customColorInputRef = useRef(null);
  const [isDrawing,         setIsDrawing]         = useState(false);

  // Text annotation state
  const [textInput,         setTextInput]         = useState('');
  const [textSize,          setTextSize]          = useState(24);
  const [textFont,          setTextFont]          = useState('Arial');
  const [textColor,         setTextColor]         = useState('#000000');
  const customTextColorInputRef = useRef(null);

  // Direct Draw state
  const directCanvasRef = useRef(null);
  const [brushWidth, setBrushWidth] = useState(3);
  const [brushMode, setBrushMode] = useState('draw'); // 'draw' | 'highlighter'
  const [drawHistory, setDrawHistory] = useState({}); // Mapping of pageId -> Array of image data URLs

  // Derived helpers
  const activePage     = pagesList[activePageIndex];
  const pageDimensions = activePage
    ? { width: activePage.width, height: activePage.height }
    : { width: 420, height: 594 };
  
  // ─── 1. FILE UPLOAD ───────────────────────────────────────────────────────
  const handleFileAdd = async (e) => {
    const files = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
    if (files.length === 0) return;
    e.target.value = null;

    for (const file of files) {
      try {
        // Load pdfjs document once per File reference
        if (!pdfDocCache.has(file)) {
          const bytes = await file.arrayBuffer();
          const task  = pdfjs.getDocument({ data: new Uint8Array(bytes) });
          pdfDocCache.set(file, await task.promise);
        }
        const pdfDoc    = pdfDocCache.get(file);
        const pageCount = pdfDoc.numPages;

        // Insert placeholder items immediately so the sidebar populates at once
        const placeholders = Array.from({ length: pageCount }, (_, i) => ({
          id:              Math.random().toString(36).substring(2, 9),
          file,
          originalPageNum: i + 1,
          rotation:        0,
          thumbnailUrl:    null,
          previewUrl:      null,
          width:           420,
          height:          594,
          isRendering:     true,
        }));

        setPagesList(prev => {
          const wasEmpty = prev.length === 0;
          if (wasEmpty) setActivePageIndex(0);
          return [...prev, ...placeholders];
        });

        
        // Render each page progressively and update as each finishes
        for (let i = 0; i < placeholders.length; i++) {
          const pageId   = placeholders[i].id;
          const rendered = await renderPage(pdfDoc, i + 1, 0);
          setPagesList(prev =>
            prev.map(p => p.id === pageId ? { ...p, ...rendered, isRendering: false} : p)
          );
        }
      } catch (err) {
        console.error('Error loading PDF:', err);
        alert(`Failed to load "${file.name}": ${err.message}`);
      }
    }
  };
  
    // Handle global paste event (Ctrl+V or Cmd+V)
    useEffect(() => {
      const handlePaste = (e) => {
        const target = e.target;
        // Bypass if focused inside writing nodes
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }

        if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
          const pdfFiles = Array.from(e.clipboardData.files).filter(f => f.type === 'application/pdf');
          if (pdfFiles.length === 0) return;
          
          e.preventDefault();
          // Emulate the target wrapper structure expected by handleFileAdd
          handleFileAdd({ target: { files: pdfFiles } });
        }
      };

      window.addEventListener('paste', handlePaste);
      return () => {
        window.removeEventListener('paste', handlePaste);
      };
    }, []);

  // ─── 2. PAGE ACTIONS ──────────────────────────────────────────────────────
  /**
   * Rotate the page 90° clockwise.
   * Re-renders both thumbnail and preview with the new rotation.
   */
  const rotatePage = async (id) => {
    const pageItem = pagesList.find(p => p.id === id);
    if (!pageItem) return;

    const newRotation = (pageItem.rotation + 90) % 360;

    // Immediately update rotation and show spinner
    setPagesList(prev =>
      prev.map(p => p.id === id ? { ...p, rotation: newRotation, isRendering: true } : p)
    );

    const pdfDoc = pdfDocCache.get(pageItem.file);
    if (pdfDoc) {
      const rendered = await renderPage(pdfDoc, pageItem.originalPageNum, newRotation);
      setPagesList(prev =>
        prev.map(p => p.id === id ? { ...p, ...rendered, isRendering: false } : p)
      );
    }
  };

  /** Delete all selected pages in selectedPageIds, adjusting activeIndex and selection. */
  const deleteSelectedPages = () => {
    if (selectedPageIds.length === 0) return;

    setPagesList(prev => {
      const filtered = prev.filter(p => !selectedPageIds.includes(p.id));
      
      // Clear signatures for all deleted pages
      setPlacedSignatures(sigPrev => {
        const copy = { ...sigPrev };
        selectedPageIds.forEach(id => {
          delete copy[id];
        });
        return copy;
      });

      let firstDeletedIdx = prev.findIndex(p => selectedPageIds.includes(p.id));
      if (firstDeletedIdx === -1) firstDeletedIdx = 0;

      const newActive = Math.max(0, Math.min(firstDeletedIdx, filtered.length - 1));
      setActivePageIndex(newActive);

      // Select the new active page
      if (filtered.length > 0 && filtered[newActive]) {
        setSelectedPageIds([filtered[newActive].id]);
      } else {
        setSelectedPageIds([]);
      }

      return filtered;
    });
  };

  /**
   * Move selected pages up (direction=-1) or down (direction=+1) respectively.
   */
  const moveSelectedPages = (direction) => {
    setPagesList(prev => {
      const copy = [...prev];
      const selectedSet = new Set(selectedPageIds);
      
      if (direction === -1) {
        // Move Up: iterate from 1 to N-1
        for (let i = 1; i < copy.length; i++) {
          if (selectedSet.has(copy[i].id) && !selectedSet.has(copy[i - 1].id)) {
            // Swap
            [copy[i], copy[i - 1]] = [copy[i - 1], copy[i]];
          }
        }
      } else if (direction === 1) {
        // Move Down: iterate from N-2 down to 0
        for (let i = copy.length - 2; i >= 0; i--) {
          if (selectedSet.has(copy[i].id) && !selectedSet.has(copy[i + 1].id)) {
            // Swap
            [copy[i], copy[i + 1]] = [copy[i + 1], copy[i]];
          }
        }
      }
      
      // Adjust activePageIndex to follow the active page if its position shifted
      const activePageId = prev[activePageIndex]?.id;
      if (activePageId) {
        const newActiveIdx = copy.findIndex(p => p.id === activePageId);
        if (newActiveIdx !== -1) {
          setActivePageIndex(newActiveIdx);
        }
      }
      
      return copy;
    });
  };

  /**
   * Reorder multiple pages (selectedIds) within the array, inserting as a block at targetIndex.
   */
  const reorderMultiplePages = (selectedIds, targetIndex) => {
    if (selectedIds.length === 0) return;

    // Get selected items in their current order in pagesList
    const selectedItems = pagesList.filter(p => selectedIds.includes(p.id));
    if (selectedItems.length === 0) return;

    // Get target item
    const targetItem = pagesList[targetIndex];

    // Filter out selected items
    const remainingItems = pagesList.filter(p => !selectedIds.includes(p.id));

    // Find the insert position
    let insertIndex = remainingItems.indexOf(targetItem);
    if (insertIndex === -1) {
      insertIndex = Math.min(targetIndex, remainingItems.length);
    }

    // Insert selectedItems as a block
    const newList = [...remainingItems];
    newList.splice(insertIndex, 0, ...selectedItems);

    setPagesList(newList);

    // Update active page index to first moved item
    const firstMovedItem = selectedItems[0];
    const newActiveIdx = newList.indexOf(firstMovedItem);
    if (newActiveIdx !== -1) {
      setActivePageIndex(newActiveIdx);
    }
  };

  const togglePageSelection = (e, pageId) => {
    e.stopPropagation();
    setSelectedPageIds(prev => 
      prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId]
    );
  };

  const handlePageClick = (e, index, pageId) => {
    if (e.shiftKey) {
      // Shift select range
      const start = Math.min(activePageIndex, index);
      const end = Math.max(activePageIndex, index);
      const rangeIds = pagesList.slice(start, end + 1).map(p => p.id);
      setSelectedPageIds(Array.from(new Set([...selectedPageIds, ...rangeIds])));
    } else if (e.metaKey || e.ctrlKey) {
      // Cmd / Ctrl toggle selection
      setSelectedPageIds(prev => 
        prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId]
      );
    } else {
      // Normal click sets active page and resets selection to just this one
      setActivePageIndex(index);
      setSelectedPageIds([pageId]);
    }
  };

  const handleDragStart = (e, index) => {
    const pageId = pagesList[index].id;
    if (!selectedPageIds.includes(pageId)) {
      setSelectedPageIds([pageId]);
      setActivePageIndex(index);
    }
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIdx !== index) {
      setDragOverIdx(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIdx(null);
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIdx !== null && draggedIdx !== index) {
      const pageId = pagesList[draggedIdx].id;
      let currentSelection = selectedPageIds;
      if (!selectedPageIds.includes(pageId)) {
        currentSelection = [pageId];
      }
      reorderMultiplePages(currentSelection, index);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleSidebarDragOver = (e) => {
    e.preventDefault();
    const container = sidebarRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;

    // Hot zones: top 40px and bottom 40px of container viewport
    const threshold = 40;
    const isNearTop = relativeY < threshold;
    const isNearBottom = relativeY > rect.height - threshold;

    let newDirection = null;
    if (isNearTop) {
      newDirection = 'up';
    } else if (isNearBottom) {
      newDirection = 'down';
    }

    if (newDirection !== scrollDirectionRef.current) {
      // Clear current interval
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }

      scrollDirectionRef.current = newDirection;

      if (newDirection === 'up') {
        scrollIntervalRef.current = setInterval(() => {
          container.scrollTop -= 8;
        }, 16);
      } else if (newDirection === 'down') {
        scrollIntervalRef.current = setInterval(() => {
          container.scrollTop += 8;
        }, 16);
      }
    }
  };

  const handleSidebarDragLeaveOrEnd = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
    scrollDirectionRef.current = null;
  };

  const handleMoveToPage = () => {
    const pageNum = parseInt(moveToIndexValue, 10);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > pagesList.length) {
      alert(`Please enter a valid page number between 1 and ${pagesList.length}`);
      return;
    }
    const targetIdx = pageNum - 1;
    reorderMultiplePages(selectedPageIds, targetIdx);
    setMoveToIndexValue('');
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
    handleSidebarDragLeaveOrEnd();
  };

  // ─── MARQUEE MULTI-SELECT ──────────────────────────────────────────────────
  const handleContainerMouseDown = (e) => {
    // Only select on left click and when clicked directly on the background
    if (e.button !== 0 || e.target !== sidebarRef.current) return;
    e.preventDefault();

    const containerRect = sidebarRef.current.getBoundingClientRect();
    const startX = e.clientX - containerRect.left + sidebarRef.current.scrollLeft;
    const startY = e.clientY - containerRect.top + sidebarRef.current.scrollTop;

    // Cache the bounding boxes of all card elements
    const cards = sidebarRef.current.querySelectorAll('[data-page-card]');
    cardRectsRef.current = Array.from(cards).map(card => ({
      id: card.getAttribute('data-page-id'),
      rect: card.getBoundingClientRect()
    }));

    const isAppending = e.shiftKey || e.metaKey || e.ctrlKey;
    initialSelectionRef.current = isAppending ? [...selectedPageIds] : [];

    if (!isAppending) {
      setSelectedPageIds([]);
    }

    setSelectionBox({
      startX,
      startY,
      currentX: startX,
      currentY: startY,
      active: true
    });
  };

  useEffect(() => {
    if (!selectionBox.active) return;

    const handleMouseMove = (mv) => {
      const container = sidebarRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const currentX = mv.clientX - containerRect.left + container.scrollLeft;
      const currentY = mv.clientY - containerRect.top + container.scrollTop;

      setSelectionBox(prev => ({ ...prev, currentX, currentY }));

      // Compute absolute screen/viewport bounds of the selection box to check overlap with cached card rects
      const marqueeRect = {
        left:   Math.min(selectionBox.startX, currentX) + containerRect.left - container.scrollLeft,
        right:  Math.max(selectionBox.startX, currentX) + containerRect.left - container.scrollLeft,
        top:    Math.min(selectionBox.startY, currentY) + containerRect.top - container.scrollTop,
        bottom: Math.max(selectionBox.startY, currentY) + containerRect.top - container.scrollTop,
      };

      const newlySelected = cardRectsRef.current
        .filter(card => {
          return !(
            card.rect.left   > marqueeRect.right ||
            card.rect.right  < marqueeRect.left  ||
            card.rect.top    > marqueeRect.bottom ||
            card.rect.bottom < marqueeRect.top
          );
        })
        .map(card => card.id);

      setSelectedPageIds(() => {
        const isAppending = mv.shiftKey || mv.metaKey || mv.ctrlKey;
        if (isAppending) {
          return Array.from(new Set([...initialSelectionRef.current, ...newlySelected]));
        } else {
          return newlySelected;
        }
      });
    };

    const handleMouseUp = () => {
      setSelectionBox(prev => ({ ...prev, active: false }));
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup',   handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup',   handleMouseUp);
    };
  }, [selectionBox.active, selectionBox.startX, selectionBox.startY]);

  // ─── 3. SIGNATURE DRAWING ─────────────────────────────────────────────────
  const startDrawing = (e) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const cx   = e.touches ? e.touches[0].clientX : e.clientX;
    const cy   = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Scale the coordinates properly
    const x = ((cx - rect.left) / rect.width) * canvas.width;
    const y = ((cy - rect.top) / rect.height) * canvas.height;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.strokeStyle = sigColor;
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const cx   = e.touches ? e.touches[0].clientX : e.clientX;
    const cy   = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Scale the coordinates properly
    const x = ((cx - rect.left) / rect.width) * canvas.width;
    const y = ((cy - rect.top) / rect.height) * canvas.height;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  // ─── 3.1 DIRECT PDF ANNOTATION DRAWING ─────────────────────────────────────
  const startDirectDrawing = (e) => {
    const canvas = directCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    
    const x = ((cx - rect.left) / rect.width) * canvas.width;
    const y = ((cy - rect.top) / rect.height) * canvas.height;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = brushWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (brushMode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1.0;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      if (brushMode === 'highlighter') {
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = sigColor;
      } else {
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = sigColor;
      }
    }
    
    setIsDrawing(true);
  };

  const drawDirect = (e) => {
    if (!isDrawing) return;
    const canvas = directCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    
    const x = ((cx - rect.left) / rect.width) * canvas.width;
    const y = ((cy - rect.top) / rect.height) * canvas.height;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDirectDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    const canvas = directCanvasRef.current;
    if (canvas) {
      const currentImg = canvas.toDataURL('image/png');
      setDrawHistory(prev => {
        const pageHistory = prev[activePage.id] || [];
        return {
          ...prev,
          [activePage.id]: [...pageHistory, currentImg]
        };
      });
    }
    
    saveDirectDrawLayer();
  };

  const clearDirectDraw = () => {
    const canvas = directCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Clear history completely for this page
    setDrawHistory(prev => ({
      ...prev,
      [activePage.id]: []
    }));
    
    saveDirectDrawLayer();
  };

  const handleUndoDirectDraw = () => {
    if (!activePage) return;
    const history = drawHistory[activePage.id] || [];
    if (history.length === 0) return;

    const newHistory = history.slice(0, -1);
    setDrawHistory(prev => ({
      ...prev,
      [activePage.id]: newHistory
    }));

    const canvas = directCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (newHistory.length > 0) {
      const prevImgUrl = newHistory[newHistory.length - 1];
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Save the updated draw layer back to annotations
        saveDirectDrawLayer(prevImgUrl);
      };
      img.src = prevImgUrl;
    } else {
      // If history is now empty, remove the draw annotation completely
      saveDirectDrawLayer(null);
    }
  };

  const saveDirectDrawLayer = (overrideImgUrl = undefined) => {
    const canvas = directCanvasRef.current;
    if (!canvas) return;

    let imgUrl = overrideImgUrl;
    let isBlank = false;
    
    if (imgUrl === undefined) {
      imgUrl = canvas.toDataURL('image/png');
      const blank = document.createElement('canvas');
      blank.width = canvas.width; blank.height = canvas.height;
      isBlank = imgUrl === blank.toDataURL();
    } else {
      isBlank = !imgUrl;
    }
    
    setPlacedSignatures(prev => {
      const currentSigs = Array.isArray(prev[activePage.id]) 
        ? prev[activePage.id] 
        : (prev[activePage.id] ? [prev[activePage.id]] : []);
        
      const drawSigId = `draw-${activePage.id}`;
      const filtered = currentSigs.filter(s => s.id !== drawSigId);
      
      if (isBlank) {
        const copy = { ...prev };
        if (filtered.length === 0) {
          delete copy[activePage.id];
        } else {
          copy[activePage.id] = filtered;
        }
        return copy;
      } else {
        const newDrawAnnotation = {
          id: drawSigId,
          isDrawLayer: true,
          img: imgUrl,
          x: 0,
          y: 0,
          width: pageDimensions.width,
          height: pageDimensions.height
        };
        return {
          ...prev,
          [activePage.id]: [...filtered, newDrawAnnotation]
        };
      }
    });
  };

  // Sync direct canvas with existing drawings on page or tool change
  useEffect(() => {
    if (activeTool !== 'draw' || !activePage) return;
    const canvas = directCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const pageSigs = placedSignatures[activePage.id] || [];
    const drawSig = pageSigs.find(s => s.id === `draw-${activePage.id}`);
    if (drawSig && drawSig.img) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = drawSig.img;

      // Initialize draw history if empty
      Promise.resolve().then(() => {
        setDrawHistory(prev => {
          if (!prev[activePage.id] || prev[activePage.id].length === 0) {
            return {
              ...prev,
              [activePage.id]: [drawSig.img]
            };
          }
          return prev;
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageIndex, activeTool, activePage?.id]);

  // Keyboard shortcut for Undo (Cmd+Z / Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeTool !== 'draw' || !activePage) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndoDirectDraw();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, activePage?.id, drawHistory]);

  // ─── 4. SIGNATURE OVERLAY ─────────────────────────────────────────────────
  const addSignatureToPdf = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const blank = document.createElement('canvas');
    blank.width = canvas.width; blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      alert('Please draw your signature first.');
      return;
    }
    const sigData = canvas.toDataURL();

    if (!activePage) return;
    const newAnnotation = {
      id: Math.random().toString(36).substring(2, 9),
      img: sigData,
      x: 35,
      y: 45,
      width: 150,
      height: 60
    };
    setPlacedSignatures(prev => ({
      ...prev,
      [activePage.id]: [...(Array.isArray(prev[activePage.id]) ? prev[activePage.id] : (prev[activePage.id] ? [prev[activePage.id]] : [])), newAnnotation]
    }));

    // Clear signature canvas after adding to PDF
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  const generateTextImage = (text, size, font, color) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Scale up for crisp high-dpi text rendering
    const scale = 3;
    const scaledSize = size * scale;
    
    ctx.font = `${scaledSize}px "${font}", sans-serif`;
    const metrics = ctx.measureText(text);
    
    const textWidth = Math.ceil(metrics.width) || 100;
    const padding = 10 * scale;
    const canvasWidth = textWidth + padding * 2;
    const canvasHeight = Math.ceil(scaledSize * 1.3) + padding * 2;
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    ctx.font = `${scaledSize}px "${font}", sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillText(text, padding, canvasHeight / 2);
    
    return {
      img: canvas.toDataURL('image/png'),
      width: canvasWidth / scale,
      height: canvasHeight / scale
    };
  };

  const addTextToPdf = () => {
    if (!textInput.trim()) {
      alert('Please enter some text first.');
      return;
    }
    if (!activePage) return;

    const { img, width, height } = generateTextImage(textInput, textSize, textFont, textColor);

    const newAnnotation = {
      id: Math.random().toString(36).substring(2, 9),
      img: img,
      x: 35,
      y: 45,
      width: width,
      height: height
    };

    setPlacedSignatures(prev => ({
      ...prev,
      [activePage.id]: [...(Array.isArray(prev[activePage.id]) ? prev[activePage.id] : (prev[activePage.id] ? [prev[activePage.id]] : [])), newAnnotation]
    }));

    setTextInput('');
  };

  const removePlacedSignature = (pageId, sigId) => {
    setPlacedSignatures(prev => {
      const pageSigs = Array.isArray(prev[pageId]) ? prev[pageId] : (prev[pageId] ? [prev[pageId]] : []);
      const filtered = pageSigs.filter(s => s.id !== sigId);
      const copy = { ...prev };
      if (filtered.length === 0) {
        delete copy[pageId];
      } else {
        copy[pageId] = filtered;
      }
      return copy;
    });
  };

  const handleSigDragStart = (e, sigId) => {
    e.preventDefault();
    if (!activePage || !placedSignatures[activePage.id]) return;
    
    const pageSigs = Array.isArray(placedSignatures[activePage.id]) 
      ? placedSignatures[activePage.id] 
      : [placedSignatures[activePage.id]];
      
    const sig = pageSigs.find(s => s.id === sigId || !sigId);
    if (!sig) return;
    
    const container = containerRef.current.getBoundingClientRect();
    const startX    = e.clientX;
    const startY    = e.clientY;
    const startLeft = sig.x;
    const startTop  = sig.y;

    const onMove = (mv) => {
      const dx = ((mv.clientX - startX) / container.width)  * 100;
      const dy = ((mv.clientY - startY) / container.height) * 100;
      const wPct = (sig.width  / container.width)  * 100;
      const hPct = (sig.height / container.height) * 100;
      setPlacedSignatures(prev => {
        const currentSigs = Array.isArray(prev[activePage.id]) 
          ? prev[activePage.id] 
          : (prev[activePage.id] ? [prev[activePage.id]] : []);
          
        const updated = currentSigs.map(s => s.id === sig.id ? {
          ...s,
          x: Math.max(0, Math.min(100 - wPct, startLeft + dx)),
          y: Math.max(0, Math.min(100 - hPct, startTop  + dy)),
        } : s);
        return {
          ...prev,
          [activePage.id]: updated
        };
      });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  };

  const handleSigResizeStart = (e, sigId) => {
    e.stopPropagation(); // Avoid triggering drag on the signature container
    e.preventDefault();
    if (!activePage || !placedSignatures[activePage.id]) return;

    const pageSigs = Array.isArray(placedSignatures[activePage.id]) 
      ? placedSignatures[activePage.id] 
      : [placedSignatures[activePage.id]];
      
    const sig = pageSigs.find(s => s.id === sigId) || pageSigs[0];
    if (!sig) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = sig.width;
    const startHeight = sig.height;

    const onMove = (mv) => {
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;

      setPlacedSignatures(prev => {
        const currentSigs = Array.isArray(prev[activePage.id]) 
          ? prev[activePage.id] 
          : (prev[activePage.id] ? [prev[activePage.id]] : []);

        const updated = currentSigs.map(s => s.id === sig.id ? {
          ...s,
          width: Math.max(30, startWidth + dx),
          height: Math.max(20, startHeight + dy),
        } : s);

        return {
          ...prev,
          [activePage.id]: updated
        };
      });
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   onUp);
  };

  // ─── 5. EXPORT ────────────────────────────────────────────────────────────
  const exportPDF = async () => {
    if (pagesList.length === 0) return;
    setIsExporting(true);
    setExportComplete(false);
    try {
      const blob = await compilePDF(pagesList, placedSignatures, pageDimensions);
      const url = URL.createObjectURL(blob);
      const file = new File([blob], "archeio_edited.pdf", { type: "application/pdf" });
      setExportUrl(url);
      setExportFile(file);
      setExportComplete(true);
    } catch (err) {
      console.error('Export error:', err);
      alert('Error exporting PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleReset = () => {
    setPagesList([]);
    setPlacedSignatures({});
    setActivePageIndex(0);
    setExportComplete(false);
    setExportUrl('');
    setExportFile(null);
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <Layout>
      <main className="max-w-7xl mx-auto p-4 sm:p-8">

        {/* Nav & Actions */}
        <nav className="mb-6">
          <Link to="/" className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>
        </nav>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-stone-900 mb-2">PDF Editor &amp; Annotator</h1>
          <p className="text-stone-600 max-w-xl mx-auto text-sm sm:text-base">
            Easily combine PDFs, reorganize pages, delete empty slots, and sign documents locally.
          </p>
        </div>

        {/* Upload dropzone (shown when no pages loaded) */}
        {pagesList.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 shadow-sm border border-stone-200 text-center relative max-w-xl mx-auto hover:bg-stone-50 transition-colors cursor-pointer group">
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={handleFileAdd}
            />
            <div className="bg-[#FAF0E1] rounded-3xl w-16 h-16 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-[#E08E19]" />
            </div>
            <h3 className="text-lg font-bold text-stone-800 mb-2">Upload your PDF</h3>
            <p className="text-stone-500 text-xs sm:text-sm leading-relaxed max-w-xs mx-auto">
              Select one or multiple files to begin. Merges happen instantly.
            </p>
          </div>

        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

            {/* ── COLUMN 1: Thumbnail Sidebar ───────────────────────────── */}
            <div className={`bg-white rounded-2xl p-4 border border-stone-200 flex flex-col max-h-[700px] overflow-hidden transition-all duration-300 ${
              isSidebarExpanded ? 'lg:col-span-6' : 'lg:col-span-3'
            }`}>
                <div className="flex items-center justify-between mb-4 border-b pb-2">
                <div className="flex flex-col items-start min-w-0">
                  <span className="font-bold text-stone-800 text-sm leading-tight">
                    {pagesList.length <= 1 ? "Page" : "Pages"} ({pagesList.length}) 
                  </span>
                  {selectedPageIds.length > 0 && (
                    <span className="text-[10px] text-stone-500 font-semibold leading-tight mt-0.5">
                      ({selectedPageIds.length} selected)
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
                      className="p-1.5 border border-stone-200 hover:bg-stone-50 rounded-lg text-stone-600 transition-colors"
                      title={isSidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
                    >
                      {isSidebarExpanded ? (
                        <ChevronLeft className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>

                    <div className="relative cursor-pointer bg-[#FAF0E1] hover:bg-[#EADCC3] text-[#E08E19] rounded-lg p-1.5 transition-colors">
                    <input
                        type="file"
                        accept="application/pdf"
                        multiple
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleFileAdd}
                    />
                    <Plus className="w-4 h-4" />
                    </div>
                    
                    <button
                    onClick={handleReset}
                    className="px-3 py-1 border border-stone-200 hover:bg-red-500 hover:text-white rounded-lg text-sm font-bold text-stone-600 transition-colors"
                    >
                    Reset
                    </button>
                </div>
                </div>

              <div
                ref={sidebarRef}
                onDragOver={handleSidebarDragOver}
                onDragLeave={handleSidebarDragLeaveOrEnd}
                onDrop={handleSidebarDragLeaveOrEnd}
                onMouseDown={handleContainerMouseDown}
                className={`flex-1 overflow-y-auto pr-1 relative ${
                  isSidebarExpanded 
                    ? 'grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-4 pl-3 pr-2 py-2 content-start' 
                    : 'space-y-3'
                }`}
              >
                {pagesList.map((pageItem, idx) => {
                  const isSelected = selectedPageIds.includes(pageItem.id);
                  return (
                    <div
                      key={pageItem.id}
                      data-page-card
                      data-page-id={pageItem.id}
                      onClick={(e) => handlePageClick(e, idx, pageItem.id)}
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`border rounded-xl cursor-grab active:cursor-grabbing transition-all relative ${
                        isSidebarExpanded 
                          ? 'flex flex-col items-center p-3 text-center gap-2' 
                          : 'p-2 flex items-center gap-3'
                      } group ${
                        draggedIdx === idx ? 'opacity-40 border-dashed border-stone-300 bg-stone-100/30' : ''
                      } ${
                        dragOverIdx === idx ? 'border-[#E08E19] bg-[#FAF0E1]/80 scale-[1.02]' : ''
                      } ${
                        isSelected && dragOverIdx !== idx
                          ? 'border-[#E08E19] bg-[#FAF0E1]/60 shadow-sm ring-1 ring-[#E08E19]/30'
                          : (activePageIndex === idx && dragOverIdx !== idx
                             ? 'border-[#E08E19]/50 bg-[#FAF0E1]/20'
                             : (draggedIdx !== idx && dragOverIdx !== idx ? 'border-stone-100 hover:border-stone-300 bg-stone-50/50' : ''))
                      }`}
                    >
                      {/* Drag insertion indicator */}
                      {dragOverIdx === idx && draggedIdx !== idx && (
                        isSidebarExpanded ? (
                          <div className="absolute -left-[10px] top-0 bottom-0 w-0 z-30 pointer-events-none">
                            <div className="h-full border-l-2 border-dashed border-[#E08E19]" />
                          </div>
                        ) : (
                          <div className="absolute left-0 right-0 -top-[7px] h-0 z-30 pointer-events-none">
                            <div className="w-full border-t-2 border-dashed border-[#E08E19]" />
                          </div>
                        )
                      )}

                      {/* Checkbox selector */}
                      {isSidebarExpanded ? (
                        <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => togglePageSelection(e, pageItem.id)}
                            className="w-3.5 h-3.5 rounded border-stone-300 text-[#E08E19] focus:ring-[#E08E19] cursor-pointer"
                          />
                        </div>
                      ) : (
                        <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => togglePageSelection(e, pageItem.id)}
                            className="w-3.5 h-3.5 rounded border-stone-300 text-[#E08E19] focus:ring-[#E08E19] cursor-pointer"
                          />
                        </div>
                      )}

                      {/* Thumbnail image */}
                      <div className="w-14 h-16 bg-stone-100 border border-stone-200 overflow-hidden flex-shrink-0 flex items-center justify-center rounded select-none pointer-events-none">
                        {pageItem.isRendering || !pageItem.thumbnailUrl ? (
                          <Loader2 className="w-4 h-4 text-stone-400 animate-spin" />
                        ) : (
                          <img
                            src={pageItem.thumbnailUrl}
                            alt={`Page ${pageItem.originalPageNum} thumbnail`}
                            className="w-full h-full object-contain"
                          />
                        )}
                      </div>

                      <div className={`min-w-0 select-none pointer-events-none ${isSidebarExpanded ? 'w-full' : 'flex-1'}`}>
                        <p className="text-[11px] font-bold text-stone-800 truncate max-w-full" title={pageItem.file.name}>
                          {pageItem.file.name}
                        </p>
                        <p className="text-[10px] text-stone-400 font-semibold mt-1">
                          Page {idx + 1}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Marquee Selection Rectangle */}
                {selectionBox.active && (
                  <div
                    className="absolute border-2 border-[#E08E19] bg-[#FAF0E1]/30 rounded-lg pointer-events-none z-50"
                    style={{
                      left: Math.min(selectionBox.startX, selectionBox.currentX),
                      top: Math.min(selectionBox.startY, selectionBox.currentY),
                      width: Math.abs(selectionBox.startX - selectionBox.currentX),
                      height: Math.abs(selectionBox.startY - selectionBox.currentY),
                    }}
                  />
                )}
              </div>
            </div>

            {/* ── COLUMN 2: Main Canvas ─────────────────────────────────── */}
            <div className={`bg-stone-50 border border-stone-200 rounded-2xl flex flex-col items-center justify-center p-6 min-h-[500px] max-h-[700px] overflow-hidden transition-all duration-300 ${
              isSidebarExpanded ? 'lg:col-span-3' : 'lg:col-span-6'
            }`}>

              {/* Pagination */}
              <div className="flex items-center gap-4 mb-4 select-none">
                <button
                  disabled={activePageIndex === 0}
                  onClick={() => setActivePageIndex(p => p - 1)}
                  className="p-1 rounded-lg border bg-white hover:bg-stone-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-bold text-stone-600">
                  Page {activePageIndex + 1} of {pagesList.length}
                </span>
                <button
                  disabled={activePageIndex === pagesList.length - 1}
                  onClick={() => setActivePageIndex(p => p + 1)}
                  className="p-1 rounded-lg border bg-white hover:bg-stone-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Page preview + signature overlay */}
              <div
                ref={containerRef}
                className="relative bg-white shadow-xl rounded-xl border border-stone-200 overflow-hidden select-none max-w-full flex items-center justify-center"
                style={{ width: `${pageDimensions.width}px`, height: `${pageDimensions.height}px` }}
              >
                {activePage && (
                  activePage.isRendering || !activePage.previewUrl ? (
                    <div className="flex flex-col items-center gap-3 text-stone-400">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="text-xs font-bold">Rendering page...</span>
                    </div>
                  ) : (
                    <img
                      src={activePage.previewUrl}
                      alt={`Page ${activePage.originalPageNum} preview`}
                      className="w-full h-full object-contain"
                      draggable={false}
                    />
                  )
                )}

                {/* Direct Annotate drawing overlay canvas */}
                {activeTool === 'draw' && activePage && !activePage.isRendering && activePage.previewUrl && (
                  <canvas
                    ref={directCanvasRef}
                    width={pageDimensions.width}
                    height={pageDimensions.height}
                    onMouseDown={startDirectDrawing}
                    onMouseMove={drawDirect}
                    onMouseUp={stopDirectDrawing}
                    onMouseLeave={stopDirectDrawing}
                    onTouchStart={startDirectDrawing}
                    onTouchMove={drawDirect}
                    onTouchEnd={stopDirectDrawing}
                    className="absolute inset-0 cursor-crosshair z-30 touch-none"
                  />
                )}

                {/* Placed signature/draw overlays */}
                {activePage && placedSignatures[activePage.id] && (
                  (Array.isArray(placedSignatures[activePage.id]) ? placedSignatures[activePage.id] : [placedSignatures[activePage.id]]).map(sig => {
                    const isDraw = sig.isDrawLayer;
                    return (
                      <div
                        key={sig.id || 'default'}
                        style={{
                          position:        'absolute',
                          left:            `${sig.x}%`,
                          top:             `${sig.y}%`,
                          width:           isDraw ? '100%' : `${sig.width}px`,
                          height:          isDraw ? '100%' : `${sig.height}px`,
                          border:          isDraw ? 'none' : '1.5px dashed #4f46e5',
                          backgroundColor: isDraw ? 'transparent' : 'rgba(79, 70, 229, 0.08)',
                          cursor:          isDraw ? 'default' : 'move',
                          display:         'flex',
                          alignItems:      'center',
                          justifyContent:  'center',
                          pointerEvents:   isDraw ? 'none' : 'auto',
                        }}
                        onMouseDown={isDraw ? null : (e) => handleSigDragStart(e, sig.id)}
                        className={isDraw ? '' : 'group'}
                      >
                        <img
                          src={sig.img}
                          alt="overlay annotation"
                          className="w-full h-full object-contain pointer-events-none"
                        />
                        {!isDraw && (
                          <>
                            <button
                              onClick={() => removePlacedSignature(activePage.id, sig.id)}
                              className="absolute -top-2.5 -right-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>

                            {/* Resize handle */}
                            <div
                              onMouseDown={(e) => handleSigResizeStart(e, sig.id)}
                              className="absolute bottom-0 right-0 w-3 h-3 bg-[#4f46e5] border border-white rounded-full cursor-se-resize shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-20"
                              style={{ transform: 'translate(50%, 50%)' }}
                            />
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── COLUMN 3: Right Tools Panel ───────────────────────────── */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 lg:col-span-3 flex flex-col justify-between max-h-[700px] overflow-y-auto">

              {/* Tool toggle */}
              <div className="flex-1 overflow-y-auto pr-1 mb-4">
                <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-6">
                    {['organize', 'sign', 'draw'].map(tool => (
                    <button
                        key={tool}
                        onClick={() => setActiveTool(tool)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                        activeTool === tool
                            ? 'bg-white text-[#E08E19] shadow-sm'
                            : 'text-stone-600 hover:bg-white/50'
                        }`}
                    >
                        {tool === 'organize' ? 'Organize' : tool === 'sign' ? 'Annotate' : 'Draw'}
                    </button>
                    ))}
                </div>

                {/* ORGANIZE */}
                {activeTool === 'organize' && activePage && (
                    <div className="space-y-6">
                    <div>
                        <h4 className="text-xs font-black uppercase text-stone-400 tracking-wider mb-2">Page Settings</h4>
                        <p className="text-xs text-stone-500">Edit features for page {activePageIndex + 1}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                        onClick={() => rotatePage(activePage.id)}
                        disabled={activePage.isRendering}
                        className="flex flex-col items-center justify-center p-3 border border-stone-200 hover:border-[#E08E19] rounded-xl transition-all gap-2 group text-stone-700 disabled:opacity-50"
                        >
                        <RotateCw className="w-5 h-5 text-stone-400 group-hover:text-[#E08E19] transition-colors" />
                        <span className="text-[10px] font-bold">Rotate 90°</span>
                        </button>
                        <button
                        onClick={deleteSelectedPages}
                        className="flex flex-col items-center justify-center p-3 border border-stone-200 hover:border-red-500 rounded-xl transition-all gap-2 group text-stone-700"
                        >
                        <Trash2 className="w-5 h-5 text-stone-400 group-hover:text-red-500 transition-colors" />
                        <span className="text-[10px] font-bold">
                          {selectedPageIds.length > 1 ? `Delete Selected (${selectedPageIds.length})` : 'Delete Page'}
                        </span>
                        </button>
                    </div>

                    <div className="border-t pt-4">
                        <h4 className="text-xs font-black uppercase text-stone-400 tracking-wider mb-3">Arrangement</h4>
                        <div className="flex gap-2 mb-3">
                        <button
                            onClick={() => moveSelectedPages(-1)}
                            disabled={selectedPageIds.length === 0 || selectedPageIds.includes(pagesList[0]?.id)}
                            className="flex-1 py-2 border rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-stone-50 disabled:opacity-40"
                        >
                            <ArrowUp className="w-3.5 h-3.5" /> Move Up
                        </button>
                        <button
                            onClick={() => moveSelectedPages(1)}
                            disabled={selectedPageIds.length === 0 || selectedPageIds.includes(pagesList[pagesList.length - 1]?.id)}
                            className="flex-1 py-2 border rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-stone-50 disabled:opacity-40"
                        >
                            <ArrowDown className="w-3.5 h-3.5" /> Move Down
                        </button>
                        </div>

                        {/* Move directly to page position input */}
                        <div className="flex items-center gap-2 pt-2">
                          <span className="text-[11px] font-bold text-stone-500 whitespace-nowrap">Move to page:</span>
                          <input
                            type="number"
                            min="1"
                            max={pagesList.length}
                            value={moveToIndexValue}
                            onChange={(e) => setMoveToIndexValue(e.target.value)}
                            placeholder="#"
                            className="w-14 px-2 py-1 text-xs border border-stone-200 rounded-lg text-center font-bold text-stone-800"
                          />
                          <button
                            onClick={handleMoveToPage}
                            className="px-2.5 py-1 bg-[#E08E19] hover:bg-[#C87C11] text-white rounded-lg text-xs font-bold transition-colors"
                          >
                            Go
                          </button>
                        </div>
                    </div>
                    </div>
                )}

                {/* SIGN */}
                {activeTool === 'sign' && (
                    <div className="space-y-6 flex-1 flex flex-col">
                    <div>
                        <h4 className="text-xs font-black uppercase text-stone-400 tracking-wider mb-2">Add Annotations</h4>
                        <p className="text-xs text-stone-500">Sign with mouse, trackpad, or touchscreen.</p>
                    </div>

                    <div className="border rounded-xl overflow-hidden bg-stone-50">
                        <canvas
                        ref={sigCanvasRef}
                        width={220}
                        height={120}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="cursor-crosshair bg-white w-full h-[120px]"
                        />
                        <div className="p-2 border-t flex items-center justify-between bg-stone-50">
                        <div className="flex gap-1.5 items-center">
                            {['#000000', '#0000ff', '#ff0000'].map(color => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => setSigColor(color)}
                                className={`w-4 h-4 rounded-full border border-stone-300 transition-all ${sigColor === color ? 'ring-2 ring-[#E08E19] scale-110' : 'hover:scale-105'}`}
                                style={{ backgroundColor: color }}
                            />
                            ))}
                            {/* Custom Color Picker Button with overlaid transparent input for precise browser dialog alignment */}
                            <div
                                className={`w-4 h-4 rounded-full border border-stone-300 relative flex items-center justify-center overflow-hidden transition-all ${
                                !['#000000', '#0000ff', '#ff0000'].includes(sigColor)
                                    ? 'ring-2 ring-[#E08E19] scale-110'
                                    : 'hover:scale-105'
                                }`}
                                style={{
                                background: !['#000000', '#0000ff', '#ff0000'].includes(sigColor)
                                    ? sigColor
                                    : 'conic-gradient(from 0deg, red, yellow, green, cyan, blue, magenta, red)'
                                }}
                                title="Custom Color Picker"
                            >
                                <input
                                    type="color"
                                    ref={customColorInputRef}
                                    value={['#000000', '#0000ff', '#ff0000'].includes(sigColor) ? '#000000' : sigColor}
                                    onChange={(e) => setSigColor(e.target.value)}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                {!['#000000', '#0000ff', '#ff0000'].includes(sigColor) && (
                                <span className="w-1 h-1 bg-white rounded-full shadow-sm pointer-events-none" />
                                )}
                            </div>
                        </div>
                        <button onClick={clearCanvas} className="text-[10px] font-bold text-stone-500 hover:text-stone-800">
                            Clear
                        </button>
                        </div>
                    </div>

                    <button
                        onClick={addSignatureToPdf}
                        className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                        Add to PDF
                    </button>

                    {/* Add Text Subsection */}
                    <div className="border-t pt-5 space-y-4">
                      <div>
                        <h4 className="text-xs font-black uppercase text-stone-400 tracking-wider mb-2">Add Text to PDF</h4>
                        <p className="text-xs text-stone-500">Type text and add it anywhere on the page.</p>
                      </div>

                      {/* Text Input */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-stone-500 uppercase">Text</label>
                        <input
                          type="text"
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                          placeholder="Type your text here..."
                          className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-hidden focus:border-[#E08E19] font-medium"
                        />
                      </div>

                      {/* Font Family and Font Size Row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-stone-500 uppercase">Font</label>
                          <select
                            value={textFont}
                            onChange={(e) => setTextFont(e.target.value)}
                            className="w-full px-2 py-1.5 border border-stone-200 rounded-xl text-xs text-stone-700 bg-white focus:outline-hidden focus:border-[#E08E19]"
                          >
                            <option value="Arial">Arial</option>
                            <option value="Times New Roman">Times New Roman</option>
                            <option value="Courier New">Courier New</option>
                            <option value="Georgia">Georgia</option>
                            <option value="Impact">Impact</option>
                            <option value="Comic Sans MS">Comic Sans MS</option>
                            <option value="Verdana">Verdana</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-stone-500 uppercase">Size</label>
                          <select
                            value={textSize}
                            onChange={(e) => setTextSize(Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-stone-200 rounded-xl text-xs text-stone-700 bg-white focus:outline-hidden focus:border-[#E08E19]"
                          >
                            {[12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 64, 72].map(sz => (
                              <option key={sz} value={sz}>{sz}px</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Color Options block */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-stone-500 uppercase block mb-0.5">Text Color</label>
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1.5 items-center ml-1">
                            {['#000000', '#0000ff', '#ff0000'].map(color => (
                              <button
                                key={color}
                                type="button"
                                onClick={() => setTextColor(color)}
                                className={`w-4 h-4 rounded-full border border-stone-300 transition-all ${textColor === color ? 'ring-2 ring-[#E08E19] scale-110' : 'hover:scale-105'}`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                            {/* Custom Color Picker Button */}
                            <div
                              className={`w-4 h-4 rounded-full border border-stone-300 relative flex items-center justify-center overflow-hidden transition-all ${
                                !['#000000', '#0000ff', '#ff0000'].includes(textColor)
                                  ? 'ring-2 ring-[#E08E19] scale-110'
                                  : 'hover:scale-105'
                              }`}
                              style={{
                                background: !['#000000', '#0000ff', '#ff0000'].includes(textColor)
                                  ? textColor
                                  : 'conic-gradient(from 0deg, red, yellow, green, cyan, blue, magenta, red)'
                              }}
                              title="Custom Color Picker"
                            >
                              <input
                                type="color"
                                ref={customTextColorInputRef}
                                value={['#000000', '#0000ff', '#ff0000'].includes(textColor) ? '#000000' : textColor}
                                onChange={(e) => setTextColor(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              {!['#000000', '#0000ff', '#ff0000'].includes(textColor) && (
                                <span className="w-1 h-1 bg-white rounded-full shadow-sm pointer-events-none" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Add Text Button */}
                      <button
                        onClick={addTextToPdf}
                        className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors"
                      >
                        Add Text to PDF
                      </button>
                    </div>
                    </div>
                )}

                {/* DIRECT DRAW */}
                {activeTool === 'draw' && (
                    <div className="space-y-6 flex-1 flex flex-col">
                    <div>
                        <h4 className="text-xs font-black uppercase text-stone-400 tracking-wider mb-2">Direct PDF Draw</h4>
                        <p className="text-xs text-stone-500">Draw directly on the active PDF preview on the left. Changes autosave instantly.</p>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex gap-1 bg-stone-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setBrushMode('draw')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          brushMode === 'draw' ? 'bg-white text-[#E08E19] shadow-xs' : 'text-stone-600 hover:bg-white/30'
                        }`}
                      >
                        <Brush className="w-3.5 h-3.5" /> Pen
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrushMode('highlighter')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          brushMode === 'highlighter' ? 'bg-white text-[#E08E19] shadow-xs' : 'text-stone-600 hover:bg-white/30'
                        }`}
                      >
                        <Brush className="w-3.5 h-3.5 opacity-60" /> Highlighter
                      </button>
                      <button
                        type="button"
                        onClick={() => setBrushMode('erase')}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                          brushMode === 'erase' ? 'bg-white text-[#E08E19] shadow-xs' : 'text-stone-600 hover:bg-white/30'
                        }`}
                      >
                        <Eraser className="w-3.5 h-3.5" /> Eraser
                      </button>
                    </div>

                    {/* Color selection */}
                    <div className="space-y-2">
                      <h5 className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Stroke Color</h5>
                      <div className="flex gap-1.5 items-center bg-stone-50 p-2.5 border rounded-xl">
                          {['#000000', '#0000ff', '#ff0000'].map(color => (
                          <button
                              key={color}
                              type="button"
                              onClick={() => setSigColor(color)}
                              className={`w-4 h-4 rounded-full border border-stone-300 transition-all ${sigColor === color ? 'ring-2 ring-[#E08E19] scale-110' : 'hover:scale-105'}`}
                              style={{ backgroundColor: color }}
                          />
                          ))}
                          {/* Custom Color Picker Button */}
                          <div
                              className={`w-4 h-4 rounded-full border border-stone-300 relative flex items-center justify-center overflow-hidden transition-all ${
                              !['#000000', '#0000ff', '#ff0000'].includes(sigColor)
                                  ? 'ring-2 ring-[#E08E19] scale-110'
                                  : 'hover:scale-105'
                              }`}
                              style={{
                              background: !['#000000', '#0000ff', '#ff0000'].includes(sigColor)
                                  ? sigColor
                                  : 'conic-gradient(from 0deg, red, yellow, green, cyan, blue, magenta, red)'
                              }}
                              title="Custom Color Picker"
                          >
                              <input
                                  type="color"
                                  ref={customColorInputRef}
                                  value={['#000000', '#0000ff', '#ff0000'].includes(sigColor) ? '#000000' : sigColor}
                                  onChange={(e) => setSigColor(e.target.value)}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                              />
                              {!['#000000', '#0000ff', '#ff0000'].includes(sigColor) && (
                              <span className="w-1 h-1 bg-white rounded-full shadow-sm pointer-events-none" />
                              )}
                          </div>
                      </div>
                    </div>

                    {/* Width slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h5 className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Stroke Width</h5>
                        <span className="text-[10px] font-black text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded">{brushWidth}px</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="12"
                        value={brushWidth}
                        onChange={(e) => setBrushWidth(parseInt(e.target.value, 10))}
                        className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-[#E08E19]"
                      />
                    </div>

                    {/* Clear actions */}
                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={handleUndoDirectDraw}
                        disabled={!(drawHistory[activePage?.id] && drawHistory[activePage.id].length > 0)}
                        className="flex-1 py-2.5 bg-white hover:bg-stone-50 disabled:hover:bg-white text-stone-600 disabled:opacity-40 rounded-xl text-xs font-bold border border-stone-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                        title="Undo latest stroke (Ctrl+Z)"
                      >
                        <Undo className="w-4 h-4" /> Undo Stroke
                      </button>
                      <button
                        type="button"
                        onClick={clearDirectDraw}
                        className="flex-1 py-2.5 bg-white hover:bg-red-50 text-stone-600 hover:text-red-600 rounded-xl text-xs font-bold border border-stone-200 hover:border-red-200 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Eraser className="w-4 h-4" /> Clear Page
                      </button>
                    </div>
                    </div>
                )}
              </div>
                {pagesList.length > 0 && (
                <div className="w-full pt-2 border-t border-stone-100">
                    <button
                        onClick={exportPDF}
                        disabled={isExporting}
                        className="w-full px-6 py-2.5 bg-[#E08E19] hover:bg-[#C87C11] text-white rounded-xl text-sm font-bold shadow-md flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
                    >
                        {isExporting ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                        ) : (
                        <><Download className="w-4 h-4" />Export PDF</>
                        )}
                    </button>
                </div>
                )}
            </div>
          </div>
        )}

        {/* Export success card */}
        {exportComplete && exportUrl && exportFile && (
          <div className="mt-8 bg-green-50 border border-green-200 text-green-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
                <h4 className="font-bold text-lg text-green-950">PDF Render Successful!</h4>
              </div>

              <div className="flex gap-12 text-sm border-t border-green-200/50 pt-4">
                <FilePreview
                  file={exportFile}
                  previewUrl={null}
                />
                <div>
                  <span className="block text-xs text-green-700/70 font-bold uppercase tracking-wide">
                    File Name
                  </span>
                  <EditableFileName
                    fileName={exportFile.name}
                    onSave={(fileName) =>
                      setExportFile((currentFile) =>
                        new File([currentFile], fileName, {
                          type: currentFile.type,
                          lastModified: currentFile.lastModified,
                        })
                      )
                    }
                  />
                </div>

                <div>
                  <span className="block text-xs text-green-700/70 font-bold uppercase tracking-wide">
                    File Size
                  </span>
                  <span className="text-sm font-black text-green-950">
                    {(exportFile.size / 1024).toFixed(2)} KB
                  </span>
                </div>
              </div>
            </div>
            <a
              href={exportUrl}
              download={exportFile.name}
              className="px-6 py-4 bg-green-800 hover:bg-green-900 text-white rounded-xl font-bold text-sm shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all self-stretch md:self-auto text-center"
            >
              Download Edited PDF
            </a>
          </div>
        )}

      </main>
    </Layout>
  );
}
