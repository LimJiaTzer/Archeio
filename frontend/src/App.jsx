import React from 'react';
import FeatureCard from './components/FeatureCard';
import Header from './components/Header';
import compressIcon from './assets/compressIcon.png';
import convertIcon from './assets/convertIcon.png';
import ocrIcon from './assets/ocrIcon.png';
import AnimatedText from './components/AnimatedText';

const features = [
  { id: 'ocr', label: 'OCR & Unlock', icon: <img src={ocrIcon} alt="OCR & Unlock" className="w-10 h-10 object-contain mx-auto mix-blend-multiply" />, description: 'Unlock text from images and scanned PDFs.' },
  { id: 'media', label: 'Convert Media', icon: <img src={convertIcon} alt="Convert Media" className="w-10 h-10 object-contain mx-auto mix-blend-multiply" />, description: 'Seamlessly convert between media formats.' },
  { id: 'compress', label: 'Compress Files', icon: <img src={compressIcon} alt="Compress Files" className="w-10 h-10 object-contain mx-auto mix-blend-multiply" />, description: 'Reduce file sizes without losing quality.' },
];

function App() {
  const handleFeatureClick = (id) => {
    console.log(`Navigate or open feature: ${id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fdfbf7] to-[#eaddce] text-stone-800 font-sans selection:bg-stone-300 selection:text-stone-900 relative overflow-hidden">
      
      {/* Decorative blurry background blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-100/50 rounded-full blur-[100px] -z-10 mix-blend-multiply pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-100/50 rounded-full blur-[100px] -z-10 mix-blend-multiply pointer-events-none"></div>

      <Header />

      {/* Main Content */}
      <main className="relative flex flex-col items-center justify-center min-h-screen p-6 sm:p-12 z-0">
        
        {/* Hero Section */}
        <div className="text-center max-w-2xl mb-16 mt-20">
          <h1 className="text-5xl sm:text-7xl font-extrabold mb-6 tracking-tight text-stone-800 drop-shadow-sm">
            Manage your <br/>
            <AnimatedText />
          </h1>
          
          <p className="text-lg sm:text-xl text-stone-600 font-light leading-relaxed">
            A unified, privacy-first utility platform. Convert, compress, and extract data from your files with a touch of elegance.
          </p>
        </div>

        {/* Feature Grid with Glassmorphism */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-4xl relative">
            {features.map(feature => (
              <FeatureCard 
                key={feature.id}
                {...feature}
                onClick={() => handleFeatureClick(feature.id)}
              />
            ))}
        </div>

      </main>
      
      {/* Footer */}
      <footer className="absolute bottom-0 w-full p-6 text-center text-xs text-stone-400 font-medium z-10">
        &copy; {new Date().getFullYear()} Archeío. All rights reserved.
      </footer>
    </div>
  );
}

export default App;
