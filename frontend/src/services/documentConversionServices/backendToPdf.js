export const backendToPdf = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  // Using the Express backend port 3001
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  
  try {
    const response = await fetch(`${API_URL}/convert-to-pdf`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Conversion failed');
      throw new Error(errorText || 'Server-side conversion failed.');
    }

    return await response.blob();
  } catch (error) {
    console.error('Fetch error:', error);
    if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
      throw new Error('Could not connect to the conversion server. Please ensure the backend is running on port 3001.');
    }
    throw error;
  }
};
