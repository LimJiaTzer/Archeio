import {
  BrowserRouter,
  Link,
  Routes,
  Route,
} from 'react-router-dom';

// Other html pages 
import About from './pages/About';
import Features from './pages/Features';
import Convert from './pages/Convert';
import Ocr from './pages/Ocr';
import Compress from './pages/Compress';
import ImageEditor from './pages/ImageEditor';
import ZipCompression from './pages/ZipCompression';
import Manipulation from './pages/Manipulation';
import PDFEditor from './pages/PDFEditor';
import QRCodeCreator from './pages/QRCodeCreator';

// Grouped helpers
import Header from './components/Header';
import WorkspaceStackShowcase from './components/WorkspaceStackShowcase';
import { AnimatedGradientBackground } from './components/ui/animated-gradient-background';
import {
  ArrowRight,
  Archive,
  Layers3,
  RefreshCw,
  ScanText,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

// Fonts etc 
import './index.css';

const primaryActions = [
  {
    label: 'Compress',
    title: 'Make files lighter',
    description: 'Reduce file size while keeping the quality that matters.',
    icon: Archive,
    link: '/compress',
  },
  {
    label: 'Convert',
    title: 'Change any format',
    description: 'Move between document, image, audio, and video formats.',
    icon: RefreshCw,
    link: '/convert',
  },
  {
    label: 'Extract',
    title: 'Unlock text from scans',
    description: 'Turn images and scanned PDFs into editable documents.',
    icon: ScanText,
    link: '/ocr',
  },
];

function handleWorkflowTilt(event) {
  if (
    event.pointerType !== 'mouse'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) return;

  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  const pointerX = Math.min(Math.max((event.clientX - bounds.left) / bounds.width, 0), 1);
  const pointerY = Math.min(Math.max((event.clientY - bounds.top) / bounds.height, 0), 1);
  const rotateX = (0.5 - pointerY) * 6;
  const rotateY = (pointerX - 0.5) * 8;
  const shadowX = (0.5 - pointerX) * 18;
  const shadowY = 42 + (0.5 - pointerY) * 12;

  card.style.setProperty('--card-rotate-x', `${rotateX.toFixed(2)}deg`);
  card.style.setProperty('--card-rotate-y', `${rotateY.toFixed(2)}deg`);
  card.style.setProperty('--card-shadow-x', `${shadowX.toFixed(1)}px`);
  card.style.setProperty('--card-shadow-y', `${shadowY.toFixed(1)}px`);
  card.style.setProperty('--card-light-x', `${(pointerX * 100).toFixed(1)}%`);
  card.style.setProperty('--card-light-y', `${(pointerY * 100).toFixed(1)}%`);
}

function resetWorkflowTilt(event) {
  const card = event.currentTarget;

  card.style.removeProperty('--card-rotate-x');
  card.style.removeProperty('--card-rotate-y');
  card.style.removeProperty('--card-shadow-x');
  card.style.removeProperty('--card-shadow-y');
  card.style.removeProperty('--card-light-x');
  card.style.removeProperty('--card-light-y');
}

function Home() {
  return (
    <div className="home-shell min-h-screen text-stone-800 font-sans selection:bg-orange-200 selection:text-stone-950 relative overflow-x-clip">
      <AnimatedGradientBackground className="fixed inset-0 z-0" />

      <Header />

      <main className="relative z-10">
        <section className="mx-auto grid min-h-[780px] w-full max-w-7xl items-center gap-14 px-6 pb-20 pt-36 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-10 lg:px-10 lg:pt-32 xl:gap-14">
          <div className="hero-copy min-w-0">
            <div className="eyebrow">
              <Sparkles className="h-4 w-4" />
              One calm workspace for every file
            </div>

            <h1>
              <span className="hero-title-primary">Make your files</span>
              <span className="hero-title-accent">work for you.</span>
            </h1>

            <p className="hero-description">
              Shrink heavy files, change formats, extract text, organize PDFs,
              and create QR codes—all in one site, without ads.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/convert" className="primary-cta">
                Start with a file
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#tools" className="secondary-cta">
                See everything it can do
              </a>
            </div>

            <div className="hero-proof" aria-label="Product highlights">
              <span><ShieldCheck className="h-4 w-4" /> Privacy-minded</span>
              <span><Layers3 className="h-4 w-4" /> Batch-ready</span>
              <span><Zap className="h-4 w-4" /> No sign-up</span>
            </div>
          </div>

          <div className="workflow-window-stage">
            <div
              className="workflow-window"
              onPointerMove={handleWorkflowTilt}
              onPointerLeave={resetWorkflowTilt}
              onPointerCancel={resetWorkflowTilt}
            >
              <div className="workflow-window-header">
                <div>
                  <span className="workflow-kicker">YOUR FILE WORKSPACE</span>
                  <h2>What do you want to do?</h2>
                </div>
                <div className="window-status">
                  <span />
                  Ready
                </div>
              </div>

              <div className="workflow-list">
                {primaryActions.map((action, index) => {
                  const Icon = action.icon;

                  return (
                    <Link to={action.link} className="workflow-action group" key={action.label}>
                      <span className="workflow-number">0{index + 1}</span>
                      <span className="workflow-action-icon">
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                      </span>
                      <span className="workflow-action-copy">
                        <strong>{action.title}</strong>
                        <small>{action.description}</small>
                      </span>
                      <ArrowRight className="workflow-arrow h-5 w-5" />
                    </Link>
                  );
                })}
              </div>

              <div className="workflow-footer">
                <div className="file-stack" aria-hidden="true">
                  <span>PDF</span>
                  <span>JPG</span>
                  <span>MP4</span>
                </div>
                <p><strong>30+ formats</strong> across documents, images, audio, and video.</p>
              </div>
            </div>
          </div>
        </section>

        <WorkspaceStackShowcase />

        <section className="px-6 pb-12 lg:px-10">
          <div className="final-cta mx-auto max-w-7xl">
            <div>
              <span className="section-label">YOUR NEXT FILE IS WAITING</span>
              <h2>One workspace. Countless outcomes.</h2>
            </div>
            <Link to="/convert" className="primary-cta">
              Open Archeío
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="relative z-10 px-6 pb-8 pt-4 text-sm text-stone-500 lg:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-stone-900/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Archeío. File work, simplified.</p>
          <div className="flex gap-5">
            <Link to="/about" className="transition-colors hover:text-stone-900">About</Link>
            <a
              href="https://github.com/LimJiaTzer/Archeio"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-stone-900"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/features" element={<Features />} />
        <Route path="/convert" element={<Convert />} />
        <Route path="/ocr" element={<Ocr />} />
        <Route path="/compress" element={<Compress />} />
        <Route path="/image-editor" element={<ImageEditor />} />
        <Route path="/manipulation" element={<Manipulation />} />
        <Route path="/zip-compression" element={<ZipCompression />} />
        <Route path='/pdfEditor' element={<PDFEditor />} />
        <Route path='/QRCodeCreator' element={<QRCodeCreator />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
