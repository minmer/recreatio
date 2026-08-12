// Publishers, shelves and tags are three small registries with the same shape:
// a flat list, an inline modal editor, and a usage count. They share this file
// rather than repeating the pattern three times in three files.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ApiError,
  createPublisher,
  createShelf,
  createTag,
  deletePublisher,
  deleteShelf,
  deleteTag,
  getPublishers,
  getShelves,
  getTags,
  updatePublisher,
  updateShelf,
  updateTag,
  type LibraryPublisher,
  type LibraryPublisherSave,
  type LibraryShelf,
  type LibraryShelfSave,
  type LibraryTag,
  type LibraryTagSave
} from './libraryApi';
import type { LibraryCopyStrings } from './libraryCopy';
import {
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Modal,
  NumberInput,
  TextArea,
  TextInput,
  orNull
} from './libraryComponents';

// ── Publishers ───────────────────────────────────────────────────────────────

const emptyPublisher: LibraryPublisherSave = { name: '', city: null, notes: null };

export function LibraryPublishersPage({ t }: { t: LibraryCopyStrings }) {
  const [items, setItems] = useState<LibraryPublisher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: number | null; values: LibraryPublisherSave } | null>(null);

  useEffect(() => {
    let active = true;
    getPublishers()
      .then((result) => {
        if (active) setItems(result);
      })
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t.common.loadFailed]);

  async function handleSave() {
    if (!draft || !draft.values.name.trim()) return;
    try {
      if (draft.id === null) await createPublisher(draft.values);
      else await updatePublisher(draft.id, draft.values);
      setDraft(null);
      setItems(await getPublishers());
    } catch {
      setError(t.common.saveFailed);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t.publishers.deleteConfirm)) return;
    try {
      await deletePublisher(id);
      setItems(await getPublishers());
    } catch {
      setError(t.common.deleteFailed);
    }
  }

  if (loading) return <Loading text={t.common.loading} />;

  return (
    <div className="lib-registry">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <header className="lib-page-head">
        <div>
          <h1 className="lib-page-title">{t.publishers.title}</h1>
          <p className="lib-page-subtitle">{t.publishers.subtitle}</p>
        </div>
        <button type="button" className="lib-btn" onClick={() => setDraft({ id: null, values: emptyPublisher })}>
          {t.publishers.add}
        </button>
      </header>

      {items.length === 0 ? (
        <EmptyState text={t.publishers.empty} />
      ) : (
        <ul className="lib-registry-list">
          {items.map((publisher) => (
            <li key={publisher.id} className="lib-registry-row">
              <div className="lib-registry-main">
                <span className="lib-registry-name">{publisher.name}</span>
                <span className="lib-registry-meta">{publisher.city ?? ''}</span>
              </div>
              <div className="lib-registry-side">
                <span className="lib-registry-count">
                  {publisher.editionCount} {t.publishers.editionsCount}
                </span>
                <button
                  type="button"
                  className="lib-btn lib-btn-ghost lib-btn-sm"
                  onClick={() =>
                    setDraft({
                      id: publisher.id,
                      values: { name: publisher.name, city: publisher.city, notes: publisher.notes }
                    })
                  }
                >
                  {t.common.edit}
                </button>
                <button
                  type="button"
                  className="lib-btn lib-btn-danger lib-btn-sm"
                  onClick={() => handleDelete(publisher.id)}
                >
                  {t.common.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <Modal
          title={draft.id === null ? t.publishers.add : t.publishers.title}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button type="button" className="lib-btn lib-btn-ghost" onClick={() => setDraft(null)}>
                {t.common.cancel}
              </button>
              <button type="button" className="lib-btn" disabled={!draft.values.name.trim()} onClick={handleSave}>
                {t.common.save}
              </button>
            </>
          }
        >
          <div className="lib-form-grid">
            <Field label={t.publishers.name} required>
              <TextInput
                value={draft.values.name}
                onChange={(value) => setDraft({ ...draft, values: { ...draft.values, name: value } })}
                maxLength={240}
                autoFocus
              />
            </Field>
            <Field label={t.publishers.city}>
              <TextInput
                value={draft.values.city ?? ''}
                onChange={(value) => setDraft({ ...draft, values: { ...draft.values, city: orNull(value) } })}
                maxLength={160}
              />
            </Field>
            <div className="lib-form-wide">
              <Field label={t.publishers.notes}>
                <TextArea
                  value={draft.values.notes ?? ''}
                  onChange={(value) => setDraft({ ...draft, values: { ...draft.values, notes: orNull(value) } })}
                />
              </Field>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

// ── Shelves ──────────────────────────────────────────────────────────────────

const emptyShelf: LibraryShelfSave = { name: '', location: null, description: null, sortOrder: 0 };

export function LibraryShelvesPage({ t }: { t: LibraryCopyStrings }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<LibraryShelf[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: number | null; values: LibraryShelfSave } | null>(null);

  useEffect(() => {
    let active = true;
    getShelves()
      .then((result) => {
        if (active) setItems(result);
      })
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t.common.loadFailed]);

  async function handleSave() {
    if (!draft || !draft.values.name.trim()) return;
    try {
      if (draft.id === null) await createShelf(draft.values);
      else await updateShelf(draft.id, draft.values);
      setDraft(null);
      setItems(await getShelves());
    } catch {
      setError(t.common.saveFailed);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t.shelves.deleteConfirm)) return;
    try {
      await deleteShelf(id);
      setItems(await getShelves());
    } catch {
      setError(t.common.deleteFailed);
    }
  }

  if (loading) return <Loading text={t.common.loading} />;

  return (
    <div className="lib-registry">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <header className="lib-page-head">
        <div>
          <h1 className="lib-page-title">{t.shelves.title}</h1>
          <p className="lib-page-subtitle">{t.shelves.subtitle}</p>
        </div>
        <button type="button" className="lib-btn" onClick={() => setDraft({ id: null, values: emptyShelf })}>
          {t.shelves.add}
        </button>
      </header>

      {items.length === 0 ? (
        <EmptyState text={t.shelves.empty} />
      ) : (
        <ul className="lib-registry-list">
          {items.map((shelf) => (
            <li key={shelf.id} className="lib-registry-row">
              <div className="lib-registry-main">
                <span className="lib-registry-name">{shelf.name}</span>
                <span className="lib-registry-meta">
                  {[shelf.location, shelf.description].filter(Boolean).join(' · ')}
                </span>
              </div>
              <div className="lib-registry-side">
                <span className="lib-registry-count">
                  {shelf.copyCount} {t.shelves.copiesCount}
                </span>
                <button
                  type="button"
                  className="lib-btn lib-btn-ghost lib-btn-sm"
                  onClick={() => navigate(`/library/shelf?shelfId=${shelf.id}`)}
                >
                  {t.shelves.browse}
                </button>
                <button
                  type="button"
                  className="lib-btn lib-btn-ghost lib-btn-sm"
                  onClick={() =>
                    setDraft({
                      id: shelf.id,
                      values: {
                        name: shelf.name,
                        location: shelf.location,
                        description: shelf.description,
                        sortOrder: shelf.sortOrder
                      }
                    })
                  }
                >
                  {t.common.edit}
                </button>
                <button
                  type="button"
                  className="lib-btn lib-btn-danger lib-btn-sm"
                  onClick={() => handleDelete(shelf.id)}
                >
                  {t.common.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <Modal
          title={draft.id === null ? t.shelves.add : t.shelves.title}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button type="button" className="lib-btn lib-btn-ghost" onClick={() => setDraft(null)}>
                {t.common.cancel}
              </button>
              <button type="button" className="lib-btn" disabled={!draft.values.name.trim()} onClick={handleSave}>
                {t.common.save}
              </button>
            </>
          }
        >
          <div className="lib-form-grid">
            <Field label={t.shelves.name} hint={t.shelves.nameHint} required>
              <TextInput
                value={draft.values.name}
                onChange={(value) => setDraft({ ...draft, values: { ...draft.values, name: value } })}
                maxLength={160}
                autoFocus
              />
            </Field>
            <Field label={t.shelves.location} hint={t.shelves.locationHint}>
              <TextInput
                value={draft.values.location ?? ''}
                onChange={(value) => setDraft({ ...draft, values: { ...draft.values, location: orNull(value) } })}
                maxLength={240}
              />
            </Field>
            <Field label={t.shelves.sortOrder}>
              <NumberInput
                value={draft.values.sortOrder}
                onChange={(value) => setDraft({ ...draft, values: { ...draft.values, sortOrder: value ?? 0 } })}
              />
            </Field>
            <div className="lib-form-wide">
              <Field label={t.shelves.description}>
                <TextArea
                  value={draft.values.description ?? ''}
                  onChange={(value) =>
                    setDraft({ ...draft, values: { ...draft.values, description: orNull(value) } })
                  }
                />
              </Field>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

// ── Tags ─────────────────────────────────────────────────────────────────────

const emptyTag: LibraryTagSave = { name: '', color: null };

export function LibraryTagsPage({ t }: { t: LibraryCopyStrings }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<LibraryTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: number | null; values: LibraryTagSave } | null>(null);

  useEffect(() => {
    let active = true;
    getTags()
      .then((result) => {
        if (active) setItems(result);
      })
      .catch(() => {
        if (active) setError(t.common.loadFailed);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t.common.loadFailed]);

  async function handleSave() {
    if (!draft || !draft.values.name.trim()) return;
    try {
      if (draft.id === null) await createTag(draft.values);
      else await updateTag(draft.id, draft.values);
      setDraft(null);
      setItems(await getTags());
    } catch (caught) {
      // The unique index on (owner, name) is the one conflict worth naming.
      setError(caught instanceof ApiError && caught.status === 409 ? t.tags.duplicate : t.common.saveFailed);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t.tags.deleteConfirm)) return;
    try {
      await deleteTag(id);
      setItems(await getTags());
    } catch {
      setError(t.common.deleteFailed);
    }
  }

  if (loading) return <Loading text={t.common.loading} />;

  return (
    <div className="lib-registry">
      {error ? <ErrorBanner message={error} onDismiss={() => setError(null)} /> : null}

      <header className="lib-page-head">
        <div>
          <h1 className="lib-page-title">{t.tags.title}</h1>
          <p className="lib-page-subtitle">{t.tags.subtitle}</p>
        </div>
        <button type="button" className="lib-btn" onClick={() => setDraft({ id: null, values: emptyTag })}>
          {t.tags.add}
        </button>
      </header>

      {items.length === 0 ? (
        <EmptyState text={t.tags.empty} />
      ) : (
        <ul className="lib-registry-list">
          {items.map((tag) => (
            <li key={tag.id} className="lib-registry-row">
              <div className="lib-registry-main">
                <span className="lib-registry-name">
                  {tag.color ? (
                    <span className="lib-tag-dot" style={{ background: tag.color }} aria-hidden="true" />
                  ) : null}
                  {tag.name}
                </span>
              </div>
              <div className="lib-registry-side">
                <span className="lib-registry-count">
                  {tag.workCount} {t.tags.worksCount}
                </span>
                <button
                  type="button"
                  className="lib-btn lib-btn-ghost lib-btn-sm"
                  onClick={() => navigate(`/library/works?tagId=${tag.id}`)}
                >
                  {t.common.open}
                </button>
                <button
                  type="button"
                  className="lib-btn lib-btn-ghost lib-btn-sm"
                  onClick={() => setDraft({ id: tag.id, values: { name: tag.name, color: tag.color } })}
                >
                  {t.common.edit}
                </button>
                <button type="button" className="lib-btn lib-btn-danger lib-btn-sm" onClick={() => handleDelete(tag.id)}>
                  {t.common.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <Modal
          title={draft.id === null ? t.tags.add : t.tags.title}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button type="button" className="lib-btn lib-btn-ghost" onClick={() => setDraft(null)}>
                {t.common.cancel}
              </button>
              <button type="button" className="lib-btn" disabled={!draft.values.name.trim()} onClick={handleSave}>
                {t.common.save}
              </button>
            </>
          }
        >
          <div className="lib-form-grid">
            <Field label={t.tags.name} required>
              <TextInput
                value={draft.values.name}
                onChange={(value) => setDraft({ ...draft, values: { ...draft.values, name: value } })}
                maxLength={120}
                autoFocus
              />
            </Field>
            <Field label={t.tags.color}>
              <input
                className="lib-input lib-color"
                type="color"
                value={draft.values.color ?? '#7c8ba0'}
                onChange={(event) => setDraft({ ...draft, values: { ...draft.values, color: event.target.value } })}
              />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
