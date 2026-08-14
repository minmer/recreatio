import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BINDINGS,
  CONTRIBUTION_ROLES,
  ITEM_CONDITIONS,
  ITEM_STATUSES,
  LOAN_DIRECTIONS,
  MANIFESTATION_FORMATS,
  READING_STATUSES,
  createItem,
  createLoan,
  createManifestation,
  createReading,
  deleteItem,
  deleteManifestation,
  getManifestation,
  getPeople,
  getPlacementGroups,
  getPublishers,
  getShelves,
  getWork,
  saveManifestationContributions,
  scanIsbn,
  updateItem,
  updateLoan,
  updateManifestation,
  type LibraryContributionSave,
  type LibraryItem,
  type LibraryItemSave,
  type LibraryManifestationDetail,
  type LibraryManifestationSave,
  type LibraryPerson,
  type LibraryPlacementGroup,
  type LibraryPublisher,
  type LibraryShelf
} from './libraryApi';
import { languageLabel, type LibraryCopyStrings } from './libraryCopy';
import {
  Badge,
  ContributionEditor,
  DateInput,
  ErrorBanner,
  Field,
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

function emptyManifestation(expressionId: number | null): LibraryManifestationSave {
  return {
    expressionId,
    format: 'Print',
    title: '',
    subtitle: null,
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
    url: null,
    originalTextUrl: null,
    coverImageUrl: null,
    heightMm: null,
    widthMm: null,
    depthMm: null,
    notes: null
  };
}

const emptyItem: LibraryItemSave = {
  shelfId: null,
  placementGroupId: null,
  positionInShelf: null,
  seriesPosition: null,
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
  scanImageUrl: null,
  notes: null
};

/** A published form of a work — print, web page or ebook — and the copies of it. */
export function LibraryManifestationEditorPage({
  t,
  manifestationId,
  newForWorkId,
  presetExpressionId
}: {
  t: LibraryCopyStrings;
  manifestationId: number | null;
  newForWorkId: number | null;
  presetExpressionId: number | null;
}) {
  const navigate = useNavigate();
  const isNew = manifestationId === null;

  const [form, setForm] = useState<LibraryManifestationSave>(emptyManifestation(presetExpressionId));
  const [detail, setDetail] = useState<LibraryManifestationDetail | null>(null);
  const [workId, setWorkId] = useState<number | null>(newForWorkId);
  const [workTitle, setWorkTitle] = useState('');
  const [expressions, setExpressions] = useState<{ id: number; label: string }[]>([]);
  const [contributions, setContributions] = useState<LibraryContributionSave[]>([]);
  const [people, setPeople] = useState<LibraryPerson[]>([]);
  const [publishers, setPublishers] = useState<LibraryPublisher[]>([]);
  const [shelves, setShelves] = useState<LibraryShelf[]>([]);
  const [groups, setGroups] = useState<LibraryPlacementGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);
  const [scanNote, setScanNote] = useState<string | null>(null);

  const [itemDraft, setItemDraft] = useState<{ id: number | null; values: LibraryItemSave } | null>(null);
  const [loanForItem, setLoanForItem] = useState<LibraryItem | null>(null);
  const [readingForItem, setReadingForItem] = useState<LibraryItem | null>(null);
  const [scanTarget, setScanTarget] = useState<'manifestation' | 'item' | null>(null);

  const loadDetail = useCallback(async (id: number) => {
    const data = await getManifestation(id);
    setDetail(data);
    setWorkId(data.workId);
    setWorkTitle(data.workTitle);
    setForm({
      expressionId: data.expressionId,
      format: data.format,
      title: data.title,
      subtitle: data.subtitle,
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
      url: data.url,
      originalTextUrl: data.originalTextUrl,
      coverImageUrl: data.coverImageUrl,
      heightMm: data.heightMm,
      widthMm: data.widthMm,
      depthMm: data.depthMm,
      notes: data.notes
    });
    setContributions(toContributionSaves(data.contributions));

    const work = await getWork(data.workId);
    setExpressions(
      work.expressions.map((expression) => ({
        id: expression.id,
        label: expression.name
          ? `${expression.name} (${languageLabel(t, expression.language)})`
          : languageLabel(t, expression.language)
      }))
    );
  }, [t]);

  useEffect(() => {
    let active = true;
    Promise.all([getPeople(), getPublishers(), getShelves(), getPlacementGroups()])
      .then(([peopleResult, publisherResult, shelfResult, groupResult]) => {
        if (!active) return;
        setPeople(peopleResult);
        setPublishers(publisherResult);
        setShelves(shelfResult);
        setGroups(groupResult);
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
      if (manifestationId !== null) {
        await loadDetail(manifestationId);
        return;
      }
      if (newForWorkId !== null) {
        const work = await getWork(newForWorkId);
        if (!active) return;
        setWorkTitle(work.uniformTitle || work.originalTitle);
        setExpressions(
          work.expressions.map((expression) => ({
            id: expression.id,
            label: expression.name
              ? `${expression.name} (${languageLabel(t, expression.language)})`
              : languageLabel(t, expression.language)
          }))
        );
        setForm({ ...emptyManifestation(presetExpressionId), title: work.originalTitle });
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
  }, [manifestationId, newForWorkId, presetExpressionId, loadDetail, t]);

  const update = <K extends keyof LibraryManifestationSave>(key: K, value: LibraryManifestationSave[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (manifestationId === null) {
        if (newForWorkId === null) return;
        const created = await createManifestation(newForWorkId, form);
        if (contributions.length > 0) await saveManifestationContributions(created.id, contributions);
        navigate(`/library/manifestations/${created.id}`, { replace: true });
        return;
      }
      await updateManifestation(manifestationId, form);
      await saveManifestationContributions(manifestationId, contributions);
      await loadDetail(manifestationId);
      setSavedAt(Date.now());
    } catch {
      setError(t.common.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (manifestationId === null || !confirm(t.manifestation.deleteConfirm)) return;
    try {
      await deleteManifestation(manifestationId, true);
      navigate(workId ? `/library/works/${workId}` : '/library/works');
    } catch {
      setError(t.common.deleteFailed);
    }
  }

  /** Fills only empty fields, so a scan never overwrites what was typed by hand. */
  async function handleScannedForManifestation(code: string) {
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
        publishedPlace: current.publishedPlace ?? lookup.publishedPlace,
        publishedYear: current.publishedYear ?? lookup.publishedYear,
        pageCount: current.pageCount ?? lookup.pageCount,
        series: current.series ?? lookup.series,
        binding: current.binding ?? lookup.binding,
        coverImageUrl: current.coverImageUrl ?? lookup.coverUrl,
        isbn: result.isbn
      }));
      setScanNote(t.scan.prefillApplied);
    } catch (caught) {
      setScanNote(
        caught instanceof Error && caught.message.includes('valid ISBN') ? t.scan.invalidCode : t.common.loadFailed
      );
    }
  }

  async function handleSaveItem() {
    if (!itemDraft || manifestationId === null) return;
    try {
      if (itemDraft.id === null) await createItem(manifestationId, itemDraft.values);
      else await updateItem(itemDraft.id, itemDraft.values);
      setItemDraft(null);
      await loadDetail(manifestationId);
    } catch {
      setError(t.common.saveFailed);
    }
  }

  async function handleDeleteItem(itemId: number) {
    if (manifestationId === null || !confirm(t.item.deleteConfirm)) return;
    try {
      await deleteItem(itemId);
      await loadDetail(manifestationId);
    } catch {
      setError(t.common.deleteFailed);
    }
  }

  async function handleReturn(item: LibraryItem) {
    if (!item.openLoan || manifestationId === null) return;
    try {
      await updateLoan(item.openLoan.id, {
        direction: item.openLoan.direction,
        counterpartName: item.openLoan.counterpartName,
        counterpartContact: item.openLoan.counterpartContact,
        lentOn: item.openLoan.lentOn,
        dueOn: item.openLoan.dueOn,
        returnedOn: todayIso(),
        notes: item.openLoan.notes
      });
      await loadDetail(manifestationId);
    } catch {
      setError(t.common.saveFailed);
    }
  }

  if (loading) return <Loading text={t.common.loading} />;

  const setItemValue = <K extends keyof LibraryItemSave>(key: K, value: LibraryItemSave[K]) =>
    setItemDraft((current) => (current ? { ...current, values: { ...current.values, [key]: value } } : current));

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
            ← {t.manifestation.ofWork}: {workTitle || t.common.unknown}
          </button>
          <h1 className="lib-page-title">
            {isNew ? t.manifestation.newTitle : form.title || t.manifestation.editTitle}{' '}
            <Badge tone="muted">{t.formats[form.format] ?? form.format}</Badge>
          </h1>
        </div>
        <div className="lib-head-actions">
          {savedAt > 0 ? <span className="lib-saved">{t.common.saved}</span> : null}
          <button type="button" className="lib-btn" disabled={saving || !form.title.trim()} onClick={handleSave}>
            {saving ? t.common.saving : t.common.save}
          </button>
          {!isNew ? (
            <button type="button" className="lib-btn lib-btn-danger" onClick={handleDelete}>
              {t.manifestation.deleteManifestation}
            </button>
          ) : null}
        </div>
      </header>

      <Section
        title={t.manifestation.editTitle}
        actions={
          <>
            {scanNote ? <span className="lib-saved">{scanNote}</span> : null}
            <button
              type="button"
              className="lib-btn lib-btn-ghost lib-btn-sm"
              onClick={() => setScanTarget('manifestation')}
            >
              {t.manifestation.scanPrefill}
            </button>
          </>
        }
      >
        <div className="lib-form-grid">
          <Field label={t.manifestation.format} hint={t.manifestation.formatHint}>
            <Select
              value={form.format}
              onChange={(value) => update('format', value)}
              options={vocabularyOptions(MANIFESTATION_FORMATS, t.formats)}
            />
          </Field>
          <Field label={t.manifestation.expression} hint={t.manifestation.expressionHint}>
            <Select
              value={form.expressionId === null ? '' : String(form.expressionId)}
              onChange={(value) => update('expressionId', value === '' ? null : Number(value))}
              options={expressions.map((expression) => ({ value: String(expression.id), label: expression.label }))}
              placeholder={t.expression.noneOption}
            />
          </Field>
          <Field label={t.manifestation.title} hint={t.manifestation.titleHint} required>
            <TextInput value={form.title} onChange={(value) => update('title', value)} maxLength={400} autoFocus={isNew} />
          </Field>
          <Field label={t.manifestation.subtitle}>
            <TextInput value={form.subtitle ?? ''} onChange={(value) => update('subtitle', orNull(value))} maxLength={400} />
          </Field>
          <Field label={t.manifestation.publisher}>
            <Select
              value={form.publisherId === null ? '' : String(form.publisherId)}
              onChange={(value) => update('publisherId', value === '' ? null : Number(value))}
              options={publishers.map((publisher) => ({ value: String(publisher.id), label: publisher.name }))}
              placeholder={t.common.none}
            />
          </Field>
          <Field label={t.manifestation.publishedPlace}>
            <TextInput
              value={form.publishedPlace ?? ''}
              onChange={(value) => update('publishedPlace', orNull(value))}
              maxLength={160}
            />
          </Field>
          <Field label={t.manifestation.publishedYear}>
            <NumberInput value={form.publishedYear} onChange={(value) => update('publishedYear', value)} />
          </Field>
          <Field label={t.manifestation.editionStatement} hint={t.manifestation.editionStatementHint}>
            <TextInput
              value={form.editionStatement ?? ''}
              onChange={(value) => update('editionStatement', orNull(value))}
              maxLength={160}
            />
          </Field>
          <Field label={t.manifestation.series}>
            <TextInput value={form.series ?? ''} onChange={(value) => update('series', orNull(value))} maxLength={200} />
          </Field>
          <Field label={t.manifestation.seriesNumber}>
            <TextInput
              value={form.seriesNumber ?? ''}
              onChange={(value) => update('seriesNumber', orNull(value))}
              maxLength={60}
            />
          </Field>
          <Field label={t.manifestation.isbn}>
            <TextInput value={form.isbn ?? ''} onChange={(value) => update('isbn', orNull(value))} maxLength={32} />
          </Field>
          <Field label={t.manifestation.issn}>
            <TextInput value={form.issn ?? ''} onChange={(value) => update('issn', orNull(value))} maxLength={32} />
          </Field>
          <Field label={t.manifestation.pageCount}>
            <NumberInput value={form.pageCount} onChange={(value) => update('pageCount', value)} min={1} />
          </Field>
          <Field label={t.manifestation.volume}>
            <TextInput value={form.volume ?? ''} onChange={(value) => update('volume', orNull(value))} maxLength={60} />
          </Field>
          <Field label={t.manifestation.binding}>
            <Select
              value={form.binding ?? ''}
              onChange={(value) => update('binding', value === '' ? null : value)}
              options={vocabularyOptions(BINDINGS, t.bindings)}
              placeholder={t.common.none}
            />
          </Field>
          <Field label={t.manifestation.url} hint={t.manifestation.urlHint}>
            <TextInput value={form.url ?? ''} onChange={(value) => update('url', orNull(value))} placeholder="https://…" />
          </Field>
          <Field label={t.manifestation.originalTextUrl} hint={t.manifestation.originalTextUrlHint}>
            <TextInput
              value={form.originalTextUrl ?? ''}
              onChange={(value) => update('originalTextUrl', orNull(value))}
              placeholder="https://…"
            />
          </Field>
          <Field label={t.manifestation.coverImageUrl}>
            <TextInput
              value={form.coverImageUrl ?? ''}
              onChange={(value) => update('coverImageUrl', orNull(value))}
              placeholder="https://…"
            />
          </Field>
          <div className="lib-form-wide">
            <Field label={t.manifestation.notes}>
              <TextArea value={form.notes ?? ''} onChange={(value) => update('notes', orNull(value))} />
            </Field>
          </div>
        </div>
      </Section>

      {/* Dimensions belong to the physical layer but live on the manifestation,
          because every copy of one printing measures the same. */}
      <Section title={t.manifestation.dimensionsSection} hint={t.manifestation.dimensionsHint}>
        <div className="lib-form-grid">
          <Field label={t.manifestation.heightMm}>
            <NumberInput value={form.heightMm} onChange={(value) => update('heightMm', value)} min={1} />
          </Field>
          <Field label={t.manifestation.widthMm}>
            <NumberInput value={form.widthMm} onChange={(value) => update('widthMm', value)} min={1} />
          </Field>
          <Field label={t.manifestation.depthMm}>
            <NumberInput value={form.depthMm} onChange={(value) => update('depthMm', value)} min={1} />
          </Field>
        </div>
      </Section>

      <Section title={t.manifestation.contributorsSection} hint={t.manifestation.contributorsHint}>
        <ContributionEditor
          t={t}
          people={people}
          contributions={contributions}
          roles={CONTRIBUTION_ROLES}
          onChange={setContributions}
        />
      </Section>

      <Section
        title={t.manifestation.itemsSection}
        hint={t.manifestation.itemsHint}
        actions={
          isNew ? null : (
            <button type="button" className="lib-btn lib-btn-sm" onClick={() => setItemDraft({ id: null, values: emptyItem })}>
              {t.manifestation.addItem}
            </button>
          )
        }
      >
        {isNew ? (
          <p className="lib-muted">{t.work.createFirst}</p>
        ) : !detail || detail.items.length === 0 ? (
          <p className="lib-muted">{t.manifestation.noItems}</p>
        ) : (
          <ul className="lib-copy-list">
            {detail.items.map((item) => (
              <li key={item.id} className="lib-copy-row">
                <div className="lib-copy-main">
                  <span className="lib-copy-signature">{item.signature || `#${item.id}`}</span>
                  <span className="lib-copy-meta">
                    {[
                      item.shelfName ?? t.dashboard.unshelved,
                      t.statuses[item.status] ?? item.status,
                      t.readingStatuses[item.readingStatus] ?? item.readingStatus,
                      item.condition ? t.conditions[item.condition] ?? item.condition : null,
                      item.placementGroupName
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {item.openLoan ? (
                    <span className="lib-copy-loan">
                      {item.openLoan.direction === 'out' ? t.item.onLoanTo : t.item.borrowedFrom}{' '}
                      {item.openLoan.counterpartName}
                      {item.openLoan.dueOn ? ` · ${t.item.due} ${formatDate(item.openLoan.dueOn)}` : ''}
                    </span>
                  ) : null}
                </div>
                <div className="lib-copy-side">
                  {item.isFavourite ? <Badge>★</Badge> : null}
                  <Rating value={item.rating} />
                  {item.openLoan ? (
                    <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={() => handleReturn(item)}>
                      {t.item.markReturned}
                    </button>
                  ) : (
                    <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={() => setLoanForItem(item)}>
                      {t.item.lendOut}
                    </button>
                  )}
                  <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={() => setReadingForItem(item)}>
                    {t.item.logReading}
                  </button>
                  <button
                    type="button"
                    className="lib-btn lib-btn-ghost lib-btn-sm"
                    onClick={() =>
                      setItemDraft({
                        id: item.id,
                        values: {
                          shelfId: item.shelfId,
                          placementGroupId: item.placementGroupId,
                          positionInShelf: item.positionInShelf,
                          seriesPosition: item.seriesPosition,
                          signature: item.signature,
                          status: item.status,
                          condition: item.condition,
                          acquiredDate: item.acquiredDate,
                          acquiredFrom: item.acquiredFrom,
                          price: item.price,
                          currency: item.currency,
                          barcode: item.barcode,
                          readingStatus: item.readingStatus,
                          rating: item.rating,
                          isFavourite: item.isFavourite,
                          scanImageUrl: item.scanImageUrl,
                          notes: item.notes
                        }
                      })
                    }
                  >
                    {t.common.edit}
                  </button>
                  <button type="button" className="lib-btn lib-btn-danger lib-btn-sm" onClick={() => handleDeleteItem(item.id)}>
                    {t.common.delete}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {itemDraft ? (
        <Modal
          title={t.item.title}
          onClose={() => setItemDraft(null)}
          footer={
            <>
              <button type="button" className="lib-btn lib-btn-ghost" onClick={() => setItemDraft(null)}>
                {t.common.cancel}
              </button>
              <button type="button" className="lib-btn" onClick={handleSaveItem}>
                {t.common.save}
              </button>
            </>
          }
        >
          <div className="lib-form-grid">
            <Field label={t.item.shelf}>
              <Select
                value={itemDraft.values.shelfId === null ? '' : String(itemDraft.values.shelfId)}
                onChange={(value) => setItemValue('shelfId', value === '' ? null : Number(value))}
                options={shelves.map((shelf) => ({ value: String(shelf.id), label: shelf.name }))}
                placeholder={t.dashboard.unshelved}
              />
            </Field>
            <Field label={t.item.placementGroup}>
              <Select
                value={itemDraft.values.placementGroupId === null ? '' : String(itemDraft.values.placementGroupId)}
                onChange={(value) => setItemValue('placementGroupId', value === '' ? null : Number(value))}
                options={groups.map((group) => ({ value: String(group.id), label: group.name }))}
                placeholder={t.common.none}
              />
            </Field>
            <Field label={t.item.seriesPosition}>
              <NumberInput value={itemDraft.values.seriesPosition} onChange={(value) => setItemValue('seriesPosition', value)} />
            </Field>
            <Field label={t.item.signature} hint={t.item.signatureHint}>
              <TextInput
                value={itemDraft.values.signature ?? ''}
                onChange={(value) => setItemValue('signature', orNull(value))}
                maxLength={80}
              />
            </Field>
            <Field label={t.item.status}>
              <Select
                value={itemDraft.values.status}
                onChange={(value) => setItemValue('status', value)}
                options={vocabularyOptions(ITEM_STATUSES, t.statuses)}
              />
            </Field>
            <Field label={t.item.condition}>
              <Select
                value={itemDraft.values.condition ?? ''}
                onChange={(value) => setItemValue('condition', value === '' ? null : value)}
                options={vocabularyOptions(ITEM_CONDITIONS, t.conditions)}
                placeholder={t.common.none}
              />
            </Field>
            <Field label={t.item.readingStatus}>
              <Select
                value={itemDraft.values.readingStatus}
                onChange={(value) => setItemValue('readingStatus', value)}
                options={vocabularyOptions(READING_STATUSES, t.readingStatuses)}
              />
            </Field>
            <Field label={t.item.rating}>
              <NumberInput value={itemDraft.values.rating} onChange={(value) => setItemValue('rating', value)} min={1} max={10} />
            </Field>
            <Field label={t.item.acquiredDate}>
              <DateInput value={itemDraft.values.acquiredDate} onChange={(value) => setItemValue('acquiredDate', value)} />
            </Field>
            <Field label={t.item.acquiredFrom}>
              <TextInput
                value={itemDraft.values.acquiredFrom ?? ''}
                onChange={(value) => setItemValue('acquiredFrom', orNull(value))}
                maxLength={200}
              />
            </Field>
            <Field label={t.item.price}>
              <NumberInput value={itemDraft.values.price} onChange={(value) => setItemValue('price', value)} min={0} step={0.01} />
            </Field>
            <Field label={t.item.currency}>
              <TextInput
                value={itemDraft.values.currency ?? ''}
                onChange={(value) => setItemValue('currency', orNull(value))}
                maxLength={8}
                placeholder="PLN"
              />
            </Field>
            <Field label={t.item.barcode}>
              <div className="lib-input-with-action">
                <TextInput
                  value={itemDraft.values.barcode ?? ''}
                  onChange={(value) => setItemValue('barcode', orNull(value))}
                  maxLength={64}
                />
                <button type="button" className="lib-btn lib-btn-ghost lib-btn-sm" onClick={() => setScanTarget('item')}>
                  {t.scan.button}
                </button>
              </div>
            </Field>
            <Field label={t.item.scanImageUrl} hint={t.item.scanImageHint}>
              <TextInput
                value={itemDraft.values.scanImageUrl ?? ''}
                onChange={(value) => setItemValue('scanImageUrl', orNull(value))}
                placeholder="https://…"
              />
            </Field>
            <Field label={t.item.favourite}>
              <Toggle
                checked={itemDraft.values.isFavourite}
                onChange={(value) => setItemValue('isFavourite', value)}
                label={t.item.favourite}
              />
            </Field>
            <div className="lib-form-wide">
              <Field label={t.item.notes}>
                <TextArea value={itemDraft.values.notes ?? ''} onChange={(value) => setItemValue('notes', orNull(value))} />
              </Field>
            </div>
          </div>
        </Modal>
      ) : null}

      {scanTarget ? (
        <BarcodeScannerDialog
          t={t}
          title={scanTarget === 'manifestation' ? t.manifestation.scanPrefill : t.scan.title}
          onClose={() => setScanTarget(null)}
          onDetected={(code) => {
            if (scanTarget === 'manifestation') {
              handleScannedForManifestation(code);
              return;
            }
            setScanTarget(null);
            setItemValue('barcode', code);
          }}
        />
      ) : null}

      {loanForItem ? (
        <LoanModal
          t={t}
          item={loanForItem}
          onClose={() => setLoanForItem(null)}
          onSaved={async () => {
            setLoanForItem(null);
            if (manifestationId !== null) await loadDetail(manifestationId);
          }}
          onError={() => setError(t.common.saveFailed)}
        />
      ) : null}

      {readingForItem ? (
        <ReadingModal
          t={t}
          item={readingForItem}
          onClose={() => setReadingForItem(null)}
          onSaved={async () => {
            setReadingForItem(null);
            if (manifestationId !== null) await loadDetail(manifestationId);
          }}
          onError={() => setError(t.common.saveFailed)}
        />
      ) : null}
    </div>
  );
}

function LoanModal({
  t,
  item,
  onClose,
  onSaved,
  onError
}: {
  t: LibraryCopyStrings;
  item: LibraryItem;
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
      await createLoan(item.id, {
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
      title={t.item.lendOut}
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
  item,
  onClose,
  onSaved,
  onError
}: {
  t: LibraryCopyStrings;
  item: LibraryItem;
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
      await createReading(item.id, { startedOn, finishedOn, rating, notes: orNull(notes) });
      await onSaved();
    } catch {
      onError();
    }
  }

  return (
    <Modal
      title={t.item.logReading}
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
