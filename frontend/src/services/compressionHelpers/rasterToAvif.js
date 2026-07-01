import { API_URL } from '../../config/api';

export const rasterToAvif = async (blob, ratio) => {
  const formData = new FormData();
  formData.append('file', blob, 'input.png');
  formData.append('ratio', ratio);

  const response = await fetch(`${API_URL}/convert-to-avif`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('AVIF conversion failed');
  }

  return await response.blob();
};