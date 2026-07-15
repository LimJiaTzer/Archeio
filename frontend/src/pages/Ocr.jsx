import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ScanText, Clipboard, Sparkles, FileDown } from 'lucide-react';
import { getFileInfo } from '../lib/fileTypes'; // file types
import Layout from '../components/Layout';
import { API_URL } from '../config/api';


export default function Ocr() {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [docxLoading, setDocxLoading] = useState(false);
  const [simpleDocxLoading, setSimpleDocxLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!image) {
      setImagePreview('');
      return;
    }
    const objectUrl = URL.createObjectURL(image);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [image]);

  const handleImageUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
      setText('');
      setError('');
    }
  };

  // New: full pipeline -> styled, editable .docx via the FastAPI backend.
  // Sends the raw file (multipart), not base64 -- avoids the ~33% size
  // bloat and matches how /convert/to-pdf already accepts files.
  const runDocxConversion = async () => {
    if (!image) return;
    setDocxLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', image, image.name);

      const response = await fetch(`${API_URL}/convert/image-to-docx`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Document conversion failed.');
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const baseName = image.name.replace(/\.[^/.]+$/, '');
      a.download = `${baseName}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Docx conversion failed:", err);
      setError(err.message || "Network error: Failed to reach the document conversion API.");
    } finally {
      setDocxLoading(false);
    }
  };

  // New: preview using the SIMPLIFIED pipeline (whole-page OCR, no
  // layout model, no region cropping). This is the path we're now
  // prioritizing while debugging ordering issues in the layout-based one.
  const runOcrSimplePreview = async () => {
    if (!image) return;
    setPreviewLoading(true);
    setText('');
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', image, image.name);

      const response = await fetch(`${API_URL}/ocr/simple-preview`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setText(data.text);
      } else {
        setError(data.detail || "An error occurred during simple OCR preview.");
      }
    } catch (err) {
      console.error("Simple OCR preview request failed:", err);
      setError("Network error: Failed to reach the simple OCR preview endpoint.");
    } finally {
      setPreviewLoading(false);
    }
  };

  // New: full docx download via the simplified pipeline.
  const runSimpleDocxConversion = async () => {
    if (!image) return;
    setSimpleDocxLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', image, image.name);

      const response = await fetch(`${API_URL}/convert/simple-to-docx`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Simple document conversion failed.');
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const baseName = image.name.replace(/\.[^/.]+$/, '');
      a.download = `${baseName}_simple.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Simple docx conversion failed:", err);
      setError(err.message || "Network error: Failed to reach the simple document conversion API.");
    } finally {
      setSimpleDocxLoading(false);
    }
  };

  const handleClear = () => {
    setImage(null);
    setImagePreview('');
    setText('');
    setError('');
  };

  const busy = docxLoading || simpleDocxLoading || previewLoading;

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
          <p className="text-stone-600">Extract text, or convert a page into an editable Word document. Two pipelines are shown side-by-side while we verify accuracy.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-8 items-start">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-stone-900 mb-4">Upload Document Image</h3>

              {!imagePreview ? (
                <div className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center hover:border-orange-500 transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <ScanText className="w-10 h-10 text-stone-400 mx-auto mb-3 animate-pulse" />
                  <p className="text-sm font-semibold text-stone-700">Select scan document or image</p>
                  <p className="text-xs text-stone-500 mt-1">Accepts PNG, JPG, or WEBP (Max 10MB)</p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-stone-200 mb-4 max-h-60 bg-stone-100 flex items-center justify-center">
                  <img
                    src={imagePreview}
                    alt="Source Scan"
                    className="object-contain max-h-60 max-w-full"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {image && (
                <div className="mt-4 p-3 bg-stone-100 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-700 truncate max-w-[200px]">{image.name}</span>
                  <button onClick={handleClear} className="text-xs text-red-500 font-bold hover:underline">Clear</button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 mt-6">
              <button
                onClick={runOcrSimplePreview}
                disabled={!image || busy}
                className={`w-full p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                  image && !busy
                    ? 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer active:scale-[0.98]'
                    : 'bg-stone-100 text-stone-400 cursor-not-allowed'
                }`}
              >
                {previewLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    <span>Running OCR...</span>
                  </>
                ) : (
                  'Extract Text'
                )}
              </button>

              <button
                onClick={runSimpleDocxConversion}
                disabled={!image || busy}
                className={`w-full p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border-2 ${
                  image && !busy
                    ? 'border-stone-800 text-stone-800 hover:bg-stone-100 cursor-pointer active:scale-[0.98]'
                    : 'border-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                {simpleDocxLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-stone-800 border-t-transparent animate-spin"></div>
                    <span>Building simple document...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span>Convert to .docx (Simple, plain text)</span>
                  </>
                )}
              </button>

              <div className="h-px bg-stone-200 my-1" />
              <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 px-1">Layout-based pipeline (WIP — paused)</p>

              <button
                onClick={runDocxConversion}
                disabled={!image || busy}
                className={`w-full p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border-2 ${
                  image && !busy
                    ? 'border-orange-600 text-orange-600 hover:bg-orange-50 cursor-pointer active:scale-[0.98]'
                    : 'border-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                {docxLoading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-orange-600 border-t-transparent animate-spin"></div>
                    <span>Building document...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span>Convert to Editable .docx (styled, WIP)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-stone-900">Extracted Output</h3>
              {text && (
                <button
                  onClick={() => navigator.clipboard.writeText(text)}
                  className="flex items-center gap-1 text-xs font-bold text-orange-600 cursor-pointer hover:underline"
                >
                  <Clipboard className="w-4 h-4" /> Copy
                </button>
              )}
            </div>

            <div className="flex-1 min-h-[400px] bg-stone-50 p-4 rounded-xl overflow-auto border border-stone-200 flex flex-col">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center flex-grow gap-3 text-center py-12">
                  <div className="w-8 h-8 rounded-full border-4 border-orange-600 border-t-transparent animate-spin"></div>
                  <span className="text-stone-500 font-medium text-sm">Running OCR (whole-page PaddleOCR)...</span>
                </div>
              ) : error ? (
                <div className="text-red-500 p-6 text-center flex-grow flex flex-col justify-center items-center py-12">
                  <p className="font-bold mb-2 text-sm">Extraction Error</p>
                  <p className="text-xs text-stone-600 leading-normal max-w-xs">{error}</p>
                </div>
              ) : text ? (
                <div className="bg-white border border-stone-200/80 shadow-md rounded-lg p-8 flex-1 min-h-[350px] text-stone-800 font-sans relative select-text">
                  {text.split('\n').map((paragraph, index) => {
                    if (!paragraph.trim()) return <div key={index} className="h-4" />;
                    return (
                      <p key={index} className="mb-3 text-sm leading-relaxed text-stone-700 font-normal">
                        {paragraph}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <div className="text-stone-500 flex flex-col items-center justify-center flex-grow text-center py-12">
                  <Sparkles className="w-8 h-8 mb-3 text-stone-400" />
                  <p className="text-sm font-medium">Awaiting OCR run triggers, or use "Convert to Editable .docx" to download a Word file directly.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}