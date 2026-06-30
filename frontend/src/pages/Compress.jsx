import React, { useState, useEffect, useRef } from 'react';   // useState helps track variables 
import { Link } from 'react-router-dom';
import { ArrowLeft, Archive, Sliders, CheckCircle2, ChevronDown } from 'lucide-react'; // icons, can change them 
import { getFileInfo } from '../lib/fileTypes'; // file types
import { compressDocument, compressImage, compressAudio, compressVideo } from '../services/compressService';
import JSZip from 'jszip';
import Layout from '../components/Layout';
import FilePreview from '../components/FilePreviewAltered';
import ImageCompressionDetails from '../components/dropdownPreview/ImageCompressionDropdown';

const getImageDimensions = (file) => { // for image resizing 
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });

      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image dimensions'));
    };

    img.src = url;
  });
};

const getVideoDimensions = () => {
  return null;
}

export default function Compress() {
  // input & output file(s) state
  const [fileItems, setFileItems] = useState([]); // id, file, fileInfo, format, result, downloadURL, compressedFileName, warning, status

  // compression process state 
  const [ratio, setRatio] = useState(75);
  const [compressing, setCompressing] = useState(false);
  const [warning, setWarning] = useState('');
  const [openSettings, setOpenSettings] = useState({});


  const handleUnsupportedCompression = (msg) => {
    setCompressing(false);
    alert(msg);
  }

  const toggleImageSettings = (id) => {
    setOpenSettings((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const fileItemsRef = useRef([]);

  useEffect(() => {
    fileItemsRef.current = fileItems;
  }, [fileItems]);

  // Handle global paste event (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e) => {
      // Ignore if user is currently inside an input/textarea
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault();
        // Route the clipboard files directly to your processing pipeline
        processUploadedFiles(Array.from(e.clipboardData.files));
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  // images' own slider takes precedence over global slider 
  const getEffectiveRatio = (item) => {
    return item.useCustomSettings && item.customRatio !== null
      ? item.customRatio
      : ratio;
  };

  // Shared processing function for both input uploading and clipboard pasting
  const processUploadedFiles = async (uploadedFiles) => {
    const newFileItems = await Promise.all(
      uploadedFiles.map(async (uploadedFile) => {
        const detFileInfo = getFileInfo(uploadedFile.type);

        if (!detFileInfo) {
          alert(`${uploadedFile.name} is not supported`);
          return null;
        }

        const dimensions =
          detFileInfo.category === 'images'
            ? await getImageDimensions(uploadedFile).catch(() => null)
            : null;

        const previewUrl = uploadedFile.type.startsWith('image/')
          ? URL.createObjectURL(uploadedFile)
          : null;

        return {
          id: crypto.randomUUID(),
          file: uploadedFile,
          fileInfo: {
            ...detFileInfo,
            width: dimensions?.width ?? null,
            height: dimensions?.height ?? null,
          },
          format: detFileInfo.format,
          previewUrl,

          result: null,
          downloadUrl: '',
          compressedFileName: '',
          status: 'idle',

          useCustomSettings: false,
          customRatio: null,

          resizeEnabled: false,
          maxWidth: dimensions?.width ?? '',
          maxHeight: dimensions?.height ?? '',
          maintainAspectRatio: true,

          compressedPreviewUrl: '',
          estimatedSize: null,
          previewWidth: null,
          previewHeight: null,
          previewLoading: false,
        };
      })
    );

    setFileItems((prev) => [...prev, ...newFileItems.filter(Boolean)]);
  };

  const updateFileCompressionSettings = (id, patch) => {
    updateFileItem(id, {
      ...patch,
      result: null,
      downloadUrl: '',
      compressedFileName: '',
      status: 'idle',
    });
  };

  // Modified file input element handler
  const handleFileUpload = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const uploadedFiles = Array.from(e.target.files);
      processUploadedFiles(uploadedFiles);
      e.target.value = null; // Clear input buffer
    }
  };


// Helper fns 
  const updateFileItem = (id, patch) => {
    setFileItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...patch } : item
      )
    );
  };

  const removeFileItem = (id) => {
    setFileItems((prev) =>
      prev.filter((item) => {
        if (item.id === id) {
          if (item.previewUrl) {
            URL.revokeObjectURL(item.previewUrl);
          }

          if (item.compressedPreviewUrl) {
            URL.revokeObjectURL(item.compressedPreviewUrl);
          }

          if (item.downloadUrl) {
            URL.revokeObjectURL(item.downloadUrl);
          }

          return false;
        }

        return true;
      })
    );
  };

  const handleReset = () => {
    fileItems.forEach((item) => {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }

      if (item.compressedPreviewUrl) {
        URL.revokeObjectURL(item.compressedPreviewUrl);
      }

      if (item.downloadUrl) {
        URL.revokeObjectURL(item.downloadUrl);
      }
    });

    setFileItems([]);
  };

  // clean up when compress page is closed 
  useEffect(() => {
    return () => {
      fileItemsRef.current.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }

        if (item.compressedPreviewUrl) {
          URL.revokeObjectURL(item.compressedPreviewUrl);
        }

        if (item.downloadUrl) {
          URL.revokeObjectURL(item.downloadUrl);
        }
      });
    };
  }, []);

  // Compression (Ive got a feeling this doesnt follow Tell Don't Ask Principle)
  const startCompression = async () => {
    if (fileItems.length === 0) return;

    setCompressing(true);
    setWarning('');

    for (const item of fileItems) {
      updateFileItem(item.id, {
        status: 'compressing',
        result: null,
        downloadUrl: '',
        compressedFileName: '',
      });

      const effectiveRatio = getEffectiveRatio(item);
      const sharedArgs = {
        file: item.file,
        ratio: effectiveRatio,
        format: item.format,
        fileInfo: item.fileInfo,

        resizeEnabled: item.resizeEnabled,
        maxWidth: item.maxWidth ? Number(item.maxWidth) : null,
        maxHeight: item.maxHeight ? Number(item.maxHeight) : null,
        maintainAspectRatio: item.maintainAspectRatio,

        setDownloadUrl: (url) => {
          updateFileItem(item.id, { downloadUrl: url });
        },

        setCompressedFileName: (name) => {
          updateFileItem(item.id, { compressedFileName: name });
        },

        setResult: (result) => {
          updateFileItem(item.id, { result });
        },

        setWarning: (warningMsg) => {
          if (warningMsg) {
            setWarning(warningMsg);
          }
        },

        // prevent each individual file from turning off the global loading state
        setCompressing: () => {},
      };

      switch (item.fileInfo.category) {
        case 'documents':
          await compressDocument(sharedArgs);
          break;

        case 'images':
          await new Promise((resolve) => {
            compressImage({
              ...sharedArgs,

              // compressImage is not truly async, so manually resolve when it finishes
              setCompressing: () => {
                resolve();
              },
            });
          });
          break;

        case 'audio':
          await compressAudio(sharedArgs);
          break;

        case 'video':
          await compressVideo(sharedArgs);
          break;

        default:
          alert(`${item.file.name} is not supported`);
          updateFileItem(item.id, { status: 'error' });
          continue;
      }

      updateFileItem(item.id, { status: 'done' });
    }

    setCompressing(false);
  };


  const completedItems = fileItems.filter(
    (item) => item.result && item.downloadUrl
  );

  const multipleUploads = fileItems.length > 1;
  const singleUpload = fileItems.length === 1;
  const hasUpload = fileItems.length > 0;
  const multipleResults = completedItems.length > 1;
  const singleResult = completedItems.length === 1;
  const hasResult = completedItems.length > 0;

  const handleDownloadAll = async () => { // Just for zipping 
    if (completedItems.length === 0) return;

    const zip = new JSZip();

    for (const item of completedItems) {
      const response = await fetch(item.downloadUrl);
      const blob = await response.blob();

      zip.file(item.compressedFileName || item.file.name, blob);
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);

    const link = document.createElement('a');
    link.href = zipUrl;
    link.download = 'compressed_files.zip';
    link.click();

    URL.revokeObjectURL(zipUrl);
  };


  const hasManipulatableFile = fileItems.some(
    (item) => item.fileInfo?.canCrop || item.fileInfo?.canResize
  );  

  return (
    <Layout>
      <main className="max-w-4xl mx-auto p-6 sm:p-12">
        <nav className="mb-6">
          <Link to="/" className="flex items-center gap-2 text-stone-600 hover:text-stone-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>
        </nav>
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-stone-900 mb-2">Compress Files</h1>
          <p className="text-stone-600">Shrink high-density file sizes while maintaining immaculate graphic fidelity.</p>
        </div>

        {/* Upload / drop box */}
        {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-stone-200"> */}
        <div className="grid grid-cols-1 md:grid-cols-[2.2fr_0.8fr] gap-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
            <div className="border-2 border-dashed border-stone-300 rounded-xl p-12 text-center hover:border-orange-500 transition-colors cursor-pointer relative">
              <input 
                type="file" 
                multiple
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              />
              <Archive className="w-12 h-12 text-stone-400 mx-auto mb-4" />
              <p className="font-medium text-stone-700">Drag, drop or paste original document here</p>
              <p className="text-xs text-stone-500 mt-1">Supports PDF, JPG, PNG, DOCX, ZIP (Max 100MB)</p>
            </div>

            {/* {file && (
              <div className="mt-6 p-4 bg-stone-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-semibold text-stone-800 text-sm truncate max-w-xs">{file.name}</p>
                  <p className="text-xs text-stone-500">Original Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button 
                  onClick={handleReset}
                  className="text-stone-400 hover:text-stone-600 text-xs font-semibold"
                >
                  Remove
                </button>
              </div>
            )} */}
            {/* Display uploaded files */}
            {hasUpload && (
              <div className="mt-6 space-y-3">
                {fileItems.map((item) => {
                  const isImage = item.fileInfo.category === 'images';
                  const isOpen = openSettings[item.id];

                  return (
                    <div key={item.id} className="rounded-xl overflow-hidden">
                      <div className="p-4 bg-stone-100 rounded-xl flex items-center justify-between gap-4">
                        <FilePreview file={item.file} previewUrl={item.previewUrl} />

                        <div className="min-w-0 flex-1">
                          <p
                            title={item.file.name}
                            className="font-semibold text-stone-800 text-sm truncate"
                          >
                            {item.file.name}
                          </p>

                          <p className="text-xs text-stone-500">
                            Original Size: {(item.file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          {item.fileInfo.outputFormats.length > 0 && (
                            <>
                              <span className="text-stone-400 text-xs font-semibold uppercase tracking-wide">
                                Output:
                              </span>

                              <select
                                value={item.format}
                                onChange={(e) =>
                                  updateFileCompressionSettings(item.id, {
                                    format: e.target.value,
                                  })
                                }
                                className="w-16 bg-white border border-stone-200 rounded-lg p-2 text-stone-800 font-medium"
                              >
                                {item.fileInfo.outputFormats.map((fmt) => (
                                  <option key={fmt} value={fmt}>
                                    {fmt}
                                  </option>
                                ))}
                              </select>
                            </>
                          )}

                          {isImage && (
                            <button
                              type="button"
                              onClick={() => toggleImageSettings(item.id)}
                              className="text-stone-400 hover:text-orange-600 transition-colors"
                              aria-label="Toggle image compression settings"
                            >
                              <ChevronDown
                                className={`w-5 h-5 transition-transform ${
                                  isOpen ? 'rotate-180' : ''
                                }`}
                              />
                            </button>
                          )}

                          <button
                            onClick={() => removeFileItem(item.id)}
                            className="text-stone-400 hover:text-stone-600 text-xs font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* EXTRA IMAGE DROPDOWN DETAILS */}
                      {isImage && isOpen && (
                        <div className="mt-3">
                          <ImageCompressionDetails
                            item={item}
                            effectiveRatio={getEffectiveRatio(item)}
                            updateFileItem={updateFileCompressionSettings}
                            updatePreviewItem={updateFileItem}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div> 
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4 text-stone-900">
                <Sliders className="w-5 h-5 text-orange-600" />
                <h6 className="font-bold">Compression Level</h6>
              </div>
              
              <div className="mt-4">
                <div className="flex justify-between text-xs font-semibold text-stone-500 mb-2">
                  <span>Min</span>
                  <span className="text-orange-600 font-bold">{ratio}% Smaller</span>
                  <span>Max</span>
                </div>
                <input 
                  type="range" 
                  min="20" 
                  max="90" 
                  value={ratio} 
                  onChange={(e) => {
                    const newRatio = Number(e.target.value);
                    setRatio(newRatio);

                    setFileItems((prev) =>
                      prev.map((item) => {
                        if (item.useCustomSettings) return item;

                        return {
                          ...item,
                          result: null,
                          downloadUrl: '',
                          compressedFileName: '',
                          status: 'idle',
                        };
                      })
                    );
                  }}
                  className="w-full accent-orange-600 cursor-pointer bg-stone-200 rounded-lg appearance-none h-2"
                />
                <div className="mt-1 flex justify-between text-xs text-stone-500">
                  <span>↑ quality</span>
                  <span>↓ size</span>
                </div>
              </div>
            </div>

            
            {/* Link to Zip Compression */}
            {multipleUploads && (
              <Link
                to="/zip-compression"
                className="block mt-4 text-sm font-semibold text-orange-600 hover:text-orange-700"
              >
                Zip compression
              </Link>
            )}

            {/* Link to Manipulation */}
            {hasManipulatableFile && (
                <Link
                  to="/manipulation"
                  className="block mt-4 text-sm font-semibold text-orange-600 hover:text-orange-700"
                >
                  file manipulation available
                </Link>
            )}

          

            <button
              disabled={fileItems.length === 0 || compressing}
              onClick={startCompression} 
              className={`w-full mt-8 p-4 rounded-xl font-bold transition-all shadow-md ${
                fileItems.length > 0 && !compressing
                  ? 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer active:scale-[0.98]'
                  : 'bg-stone-100 text-stone-400 cursor-not-allowed'
              }`}
            >
              {compressing ? 'Shrinking...' : 'Compress Files'}
            </button>
          </div>
        </div>


        {/* filler while waiting to similate loading */}
        {compressing && (
          <div className="mt-8 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center gap-3 animate-pulse">
            <div className="w-4 h-4 rounded-full border-2 border-amber-800 border-t-transparent animate-spin"></div>
            <span>Re-building binary streams with efficient compression matrices...</span>
          </div>
        )}

        {/* Showing result of compression */}
        {hasResult && (
          <div className="mt-8 bg-green-50 border border-green-200 text-green-800 p-6 rounded-2xl">
            {singleResult ? (
              (() => {
                const item = completedItems[0];

                return (
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-4">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                        <h4 className="font-bold text-lg text-green-950">
                          Compression Complete! Saved {item.result.ratio}
                        </h4>
                      </div>

                      <div className="flex gap-12 text-sm border-t border-green-200/50 pt-4">
                        <FilePreview
                          file={item.file}
                          previewUrl={item.fileInfo.category === 'images' ? item.downloadUrl : null}
                        />
                        <div>
                          <span className="block text-xs text-green-700/70 font-bold uppercase tracking-wide">
                            Before
                          </span>
                          <span className="text-lg font-black text-green-950">
                            {item.result.originalSize}
                          </span>
                        </div>

                        <div>
                          <span className="block text-xs text-green-700/70 font-bold uppercase tracking-wide">
                            After
                          </span>
                          <span className="text-lg font-black text-green-950">
                            {item.result.compressedSize}
                          </span>
                        </div>

                        <div>
                          <span className="block text-xs text-green-700/70 font-bold uppercase tracking-wide">
                            Storage Saved
                          </span>
                          <span className="text-lg font-black text-green-950">
                            {item.result.ratio}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="w-full md:w-auto">
                      <a
                        href={item.downloadUrl}
                        download={item.compressedFileName}
                        className="block bg-green-800 hover:bg-green-900 text-white px-6 py-4 rounded-xl font-bold text-center shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        Download Compressed File
                      </a>

                      {warning && (
                        <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm">
                          ⚠️ {warning}
                        </div>
                      )}
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
                      Compression Complete! {completedItems.length} files ready
                    </h4>
                  </div>

                  <button
                    onClick={handleDownloadAll}
                    className="bg-green-800 hover:bg-green-900 text-white px-6 py-4 rounded-xl font-bold text-center shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Download As Zip
                  </button>
                </div>

                {warning && (
                  <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm">
                    ⚠️ {warning}
                  </div>
                )}

                <div className="space-y-3">
                  {completedItems.map((item) => ( 
                    <div
                      key={item.id}
                      className="bg-white border border-green-200 rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4"
                    >
                      <div>
                        <p className="font-bold text-green-950 text-sm truncate max-w-xs">
                          {item.file.name}
                        </p>

                        <div className="flex gap-8 text-sm mt-3">
                        <FilePreview
                          file={item.file}
                          previewUrl={item.fileInfo.category === 'images' ? item.downloadUrl : null}
                        /> 
                          <div>
                            <span className="block text-xs text-green-700/70 font-bold uppercase">
                              Before
                            </span>
                            <span className="font-black text-green-950">
                              {item.result.originalSize}
                            </span>
                          </div>

                          <div>
                            <span className="block text-xs text-green-700/70 font-bold uppercase">
                              After
                            </span>
                            <span className="font-black text-green-950">
                              {item.result.compressedSize}
                            </span>
                          </div>

                          <div>
                            <span className="block text-xs text-green-700/70 font-bold uppercase">
                              Saved
                            </span>
                            <span className="font-black text-green-950">
                              {item.result.ratio}
                            </span>
                          </div>
                        </div>
                      </div>

                      <a
                        href={item.downloadUrl}
                        download={item.compressedFileName}
                        className="bg-green-800 hover:bg-green-900 text-white px-5 py-3 rounded-xl font-bold text-center self-start md:self-center"
                      >
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}


      </main>
    </Layout>
  );
}
