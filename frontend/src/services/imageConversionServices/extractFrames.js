import * as gifuct from 'gifuct-js';
import ICO_IMPORT from 'icojs';

// Robustly get libraries
const { parseGIF, decompressFrames } = gifuct.default ? gifuct.default : gifuct;

/**
 * Extracts all frames from a GIF file as an array of Blobs.
 * Reconstructs each frame by handling GIF disposal methods.
 */
export async function extractGifFrames(file) {
  const { frames } = await extractGifFrameData(file);
  return frames.map((frame) => frame.blob);
}

/**
 * Extracts fully composed GIF frames together with their playback metadata.
 * The metadata is used when an animated GIF is edited or compressed so the
 * resulting file keeps the original animation speed and loop behaviour.
 */
export async function extractGifFrameData(file) {
  const buffer = await file.arrayBuffer();
  const gif = parseGIF(buffer);
  const frames = decompressFrames(gif, true);
  
  const width = gif.lsd.width;
  const height = gif.lsd.height;
  
  const masterCanvas = document.createElement('canvas');
  masterCanvas.width = width;
  masterCanvas.height = height;
  const masterCtx = masterCanvas.getContext('2d');
  
  if (!masterCtx) {
    throw new Error('Could not create a GIF frame canvas.');
  }

  const frameData = [];
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    
    // Create a canvas for the current frame
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = width;
    frameCanvas.height = height;
    const frameCtx = frameCanvas.getContext('2d');

    if (!frameCtx) {
      throw new Error('Could not create a GIF frame canvas.');
    }
    
    // Draw the current accumulated master state
    frameCtx.drawImage(masterCanvas, 0, 0);
    
    // Draw the patch for this frame
    const patchData = new ImageData(frame.patch, frame.dims.width, frame.dims.height);
    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = frame.dims.width;
    patchCanvas.height = frame.dims.height;
    const patchCtx = patchCanvas.getContext('2d');

    if (!patchCtx) {
      throw new Error('Could not create a GIF patch canvas.');
    }

    patchCtx.putImageData(patchData, 0, 0);
    
    frameCtx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);
    
    // Convert to Blob
    const blob = await new Promise((resolve, reject) => {
      frameCanvas.toBlob((frameBlob) => {
        if (!frameBlob) {
          reject(new Error('Could not extract GIF frame.'));
          return;
        }

        resolve(frameBlob);
      }, 'image/png');
    });

    frameData.push({
      blob,
      delay: Math.max(20, Number(frame.delay) || 100),
      disposalType: frame.disposalType,
      index: i,
    });
    
    // Update master canvas based on disposal type
    if (frame.disposalType === 2) {
      masterCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
    } else if (frame.disposalType !== 3) {
      masterCtx.drawImage(frameCanvas, 0, 0);
    }
  }
  
  const loopExtension = gif.frames.find(
    (frame) => frame.application?.id === 'NETSCAPE2.0'
  )?.application;
  const loopBytes = loopExtension?.blocks;
  const repeat =
    loopBytes?.length >= 3
      ? loopBytes[1] | (loopBytes[2] << 8)
      : 0;

  return {
    width,
    height,
    repeat,
    frames: frameData,
  };
}

export const isGifFile = (file) => {
  if (!file) return false;

  if (file.type) {
    return file.type.toLowerCase() === 'image/gif';
  }

  return file.name?.toLowerCase().endsWith('.gif') ?? false;
};

/**
 * Extracts all images from an ICO file as an array of Blobs.
 */
export async function extractIcoFrames(file) {
  const buffer = await file.arrayBuffer();
  
  // Try to find the parse/decode function in any possible location
  // Based on console log, the library structure is {decodeIco, encodeIco, isIco}
  let decodeFunc = null;

  if (ICO_IMPORT && typeof ICO_IMPORT.decodeIco === 'function') {
    decodeFunc = ICO_IMPORT.decodeIco;
  } else if (ICO_IMPORT && ICO_IMPORT.default && typeof ICO_IMPORT.default.decodeIco === 'function') {
    decodeFunc = ICO_IMPORT.default.decodeIco;
  } else if (ICO_IMPORT && typeof ICO_IMPORT.parse === 'function') {
    decodeFunc = ICO_IMPORT.parse;
  } else if (ICO_IMPORT && ICO_IMPORT.default && typeof ICO_IMPORT.default.parse === 'function') {
    decodeFunc = ICO_IMPORT.default.parse;
  } else if (typeof ICO_IMPORT === 'function') {
    decodeFunc = ICO_IMPORT;
  }

  if (!decodeFunc) {
    console.error('ICO Library Import Object:', ICO_IMPORT);
    throw new Error('ICO parsing library (icojs) failed to load properly. Check console for structure.');
  }

  // icojs decodeIco/parse returns an array of image objects
  const images = await decodeFunc(buffer);
  return images.map(img => new Blob([img.buffer], { type: 'image/png' }));
}
