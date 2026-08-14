import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BINDINGS,
  CONTRIBUTION_ROLES,
  COPY_CONDITIONS,
  COPY_STATUSES,
  LOAN_DIRECTIONS,
  READING_STATUSES,
  createCopy,
  createEdition,
  createLoan,
  createReading,
  deleteCopy,
  deleteEdition,
  scanIsbn,
  getEdition,
  getPeople,
  getPublishers,
  getShelves,
  getWork,
  saveEditionContributions,
  updateCopy,
  updateEdition,
  updateLoan,
  type LibraryContributionSave,
  type LibraryCopy,
  type LibraryCopySave,
  type LibraryEditionDetail,
  type LibraryEditionSave,
  type LibraryPerson,
  type LibraryPublisher,
  type LibraryShelf
} from './libraryApi';
import type { LibraryCopyStrings } from './libraryCopy';
import {
  Badge,
  ContributionEditor,
  DateInput,
  ErrorBanner,
  Field,
  LanguageSelect,
  Loading,
  Modal,
  NumberInput,
  Rating,
  Section,
  Select,
  TextArea,
  TextInput,
  Toggle,
  formatDate,
  orNull,
  toContributionSaves,
  todayIso,
  vocabularyOptions
} from './libraryComponents';
import { BarcodeScannerDialog } from './libraryScanner';

function emptyEdition(language: string): LibraryEditionSave {
  return {
    title: '',
    subtitle: null,
    language,
    publisherId: null,
    publishedPlace: null,
    publishedYear: null,
    editionStatement: null,
    series: null,
    seriesNumber: null,
    isbn: null,
    issn: null,
    pageCount: null,
    volume: null,
    binding: null,
    coverUrl: null,
    notes: null
  };
}

const emptyCopy: LibraryCopySave = {
  shelfId: null,
  signature: null,
  status: 'shelf',
  condition: null,
  acquiredDate: null,
  acquiredFrom: null,
  price: null,
  currency: null,
  barcode: null,
  readingStatus: 'unread',
  rating: null,
  isFavourite: false,
  notes: null
};

export function LibraryEditionEditorPage({
  t,
  editionId,
  newForWorkId
}: {
  t: LibraryCopyStrings;
  editionId: number | null;
  newForWorkId: number | null;
}) {
  const navigate = useNavigate();
  const isNew = editionId === null;

  const [form, setForm] = useState<LibraryEditionSave>(emptyEdition('pl'));
  const [detail, setDetail] = useState<LibraryEditionDetail | null>(null);
  const [workTitle, setWorkTitle] = useState('');
  const [workLanguage, setWorkLanguage] = useState('');
  const [contributions, setContributions] = useState<LibraryContributionSave[]>([]);
  const [people, setPeople] = useState<LibraryPerson[]>([]);
  const [publishers, setPublishers] = useState<LibraryPublisher[]>([]);
  const [shelves, setShelves] = useState<LibraryShelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  const [copyDraft, setCopyDraft] = useState<{ id: number | null; values: LibraryCopySave } | null>(null);
  const [loanForCopy, setLoanForCopy] = useState<LibraryCopy | null>(null);
  const [readingForCopy, setReadingForCopy] = useState<LibraryCopy | null>(null);
  // 'edition' fills the bibliographic fields; 'copy' just captures the barcode.
  const [scanTarget, setScanTarget] = useState<'edition' | 'copy' | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);

  const workId = detail?.workId ?? newForWorkId;
  const isTranslation = Boolean(workLanguage) && form.language !== workLanguage;

  const loadDetail = useCallback(async (id: number) => {
    const data = await getEdition(id);
    setDetail(data);
    setWorkTitle(data.workOriginalTitle);
    setWorkLanguage(data.workOriginalLanguage);
    setForm({
      title: data.title,
      subtitle: data.subtitle,
      language: data.language,
      publisherId: data.publisherId,
      publishedPlace: data.publishedPlace,
      publishedYear: data.publishedYear,
      editionStatement: data.editionStatement,
      series: data.series,
      seriesNumber: data.seriesNumber,
      isbn: data.isbn,
      issn: data.issn,
      pageCount: data.pageCount,
      volume: data.volume,
      binding: data.binding,
      coverUrl: data.coverUrl,
      notes: data.notes
    });
    setContributions(toContributionSaves(data.contributions));
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([getPeople(), getPublishers(), getShelves()])
      .then(([peopleResult, publishersResult, shelvesResult]) => {
        if (!active) return;
        setPeople(peopleResult);
        setPublishers(publishersResult);
        setShelves(shelvesResult);
      })
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      });
    return () => {
      active = false;
    };
  }, [t.common.loadFailed]);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const load = async () => {
      if (editionId !== null) {
        await loadDetail(editionId);
        return;
      }
      if (newForWorkId !== null) {
        // A new edition starts in the work's own language: the common case is
        // cataloguing the original first, and switching to a translation is one click.
        const work = await getWork(newForWorkId);
        if (!active) return;
        setWorkTitle(work.originalTitle);
        setWorkLanguage(work.originalLanguage);
        setForm({ ...emptyEdition(work.originalLanguage), title: work.originalTitle });
      }
    };

    load()
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [editionId, loadDetail, newForWorkId, t.common.loadFailed]);

  const update = <K extends keyof LibraryEditionSave>(key: K, value: LibraryEditionSave[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleSave() {
    if (!form.title.trim() || !form.language) return;
    setSaving(true);
    setError(null);
    try {
      if (editionId === null) {
        if (newForWorkId === null) return;
        const created = await createEdition(newForWorkId, form);
        if (contributions.length > 0) await saveEditionContributions(created.id, contributions);
        navigate(`/library/editions/${created.id}`, { replace: true });
        return;
      }
      await updateEdition(editionId, form);
      await saveEditionContributions(editionId, contributions);
      await loadDetail(editionId);
      setSavedAt(Date.now());
    } catch {
      setError(t.common.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (editionId === null) return;
    if (!confirm(t.edition.deleteEditionConfirm)) return;
    try {
      await deleteEdition(editionId);
      navigate(workId ? `/library/works/${workId}` : '/library/works');
    } catch {
      setError(t.common.deleteFailed);
    }
  }

  /**
   * Fills the edition fields from a public catalogue. Only empty fields are
   * overwritten, so a scan never clobbers something already typed by hand — the
   * ISBN is the exception, since that is the thing just scanned.
   */
  async function handleScannedForEdition(code: string) {
    setScanTarget(null);
    setScanNote(null);
    try {
      const result = await scanIsbn(code, true);
      const lookup = result.lookup;
      if (!lookup) {
        setScanNote(t.scan.prefillNothing);
        return;
      }

      setForm((current) => ({
        ...current,
        title: current.title.trim() ? current.title : lookup.title ?? current.title,
        subtitle: current.subtitle ?? lookup.subtitle,
        language: current.language || lookup.language || '',
        publishedPlace: current.publishedPlace ?? lookup.publishedPlace,
        publishedYear: current.publishedYear ?? lookup.publishedYear,
        pageCount: current.pageCount ?? lookup.pageCount,
        series: current.series ?? lookup.series,
        coverUrl: current.coverUrl ?? lookup.coverUrl,
        isbn: result.isbn
      }));
      // Biblioteka Narodowa names the translator, which belongs on the edition.
      // Existing contributions are kept; only genuinely new people are appended.
      if (lookup.translators.length > 0 && people.length > 0) {
        const byName = new Map(people.map((person) => [person.displayName.toLowerCase(), person.id]));
        const additions = lookup.translators
          .map((name) => byName.get(name.toLowerCase()))
          .filter((id): id is number => id !== undefined)
          .filter((id) => !contributions.some((item) => item.personId === id))
          .map((personId) => ({ personId, role: 'translator' }));
        if (additions.length > 0) setContributions((current) => [...current, ...additions]);
      }

      setScanNote(t.scan.prefillApplied);
    } catch (caught) {
      setScanNote(
        caught instanceof Error && caught.message.includes('valid ISBN') ? t.scan.invalidCode : t.common.loadFailed
      );
    }
  }

  async function handleSaveCopy() {
    if (!copyDraft || editionId === null) return;
    try {
      if (copyDraft.id === null) await createCopy(editionId, copyDraft.values);
      else await updateCopy(copyDraft.id, copyDraft.values);
      setCopyDraft(null);
      await loadDetail(editionId);
    } catch {
      setError(t.common.saveFailed);
    }
  }

  async function handleDeleteCopy(copyId: number) {
    if (editionId === null) return;
    if (!confirm(t.copy.deleteConfirm)) return;
    try {
      await deleteCopy(copyId);
      await loadDetail(editionId);
    } catch {
      setError(t.common.deleteFailed);
    }
  }

  async function handleReturn(copy: LibraryCopy) {
    if (!copy.openLoan || editionId === null) return;
    try {
      await updateLoan(copy.openLoan.id, {
        direction: copy.openLoan.direction,
        counterpartName: copy.openLoan.counterpartName,
        counterpartContact: copy.openLoan.counterpartContact,
        lentOn: copy.openLoan.lentOn,
        dueOn: copy.openLoan.dueOn,
        returnedOn: todayIso(),
        notes: copy.openLoan.notes
      });
      await loadDetail(editionId);
    } catch {
      setError(t.common.saveFailed);
    }
  }

  if (loading) return <Loading text={t.common.loading} />;

  const shelfOptions = shelves.map((shelf) => ({ value: String(shelf.id), label: shelf.name }));

  return (
    <div className="lib-editor">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <header className="lib-page-head">
        <div>
          <button
            type="button"
            className="lib-back"
            onClick={() => navigate(workId ? `/library/works/${workId}` : '/library/works')}
          >
            ← {t.edition.ofWork}: {workTitle || t.common.unknown}
          </button>
          <h1 className="lib-page-title">
            {isNew ? t.edition.newTitle : form.title || t.edition.editTitle}{' '}
            <Badge tone={isTranslation ? 'translation' : 'original'}>
              {isTranslation ? t.edition.translationBadge : t.edition.originalBadge}
            </Badge>
          </h1>
        </div>
        <div className="lib-head-actions">
          {savedAt > 0 ? <span className="lib-saved">{t.common.saved}</span> : null}
          <button type="button" className="lib-btn" disabled={saving || !form.title.trim()} onClick={handleSave}>
            {saving ? t.common.saving : t.common.save}
          </button>
          {!isNew ? (
            <button type="button" className="lib-btn lib-btn-danger" onClick={handleDelete}>
              {t.edition.deleteEdition}
            </button>
          ) : null}
        </div>
      </header>

      <Section
        title={t.edition.editTitle}
        actions={
          <>
            {scanNote ? <span className="lib-saved">{scanNote}</span> : null}
            <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={() => setScanTarget('edition')}>
              {t.scan.prefillTitle}
            </button>
          </>
        }
      >
        <div className="lib-form-grid">
          <Field label={t.edition.title} hint={t.edition.titleHint} required>
            <TextInput value={form.title} onChange={(value) => update('title', value)} maxLength={400} autoFocus={isNew} />
          </Field>
          <Field label={t.edition.subtitle}>
            <TextInput
              value={form.subtitle ?? ''}
              onChange={(value) => update('subtitle', orNull(value))}
              maxLength={400}
            />
          </Field>
          <Field label={t.edition.language} hint={t.edition.languageHint} required>
            <LanguageSelect t={t} value={form.language} onChange={(value) => update('language', value)} />
          </Field>
          <Field label={t.edition.publisher}>
            <Select
              value={form.publisherId === null ? '' : String(form.publisherId)}
              onChange={(value) => update('publisherId', value === '' ? null : Number(value))}
              options={publishers.map((publisher) => ({ value: String(publisher.id), label: publisher.name }))}
              placeholder={t.common.none}
            />
          </Field>
          <Field label={t.edition.publishedPlace}>
            <TextInput
              value={form.publishedPlace ?? ''}
              onChange={(value) => update('publishedPlace', orNull(value))}
              maxLength={160}
            />
          </Field>
          <Field label={t.edition.publishedYear}>
            <NumberInput
              value={form.publishedYear}
              onChange={(value) => update('publishedYear', value)}
              min={-3000}
              max={3000}
            />
          </Field>
          <Field label={t.edition.editionStatement} hint={t.edition.editionStatementHint}>
            <TextInput
              value={form.editionStatement ?? ''}
              onChange={(value) => update('editionStatement', orNull(value))}
              maxLength={160}
            />
          </Field>
          <Field label={t.edition.series}>
            <TextInput value={form.series ?? ''} onChange={(value) => update('series', orNull(value))} maxLength={200} />
          </Field>
          <Field label={t.edition.seriesNumber}>
            <TextInput
              value={form.seriesNumber ?? ''}
              onChange={(value) => update('seriesNumber', orNull(value))}
              maxLength={60}
            />
          </Field>
          <Field label={t.edition.isbn}>
            <TextInput value={form.isbn ?? ''} onChange={(value) => update('isbn', orNull(value))} maxLength={32} />
          </Field>
          <Field label={t.edition.issn}>
            <TextInput value={form.issn ?? ''} onChange={(value) => update('issn', orNull(value))} maxLength={32} />
          </Field>
          <Field label={t.edition.pageCount}>
            <NumberInput value={form.pageCount} onChange={(value) => update('pageCount', value)} min={1} />
          </Field>
          <Field label={t.edition.volume}>
            <TextInput value={form.volume ?? ''} onChange={(value) => update('volume', orNull(value))} maxLength={60} />
          </Field>
          <Field label={t.edition.binding}>
            <Select
              value={form.binding ?? ''}
              onChange={(value) => update('binding', value === '' ? null : value)}
              options={vocabularyOptions(BINDINGS, t.bindings)}
              placeholder={t.common.none}
            />
          </Field>
          <Field label={t.edition.coverUrl}>
            <TextInput
              value={form.coverUrl ?? ''}
              onChange={(value) => update('coverUrl', orNull(value))}
              maxLength={500}
              placeholder="https://…"
            />
          </Field>
          <div className="lib-form-wide">
            <Field label={t.edition.notes}>
              <TextArea value={form.notes ?? ''} onChange={(value) => update('notes', orNull(value))} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title={t.edition.contributorsSection} hint={t.edition.contributorsHint}>
        <ContributionEditor
          t={t}
          people={people}
          contributions={contributions}
          roles={CONTRIBUTION_ROLES}
          onChange={setContributions}
        />
      </Section>

      <Section
        title={t.edition.copiesSection}
        hint={t.edition.copiesHint}
        actions={
          isNew ? null : (
            <button
              type="button"
              className="lib-btn lib-btn-sm"
              onClick={() => setCopyDraft({ id: null, values: emptyCopy })}
            >
              {t.edition.addCopy}
            </button>
          )
        }
      >
        {isNew ? (
          <p className="lib-muted">{t.work.createFirst}</p>
        ) : !detail || detail.copies.length === 0 ? (
          <p className="lib-muted">{t.edition.noCopies}</p>
        ) : (
          <ul className="lib-copy-list">
            {detail.copies.map((copy) => (
              <li key={copy.id} className="lib-copy-row">
                <div className="lib-copy-main">
                  <span className="lib-copy-signature">{copy.signature || `#${copy.id}`}</span>
                  <span className="lib-copy-meta">
                    {[
                      copy.shelfName ?? t.shelfView.unshelved,
                      t.statuses[copy.status] ?? copy.status,
                      t.readingStatuses[copy.readingStatus] ?? copy.readingStatus,
                      copy.condition ? t.conditions[copy.condition] ?? copy.condition : null
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {copy.openLoan ? (
                    <span className="lib-copy-loan">
                      {copy.openLoan.direction === 'out' ? t.copy.onLoanTo : t.copy.borrowedFrom}{' '}
                      {copy.openLoan.counterpartName}
                      {copy.openLoan.dueOn ? ` · ${t.copy.due} ${formatDate(copy.openLoan.dueOn)}` : ''}
                    </span>
                  ) : null}
                </div>
                <div className="lib-copy-side">
                  {copy.isFavourite ? <Badge>★</Badge> : null}
                  <Rating value={copy.rating} />
                  {copy.openLoan ? (
                    <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={() => handleReturn(copy)}>
                      {t.copy.markReturned}
                    </button>
                  ) : (
                    <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={() => setLoanForCopy(copy)}>
                      {t.copy.lendOut}
                    </button>
                  )}
                  <button
                    type="button"
                    className="lib-btn lib-btn-ghost lib-btn-sm"
                    onClick={() => setReadingForCopy(copy)}
                  >
                    {t.copy.logReading}
                  </button>
                  <button
                    type="button"
                    className="lib-btn lib-btn-ghost lib-btn-sm"
                    onClick={() =>
                      setCopyDraft({
                        id: copy.id,
                        values: {
                          shelfId: copy.shelfId,
                          signature: copy.signature,
                          status: copy.status,
                          condition: copy.condition,
                          acquiredDate: copy.acquiredDate,
                          acquiredFrom: copy.acquiredFrom,
                          price: copy.price,
                          currency: copy.currency,
                          barcode: copy.barcode,
                          readingStatus: copy.readingStatus,
                          rating: copy.rating,
                          isFavourite: copy.isFavourite,
                          notes: copy.notes
                        }
                      })
                    }
                  >
                    {t.common.edit}
                  </button>
                  <button
                    type="button"
                    className="lib-btn lib-btn-danger lib-btn-sm"
                    onClick={() => handleDeleteCopy(copy.id)}
                  >
                    {t.common.delete}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {copyDraft ? (
        <Modal
          title={t.copy.title}
          onClose={() => setCopyDraft(null)}
          footer={
            <>
              <button type="button" className="lib-btn lib-btn-ghost" onClick={() => setCopyDraft(null)}>
                {t.common.cancel}
              </button>
              <button type="button" className="lib-btn" onClick={handleSaveCopy}>
                {t.common.save}
              </button>
            </>
          }
        >
          <div className="lib-form-grid">
            <Field label={t.copy.shelf}>
              <Select
                value={copyDraft.values.shelfId === null ? '' : String(copyDraft.values.shelfId)}
                onChange={(value) =>
                  setCopyDraft({
                    ...copyDraft,
                    values: { ...copyDraft.values, shelfId: value === '' ? null : Number(value) }
                  })
                }
                options={shelfOptions}
                placeholder={t.shelfView.unshelved}
              />
            </Field>
            <Field label={t.copy.signature} hint={t.copy.signatureHint}>
              <TextInput
                value={copyDraft.values.signature ?? ''}
                onChange={(value) =>
                  setCopyDraft({ ...copyDraft, values: { ...copyDraft.values, signature: orNull(value) } })
                }
                maxLength={80}
              />
            </Field>
            <Field label={t.copy.status}>
              <Select
                value={copyDraft.values.status}
                onChange={(value) => setCopyDraft({ ...copyDraft, values: { ...copyDraft.values, status: value } })}
                options={vocabularyOptions(COPY_STATUSES, t.statuses)}
              />
            </Field>
            <Field label={t.copy.condition}>
              <Select
                value={copyDraft.values.condition ?? ''}
                onChange={(value) =>
                  setCopyDraft({
                    ...copyDraft,
                    values: { ...copyDraft.values, condition: value === '' ? null : value }
                  })
                }
                options={vocabularyOptions(COPY_CONDITIONS, t.conditions)}
                placeholder={t.common.none}
              />
            </Field>
            <Field label={t.copy.readingStatus}>
              <Select
                value={copyDraft.values.readingStatus}
                onChange={(value) =>
                  setCopyDraft({ ...copyDraft, values: { ...copyDraft.values, readingStatus: value } })
                }
                options={vocabularyOptions(READING_STATUSES, t.readingStatuses)}
              />
            </Field>
            <Field label={t.copy.rating}>
              <NumberInput
                value={copyDraft.values.rating}
                onChange={(value) => setCopyDraft({ ...copyDraft, values: { ...copyDraft.values, rating: value } })}
                min={1}
                max={10}
              />
            </Field>
            <Field label={t.copy.acquiredDate}>
              <DateInput
                value={copyDraft.values.acquiredDate}
                onChange={(value) =>
                  setCopyDraft({ ...copyDraft, values: { ...copyDraft.values, acquiredDate: value } })
                }
              />
            </Field>
            <Field label={t.copy.acquiredFrom}>
              <TextInput
                value={copyDraft.values.acquiredFrom ?? ''}
                onChange={(value) =>
                  setCopyDraft({ ...copyDraft, values: { ...copyDraft.values, acquiredFrom: orNull(value) } })
                }
                maxLength={200}
              />
            </Field>
            <Field label={t.copy.price}>
              <NumberInput
                value={copyDraft.values.price}
                onChange={(value) => setCopyDraft({ ...copyDraft, values: { ...copyDraft.values, price: value } })}
                min={0}
                step={0.01}
              />
            </Field>
            <Field label={t.copy.currency}>
              <TextInput
                value={copyDraft.values.currency ?? ''}
                onChange={(value) =>
                  setCopyDraft({ ...copyDraft, values: { ...copyDraft.values, currency: orNull(value) } })
                }
                maxLength={8}
                placeholder="PLN"
              />
            </Field>
            <Field label={t.copy.barcode}>
              <div className="lib-input-with-action">
                <TextInput
                  value={copyDraft.values.barcode ?? ''}
                  onChange={(value) =>
                    setCopyDraft({ ...copyDraft, values: { ...copyDraft.values, barcode: orNull(value) } })
                  }
                  maxLength={64}
                />
                <button
                  type="button"
                  className="lib-btn lib-btn-ghost lib-btn-sm"
                  onClick={() => setScanTarget('copy')}
                >
                  {t.scan.button}
                </button>
              </div>
            </Field>
            <Field label={t.copy.favourite}>
              <Toggle
                checked={copyDraft.values.isFavourite}
                onChange={(value) =>
                  setCopyDraft({ ...copyDraft, values: { ...copyDraft.values, isFavourite: value } })
                }
                label={t.copy.favourite}
              />
            </Field>
            <div className="lib-form-wide">
              <Field label={t.copy.notes}>
                <TextArea
                  value={copyDraft.values.notes ?? ''}
                  onChange={(value) =>
                    setCopyDraft({ ...copyDraft, values: { ...copyDraft.values, notes: orNull(value) } })
                  }
                />
              </Field>
            </div>
          </div>
        </Modal>
      ) : null}

      {scanTarget ? (
        <BarcodeScannerDialog
          t={t}
          title={scanTarget === 'edition' ? t.scan.prefillTitle : t.scan.title}
          onClose={() => setScanTarget(null)}
          onDetected={(code) => {
            if (scanTarget === 'edition') {
              handleScannedForEdition(code);
              return;
            }
            setScanTarget(null);
            setCopyDraft((current) =>
              current ? { ...current, values: { ...current.values, barcode: code } } : current
            );
          }}
        />
      ) : null}

      {loanForCopy ? (
        <LoanModal
          t={t}
          copy={loanForCopy}
          onClose={() => setLoanForCopy(null)}
          onSaved={async () => {
            setLoanForCopy(null);
            if (editionId !== null) await loadDetail(editionId);
          }}
          onError={() => setError(t.common.saveFailed)}
        />
      ) : null}

      {readingForCopy ? (
        <ReadingModal
          t={t}
          copy={readingForCopy}
          onClose={() => setReadingForCopy(null)}
          onSaved={async () => {
            setReadingForCopy(null);
            if (editionId !== null) await loadDetail(editionId);
          }}
          onError={() => setError(t.common.saveFailed)}
        />
      ) : null}
    </div>
  );
}

function LoanModal({
  t,
  copy,
  onClose,
  onSaved,
  onError
}: {
  t: LibraryCopyStrings;
  copy: LibraryCopy;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: () => void;
}) {
  const [direction, setDirection] = useState('out');
  const [counterpartName, setCounterpartName] = useState('');
  const [counterpartContact, setCounterpartContact] = useState('');
  const [lentOn, setLentOn] = useState<string | null>(todayIso());
  const [dueOn, setDueOn] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  async function submit() {
    if (!counterpartName.trim() || !lentOn) return;
    try {
      await createLoan(copy.id, {
        direction,
        counterpartName: counterpartName.trim(),
        counterpartContact: orNull(counterpartContact),
        lentOn,
        dueOn,
        returnedOn: null,
        notes: orNull(notes)
      });
      await onSaved();
    } catch {
      onError();
    }
  }

  return (
    <Modal
      title={t.copy.lendOut}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="lib-btn lib-btn-ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="button" className="lib-btn" disabled={!counterpartName.trim()} onClick={submit}>
            {t.common.save}
          </button>
        </>
      }
    >
      <div className="lib-form-grid">
        <Field label={t.loans.direction}>
          <Select
            value={direction}
            onChange={setDirection}
            options={LOAN_DIRECTIONS.map((value) => ({
              value,
              label: value === 'out' ? t.loans.counterpartOut : t.loans.counterpartIn
            }))}
          />
        </Field>
        <Field label={direction === 'out' ? t.loans.counterpartOut : t.loans.counterpartIn} required>
          <TextInput value={counterpartName} onChange={setCounterpartName} maxLength={200} autoFocus />
        </Field>
        <Field label={t.loans.contact}>
          <TextInput value={counterpartContact} onChange={setCounterpartContact} maxLength={200} />
        </Field>
        <Field label={t.loans.lentOn} required>
          <DateInput value={lentOn} onChange={setLentOn} />
        </Field>
        <Field label={t.loans.dueOn}>
          <DateInput value={dueOn} onChange={setDueOn} />
        </Field>
        <div className="lib-form-wide">
          <Field label={t.loans.notes}>
            <TextArea value={notes} onChange={setNotes} rows={3} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function ReadingModal({
  t,
  copy,
  onClose,
  onSaved,
  onError
}: {
  t: LibraryCopyStrings;
  copy: LibraryCopy;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: () => void;
}) {
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const [finishedOn, setFinishedOn] = useState<string | null>(todayIso());
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  async function submit() {
    try {
      await createReading(copy.id, { startedOn, finishedOn, rating, notes: orNull(notes) });
      await onSaved();
    } catch {
      onError();
    }
  }

  return (
    <Modal
      title={t.copy.logReading}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="lib-btn lib-btn-ghost" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="button" className="lib-btn" onClick={submit}>
            {t.common.save}
          </button>
        </>
      }
    >
      <div className="lib-form-grid">
        <Field label={t.reading.startedOn}>
          <DateInput value={startedOn} onChange={setStartedOn} />
        </Field>
        <Field label={t.reading.finishedOn}>
          <DateInput value={finishedOn} onChange={setFinishedOn} />
        </Field>
        <Field label={t.reading.rating}>
          <NumberInput value={rating} onChange={setRating} min={1} max={10} />
        </Field>
        <div className="lib-form-wide">
          <Field label={t.reading.notes}>
            <TextArea value={notes} onChange={setNotes} rows={3} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
