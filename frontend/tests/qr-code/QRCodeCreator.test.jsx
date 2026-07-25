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

  it('requests a PNG artifact and downloads it with the advertised filename', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Download QR Code' }));

    await waitFor(() => expect(qrEngine.getRawData).toHaveBeenCalledWith('png'));
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
  });
});
