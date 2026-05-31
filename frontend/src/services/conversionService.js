import { fetchFile, toBlobURL } from '@ffmpeg/util';
import {getFileInfo, getOutputInfo}from '../lib/fileTypes';

const ensureFfmpegLoaded = async (ffmpeg) => {
  if (ffmpeg.loaded) return ffmpeg;
  ffmpeg.on('log', ({ message }) => console.log(message));
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  return ffmpeg;
};

export const convertAudio = async (file, format, ffmpegRef) => {
  const ffmpeg = await ensureFfmpegLoaded(ffmpegRef.current);
  await ffmpeg.writeFile(file.name, await fetchFile(file));

  const out = getOutputInfo(format, 'audio');
  const outputExt = out ? out.ext : format.toLowerCase();
  const outputName = `output.${outputExt}`;

  const isAudioFormat = Object.keys(AUDIO_OUTPUT_TYPES).map(k => k.toLowerCase()).includes(outputExt);
  const command = ['-i', file.name];
  // If input is video and output is audio, drop video stream
  if (file.type.startsWith('video/') && isAudioFormat) command.push('-vn');
  command.push(outputName);

  await ffmpeg.exec(command);
  const data = await ffmpeg.readFile(outputName);
  const mimeType = isAudioFormat ? (out?.mime || `audio/${outputExt}`) : `application/octet-stream`;
  const blob = new Blob([data.buffer], { type: mimeType });

  const downloadUrl = URL.createObjectURL(blob);
  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  return { downloadUrl, convertedFileName: `${baseName}_converted.${outputExt}` };
};

export const convertVideo = async (file, format, ffmpegRef) => {
  const ffmpeg = await ensureFfmpegLoaded(ffmpegRef.current);
  await ffmpeg.writeFile(file.name, await fetchFile(file));

  const out = getOutputInfo(format, 'video');
  const outputExt = out ? out.ext : format.toLowerCase();
  const outputName = `output.${outputExt}`;

  const isAudioFormat = Object.keys(AUDIO_OUTPUT_TYPES).map(k => k.toLowerCase()).includes(outputExt);
  const command = ['-i', file.name];
  if (isAudioFormat) {
    // extract audio
    command.push('-vn');
  }
  command.push(outputName);

  await ffmpeg.exec(command);
  const data = await ffmpeg.readFile(outputName);
  const mimeType = isAudioFormat ? (AUDIO_OUTPUT_TYPES[outputExt.toUpperCase()]?.mime || `audio/${outputExt}`) : (VIDEO_OUTPUT_TYPES[outputExt.toUpperCase()]?.mime || `video/${outputExt}`);
  const blob = new Blob([data.buffer], { type: mimeType });

  const downloadUrl = URL.createObjectURL(blob);
  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  return { downloadUrl, convertedFileName: `${baseName}_converted.${outputExt}` };
};

export const convertImage = async (file, format) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get 2D rendering context.');
          ctx.drawImage(img, 0, 0);

          const info = getOutputInfo(format, 'images');
          let mimeType = info?.mime || 'image/png';
          let extension = info ? `.${info.ext}` : '.png';

          // Special-case PDF: use JPEG base (keeps previous behavior)
          if ((format || '').toUpperCase() === 'PDF') {
            mimeType = 'image/jpeg';
            extension = '.pdf';
          }

          const dataUrl = canvas.toDataURL(mimeType, 0.92);
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const convertedFileName = `${baseName}_converted${extension}`;
          resolve({ downloadUrl: dataUrl, convertedFileName });
        } catch (err) {
          console.error('Canvas conversion failed:', err);
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          resolve({ downloadUrl: e.target?.result || '', convertedFileName: `${baseName}_converted.${(format||'png').toLowerCase()}` });
        }
      };
      img.onerror = () => {
        // Fallback for non-image files
        setTimeout(() => {
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          resolve({ downloadUrl: e.target?.result || '', convertedFileName: `${baseName}_converted.${(format||'png').toLowerCase()}` });
        }, 1200);
      };
      img.src = e.target?.result;
    };
    reader.onerror = () => reject(new Error('Error reading file.'));
    reader.readAsDataURL(file);
  });
};

export const convertDocument = async (file, format) => {
  // For simple document conversions we attempt an image-based approach (where applicable)
  // Otherwise return the raw file as a fallback with new extension
  const info = getOutputInfo(format, 'documents');
  const ext = info?.ext || (format || '').toLowerCase();
  // If source is image-like, reuse image conversion
  if (file.type.startsWith('image/')) {
    return convertImage(file, format);
  }

  // Fallback: return original file data URL with new extension
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      resolve({ downloadUrl: e.target?.result || '', convertedFileName: `${baseName}_converted.${ext}` });
    };
    reader.onerror = () => reject(new Error('Error reading file.'));
    reader.readAsDataURL(file);
  });
};

export const convertMedia = async (file, format, ffmpegRef) => {
  const info = getFileInfo(file.type);
  if (info && info.category === 'audio') return await convertAudio(file, format, ffmpegRef);
  if (info && info.category === 'video') return await convertVideo(file, format, ffmpegRef);
  if (info && info.category === 'images') return await convertImage(file, format);
  if (info && info.category === 'documents') return await convertDocument(file, format);

  // Default fallback: attempt image/document conversion path
  if (file.type.startsWith('image/')) return await convertImage(file, format);
  return await convertDocument(file, format);
};
