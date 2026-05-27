export const FILE_TYPES = {
  documents: {  
    label: 'Documents',

    outputFormats: ['PDF', 'DOCX', 'TXT', 'RTF', 'EPUB', 'PPTX', 'XLSX'],
    formats: {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'text/plain': 'TXT',
      'application/rtf': 'RTF',
      'application/epub+zip': 'EPUB',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    },
  },

  images: {     
    label: 'Images',
    canCrop: true,
    canResize: true,

    outputFormats: ['PNG', 'JPG', 'WEBP', 'GIF', 'SVG', 'HEIC'],
    formats: {
      'image/png': 'PNG',
      'image/jpg': 'JPG',
      'image/jpeg': 'JPG',
      'image/webp': 'WEBP',
      'image/gif': 'GIF',
      'image/svg+xml': 'SVG',
      'image/heic': 'HEIC',
      'image/heif': 'HEIC',
    },
  },

  audio: {      
    label: 'Audio',

    outputFormats: ['MP3', 'MIDI', 'WAV', 'AAC', 'FLAC', 'OGG'],
    formats: {
      'audio/mpeg': 'MP3',
      'audio/midi': 'MIDI',
      'audio/x-midi': 'MIDI',
      'audio/wav': 'WAV',
      'audio/aac': 'AAC',
      'audio/flac': 'FLAC',
      'audio/ogg': 'OGG',
    },
  },

  video: {      
    label: 'Video',
    canCrop: true,
    canResize: true,

    outputFormats: ['MP4', 'MOV', 'AVI', 'MKV', 'WEBM'],
    formats: {
      'video/mp4': 'MP4',
      'video/quicktime': 'MOV',
      'video/x-msvideo': 'AVI',
      'video/x-matroska': 'MKV',
      'video/webm': 'WEBM',
    },
  },
};



export const getFileInfo = (type) => {
  for (const [category, data] of Object.entries(FILE_TYPES)) {
    if (type in data.formats) {
      return {
        category,
        label: data.label,
        outputFormats: data.outputFormats,
        format: data.formats[type],
        canCrop: data.canCrop || false,
        canResize: data.canResize || false,
      };
    }
  }

  // Fallback 
  return {
    category: 'unknown',
    label: 'Unknown',
    outputFormats: [],
    format: null,
    canCrop: false,
    canResize: false,
  };
};