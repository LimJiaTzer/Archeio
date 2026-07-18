import React from 'react';
import NavDropdown from './NavDropdown';
import { Link } from 'react-router-dom';
import archeioIcon from '../assets/archeioIcon.png'

export const navMenus = [
{
  title: 'Tools',
  categories: [
    {
      title: 'PDF Tools',
      options: [
        { label: 'PDF Editor', href: '/PDFEditor' },
      ],
    },
    {
      title: 'Image Tools',
      options: [
        { label: 'GIF Maker', href: '#' },
        { label: 'Resize Image', href: '#' },
        { label: 'Crop Image', href: '#' },
        { label: 'Color Picker', href: '#' },
        { label: 'Rotate Image', href: '#' },
        { label: 'Flip Image', href: '#' },
        { label: 'Image Enlarger', href: '#' },
      ],
    },
    {
      title: 'Audio Tools',
      options: [
        { label: 'Adjust bitrate', href: '#' },
        { label: 'Trim Audio', href: '#' },
      ],
    },
    {
      title: 'Video Tools',
      options: [
        { label: 'Crop Video', href: '#' },
        { label: 'Trim Video', href: '#' },
      ],
    },
    {
      title: 'QR Code generator',
      options: [
        { label: 'Generator QR code', href: '/QRCodeCreator'}
      ],
    },
  ],
},
];

export default function Header() {
  return (
    // <header className="absolute top-0 w-full p-6 flex justify-between items-center z-20">
    <header className="fixed top-0 left-0 w-full z-50 px-6 pt-6">
      <div className="relative w-full rounded-2xl bg-black/2 backdrop-blur-md border border-white/10 shadow-lg px-8 py-2 flex justify-between items-center">
      <a
        href = "/"
        className="flex items-center gap-1 text-xl font-black tracking-widest text-[#E08E19] whitespace-nowrap"
        >
      <img src={archeioIcon} alt="archeioIcon" className="w-10 h-10 object-contain shrink-0 mix-blend-multiply" />
      <span>ARCHEÍO</span>
      </a>
      
      {/* Primary navigation */}
      <nav className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center space-x-8 text-sm text-stone-600 px-8 rounded-full">
        <Link to="/ocr" className="font-semibold hover:text-stone-900 transition-colors">Unlock</Link>
        <Link to="/convert" className="font-semibold hover:text-stone-900 transition-colors">Convert</Link>
        <Link to="/compress" className="font-semibold hover:text-stone-900 transition-colors">Compress</Link>
        <NavDropdown item={navMenus[0]} />
      </nav>
      
      <nav className="space-x-6 text-sm font-medium text-stone-600 hidden sm:flex items-center">
        <Link to="/features" className="hover:text-stone-900 transition-colors">Features</Link>
        <Link to="/about" className="hover:text-stone-900 transition-colors">About</Link>
        <a href="https://github.com/LimJiaTzer/Archeio" target="_blank" className="px-4 py-2 bg-stone-800 text-white rounded-full hover:bg-stone-700 transition-colors shadow-md">GitHub</a>
      </nav>
      </div>
    </header>
  );
}
