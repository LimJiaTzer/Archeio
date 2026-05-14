import React from 'react';

export default function FeatureCard({ label, icon, description, onClick }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center text-left p-6 rounded-2xl bg-white/40 backdrop-blur-lg border border-white/50 shadow-xl hover:bg-white/60 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 group"
    >
      <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">{icon}</div>
      <h3 className="text-xl font-bold text-stone-800 mb-2">{label}</h3>
      <p className="text-sm text-stone-600 text-center">{description}</p>
    </button>
  );
}
