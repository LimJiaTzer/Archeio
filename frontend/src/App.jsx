import React from 'react';

import {
  BrowserRouter,
  Routes,
  Route,
} from 'react-router-dom';

// Other html pages 
import About from './pages/About';
import Features from './pages/Features';
import Convert from './pages/Convert';
import Ocr from './pages/Ocr';
import Compress from './pages/Compress';
import ZipCompression from './pages/ZipCompression';
import Manipulation from './pages/Manipulation';


// Grouped helpers 
import FeatureCard from './components/FeatureCard';
import Header from './components/Header';
import AnimatedText from './components/AnimatedText';
import { DottedGlowBackground } from './components/ui/dotted-glow-background';

// Icons 
import compressIcon from './assets/compressIcon.png';
import convertIcon from './assets/convertIcon.png';
import ocrIcon from './assets/ocrIcon.png';


// bg images
import 华山 from './assets/华山.png';

// Fonts etc 
import './index.css';

const features = [
  { 
    id: 'ocr', 
    label: 'OCR & Unlock', 
    link: '/ocr',
    icon: <img src={ocrIcon} alt="OCR & Unlock" className="w-10 h-10 object-contain mx-auto mix-blend-multiply" />, 
    description: 'Unlock text from images and scanned PDFs.' 
  },
  { 
    id: 'media', 
    label: 'Convert Media', 
    link: '/convert',
    icon: <img src={convertIcon} alt="Convert Media" className="w-10 h-10 object-contain mx-auto mix-blend-multiply" />, 
    description: 'Seamlessly convert between media formats.' 
  },
  { 
    id: 'compress', 
    label: 'Compress Files', 
    link: '/compress',
    icon: <img src={compressIcon} alt="Compress Files" className="w-10 h-10 object-contain mx-auto mix-blend-multiply" />, 
    description: 'Reduce file sizes without losing quality.' 
  },
];

function Home() {
  const handleFeatureClick = (id) => {
    console.log(`Navigate or open feature: ${id}`);
  };

  return (
    <div
      className="min-h-screen bg-stone-50 text-stone-800 font-sans selection:bg-stone-300 selection:text-stone-900 relative overflow-hidden"
    >

      <div className="absolute inset-0 z-0 pointer-events-none">
        <DottedGlowBackground
          className="absolute inset-0"
          gap={14}
          radius={1.6}
          opacity={0.6}
          backgroundOpacity={0.03}
          color="rgba(120, 113, 108, 0.35)"
          glowColor="rgba(249, 115, 22, 0.5)"
          speedScale={0.75}
        />
      </div>

      {/* Decorative blurry background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-100/50 rounded-full blur-[100px] z-[1] mix-blend-multiply pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-100/50 rounded-full blur-[100px] z-[1] mix-blend-multiply pointer-events-none"></div>

      <Header />

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 sm:p-12">
        

        
        {/* Hero Section */}
        <div className="text-center max-w-2xl mb-16 mt-20">
          <h1 className="text-5xl sm:text-6xl font-extrabold mb-6 tracking-tight bg-gradient-to-r from-orange-700 via-amber-500 to-orange-700 bg-clip-text text-transparent drop-shadow-sm">
            Transform how<br/>
            you handle files
          </h1>
          
          <p className="text-lg sm:text-xl text-stone-700 font-medium leading-relaxed">
            A unified, privacy-first utility platform. Convert, compress, and extract data from your files with a touch of elegance.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl relative">
            {features.map(feature => (
              <FeatureCard 
                key={feature.id}
                {...feature}
                // onClick={() => handleFeatureClick(feature.id)}
              />
            ))}
        </div>

      </main>
      
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
        <Route path="/manipulation" element={<Manipulation />} />
        <Route path="/zip-compression" element={<ZipCompression />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
