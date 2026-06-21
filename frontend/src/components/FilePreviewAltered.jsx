import React, { useState, useRef, useEffect } from 'react';
import { FileType, X, Play, FileText, Eye } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import * as docx from 'docx-preview';
import { createPortal } from 'react-dom';

export default function FilePreview({ 
  file, 
  previewUrl, 
  size = "md", 
  showInfo = true,
  className = "" 
}) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const docxRef = useRef(null);
  const [blobUrl, setBlobUrl] = useState(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!file) return null;

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const isDocx = file.name.toLowerCase().endsWith('.docx') || 
                 file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  const canPreview = isImage || isVideo || isDocx || isPdf;

  const sizeClasses = {
    sm: { container: "w-10 h-10", icon: "w-5 h-5", text: "text-sm", subtext: "text-[10px]" },
    md: { container: "w-12 h-12", icon: "w-6 h-6", text: "text-base", subtext: "text-xs" },
    lg: { container: "w-20 h-20", icon: "w-10 h-10", text: "text-lg", subtext: "text-sm" }
  };

  const currentSize = sizeClasses[size] || sizeClasses.md;

  useEffect(() => {
    if (isPreviewOpen && isDocx && docxRef.current) {
      docx.renderAsync(file, docxRef.current).catch(err => {
        console.error("DOCX Preview failed:", err);
      });
    }
  }, [isPreviewOpen, isDocx, file]);

  // Handle blob URL lifecycle for video/pdf
  useEffect(() => {
    if (isPreviewOpen && (isVideo || isPdf)) {
      const url = URL.createObjectURL(file);
      setBlobUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setBlobUrl(null);
      };
    }
  }, [isPreviewOpen, isVideo, isPdf, file]);

  const togglePreview = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (canPreview) setIsPreviewOpen(true);
  };

  return (
    <>
      <div className={`flex items-center gap-4 min-w-0 ${className}`}>
        <div 
          onClick={togglePreview}
          className={`
            ${currentSize.container} bg-stone-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-stone-200 shadow-sm
            ${canPreview ? 'cursor-pointer hover:border-indigo-400 hover:ring-4 hover:ring-indigo-500/10 transition-all group relative' : ''}
          `}
        >
          {previewUrl ? (
            <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
          ) : isVideo ? (
            <div className="bg-stone-200 w-full h-full flex items-center justify-center">
              <Play className={`${currentSize.icon} text-stone-500 fill-stone-500`} />
            </div>
          ) : isDocx || isPdf ? (
            <div className="bg-stone-50 w-full h-full flex items-center justify-center">
              <FileText className={`${currentSize.icon} text-indigo-400`} />
            </div>
          ) : (
            <FileType className={`${currentSize.icon} text-stone-400`} />
          )}

          {canPreview && (
            <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Eye className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* {showInfo && (
          <div className="min-w-0 flex-1">
            <p className={`font-bold text-stone-900 truncate ${currentSize.text}`} title={file.name}>
              {file.name}
            </p>
            <p className={`font-medium text-stone-400 ${currentSize.subtext}`}>
              {(file.size / 1024).toFixed(2)} KB
            </p>
          </div>
        )} */}
      </div>

      {/* Full-screen Preview Modal */}
      {isMounted && createPortal(
        <AnimatePresence>
          {isPreviewOpen && (
            <motion.div
              key="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-stone-950/90 backdrop-blur-2xl p-4 md:p-12"
              onClick={() => setIsPreviewOpen(false)}
            >
              <motion.button
                key="modal-close"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-[10001]"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPreviewOpen(false);
                }}
              >
                <X className="w-6 h-6" />
              </motion.button>

              <motion.div
                key="modal-container"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-6xl max-h-full bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col relative"
              >
                <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-bold text-stone-900 text-base truncate max-w-[200px] md:max-w-xl">{file.name}</p>
                      <p className="text-xs text-stone-400 font-bold uppercase tracking-widest">{file.type || 'File'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto bg-stone-50 flex justify-center items-start min-h-[300px]">
                  <div className="p-4 md:p-12 w-full flex justify-center">
                    {isImage ? (
                      <img 
                        src={previewUrl} 
                        alt={file.name} 
                        className="max-w-full h-auto rounded-xl shadow-lg" 
                      />
                    ) : isVideo ? (
                      blobUrl && (
                        <video 
                          src={blobUrl} 
                          controls 
                          autoPlay
                          className="max-w-full max-h-[80vh] rounded-xl shadow-xl"
                        />
                      )
                    ) : isDocx ? (
                      <div className="bg-white shadow-xl p-4 md:p-16 min-h-full w-full max-w-4xl rounded-sm">
                        <div ref={docxRef} className="docx-wrapper" />
                      </div>
                    ) : isPdf ? (
                      blobUrl && (
                        <iframe 
                          src={blobUrl} 
                          className="w-full h-[75vh] rounded-xl bg-white border-0 shadow-lg"
                          title="PDF Preview"
                        />
                      )
                    ) : (
                      <div className="text-center py-20">
                        <FileType className="w-20 h-20 text-stone-200 mx-auto mb-6" />
                        <p className="text-stone-500 font-bold text-xl">Preview not available</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
