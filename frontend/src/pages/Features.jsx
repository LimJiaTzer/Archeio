import { Link } from 'react-router-dom';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  Image,
  Layers3,
  QrCode,
  RefreshCw,
  ScanText,
  Sparkles,
} from 'lucide-react';
import Layout from '../components/Layout';

const featureCards = [
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
    kicker: 'Create',
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

const featurePriority = {
  compress: 0,
  convert: 1,
  ocr: 2,
  'image-editor': 3,
  pdf: 4,
  qr: 5,
};

const orderedFeatureCards = [...featureCards].sort(
  (first, second) => featurePriority[first.id] - featurePriority[second.id],
);

function DetailGroup({ group }) {
  return (
    <section className={`feature-detail-panel ${group.wide ? 'feature-detail-wide' : ''}`}>
      <h3>{group.title}</h3>
      {group.description && <p>{group.description}</p>}

      {group.pairs && (
        <div className="feature-pair-list">
          {group.pairs.map((pair) => (
            <div className="feature-pair" key={`${pair.label}-${pair.from}`}>
              <span className="feature-pair-label">{pair.label}</span>
              <strong>{pair.from}</strong>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              <span>{pair.to}</span>
            </div>
          ))}
        </div>
      )}

      {group.chips && (
        <div className="feature-chip-list">
          {group.chips.map((chip) => <span key={chip}>{chip}</span>)}
        </div>
      )}

      {group.items && (
        <ul className="feature-check-list">
          {group.items.map((item) => (
            <li key={item}>
              <span><Check className="h-3.5 w-3.5" /></span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Features() {
  return (
    <Layout>
      <main className="responsive-page features-catalog-page mx-auto max-w-7xl">
        <nav className="mb-6">
          <Link to="/" className="inline-flex items-center gap-2 font-medium text-stone-600 transition-colors hover:text-stone-950">
            <ArrowLeft className="h-5 w-5" />
            Back to Home
          </Link>
        </nav>

        <section className="features-hero">
          <div className="features-hero-copy">
            <span className="features-eyebrow">
              <Sparkles className="h-4 w-4" />
              The complete toolbox
            </span>
            <h1>Every feature, clearly mapped.</h1>
            <p>
              See exactly what each Archeío workspace can do, which formats work
              together, and where to start.
            </p>
          </div>

          <div className="features-stats" aria-label="Product overview">
            <div>
              <strong>6</strong>
              <span>focused workspaces</span>
            </div>
            <div>
              <strong>30+</strong>
              <span>supported formats</span>
            </div>
            <div>
              <strong>0</strong>
              <span>ads in your workflow</span>
            </div>
          </div>
        </section>

        <nav className="features-jump-nav" aria-label="Jump to a feature">
          {orderedFeatureCards.map(({ id, kicker }) => (
            <a href={`#${id}`} key={id}>{kicker}</a>
          ))}
        </nav>

        <div className="features-card-list">
          {orderedFeatureCards.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <article
                className="feature-catalog-card"
                data-tone={feature.tone}
                id={feature.id}
                key={feature.id}
              >
                <header className="feature-card-header">
                  <div className="feature-card-heading">
                    <span className="feature-card-number">0{index + 1}</span>
                    <span className="feature-card-icon">
                      <Icon className="h-6 w-6" strokeWidth={1.8} />
                    </span>
                    <div>
                      <span className="feature-card-kicker">{feature.kicker}</span>
                      <h2>{feature.title}</h2>
                      <p>{feature.description}</p>
                    </div>
                  </div>

                  <Link to={feature.href} className="feature-card-action">
                    <span>{feature.action}</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </header>

                <div className="feature-badge-list">
                  {feature.badges.map((badge) => (
                    <span key={badge}>
                      <Layers3 className="h-3.5 w-3.5" />
                      {badge}
                    </span>
                  ))}
                </div>

                <div className="feature-detail-grid">
                  {feature.groups.map((group) => (
                    <DetailGroup group={group} key={group.title} />
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <footer className="features-footer">
          <p>Pick a workspace and start with the file you already have.</p>
          <Link to="/convert">
            Start with a file
            <ArrowRight className="h-4 w-4" />
          </Link>
        </footer>
      </main>
    </Layout>
  );
}
