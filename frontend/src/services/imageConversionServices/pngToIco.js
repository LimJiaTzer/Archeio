export async function pngToIco(pngBlob) {
  const pngBuffer = await pngBlob.arrayBuffer();
  const pngBytes  = new Uint8Array(pngBuffer);
  
  // 0,0 in ICO spec means 256x256
  const w = 0, h = 0; 
  
  const header   = new Uint8Array(6);
  const dirEntry = new Uint8Array(16);
  const dv       = new DataView(header.buffer);
  const de       = new DataView(dirEntry.buffer);
  
  dv.setUint16(0, 0, true);  // reserved
  dv.setUint16(2, 1, true);  // type: 1 = ICO
  dv.setUint16(4, 1, true);  // image count: 1
  
  de.setUint8(0, w); 
  de.setUint8(1, h);         // width, height
  de.setUint8(2, 0);         // colour palette count (0 = no palette)
  de.setUint8(3, 0);         // reserved
  de.setUint16(4, 1, true);  // colour planes
  de.setUint16(6, 32, true); // bits per pixel
  de.setUint32(8, pngBytes.length, true); // image data size
  de.setUint32(12, 6 + 16, true);         // offset to image data
  
  const ico = new Uint8Array(6 + 16 + pngBytes.length);
  ico.set(header, 0);
  ico.set(dirEntry, 6);
  ico.set(pngBytes, 22);
  
  return new Blob([ico], { type: 'image/x-icon' });
}