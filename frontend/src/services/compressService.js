import { getOutputInfo } from '../lib/fileTypes';

// Image compression logic 
export const compressImage = ({
  file,
  ratio,
  format,
  setDownloadUrl,
  setCompressedFileName,
  setResult,
  setCompressing,
}) => {
  const reader = new FileReader();

  reader.onload = (e) => {
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');

        let scale = 1.0;
        if (ratio > 75) {
            scale = 0.7;
        } else if (ratio > 50) {
            scale = 0.85;
        }

        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not create canvas context');

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // quality range = [0.05, 0.95] 
        const quality = Math.max(0.05, Math.min(0.95, (100 - ratio) / 100));

        // Output type form dictionary in compressService.js 
        const outputType = getOutputInfo(format, 'images');
        if (!outputType) {
          throw new Error(`${format} output is not supported yet`);
        }

        const dataUrl =
          outputType.mime === 'image/png'
            ? canvas.toDataURL(outputType.mime)
            : canvas.toDataURL(outputType.mime, quality);

        const base64Str = dataUrl.split(',')[1];
        const actualCompressedBytes = atob(base64Str).length;
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

        const savedPercentage = Math.round(
          ((file.size - actualCompressedBytes) / file.size) * 100
        );

        setDownloadUrl(dataUrl);
        setCompressedFileName(`${baseName}_compressed.${outputType.ext}`);
        setResult({
          originalSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          compressedSize:
            (actualCompressedBytes / 1024 / 1024).toFixed(2) + ' MB',
          ratio: Math.max(0, savedPercentage) + '%',
        });
        setCompressing(false);
      } catch (err) {
        console.error('Image compression error:', err);
        setCompressing(false);
        alert(err.message);
      }
    };

    img.onerror = () => {
      setCompressing(false);
      alert('This image type cannot be loaded by the browser.');
    };

    img.src = e.target?.result;
  };

  reader.onerror = () => {
    setCompressing(false);
    alert('Error reading file.');
  };

  reader.readAsDataURL(file);
};


// TODO: Introduce batch processing next time 
// TODO: Extension --> allow for rendering and adjusting of quality of output pdf 
// Backend required for GhostScript to work 
// PDF compression logic
export const compressDocument = async ({
  file,
  ratio,
  setDownloadUrl,
  setCompressedFileName,
  setResult,
  setCompressing,
}) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('ratio', ratio);

    const response = await fetch('http://localhost:3001/compress-pdf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('PDF compression failed.');
    }

    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);

    const baseName = file.name.replace(/\.pdf$/i, '');
    const compressedSize = blob.size;

    const savedPercentage = Math.round(
      ((file.size - compressedSize) / file.size) * 100
    );

    setDownloadUrl(downloadUrl);
    setCompressedFileName(`${baseName}_compressed.pdf`);
    setResult({
      originalSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      compressedSize: (compressedSize / 1024 / 1024).toFixed(2) + ' MB',
      ratio: Math.max(0, savedPercentage) + '%',
    });
  } catch (err) {
    console.error('PDF compression error:', err);
    alert(err.message);
  } finally {
    setCompressing(false);
  }
};

export const compressAudio = () => {
  alert('Audio compression not supported yet.');
  // TODO:
};

// Video compression logic 
export const compressVideo = () => {
  alert('Video compression not supported yet.');
  // TODO: 
};


