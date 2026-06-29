import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Upload, 
  CheckCircle2, 
  X, 
  ChevronDown,
  AlertCircle,
  Loader2,
  RefreshCcw,
  Archive,
  Images,
  Download
} from 'lucide-react';
import { getFileInfo } from '../lib/fileTypes';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { convertMedia, extractFrames, zipBlobs } from '../services/conversionService';
import Layout from '../components/Layout';
import FrameSelector from '../components/FrameSelector';
import FilePreview from '../components/FilePreview';
import JSZip from 'jszip';

export default function Convert() {
  const [items, setItems] = useState([]);
  const [globalFormat, setGlobalFormat] = useState('');
  const [isConvertingAll, setIsConvertingAll] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const itemsRef = useRef([]);
  
  // Persist FFmpeg instance
  const ffmpegRef = useRef(new FFmpeg());

    // Handle global paste event (Ctrl+V or Cmd+V)
  useEffect(() => {
    const handlePaste = (e) => {
      // Prevent pasting inside text fields or textareas if you have them elsewhere
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault();
        processFiles(e.clipboardData.files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, []); // Empty dependency array keeps it active for the component's lifetime

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      itemsRef.current.forEach(item => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const createItem = (file) => {
    const info = getFileInfo(file.type);
    let availableFormats = [];
    let targetFormat = '';

    if (info && info.outputFormats && info.outputFormats.length > 0) {
      availableFormats = info.outputFormats.filter(f => f !== info.format);
      if (availableFormats.length === 0) availableFormats = info.outputFormats;
      targetFormat = availableFormats[0];
    }

    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;

    return {
      id: Math.random().toString(36).substring(2, 11),
      file,
      targetFormat,
      availableFormats,
      status: 'idle',
      result: null,
      error: null,
      previewUrl,
      // For GIF/ICO extraction
      frames: [],
      selectedFrames: [],
      showSelector: false,
      extracting: false
    };
  };

  const processFiles = (files) => {
    const newItems = Array.from(files).map(createItem);
    setItems(prev => [...prev, ...newItems]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
      e.target.value = null;
    }
  };

  const removeItem = (id) => {
    setItems(prev => prev.filter(item => {
      if (item.id === id) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return false;
      }
      return true;
    }));
  };

  const updateItem = (id, updates) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleFormatChange = (id, format) => {
    updateItem(id, { targetFormat: format, result: null, status: 'idle' });
  };

  const handleGlobalFormatChange = (format) => {
    setGlobalFormat(format);
    setItems(prev => prev.map(item => {
      if (item.availableFormats.includes(format)) {
        return { ...item, targetFormat: format, result: null, status: 'idle' };
      }
      return item;
    }));
  };

  const handleToggleSelector = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    if (item.showSelector) {
      updateItem(id, { showSelector: false });
      return;
    }

    if (item.frames.length === 0) {
      updateItem(id, { extracting: true });
      try {
        const extracted = await extractFrames(item.file);
        updateItem(id, { frames: extracted, showSelector: true, extracting: false });
      } catch (err) {
        console.error("Failed to extract frames:", err);
        updateItem(id, { extracting: false });
        alert("Failed to read frames from file.");
      }
    } else {
      updateItem(id, { showSelector: true });
    }
  };

  const handleToggleFrame = (id, frameIndex) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const selectedFrames = item.selectedFrames.includes(frameIndex)
          ? item.selectedFrames.filter(i => i !== frameIndex)
          : [...item.selectedFrames, frameIndex];
        return { ...item, selectedFrames, result: null, status: 'idle' };
      }
      return item;
    }));
  };

  const handleSelectAllFrames = (id) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, selectedFrames: item.frames.map((_, i) => i), result: null, status: 'idle' };
      }
      return item;
    }));
  };

  const handleDeselectAllFrames = (id) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, selectedFrames: [], result: null, status: 'idle' };
      }
      return item;
    }));
  };

  const convertItem = async (id) => {
    const item = items.find(i => i.id === id);
    if (!item || item.status === 'converting') return;

    updateItem(id, { status: 'converting', result: null, error: null });

    try {
      let result;
      if (item.selectedFrames.length > 1) {
        const blobsToZip = item.selectedFrames.map(i => item.frames[i]);
        const baseName = item.file.name.substring(0, item.file.name.lastIndexOf('.')) || item.file.name;
        result = await zipBlobs(blobsToZip, baseName, item.targetFormat);
      } else if (item.selectedFrames.length === 1) {
        const frameBlob = item.frames[item.selectedFrames[0]];
        const baseName = item.file.name.substring(0, item.file.name.lastIndexOf('.')) || item.file.name;
        const virtualFile = new File([frameBlob], `${baseName}_frame_${item.selectedFrames[0] + 1}.png`, { type: 'image/png' });
        result = await convertMedia(virtualFile, item.targetFormat, ffmpegRef);
      } else {
        result = await convertMedia(item.file, item.targetFormat, ffmpegRef);
      }
      
      updateItem(id, { status: 'completed', result });
    } catch (err) {
      console.error(`Conversion failed for ${item.file.name}:`, err);
      updateItem(id, { status: 'error', error: err.message || 'Conversion failed' });
    }
  };

  const startConversionAll = async () => {
    const convertibleItems = items.filter(i => i.status !== 'converting');
    if (convertibleItems.length === 0) return;

    setIsConvertingAll(true);
    
    // We can run these sequentially to avoid overloading the browser/FFmpeg
    for (const item of convertibleItems) {
      await convertItem(item.id);
    }

    setIsConvertingAll(false);
  };

  const handleDownloadAll = async () => {
    if (completedItems.length === 0) return;

    setIsDownloadingAll(true);
    try {
      const zip = new JSZip();
      
      for (const item of completedItems) {
        const response = await fetch(item.result.downloadUrl);
        const blob = await response.blob();
        zip.file(item.result.convertedFileName, blob);
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `archeio_converted_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to generate ZIP:", err);
      alert("Failed to bundle files. You can still download them individually.");
    } finally {
      setIsDownloadingAll(false);
    }
  };

  const handleReset = () => {
    items.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setItems([]);
    setGlobalFormat('');
  };

  // Get common formats for the "Convert All" dropdown
  const allAvailableFormats = useMemo(() => {
    if (items.length === 0) return [];
    // Start with formats of the first item
    let common = [...items[0].availableFormats];
    // Intersect with others
    for (let i = 1; i < items.length; i++) {
      common = common.filter(f => items[i].availableFormats.includes(f));
    }
    
    // If no common formats, just show all unique formats from all items?
    // Or just show nothing. Let's show unique union but maybe marked as "Partial"
    const union = Array.from(new Set(items.flatMap(i => i.availableFormats)));
    return union;
  }, [items]);

  const completedItems = useMemo(() => {
    return items.filter(item => item.status === 'completed' && item.result && item.result.downloadUrl);
  }, [items]);

  const hasCompleted = completedItems.length > 0;
  const singleResult = completedItems.length === 1;

  const formatSize = (bytes) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return '0.00 KB';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(2)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <Layout>
      <main className="max-w-4xl mx-auto p-6 sm:p-12">
        <nav className="mb-6">
          <Link to="/" className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>
        </nav>
        
        <div className="text-center mb-12">
          <h1 className="text-5xl font-black text-stone-900 mb-4 tracking-tight">File Converter</h1>
          <p className="text-xl text-stone-600">Easily convert files from one format to another, online.</p>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden">
          {/* Header Action Bar */}
          {items.length > 0 && (
            <div className="p-4 border-b border-stone-100 flex items-center justify-end gap-3 bg-stone-50/50">
              <button 
                onClick={handleReset}
                className="flex items-center gap-2 bg-stone-100 text-stone-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition-colors"
                title="Convert More (Reset)"
              >
                <RefreshCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          )}

          {/* Dropzone Area */}
          <div 
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`text-center cursor-pointer hover:bg-stone-50 transition-all group relative border-b border-stone-100 ${
              items.length === 0 ? 'p-20' : 'p-8'
            }`}
          >
            <input 
              type="file" 
              multiple
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
              onChange={handleFileChange} 
            />
            
            <div className={`bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform ${
              items.length === 0 ? 'w-20 h-20' : 'w-12 h-12'
            }`}>
              <Upload className={`${items.length === 0 ? 'w-10 h-10' : 'w-6 h-6'} text-amber-700`} />
            </div>
            
            {items.length === 0 ? (
              <>
                <h3 className="text-xl font-bold text-stone-800 mb-2">Select files to convert</h3>
                <p className="text-stone-500 max-w-sm mx-auto leading-relaxed">
                  Drag, drop or paste any file here, or click to browse. <br />
                  Supports Images, Documents, Audio, and Video.
                </p>
              </>
            ) : (
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-stone-800">Add more files</h3>
                <p className="text-xs text-stone-400 font-medium uppercase tracking-wider">Drag & Drop or Click</p>
              </div>
            )}
          </div>

          {/* File List */}
          {items.length > 0 && (
            <div className="divide-y divide-stone-100">
              {items.map((item) => ( 
                <div key={item.id} className="p-1">
                  <div className="p-4 flex flex-wrap sm:flex-nowrap items-center gap-4 hover:bg-stone-50/50 transition-colors rounded-2xl">
                    <FilePreview file={item.file} previewUrl={item.previewUrl} className="flex-1 min-w-[180px]" />

                    <div className="ml-auto flex items-center gap-4 justify-end shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-stone-400 uppercase tracking-tight">Output:</span>
                        <div className="relative">
                          <select 
                            value={item.targetFormat}
                            onChange={(e) => handleFormatChange(item.id, e.target.value)}
                            disabled={item.status === 'converting'}
                            className="appearance-none bg-white border border-amber-200 rounded-lg pl-3 pr-8 py-1.5 text-amber-700 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 disabled:opacity-50 cursor-pointer min-w-[80px]"
                          >
                            {item.availableFormats.length > 0 ? (
                              item.availableFormats.map((fmt) => (
                                <option key={fmt} value={fmt}>{fmt}</option>
                              ))
                            ) : (
                              <option value="">N/A</option>
                            )}
                          </select>
                          <ChevronDown className="w-4 h-4 text-amber-700 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Settings Button (for GIF/ICO) */}
                        {(item.file.type === 'image/gif' || item.file.type === 'image/x-icon' || item.file.type === 'image/vnd.microsoft.icon') && (
                          <button 
                            onClick={() => handleToggleSelector(item.id)}
                            className={`p-2 rounded-lg transition-colors ${item.showSelector ? 'bg-amber-100 text-amber-700' : 'text-stone-400 hover:bg-stone-100'}`}
                            title="Frame Selection"
                          >
                            <Images className={`w-5 h-5 ${item.extracting ? 'animate-spin' : ''}`} />
                          </button>
                        )}

                        <button 
                          onClick={() => removeItem(item.id)}
                          className="p-2 text-stone-400 hover:text-red-500 transition-colors ml-1"
                          title="Remove"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Per-item Status & Progress */}
                  {item.status === 'converting' && (
                    <div className="px-4 pb-4">
                      <div className="h-1 w-full bg-stone-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 animate-progress"></div>
                      </div>
                    </div>
                  )}

                  {item.status === 'error' && (
                    <div className="px-4 pb-4 flex items-center gap-2 text-xs font-bold text-red-500">
                      <AlertCircle className="w-4 h-4" />
                      <span>{item.error}</span>
                    </div>
                  )}

                  {/* Per-item Frame Selector */}
                  {item.showSelector && (
                    <div className="px-4 pb-6">
                      <FrameSelector 
                        frames={item.frames}
                        selectedFrames={item.selectedFrames}
                        onToggleFrame={(index) => handleToggleFrame(item.id, index)}
                        onSelectAll={() => handleSelectAllFrames(item.id)}
                        onDeselectAll={() => handleDeselectAllFrames(item.id)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Batch Action Bar (Bottom) */}
          {items.length > 0 && (
            <div className="bg-stone-50 p-4 border-t border-stone-100 flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-stone-600">
                  Convert All({items.length}) to:
                </span>
                <div className="relative">
                  <select 
                    value={globalFormat}
                    onChange={(e) => handleGlobalFormatChange(e.target.value)}
                    className="appearance-none bg-white border border-amber-200 rounded-xl pl-4 pr-10 py-2 text-amber-700 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500 cursor-pointer shadow-sm"
                  >
                    <option value="" disabled>Select</option>
                    {allAvailableFormats.map((fmt) => (
                      <option key={fmt} value={fmt}>{fmt}</option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={startConversionAll}
                  disabled={isConvertingAll}
                  className="px-8 py-3 bg-amber-400 text-stone-950 rounded-xl font-bold text-sm hover:bg-amber-500 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center gap-2"
                >
                  {isConvertingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      {hasCompleted ? 'Convert Again' : 'Convert'}
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global Progress Indicator */}
        {isConvertingAll && (
          <div className="mt-8 bg-amber-50 border border-amber-100 text-amber-800 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-bold">Processing your files batch... This may take a moment depending on file sizes.</span>
          </div>
        )}

        {/* Showing result of conversion (Output Cards) */}
        {hasCompleted && (
          <div className="mt-8 bg-green-50 border border-green-200 text-green-800 p-6 rounded-2xl">
            {singleResult ? (
              (() => {
                const item = completedItems[0];
                const isImg = ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG', 'ICO', 'HEIC'].includes(item.targetFormat.toUpperCase());
                return (
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                        <h4 className="font-bold text-lg text-green-950">
                          Conversion Complete! File ready
                        </h4>
                      </div>

                      <div className="flex gap-12 text-sm border-t border-green-200/50 pt-4">
                        <FilePreview
                          file={{
                            name: item.result.convertedFileName,
                            type: isImg ? 'image/jpeg' : (item.targetFormat.toLowerCase() === 'pdf' ? 'application/pdf' : '')
                          }}
                          previewUrl={isImg ? item.result.downloadUrl : null}
                          showInfo={false}
                        />
                        <div>
                          <span className="block text-xs text-green-700/70 font-bold uppercase tracking-wide">
                            Original File
                          </span>
                          <span className="text-sm font-black text-green-950 truncate max-w-[200px] block" title={item.file.name}>
                            {item.file.name}
                          </span>
                          <span className="text-xs text-stone-500 font-bold">
                            {formatSize(item.file.size)}
                          </span>
                        </div>

                        <div>
                          <span className="block text-xs text-green-700/70 font-bold uppercase tracking-wide">
                            Converted File
                          </span>
                          <span className="text-sm font-black text-green-950 truncate max-w-[200px] block" title={item.result.convertedFileName}>
                            {item.result.convertedFileName}
                          </span>
                          <span className="text-xs text-stone-500 font-bold">
                            {formatSize(item.result.size)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-auto">
                      <a
                        href={item.result.downloadUrl}
                        download={item.result.convertedFileName}
                        className="inline-flex items-center gap-2 justify-center bg-green-800 hover:bg-green-900 text-white px-6 py-4 rounded-xl font-bold text-center shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        Download <Download />
                      </a>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600" />
                    <h4 className="font-bold text-lg text-green-950">
                      Conversion Complete! {completedItems.length} files ready
                    </h4>
                  </div>

                  <button
                    onClick={handleDownloadAll}
                    disabled={isDownloadingAll}
                    className="bg-green-800 hover:bg-green-900 text-white px-6 py-4 rounded-xl font-bold text-center shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                  >
                    {isDownloadingAll ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Archive className="w-4 h-4" />
                    )}
                    Download All (ZIP)
                  </button>
                </div>

                <div className="space-y-3">
                  {completedItems.map((item) => {
                    const isImg = ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG', 'ICO', 'HEIC'].includes(item.targetFormat.toUpperCase());
                    return (
                      <div
                        key={item.id}
                        className="bg-white border border-green-100 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-green-950 text-sm truncate max-w-md" title={item.result.convertedFileName}>
                            {item.result.convertedFileName}
                          </p>

                          <div className="flex gap-8 text-sm mt-3">
                            <FilePreview
                              file={{
                                name: item.result.convertedFileName,
                                type: isImg ? 'image/jpeg' : (item.targetFormat.toLowerCase() === 'pdf' ? 'application/pdf' : '')
                              }}
                              previewUrl={isImg ? item.result.downloadUrl : null}
                              showInfo={false}
                            />
                            <div>
                              <span className="block text-xs text-green-700/70 font-bold uppercase">
                                Initial File Size
                              </span>
                              <span className="font-black text-green-950">
                                {formatSize(item.file.size)}
                              </span>
                            </div>

                            <div>
                              <span className="block text-xs text-green-700/70 font-bold uppercase">
                                New File Size
                              </span>
                              <span className="font-black text-green-950">
                                {formatSize(item.result.size)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <a
                          href={item.result.downloadUrl}
                          download={item.result.convertedFileName}
                          className="inline-flex items-center gap-1 justify-center bg-green-800 hover:bg-green-900 text-white px-4 py-2 rounded-xl font-bold text-center self-stretch md:self-center hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                          Download <Download className="w-3.5 h-3.5"/>
                        </a>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
        .animate-progress {
          animation: progress 2s ease-in-out infinite;
        }
      ` }} />
    </Layout>
  );
}
