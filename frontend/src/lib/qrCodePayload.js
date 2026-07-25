const DEFAULT_CONTENT = {
  link: 'https://example.com',
  text: 'Hello World',
  phone: '1234567890',
};

const escapeWifiValue = (value = '') => (
  String(value).replace(/([\\;,:"'])/g, '\\$1')
);

export const buildQrPayload = (contentType, contentData = {}) => {
  switch (contentType) {
    case 'link':
      return contentData.url || DEFAULT_CONTENT.link;
    case 'text':
      return contentData.text || DEFAULT_CONTENT.text;
    case 'wifi':
      return [
        `WIFI:T:${escapeWifiValue(contentData.wifiEncryption || 'WPA')}`,
        `S:${escapeWifiValue(contentData.wifiSsid)}`,
        `P:${escapeWifiValue(contentData.wifiPassword)}`,
        '',
        '',
      ].join(';');
    case 'phone':
      return `tel:${contentData.phone || DEFAULT_CONTENT.phone}`;
    case 'email':
      return `mailto:${contentData.email || ''}?subject=${encodeURIComponent(contentData.emailSubject || '')}&body=${encodeURIComponent(contentData.emailBody || '')}`;
    default:
      return DEFAULT_CONTENT.link;
  }
};
