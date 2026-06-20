import { fetchFile, toBlobURL } from '@ffmpeg/util';
import JSZip from 'jszip';
import { getFileInfo, getOutputInfo } from '../lib/fileTypes';
import { heicToAny } from './imageConversionServices/heicToAny';
import { svgToRaster } from './imageConversionServices/svgToRaster';
import { pngToIco } from './imageConversionServices/pngToIco';
import { rasterToRaster } from './imageConversionServices/rasterToRaster';
import { rasterToGif } from './imageConversionServices/rasterToGif';
import { rasterToSvg } from './imageConversionServices/rasterToSvg';
import { extractGifFrames, extractIcoFrames } from './imageConversionServices/extractFrames';
import { anyToHeic } from './imageConversionServices/anyToHeic';

// Document conversion services
import { htmlToPdf } from './documentConversionServices/htmlToPdf';
import { txtToPdf } from './documentConversionServices/txtToPdf';
import { docxToPdf } from './documentConversionServices/docxToPdf';
import { xlsxToPdf } from './documentConversionServices/xlsxToPdf';
import { rtfToPdf } from './documentConversionServices/rtfToPdf';
import { epubToPdf } from './documentConversionServices/epubToPdf';
import { pptxToPdf } from './documentConversionServices/pptxToPdf';
import { backendToPdf } from './documentConversionServices/backendToPdf';

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

export const extractFrames = async (file) => {
  if (file.type === 'image/gif') {
    return await extractGifFrames(file);
  }
  if (file.type === 'image/x-icon' || file.type === 'image/vnd.microsoft.icon') {
    return await extractIcoFrames(file);
  }
  return [];
};

export const zipBlobs = async (blobs, baseFileName, targetFormat) => {
  const zip = new JSZip();
  const info = getOutputInfo(targetFormat, 'images');
  const ext = info?.ext || targetFormat.toLowerCase();
  
  for (let i = 0; i < blobs.length; i++) {
    const blob = blobs[i];
    let finalBlob = blob;
    // If targetFormat is not PNG (which is what extraction gives), we need to convert
    if (info && info.mime !== 'image/png') {
      try {
        finalBlob = await rasterToRaster(blob, info.mime);
      } catch (e) {
        console.error(`Failed to convert frame ${i} to ${targetFormat}`, e);
      }
    }
    
    zip.file(`frame_${i + 1}.${ext}`, finalBlob);
  }
  
  const content = await zip.generateAsync({ type: 'blob' });
  const downloadUrl = URL.createObjectURL(content);
  return { downloadUrl, convertedFileName: `${baseFileName}_frames.zip`, size: content.size };
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
  return { downloadUrl, convertedFileName: `${baseName}_converted.${outputExt}`, size: blob.size };
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
  return { downloadUrl, convertedFileName: `${baseName}_converted.${outputExt}`, size: blob.size };
};

const converters = {
  // ==========================================
  // Raster
  // ==========================================
  // --- FROM PNG ---
    'image/png:image/png':     (f) => rasterToRaster(f, 'image/png'),
    'image/png:image/jpeg':    (f) => rasterToRaster(f, 'image/jpeg'),
    'image/png:image/webp':    (f) => rasterToRaster(f, 'image/webp'),
    'image/png:image/gif':     (f) => rasterToGif(f),
    'image/png:image/svg+xml': (f) => rasterToSvg(f),
    'image/png:image/x-icon':  (f) => rasterToRaster(f, 'image/png').then(pngBlob => pngToIco(pngBlob)),
    'image/png:image/heic':    (f) => anyToHeic(f),

    // --- FROM JPEG ---
    'image/jpeg:image/png':     (f) => rasterToRaster(f, 'image/png'),
    'image/jpeg:image/jpeg':    (f) => rasterToRaster(f, 'image/jpeg'),
    'image/jpeg:image/webp':    (f) => rasterToRaster(f, 'image/webp'),
    'image/jpeg:image/gif':     (f) => rasterToGif(f),
    'image/jpeg:image/svg+xml': (f) => rasterToSvg(f),
    'image/jpeg:image/x-icon':  (f) => rasterToRaster(f, 'image/png').then(pngBlob => pngToIco(pngBlob)),
    'image/jpeg:image/heic':    (f) => anyToHeic(f),

    // --- FROM WEBP ---
    'image/webp:image/png':     (f) => rasterToRaster(f, 'image/png'),
    'image/webp:image/jpeg':    (f) => rasterToRaster(f, 'image/jpeg'),
    'image/webp:image/webp':    (f) => rasterToRaster(f, 'image/webp'),
    'image/webp:image/gif':     (f) => rasterToGif(f),
    'image/webp:image/svg+xml': (f) => rasterToSvg(f),
    'image/webp:image/x-icon':  (f) => rasterToRaster(f, 'image/png').then(pngBlob => pngToIco(pngBlob)),
    'image/webp:image/heic':    (f) => anyToHeic(f),

    // --- FROM BMP ---
    'image/bmp:image/png':     (f) => rasterToRaster(f, 'image/png'),
    'image/bmp:image/jpeg':    (f) => rasterToRaster(f, 'image/jpeg'),
    'image/bmp:image/webp':    (f) => rasterToRaster(f, 'image/webp'),
    'image/bmp:image/gif':     (f) => rasterToGif(f),
    'image/bmp:image/svg+xml': (f) => rasterToSvg(f),
    'image/bmp:image/x-icon':  (f) => rasterToRaster(f, 'image/png').then(pngBlob => pngToIco(pngBlob)),
    'image/bmp:image/heic':    (f) => anyToHeic(f),

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
  // From HEIC to Raster and gif 
  'image/heic:image/png':  (f) => heicToAny(f, 'image/png'),
  'image/heic:image/jpeg': (f) => heicToAny(f, 'image/jpeg'),
  'image/heic:image/webp': (f) => heicToAny(f, 'image/webp'),
  'image/heic:image/gif':  (f) => heicToAny(f, 'image/gif'),
  
  // From HEIC to ICO (heic2any + ico)
  'image/heic:image/x-icon': (f) => heicToAny(f, 'image/png').then(png => pngToIco(png)),

  // ==========================================
  // GIF (Direct conversion defaults to first frame)
  // ==========================================
  'image/gif:image/png':  (f) => extractGifFrames(f).then(frames => frames[0]),
  'image/gif:image/jpeg': (f) => extractGifFrames(f).then(frames => rasterToRaster(frames[0], 'image/jpeg')),
  'image/gif:image/webp': (f) => extractGifFrames(f).then(frames => rasterToRaster(frames[0], 'image/webp')),
  'image/gif:image/svg+xml': (f) => extractGifFrames(f).then(frames => rasterToSvg(frames[0])),
  'image/gif:image/x-icon': (f) => extractGifFrames(f).then(frames => pngToIco(frames[0])),

  // ==========================================
  // ICO (Direct conversion defaults to first/primary image)
  // ==========================================
  'image/x-icon:image/png':  (f) => extractIcoFrames(f).then(frames => frames[0]),
  'image/x-icon:image/jpeg': (f) => extractIcoFrames(f).then(frames => rasterToRaster(frames[0], 'image/jpeg')),
  'image/x-icon:image/webp': (f) => extractIcoFrames(f).then(frames => rasterToRaster(frames[0], 'image/webp')),
  'image/x-icon:image/gif':  (f) => extractIcoFrames(f).then(frames => rasterToGif(frames[0])),
  'image/x-icon:image/svg+xml': (f) => extractIcoFrames(f).then(frames => rasterToSvg(frames[0])),
};

const documentConverters = {
  'application/pdf:application/pdf': (f) => f, // No-op
  'text/html:application/pdf': (f) => backendToPdf(f),
  'text/plain:application/pdf': (f) => backendToPdf(f),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document:application/pdf': (f) => backendToPdf(f),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:application/pdf': (f) => backendToPdf(f),
  'application/rtf:application/pdf': (f) => backendToPdf(f),
  'application/epub+zip:application/pdf': (f) => backendToPdf(f),
  'application/vnd.openxmlformats-officedocument.presentationml.presentation:application/pdf': (f) => backendToPdf(f),
};

// --- MAIN EXECUTION FUNCTION ---
export async function convertImage(file, format) {
  // Normalize input types
  let fromType = file.type;
  // handle jepg and ico naming variations
  if (fromType === 'image/jpg' || fromType === 'image/jpeg') fromType = 'image/jpeg';
  if (fromType === 'image/x-icon' || fromType === 'image/vnd.microsoft.icon') fromType = 'image/x-icon';

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
  return { downloadUrl, convertedFileName: `${baseName}_converted.${outputExt}`, size: blob.size };
}

export const convertDocument = async (file, format) => {
  const info = getOutputInfo(format, 'documents');
  const toType = info?.mime || 'application/pdf';
  const fromType = file.type;

  const key = `${fromType}:${toType}`;
  const handler = documentConverters[key];

  if (handler) {
    const blob = await handler(file);
    const downloadUrl = URL.createObjectURL(blob);
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const ext = info?.ext || 'pdf';
    return { downloadUrl, convertedFileName: `${baseName}_converted.${ext}`, size: blob.size };
  }

  // If source is image-like, reuse image conversion
  if (file.type.startsWith('image/')) {
    return convertImage(file, format);
  }

  // Fallback: return original file data URL with new extension
  const ext = info?.ext || (format || '').toLowerCase();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const dataUrl = e.target?.result || '';
      const head = dataUrl.indexOf(',');
      const size = head !== -1 ? Math.round((dataUrl.length - head - 1) * 3 / 4) : file.size;
      resolve({ downloadUrl: dataUrl, convertedFileName: `${baseName}_converted.${ext}`, size });
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
