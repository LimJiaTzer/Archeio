import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  LoaderCircle,
  Minus,
  Plus,
  ScanText,
  Upload,
  X,
} from 'lucide-react';
import * as docx from 'docx-preview';
import JSZip from 'jszip';
import Layout from '../components/Layout';
import FilePreview from '../components/FilePreview';
import { API_URL } from '../config/api';

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;

const isPdfFile = (file) => file?.type === 'application/pdf' || file?.name.toLowerCase().endsWith('.pdf');
const isSupportedSource = (file) => file?.type.startsWith('image/') || isPdfFile(file);
const clampZoom = (value) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
const documentNameFor = (file) => `${file.name.replace(/\.[^/.]+$/, '')}.docx`;

const downloadFile = (file) => {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export default function Ocr() {
  const [sourceItems, setSourceItems] = useState([]);
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [zoom, setZoom] = useState('fit');
  const [documentMetrics, setDocumentMetrics] = useState(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const previewRef = useRef(null);
  const previewViewportRef = useRef(null);
  const pinchStateRef = useRef(null);
  const liveScaleRef = useRef(1);
  const activeDocumentIdRef = useRef(null);

  const convertedItems = useMemo(
    () => sourceItems.filter((item) => item.documentFile),
    [sourceItems],
  );
  const activeItem = sourceItems.find((item) => item.id === activeDocumentId) || null;
  const documentFile = activeItem?.documentFile || null;
  const hasPendingItems = sourceItems.some((item) => !item.documentFile && item.status !== 'converting');

  useEffect(() => {
    if (!previewViewportRef.current) return undefined;

    const viewport = previewViewportRef.current;
    const updateViewportSize = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    const observer = new ResizeObserver(updateViewportSize);
    observer.observe(viewport);
    updateViewportSize();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewport = previewViewportRef.current;
    if (!viewport || !documentFile) return undefined;

    const touchDistance = (touches) => {
      const [first, second] = touches;
      return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
    };

    const handleWheel = (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setZoom(clampZoom(liveScaleRef.current - event.deltaY * 0.01));
    };

    const handleTouchStart = (event) => {
      if (event.touches.length !== 2) return;
      pinchStateRef.current = {
        startDistance: touchDistance(event.touches),
        startScale: liveScaleRef.current,
      };
    };

    const handleTouchMove = (event) => {
      if (event.touches.length !== 2 || !pinchStateRef.current) return;
      event.preventDefault();
      const { startDistance, startScale } = pinchStateRef.current;
      setZoom(clampZoom(startScale * (touchDistance(event.touches) / startDistance)));
    };

    const clearPinch = (event) => {
      if (event.touches.length < 2) pinchStateRef.current = null;
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    viewport.addEventListener('touchstart', handleTouchStart, { passive: false });
    viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
    viewport.addEventListener('touchend', clearPinch);
    viewport.addEventListener('touchcancel', clearPinch);
    return () => {
      viewport.removeEventListener('wheel', handleWheel);
      viewport.removeEventListener('touchstart', handleTouchStart);
      viewport.removeEventListener('touchmove', handleTouchMove);
      viewport.removeEventListener('touchend', clearPinch);
      viewport.removeEventListener('touchcancel', clearPinch);
    };
  }, [documentFile]);

  useEffect(() => {
    if (!documentFile || !previewRef.current) return undefined;

    let cancelled = false;
    const container = previewRef.current;
    container.replaceChildren();
    requestAnimationFrame(() => {
      if (cancelled) return;
      docx.renderAsync(documentFile, container)
        .catch((renderError) => {
          if (!cancelled) {
            console.error('DOCX preview failed:', renderError);
            setPreviewError('The document was generated, but the browser could not render its preview.');
          }
        })
        .finally(() => {
          if (cancelled) return;
          requestAnimationFrame(() => {
            if (!cancelled) {
              setDocumentMetrics({
                width: container.scrollWidth,
                height: container.scrollHeight,
              });
              setIsRendering(false);
            }
          });
        });
    });

    return () => {
      cancelled = true;
    };
  }, [documentFile]);

  const addSourceFiles = useCallback((files) => {
    const supported = Array.from(files || []).filter(isSupportedSource);
    if (!supported.length) return;

    setSourceItems((items) => {
      const existingKeys = new Set(items.map((item) => `${item.file.name}:${item.file.size}:${item.file.lastModified}`));
      const newItems = supported
        .filter((file) => !existingKeys.has(`${file.name}:${file.size}:${file.lastModified}`))
        .map((file) => ({
          id: crypto.randomUUID(),
          file,
          previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : '',
          status: 'idle',
          error: '',
          documentFile: null,
        }));
      return newItems.length ? [...items, ...newItems] : items;
    });
  }, []);

  useEffect(() => {
    const handlePaste = (event) => {
      const target = event.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const images = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith('image/'));
      if (!images.length) return;
      event.preventDefault();
      addSourceFiles(images);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [addSourceFiles]);

  const selectDocument = (id) => {
    activeDocumentIdRef.current = id;
    setActiveDocumentId(id);
    setDocumentMetrics(null);
    setZoom('fit');
    setPreviewError('');
    setIsRendering(Boolean(id));
  };

  const updateItem = (id, patch) => {
    setSourceItems((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeSourceItem = (id) => {
    if (activeDocumentIdRef.current === id) {
      const nextItem = sourceItems.find((item) => item.id !== id && item.documentFile);
      selectDocument(nextItem?.id || null);
    }
    setSourceItems((items) => {
      const item = items.find((entry) => entry.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return items.filter((entry) => entry.id !== id);
    });
  };

  const convertDocuments = async () => {
    const queuedItems = sourceItems.filter((item) => !item.documentFile && item.status !== 'converting');
    if (!queuedItems.length) return;

    setIsConverting(true);
    for (const item of queuedItems) {
      updateItem(item.id, { status: 'converting', error: '' });
      try {
        const formData = new FormData();
        formData.append('file', item.file, item.file.name);
        const response = await fetch(`${API_URL}/convert/image-to-docx`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || 'Document conversion failed.');
        }

        const blob = await response.blob();
        const file = new File([blob], documentNameFor(item.file), {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        updateItem(item.id, { status: 'completed', documentFile: file, error: '' });
        if (!activeDocumentIdRef.current) selectDocument(item.id);
      } catch (conversionError) {
        console.error('OCR conversion failed:', conversionError);
        updateItem(item.id, {
          status: 'failed',
          error: conversionError.message || 'Network error: failed to reach the OCR API.',
        });
      }
    }
    setIsConverting(false);
  };

  const downloadAllAsZip = async () => {
    if (!convertedItems.length) return;
    const zip = new JSZip();
    convertedItems.forEach((item) => zip.file(item.documentFile.name, item.documentFile));
    const archive = await zip.generateAsync({ type: 'blob' });
    downloadFile(new File([archive], 'archeio-ocr-documents.zip', { type: 'application/zip' }));
  };

  const fitScale = documentMetrics && viewportSize.width
    ? Math.min(1, Math.max((viewportSize.width - 48) / documentMetrics.width, 0.1))
    : 1;
  const effectiveScale = zoom === 'fit' ? fitScale : zoom;

  useEffect(() => {
    liveScaleRef.current = effectiveScale;
  }, [effectiveScale]);

  const scaledWidth = documentMetrics ? Math.ceil(documentMetrics.width * effectiveScale) : 0;
  const scaledHeight = documentMetrics ? Math.ceil(documentMetrics.height * effectiveScale) : 0;
  const stageWidth = Math.max(viewportSize.width, scaledWidth);
  const stageHeight = Math.max(viewportSize.height, scaledHeight);
  const offsetX = scaledWidth < viewportSize.width ? Math.floor((viewportSize.width - scaledWidth) / 2) : 0;
  const offsetY = scaledHeight < viewportSize.height ? Math.floor((viewportSize.height - scaledHeight) / 2) : 0;
  const zoomPercent = Math.round(effectiveScale * 100);
  const presetPercents = ZOOM_PRESETS.map((preset) => Math.round(preset * 100));

  const zoomOut = () => setZoom(clampZoom(effectiveScale - ZOOM_STEP));
  const zoomIn = () => setZoom(clampZoom(effectiveScale + ZOOM_STEP));
  const handleZoomSelect = (event) => {
    const { value } = event.target;
    setZoom(value === 'fit' ? 'fit' : clampZoom(Number(value) / 100));
  };

  return (
    <Layout>
      <main className="max-w-screen-xl mx-auto p-6 sm:p-12">
        <nav className="mb-6">
          <Link to="/" className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>
        </nav>

        <div className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold text-stone-900 mb-2">OCR &amp; Unlock</h1>
          <p className="text-stone-600">Turn images and PDFs into editable documents.</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-8 items-start">
          <div className="space-y-6">
            <aside className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="font-bold text-stone-900">Source Documents</h2>
                {sourceItems.length > 0 && <span className="text-xs font-semibold text-stone-500">{sourceItems.length}</span>}
              </div>

              <label
                className={`block border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors relative ${
                  isDragging ? 'border-orange-500 bg-orange-50' : 'border-stone-300 hover:border-orange-500'
                }`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  addSourceFiles(event.dataTransfer.files);
                }}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.pdf"
                  onChange={(event) => {
                    addSourceFiles(event.target.files);
                    event.target.value = '';
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-stone-700">Upload or paste images and PDFs</p>
                <p className="text-xs text-stone-500 mt-1">(PDFs up to 50 pages)</p>
              </label>

              {sourceItems.length > 0 && (
                <div className="mt-4 space-y-2 max-h-72 overflow-y-auto pr-1">
                  {sourceItems.map((item) => (
                    <div key={item.id} className="bg-stone-100 rounded-lg p-3 flex items-center gap-3 min-w-0">
                      <FilePreview file={item.file} previewUrl={item.previewUrl} size="sm" showInfo={false} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-stone-800 truncate" title={item.file.name}>{item.file.name}</p>
                        <p className={`text-xs mt-0.5 ${
                          item.status === 'failed' ? 'text-red-600' : item.status === 'completed' ? 'text-green-700' : 'text-stone-500'
                        }`}>
                          {item.status === 'converting' ? 'Converting...' : item.status === 'completed' ? 'Converted' : item.status === 'failed' ? item.error : `${(item.file.size / 1024 / 1024).toFixed(2)} MB`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSourceItem(item.id)}
                        className="w-7 h-7 shrink-0 inline-flex items-center justify-center rounded-md text-stone-400 hover:text-red-600 hover:bg-white"
                        aria-label={`Remove ${item.file.name}`}
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={convertDocuments}
                disabled={!hasPendingItems || isConverting}
                className={`w-full mt-5 p-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 ${
                  hasPendingItems && !isConverting
                    ? 'bg-orange-600 hover:bg-orange-700 text-white'
                    : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                }`}
              >
                {isConverting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />}
                {isConverting ? 'Converting documents...' : 'Convert documents'}
              </button>
            </aside>

            {convertedItems.length > 0 && (
              <section className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0" />
                    <h2 className="font-bold text-green-950 text-sm truncate">Converted documents</h2>
                  </div>
                  {convertedItems.length > 1 && (
                    <button
                      type="button"
                      onClick={downloadAllAsZip}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-green-800 hover:bg-green-900 text-white px-3 py-2 text-xs font-bold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      ZIP
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {convertedItems.map((item) => {
                    const isActive = item.id === activeDocumentId;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-2 rounded-lg border p-2 transition-colors ${
                          isActive ? 'bg-white border-green-500 ring-1 ring-green-300' : 'bg-white/70 border-green-200 hover:bg-white'
                        }`}
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => selectDocument(item.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              selectDocument(item.id);
                            }
                          }}
                          className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                          aria-label={`Preview ${item.documentFile.name}`}
                        >
                          <FilePreview file={item.documentFile} size="sm" showInfo={false} />
                          <span className="text-xs font-semibold text-green-950 truncate">{item.documentFile.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => downloadFile(item.documentFile)}
                          className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-md text-green-800 hover:bg-green-100"
                          aria-label={`Download ${item.documentFile.name}`}
                          title="Download document"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <section className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 min-w-0">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h2 className="font-bold text-stone-900">Document Preview</h2>
                {documentFile && <p className="text-xs text-stone-500 truncate mt-0.5">{documentFile.name}</p>}
              </div>
              {documentFile && (
                <div className="flex items-center gap-1 text-stone-600 shrink-0">
                  <button
                    type="button"
                    onClick={zoomOut}
                    disabled={effectiveScale <= MIN_ZOOM || isRendering}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-stone-100 disabled:text-stone-300"
                    aria-label="Zoom out"
                    title="Zoom out"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <select
                    value={zoom === 'fit' ? 'fit' : String(zoomPercent)}
                    onChange={handleZoomSelect}
                    disabled={isRendering}
                    className="text-xs font-semibold tabular-nums bg-transparent border border-stone-200 rounded-md py-1 pl-2 pr-1 cursor-pointer hover:border-stone-300 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:text-stone-300"
                    aria-label="Zoom level"
                    title="Zoom level"
                  >
                    <option value="fit">Fit width</option>
                    {zoom !== 'fit' && !presetPercents.includes(zoomPercent) && <option value={String(zoomPercent)}>{zoomPercent}%</option>}
                    {ZOOM_PRESETS.map((preset) => <option key={preset} value={String(Math.round(preset * 100))}>{Math.round(preset * 100)}%</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={zoomIn}
                    disabled={effectiveScale >= MAX_ZOOM || isRendering}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-stone-100 disabled:text-stone-300"
                    aria-label="Zoom in"
                    title="Zoom in"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <div
              ref={previewViewportRef}
              className={`relative h-[75vh] min-h-[420px] max-h-[820px] bg-stone-100 border border-stone-200 rounded-xl overflow-y-auto touch-manipulation ${
                scaledWidth > viewportSize.width ? 'overflow-x-auto' : 'overflow-x-hidden'
              }`}
            >
              {isRendering && (
                <div className="absolute inset-0 z-10 bg-white/80 flex flex-col items-center justify-center gap-3 text-stone-600">
                  <LoaderCircle className="w-8 h-8 text-orange-600 animate-spin" />
                  <span className="text-sm font-medium">Rendering document...</span>
                </div>
              )}
              {previewError ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-red-500">
                  <p className="font-bold text-sm mb-2">Preview Error</p>
                  <p className="text-xs text-stone-600 max-w-sm">{previewError}</p>
                </div>
              ) : !documentFile ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-500">
                  <FileText className="w-9 h-9 mb-3 text-stone-400" />
                  <p className="text-sm font-medium">Select a converted document to preview it here.</p>
                </div>
              ) : null}
              {documentFile && (
                <div className="relative" style={documentMetrics ? { width: stageWidth, height: stageHeight } : undefined}>
                  <div
                    ref={previewRef}
                    className="docx-preview-canvas"
                    style={documentMetrics ? {
                      position: 'absolute',
                      top: offsetY,
                      left: offsetX,
                      transform: `scale(${effectiveScale})`,
                      transformOrigin: 'top left',
                    } : undefined}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </Layout>
  );
}
