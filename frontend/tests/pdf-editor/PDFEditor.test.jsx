import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PDFEditor from '../../src/pages/PDFEditor';
import { compilePDF } from '../../src/services/pdfEditorService';

const pdfPage = {
  getViewport: vi.fn(({ scale = 1, rotation = 0 }) => ({
    width: (rotation % 180 === 0 ? 200 : 300) * scale,
    height: (rotation % 180 === 0 ? 300 : 200) * scale,
  })),
  render: vi.fn(() => ({ promise: Promise.resolve() })),
};

vi.mock('react-pdf', () => ({
  pdfjs: {
    version: 'test',
    GlobalWorkerOptions: {},
    getDocument: vi.fn(() => ({
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi.fn(async () => pdfPage),
      }),
    })),
  },
}));

vi.mock('../../src/services/pdfEditorService', () => ({
  compilePDF: vi.fn(),
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

const renderPage = () => render(
  <MemoryRouter>
    <PDFEditor />
  </MemoryRouter>,
);

describe('PDF Editor page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => 'blob:edited-pdf');
    compilePDF.mockResolvedValue(new Blob(['%PDF-test'], { type: 'application/pdf' }));
  });

  it('loads all pages, rotates the active page, and exports the edited document', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    const file = new File(['%PDF'], 'source.pdf', { type: 'application/pdf' });

    await user.upload(container.querySelector('input[type="file"]'), file);
    expect(await screen.findByText(/Pages/)).toHaveTextContent('Pages (2)');
    await waitFor(() => expect(screen.getAllByAltText(/thumbnail/i)).toHaveLength(2));

    await user.click(screen.getByRole('button', { name: /Rotate 90/ }));
    await user.click(screen.getByRole('button', { name: 'Export PDF' }));

    await waitFor(() => expect(compilePDF).toHaveBeenCalledTimes(1));
    const [pages] = compilePDF.mock.calls[0];
    expect(pages).toHaveLength(2);
    expect(pages[0].rotation).toBe(90);
    expect(await screen.findByText('PDF Render Successful!')).toBeInTheDocument();
  });

  it('returns to the upload state when reset is selected', async () => {
    const user = userEvent.setup();
    const { container } = renderPage();
    await user.upload(
      container.querySelector('input[type="file"]'),
      new File(['%PDF'], 'source.pdf', { type: 'application/pdf' }),
    );
    expect(await screen.findByText(/Pages/)).toHaveTextContent('Pages (2)');

    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(screen.getByText('Upload your PDF')).toBeInTheDocument();
  });
});
