import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ImageEditor from '../../src/pages/ImageEditor';
import { renderImageWithOverlays } from '../../src/services/imageEditingServices/imageEditService';
import {
  createFakeFile,
  createFakeImage,
  MIME_TYPES,
} from '../compression/fakeFiles';

vi.mock('../../src/components/Layout', () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock('../../src/components/FilePreview', () => ({
  default: ({ file }) => (
    <span data-testid={`preview-${file.name}`}>{file.name}</span>
  ),
}));

vi.mock('../../src/components/EditableFileName', () => ({
  EditableFileName: ({ fileName, onSave }) => (
    <div>
      <span>{fileName}</span>
      <button
        type="button"
        onClick={() => onSave?.('renamed-output.png')}
      >
        Rename output
      </button>
    </div>
  ),
}));

vi.mock('../../src/components/imageEditor/ImageEditorWorkspace', () => ({
  default: ({
    presentation,
    initialCrop,
    initialTextLayers,
    initialAnnotationStrokes,
    onApply,
    applyLabel,
  }) => (
    <section>
      <span data-testid="workspace-presentation">{presentation}</span>
      <span data-testid="workspace-crop">
        {JSON.stringify(initialCrop)}
      </span>
      <span data-testid="workspace-text">
        {JSON.stringify(initialTextLayers)}
      </span>
      <span data-testid="workspace-strokes">
        {JSON.stringify(initialAnnotationStrokes)}
      </span>
      <span>{applyLabel}</span>

      <button
        type="button"
        onClick={() =>
          onApply({
            file: new File(['edited source'], 'edited-source.png', {
              type: 'image/png',
            }),
            previewUrl: 'blob:edited-source',
            cropPercent: {
              unit: '%',
              x: 10,
              y: 15,
              width: 70,
              height: 60,
            },
            textLayers: [{ id: 'text-1', text: 'Caption' }],
            annotationStrokes: [
              { id: 'stroke-1', points: [{ x: 1, y: 2 }] },
            ],
          })
        }
      >
        Apply mock edits
      </button>

      <button
        type="button"
        onClick={() =>
          onApply({
            resetToOriginal: true,
            cropPercent: null,
            textLayers: [],
            annotationStrokes: [],
          })
        }
      >
        Reset mock edits
      </button>
    </section>
  ),
}));

vi.mock('../../src/services/imageEditingServices/imageEditService', () => ({
  renderImageWithOverlays: vi.fn(),
}));

vi.mock('../../src/services/imageConversionServices/extractFrames', () => ({
  isGifFile: vi.fn((file) => file?.type === 'image/gif'),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ImageEditor />
    </MemoryRouter>
  );

describe('Image Editor page', () => {
  let urlCounter;

  beforeEach(() => {
    vi.clearAllMocks();
    urlCounter = 0;
    URL.createObjectURL = vi.fn(() => `blob:image-${urlCounter++}`);
    URL.revokeObjectURL = vi.fn();
    globalThis.crypto.randomUUID = vi.fn(() => `image-${urlCounter++}`);
    renderImageWithOverlays.mockImplementation(
      async ({ outputType }) => ({
        file: new File(['rendered'], 'rendered-output', {
          type: outputType,
        }),
        previewUrl: `blob:rendered-${outputType}`,
        width: 560,
        height: 320,
      })
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('keeps the uploader available after a non-image selection', () => {
    const { container } = renderPage();

    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: {
        files: [
          createFakeFile({
            name: 'notes.txt',
            type: 'text/plain',
          }),
        ],
      },
    });

    expect(screen.getByText('Drag, drop or paste an image here'))
      .toBeInTheDocument();
    expect(screen.queryByTestId('workspace-presentation'))
      .not.toBeInTheDocument();
  });

  it('uploads a JPG into the page workspace and exports PNG', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.upload(
      container.querySelector('input[type="file"]'),
      createFakeImage('portrait.jpg')
    );

    expect(screen.getByTestId('workspace-presentation'))
      .toHaveTextContent('page');
    expect(screen.getByRole('combobox')).toHaveValue('JPG');

    await user.selectOptions(screen.getByRole('combobox'), 'PNG');
    await user.click(
      screen.getByRole('button', { name: 'Apply mock edits' })
    );

    await waitFor(() =>
      expect(renderImageWithOverlays).toHaveBeenCalledTimes(1)
    );
    expect(renderImageWithOverlays.mock.calls[0][0]).toMatchObject({
      cropPercent: {
        x: 10,
        y: 15,
        width: 70,
        height: 60,
      },
      textLayers: [{ id: 'text-1', text: 'Caption' }],
      outputType: 'image/png',
    });
    expect(await screen.findByText('portrait_edited.png'))
      .toBeInTheDocument();

    const download = screen.getByRole('link', {
      name: 'Download edited image',
    });
    expect(download).toHaveAttribute('download', 'portrait_edited.png');
    expect(download).toHaveAttribute(
      'href',
      'blob:rendered-image/png'
    );
  });

  it('passes crop, text, and annotation state back into the workspace', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.upload(
      container.querySelector('input[type="file"]'),
      createFakeImage('state.jpg')
    );

    await user.click(
      screen.getByRole('button', { name: 'Apply mock edits' })
    );

    await waitFor(() =>
      expect(screen.getByTestId('workspace-crop')).toHaveTextContent(
        '"width":70'
      )
    );
    expect(screen.getByTestId('workspace-text')).toHaveTextContent(
      '"text":"Caption"'
    );
    expect(screen.getByTestId('workspace-strokes')).toHaveTextContent(
      '"id":"stroke-1"'
    );
  });

  it('clears edit metadata when the workspace resets to the original', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.upload(
      container.querySelector('input[type="file"]'),
      createFakeImage('reset.jpg')
    );
    await user.click(
      screen.getByRole('button', { name: 'Apply mock edits' })
    );
    await user.click(
      screen.getByRole('button', { name: 'Reset mock edits' })
    );

    await waitFor(() =>
      expect(screen.getByTestId('workspace-crop')).toHaveTextContent('null')
    );
    expect(screen.getByTestId('workspace-text')).toHaveTextContent('[]');
    expect(screen.getByTestId('workspace-strokes')).toHaveTextContent('[]');
  });

  it('surfaces rendering failures without crashing the editor', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    renderImageWithOverlays.mockRejectedValueOnce(
      new Error('Synthetic render failure')
    );

    await user.upload(
      container.querySelector('input[type="file"]'),
      createFakeImage('corrupt.jpg')
    );
    await user.click(
      screen.getByRole('button', { name: 'Apply mock edits' })
    );

    expect(await screen.findByText('Synthetic render failure'))
      .toBeInTheDocument();
    expect(screen.getByTestId('workspace-presentation'))
      .toBeInTheDocument();
  });

  it('keeps GIF export constrained to animated GIF metadata', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();

    await user.upload(
      container.querySelector('input[type="file"]'),
      createFakeImage('animation.gif', MIME_TYPES.gif)
    );

    expect(screen.getByRole('combobox')).toHaveValue('GIF');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await user.click(
      screen.getByRole('button', { name: 'Apply mock edits' })
    );

    expect(await screen.findByText('animation_edited.gif'))
      .toBeInTheDocument();
    expect(renderImageWithOverlays.mock.calls[0][0].outputType)
      .toBe('image/gif');
  });

  it('allows the final output name to change without changing its bytes', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.upload(
      container.querySelector('input[type="file"]'),
      createFakeImage('名字 with spaces.jpg')
    );
    await user.click(
      screen.getByRole('button', { name: 'Apply mock edits' })
    );
    await user.click(
      await screen.findByRole('button', { name: 'Rename output' })
    );

    const download = screen.getByRole('link', {
      name: 'Download edited image',
    });
    expect(download).toHaveAttribute('download', 'renamed-output.png');
    expect(download).toHaveAttribute(
      'href',
      'blob:rendered-image/jpeg'
    );
  });

  it('does not leak the previous edit when a new image is uploaded', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.upload(
      container.querySelector('input[type="file"]'),
      createFakeImage('first.jpg')
    );
    await user.click(
      screen.getByRole('button', { name: 'Apply mock edits' })
    );
    expect(await screen.findByText('first_edited.jpg'))
      .toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(screen.getByText('Drag, drop or paste an image here'))
      .toBeInTheDocument();

    await user.upload(
      container.querySelector('input[type="file"]'),
      createFakeImage('second.png', MIME_TYPES.png)
    );

    expect(screen.getByRole('combobox')).toHaveValue('PNG');
    expect(screen.getByTestId('workspace-crop')).toHaveTextContent('null');
    expect(screen.getByTestId('workspace-text')).toHaveTextContent('[]');
    expect(screen.queryByText('first_edited.jpg')).not.toBeInTheDocument();
  });
});
