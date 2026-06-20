import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, Trash2, RotateCw, ArrowUp, ArrowDown,
  Plus, Download, Loader2, CheckCircle2, PenTool, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import Layout from '@/components/Layout';
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

  const containerRef = useRef(null);

  // Signature state
  const [placedSignatures,  setPlacedSignatures]  = useState({});
  const [savedSignature,    setSavedSignature]    = useState(null);
  const [sigColor,          setSigColor]          = useState('#000000');
  const sigCanvasRef = useRef(null);
  const [isDrawing,         setIsDrawing]         = useState(false);

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

  /** Delete a page by ID, adjusting the active index if needed. */
  const deletePage = (id) => {
    setPagesList(prev => {
      const filtered = prev.filter(p => p.id !== id);
      setPlacedSignatures(sigPrev => {
        const copy = { ...sigPrev };
        delete copy[id];
        return copy;
      });
      if (activePageIndex >= filtered.length) {
        setActivePageIndex(Math.max(0, filtered.length - 1));
      }
      return filtered;
    });
  };

  /**
   * Move a page up (direction=-1) or down (direction=+1).
   * Pure array swap — no re-rendering needed.
   */
  const movePage = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= pagesList.length) return;

    // Pre-compute new active index before touching state
    let newActive = activePageIndex;
    if (activePageIndex === index)  newActive = target;
    else if (activePageIndex === target) newActive = index;

    setPagesList(prev => {
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
    setActivePageIndex(newActive);
  };

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
    setSavedSignature(null);
  };

  const saveSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const blank = document.createElement('canvas');
    blank.width = canvas.width; blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      alert('Please draw your signature first.');
      return;
    }
    setSavedSignature(canvas.toDataURL());
  };

  // ─── 4. SIGNATURE OVERLAY ─────────────────────────────────────────────────
  const placeSignatureOnActivePage = () => {
    if (!savedSignature || !activePage) return;
    setPlacedSignatures(prev => ({
      ...prev,
      [activePage.id]: { img: savedSignature, x: 35, y: 45, width: 150, height: 60 }
    }));
  };

  const removePlacedSignature = (pageId) => {
    setPlacedSignatures(prev => {
      const copy = { ...prev };
      delete copy[pageId];
      return copy;
    });
  };

  const handleSigDragStart = (e) => {
    e.preventDefault();
    if (!activePage || !placedSignatures[activePage.id]) return;
    const sig       = placedSignatures[activePage.id];
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
      setPlacedSignatures(prev => ({
        ...prev,
        [activePage.id]: {
          ...prev[activePage.id],
          x: Math.max(0, Math.min(100 - wPct, startLeft + dx)),
          y: Math.max(0, Math.min(100 - hPct, startTop  + dy)),
        }
      }));
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
      setExportUrl(URL.createObjectURL(blob));
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
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <Layout>
      <main className="max-w-7xl mx-auto p-4 sm:p-8">

        {/* Nav & Actions */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          <Link to="/" className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>
          {pagesList.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-stone-200 hover:bg-red-500 hover:text-white rounded-xl text-sm font-bold text-stone-600 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={exportPDF}
                disabled={isExporting}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md flex items-center gap-2 active:scale-95 disabled:opacity-50 transition-all"
              >
                {isExporting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                  : <><Download className="w-4 h-4" />Export PDF</>}
              </button>
            </div>
          )}
        </div>

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
            <div className="bg-indigo-50 rounded-3xl w-16 h-16 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
              <Upload className="w-8 h-8 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-stone-800 mb-2">Upload your PDF</h3>
            <p className="text-stone-500 text-xs sm:text-sm leading-relaxed max-w-xs mx-auto">
              Select one or multiple files to begin. Merges happen instantly.
            </p>
          </div>

        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

            {/* ── COLUMN 1: Thumbnail Sidebar ───────────────────────────── */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 lg:col-span-3 flex flex-col max-h-[700px] overflow-hidden">
              <div className="flex items-center justify-between mb-4 border-b pb-2">
                <span className="font-bold text-stone-800 text-sm">
                  Page Thumbnails ({pagesList.length})
                </span>
                <div className="relative cursor-pointer bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg p-1.5 transition-colors">
                  <input
                    type="file"
                    accept="application/pdf"
                    multiple
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleFileAdd}
                  />
                  <Plus className="w-4 h-4" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {pagesList.map((pageItem, idx) => (
                  <div
                    key={pageItem.id}
                    onClick={() => setActivePageIndex(idx)}
                    className={`p-2 border rounded-xl cursor-pointer transition-all flex items-center gap-3 group relative ${
                      activePageIndex === idx
                        ? 'border-indigo-600 bg-indigo-50/40 shadow-sm'
                        : 'border-stone-100 hover:border-stone-300 bg-stone-50/50'
                    }`}
                  >
                    {/* Thumbnail image */}
                    <div className="w-14 h-16 bg-stone-100 border border-stone-200 overflow-hidden flex-shrink-0 flex items-center justify-center rounded">
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

                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-stone-800 truncate" title={pageItem.file.name}>
                        {pageItem.file.name}
                      </p>
                      <p className="text-[10px] text-stone-400 font-semibold mt-1">
                        Page {idx + 1}
                      </p>
                    </div>

                    {/* Move controls (visible on hover) */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); movePage(idx, -1); }}
                        disabled={idx === 0}
                        className="p-0.5 text-stone-400 hover:text-indigo-600 disabled:opacity-30"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); movePage(idx, 1); }}
                        disabled={idx === pagesList.length - 1}
                        className="p-0.5 text-stone-400 hover:text-indigo-600 disabled:opacity-30"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── COLUMN 2: Main Canvas ─────────────────────────────────── */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl lg:col-span-6 flex flex-col items-center justify-center p-6 min-h-[500px] max-h-[700px] overflow-hidden">

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

                {/* Placed signature overlay */}
                {activePage && placedSignatures[activePage.id] && (
                  <div
                    style={{
                      position:        'absolute',
                      left:            `${placedSignatures[activePage.id].x}%`,
                      top:             `${placedSignatures[activePage.id].y}%`,
                      width:           `${placedSignatures[activePage.id].width}px`,
                      height:          `${placedSignatures[activePage.id].height}px`,
                      border:          '1.5px dashed #4f46e5',
                      backgroundColor: 'rgba(79, 70, 229, 0.08)',
                      cursor:          'move',
                      display:         'flex',
                      alignItems:      'center',
                      justifyContent:  'center',
                    }}
                    onMouseDown={handleSigDragStart}
                    className="group"
                  >
                    <img
                      src={placedSignatures[activePage.id].img}
                      alt="signature overlay"
                      className="w-full h-full object-contain pointer-events-none"
                    />
                    <button
                      onClick={() => removePlacedSignature(activePage.id)}
                      className="absolute -top-2.5 -right-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── COLUMN 3: Right Tools Panel ───────────────────────────── */}
            <div className="bg-white rounded-2xl p-4 border border-stone-200 lg:col-span-3 flex flex-col max-h-[700px] overflow-y-auto">

              {/* Tool toggle */}
              <div className="flex gap-1 bg-stone-100 p-1 rounded-xl mb-6">
                {['organize', 'sign'].map(tool => (
                  <button
                    key={tool}
                    onClick={() => setActiveTool(tool)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                      activeTool === tool
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-stone-600 hover:bg-white/50'
                    }`}
                  >
                    {tool === 'organize' ? 'Organize' : 'Sign PDF'}
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
                      className="flex flex-col items-center justify-center p-3 border border-stone-200 hover:border-indigo-500 rounded-xl transition-all gap-2 group text-stone-700 disabled:opacity-50"
                    >
                      <RotateCw className="w-5 h-5 text-stone-400 group-hover:text-indigo-600 transition-colors" />
                      <span className="text-[10px] font-bold">Rotate 90°</span>
                    </button>
                    <button
                      onClick={() => deletePage(activePage.id)}
                      className="flex flex-col items-center justify-center p-3 border border-stone-200 hover:border-red-500 rounded-xl transition-all gap-2 group text-stone-700"
                    >
                      <Trash2 className="w-5 h-5 text-stone-400 group-hover:text-red-500 transition-colors" />
                      <span className="text-[10px] font-bold">Delete Page</span>
                    </button>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="text-xs font-black uppercase text-stone-400 tracking-wider mb-3">Arrangement</h4>
                    <div className="flex gap-2">
                      <button
                        onClick={() => movePage(activePageIndex, -1)}
                        disabled={activePageIndex === 0}
                        className="flex-1 py-2 border rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-stone-50 disabled:opacity-40"
                      >
                        <ArrowUp className="w-3.5 h-3.5" /> Move Up
                      </button>
                      <button
                        onClick={() => movePage(activePageIndex, 1)}
                        disabled={activePageIndex === pagesList.length - 1}
                        className="flex-1 py-2 border rounded-lg text-xs font-bold flex items-center justify-center gap-1 hover:bg-stone-50 disabled:opacity-40"
                      >
                        <ArrowDown className="w-3.5 h-3.5" /> Move Down
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SIGN */}
              {activeTool === 'sign' && (
                <div className="space-y-6 flex-1 flex flex-col">
                  <div>
                    <h4 className="text-xs font-black uppercase text-stone-400 tracking-wider mb-2">Draw Signature</h4>
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
                      <div className="flex gap-1.5">
                        {['#000000', '#0000ff', '#ff0000'].map(color => (
                          <button
                            key={color}
                            onClick={() => setSigColor(color)}
                            className={`w-4 h-4 rounded-full border ${sigColor === color ? 'ring-2 ring-indigo-500 scale-110' : ''}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <button onClick={clearCanvas} className="text-[10px] font-bold text-stone-500 hover:text-stone-800">
                        Clear
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={saveSignature}
                    className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Save &amp; Preview Signature
                  </button>

                  {savedSignature && (
                    <div className="border-t pt-4 space-y-3">
                      <h5 className="text-[10px] font-black uppercase text-stone-400">Captured Signature</h5>
                      <div className="border border-indigo-100 bg-indigo-50/10 rounded-xl p-3 flex items-center justify-center max-h-[80px] overflow-hidden">
                        <img src={savedSignature} alt="saved signature" className="max-h-[60px] object-contain" />
                      </div>
                      <button
                        onClick={placeSignatureOnActivePage}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                      >
                        <PenTool className="w-3.5 h-3.5" /> Place on Active Page
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Export success card */}
        {exportComplete && exportUrl && (
          <div className="mt-8 bg-indigo-50 border border-indigo-200 text-indigo-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                <h4 className="font-bold text-lg text-indigo-950">PDF Render Successful!</h4>
              </div>
              <p className="text-xs text-stone-500 font-semibold leading-relaxed">
                All page rotations, merges, and signature layers have been baked into a clean PDF locally.
              </p>
            </div>
            <a
              href={exportUrl}
              download="archeio_edited.pdf"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all self-stretch md:self-auto text-center"
            >
              Download Edited PDF
            </a>
          </div>
        )}

      </main>
    </Layout>
  );
}