import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';

const splitFileName = (fileName) => {
  const extensionStart = fileName.lastIndexOf('.');

  if (extensionStart <= 0) {
    return {
      baseName: fileName,
      extension: '',
    };
  }

  return {
    baseName: fileName.slice(0, extensionStart),
    extension: fileName.slice(extensionStart),
  };
};

export function EditableFileName({ fileName, onSave, className = '' }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const { baseName, extension } = splitFileName(fileName);

  const startEditing = () => {
    setDraftName(baseName);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraftName('');
    setIsEditing(false);
  };

  const saveFileName = () => {
    const trimmedName = draftName.trim();

    if (!trimmedName) return;

    onSave(`${trimmedName}${extension}`);
    setIsEditing(false);
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isEditing ? (
        <>
          <div className="flex max-w-xs items-center rounded-lg border border-green-300 bg-white focus-within:border-green-600">
            <input
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveFileName();
                if (event.key === 'Escape') cancelEditing();
              }}
              aria-label="File name"
              autoFocus
              className="min-w-0 flex-1 rounded-l-lg px-3 py-1 text-sm font-bold text-green-950 outline-none"
            />
            {extension && (
              <span className="pr-3 text-sm font-bold text-stone-500">
                {extension}
              </span>
            )}
          </div>

          <button
            type="button"
            aria-label="Save file name"
            onClick={saveFileName}
            disabled={!draftName.trim()}
            className="rounded-md p-1 text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
          </button>

          <button
            type="button"
            aria-label="Cancel file name editing"
            onClick={cancelEditing}
            className="rounded-md p-1 text-stone-500 hover:bg-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <p
            className="max-w-xs truncate text-sm font-bold text-green-950"
            title={fileName}
          >
            {fileName}
          </p>

          <button
            type="button"
            aria-label={`Edit ${fileName}`}
            onClick={startEditing}
            className="rounded-md p-1 text-green-700 hover:bg-green-100"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  );
}