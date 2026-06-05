import React from 'react';
import Header from './Header';
import { DottedGlowBackground } from './ui/dotted-glow-background';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans selection:bg-stone-300 selection:text-stone-900 relative overflow-hidden">

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

      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-100/50 rounded-full blur-[100px] z-[1] mix-blend-multiply pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-100/50 rounded-full blur-[100px] z-[1] mix-blend-multiply pointer-events-none" />

      <Header />

      <main className="relative z-10 pt-28">
        {children}
      </main>
    </div>
  );
}
