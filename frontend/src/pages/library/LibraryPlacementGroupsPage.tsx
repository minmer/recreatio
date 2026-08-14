import { useEffect, useState } from 'react';
import {
  PLACEMENT_GROUP_KINDS,
  createPlacementGroup,
  deletePlacementGroup,
  getPlacementGroups,
  updatePlacementGroup,
  type LibraryPlacementGroup,
  type LibraryPlacementGroupSave
} from './libraryApi';
import type { LibraryCopyStrings } from './libraryCopy';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Modal,
  Select,
  TextArea,
  TextInput,
  orNull,
  vocabularyOptions
} from './libraryComponents';

const emptyGroup: LibraryPlacementGroupSave = { name: '', groupKind: 'collection', notes: null };

/**
 * Groups the arrangement heuristic must honour: a numbered series that keeps its
 * order, or a set that only has to stay adjacent.
 */
export function LibraryPlacementGroupsPage({ t }: { t: LibraryCopyStrings }) {
  const [items, setItems] = useState<LibraryPlacementGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: number | null; values: LibraryPlacementGroupSave } | null>(null);

  useEffect(() => {
    let active = true;
    getPlacementGroups()
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
      if (draft.id === null) await createPlacementGroup(draft.values);
      else await updatePlacementGroup(draft.id, draft.values);
      setDraft(null);
      setItems(await getPlacementGroups());
    } catch {
      setError(t.common.saveFailed);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t.groups.deleteConfirm)) return;
    try {
      await deletePlacementGroup(id);
      setItems(await getPlacementGroups());
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
          <h1 className="lib-page-title">{t.groups.title}</h1>
          <p className="lib-page-subtitle">{t.groups.subtitle}</p>
        </div>
        <button type="button" className="lib-btn" onClick={() => setDraft({ id: null, values: emptyGroup })}>
          {t.groups.add}
        </button>
      </header>

      {items.length === 0 ? (
        <EmptyState text={t.groups.empty} />
      ) : (
        <ul className="lib-registry-list">
          {items.map((group) => (
            <li key={group.id} className="lib-registry-row">
              <div className="lib-registry-main">
                <span className="lib-registry-name">{group.name}</span>
                <span className="lib-registry-meta">{group.notes ?? ''}</span>
              </div>
              <div className="lib-registry-side">
                <Badge tone={group.groupKind === 'series' ? 'original' : 'muted'}>
                  {t.groupKinds[group.groupKind] ?? group.groupKind}
                </Badge>
                <span className="lib-registry-count">
                  {group.itemCount} {t.groups.items}
                </span>
                <button
                  type="button"
                  className="lib-btn lib-btn-ghost lib-btn-sm"
                  onClick={() =>
                    setDraft({
                      id: group.id,
                      values: { name: group.name, groupKind: group.groupKind, notes: group.notes }
                    })
                  }
                >
                  {t.common.edit}
                </button>
                <button
                  type="button"
                  className="lib-btn lib-btn-danger lib-btn-sm"
                  onClick={() => handleDelete(group.id)}
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
          title={draft.id === null ? t.groups.add : t.groups.title}
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
            <Field label={t.groups.name} required>
              <TextInput
                value={draft.values.name}
                onChange={(value) => setDraft({ ...draft, values: { ...draft.values, name: value } })}
                maxLength={200}
                autoFocus
              />
            </Field>
            <Field label={t.groups.kind} hint={t.groups.kindHint}>
              <Select
                value={draft.values.groupKind}
                onChange={(value) => setDraft({ ...draft, values: { ...draft.values, groupKind: value } })}
                options={vocabularyOptions(PLACEMENT_GROUP_KINDS, t.groupKinds)}
              />
            </Field>
            <div className="lib-form-wide">
              <Field label={t.groups.notes}>
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
