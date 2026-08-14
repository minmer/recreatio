import { useRef, useState } from 'react';
import { importQuotes, type LibraryQuoteImportResult } from './libraryApi';
import type { LibraryCopyStrings } from './libraryCopy';
import { ErrorBanner, Section } from './libraryComponents';

/** A worked example, so the expected shape is visible rather than described. */
const SAMPLE = `[
  {
    "workTitle": "Fides et ratio",
    "workOriginalLanguage": "la",
    "workCitationScheme": "DocumentParagraph",
    "authorName": "Jan Paweł II",
    "quoteText": "Wiara i rozum są jak dwa skrzydła…",
    "locator": { "paragraph": 1 },
    "tags": ["rozum", "wiara"]
  },
  {
    "workId": 12,
    "quoteText": "A bare quote needs nothing but text and a work.",
    "locator": { "page": 42 }
  }
]`;

export function LibraryDataPage({ t, language }: { t: LibraryCopyStrings; language: string }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LibraryQuoteImportResult | null>(null);

  async function handleImport(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const parsed = JSON.parse(await file.text());
      // Accept a bare array or an object wrapping one.
      const quotes = Array.isArray(parsed) ? parsed : parsed?.quotes;
      if (!Array.isArray(quotes)) {
        setError(t.data.quoteImportFailed);
        return;
      }
      setResult(await importQuotes(quotes, language));
    } catch {
      setError(t.data.quoteImportFailed);
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

      <Section title={t.data.quoteImportTitle}>
        <p className="lib-muted">{t.data.quoteImportText}</p>
        <p className="lib-warn">{t.data.quoteImportWarning}</p>
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

        {result ? (
          <>
            <p className="lib-saved">
              {t.data.quoteImportDone} {result.imported} · {t.dashboard.works} {result.worksCreated} ·{' '}
              {t.dashboard.expressions} {result.expressionsCreated} · {t.dashboard.manifestations}{' '}
              {result.manifestationsCreated} · {t.tags.title} {result.tagsCreated}
            </p>
            {result.errors.length > 0 ? (
              <div className="lib-import-errors">
                <h3 className="lib-barlist-title">
                  {t.data.quoteImportErrors} ({result.failed})
                </h3>
                <ul className="lib-note-list">
                  {result.errors.map((entry) => (
                    <li key={entry.index}>
                      #{entry.index + 1}: {entry.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </Section>

      <Section title={t.data.sampleTitle}>
        <p className="lib-muted">{t.data.sampleText}</p>
        <pre className="lib-sample">{SAMPLE}</pre>
      </Section>
    </div>
  );
}
