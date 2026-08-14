import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  WORK_KINDS,
  getShelves,
  importScan,
  scanIsbn,
  type LibraryScanImport,
  type LibraryScanResult,
  type LibraryShelf
} from './libraryApi';
import { languageLabel, type LibraryCopyStrings } from './libraryCopy';
import {
  Badge,
  Field,
  LanguageSelect,
  Modal,
  NumberInput,
  Rating,
  Select,
  TextInput,
  Toggle,
  orNull,
  vocabularyOptions
} from './libraryComponents';
import { BarcodeScannerDialog } from './libraryScanner';

type Stage =
  | { kind: 'scanning' }
  | { kind: 'looking'; isbn: string }
  | { kind: 'result'; result: LibraryScanResult }
  | { kind: 'added'; workId: number; editionId: number }
  | { kind: 'error'; message: string };

/** Form the operator confirms before anything is written. */
type ImportDraft = {
  isOriginal: boolean;
  originalTitle: string;
  originalLanguage: string;
  editionTitle: string;
  editionSubtitle: string;
  editionLanguage: string;
  kind: string;
  publisherName: string;
  publishedPlace: string;
  publishedYear: number | null;
  pageCount: number | null;
  series: string;
  coverUrl: string;
  authors: string;
  translators: string;
  shelfId: string;
  createCopy: boolean;
};

function draftFrom(result: LibraryScanResult): ImportDraft {
  const lookup = result.lookup;
  const language = lookup?.language ?? 'pl';
  // Biblioteka Narodowa reports the original language, so a translation is
  // recognised without asking. Other catalogues describe only the edition in
  // hand, and there the original assumption holds until corrected.
  const original = lookup?.originalLanguage ?? null;
  return {
    isOriginal: original === null || original === language,
    originalTitle: lookup?.title ?? '',
    originalLanguage: original ?? language,
    editionTitle: lookup?.title ?? '',
    editionSubtitle: lookup?.subtitle ?? '',
    editionLanguage: language,
    kind: 'book',
    publisherName: lookup?.publisher ?? '',
    publishedPlace: lookup?.publishedPlace ?? '',
    publishedYear: lookup?.publishedYear ?? null,
    pageCount: lookup?.pageCount ?? null,
    series: lookup?.series ?? '',
    coverUrl: lookup?.coverUrl ?? '',
    authors: (lookup?.authors ?? []).join(', '),
    translators: (lookup?.translators ?? []).join(', '),
    shelfId: '',
    createCopy: true
  };
}

function splitNames(value: string): string[] {
  return value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
}

/**
 * The scan flow used both for adding and for checking the shelf: one lookup
 * reports what is already owned and what the public catalogues know, and the
 * operator decides which of the two matters.
 */
export function LibraryScanDialog({
  t,
  onClose,
  onSearchCode
}: {
  t: LibraryCopyStrings;
  onClose: () => void;
  /** Offered when the code is worth pushing into the page's own search box. */
  onSearchCode?: (code: string) => void;
}) {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>({ kind: 'scanning' });
  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [shelves, setShelves] = useState<LibraryShelf[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getShelves()
      .then((result) => {
        if (active) setShelves(result);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function handleDetected(code: string) {
    setStage({ kind: 'looking', isbn: code });
    try {
      const result = await scanIsbn(code);
      setDraft(draftFrom(result));
      setStage({ kind: 'result', result });
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message.includes('valid ISBN')
          ? t.scan.invalidCode
          : t.common.loadFailed;
      setStage({ kind: 'error', message });
    }
  }

  async function handleImport() {
    if (stage.kind !== 'result' || !draft) return;
    if (!draft.originalTitle.trim() && !draft.editionTitle.trim()) return;

    setSaving(true);
    try {
      const editionTitle = draft.editionTitle.trim() || draft.originalTitle.trim();
      const originalTitle = draft.isOriginal ? editionTitle : draft.originalTitle.trim() || editionTitle;
      const body: LibraryScanImport = {
        isbn: stage.result.isbn,
        originalTitle,
        originalLanguage: draft.isOriginal ? draft.editionLanguage : draft.originalLanguage,
        kind: draft.kind,
        firstPublishedYear: null,
        editionTitle,
        editionSubtitle: orNull(draft.editionSubtitle),
        editionLanguage: draft.editionLanguage,
        publisherName: orNull(draft.publisherName),
        publishedPlace: orNull(draft.publishedPlace),
        publishedYear: draft.publishedYear,
        pageCount: draft.pageCount,
        series: orNull(draft.series),
        coverUrl: orNull(draft.coverUrl),
        authorNames: splitNames(draft.authors),
        translatorNames: splitNames(draft.translators),
        shelfId: draft.shelfId ? Number(draft.shelfId) : null,
        createCopy: draft.createCopy
      };
      const created = await importScan(body);
      setStage({ kind: 'added', workId: created.workId, editionId: created.editionId });
    } catch {
      setStage({ kind: 'error', message: t.common.saveFailed });
    } finally {
      setSaving(false);
    }
  }

  const update = <K extends keyof ImportDraft>(key: K, value: ImportDraft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  if (stage.kind === 'scanning') {
    return <BarcodeScannerDialog t={t} title={t.scan.title} onClose={onClose} onDetected={handleDetected} />;
  }

  if (stage.kind === 'looking') {
    return (
      <Modal title={t.scan.title} onClose={onClose}>
        <p className="lib-muted">
          {t.scan.looking} ({stage.isbn})
        </p>
      </Modal>
    );
  }

  if (stage.kind === 'error') {
    return (
      <Modal
        title={t.scan.title}
        onClose={onClose}
        footer={
          <>
            <button type="button" className="lib-btn lib-btn-ghost" onClick={onClose}>
              {t.common.close}
            </button>
            <button type="button" className="lib-btn" onClick={() => setStage({ kind: 'scanning' })}>
              {t.scan.scanAgain}
            </button>
          </>
        }
      >
        <p className="lib-warn">{stage.message}</p>
      </Modal>
    );
  }

  if (stage.kind === 'added') {
    return (
      <Modal
        title={t.scan.addedTitle}
        onClose={onClose}
        footer={
          <>
            <button type="button" className="lib-btn lib-btn-ghost" onClick={() => setStage({ kind: 'scanning' })}>
              {t.scan.scanAgain}
            </button>
            <button type="button" className="lib-btn lib-btn-ghost" onClick={() => navigate(`/library/works/${stage.workId}`)}>
              {t.scan.openWork}
            </button>
            <button type="button" className="lib-btn" onClick={() => navigate(`/library/editions/${stage.editionId}`)}>
              {t.scan.openEdition}
            </button>
          </>
        }
      >
        <p className="lib-muted">{t.scan.addedTitle}.</p>
      </Modal>
    );
  }

  const { result } = stage;
  const owned = result.matchingEditions.length > 0 || result.ownedCopies.length > 0;

  return (
    <Modal
      title={t.scan.title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="lib-btn lib-btn-ghost" onClick={() => setStage({ kind: 'scanning' })}>
            {t.scan.scanAgain}
          </button>
          {onSearchCode ? (
            <button
              type="button"
              className="lib-btn lib-btn-ghost"
              onClick={() => {
                onSearchCode(result.isbn);
                onClose();
              }}
            >
              {t.scan.searchInstead}
            </button>
          ) : null}
          <button
            type="button"
            className="lib-btn"
            disabled={saving || !draft || (!draft.editionTitle.trim() && !draft.originalTitle.trim())}
            onClick={handleImport}
          >
            {saving ? t.scan.adding : t.scan.addToLibrary}
          </button>
        </>
      }
    >
      <div className="lib-scan-result">
        <p className="lib-scan-isbn">ISBN {result.isbn}</p>

        {owned ? (
          <div className="lib-scan-owned">
            <strong>{t.scan.alreadyOwned}</strong>
            <p className="lib-muted">{t.scan.alreadyOwnedHint}</p>
            <ul className="lib-scan-owned-list">
              {result.matchingEditions.map((edition) => (
                <li key={edition.id}>
                  <button type="button" className="lib-link" onClick={() => navigate(`/library/editions/${edition.id}`)}>
                    {edition.title}
                  </button>
                  <span className="lib-muted">
                    {[edition.publisherName, edition.publishedYear ? String(edition.publishedYear) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
              {result.ownedCopies.map((copy) => (
                <li key={`copy-${copy.id}`}>
                  <span>
                    {copy.shelfName ?? t.shelfView.unshelved}
                    {copy.signature ? ` · ${copy.signature}` : ''}
                  </span>
                  <Badge tone="muted">{t.statuses[copy.status] ?? copy.status}</Badge>
                  <Rating value={copy.rating} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!result.lookup ? (
          <p className="lib-muted">
            {result.lookupAttempted ? t.scan.notFound : t.scan.lookupOff}
          </p>
        ) : (
          <p className="lib-scan-source">
            {t.scan.foundVia}: {result.lookup.sources.join(', ')}
          </p>
        )}

        {draft ? (
          <>
            <div className="lib-scan-toggle">
              <Toggle
                checked={draft.isOriginal}
                onChange={(value) => update('isOriginal', value)}
                label={t.scan.treatAsOriginal}
              />
              <p className="lib-field-hint">{t.scan.treatAsOriginalHint}</p>
            </div>

            <div className="lib-form-grid">
              <Field label={t.edition.title} required>
                <TextInput value={draft.editionTitle} onChange={(value) => update('editionTitle', value)} maxLength={400} />
              </Field>
              <Field label={t.edition.subtitle}>
                <TextInput
                  value={draft.editionSubtitle}
                  onChange={(value) => update('editionSubtitle', value)}
                  maxLength={400}
                />
              </Field>
              <Field label={t.edition.language} required>
                <LanguageSelect t={t} value={draft.editionLanguage} onChange={(value) => update('editionLanguage', value)} />
              </Field>

              {!draft.isOriginal ? (
                <>
                  <Field label={t.scan.originalTitleField} hint={t.scan.translationHint} required>
                    <TextInput
                      value={draft.originalTitle}
                      onChange={(value) => update('originalTitle', value)}
                      maxLength={400}
                    />
                  </Field>
                  <Field label={t.work.originalLanguage} required>
                    <LanguageSelect
                      t={t}
                      value={draft.originalLanguage}
                      onChange={(value) => update('originalLanguage', value)}
                    />
                  </Field>
                </>
              ) : null}

              <Field label={t.work.authorsSection}>
                <TextInput value={draft.authors} onChange={(value) => update('authors', value)} />
              </Field>
              <Field label={t.roles.translator}>
                <TextInput value={draft.translators} onChange={(value) => update('translators', value)} />
              </Field>
              <Field label={t.work.kind}>
                <Select
                  value={draft.kind}
                  onChange={(value) => update('kind', value)}
                  options={vocabularyOptions(WORK_KINDS, t.kinds)}
                />
              </Field>
              <Field label={t.edition.publisher}>
                <TextInput value={draft.publisherName} onChange={(value) => update('publisherName', value)} maxLength={240} />
              </Field>
              <Field label={t.edition.publishedPlace}>
                <TextInput
                  value={draft.publishedPlace}
                  onChange={(value) => update('publishedPlace', value)}
                  maxLength={160}
                />
              </Field>
              <Field label={t.edition.publishedYear}>
                <NumberInput value={draft.publishedYear} onChange={(value) => update('publishedYear', value)} />
              </Field>
              <Field label={t.edition.pageCount}>
                <NumberInput value={draft.pageCount} onChange={(value) => update('pageCount', value)} min={1} />
              </Field>
              <Field label={t.edition.series}>
                <TextInput value={draft.series} onChange={(value) => update('series', value)} maxLength={200} />
              </Field>
              <Field label={t.scan.shelf}>
                <Select
                  value={draft.shelfId}
                  onChange={(value) => update('shelfId', value)}
                  options={shelves.map((shelf) => ({ value: String(shelf.id), label: shelf.name }))}
                  placeholder={t.shelfView.unshelved}
                />
              </Field>
              <div className="lib-form-wide">
                <Toggle
                  checked={draft.createCopy}
                  onChange={(value) => update('createCopy', value)}
                  label={t.scan.createCopy}
                />
                <p className="lib-field-hint">{t.scan.createCopyHint}</p>
              </div>
            </div>

            {draft.coverUrl ? (
              <div className="lib-scan-cover">
                <img src={draft.coverUrl} alt="" loading="lazy" />
                <span className="lib-muted">
                  {draft.editionLanguage ? languageLabel(t, draft.editionLanguage) : ''}
                </span>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
