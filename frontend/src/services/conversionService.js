import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { getFileInfo, getOutputInfo } from '../lib/fileTypes';
import { heicToAny } from './imageConversionServices/heicToAny';
import { svgToRaster } from './imageConversionServices/svgToRaster';
import { pngToIco } from './imageConversionServices/pngToIco';
import { rasterToRaster } from './imageConversionServices/rasterToRaster';
import { rasterToGif } from './imageConversionServices/rasterToGif';
import { rasterToSvg } from './imageConversionServices/rasterToSvg.js';

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

  // Audio conversions generally target audio
  let out = getOutputInfo(format, 'audio');
  
  const outputExt = out ? out.ext : format.toLowerCase();
  const outputName = `output.${outputExt}`;

  const command = ['-i', file.name];
  // If input is video but we requested an audio extract
  if (file.type.startsWith('video/') && out) command.push('-vn');
  command.push(outputName);

  await ffmpeg.exec(command);
  const data = await ffmpeg.readFile(outputName);
  const mimeType = out?.mime || `audio/${outputExt}`;
  const blob = new Blob([data.buffer], { type: mimeType });

  const downloadUrl = URL.createObjectURL(blob);
  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  return { downloadUrl, convertedFileName: `${baseName}_converted.${outputExt}` };
};

export const convertVideo = async (file, format, ffmpegRef) => {
  const ffmpeg = await ensureFfmpegLoaded(ffmpegRef.current);
  await ffmpeg.writeFile(file.name, await fetchFile(file));

  // Videos can convert to video or extract to audio/images
  let out = getOutputInfo(format, 'video');
  let isAudioFormat = false;

  if (!out) {
    out = getOutputInfo(format, 'audio');
    if (out) isAudioFormat = true;
  }

  const outputExt = out ? out.ext : format.toLowerCase();
  const outputName = `output.${outputExt}`;

  const command = ['-i', file.name];
  if (isAudioFormat) {
    // extract audio
    command.push('-vn');
  }
  command.push(outputName);

  await ffmpeg.exec(command);
  const data = await ffmpeg.readFile(outputName);
  const mimeType = out?.mime || (isAudioFormat ? `audio/${outputExt}` : `video/${outputExt}`);
  const blob = new Blob([data.buffer], { type: mimeType });

  const downloadUrl = URL.createObjectURL(blob);
  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  return { downloadUrl, convertedFileName: `${baseName}_converted.${outputExt}` };
};

// --- HELPER FUNCTIONS ---
// (Assume these are imported or defined above based on your provided snippets)
// convertHeic(f, targetType)
// svgToRaster(f, targetType)
// pngToIco(f)
// canvasConvert(f, targetType)
// convertToGif(f) 
// rasterToSvg(f) 

const converters = {
  // From Raster //
  // --- FROM PNG ---
    'image/png:image/png':     (f) => rasterToRaster(f, 'image/png'),
    'image/png:image/jpeg':    (f) => rasterToRaster(f, 'image/jpeg'),
    'image/png:image/webp':    (f) => rasterToRaster(f, 'image/webp'),
    'image/png:image/gif':     (f) => rasterToGif(f),
    'image/png:image/svg+xml': (f) => rasterToSvg(f),
    'image/png:image/x-icon':  (f) => rasterToRaster(f, 'image/png').then(pngBlob => pngToIco(pngBlob)),

    // --- FROM JPEG ---
    'image/jpeg:image/png':     (f) => rasterToRaster(f, 'image/png'),
    'image/jpeg:image/jpeg':    (f) => rasterToRaster(f, 'image/jpeg'),
    'image/jpeg:image/webp':    (f) => rasterToRaster(f, 'image/webp'),
    'image/jpeg:image/gif':     (f) => rasterToGif(f),
    'image/jpeg:image/svg+xml': (f) => rasterToSvg(f),
    'image/jpeg:image/x-icon':  (f) => rasterToRaster(f, 'image/png').then(pngBlob => pngToIco(pngBlob)),

    // --- FROM WEBP ---
    'image/webp:image/png':     (f) => rasterToRaster(f, 'image/png'),
    'image/webp:image/jpeg':    (f) => rasterToRaster(f, 'image/jpeg'),
    'image/webp:image/webp':    (f) => rasterToRaster(f, 'image/webp'),
    'image/webp:image/gif':     (f) => rasterToGif(f),
    'image/webp:image/svg+xml': (f) => rasterToSvg(f),
    'image/webp:image/x-icon':  (f) => rasterToRaster(f, 'image/png').then(pngBlob => pngToIco(pngBlob)),

    // --- FROM BMP ---
    'image/bmp:image/png':     (f) => rasterToRaster(f, 'image/png'),
    'image/bmp:image/jpeg':    (f) => rasterToRaster(f, 'image/jpeg'),
    'image/bmp:image/webp':    (f) => rasterToRaster(f, 'image/webp'),
    'image/bmp:image/gif':     (f) => rasterToGif(f),
    'image/bmp:image/svg+xml': (f) => rasterToSvg(f),
    'image/bmp:image/x-icon':  (f) => rasterToRaster(f, 'image/png').then(pngBlob => pngToIco(pngBlob)),

  // ==========================================
  // SVG
  // ==========================================
  // From SVG to Raster (Canvas)
  'image/svg+xml:image/png':  (f) => svgToRaster(f, 'image/png'),
  'image/svg+xml:image/jpeg': (f) => svgToRaster(f, 'image/jpeg'),
  'image/svg+xml:image/webp': (f) => svgToRaster(f, 'image/webp'),
  
  // To GIF
  'image/svg+xml:image/gif':  (f) => svgToRaster(f, 'image/png').then(pngBlob => rasterToGif(pngBlob)),
  
  // To ICO
  'image/svg+xml:image/x-icon': (f) => svgToRaster(f, 'image/png').then(pngBlob => pngToIco(pngBlob)),


  // ==========================================
  // HEIC / HEIF
  // ==========================================
  // From HEIC to Raster and gif (Needs heic2any)
  'image/heic:image/png':  (f) => heicToAny(f, 'image/png'),
  'image/heic:image/jpeg': (f) => heicToAny(f, 'image/jpeg'),
  'image/heic:image/webp': (f) => heicToAny(f, 'image/webp'),
  'image/heic:image/gif':  (f) => heicToAny(f, 'image/gif'),
  
  // From HEIC to ICO (heic2any + ico)
  'image/heic:image/x-icon': (f) => heicToAny(f, 'image/png').then(png => pngToIco(png)),
};

// --- MAIN EXECUTION FUNCTION ---
export async function convertImage(file, format) {
  // Normalize types (e.g., handling generic jpeg/jpg aliases)
  const fromType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  const out = getOutputInfo(format, 'images');
  const toType = out?.mime || `image/${format.toLowerCase()}`;
  const outputExt = out?.ext || format.toLowerCase();

  const key = `${fromType}:${toType}`;
  const handler = converters[key];
  
  if (!handler) {
    throw new Error(`Conversion from ${fromType} to ${toType} is not supported or not feasible client-side.`);
  }
  
  const blob = await handler(file);
  const downloadUrl = URL.createObjectURL(blob);
  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  return { downloadUrl, convertedFileName: `${baseName}_converted.${outputExt}` };
}

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
