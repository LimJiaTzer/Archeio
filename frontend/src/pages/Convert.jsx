import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, FileType, CheckCircle2 } from 'lucide-react';
import { getFileInfo } from '../lib/fileTypes'; // file types
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { convertMedia } from '../services/conversionService';
import Layout from '../components/Layout';

export default function Convert() {
  const [file, setFile] = useState(null);
  const [format, setFormat] = useState('PNG');
  const [availableFormats, setAvailableFormats] = useState([]);
  const [converting, setConverting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [convertedFileName, setConvertedFileName] = useState('');

  // Persist FFmpeg instance so we don't recreate it every time
  const ffmpegRef = useRef(new FFmpeg());

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const processFile = (newFile) => {
    setFile(newFile);
    setConverting(false);
    setDownloadUrl('');
    
    // Auto-detect file type and set available formats
    const info = getFileInfo(newFile.type);
    if (info && info.outputFormats && info.outputFormats.length > 0) {
      // Filter out the exact same format as the input if possible
      const formats = info.outputFormats.filter(f => f !== info.format);
      const finalFormats = formats.length > 0 ? formats : info.outputFormats;
      
      setAvailableFormats(finalFormats);
      setFormat(finalFormats[0]);
    } else {
      // Fallback
      setAvailableFormats(['PNG', 'JPG', 'WEBP', 'PDF', 'GIF']);
      setFormat('PNG');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
      // Reset the value so the exact same file can be uploaded again after removal
      e.target.value = null;
    }
  };

  const startConversion = async () => {
    if (!file) return;
    setConverting(true);

    try {
      const result = await convertMedia(file, format, ffmpegRef);
      setDownloadUrl(result.downloadUrl);
      setConvertedFileName(result.convertedFileName);
    } catch (err) {
      console.error("Conversion failed:", err);
      alert("Failed to convert media file. Check console for details.");
    } finally {
      setConverting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setConverting(false);
    setDownloadUrl('');
    setConvertedFileName('');
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
          <h1 className="text-3xl font-extrabold text-stone-900 mb-2">Convert Media</h1>
          <p className="text-stone-600">Upload your file and convert it effortlessly. We auto-detect available formats.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Upload card */}
          <div className="md:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-stone-200">
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-stone-300 rounded-xl p-12 text-center hover:border-orange-500 transition-colors cursor-pointer relative"
            >
              <input 
                type="file" 
                id="file-upload" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                onChange={handleFileChange} 
              />
              <Upload className="w-12 h-12 text-stone-400 mx-auto mb-4" />
              <p className="font-medium text-stone-700">Drag and drop file here, or click to browse</p>
              <p className="text-xs text-stone-500 mt-1">Supports PNG, JPG, WEBP, PDF, MP4, GIF (Max 50MB)</p>
            </div>

            {file && (
              <div className="mt-6 p-4 bg-stone-100 rounded-xl flex items-center justify-between overflow-hidden gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <FileType className="w-8 h-8 text-orange-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-stone-800 text-sm truncate">{file.name}</p>
                    <p className="text-xs text-stone-500 truncate">
                      {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type || 'Unknown'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={handleReset}
                  className="shrink-0 text-stone-400 hover:text-stone-600 text-xs font-semibold"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Options card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-stone-200 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-stone-900 mb-4">Conversion Settings</h3>
              <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Convert to:</label>
              <select 
                value={format}
                onChange={(e) => {
                  setFormat(e.target.value);
                  if (downloadUrl) {
                    setDownloadUrl('');
                  }
                }}
                className="w-full bg-stone-100 border border-stone-200 rounded-lg p-3 text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500"
              >
                {availableFormats.map((fmt) => (
                  <option key={fmt} value={fmt}>{fmt} Format</option>
                ))}
              </select>
            </div>

            <div className="mt-8">
              <button
                disabled={!file || converting}
                onClick={startConversion}
                className={`w-full p-4 rounded-xl font-bold transition-all shadow-md ${
                  file && !converting
                    ? 'bg-orange-600 hover:bg-orange-700 text-white cursor-pointer active:scale-[0.98]' 
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                {converting ? 'Converting...' : 'Convert File'}
              </button>
            </div>
          </div>
        </div>

        {/* Status indicator */}
        {converting && (
          <div className="mt-8 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-center gap-3 animate-pulse">
            <div className="w-5 h-5 rounded-full border-2 border-amber-800 border-t-transparent animate-spin"></div>
            <span>Transforming your media file on-device...</span>
          </div>
        )}

        {(!converting && downloadUrl) && (
          <div className="mt-8 bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <p className="font-semibold text-green-950 text-sm">Conversion successful!</p>
                <p className="text-xs text-green-700/80">Ready to download: {convertedFileName}</p>
              </div>
            </div>
            <a 
              href={downloadUrl}
              download={convertedFileName}
              className="bg-green-800 hover:bg-green-900 text-white px-4 py-2 rounded-lg font-bold text-xs"
            >
              Download
            </a>
          </div>
        )}
      </main>
    </Layout>
  );
}
