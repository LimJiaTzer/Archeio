import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Menu, X } from 'lucide-react';
import NavDropdown from './NavDropdown';
import archeioIcon from '../assets/archeioIcon.png';

const navMenus = [
  {
    title: 'Unlock',
    eyebrow: 'OCR & Unlock',
    description: 'Extract editable text from images and scanned PDFs.',
    href: '/ocr',
    highlights: ['Batch processing', 'DOCX export'],
  },
  {
    title: 'Convert',
    eyebrow: 'Universal converter',
    description: 'Change documents, images, audio, and video across 30+ formats.',
    href: '/convert',
    highlights: ['30+ formats', 'Batch conversion'],
  },
  {
    title: 'Compress',
    eyebrow: 'Smart compression',
    description: 'Reduce file sizes while keeping control of output quality.',
    href: '/compress',
    highlights: ['Quality controls', 'Batch downloads'],
  },
  {
    title: 'Tools',
    links: [
      {
        label: 'Image editor',
        description: 'Crop, filter, draw, and add text.',
        href: '/image-editor',
      },
      {
        label: 'PDF workspace',
        description: 'Organize, annotate, and sign PDFs.',
        href: '/PDFEditor',
      },
      {
        label: 'QR code creator',
        description: 'Build polished, downloadable QR codes.',
        href: '/QRCodeCreator',
      },
    ],
  },
];

const mobileLinks = [
  {
    label: 'OCR & Unlock',
    description: 'Extract editable text from scans',
    href: '/ocr',
  },
  {
    label: 'Convert files',
    description: 'Documents, images, audio, and video',
    href: '/convert',
  },
  {
    label: 'Compress files',
    description: 'Reduce file sizes while keeping quality',
    href: '/compress',
  },
  {
    label: 'Image editor',
    description: 'Crop, filter, draw, and add text',
    href: '/image-editor',
  },
  {
    label: 'PDF workspace',
    description: 'Organize, annotate, and sign',
    href: '/PDFEditor',
  },
  {
    label: 'QR code creator',
    description: 'Create custom QR codes',
    href: '/QRCodeCreator',
  },
];

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="fixed left-0 top-0 z-50 w-full px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="header-glass relative z-[2] mx-auto flex w-full max-w-6xl items-center justify-between rounded-2xl px-4 py-2 sm:px-5">
        <Link
          to="/"
          className="flex items-center gap-1 whitespace-nowrap text-lg font-black tracking-[0.14em] text-[#cf7518]"
        >
          <img
            src={archeioIcon}
            alt=""
            className="h-10 w-10 shrink-0 object-contain mix-blend-multiply"
          />
          <span>ARCHEÍO</span>
        </Link>

        <nav
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 text-sm text-stone-600 lg:flex"
          aria-label="Primary navigation"
        >
          {navMenus.map((item) => (
            <NavDropdown item={item} key={item.title} />
          ))}
        </nav>

        <nav className="hidden items-center gap-3 lg:flex" aria-label="Secondary navigation">
          <div className="hidden items-center gap-5 text-sm font-medium text-stone-600 xl:flex">
            <Link to="/features" className="transition-colors hover:text-stone-900">
              Features
            </Link>
            <Link to="/about" className="transition-colors hover:text-stone-900">
              About
            </Link>
          </div>
          <a
            href="https://github.com/LimJiaTzer/Archeio"
            target="_blank"
            rel="noreferrer"
            className="github-header-button"
          >
            GitHub
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </nav>

        <button
          type="button"
          className="header-mobile-cta lg:hidden"
          onClick={() => setIsMobileMenuOpen((current) => !current)}
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-navigation"
          aria-label={isMobileMenuOpen ? 'Close navigation' : 'Open navigation'}
        >
          {isMobileMenuOpen ? 'Close' : 'Tools'}
          {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[1] px-4 pb-4 pt-24 sm:px-6 sm:pt-28 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-stone-950/20 backdrop-blur-sm"
            onClick={closeMobileMenu}
            aria-label="Close navigation"
          />
          <nav
            id="mobile-navigation"
            className="mobile-navigation-panel relative mx-auto max-h-[calc(100dvh-7rem)] w-full max-w-lg overflow-y-auto rounded-3xl p-3"
            aria-label="Mobile navigation"
          >
            <div className="grid gap-1">
              {mobileLinks.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={closeMobileMenu}
                  className="mobile-navigation-link"
                >
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0" />
                </Link>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-200/70 pt-3">
              <Link
                to="/features"
                onClick={closeMobileMenu}
                className="mobile-navigation-secondary"
              >
                All features
              </Link>
              <Link
                to="/about"
                onClick={closeMobileMenu}
                className="mobile-navigation-secondary"
              >
                About
              </Link>
            </div>

            <a
              href="https://github.com/LimJiaTzer/Archeio"
              target="_blank"
              rel="noreferrer"
              className="mobile-github-button"
            >
              GitHub
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
