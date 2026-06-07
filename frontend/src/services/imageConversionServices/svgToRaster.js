export function svgToRaster(svgFile, targetMime) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(svgFile);
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // Fallback to 1024x1024 if the SVG lacks intrinsic dimensions
        canvas.width = img.naturalWidth || 1024;
        canvas.height = img.naturalHeight || 1024;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        
        canvas.toBlob((blob) => {
          if (!blob) reject(new Error('SVG to Canvas generation failed.'));
          else resolve(blob);
        }, targetMime, 0.92);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    
    img.onerror = reject;
    img.src = url;
  });
}