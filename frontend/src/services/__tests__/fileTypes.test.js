import { describe, it, expect } from 'vitest';
import { getFileInfo, getOutputInfo } from '../../lib/fileTypes';

describe('fileTypes Utilities', () => {
  describe('getFileInfo', () => {
    it('should return correct info for standard image types', () => {
      const info = getFileInfo('image/png');
      expect(info).toBeDefined();
      expect(info.category).toBe('images');
      // The application actually returns a format object with an array of output formats
      expect(info.formatInfo).toBeDefined();
    });

    it('should correctly map alternate MIME types like image/jpg', () => {
      const info = getFileInfo('image/jpg');
      expect(info.category).toBe('images');
      expect(info.formatInfo.mime).toBe('image/jpeg');
    });

    it('should return an unknown category object for unknown types', () => {
      const info = getFileInfo('unknown/type');
      expect(info).toBeDefined();
      expect(info.category).toBe('unknown');
    });
  });

  describe('getOutputInfo', () => {
    it('should find output info by format string (e.g., PNG)', () => {
      const info = getOutputInfo('PNG', 'images');
      expect(info).toBeDefined();
      expect(info.mime).toBe('image/png');
    });

    it('should find output info regardless of case', () => {
      const info = getOutputInfo('jpeg', 'images');
      expect(info).toBeDefined();
      expect(info.mime).toBe('image/jpeg');
    });

    it('should correctly resolve documents like PDF', () => {
      const info = getOutputInfo('PDF', 'documents');
      expect(info.mime).toBe('application/pdf');
    });
  });
});
