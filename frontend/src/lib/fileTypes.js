// Uncomment if relevant format extensions in FILE_TYPES and output types
// after implementing in the future:

// format are what the user can upload
// output formats are what the user can convert to (based on input format)

///////////////////////////////////
// FILES THAT WEBPAGE RECOGNISES //
///////////////////////////////////
export const FILE_TYPES = {
  // categroy 
  documents: {  
    // data 
    label: 'Documents',

    outputFormats: ['PDF'], // ['DOCX', 'TXT', 'RTF', 'EPUB', 'PPTX', 'XLSX']
    // if its only PDF, can lock it in the dropdown 
    formats: {
      'application/pdf': 'PDF',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
      'application/msword': 'DOC',
      'application/vnd.ms-powerpoint': 'PPT',
      'application/vnd.ms-excel': 'XLS',
      'application/vnd.oasis.opendocument.text': 'ODT',
      'application/vnd.oasis.opendocument.presentation': 'ODP',
      'application/vnd.oasis.opendocument.spreadsheet': 'ODS',
      'text/plain': 'TXT',
      'text/csv': 'CSV',
      'text/markdown': 'MD',
      'application/x-markdown': 'MD',
      'application/rtf': 'RTF',
      'text/rtf': 'RTF',
      'application/epub+zip': 'EPUB', 
    },
  },
  
  images: {
    label: 'Images',
    canCrop: true,
    canResize: true,
    // conversion service handles the jpg to jpeg and ico naming variation
    outputFormats: ['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG', 'ICO', 'HEIC'],
    formats: {
      'image/png': 'PNG',
      'image/jpg': 'JPG',
      'image/jpeg': 'JPG',
      'image/webp': 'WEBP',
      'image/gif': 'GIF',
      'image/svg+xml': 'SVG',
      'image/heic': 'HEIC',
      'image/heif': 'HEIC',
      'image/x-icon': 'ICO',
      'image/vnd.microsoft.icon': 'ICO',
    },
  },

  audio: {      
    label: 'Audio',

    outputFormats: ['MP3', 'WAV', 'AAC', 'FLAC', 'OGG'], //'MIDI'
    formats: {
      'audio/mpeg': 'MP3',
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
    //allow the user to convert videos to videos and audio (extract) or images (GIF)
    outputFormats: ['MP4', 'MOV', 'AVI', 'MKV', 'WEBM', 'GIF'], // ['MP3', 'WAV', 'AAC', 'FLAC', 'OGG'] in futuer if wanna extract audio 
    formats: {
      'video/mp4': 'MP4',
      'video/quicktime': 'MOV',
      'video/x-msvideo': 'AVI',
      'video/x-matroska': 'MKV',
      'video/webm': 'WEBM',
    },
  },
};



/////////////////////////////////////////////////
// returns mime / ext based on uploaded format //
/////////////////////////////////////////////////

// mime: what user selected      ext: label eg something.jpg
// Map for images
export const IMAGE_OUTPUT_TYPES = {
  JPG: { mime: 'image/jpeg', ext: 'jpg' },
  JPEG: { mime: 'image/jpeg', ext: 'jpg' },
  PNG: { mime: 'image/png', ext: 'png' },
  WEBP: { mime: 'image/webp', ext: 'webp' },
  GIF: { mime: 'image/gif', ext: 'gif' },
  SVG: { mime: 'image/svg+xml', ext: 'svg' },
  HEIC: { mime: 'image/heic', ext: 'heic' },
  ICO: { mime: 'image/x-icon', ext: 'ico' },
};


// Map for Documents
export const DOC_OUTPUT_TYPES = {
  PDF: { mime: 'application/pdf', ext: 'pdf' },

  // Microsoft (modern XML)
  DOCX: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
  PPTX: { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx' },
  XLSX: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },

  // Microsoft (old binary)
  DOC: { mime: 'application/msword', ext: 'doc' },
  PPT: { mime: 'application/vnd.ms-powerpoint', ext: 'ppt' },
  XLS: { mime: 'application/vnd.ms-excel', ext: 'xls' },

  // OpenDocument / LibreOffice / OpenOffice 
  ODT: { mime: 'application/vnd.oasis.opendocument.text', ext: 'odt' },
  ODP: { mime: 'application/vnd.oasis.opendocument.presentation', ext: 'odp' },
  ODS: { mime: 'application/vnd.oasis.opendocument.spreadsheet', ext: 'ods' },

  // Plain text / lightweight doc
  TXT: { mime: 'text/plain', ext: 'txt' },
  CSV: { mime: 'text/csv', ext: 'csv' },
  MD: { mime: 'text/markdown', ext: 'md' },

  // Rich text / ebook 
  RTF: { mime: 'application/rtf', ext: 'rtf' },
  EPUB: { mime: 'application/epub+zip', ext: 'epub' }, // ebook 
};

// Map for Videos
export const VIDEO_OUTPUT_TYPES = {
  MP4: { mime: 'video/mp4', ext: 'mp4' },
  MOV: { mime: 'video/quicktime', ext: 'mov' },
  AVI: { mime: 'video/x-msvideo', ext: 'avi' },
  MKV: { mime: 'video/x-matroska', ext: 'mkv' },
  WEBM: { mime: 'video/webm', ext: 'webm' },
  GIF: { mime: 'image/gif', ext: 'gif' },
};

// Map for Audio
export const AUDIO_OUTPUT_TYPES = {
  MP3: { mime: 'audio/mpeg', ext: 'mp3' },
  WAV: { mime: 'audio/wav', ext: 'wav' },
  AAC: { mime: 'audio/aac', ext: 'aac' },
  FLAC: { mime: 'audio/flac', ext: 'flac' },
  OGG: { mime: 'audio/ogg', ext: 'ogg' },
//  MIDI: { mime: 'audio/midi', ext: 'midi' },
};

// to ensure only {file_type} && {pdf} are displayed 
export const getDocumentCompressionOutputs = (inputFormat) => {
  const fmt = inputFormat.toUpperCase();

  if (fmt === 'PDF') return ['PDF'];

  if (DOC_OUTPUT_TYPES[fmt]) {
    return [fmt, 'PDF'];
  }

  return ['PDF'];
};

export const getOutputInfo = (format, category) => {
  const key = (format || '').toUpperCase();
  if (category === 'images') return IMAGE_OUTPUT_TYPES[key] || null;
  if (category === 'video') return VIDEO_OUTPUT_TYPES[key] || null;
  if (category === 'audio') return AUDIO_OUTPUT_TYPES[key] || null;
  if (category === 'documents') return DOC_OUTPUT_TYPES[key] || null;
  return null;
};

export const getFileInfo = (type) => {
  for (const [category, data] of Object.entries(FILE_TYPES)) {
    if (type in data.formats) {
      const formatKey = data.formats[type];

      const outputFormats =
        category === 'documents'
          ? getDocumentCompressionOutputs(formatKey)
          : data.outputFormats || [];

      const outputFormatsInfo = outputFormats.map((f) => {
        const info = getOutputInfo(f, category);
        return info ? { key: f, ...info } : { key: f, mime: null, ext: f.toLowerCase() };
      });

      return {
        category,
        label: data.label,
        outputFormats,
        outputFormatsInfo,
        format: formatKey,
        formatInfo: getOutputInfo(formatKey, category) || null,
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
    outputFormatsInfo: [],
    format: null,
    formatInfo: null,
    canCrop: false,
    canResize: false,
  };
};

