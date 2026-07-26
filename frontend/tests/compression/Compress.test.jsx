import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Compress from '../../src/pages/Compress';
import {
  compressAudio,
  compressDocument,
  compressImage,
  compressVideo,
} from '../../src/services/compressService';
import { renderImageWithOverlays } from '../../src/services/imageEditingServices/imageEditService';
import {
  createFakeFile,
  createFakeImage,
  createFakeMediaSet,
  MIME_TYPES,
} from './fakeFiles';

vi.mock('../../src/services/compressService', () => ({
  compressAudio: vi.fn(),
  compressDocument: vi.fn(),
  compressImage: vi.fn(),
  compressVideo: vi.fn(),
}));

vi.mock('../../src/services/imageEditingServices/imageEditService', () => ({
  renderImageWithOverlays: vi.fn(),
}));

vi.mock('../../src/services/imageConversionServices/extractFrames', () => ({
  extractGifFrames: vi.fn(async () => []),
}));

vi.mock('../../src/components/Layout', () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock('../../src/components/FilePreviewAltered', () => ({
  default: ({ file }) => (
    <span data-testid={`preview-${file.name}`}>{file.name}</span>
  ),
}));

vi.mock('../../src/components/EditableFileName', () => ({
  EditableFileName: ({ fileName }) => <span>{fileName}</span>,
}));

vi.mock('../../src/components/FrameSelector', () => ({
  default: () => <div>Frame selector</div>,
}));

vi.mock(
  '../../src/components/dropdownPreview/ImageCompressionDropdown',
  () => ({
    default: ({
      item,
      effectiveRatio,
      updateFileItem,
      updatePreviewItem,
    }) => (
      <div data-testid={`settings-${item.file.name}`}>
        <span data-testid={`effective-ratio-${item.file.name}`}>
          {effectiveRatio}
        </span>

        <button
          type="button"
          aria-label={`Set custom ratio for ${item.file.name}`}
          onClick={() =>
            updateFileItem(item.id, {
              customRatio: 33,
              useCustomSettings: true,
            })
          }
        >
          Custom ratio
        </button>

        <button
          type="button"
          aria-label={`Use batch default for ${item.file.name}`}
          onClick={() =>
            updateFileItem(item.id, {
              customRatio: null,
              useCustomSettings: false,
            })
          }
        >
          Use batch default
        </button>

        <button
          type="button"
          aria-label={`Apply fake edit to ${item.file.name}`}
          onClick={() =>
            updatePreviewItem(item.id, {
              editedFile: new File(['edited'], `edited-${item.file.name}`, {
                type: item.file.type,
              }),
              editedPreviewUrl: `blob:edited-${item.file.name}`,
              editedCrop: {
                unit: '%',
                x: 10,
                y: 10,
                width: 80,
                height: 80,
              },
              textLayers: [{ id: 'text-1', text: 'Edited' }],
              annotationStrokes: [],
            })
          }
        >
          Apply fake edit
        </button>
      </div>
    ),
  })
);

const resultFor = (file, ratio) => ({
  originalSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
  compressedSize: `${Math.max(1, 100 - ratio)} KB`,
  ratio: `${ratio}%`,
});

const finishCompression = ({
  file,
  ratio,
  format,
  setDownloadUrl,
  setCompressedFileName,
  setResult,
  setCompressing,
}) => {
  const normalisedFormat = format.toLowerCase() === 'jpeg'
    ? 'jpg'
    : format.toLowerCase();
  const extensionStart = file.name.lastIndexOf('.');
  const baseName =
    extensionStart > 0 ? file.name.slice(0, extensionStart) : file.name;

  setDownloadUrl(`blob:${file.name}:${ratio}`);
  setCompressedFileName(`${baseName}_compressed.${normalisedFormat}`);
  setResult(resultFor(file, ratio));
  setCompressing(false);
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <Compress />
    </MemoryRouter>
  );

const uploadFiles = async (container, files) => {
  const user = userEvent.setup();
  const fileList = Array.isArray(files) ? files : [files];

  fireEvent.change(container.querySelector('input[type="file"]'), {
    target: { files: fileList },
  });
  await waitFor(() =>
    expect(screen.getByTitle(fileList[0].name)).toBeInTheDocument()
  );

  return user;
};

describe('Compress page', () => {
  let objectUrlCounter;

  beforeEach(() => {
    vi.clearAllMocks();
    objectUrlCounter = 0;
    URL.createObjectURL = vi.fn(
      () => `blob:test-${objectUrlCounter++}`
    );
    URL.revokeObjectURL = vi.fn();
    globalThis.alert = vi.fn();
    globalThis.crypto.randomUUID = vi.fn(
      () => `file-${objectUrlCounter++}`
    );

    globalThis.Image = class {
      width = 800;
      height = 400;
      naturalWidth = 800;
      naturalHeight = 400;

      set src(_value) {
        queueMicrotask(() => this.onload?.());
      }
    };

    compressImage.mockImplementation(finishCompression);
    compressDocument.mockImplementation(async (args) =>
      finishCompression(args)
    );
    compressAudio.mockImplementation(async (args) =>
      finishCompression(args)
    );
    compressVideo.mockImplementation(async (args) =>
      finishCompression(args)
    );
    renderImageWithOverlays.mockResolvedValue({
      file: new File(['flattened edits'], 'flattened.png', {
        type: 'image/png',
      }),
      previewUrl: 'blob:flattened-edits',
      width: 640,
      height: 320,
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('routes synthetic image, audio, and video files without real codecs', async () => {
    const { container } = renderPage();
    const files = createFakeMediaSet();
    const user = await uploadFiles(container, files);

    for (const file of files) {
      expect(screen.getByTitle(file.name)).toBeInTheDocument();
    }

    expect(screen.getByText('Original Size: 0.01 MB')).toBeInTheDocument();
    expect(screen.getByText('Original Size: 0.02 MB')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Compress Files' }));

    await waitFor(() => {
      expect(compressImage).toHaveBeenCalledTimes(4);
      expect(compressAudio).toHaveBeenCalledTimes(1);
      expect(compressVideo).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByText('Compression Complete! 6 files ready')
    ).toBeInTheDocument();
  });

  it('completes JPG to PNG compression and exposes the correct download', async () => {
    const { container } = renderPage();
    const user = await uploadFiles(
      container,
      createFakeImage('Holiday 相片 01.jpg')
    );

    await user.selectOptions(screen.getByRole('combobox'), 'PNG');
    await user.click(screen.getByRole('button', { name: 'Compress Files' }));

    await waitFor(() => expect(compressImage).toHaveBeenCalledTimes(1));
    expect(compressImage.mock.calls[0][0]).toMatchObject({
      ratio: 75,
      format: 'PNG',
    });

    expect(
      await screen.findByText('Holiday 相片 01_compressed.png')
    ).toBeInTheDocument();
    const download = screen.getByRole('link', {
      name: 'Download Compressed File',
    });
    expect(download).toHaveAttribute(
      'download',
      'Holiday 相片 01_compressed.png'
    );
    expect(download).toHaveAttribute(
      'href',
      'blob:Holiday 相片 01.jpg:75'
    );
  });

  it('applies the batch ratio, preserves an override, and restores the default', async () => {
    const { container } = renderPage();
    const user = await uploadFiles(container, [
      createFakeImage('one.jpg'),
      createFakeImage('two.jpg'),
    ]);

    const toggles = screen.getAllByRole('button', {
      name: 'Toggle image compression settings',
    });
    await user.click(toggles[0]);
    await user.click(toggles[1]);

    fireEvent.change(screen.getByRole('slider'), {
      target: { value: '40' },
    });
    await user.click(
      screen.getByRole('button', {
        name: 'Set custom ratio for two.jpg',
      })
    );
    await user.click(screen.getByRole('button', { name: 'Compress Files' }));

    await waitFor(() => expect(compressImage).toHaveBeenCalledTimes(2));
    expect(compressImage.mock.calls.slice(0, 2).map(([args]) => args.ratio))
      .toEqual([40, 33]);

    await user.click(
      screen.getByRole('button', {
        name: 'Use batch default for two.jpg',
      })
    );
    fireEvent.change(screen.getByRole('slider'), {
      target: { value: '80' },
    });
    await user.click(screen.getByRole('button', { name: 'Compress Files' }));

    await waitFor(() => expect(compressImage).toHaveBeenCalledTimes(4));
    expect(compressImage.mock.calls.slice(2, 4).map(([args]) => args.ratio))
      .toEqual([80, 80]);
  });

  it('removes only the selected file', async () => {
    const { container } = renderPage();
    const user = await uploadFiles(container, [
      createFakeImage('keep.jpg'),
      createFakeImage('remove.jpg'),
    ]);

    await user.click(screen.getAllByRole('button', { name: 'Remove' })[1]);

    expect(screen.getByTitle('keep.jpg')).toBeInTheDocument();
    expect(screen.queryByTitle('remove.jpg')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compress Files' }))
      .toBeEnabled();
  });

  it('renders crop and overlay edits before compression', async () => {
    const { container } = renderPage();
    const user = await uploadFiles(
      container,
      createFakeImage('editable.jpg')
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Toggle image compression settings',
      })
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Apply fake edit to editable.jpg',
      })
    );
    await user.click(screen.getByRole('button', { name: 'Compress Files' }));

    await waitFor(() =>
      expect(renderImageWithOverlays).toHaveBeenCalledTimes(1)
    );
    expect(renderImageWithOverlays.mock.calls[0][0]).toMatchObject({
      cropPercent: {
        x: 10,
        y: 10,
        width: 80,
        height: 80,
      },
      textLayers: [{ id: 'text-1', text: 'Edited' }],
      outputType: 'image/png',
    });
    expect(compressImage.mock.calls[0][0].file.name).toBe('flattened.png');
  });

  it('keeps a successful batch item when a corrupt image fails', async () => {
    const { container } = renderPage();
    const user = await uploadFiles(container, [
      createFakeImage('good.jpg'),
      createFakeImage('corrupt.jpg'),
    ]);

    compressImage
      .mockImplementationOnce(finishCompression)
      .mockImplementationOnce(() => {
        throw new Error('Synthetic decoder failure');
      });

    await user.click(screen.getByRole('button', { name: 'Compress Files' }));

    expect(
      await screen.findByText('Compression Complete! Saved 75%')
    ).toBeInTheDocument();
    expect(screen.getByText(/Could not compress corrupt\.jpg/))
      .toBeInTheDocument();
    expect(screen.getByText('good_compressed.jpg')).toBeInTheDocument();
  });

  it('reports an unsupported synthetic file without crashing the queue', async () => {
    const { container } = renderPage();
    const user = await uploadFiles(
      container,
      createFakeFile({
        name: 'unknown.data',
        type: 'application/x-unknown',
      })
    );

    await user.click(screen.getByRole('button', { name: 'Compress Files' }));

    await waitFor(() =>
      expect(globalThis.alert).toHaveBeenCalledWith(
        'unknown.data is not supported'
      )
    );
    expect(screen.getByTitle('unknown.data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Compress Files' }))
      .toBeEnabled();
  });

  it('accepts a synthetic file reported just below 100 MB', async () => {
    const { container } = renderPage();
    await uploadFiles(
      container,
      createFakeImage(
        'near-limit.jpg',
        MIME_TYPES.jpg,
        100 * 1024 * 1024 - 1
      )
    );

    expect(screen.getByTitle('near-limit.jpg')).toBeInTheDocument();
    expect(screen.getByText('Original Size: 100.00 MB'))
      .toBeInTheDocument();
  });

  it('does not leak per-file state after removing an upload', async () => {
    const { container } = renderPage();
    const user = await uploadFiles(
      container,
      createFakeImage('first.jpg')
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Toggle image compression settings',
      })
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Set custom ratio for first.jpg',
      })
    );
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [createFakeImage('second.jpg')] },
    });
    await waitFor(() =>
      expect(screen.getByTitle('second.jpg')).toBeInTheDocument()
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Toggle image compression settings',
      })
    );

    expect(screen.getByTestId('effective-ratio-second.jpg'))
      .toHaveTextContent('75');
    expect(screen.queryByTitle('first.jpg')).not.toBeInTheDocument();
  });
});
