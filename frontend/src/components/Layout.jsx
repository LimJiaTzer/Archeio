import Header from './Header';
import { AnimatedGradientBackground } from './ui/animated-gradient-background';

export default function Layout({ children }) {
  return (
    <div className="app-layout min-h-screen overflow-x-clip bg-[#faf8f5] text-stone-800 font-sans selection:bg-orange-200 selection:text-stone-900 relative">

      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <AnimatedGradientBackground className="absolute inset-0" />
      </div>

      <Header />

      <main className="relative z-10 pt-24 sm:pt-28">
        {children}
      </main>
    </div>
  );
}
