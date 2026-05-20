import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function About() {
  return (
    <div className="min-h-screen bg-stone-50 p-6 flex flex-col justify-between">
      <div className="max-w-xl mx-auto mt-20 text-center">
        <Link to="/" className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-900 mb-8 font-medium">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </Link>
        <h1 className="text-4xl font-extrabold text-stone-900 mb-4">About Archeío</h1>
        <p className="text-stone-600 leading-relaxed mb-6">
          Archeío is a privacy-first utility suite designed to handle your everyday document and file operations entirely in your context. We never upload your sensitive media files to foreign servers.
        </p>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm text-left">
          <h2 className="font-bold text-stone-800 mb-2">Key Principles</h2>
          <ul className="list-disc list-inside space-y-2 text-sm text-stone-600">
            <li>Secure, on-device operations when applicable</li>
            <li>No data mining, cookies, or intrusive telemetry tracking</li>
            <li>Stunning glassmorphic aesthetics that elevate normal utility processes</li>
          </ul>
        </div>
      </div>
      <footer className="text-center text-xs text-stone-400 py-6">
        &copy; {new Date().getFullYear()} Archeío. All rights reserved.
      </footer>
    </div>
  );
}
