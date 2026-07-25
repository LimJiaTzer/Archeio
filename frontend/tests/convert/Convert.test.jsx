import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Convert from '../../src/pages/Convert';
import { convertMedia } from '../../src/services/conversionService';

vi.mock('../../src/services/conversionService', () => ({
  convertMedia: vi.fn(),
  extractFrames: vi.fn(),
  zipBlobs: vi.fn(),
}));

vi.mock('@ffmpeg/ffmpeg', () => ({
  FFmpeg: class {},
}));

vi.mock('../../src/components/Layout', () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock('../../src/components/FilePreview', () => ({
  default: ({ file }) => <span>{file.name}</span>,
}));

vi.mock('../../src/components/EditableFileName', () => ({
  EditableFileName: ({ fileName }) => <span>{fileName}</span>,
}));

vi.mock('../../src/components/FrameSelector', () => ({
  default: () => <div>Frame selector</div>,
}));

const renderPage = () => render(
  <MemoryRouter>
    <Convert />
  </MemoryRouter>,
);

describe('Convert page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps the uploader available after adding multiple files', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    const input = container.querySelector('input[type="file"]');
    const files = [
      new File(['image'], 'photo.png', { type: 'image/png' }),
      new File(['document'], 'notes.txt', { type: 'text/plain' }),
    ];

    await user.upload(input, files);

    expect(screen.getByText('photo.png')).toBeInTheDocument();
    expect(screen.getByText('notes.txt')).toBeInTheDocument();
    expect(screen.getByText('Add more files')).toBeInTheDocument();
    expect(container.querySelector('input[type="file"]')).toBeInTheDocument();
    expect(screen.getByText('Convert All(2) to:')).toBeInTheDocument();
  });

  it('keeps successful results when another file in the batch fails', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    const goodFile = new File(['image'], 'good.png', { type: 'image/png' });
    const failedFile = new File(['image'], 'failed.png', { type: 'image/png' });
    convertMedia
      .mockResolvedValueOnce({
        downloadUrl: 'blob:good',
        convertedFileName: 'good_converted.jpg',
        size: 10,
      })
      .mockRejectedValueOnce(new Error('Codec failed'));

    await user.upload(container.querySelector('input[type="file"]'), [goodFile, failedFile]);
    await user.click(screen.getByRole('button', { name: /^Convert$/ }));

    await waitFor(() => expect(convertMedia).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Conversion Complete! File ready')).toBeInTheDocument();
    expect(screen.getAllByText('good_converted.jpg')).not.toHaveLength(0);
    expect(screen.getByText('Codec failed')).toBeInTheDocument();
  });

  it('clears the queue and releases image preview URLs on reset', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    const image = new File(['image'], 'photo.png', { type: 'image/png' });

    await user.upload(container.querySelector('input[type="file"]'), image);
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByText('Select files to convert')).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
  });
});
