import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ImageCompressionDetails from '../../src/components/dropdownPreview/ImageCompressionDropdown';
import { createImageCompressionPreview } from '../../src/components/dropdownPreview/ImagePreviewService';
import { createFakeImage } from './fakeFiles';

vi.mock(
  '../../src/components/dropdownPreview/ImagePreviewService',
  () => ({
    createImageCompressionPreview: vi.fn(),
  })
);

vi.mock(
  '../../src/components/dropdownPreview/BeforeAfterImageSlider',
  () => ({
    default: ({ originalSize, compressedSize }) => (
      <div>
        <span>Original preview: {originalSize}</span>
        <span>Compressed preview: {compressedSize}</span>
      </div>
    ),
  })
);

vi.mock(
  '../../src/components/dropdownPreview/ImageEditingPopUp',
  () => ({
    default: ({ isOpen, onApply }) =>
      isOpen ? (
        <div>
          <button
            type="button"
            onClick={() =>
              onApply({
                file: new File(['edited'], 'edited.jpg', {
                  type: 'image/jpeg',
                }),
                previewUrl: 'blob:edited',
                cropPercent: {
                  unit: '%',
                  x: 5,
                  y: 10,
                  width: 80,
                  height: 70,
                },
                textLayers: [{ id: 'label', text: 'Hello' }],
                annotationStrokes: [],
              })
            }
          >
            Apply mock edit
          </button>
        </div>
      ) : null,
  })
);

const baseItem = () => ({
  id: 'image-1',
  file: createFakeImage('photo.jpg'),
  fileInfo: {
    category: 'images',
    width: 800,
    height: 400,
  },
  format: 'JPG',
  previewUrl: 'blob:source',
  editedFile: null,
  editedPreviewUrl: '',
  editedCrop: null,
  textLayers: [],
  annotationStrokes: [],
  renderedEditPreviewUrl: '',
  renderedEditPreviewBlob: null,
  renderedEditSize: null,
  result: null,
  downloadUrl: '',
  compressedFileName: '',
  useCustomSettings: false,
  customRatio: null,
  resizeEnabled: false,
  maxWidth: 800,
  maxHeight: 400,
  maintainAspectRatio: true,
  compressedPreviewUrl: '',
  compressedPreviewBlob: null,
  estimatedSize: null,
  previewLoading: false,
  previewError: '',
  gifFrames: [],
  selectedFrames: null,
  status: 'idle',
});

const Harness = ({ batchRatio = 75 }) => {
  const [item, setItem] = useState(baseItem);
  const effectiveRatio =
    item.useCustomSettings && item.customRatio !== null
      ? item.customRatio
      : batchRatio;
  const updateItem = (_id, patch) =>
    setItem((current) => ({ ...current, ...patch }));

  return (
    <>
      <ImageCompressionDetails
        item={item}
        effectiveRatio={effectiveRatio}
        updateFileItem={updateItem}
        updatePreviewItem={updateItem}
      />
      <output data-testid="item-state">
        {JSON.stringify({
          useCustomSettings: item.useCustomSettings,
          customRatio: item.customRatio,
          resizeEnabled: item.resizeEnabled,
          maxWidth: item.maxWidth,
          maxHeight: item.maxHeight,
          maintainAspectRatio: item.maintainAspectRatio,
          editedFileName: item.editedFile?.name || null,
          editedCrop: item.editedCrop,
          textLayers: item.textLayers,
        })}
      </output>
    </>
  );
};

describe('Image compression dropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:preview-result');
    URL.revokeObjectURL = vi.fn();
    createImageCompressionPreview.mockImplementation(async ({ ratio }) => {
      const sizeBytes = 1000 - ratio * 5;
      const blob = new Blob([new Uint8Array(sizeBytes)], {
        type: 'image/jpeg',
      });

      return {
        blob,
        previewUrl: `blob:ratio-${ratio}`,
        sizeBytes,
        width: 800,
        height: 400,
        originalWidth: 800,
        originalHeight: 400,
        sourcePreviewUrl: null,
        sourceBlob: baseItem().file,
        sourceSizeBytes: baseItem().file.size,
      };
    });
  });

  it('updates the estimate when the per-file slider moves', async () => {
    render(<Harness />);

    expect(await screen.findByText('625 B')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('slider'), {
      target: { value: '20' },
    });

    expect(await screen.findByText('900 B')).toBeInTheDocument();
    expect(createImageCompressionPreview.mock.calls.at(-1)[0].ratio)
      .toBe(20);
    expect(screen.getByRole('button', { name: 'Use batch default' }))
      .toBeInTheDocument();
  });

  it('returns a custom ratio to the batch default', async () => {
    const user = userEvent.setup();
    render(<Harness batchRatio={65} />);

    fireEvent.change(screen.getByRole('slider'), {
      target: { value: '35' },
    });
    expect(screen.getByRole('slider')).toHaveValue('35');

    await user.click(
      screen.getByRole('button', { name: 'Use batch default' })
    );

    expect(screen.getByRole('slider')).toHaveValue('65');
    expect(screen.getByTestId('item-state')).toHaveTextContent(
      '"useCustomSettings":false'
    );
  });

  it('resizes proportionally while aspect ratio is enabled', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    const resizeHeading = screen.getByText('Resize optional');
    await user.click(resizeHeading.parentElement.querySelector('button'));

    const [widthInput, heightInput] = container.querySelectorAll(
      'input[type="number"]'
    );
    fireEvent.change(widthInput, { target: { value: '400' } });

    expect(widthInput).toHaveValue(400);
    expect(heightInput).toHaveValue(200);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('allows independent dimensions when aspect ratio is disabled', async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    const resizeHeading = screen.getByText('Resize optional');
    await user.click(resizeHeading.parentElement.querySelector('button'));
    await user.click(screen.getByRole('checkbox'));

    const [widthInput, heightInput] = container.querySelectorAll(
      'input[type="number"]'
    );
    fireEvent.change(widthInput, {
      target: { value: '320' },
    });
    fireEvent.change(heightInput, {
      target: { value: '240' },
    });

    expect(widthInput).toHaveValue(320);
    expect(heightInput).toHaveValue(240);
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('stores editor crop, text, and edited-file state', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Edit image' }));
    await user.click(screen.getByRole('button', { name: 'Apply mock edit' }));

    await waitFor(() => {
      expect(screen.getByTestId('item-state')).toHaveTextContent(
        '"editedFileName":"edited.jpg"'
      );
    });
    expect(screen.getByTestId('item-state')).toHaveTextContent(
      '"width":80'
    );
    expect(screen.getByTestId('item-state')).toHaveTextContent(
      '"text":"Hello"'
    );
  });
});
