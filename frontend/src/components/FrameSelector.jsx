import React, { useState, useEffect } from 'react';
import { Square, CheckSquare } from 'lucide-react';

export default function FrameSelector({
  frames,
  selectedFrames = [],
  onToggleFrame,
  onSelectAll,
  onDeselectAll,
  tip = 'Tip: If multiple frames are selected, they will be downloaded as a ZIP archive.',
}) {
  const [urls, setUrls] = useState([]);

  useEffect(() => {
    if (frames && frames.length > 0) {
      const newUrls = frames.map(f => URL.createObjectURL(f));
      setUrls(newUrls);
      return () => newUrls.forEach(url => URL.revokeObjectURL(url));
    } else {
      setUrls([]);
    }
  }, [frames]);

  if (!frames || frames.length === 0) return null;

  return (
    <div className="mt-8 bg-white rounded-2xl p-6 shadow-sm border border-stone-200 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-stone-900">Select Frames</h3>
          <p className="text-xs text-stone-500">{frames.length} frames found in file</p>
        </div>
        <div className="flex gap-4">
          <button 
            type="button"
            onClick={onSelectAll}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors"
          >
            Select All
          </button>
          <button 
            type="button"
            onClick={onDeselectAll}
            className="text-xs font-bold text-stone-500 hover:text-stone-600 transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {urls.map((url, index) => {
          const isSelected = selectedFrames.includes(index);
          
          return (
            <div 
              key={index}
              onClick={() => onToggleFrame(index)}
              className={`relative shrink-0 w-28 h-28 rounded-xl border-2 transition-all cursor-pointer overflow-hidden ${
                isSelected ? 'border-orange-500 ring-4 ring-orange-500/10 scale-[1.02]' : 'border-stone-100 hover:border-stone-200 bg-stone-50'
              }`}
            >
              <img 
                src={url} 
                alt={`Frame ${index + 1}`}
                className="w-full h-full object-contain p-2"
              />
              <div className={`absolute top-2 right-2 rounded-lg p-1 ${isSelected ? 'bg-orange-500 text-white shadow-sm' : 'bg-white/90 text-stone-300 border border-stone-100'}`}>
                {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              </div>
              <div className="absolute bottom-2 left-2 bg-stone-900/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {index + 1}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-stone-400 italic">
        {tip}
      </p>
    </div>
  );
}
