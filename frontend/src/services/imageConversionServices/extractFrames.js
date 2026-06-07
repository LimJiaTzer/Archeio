import * as gifuct from 'gifuct-js';
import ICO_IMPORT from 'icojs';

// Robustly get libraries
const { parseGIF, decompressFrames } = gifuct.default ? gifuct.default : gifuct;

/**
 * Extracts all frames from a GIF file as an array of Blobs.
 * Reconstructs each frame by handling GIF disposal methods.
 */
export async function extractGifFrames(file) {
  // ... (keep extractGifFrames as is)
  const buffer = await file.arrayBuffer();
  const gif = parseGIF(buffer);
  const frames = decompressFrames(gif, true);
  
  const width = gif.lsd.width;
  const height = gif.lsd.height;
  
  const masterCanvas = document.createElement('canvas');
  masterCanvas.width = width;
  masterCanvas.height = height;
  const masterCtx = masterCanvas.getContext('2d');
  
  const frameBlobs = [];
  
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    
    // Create a canvas for the current frame
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = width;
    frameCanvas.height = height;
    const frameCtx = frameCanvas.getContext('2d');
    
    // Draw the current accumulated master state
    frameCtx.drawImage(masterCanvas, 0, 0);
    
    // Draw the patch for this frame
    const patchData = new ImageData(frame.patch, frame.dims.width, frame.dims.height);
    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = frame.dims.width;
    patchCanvas.height = frame.dims.height;
    patchCanvas.getContext('2d').putImageData(patchData, 0, 0);
    
    frameCtx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);
    
    // Convert to Blob
    const blob = await new Promise(resolve => frameCanvas.toBlob(resolve, 'image/png'));
    frameBlobs.push(blob);
    
    // Update master canvas based on disposal type
    if (frame.disposalType === 2) {
      masterCtx.clearRect(frame.dims.left, frame.dims.top, frame.dims.width, frame.dims.height);
    } else if (frame.disposalType !== 3) {
      masterCtx.drawImage(frameCanvas, 0, 0);
    }
  }
  
  return frameBlobs;
}

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
