import React from 'react';
import NavDropdown from './NavDropdown';
import { Link } from 'react-router-dom';
import archeioIcon from '../assets/archeioIcon.png'

export const navMenus = [
// Unlock
  {
  title: 'Unlock',
  categories: [
    {
      title: 'OCR & Unlock',
      options: [
        {
          label: 'Unlock text',
          href: '/ocr',
          features: [
            'Extract text from images and scanned PDFs',
            'Export editable DOCX files',
          ],
        },
      ],
    },
    {
      title: 'Preview & Export',
      options: [
        {
          label: 'Process multiple files',
          href: '/ocr',
          features: [
            'Preview, zoom and rename documents',
            'Download individually or as a ZIP',
          ],
        },
      ],
    },
  ],
},
// Convert
{
  title: 'Convert',
  categories: [
    {
      title: 'Document Conversion',
      options: [
        {
          label: 'Convert documents',
          href: '/convert',
          features: [
            'Convert documents to PDF',
            'Convert between CSV and XLSX',
            'Supports Office and text formats',
          ],
        },
      ],
    },
    {
      title: 'Image Conversion',
      options: [
        {
          label: 'Convert images',
          href: '/convert',
          features: [
            'PNG, JPG, WEBP, GIF and more',
            'Convert HEIC, AVIF, SVG and ICO',
            'Select GIF and ICO frames',
            'Export selected frames as a ZIP',
          ],
        },
      ],
    },
    {
      title: 'Audio & Video',
      options: [
        {
          label: 'Convert media',
          href: '/convert',
          features: [
            'MP3, WAV, AAC, FLAC and OGG',
            'MP4, MOV, AVI, MKV and WEBM',
            'Turn video clips into GIFs',
          ],
        },
      ],
    },
    {
      title: 'Batch Workflow',
      options: [
        {
          label: 'Convert multiple files',
          href: '/convert',
          features: [
            'Choose per-file or shared outputs',
            'Rename files and download as a ZIP',
          ],
        },
      ],
    },
  ],
},
// Compress
{
  title: 'Compress',
  categories: [
    {
      title: 'Document Compression',
      options: [
        {
          label: 'Compress documents',
          href: '/compress',
          features: [
            'DOCX / PPTX / XLSX',
            'DOC / PPT / XLS',
            'ODT / ODP / ODS',
            'TXT / CSV / HTML / MD',
            'RTF / EPUB',
            'Compress PDF and Office files',
            'Convert documents to PDF',
          ],
        },
      ],
    },
    {
      title: 'Image Compression',
      options: [
        {
          label: 'Compress images',
          href: '/compress',
          features: [
            'PNG / JPG / WEBP',
            'GIF',
            'SVG / ICO / HEIC / AVIF',
            'Compress and convert images',
            'Edit images',
          ],
        },
      ],
    },
    {
      title: 'Audio',
      options: [
        {
          label: 'Compress audio',
          href: '/compress',
          features: [
            'MP3 / WAV / AAC',
            'FLAC / OGG',
            'Compress and convert audio',
            'Adjust bitrate automatically',
          ],
        },
      ],
    },
    {
      title: 'Video',
      options: [
        {
          label: 'Compress video',
          href: '/compress',
          features: [
            'MP4 / MOV / AVI',
            'MKV / WEBM / GIF',
            'Compress and convert video',
            'Balance visual quality and file size',
          ],
        },
      ],
    },
    {
      title: 'Batch Workflow',
      options: [
        {
          label: 'Compress multiple files',
          href: '/compress',
          features: [
            'Use global or per-image settings',
            'Rename and download as ZIP',
          ],
        },
      ],
    },
  ],
},
// Tools
{
  title: 'Tools',
  categories: [
    {
      title: 'PDF Tools',
      options: [
        {
          label: 'PDF Editor',
          href: '/PDFEditor',
          features: [
            'Merge and split pages',
            'Reorder and rotate pages',
            'Annotate PDFs',
          ],
        },
      ],
    },

    {
      title: 'Image Tools',
      options: [
        {
          label: 'Image Editor',
          href: '#',
          features: [
            'Crop and resize',
            'Rotate and flip',
            'Apply filters',
            'Draw and add text',
          ],
        },
        {
          label: 'GIF Maker',
          href: '#',
          features: [
            'Animate images into GIFs',
            'Select GIF frames',
          ],
        },
      ],
    },

    {
      title: 'Audio Tools',
      options: [
        {
          label: 'Audio Editor',
          href: '#',
          features: [
            'Trim audio length',
            'Adjust bitrate', // quality 
            'Adjust volume',
            'Change playback speed',
            'Merge audio files',
            'Fade in and fade out',
            'Trim leading and trailing silence',
          ],
        },
      ],
    },

    {
      title: 'Video Tools',
      options: [
        {
          label: 'Video Editor',
          href: '#',
          features: [
            'Trim video length',
            'Adjust video quality',
            'Adjust frame rate',
            'Crop video',
            'Adjust or mute volume',
            'Change playback speed',
            'Extract audio',
            'Apply filters',
            'Merge clips', 
          ],
        },
      ],
    },

    {
      title: 'QR Code Generator',
      options: [
        {
          label: 'Generate QR code',
          href: '/QRCodeCreator',
          features: [
            'Turn links into scannable QR codes',
          ],
        },
      ],
    },
  ],
},
// {
//   title: 'Tools',
//   categories: [
//     {
//       title: 'PDF Tools',
//       options: [
//         { label: 'PDF Editor', href: '/PDFEditor' },
//       ],
//     },
//     {
//       title: 'Image Tools',
//       options: [
//         { label: 'Image Editor', href: '#' },
//         { label: 'GIF Maker', href: '#' },
//         // { label: 'Resize Image', href: '#' },
//         // { label: 'Crop Image', href: '#' },
//         // { label: 'Color Picker', href: '#' },
//         // { label: 'Rotate Image', href: '#' },
//         // { label: 'Flip Image', href: '#' },
//         // { label: 'Image Enlarger', href: '#' },
//       ],
//     },
//     {
//       title: 'Audio Tools',
//       options: [
//         { label: 'Audio Editor', href: '#' },
//         { label: 'Adjust bitrate', href: '#' },
//         { label: 'Trim Audio', href: '#' },
//       ],
//     },
//     {
//       title: 'Video Tools',
//       options: [
//         { label: 'Video Editor', href: '#' },
//         { label: 'Crop Video', href: '#' },
//         { label: 'Trim Video', href: '#' },
//       ],
//     },
//     {
//       title: 'QR Code generator',
//       options: [
//         { label: 'Generate QR code', href: '/QRCodeCreator'}
//       ],
//     },
//   ],
// },
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
        {/* <Link to="/ocr" className="font-semibold hover:text-stone-900 transition-colors">Unlock</Link>
        <Link to="/convert" className="font-semibold hover:text-stone-900 transition-colors">Convert</Link>
        <Link to="/compress" className="font-semibold hover:text-stone-900 transition-colors">Compress</Link> */}
        <NavDropdown item={navMenus[0]} />
        <NavDropdown item={navMenus[1]} />
        <NavDropdown item={navMenus[2]} />
        <NavDropdown item={navMenus[3]} />
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
