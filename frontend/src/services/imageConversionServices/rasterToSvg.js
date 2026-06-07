export async function rasterToSvg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // Extract as base64 PNG
        const dataUrlPng = canvas.toDataURL('image/png');
        
        // Wrap in SVG tags
        const svgContent = `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">
          <image href="${dataUrlPng}" width="${canvas.width}" height="${canvas.height}" />
        </svg>`;
        
        URL.revokeObjectURL(url);
        
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        resolve(blob);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    
    img.onerror = reject;
    img.src = url;
  });
}