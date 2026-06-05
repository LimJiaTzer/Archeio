import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ScanText, Clipboard, Sparkles } from 'lucide-react';
import { getFileInfo } from '../lib/fileTypes'; // file types
import Layout from '../components/Layout';
export default function Ocr() {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [loading, setLoading] = useState(false);
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

  const runOcr = () => {
    if (!image) return;
    setLoading(true);
    setText('');
    setError('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const fullBase64 = e.target?.result;
        if (!fullBase64) {
          throw new Error("Could not construct file buffer stream.");
        }
        
        const mimeType = image.type || 'image/jpeg';
        const base64Data = fullBase64.split(',')[1];

        const response = await fetch('/api/ocr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: base64Data,
            mimeType: mimeType,
          }),
        });

        const data = await response.json();
        if (response.ok) {
          setText(data.text);
        } else {
          setError(data.error || "An error occurred during character transcription.");
        }
      } catch (err) {
        console.error("OCR API controller communications failed:", err);
        setError("Network error: Failed to communicate with Archeío API. Ensure your Gemini API Key is authorized in Settings > Secrets.");
      } finally {
        setLoading(false);
      }
    };

    reader.onerror = () => {
      setError("Local file upload stream failed.");
      setLoading(false);
    };

    reader.readAsDataURL(image);
  };

  const handleClear = () => {
    setImage(null);
    setImagePreview('');
    setText('');
    setError('');
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
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-stone-900 mb-2">OCR & Unlock</h1>
          <p className="text-stone-600">Extract high-contrast text layers from dynamic photo documents locally using the secure Gemini API backend query.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

            <button
              onClick={runOcr}
              disabled={!image || loading}
              className={`w-full mt-6 p-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                image && !loading
                  ? 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer active:scale-[0.98]'
                  : 'bg-stone-100 text-stone-400 cursor-not-allowed'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                  <span>Running AI OCR...</span>
                </>
              ) : (
                'Run Text Extraction'
              )}
            </button>
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
            
            <div className="flex-1 min-h-[250px] bg-stone-950 text-emerald-400 font-mono p-4 rounded-xl text-xs overflow-auto leading-relaxed border border-stone-800">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                  <div className="w-6 h-6 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin"></div>
                  <span className="text-stone-400">Transcribing pixel arrays via Gemini 3.5 Flash...</span>
                </div>
              ) : error ? (
                <div className="text-rose-400 p-2 text-center h-full flex flex-col justify-center items-center">
                  <p className="font-bold mb-2">Extraction Error</p>
                  <p className="text-xs text-rose-300/80 leading-normal max-w-xs">{error}</p>
                </div>
              ) : text ? (
                <pre className="whitespace-pre-wrap selection:bg-stone-700 selection:text-white">{text}</pre>
              ) : (
                <div className="text-stone-600 flex flex-col items-center justify-center h-full text-center">
                  <Sparkles className="w-6 h-6 mb-2 text-stone-600" />
                  <p>Awaiting OCR run triggers</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
}
