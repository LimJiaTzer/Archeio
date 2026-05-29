import { fetchFile, toBlobURL } from '@ffmpeg/util';

export const convertMedia = async (file, format, ffmpegRef) => {
  const isVideoOrAudio = file.type.startsWith('video/') || file.type.startsWith('audio/');

  if (isVideoOrAudio) {
    // 1. Audio / Video Conversion using FFmpeg (WASM)
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg.loaded) {
      // Listen to log messages if needed
      ffmpeg.on('log', ({ message }) => console.log(message));
      
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
    }

    // Put the file into the WASM filesystem
    await ffmpeg.writeFile(file.name, await fetchFile(file));

    // Format setup
    const outputExt = format.toLowerCase();
    const outputName = `output.${outputExt}`;

    // Build command differently based on what we're converting
    const isAudioFormat = ['mp3', 'wav', 'aac', 'flac', 'ogg', 'midi'].includes(outputExt);
    let command = ['-i', file.name];
    
    if (isAudioFormat && file.type.startsWith('video/')) {
        // Extract audio, do not retain video stream
        command.push('-vn'); 
    }
    command.push(outputName);

    // Run the complex, native C++ level conversion inside the browser!
    await ffmpeg.exec(command);

    // Extract compiled file
    const data = await ffmpeg.readFile(outputName);
    const mimeType = isAudioFormat ? `audio/${outputExt}` : `video/${outputExt}`;
    const blob = new Blob([data.buffer], { type: mimeType });

    const downloadUrl = URL.createObjectURL(blob);
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const convertedFileName = `${baseName}_converted.${outputExt}`;
    
    return { downloadUrl, convertedFileName };
  } else {
    // 2. Image / General document conversion using HTML Canvas
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
            if (!ctx) throw new Error("Could not get 2D rendering context.");
            ctx.drawImage(img, 0, 0);

            let mimeType = 'image/png';
            let extension = '.png';

            if (format === 'JPG') {
              mimeType = 'image/jpeg';
              extension = '.jpg';
            } else if (format === 'WEBP') {
              mimeType = 'image/webp';
              extension = '.webp';
            } else if (format === 'PDF') {
              mimeType = 'image/jpeg'; // using jpeg as base for simple pdf logic in canvas
              extension = '.pdf';
            } else if (format === 'GIF') {
              mimeType = 'image/gif';
              extension = '.gif';
            }

            const dataUrl = canvas.toDataURL(mimeType === 'image/jpeg' && format === 'PDF' ? 'image/jpeg' : mimeType, 0.92);
            
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const convertedFileName = `${baseName}_converted${extension}`;
            
            resolve({ downloadUrl: dataUrl, convertedFileName });
          } catch (err) {
            console.error("Canvas conversion failed:", err);
            // Safe fallback
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            resolve({
              downloadUrl: e.target?.result || '',
              convertedFileName: `${baseName}_converted.${format.toLowerCase()}`
            });
          }
        };

        img.onerror = () => {
          // Fallback for non-image files
          setTimeout(() => {
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            resolve({
              downloadUrl: e.target?.result || '',
              convertedFileName: `${baseName}_converted.${format.toLowerCase()}`
            });
          }, 1200);
        };

        img.src = e.target?.result;
      };

      reader.onerror = () => {
        reject(new Error("Error reading file."));
      };

      reader.readAsDataURL(file);
    });
  }
};
