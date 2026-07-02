import { useState, useRef, useEffect } from 'react';
import React from 'react';
import Layout from '../components/Layout';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, Trash2, RotateCw, ArrowUp, ArrowDown,
  Plus, Download, Loader2, CheckCircle2, PenTool, X, ChevronLeft, ChevronRight,
  Brush, Eraser, Undo
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import {convertImage } from '../services/conversionService';

export default function QRCodeCreator() {
    const [urlInput, setUrlInput] = useState("");
    const [fmt, setFmt] = useState("PNG");
    const qrRef = useRef(null);
    const formats = ["PNG", "JPEG", "HEIC", "WEBP", "ICO", "SVG"];
    const handleInput = (e) => {
        setUrlInput(e.target.value);
    }

    const handleDownload = async () => {
        const canvas = qrRef.current;
        if (!canvas) return;
        
        const pngURL = canvas.toDataURL("image/png");

        if (fmt == "PNG") {
            const link = document.createElement("a");
            link.href = pngURL;
            link.download = "qrcode.png";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);            
        }

        try {
            const response = await fetch(pngURL);
            const blob = await response.blob();
            const file = new File([blob], "qrcode.png", { type: "image/png" });
            const { downloadUrl, convertedFileName } = await convertImage(file, fmt);
             const link = document.createElement('a');
             link.href = downloadUrl;
             link.download = convertedFileName;
             document.body.appendChild(link);
             link.click()
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
        } catch (err) {
            console.error("Failed to convert image: ", err);
            alert(`Error converting to ${fmt}. Please try again.`);
        }

    };

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
                <div className="max-w-6xl mx-auto px-4">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                        <div className="bg-white rounded-2xl p-4 border border-stone-200 flex flex-col max-h-[700px] overflow-hidden transition-all duration-300 lg:col-span-8">
                            <input
                                type="text"
                                placeholder="Enter your URL here"
                                value={urlInput}
                                onChange={handleInput}
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-800 text-sm hover:border-indigo-300 transition-colors focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>
                        <div className="bg-white rounded-2xl p-4 border border-stone-200 flex flex-col max-h-[700px] overflow-hidden transition-all duration-300 lg:col-span-4">
                            {urlInput ? 
                                <div className="flex justify-center items-center">
                                    <QRCodeCanvas ref={qrRef} value={urlInput} size="128" />
                                </ div>
                                :
                                    "Enter a URL link"
                            }
                            <div className="pace-y-1.5 mt-4">
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                                    Download Format
                                </label>
                                <select
                                    value={fmt}
                                    onChange={(e) => {setFmt(e.target.value)}}
                                    className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs text-stone-700 bg-white focus:outline-none focus:border-indigo-500 font-medium"
                                >
                                    {formats.map((f) => (
                                        <option key={f} value={f}>
                                            {f}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                onClick={handleDownload}
                                disabled={!urlInput}
                                className="mt-4 flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-xl p-3 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Download QR Code
                            </button>
                        </div>      
                    </div>
                </div>
            </main>
        </Layout>
    );
}
