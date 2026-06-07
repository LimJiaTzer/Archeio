export function rasterToRaster(file, targetMime) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D rendering context.');
        
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url); // Clean up memory

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas blob generation failed.'));
          } else {
            resolve(blob);
          }
        }, targetMime, 0.92);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}