import { describe, expect, it } from 'vitest';
import { buildQrPayload } from '../../src/lib/qrCodePayload';

describe('buildQrPayload', () => {
  it.each([
    ['link', { url: 'https://archeio.test/files?id=4' }, 'https://archeio.test/files?id=4'],
    ['text', { text: 'Plain text' }, 'Plain text'],
    ['phone', { phone: '+65 6123 4567' }, 'tel:+65 6123 4567'],
    [
      'email',
      { email: 'user@example.com', emailSubject: 'Hello world', emailBody: 'Line 1 & 2' },
      'mailto:user@example.com?subject=Hello%20world&body=Line%201%20%26%202',
    ],
  ])('builds the %s payload', (contentType, contentData, expected) => {
    expect(buildQrPayload(contentType, contentData)).toBe(expected);
  });

  it('escapes reserved Wi-Fi payload characters', () => {
    expect(buildQrPayload('wifi', {
      wifiEncryption: 'WPA',
      wifiSsid: 'Cafe;Guest',
      wifiPassword: 'p:a\\ss',
    })).toBe('WIFI:T:WPA;S:Cafe\\;Guest;P:p\\:a\\\\ss;;');
  });

  it('uses stable defaults for empty content and unknown types', () => {
    expect(buildQrPayload('link', {})).toBe('https://example.com');
    expect(buildQrPayload('text', {})).toBe('Hello World');
    expect(buildQrPayload('unknown', {})).toBe('https://example.com');
  });
});
