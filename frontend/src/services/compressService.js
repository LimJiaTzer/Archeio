import { getOutputInfo } from '../lib/fileTypes';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

// Helps with Audio and Video compression 
const ffmpeg = new FFmpeg();

const loadFFmpeg = async () => {
  if (!ffmpeg.loaded) {
    await ffmpeg.load();
  }
};

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
// TODO: Extension --> allow for rendering and adjusting of quality of output pdf !!  (Go do audio first )
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

export const compressAudio = async ({ // don ned format cos ffmpeg extracts it from file directly
  file,
  ratio,
  setDownloadUrl,
  setCompressedFileName,
  setResult,
  setCompressing,
}) => {
  try {
    await loadFFmpeg();

    const inputName = file.name;
    const outputName = 'compressed_audio.mp3';

    const audio = new Audio();
    const audioUrl = URL.createObjectURL(file);
    audio.src = audioUrl;

    await new Promise((resolve, reject) => {
      audio.onloadedmetadata = resolve;
      audio.onerror = reject;
    });

    const duration = audio.duration;
    URL.revokeObjectURL(audioUrl);

    const estimatedBitrate = Math.round((file.size * 8) / duration / 1000);

    const getAudioBitrate = (ratio, originalBitrate) => {     // can change to use ratio in future 
      let finalBitrate = 320;
      if (ratio >= 25) finalBitrate = 192;
      if (ratio >= 50) finalBitrate = 128;
      if (ratio >= 60) finalBitrate = 96;
      if (ratio >= 75) finalBitrate = 64;
      if (ratio >= 90) finalBitrate = 48;
      return `${Math.min(originalBitrate, finalBitrate)}k`;
    }

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    await ffmpeg.exec([
      '-i', inputName,
      '-b:a', getAudioBitrate(ratio, estimatedBitrate),
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: 'audio/mpeg' });
    const downloadUrl = URL.createObjectURL(blob);

    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const savedPercentage = Math.round(((file.size - blob.size) / file.size) * 100);

    setDownloadUrl(downloadUrl);
    setCompressedFileName(`${baseName}_compressed.mp3`);
    setResult({
      originalSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      compressedSize: (blob.size / 1024 / 1024).toFixed(2) + ' MB',
      ratio: Math.max(0, savedPercentage) + '%',
    });
  } catch (err) {
    console.error('Audio compression error:', err);
    alert(err.message || 'Audio compression failed.');
  } finally {
    setCompressing(false);
  }
};

// Video compression logic 
export const compressVideo = () => {
  alert('Video compression not supported yet.');
  // TODO: 
};


