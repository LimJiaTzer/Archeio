import { describe, expect, it } from 'vitest';
import {
  getDocumentOutputFormats,
  getFileInfo,
  getOutputInfo,
} from '../../src/lib/fileTypes';

describe('file type contracts', () => {
  it.each([
    ['image/png', 'images', 'PNG'],
    ['image/jpg', 'images', 'JPG'],
    ['text/plain', 'documents', 'TXT'],
    ['audio/mpeg', 'audio', 'MP3'],
    ['video/mp4', 'video', 'MP4'],
  ])('maps %s to its category and canonical format', (mime, category, format) => {
    const info = getFileInfo(mime);
    expect(info.category).toBe(category);
    expect(info.format).toBe(format);
  });

  it('returns an explicit unknown contract for unsupported MIME types', () => {
    expect(getFileInfo('application/x-archeio-unknown')).toMatchObject({
      category: 'unknown',
      outputFormats: [],
      format: null,
    });
  });

  it.each([
    ['jpeg', 'images', 'image/jpeg', 'jpg'],
    ['PDF', 'documents', 'application/pdf', 'pdf'],
    ['wav', 'audio', 'audio/wav', 'wav'],
    ['WEBM', 'video', 'video/webm', 'webm'],
  ])('resolves %s output metadata case-insensitively', (format, category, mime, ext) => {
    expect(getOutputInfo(format, category)).toEqual({ mime, ext });
  });

  it('offers only conversions implemented for each document family', () => {
    expect(getDocumentOutputFormats('PDF')).toEqual(['PDF']);
    expect(getDocumentOutputFormats('CSV')).toEqual(['PDF', 'XLSX']);
    expect(getDocumentOutputFormats('XLSX')).toEqual(['PDF', 'CSV']);
    expect(getDocumentOutputFormats('DOCX')).toEqual(['DOCX', 'PDF']);
  });
});
