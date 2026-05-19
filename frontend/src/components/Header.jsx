import React from 'react';
import NavDropdown from './NavDropdown';

export const navMenus = [
  {
    title: 'Unlock',
    options: [
      { label: 'Image to Text (OCR)', href: '#' },
      { label: 'Scanned PDF to Word', href: '#' }
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
      { label: 'Compress Image', href: '#' },
      { label: 'Zip Archive', href: '#' }
    ]
  }
];

export default function Header() {
  return (
    // <header className="absolute top-0 w-full p-6 flex justify-between items-center z-20">
    <header className="fixed top-0 left-0 w-full z-50 px-6 pt-6">
      <div className="w-full rounded-2xl bg-black/2 backdrop-blur-md border border-white/10 shadow-lg px-8 py-4 flex justify-between items-center">
      <div className="text-2xl font-black tracking-widest text-stone-700">ARCHEÍO</div>
      
      {/* Main Dropdown Nav */}
      <nav className="hidden sm:flex items-center space-x-8 text-sm text-stone-600 px-8 rounded-full">
        {navMenus.map((menu, i) => (
          <NavDropdown key={i} item={menu} />
        ))}
      </nav>
      
      <nav className="space-x-6 text-sm font-medium text-stone-600 hidden sm:flex items-center">
        <a href="#" className="hover:text-stone-900 transition-colors">Features</a>
        <a href="#" className="hover:text-stone-900 transition-colors">About</a>
        <a href="https://github.com/LimJiaTzer/Archeio" target="_blank" className="px-4 py-2 bg-stone-800 text-white rounded-full hover:bg-stone-700 transition-colors shadow-md">GitHub</a>
      </nav>
      </div>
    </header>
  );
}
