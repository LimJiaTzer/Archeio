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
        title: 'PDF & Documents',
        options: [
          { label: 'PDF Converter', href: '#' },
          { label: 'Document Converter', href: '#' },
          { label: 'Ebook Converter', href: '#' },
          { label: 'Word to PDF', href: '#' },
          { label: 'PDF to JPG', href: '#' },
          { label: 'PDF to EPUB', href: '#' },
          { label: 'EPUB to PDF', href: '#' },
          { label: 'HEIC to PDF', href: '#' },
          { label: 'DOCX to PDF', href: '#' },
          { label: 'JPG to PDF', href: '#' },
        ],
      },
      {
        title: 'Image',
        options: [
          { label: 'Image Converter', href: '#' },
          { label: 'WEBP to PNG', href: '#' },
          { label: 'JFIF to PNG', href: '#' },
          { label: 'PNG to SVG', href: '#' },
          { label: 'HEIC to JPG', href: '#' },
          { label: 'HEIC to PNG', href: '#' },
          { label: 'WEBP to JPG', href: '#' },
          { label: 'SVG Converter', href: '#' },
        ],
      },
      {
        title: 'Video & Audio',
        options: [
          { label: 'Video Converter', href: '#' },
          { label: 'Audio Converter', href: '#' },
          { label: 'MP3 Converter', href: '#' },
          { label: 'MP4 to MP3', href: '#' },
          { label: 'Video to MP3', href: '#' },
          { label: 'MP4 Converter', href: '#' },
          { label: 'MOV to MP4', href: '#' },
          { label: 'MP3 to OGG', href: '#' },
        ],
      },
      {
        title: 'GIF',
        options: [
          { label: 'Video to GIF', href: '#' },
          { label: 'MP4 to GIF', href: '#' },
          { label: 'WEBM to GIF', href: '#' },
          { label: 'APNG to GIF', href: '#' },
          { label: 'GIF to MP4', href: '#' },
          { label: 'GIF to APNG', href: '#' },
          { label: 'Image to GIF', href: '#' },
          { label: 'MOV to GIF', href: '#' },
          { label: 'AVI to GIF', href: '#' },
        ],
      },
      {
        title: 'Others',
        options: [
          { label: 'Unit Converter', href: '#' },
          { label: 'Time Converter', href: '#' },
          { label: 'Archive Converter', href: '#' },
        ],
      },
    ],
  },
  {
    title: 'Compress',
    categories: [
      {
        title: 'Documents',
        options: [
          { label: 'Compress PDF', href: '#' },
          { label: 'Compress DOCX', href: '#' },
          { label: 'Compress PPTX', href: '#' },
          { label: 'Compress XLSX', href: '#' },
          { label: 'Compress RTF', href: '#' },
          { label: 'Compress EUP', href: '#' },
        ],
      },
      {
        title: 'Image',
        options: [
          { label: 'Compress Image', href: '#' },
          { label: 'Compress PNG', href: '#' },
          { label: 'Compress JPG', href: '#' },
          { label: 'Compress SVG', href: '#' },
          { label: 'Compress WEBP', href: '#' },
          { label: 'Compress AVIF', href: '#' },
          { label: 'Compress HEIC', href: '#' },
        ],
      },
      {
        title: 'Video & Audio',
        options: [
          { label: 'Compress Video', href: '#' },
          { label: 'Compress Audio', href: '#' },
          { label: 'Compress MP3', href: '#' },
          { label: 'Compress MP4', href: '#' },
        ],
      },
      {
        title: 'GIF',
        options: [
          { label: 'Compress GIF', href: '#' },
        ],
      },
    ],
  },
{
  title: 'Tools',
  categories: [
    {
      title: 'PDF Tools',
      options: [
        { label: 'PDF Merge', href: '#' },
        { label: 'PDF Split', href: '#' },
        { label: 'Flatten PDF', href: '#' },
        { label: 'Resize PDF', href: '#' },
        { label: 'Unlock PDF', href: '#' },
        { label: 'Rotate PDF', href: '#' },
        { label: 'Protect PDF', href: '#' },
        { label: 'Crop PDF', href: '#' },
        { label: 'Organize PDF', href: '#' },
        { label: 'Extract image from PDF', href: '#' },
        { label: 'PDF page remover', href: '#' },
        { label: 'Extract Pages from PDF', href: '#' },
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
