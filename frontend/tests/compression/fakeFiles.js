export const MIME_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
  docx:
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx:
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
};

export const createFakeFile = ({
  name,
  type,
  size = 4096,
  content = 'synthetic test bytes',
  lastModified = 1,
}) => {
  const file = new File([content], name, { type, lastModified });

  // Most tests only care about UI/service metadata. Overriding the reported
  // size avoids allocating a genuine 100 MB fixture in memory.
  Object.defineProperty(file, 'size', {
    configurable: true,
    value: size,
  });

  return file;
};

export const createFakeImage = (
  name = 'photo.jpg',
  type = MIME_TYPES.jpg,
  size = 4096
) => createFakeFile({ name, type, size });

export const createFakeMediaSet = () => [
  createFakeImage('photo.jpg', MIME_TYPES.jpg),
  createFakeImage('transparent.png', MIME_TYPES.png),
  createFakeImage('camera.heic', MIME_TYPES.heic),
  createFakeImage('vector.svg', MIME_TYPES.svg),
  createFakeFile({
    name: 'synthetic.mp3',
    type: MIME_TYPES.mp3,
    size: 8192,
  }),
  createFakeFile({
    name: 'synthetic.mp4',
    type: MIME_TYPES.mp4,
    size: 16384,
  }),
];
