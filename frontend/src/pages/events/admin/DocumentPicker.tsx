import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteEventDocument,
  eventDocumentUrl,
  getEventDocuments,
  uploadEventDocument,
  type EventDocument
} from '../../../lib/api';

/**
 * Upload a file for this event, or pick one already uploaded — the picture
 * library's twin, for the things an event hands out: the regulamin, a consent to
 * print, a GPX track.
 *
 * It writes the chosen file's address back to the caller, so the URL field stays
 * the single source of truth and a link to something hosted elsewhere still
 * works exactly as before. The reason to have it at all is that the alternative
 * is a link to somebody's drive, which outlives neither the sharing settings nor
 * the person who made it.
 */
export function DocumentPicker({
  siteId,
  value,
  onPick
}: {
  siteId: string;
  value: string;
  /** The address, and the file's own name — a fresh entry has no label yet. */
  onPick: (url: string, fileName: string, byteSize: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [documents, setDocuments] = useState<EventDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDocuments(await getEventDocuments(siteId));
    } catch {
      // The library is a convenience; typing an address still works without it.
      setDocuments([]);
    }
  }, [siteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadEventDocument(siteId, file);
      onPick(eventDocumentUrl(uploaded.id), uploaded.fileName, uploaded.byteSize);
      await load();
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : 'Nie udało się wgrać pliku.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (document: EventDocument) => {
    if (!window.confirm(`Usunąć „${document.fileName}” z wydarzenia? Części, które go podają, przestaną go oferować.`)) {
      return;
    }
    try {
      await deleteEventDocument(document.id);
      await load();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : 'Nie udało się usunąć pliku.');
    }
  };

  return (
    <div className="eva-docs">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv,.gpx"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <p className="eve-hint">{busy ? 'Wgrywanie…' : 'PDF, DOC(X), XLS(X), PPT(X), ODT, ODS, TXT, CSV lub GPX, do 15 MB.'}</p>

      {documents.length > 0 ? (
        <ul className="eva-doc-list">
          {documents.map((document) => {
            const url = eventDocumentUrl(document.id);
            return (
              <li key={document.id} className={url === value ? 'is-picked' : undefined}>
                <button
                  type="button"
                  className="eva-doc-pick"
                  title={document.fileName}
                  onClick={() => onPick(url, document.fileName, document.byteSize)}
                >
                  <strong>{document.fileName}</strong>
                  <span>{formatSize(document.byteSize)}</span>
                </button>
                <button
                  type="button"
                  className="eve-remove"
                  onClick={() => void remove(document)}
                  aria-label={`Usuń ${document.fileName}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {error ? <p className="eve-error">{error}</p> : null}
    </div>
  );
}

/** The size as a person reads it, which is also what the files slide shows. */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
