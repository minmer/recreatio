import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CITATION_SCHEMES,
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
  | { kind: 'added'; workId: number; manifestationId: number }
  | { kind: 'error'; message: string };

type ImportDraft = {
  isOriginal: boolean;
  originalTitle: string;
  originalLanguage: string;
  manifestationTitle: string;
  manifestationSubtitle: string;
  expressionLanguage: string;
  expressionName: string;
  kind: string;
  citationScheme: string;
  publisherName: string;
  publishedPlace: string;
  publishedYear: number | null;
  pageCount: number | null;
  series: string;
  binding: string;
  coverImageUrl: string;
  authors: string;
  translators: string;
  shelfId: string;
  createItem: boolean;
};

function draftFrom(result: LibraryScanResult): ImportDraft {
  const lookup = result.lookup;
  const language = lookup?.language ?? 'pl';
  // Biblioteka Narodowa reports the original language, so a translation is
  // recognised without asking. Other catalogues describe only the edition.
  const original = lookup?.originalLanguage ?? null;
  return {
    isOriginal: original === null || original === language,
    originalTitle: lookup?.title ?? '',
    originalLanguage: original ?? language,
    manifestationTitle: lookup?.title ?? '',
    manifestationSubtitle: lookup?.subtitle ?? '',
    expressionLanguage: language,
    expressionName: '',
    kind: 'book',
    citationScheme: 'Page',
    publisherName: lookup?.publisher ?? '',
    publishedPlace: lookup?.publishedPlace ?? '',
    publishedYear: lookup?.publishedYear ?? null,
    pageCount: lookup?.pageCount ?? null,
    series: lookup?.series ?? '',
    binding: lookup?.binding ?? '',
    coverImageUrl: lookup?.coverUrl ?? '',
    authors: (lookup?.authors ?? []).join(', '),
    translators: (lookup?.translators ?? []).join(', '),
    shelfId: '',
    createItem: true
  };
}

function splitNames(value: string): string[] {
  return value.split(',').map((name) => name.trim()).filter((name) => name.length > 0);
}

/**
 * One scan answers both questions: is this already on a shelf, and — if not —
 * what do the public catalogues know about it.
 */
export function LibraryScanDialog({
  t,
  onClose,
  onSearchCode
}: {
  t: LibraryCopyStrings;
  onClose: () => void;
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
      setStage({
        kind: 'error',
        message:
          caught instanceof Error && caught.message.includes('valid ISBN')
            ? t.scan.invalidCode
            : t.common.loadFailed
      });
    }
  }

  async function handleImport() {
    if (stage.kind !== 'result' || !draft) return;
    const manifestationTitle = draft.manifestationTitle.trim() || draft.originalTitle.trim();
    if (!manifestationTitle) return;

    setSaving(true);
    try {
      const body: LibraryScanImport = {
        isbn: stage.result.isbn,
        originalTitle: draft.isOriginal ? manifestationTitle : draft.originalTitle.trim() || manifestationTitle,
        originalLanguage: draft.isOriginal ? draft.expressionLanguage : draft.originalLanguage,
        kind: draft.kind,
        citationScheme: draft.citationScheme,
        firstPublishedYear: null,
        manifestationTitle,
        manifestationSubtitle: orNull(draft.manifestationSubtitle),
        expressionLanguage: draft.expressionLanguage,
        expressionName: orNull(draft.expressionName),
        publisherName: orNull(draft.publisherName),
        publishedPlace: orNull(draft.publishedPlace),
        publishedYear: draft.publishedYear,
        pageCount: draft.pageCount,
        series: orNull(draft.series),
        binding: orNull(draft.binding),
        coverImageUrl: orNull(draft.coverImageUrl),
        heightMm: null,
        widthMm: null,
        depthMm: null,
        authorNames: splitNames(draft.authors),
        translatorNames: splitNames(draft.translators),
        shelfId: draft.shelfId ? Number(draft.shelfId) : null,
        createItem: draft.createItem
      };
      const created = await importScan(body);
      setStage({ kind: 'added', workId: created.workId, manifestationId: created.manifestationId });
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
            <button
              type="button"
              className="lib-btn lib-btn-ghost"
              onClick={() => navigate(`/library/works/${stage.workId}`)}
            >
              {t.scan.openWork}
            </button>
            <button
              type="button"
              className="lib-btn"
              onClick={() => navigate(`/library/manifestations/${stage.manifestationId}`)}
            >
              {t.scan.openManifestation}
            </button>
          </>
        }
      >
        <p className="lib-muted">{t.scan.addedTitle}.</p>
      </Modal>
    );
  }

  const { result } = stage;
  const owned = result.matchingManifestations.length > 0 || result.ownedItems.length > 0;

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
            disabled={saving || !draft || (!draft.manifestationTitle.trim() && !draft.originalTitle.trim())}
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
              {result.matchingManifestations.map((manifestation) => (
                <li key={manifestation.id}>
                  <button
                    type="button"
                    className="lib-link"
                    onClick={() => navigate(`/library/manifestations/${manifestation.id}`)}
                  >
                    {manifestation.title}
                  </button>
                  <span className="lib-muted">
                    {[manifestation.publisherName, manifestation.publishedYear].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))}
              {result.ownedItems.map((item) => (
                <li key={`item-${item.id}`}>
                  <span>
                    {item.shelfName ?? t.dashboard.unshelved}
                    {item.signature ? ` · ${item.signature}` : ''}
                  </span>
                  <Badge tone="muted">{t.statuses[item.status] ?? item.status}</Badge>
                  <Rating value={item.rating} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!result.lookup ? (
          <p className="lib-muted">{result.lookupAttempted ? t.scan.notFound : t.scan.lookupOff}</p>
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
              <Field label={t.manifestation.title} required>
                <TextInput
                  value={draft.manifestationTitle}
                  onChange={(value) => update('manifestationTitle', value)}
                  maxLength={400}
                />
              </Field>
              <Field label={t.manifestation.subtitle}>
                <TextInput
                  value={draft.manifestationSubtitle}
                  onChange={(value) => update('manifestationSubtitle', value)}
                  maxLength={400}
                />
              </Field>
              <Field label={t.expression.language} required>
                <LanguageSelect
                  t={t}
                  value={draft.expressionLanguage}
                  onChange={(value) => update('expressionLanguage', value)}
                />
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
                  <Field label={t.expression.name} hint={t.expression.nameHint}>
                    <TextInput
                      value={draft.expressionName}
                      onChange={(value) => update('expressionName', value)}
                      maxLength={240}
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
              <Field label={t.work.scheme} hint={t.work.schemeHint}>
                <Select
                  value={draft.citationScheme}
                  onChange={(value) => update('citationScheme', value)}
                  options={vocabularyOptions(CITATION_SCHEMES, t.schemes)}
                />
              </Field>
              <Field label={t.manifestation.publisher}>
                <TextInput value={draft.publisherName} onChange={(value) => update('publisherName', value)} maxLength={240} />
              </Field>
              <Field label={t.manifestation.publishedPlace}>
                <TextInput value={draft.publishedPlace} onChange={(value) => update('publishedPlace', value)} maxLength={160} />
              </Field>
              <Field label={t.manifestation.publishedYear}>
                <NumberInput value={draft.publishedYear} onChange={(value) => update('publishedYear', value)} />
              </Field>
              <Field label={t.manifestation.pageCount}>
                <NumberInput value={draft.pageCount} onChange={(value) => update('pageCount', value)} min={1} />
              </Field>
              <Field label={t.manifestation.series}>
                <TextInput value={draft.series} onChange={(value) => update('series', value)} maxLength={200} />
              </Field>
              <Field label={t.scan.shelf}>
                <Select
                  value={draft.shelfId}
                  onChange={(value) => update('shelfId', value)}
                  options={shelves.map((shelf) => ({ value: String(shelf.id), label: shelf.name }))}
                  placeholder={t.dashboard.unshelved}
                />
              </Field>
              <div className="lib-form-wide">
                <Toggle
                  checked={draft.createItem}
                  onChange={(value) => update('createItem', value)}
                  label={t.scan.createItem}
                />
                <p className="lib-field-hint">{t.scan.createItemHint}</p>
              </div>
            </div>

            {draft.coverImageUrl ? (
              <div className="lib-scan-cover">
                <img src={draft.coverImageUrl} alt="" loading="lazy" />
                <span className="lib-muted">{languageLabel(t, draft.expressionLanguage)}</span>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
