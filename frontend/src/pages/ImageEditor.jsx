import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Download,
  ImagePlus,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import Layout from '../components/Layout';
import FilePreview from '../components/FilePreview';
import { EditableFileName } from '../components/EditableFileName';
import ImageEditorWorkspace from '../components/imageEditor/ImageEditorWorkspace';
import { renderImageWithOverlays } from '../services/imageEditingServices/imageEditService';
import { isGifFile } from '../services/imageConversionServices/extractFrames';

const STATIC_OUTPUT_FORMATS = [
  { label: 'PNG', mime: 'image/png', extension: 'png' },
  { label: 'JPG', mime: 'image/jpeg', extension: 'jpg' },
  { label: 'WEBP', mime: 'image/webp', extension: 'webp' },
];

const GIF_OUTPUT_FORMAT = {
  label: 'GIF',
  mime: 'image/gif',
  extension: 'gif',
};

const getDefaultOutputFormat = (file) => {
  if (isGifFile(file)) return GIF_OUTPUT_FORMAT;

  return (
    STATIC_OUTPUT_FORMATS.find((format) => format.mime === file.type) ||
    STATIC_OUTPUT_FORMATS[0]
  );
};

const createEditedFileName = (fileName, extension) => {
  const extensionStart = fileName.lastIndexOf('.');
  const baseName =
    extensionStart > 0 ? fileName.slice(0, extensionStart) : fileName;

  return `${baseName}_edited.${extension}`;
};

export default function ImageEditor() {
  const [imageItem, setImageItem] = useState(null);
  const [outputFormat, setOutputFormat] = useState(STATIC_OUTPUT_FORMATS[0]);
  const [exportResult, setExportResult] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const imageItemRef = useRef(null);
  const exportResultRef = useRef(null);

  useEffect(() => {
    imageItemRef.current = imageItem;
  }, [imageItem]);

  useEffect(() => {
    exportResultRef.current = exportResult;
  }, [exportResult]);

  const revokeItemUrls = useCallback((item) => {
    if (!item) return;

    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }

    if (
      item.editedPreviewUrl &&
      item.editedPreviewUrl !== item.previewUrl
    ) {
      URL.revokeObjectURL(item.editedPreviewUrl);
    }
  }, []);

  const clearExportResult = useCallback(() => {
    setExportResult((currentResult) => {
      if (currentResult?.previewUrl) {
        URL.revokeObjectURL(currentResult.previewUrl);
      }

      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      revokeItemUrls(imageItemRef.current);

      if (exportResultRef.current?.previewUrl) {
        URL.revokeObjectURL(exportResultRef.current.previewUrl);
      }
    };
  }, [revokeItemUrls]);

  const loadImage = useCallback(
    (file) => {
      if (!file?.type?.startsWith('image/')) {
        setError('Please choose an image file.');
        return;
      }

      revokeItemUrls(imageItemRef.current);

      if (exportResultRef.current?.previewUrl) {
        URL.revokeObjectURL(exportResultRef.current.previewUrl);
      }

      const previewUrl = URL.createObjectURL(file);
      const nextFormat = getDefaultOutputFormat(file);

      setImageItem({
        id: crypto.randomUUID(),
        file,
        previewUrl,
        editedFile: null,
        editedPreviewUrl: '',
        editedCrop: null,
        textLayers: [],
        annotationStrokes: [],
      });
      setOutputFormat(nextFormat);
      setExportResult(null);
      setError('');
    },
    [revokeItemUrls]
  );

  useEffect(() => {
    const handlePaste = (event) => {
      const target = event.target;

      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const image = Array.from(
        event.clipboardData?.files || []
      ).find((file) => file.type.startsWith('image/'));

      if (!image) return;

      event.preventDefault();
      loadImage(image);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [loadImage]);

  const resetPage = () => {
    revokeItemUrls(imageItemRef.current);

    if (exportResultRef.current?.previewUrl) {
      URL.revokeObjectURL(exportResultRef.current.previewUrl);
    }

    setImageItem(null);
    setExportResult(null);
    setError('');
    setIsRendering(false);
  };

  const handleOutputFormatChange = (label) => {
    const nextFormat = STATIC_OUTPUT_FORMATS.find(
      (format) => format.label === label
    );

    if (!nextFormat) return;

    setOutputFormat(nextFormat);
    clearExportResult();
  };

  const handleApply = async ({
    file,
    previewUrl,
    cropPercent,
    resetToOriginal,
    textLayers,
    annotationStrokes,
  }) => {
    if (!imageItem) return;

    setIsRendering(true);
    setError('');

    try {
      const nextEditedFile = resetToOriginal
        ? null
        : file || imageItem.editedFile || imageItem.file;
      const nextEditedPreviewUrl = resetToOriginal
        ? ''
        : previewUrl || imageItem.editedPreviewUrl;
      const sourceFile = nextEditedFile || imageItem.file;
      const nextCrop = resetToOriginal ? null : cropPercent;
      const nextTextLayers = resetToOriginal ? [] : textLayers || [];
      const nextAnnotationStrokes = resetToOriginal
        ? []
        : annotationStrokes || [];

      const rendered = await renderImageWithOverlays({
        file: sourceFile,
        cropPercent: nextCrop,
        textLayers: nextTextLayers,
        annotationStrokes: nextAnnotationStrokes,
        outputType: outputFormat.mime,
      });

      const finalFormat = isGifFile(rendered.file)
        ? GIF_OUTPUT_FORMAT
        : outputFormat;
      const outputFileName = createEditedFileName(
        imageItem.file.name,
        finalFormat.extension
      );

      if (
        imageItem.editedPreviewUrl &&
        imageItem.editedPreviewUrl !== nextEditedPreviewUrl
      ) {
        URL.revokeObjectURL(imageItem.editedPreviewUrl);
      }

      if (exportResultRef.current?.previewUrl) {
        URL.revokeObjectURL(exportResultRef.current.previewUrl);
      }

      const nextItem = {
        ...imageItem,
        editedFile: nextEditedFile,
        editedPreviewUrl: nextEditedPreviewUrl,
        editedCrop: nextCrop,
        textLayers: nextTextLayers,
        annotationStrokes: nextAnnotationStrokes,
      };
      const nextExportResult = {
        file: rendered.file,
        previewUrl: rendered.previewUrl,
        fileName: outputFileName,
        width: rendered.width,
        height: rendered.height,
      };

      imageItemRef.current = nextItem;
      exportResultRef.current = nextExportResult;
      setImageItem(nextItem);
      setOutputFormat(finalFormat);
      setExportResult(nextExportResult);
    } catch (renderError) {
      console.error('Image export failed:', renderError);
      setError(
        renderError.message || 'Could not prepare the edited image.'
      );
    } finally {
      setIsRendering(false);
    }
  };

  const availableFormats = imageItem && isGifFile(imageItem.file)
    ? [GIF_OUTPUT_FORMAT]
    : STATIC_OUTPUT_FORMATS;

  return (
    <Layout>
      <main className="mx-auto max-w-6xl p-6 sm:p-12">
        <nav className="mb-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-stone-600 transition-colors hover:text-stone-900"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Home</span>
          </Link>
        </nav>

        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-extrabold text-stone-900">
            Image Editor
          </h1>
          <p className="text-stone-600">
            Crop, transform and decorate images without compressing them.
          </p>
        </div>

        {!imageItem ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,2.2fr)_minmax(240px,0.8fr)]">
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <label
                className={`relative flex h-72 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors ${
                  isDragging
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-stone-300 hover:border-orange-500'
                }`}
                onDragEnter={() => setIsDragging(true)}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  loadImage(event.dataTransfer.files?.[0]);
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(event) => {
                    loadImage(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />

                <ImagePlus className="mb-4 h-12 w-12 text-stone-400" />
                <p className="font-medium text-stone-700">
                  Drag, drop or paste an image here
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Supports PNG, JPG, WEBP, GIF and other browser-readable images
                </p>
              </label>
            </div>

            <aside className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-600" />
                <h2 className="font-bold text-stone-900">
                  Editing workspace
                </h2>
              </div>

              <ul className="space-y-3 text-sm text-stone-600">
                <li>Crop, rotate and flip</li>
                <li>Apply image filters</li>
                <li>Draw and add styled text</li>
                <li>Edit animated GIFs without flattening them</li>
              </ul>
            </aside>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex min-w-0 items-center gap-4 rounded-xl bg-stone-100 p-4">
              <FilePreview
                file={imageItem.file}
                previewUrl={
                  imageItem.editedPreviewUrl || imageItem.previewUrl
                }
                showInfo={false}
              />

              <div className="min-w-0 flex-1">
                <p
                  title={imageItem.file.name}
                  className="truncate text-sm font-semibold text-stone-800"
                >
                  {imageItem.file.name}
                </p>
                <p className="text-xs text-stone-500">
                  Original size:{' '}
                  {(imageItem.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                  Output:
                </span>

                <div className="relative">
                  <select
                    value={outputFormat.label}
                    onChange={(event) =>
                      handleOutputFormatChange(event.target.value)
                    }
                    className="appearance-none rounded-lg border border-stone-200 bg-white py-2 pl-3 pr-9 font-medium text-stone-800"
                  >
                    {availableFormats.map((format) => (
                      <option key={format.label} value={format.label}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                </div>

                <button
                  type="button"
                  onClick={resetPage}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-200 hover:text-red-500"
                  aria-label="Remove image"
                  title="Remove image"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <ImageEditorWorkspace
              key={imageItem.id}
              presentation="page"
              isOpen
              onClose={resetPage}
              item={imageItem}
              previewUrl={
                imageItem.editedPreviewUrl || imageItem.previewUrl
              }
              originalPreviewUrl={imageItem.previewUrl}
              originalFile={imageItem.file}
              initialCrop={imageItem.editedCrop}
              initialTextLayers={imageItem.textLayers}
              initialAnnotationStrokes={imageItem.annotationStrokes}
              onApply={handleApply}
              applyLabel={
                isRendering ? 'Preparing image...' : 'Prepare download'
              }
            />

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {exportResult && (
              <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-green-200 bg-green-50 p-6 text-green-800 md:flex-row md:items-center">
                <div className="min-w-0 flex-1">
                  <div className="mb-4 flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-green-600" />
                    <h2 className="font-bold text-green-950">
                      Edited image ready
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-8 border-t border-green-200/50 pt-4">
                    <FilePreview
                      file={exportResult.file}
                      previewUrl={exportResult.previewUrl}
                      showInfo={false}
                    />

                    <div className="min-w-0">
                      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-green-700/70">
                        File name
                      </span>
                      <EditableFileName
                        fileName={exportResult.fileName}
                        onSave={(fileName) =>
                          setExportResult((currentResult) => ({
                            ...currentResult,
                            fileName,
                          }))
                        }
                      />
                    </div>

                    <div>
                      <span className="block text-xs font-bold uppercase tracking-wide text-green-700/70">
                        Output
                      </span>
                      <span className="font-black text-green-950">
                        {exportResult.width} × {exportResult.height}
                      </span>
                      <span className="block text-xs font-bold text-stone-500">
                        {(exportResult.file.size / 1024).toFixed(2)} KB
                      </span>
                    </div>
                  </div>
                </div>

                <a
                  href={exportResult.previewUrl}
                  download={exportResult.fileName}
                  className="inline-flex self-stretch items-center justify-center gap-2 rounded-xl bg-green-800 px-6 py-4 text-center text-sm font-bold text-white shadow-md transition hover:scale-[1.02] hover:bg-green-900 active:scale-[0.98] md:self-auto"
                >
                  <Download className="h-4 w-4" />
                  Download edited image
                </a>
              </div>
            )}

            {isRendering && !exportResult && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                Rendering your edited image...
              </div>
            )}
          </div>
        )}
      </main>
    </Layout>
  );
}
