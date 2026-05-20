import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ScanText, RefreshCw, Archive } from 'lucide-react';

export default function Features() {
  const allFeatures = [
    {
      icon: <ScanText className="w-8 h-8 text-indigo-500" />,
      title: "OCR & Unlock",
      description: "Extract text from single images or complex, multi-page layout PDFs directly. Support for high density scanning engines."
    },
    {
      icon: <RefreshCw className="w-8 h-8 text-orange-500" />,
      title: "Convert Media",
      description: "Fast converters for resizing images, compiling layouts, transitioning formats (PNG, JPG, WEBP, PDF), and compression containers."
    },
    {
      icon: <Archive className="w-8 h-8 text-emerald-500" />,
      title: "Compress Files",
      description: "Reduce final payloads of high definition photos, videos, or presentation decks without sacrificing visually perceivable details."
    }
  ];

  return (
    <div className="min-h-screen bg-stone-50 p-6 flex flex-col justify-between">
      <div className="max-w-3xl mx-auto mt-20">
        <div className="text-center mb-12">
          <Link to="/" className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-900 mb-8 font-medium">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>
          <h1 className="text-4xl font-extrabold text-stone-900 mb-2">Our Features</h1>
          <p className="text-stone-600">Explore the set of tools curated under the Archeío utility platform.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {allFeatures.map((f, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
              <div className="mb-4">{f.icon}</div>
              <h2 className="font-bold text-stone-800 text-lg mb-2">{f.title}</h2>
              <p className="text-stone-600 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
      <footer className="text-center text-xs text-stone-400 py-6">
        &copy; {new Date().getFullYear()} Archeío. All rights reserved.
      </footer>
    </div>
  );
}
