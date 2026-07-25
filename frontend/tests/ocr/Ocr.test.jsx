import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Ocr from '../../src/pages/Ocr';
import * as docx from 'docx-preview';

vi.mock('docx-preview', () => ({
  renderAsync: vi.fn(async (_file, container) => {
    container.appendChild(document.createElement('section'));
  }),
}));

vi.mock('../../src/components/Layout', () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock('../../src/components/FilePreview', () => ({
  default: ({ file }) => <span data-testid="file-preview">{file.name}</span>,
}));

vi.mock('../../src/components/EditableFileName', () => ({
  EditableFileName: ({ fileName }) => <span>{fileName}</span>,
}));

const responseWithDocx = (content) => ({
  ok: true,
  blob: vi.fn(async () => new Blob([content], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })),
});

const renderPage = () => render(
  <MemoryRouter>
    <Ocr />
  </MemoryRouter>,
);

describe('OCR page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
    URL.createObjectURL = vi.fn(() => 'blob:source');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('accepts multiple files while suppressing an exact duplicate', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]');
    const image = new File(['image'], 'scan.png', { type: 'image/png', lastModified: 1 });
    const pdf = new File(['pdf'], 'notes.pdf', { type: 'application/pdf', lastModified: 2 });

    await user.upload(input, [image, pdf]);
    await user.upload(input, image);

    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(2);
    expect(screen.getAllByText('scan.png')).not.toHaveLength(0);
    expect(screen.getAllByText('notes.pdf')).not.toHaveLength(0);
  });

  it('keeps a successful conversion available when a later document fails', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]');
    globalThis.fetch
      .mockResolvedValueOnce(responseWithDocx('first'))
      .mockResolvedValueOnce({
        ok: false,
        json: vi.fn(async () => ({ detail: 'Unreadable scan' })),
      });

    await user.upload(input, [
      new File(['image'], 'good.png', { type: 'image/png' }),
      new File(['image'], 'bad.png', { type: 'image/png' }),
    ]);
    await user.click(screen.getByRole('button', { name: 'Convert documents' }));

    expect((await screen.findAllByText('good.docx')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Unreadable scan')).toBeInTheDocument();
    await waitFor(() => expect(docx.renderAsync).toHaveBeenCalledTimes(1));
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
