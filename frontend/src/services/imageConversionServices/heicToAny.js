import heic2any from 'heic2any';

export async function heicToAny(file, targetMime) {
  // heic2any can be heavy, so it runs asynchronously.
  // It returns either a single Blob or an array of Blobs (if animated).
  const result = await heic2any({
    blob: file,
    toType: targetMime,
    quality: 0.92
  });

  // If it returns an array (e.g., burst photos), just grab the primary image
  return Array.isArray(result) ? result[0] : result;
}