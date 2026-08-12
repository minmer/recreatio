import { useRef, useState } from 'react';
import { exportLibrary, importLibrary, type LibraryImportResult } from './libraryApi';
import type { LibraryCopyStrings } from './libraryCopy';
import { ErrorBanner, Section } from './libraryComponents';

export function LibraryDataPage({ t }: { t: LibraryCopyStrings }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);
  const [imported, setImported] = useState<LibraryImportResult | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const bundle = await exportLibrary();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `library-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setExported(true);
    } catch {
      setError(t.common.loadFailed);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(file: File) {
    setBusy(true);
    setError(null);
    setImported(null);
    try {
      const text = await file.text();
      const result = await importLibrary(JSON.parse(text));
      setImported(result);
    } catch {
      setError(t.data.importFailed);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="lib-data">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <header className="lib-page-head">
        <div>
          <h1 className="lib-page-title">{t.data.title}</h1>
          <p className="lib-page-subtitle">{t.data.subtitle}</p>
        </div>
      </header>

      <Section title={t.data.exportTitle}>
        <p className="lib-muted">{t.data.exportText}</p>
        <button type="button" className="lib-btn" disabled={busy} onClick={handleExport}>
          {t.data.exportButton}
        </button>
        {exported ? <p className="lib-saved">{t.data.exportDone}</p> : null}
      </Section>

      <Section title={t.data.importTitle}>
        <p className="lib-muted">{t.data.importText}</p>
        <p className="lib-warn">{t.data.importWarning}</p>
        <input
          ref={fileRef}
          className="lib-file"
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handleImport(file);
          }}
        />
        {imported ? (
          <p className="lib-saved">
            {t.data.importDone} {imported.works} {t.dashboard.works.toLowerCase()}, {imported.editions}{' '}
            {t.dashboard.editions.toLowerCase()}, {imported.copies} {t.dashboard.copies.toLowerCase()},{' '}
            {imported.people} {t.dashboard.people.toLowerCase()}
          </p>
        ) : null}
      </Section>
    </div>
  );
}
