import { getFileInfo, getOutputInfo } from '../lib/fileTypes';
import { convertMedia } from './conversionService';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

// image conversion 
import { convertImage } from './conversionService';
import { svgToRaster } from './imageConversionServices/svgToRaster';
import { extractGifFrames, extractIcoFrames } from './imageConversionServices/extractFrames';
import { rasterToRaster } from './imageConversionServices/rasterToRaster';
import { rasterToGif } from './imageConversionServices/rasterToGif';
import { pngToIco } from './imageConversionServices/pngToIco';
import { normalizeImageForCompression, compressRasterWithCanvas } from './compressionHelpers/imageCompressionHelper';
import { convertDocument } from './conversionService';
import { rasterToAvif } from './compressionHelpers/rasterToAvif';

// Helps with Audio and Video compression 
const ffmpeg = new FFmpeg();

const loadFFmpeg = async () => {
  if (!ffmpeg.loaded) {
    await ffmpeg.load();
  }
};

// Image compression logic 
// TODO: Compression for svg gif and heic 
// export const compressImage = ({
//   file,
//   ratio,
//   format,
//   fileInfo,
//   setDownloadUrl,
//   setCompressedFileName,
//   setResult,
//   setCompressing,
//   setWarning,
// }) => {  
//   const reader = new FileReader();

//   reader.onload = (e) => {
//     const img = new Image();

//     img.onload = () => {
//       try {
//         // Output type form dictionary in compressService.js 
//         const outputType = getOutputInfo(format, 'images');
//         if (!outputType) {
//           throw new Error(`${format} output is not supported yet`);
//         }
//         const inputFormat = fileInfo.format.toLowerCase();
//         const outputFormat = outputType.ext.toLowerCase();

//         const canvas = document.createElement('canvas');

//         let scale = 1.0;
//         if (ratio > 75) {
//             scale = 0.7;
//         } else if (ratio > 50) {
//             scale = 0.85;
//         }

//         canvas.width = img.width * scale;
//         canvas.height = img.height * scale;

//         const ctx = canvas.getContext('2d');
//         if (!ctx) throw new Error('Could not create canvas context');

//         ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

//         // quality range = [0.05, 0.95] 
//         const quality = Math.max(0.05, Math.min(0.95, (100 - ratio) / 100));



//         const dataUrl =
//           outputType.mime === 'image/png'
//             ? canvas.toDataURL(outputType.mime)
//             : canvas.toDataURL(outputType.mime, quality);

//         const base64Str = dataUrl.split(',')[1];
//         const actualCompressedBytes = atob(base64Str).length;
//         if (actualCompressedBytes >= file.size) {
//           if (inputFormat === outputFormat) {
//             throw new Error('This image file is already highly compressed');
//           } else {
//             // show disclaimer
//             setWarning('File size may have increased due to format type');
//           }
//         }


//         const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

//         const savedPercentage = Math.round(
//           ((file.size - actualCompressedBytes) / file.size) * 100
//         );

//         setDownloadUrl(dataUrl);
//         setCompressedFileName(`${baseName}_compressed.${outputType.ext}`);
//         setResult({
//           originalSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
//           compressedSize:
//             (actualCompressedBytes / 1024 / 1024).toFixed(2) + ' MB',
//           ratio: Math.max(0, savedPercentage) + '%',
//         });
//         setCompressing(false);
//       } catch (err) {
//         console.error('Image compression error:', err);
//         setCompressing(false);
//         alert(err.message);
//       }
//     };

//     img.onerror = () => {
//       setCompressing(false);
//       alert('This image type cannot be loaded by the browser.');
//     };

//     img.src = e.target?.result;
//   };

//   reader.onerror = () => {
//     setCompressing(false);
//     alert('Error reading file.');
//   };

//   reader.readAsDataURL(file);
// };

// process if is svg/ico/gif wtvrtype --> png --> wtvr type
export const compressImage = async ({
  file,
  ratio,
  format,
  fileInfo,
  setDownloadUrl,
  setCompressedFileName,
  setResult,
  setCompressing,
  setWarning,
}) => {
  try {
    const outputType = getOutputInfo(format, 'images');

    if (!outputType) {
      throw new Error(`${format} output is not supported yet`);
    }

    const inputFormat = fileInfo.format.toLowerCase();
    const outputFormat = outputType.ext.toLowerCase();

    // Step 1: normalize awkward image types into something canvas can load
    const normalizedBlob = await normalizeImageForCompression(file);

    // Step 2: compress into an intermediate raster format
    // Use PNG as intermediate for GIF/ICO because canvas cannot really encode GIF/ICO.
    const needsSpecialOutput =
      outputType.mime === 'image/gif' ||
      outputType.mime === 'image/x-icon' ||
      outputType.mime === 'image/vnd.microsoft.icon' ||
      outputType.mime === 'image/avif';

    const canvasOutputMime = needsSpecialOutput
      ? 'image/png'
      : outputType.mime;

    const compressedRasterBlob = await compressRasterWithCanvas(
      normalizedBlob,
      canvasOutputMime,
      ratio
    );

    // Step 3: convert compressed raster into final requested output if needed
    let finalBlob = compressedRasterBlob;

    if (outputType.mime === 'image/gif') {
      finalBlob = await rasterToGif(compressedRasterBlob);
    }

    if (
      outputType.mime === 'image/x-icon' ||
      outputType.mime === 'image/vnd.microsoft.icon'
    ) {
      finalBlob = await pngToIco(compressedRasterBlob);
    }

    if (outputType.mime === 'image/avif') {
      finalBlob = await rasterToAvif(compressedRasterBlob, ratio);
    }

    const actualCompressedBytes = finalBlob.size;

    if (actualCompressedBytes >= file.size) {
      if (inputFormat === outputFormat) {
        throw new Error('This image file is already highly compressed');
      } else {
        setWarning('File size may have increased due to format type');
      }
    }

    const downloadUrl = URL.createObjectURL(finalBlob);
    const baseName =
      file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

    const savedPercentage = Math.round(
      ((file.size - actualCompressedBytes) / file.size) * 100
    );

    setDownloadUrl(downloadUrl);
    setCompressedFileName(`${baseName}_compressed.${outputType.ext}`);

    setResult({
      originalSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      compressedSize: (actualCompressedBytes / 1024 / 1024).toFixed(2) + ' MB',
      ratio: Math.max(0, savedPercentage) + '%',
    });

    setCompressing(false);
  } catch (err) {
    console.error('Image compression error:', err);
    setCompressing(false);
    alert(err.message);
  }
};


// Backend required for GhostScript to work 
// PDF compression logic
// export const compressDocument = async ({
//   file,
//   ratio,
//   setDownloadUrl,
//   setCompressedFileName,
//   setResult,
//   setCompressing,
// }) => {
//   try {
//     const formData = new FormData();
//     formData.append('file', file);
//     formData.append('ratio', ratio);

//     const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
//     const response = await fetch(`${API_URL}/compress-pdf`, {
//       method: 'POST',
//       body: formData,
//     });

//     if (!response.ok) {
//       throw new Error('PDF compression failed.');
//     }

//     const blob = await response.blob();
//     const downloadUrl = URL.createObjectURL(blob);

//     const baseName = file.name.replace(/\.pdf$/i, '');
//     const compressedSize = blob.size;

//     if (compressedSize >= file.size) {
//       throw new Error('This document file is already highly compressed');
//       // if (inputFormat === outputFormat) {
//       //   throw new Error('This document file is alreay highly compressed');
//       // } else {
//       //   // show disclaimer
//       //   setWarning('File size may have increased due to format type');
//       // }
//     }

//     const savedPercentage = Math.round(
//       ((file.size - compressedSize) / file.size) * 100
//     );

//     setDownloadUrl(downloadUrl);
//     setCompressedFileName(`${baseName}_compressed.pdf`);
//     setResult({
//       originalSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
//       compressedSize: (compressedSize / 1024 / 1024).toFixed(2) + ' MB',
//       ratio: Math.max(0, savedPercentage) + '%',
//     });
//   } catch (err) {
//     console.error('PDF compression error:', err);
//     alert(err.message);
//   } finally {
//     setCompressing(false);
//   }
// };

// export const compressDocument = async ({
//   file,
//   ratio,
//   setDownloadUrl,
//   setCompressedFileName,
//   setResult,
//   setCompressing,
//   setWarning,
// }) => {
//   try {
//     const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

//     const inputIsPdf = file.type === 'application/pdf';

//     let pdfBlob = file;
//     let pdfFileName = file.name;

//     if (!inputIsPdf) {
//       const converted = await convertDocument(file, 'PDF');

//       const pdfResponse = await fetch(converted.downloadUrl);
//       pdfBlob = await pdfResponse.blob();

//       pdfFileName = converted.convertedFileName;

//       if (converted.downloadUrl.startsWith('blob:')) {
//         URL.revokeObjectURL(converted.downloadUrl);
//       }
//     }

//     const formData = new FormData();
//     formData.append('file', pdfBlob, pdfFileName);
//     formData.append('ratio', ratio);

//     const response = await fetch(`${API_URL}/compress-pdf`, {
//       method: 'POST',
//       body: formData,
//     });

//     if (!response.ok) {
//       const errorText = await response.text();
//       throw new Error(errorText || 'PDF compression failed.');
//     }

//     const compressedBlob = await response.blob();
//     const downloadUrl = URL.createObjectURL(compressedBlob);

//     const compressedSize = compressedBlob.size;

//     if (compressedSize >= file.size) {
//       if (inputIsPdf) {
//         throw new Error('This document file is already highly compressed');
//       } else {
//         setWarning?.('File size may have increased because it was converted to PDF first');
//       }
//     }

//     const savedPercentage = Math.round(
//       ((file.size - compressedSize) / file.size) * 100
//     );

//     const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

//     setDownloadUrl(downloadUrl);
//     setCompressedFileName(`${baseName}_compressed.pdf`);

//     setResult({
//       originalSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
//       compressedSize: (compressedSize / 1024 / 1024).toFixed(2) + ' MB',
//       ratio: Math.max(0, savedPercentage) + '%',
//     });
//   } catch (err) {
//     console.error('Document compression error:', err);
//     alert(err.message);
//   } finally {
//     setCompressing(false);
//   }
// };

export const compressDocument = async ({
  file,
  ratio,
  format,
  fileInfo,
  setDownloadUrl,
  setCompressedFileName,
  setResult,
  setCompressing,
  setWarning,
}) => {
  try {
    const inputFormat = fileInfo.format.toLowerCase();
    const outputFormat = format.toLowerCase();

    const nativeDocumentCompressible = [
      // Modern Microsoft Office
      'docx',
      'pptx',
      'xlsx',

      // OpenDocument / LibreOffice
      'odt',
      'odp',
      'ods',

      // Old Microsoft Office
      'doc',
      'ppt',
      'xls',

      // Text-ish
      'txt',
      'csv',
      'md',

      // Rich text / ebook
      'rtf',
      'epub',
    ];

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

    const baseName =
      file.name.substring(0, file.name.lastIndexOf('.')) || file.name;

    // Case 1: PDF -> PDF
    if (inputFormat === 'pdf' && outputFormat === 'pdf') {
      const compressedBlob = await compressPdfViaBackend({
        file,
        ratio,
        API_URL,
      });

      return handleCompressedResult({
        originalFile: file,
        compressedBlob,
        outputFormat: 'pdf',
        outputMime: 'application/pdf',
        baseName,
        setDownloadUrl,
        setCompressedFileName,
        setResult,
        setWarning,
      });
    }

    // Case 2: DOCX/PPTX/XLSX/ODT/ODP/ODS/etc -> same type
    if (inputFormat === outputFormat) {
      if (!nativeDocumentCompressible.includes(inputFormat)) {
        throw new Error(`${inputFormat.toUpperCase()} native compression is not supported yet.`);
      }

      const compressedBlob = await compressOfficeViaBackend({
        file,
        ratio,
        API_URL,
      });

      const outputType = getOutputInfo(outputFormat, 'documents');

      return handleCompressedResult({
        originalFile: file,
        compressedBlob,
        outputFormat,
        outputMime: outputType?.mime || file.type,
        baseName,
        setDownloadUrl,
        setCompressedFileName,
        setResult,
        setWarning,
      });
    }

    // Case 3: Any document -> PDF
    if (outputFormat === 'pdf') {
      const converted = await convertDocument(file, 'PDF');

      const pdfResponse = await fetch(converted.downloadUrl);
      const pdfBlob = await pdfResponse.blob();

      if (converted.downloadUrl.startsWith('blob:')) {
        URL.revokeObjectURL(converted.downloadUrl);
      }

      const compressedBlob = await compressPdfViaBackend({
        file: pdfBlob,
        ratio,
        API_URL,
        fileName: converted.convertedFileName,
      });

      return handleCompressedResult({
        originalFile: file,
        compressedBlob,
        outputFormat: 'pdf',
        outputMime: 'application/pdf',
        baseName,
        setDownloadUrl,
        setCompressedFileName,
        setResult,
        setWarning,
        sizeWarning:
          compressedBlob.size >= file.size
            ? 'File size may have increased because it was converted to PDF first'
            : '',
      });
    }

    throw new Error(
      `${inputFormat.toUpperCase()} to ${outputFormat.toUpperCase()} is not supported.`
    );
  } catch (err) {
    console.error('Document compression error:', err);
    alert(err.message || 'Document compression failed.');
  } finally {
    setCompressing(false);
  }
};

const compressPdfViaBackend = async ({
  file,
  ratio,
  API_URL,
  fileName,
}) => {
  const formData = new FormData();

  formData.append('file', file, fileName || file.name || 'document.pdf');
  formData.append('ratio', ratio);

  const response = await fetch(`${API_URL}/compress-pdf`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'PDF compression failed.');
  }

  return await response.blob();
};

const compressOfficeViaBackend = async ({
  file,
  ratio,
  API_URL,
}) => {
  const formData = new FormData();

  formData.append('file', file, file.name);
  formData.append('ratio', ratio);

  const response = await fetch(`${API_URL}/compress-office`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Native document compression failed.');
  }

  return await response.blob();
};

const handleCompressedResult = ({
  originalFile,
  compressedBlob,
  outputFormat,
  outputMime,
  baseName,
  setDownloadUrl,
  setCompressedFileName,
  setResult,
  setWarning,
  sizeWarning = '',
}) => {
  if (compressedBlob.size >= originalFile.size) {
    if (sizeWarning) {
      setWarning?.(sizeWarning);
    } else {
      throw new Error('This document file is already highly compressed');
    }
  }

  const finalBlob = new Blob([compressedBlob], {
    type: outputMime,
  });

  const downloadUrl = URL.createObjectURL(finalBlob);

  const savedPercentage = Math.round(
    ((originalFile.size - finalBlob.size) / originalFile.size) * 100
  );

  setDownloadUrl(downloadUrl);
  setCompressedFileName(`${baseName}_compressed.${outputFormat}`);

  setResult({
    originalSize: (originalFile.size / 1024 / 1024).toFixed(2) + ' MB',
    compressedSize: (finalBlob.size / 1024 / 1024).toFixed(2) + ' MB',
    ratio: Math.max(0, savedPercentage) + '%',
  });
};

/////

export const compressAudio = async ({ // don ned format cos ffmpeg extracts it from file directly
  file,
  ratio,
  format,
  fileInfo,
  setDownloadUrl,
  setCompressedFileName,
  setResult,
  setCompressing,
  setWarning,
}) => {
  try {
    await loadFFmpeg();

    const inputName = file.name;
    const inputFormat = fileInfo.format.toLowerCase();
    console.log(inputFormat);
    const outputType = getOutputInfo(format, 'audio'); 
    if (!outputType) throw new Error(`${format} is not supported yet.`);
    const outputFormat = outputType.ext.toLowerCase();
    const outputName = `compressed_audio.${outputFormat}`;
    console.log(outputFormat);

    // estimating bitrate to make slider useful 
    const audio = new Audio();
    const audioUrl = URL.createObjectURL(file);
    audio.src = audioUrl;
    await new Promise((resolve, reject) => {
      audio.onloadedmetadata = resolve;
      audio.onerror = reject;//(new Error('failed to read audio metadata'));     // jump to catch block 
    });
    const duration = audio.duration;
    URL.revokeObjectURL(audioUrl);
    const estimatedBitrate = Math.round((file.size * 8) / duration / 1000);


    const getAudioBitrate = (ratio, originalBitrate) => {     // better to use this than slider to avoid weird kbps 
      const finalBitrate = 
        ratio >= 90 ? 48 :
        ratio >= 75 ? 64 :
        ratio >= 60 ? 96 :
        ratio >= 50 ? 128 :
        ratio >= 25 ? 192 :
        320;
        
      return `${Math.min(originalBitrate, finalBitrate)}k`;
    }

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    await ffmpeg.exec([
      '-i', 
      inputName,
      '-b:a', 
      getAudioBitrate(ratio, estimatedBitrate),
      outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: outputType.mime });
    // if (blob.size >= file.size) throw new Error('This audio file is alreay highly compressed');
    // Might not need this error cos some file formats are naturally larger than others even after conversion 
    // ---CHECKS---
    if (blob.size >= file.size) {
      if (inputFormat === outputFormat) {
        throw new Error('This audio file is already highly compressed');
      } else {
        // show disclaimer
        setWarning('File size may have increased due to format type');
      }
    }

    const downloadUrl = URL.createObjectURL(blob);

    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const savedPercentage = Math.round(((file.size - blob.size) / file.size) * 100);

    setDownloadUrl(downloadUrl);
    setCompressedFileName(`${baseName}_compressed.${outputFormat}`);
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
// Compresison cant really be made faster without compromising on output quality 
export const compressVideo = async ({
  file,
  ratio,
  format,
  fileInfo,
  setDownloadUrl,
  setCompressedFileName,
  setResult,
  setCompressing,
  setWarning
}) => {
  try {
    await loadFFmpeg();
    // console.log(ratio + "我想学");

    const inputName = file.name;
    const inputFormat = fileInfo.format.toLowerCase();
    const outputType = getOutputInfo(format, 'video'); 
    if (!outputType) throw new Error(`${format} is not supported yet`);
    const outputFormat = outputType.ext.toLowerCase();
    const outputName = `compressed_video.${outputFormat}`; 

    // CRF = Constant Rate Factor --> Maintains a roughly const visual quality by using wtvr bitrate necessary.
    // diff from bitrate in audio (static pages in a vid use much less bits than high fps games)
    const getCrf = (ratio) => { 
      const minCrf = 18;
      const maxCrf = 35;

      return String(Math.round(
        minCrf + (((ratio - 20) / (90 - 20)) * (maxCrf - minCrf)) // ratio from 20 - 90 
      ))
    }

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const getVideoCodec = (fmt) => {
      switch (fmt) {
        case 'webm': return 'libvpx-vp9';
        case 'mov':  return 'libx264';    // mov container uses h264
        case 'avi':  return 'libxvid';
        default:     return 'libx264';    // mp4, mkv etc
      }
    };

    const getAudioCodec = (fmt) => {
      switch (fmt) {
        case 'webm': return 'libvorbis';
        default:     return 'aac';
      }
    };

    await ffmpeg.exec([
      '-i', inputName,
      '-vcodec', getVideoCodec(outputFormat),
      '-crf', getCrf(ratio),
      ...(outputFormat !== 'webm' ? ['-preset', 'ultrafast'] : []),
      '-acodec', getAudioCodec(outputFormat),
      '-b:a', '128k',
      outputName,
    ]);


    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data.buffer], { type: outputType.mime });

    if (blob.size >= file.size) {
      if (inputFormat === outputFormat) {
        throw new Error('This video is already highly compressed');
      } else {
        // show disclaimer
        setWarning('File size may have increased due to format type');
      }
    }

    const downloadUrl = URL.createObjectURL(blob);

    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const savedPercentage = Math.round(((file.size - blob.size) / file.size) * 100);

    setDownloadUrl(downloadUrl);
    setCompressedFileName(`${baseName}_compressed.${outputFormat}`);
    setResult({
      originalSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      compressedSize: (blob.size / 1024 / 1024).toFixed(2) + ' MB',
      ratio: Math.max(0, savedPercentage) + '%',
    });
  } catch (err) {
    console.error('Video compression error:', err);
    alert(err.message || 'Video compression failed.');
  } finally {
    setCompressing(false);
  }
};
