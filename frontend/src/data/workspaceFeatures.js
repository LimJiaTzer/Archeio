import {
  Archive,
  FileText,
  Image,
  QrCode,
  RefreshCw,
  ScanText,
} from 'lucide-react';

export const workspaceFeatures = [
  {
    id: 'convert',
    title: 'Universal Converter',
    kicker: 'Convert',
    description: 'Move documents, images, audio, and video into the format your next step needs.',
    href: '/convert',
    action: 'Open converter',
    icon: RefreshCw,
    tone: 'orange',
    badges: ['Batch conversion', 'Frame extraction', 'ZIP downloads'],
    groups: [
      {
        title: 'Every supported conversion pair',
        description: 'Formats on a shared row can be converted through the same workflow.',
        wide: true,
        pairs: [
          {
            label: 'Documents',
            from: 'DOCX · DOC · PPTX · PPT · XLS · ODT · ODP · ODS · TXT · MD · RTF · EPUB',
            to: 'PDF',
          },
          {
            label: 'Spreadsheets',
            from: 'CSV',
            to: 'XLSX or PDF',
          },
          {
            label: 'Spreadsheets',
            from: 'XLSX',
            to: 'CSV or PDF',
          },
          {
            label: 'Web documents',
            from: 'HTML',
            to: 'PDF',
          },
          {
            label: 'Images',
            from: 'PNG · JPG/JPEG · WEBP · GIF · SVG · ICO · HEIC · AVIF',
            to: 'Every other image format listed here',
          },
          {
            label: 'Audio',
            from: 'MP3 · WAV · AAC · FLAC · OGG',
            to: 'Every other audio format listed here',
          },
          {
            label: 'Video',
            from: 'MP4 · MOV · AVI · MKV · WEBM',
            to: 'MP4 · MOV · AVI · MKV · WEBM · GIF',
          },
        ],
      },
      {
        title: 'Conversion workflow',
        items: [
          'Convert multiple files in one queue',
          'Apply one common format where files overlap',
          'Paste, browse, or drag files into the workspace',
          'Preview supported files before processing',
          'Select individual GIF or ICO frames',
          'Rename results and download everything as a ZIP',
        ],
      },
    ],
  },
  {
    id: 'ocr',
    title: 'OCR & Unlock',
    kicker: 'Extract',
    description: 'Turn scans and image-based documents into editable DOCX files you can review immediately.',
    href: '/ocr',
    action: 'Open OCR',
    icon: ScanText,
    tone: 'amber',
    badges: ['Batch-ready', 'DOCX output', 'Document preview'],
    groups: [
      {
        title: 'Accepted sources',
        chips: ['PDF', 'PNG', 'JPG', 'JPEG', 'WEBP', 'TIF', 'TIFF'],
      },
      {
        title: 'Editable output',
        items: [
          'Exports every completed scan as DOCX',
          'Keeps each source as a separate document',
          'Rename output files before downloading',
        ],
      },
      {
        title: 'Review tools',
        items: [
          'In-browser DOCX preview',
          'Fit-to-window and 25–300% zoom',
          'Trackpad zoom, touch pinch, and canvas panning',
        ],
      },
      {
        title: 'Batch workflow',
        items: [
          'Queue multiple images and PDFs together',
          'Avoid duplicate uploads automatically',
          'Download one file or bundle all results as a ZIP',
        ],
      },
    ],
  },
  {
    id: 'compress',
    title: 'Smart Compression',
    kicker: 'Compress',
    description: 'Shrink documents and media while keeping control of quality, dimensions, and final output.',
    href: '/compress',
    action: 'Open compressor',
    icon: Archive,
    tone: 'rose',
    badges: ['Per-file controls', 'Live estimates', 'Batch downloads'],
    groups: [
      {
        title: 'Supported families',
        chips: [
          'PDF', 'DOCX', 'PPTX', 'XLSX',
          'PNG', 'JPG', 'WEBP', 'GIF', 'SVG', 'HEIC', 'AVIF',
          'MP3', 'WAV', 'AAC', 'FLAC', 'OGG',
          'MP4', 'MOV', 'AVI', 'MKV', 'WEBM',
        ],
      },
      {
        title: 'Quality control',
        items: [
          'Set one global compression target',
          'Override quality for individual files',
          'See original, estimated, and final sizes',
          'Preview compressed images before download',
        ],
      },
      {
        title: 'Image-specific tools',
        items: [
          'Resize with maximum width and height',
          'Preserve the original aspect ratio',
          'Crop, draw, and add text before compression',
          'Choose which animated GIF frames to keep',
        ],
      },
      {
        title: 'Batch workflow',
        items: [
          'Compress mixed file queues',
          'Rename completed outputs',
          'Download files individually or together as a ZIP',
        ],
      },
    ],
  },
  {
    id: 'image-editor',
    title: 'Image Editor',
    kicker: 'Edit',
    description: 'Make focused image edits in a clean workspace without sending users to a separate design app.',
    href: '/image-editor',
    action: 'Open image editor',
    icon: Image,
    tone: 'violet',
    badges: ['Non-destructive preview', 'GIF-aware', 'Undo & redo'],
    groups: [
      {
        title: 'Editing tools',
        items: [
          'Freeform crop with a live preview',
          'Draw directly with adjustable color and width',
          'Add multiple styled text layers',
          'Move, resize, rotate, edit, and delete text',
          'Undo and redo text or drawing changes',
          'Reset one crop or restore the original image',
        ],
      },
      {
        title: 'Filters',
        chips: ['Pop', 'Greyscale', 'Cool', 'Chrome', 'Film'],
      },
      {
        title: 'Input workflow',
        items: [
          'Browse, drag, drop, or paste an image',
          'Edit browser-readable image formats',
          'Preserve animated GIF frames while editing',
        ],
      },
      {
        title: 'Exports',
        chips: ['PNG', 'JPG', 'WEBP', 'GIF for animated sources'],
      },
    ],
  },
  {
    id: 'pdf',
    title: 'PDF Workspace',
    kicker: 'Organize & annotate',
    description: 'Combine PDFs, reorganize pages, annotate content, and export one polished document.',
    href: '/PDFEditor',
    action: 'Open PDF workspace',
    icon: FileText,
    tone: 'indigo',
    badges: ['Multi-file merge', 'Touch drawing', 'PDF export'],
    groups: [
      {
        title: 'Page organization',
        items: [
          'Merge multiple PDF files into one workspace',
          'Drag pages into a new order',
          'Move pages up, down, or to an exact position',
          'Rotate pages in 90° steps',
          'Delete one page or a multi-page selection',
          'Select ranges, toggle pages, or marquee-select',
        ],
      },
      {
        title: 'Signatures & text',
        items: [
          'Draw a signature with mouse, trackpad, or touch',
          'Choose a signature color',
          'Add text with font, size, and color controls',
          'Move and resize placed annotations',
        ],
      },
      {
        title: 'Direct annotation',
        items: [
          'Draw directly on the active page',
          'Switch between brush and highlighter',
          'Adjust stroke width and color',
          'Undo or clear page drawings',
        ],
      },
      {
        title: 'Workspace & export',
        items: [
          'Progressive page thumbnails and full preview',
          'Expandable page sidebar for larger documents',
          'Export every edit into a new PDF',
        ],
      },
    ],
  },
  {
    id: 'qr',
    title: 'QR Code Creator',
    kicker: 'Generate',
    description: 'Build branded, scannable QR codes with content, frames, styling, and export controls.',
    href: '/QRCodeCreator',
    action: 'Open QR creator',
    icon: QrCode,
    tone: 'sky',
    badges: ['Live preview', 'Scanability check', '9 export formats'],
    groups: [
      {
        title: 'QR content',
        chips: ['Website link', 'Plain text', 'Wi-Fi credentials', 'Phone number', 'Email message'],
      },
      {
        title: 'Frames',
        chips: ['Bottom tag', 'Badge', 'Focus brackets', 'Phone', 'Clipboard', 'Polaroid', 'Browser'],
        description: 'Customize frame color, call-to-action text, and text color.',
      },
      {
        title: 'Shape & color',
        items: [
          'Six module patterns, from square to extra-rounded',
          'Independent border and center eye styles',
          'Custom foreground, background, and eye colors',
          'Two-color gradients and transparent backgrounds',
        ],
      },
      {
        title: 'Branding & export',
        items: [
          'Upload a center logo and adjust its size',
          'Excavate background dots behind the logo',
          'Check scanability as the design changes',
        ],
        chips: ['PNG', 'JPEG', 'SVG', 'WEBP', 'GIF', 'ICO', 'AVIF', 'BMP', 'HEIC'],
      },
    ],
  },
];

export const workspaceFeaturePriority = {
  compress: 0,
  convert: 1,
  ocr: 2,
  'image-editor': 3,
  pdf: 4,
  qr: 5,
};

export const orderedWorkspaceFeatures = [...workspaceFeatures].sort(
  (first, second) => workspaceFeaturePriority[first.id] - workspaceFeaturePriority[second.id],
);
