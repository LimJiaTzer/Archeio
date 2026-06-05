import React from 'react';
import NavDropdown from './NavDropdown';
import { Link } from 'react-router-dom';
import archeioIcon from '../assets/archeioIcon.png'

export const navMenus = [
  {
    title: 'Unlock',  // name pending 
    options: [
      { label: 'Image to Text (OCR)', href: '#' },
    ]
  },
  {
    title: 'Convert',
    categories: [
      {
        title: 'Video',
        options: [
          { label: 'MP4 to MP3', href: '#' },
          { label: 'MOV to MP4', href: '#' }
        ]
      },
      {
        title: 'Audio',
        options: [
          { label: 'WAV to MP3', href: '#' },
          { label: 'MP3 to MIDI', href: '#' }
        ]
      }
    ]
  },
  {
    title: 'Compress',
    options: [
      { label: 'Compress PDF', href: '#' },
      { label: 'Compress Image', href: '#' }
    ]
  },
  {
    title: 'Tools',
    options: [
      { label: 'Scanned PDF to Word', href: '#' },
      { label: 'Zip Archive', href: '#' },
      { label: 'Crop vid / img', href: '#' }
    ]
  }
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
      
      {/* Main Dropdown Nav */}
      <nav className="absolute left-1/2 -translate-x-1/2 hidden sm:flex items-center space-x-8 text-sm text-stone-600 px-8 rounded-full">
        {navMenus.map((menu, i) => (
          <NavDropdown key={i} item={menu} />
        ))}
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
