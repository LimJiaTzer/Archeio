import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import workspaceSource from '../../src/components/imageEditor/ImageEditorWorkspace.jsx?raw';

const cropStyles = readFileSync(
  'src/index.css',
  'utf8'
);

describe('ImageEditorWorkspace page crop contract', () => {
  it('keeps the page-only contained crop sizing and freeform selection', () => {
    expect(workspaceSource).toContain("presentation === 'page'");
    expect(workspaceSource).toContain("'archeio-crop--page'");
    expect(workspaceSource).toContain('pageCropDisplaySize');
    expect(workspaceSource).toContain(
      'cropViewportSize.width / naturalImageSize.width'
    );
    expect(workspaceSource).toContain(
      'cropViewportSize.height / naturalImageSize.height'
    );

    // ReactCrop must remain freeform. Reintroducing an aspect prop recreates
    // the fixed crop box that previously appeared only on the standalone page.
    expect(workspaceSource).not.toMatch(/<ReactCrop[\s\S]*?\baspect=/);

    expect(cropStyles).toContain('.archeio-crop--page');
    expect(cropStyles).toContain('max-width: none !important');
    expect(cropStyles).toContain('max-height: none !important');
  });
});
