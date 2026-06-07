import GIF from 'gif.js'; 
// Note: GIF.js usually requires you to host its worker file (gif.worker.js) in your public folder.

export function rasterToGif(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Handle potential ESM default export wrapping
        const GIFEncoder = typeof GIF === 'function' ? GIF : GIF.default;
        
        // Initialize GIF encoder
        const gif = new GIFEncoder({
          workers: 2,
          quality: 10,
          width: canvas.width,
          height: canvas.height,
          workerScript: '/gif.worker.js' // MUST point to wherever you serve the worker
        });
        
        // Add the single canvas as a frame
        gif.addFrame(canvas, { delay: 0 });
        
        gif.on('finished', (blob) => {
          URL.revokeObjectURL(url);
          resolve(blob);
        });
        
        gif.on('error', (err) => {
          URL.revokeObjectURL(url);
          reject(err);
        });
        
        gif.render();
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