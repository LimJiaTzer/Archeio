import { API_URL } from '../../config/api';

export const anyToHeic = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_URL}/convert-to-heic`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Server-side HEIC conversion failed.');
  }

  return await response.blob();
};
