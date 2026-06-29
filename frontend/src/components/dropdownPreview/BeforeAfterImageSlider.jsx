import { useState } from 'react';

const BeforeAfterImageSlider = ({
  originalUrl,
  compressedUrl,
  originalLabel = 'Original',
  compressedLabel = 'Preview',
  originalSize,
  compressedSize,
}) => {
  const [position, setPosition] = useState(50);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
      <img
        src={originalUrl}
        alt="Original"
        className="absolute inset-0 h-full w-full object-cover"
      />

      <img
        src={compressedUrl || originalUrl}
        alt="Compressed preview"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ // this is what gives the slider 
          clipPath: `inset(0 0 0 ${position}%)`,
        }}
      />

      <div className="absolute left-3 top-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-bold text-stone-800 shadow-sm">
        <div>{originalLabel}</div>
        {originalSize && <div className="font-medium text-stone-500">{originalSize}</div>}
      </div>

      <div className="absolute right-3 top-3 rounded-lg bg-white/90 px-3 py-2 text-xs font-bold text-stone-800 shadow-sm">
        <div>{compressedLabel}</div>
        {compressedSize && <div className="font-medium text-stone-500">{compressedSize}</div>}
      </div>

      <div
        className="absolute top-0 h-full w-0.5 bg-white shadow"
        style={{ left: `${position}%` }}
      />

      <div
        className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-sm font-bold text-stone-600 shadow"
        style={{ left: `${position}%` }}
      >
        ↔
      </div>

      <input
        type="range"
        min="0"
        max="100"
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
        aria-label="Compare original and compressed image"
      />
    </div>
  );
};

export default BeforeAfterImageSlider;