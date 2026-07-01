import { useState, useRef, useEffect } from 'react';
import React from 'react';
import Layout from '../components/Layout';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Upload, Trash2, RotateCw, ArrowUp, ArrowDown,
  Plus, Download, Loader2, CheckCircle2, PenTool, X, ChevronLeft, ChevronRight,
  Brush, Eraser, Undo
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function QRCodeCreator() {
    const [urlInput, setUrlInput] = useState("");

    const handleInput = (e) => {
        setUrlInput(e.target.value);
    }

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
                        <div className="bg-white rounded-2xl p-4 border border-stone-200 flex flex-col max-h-[700px] overflow-hidden transition-all duration-300 lg:col-span-6">
                            <input
                                type="text"
                                placeholder="Enter your URL here"
                                value={urlInput}
                                onChange={handleInput}
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-stone-800 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>
                        <div className="bg-white rounded-2xl p-4 border border-stone-200 flex flex-col max-h-[700px] overflow-hidden transition-all duration-300 lg:col-span-6">
                            {urlInput ? 
                                (<QRCodeSVG value={urlInput} size="256" />):
                                "Enter a URL link"
                            }
                        </div>      
                    </div>
                </div>
            </main>
        </Layout>
    );
}
