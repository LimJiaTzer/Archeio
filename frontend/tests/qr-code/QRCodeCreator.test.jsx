import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import QRCodeCreator from '../../src/pages/QRCodeCreator';

const qrEngine = vi.hoisted(() => ({
  append: vi.fn((element) => element.appendChild(document.createElement('canvas'))),
  update: vi.fn(),
  getRawData: vi.fn(),
}));

vi.mock('qr-code-styling', () => ({
  default: vi.fn(function QRCodeStylingMock() {
    return qrEngine;
  }),
}));

vi.mock('jsqr', () => ({
  default: vi.fn(() => ({ data: 'decoded' })),
}));

vi.mock('html-to-image', () => ({
  toPng: vi.fn(),
  toJpeg: vi.fn(),
  toSvg: vi.fn(),
}));

vi.mock('../../src/services/conversionService', () => ({
  convertImage: vi.fn(),
}));

vi.mock('../../src/components/Layout', () => ({
  default: ({ children }) => <>{children}</>,
}));

const renderPage = () => render(
  <MemoryRouter>
    <QRCodeCreator />
  </MemoryRouter>,
);

describe('QR Code Creator page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    qrEngine.getRawData.mockResolvedValue(new Blob(['qr'], { type: 'image/png' }));
    URL.createObjectURL = vi.fn(() => 'blob:qr');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('updates the QR engine with the final Wi-Fi payload', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /Wi-Fi/i }));
    await user.type(screen.getByPlaceholderText('Network Name (SSID)'), 'Cafe;Guest');
    await user.type(screen.getByPlaceholderText('Password'), 'pass:word');

    await waitFor(() => {
      const finalUpdate = qrEngine.update.mock.calls.at(-1)[0];
      expect(finalUpdate.data).toBe('WIFI:T:WPA;S:Cafe\\;Guest;P:pass\\:word;;');
    });
  });

  it('creates a downloadable PNG result card', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Export QR Code' }));

    await waitFor(() => expect(qrEngine.getRawData).toHaveBeenCalledWith('png'));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(await screen.findByText('QR code ready')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download' }))
      .toHaveAttribute('download', 'custom-qrcode.png');
  });

  it('uses the custom file name and selected format extension', async () => {
    const user = userEvent.setup();
    renderPage();

    const fileNameInput = screen.getByLabelText('File Name');
    await user.clear(fileNameInput);
    await user.type(fileNameInput, 'campaign-poster');
    await user.selectOptions(screen.getByLabelText('Download Format'), 'JPEG');
    await user.click(screen.getByRole('button', { name: 'Export QR Code' }));

    await waitFor(() => expect(qrEngine.getRawData).toHaveBeenCalledWith('jpeg'));
    expect(screen.getByRole('link', { name: 'Download' }))
      .toHaveAttribute('download', 'campaign-poster.jpeg');
  });

  it('keeps multiple exports and packages them as a ZIP', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Export QR Code' }));
    expect(await screen.findByText('QR code ready')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Export QR Code' }));
    expect(await screen.findByText('2 QR codes ready')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Download' })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Download All (ZIP)' }));
    await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled());
    const downloadLink = HTMLAnchorElement.prototype.click.mock.contexts.at(-1);
    expect(downloadLink.download).toBe('archeio-qr-codes.zip');
  });
});
