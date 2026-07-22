import { useEffect, useState } from 'react';

const BeforeAfterImageSlider = ({
  originalUrl,
  compressedUrl,
  originalLabel = 'Original',
  compressedLabel = 'Preview',
  originalSize,
  compressedSize,
  originalBlob,
  compressedBlob,
  synchronizePlayback = false,
  loading = false,
  syncError = '',
}) => {
  const [position, setPosition] = useState(50);
  const [syncedUrls, setSyncedUrls] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let ownedUrls = [];

    if (
      !synchronizePlayback ||
      loading ||
      !originalBlob ||
      !compressedBlob
    ) {
      setSyncedUrls(null);
      return undefined;
    }

    setSyncedUrls(null);

    const prepareSynchronizedPair = async () => {
      // Decode both GIFs before either is shown. The final object URLs are
      // created only after preloading, so both visible <img> elements start
      // their animation clocks in the same React render.
      await Promise.all([
        preloadImageBlob(originalBlob),
        preloadImageBlob(compressedBlob),
      ]);

      if (cancelled) return;

      ownedUrls = [
        URL.createObjectURL(originalBlob),
        URL.createObjectURL(compressedBlob),
      ];

      setSyncedUrls({
        originalUrl: ownedUrls[0],
        compressedUrl: ownedUrls[1],
      });
    };

    prepareSynchronizedPair().catch((error) => {
      if (!cancelled) {
        console.error('Could not synchronize GIF previews:', error);
      }
    });

    return () => {
      cancelled = true;
      ownedUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [
    compressedBlob,
    loading,
    originalBlob,
    synchronizePlayback,
  ]);

  const displayOriginalUrl = synchronizePlayback
    ? syncedUrls?.originalUrl
    : originalUrl;
  const displayCompressedUrl = synchronizePlayback
    ? syncedUrls?.compressedUrl
    : compressedUrl || originalUrl;
  const waitingForPair =
    synchronizePlayback && (!syncedUrls || loading);
  const comparisonKey = `${displayOriginalUrl || ''}:${
    displayCompressedUrl || ''
  }`;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100">
      {!waitingForPair && displayOriginalUrl && displayCompressedUrl && (
        <>
          <img
            key={`original-${comparisonKey}`}
            src={displayOriginalUrl}
            alt="Original"
            className="absolute inset-0 h-full w-full object-cover"
          />

          <img
            key={`compressed-${comparisonKey}`}
            src={displayCompressedUrl}
            alt="Compressed preview"
            className="absolute inset-0 h-full w-full object-cover"
            style={{
              clipPath: `inset(0 0 0 ${position}%)`,
            }}
          />
        </>
      )}

      {waitingForPair && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone-100 text-center text-sm font-semibold text-stone-500">
          {!syncError && (
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          )}
          <span>
            {syncError ||
              (loading
                ? 'Generating synchronized GIF preview…'
                : 'Preparing both GIF previews…')}
          </span>
        </div>
      )}

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

const preloadImageBlob = (blob) => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not preload GIF preview.'));
    };
    image.src = url;
  });
};

export default BeforeAfterImageSlider;
