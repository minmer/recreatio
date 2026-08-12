import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createPerson,
  deletePerson,
  getPeople,
  updatePerson,
  type LibraryPerson,
  type LibraryPersonSave
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

const emptyPerson: LibraryPersonSave = {
  displayName: '',
  sortName: null,
  birthYear: null,
  deathYear: null,
  nationality: null,
  notes: null
};

export function LibraryPeoplePage({ t }: { t: LibraryCopyStrings }) {
  const navigate = useNavigate();
  const [people, setPeople] = useState<LibraryPerson[]>([]);
  const [term, setTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ id: number | null; values: LibraryPersonSave } | null>(null);

  const reload = async () => {
    const result = await getPeople();
    setPeople(result);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    getPeople()
      .then((result) => {
        if (active) setPeople(result);
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

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return people;
    return people.filter(
      (person) =>
        person.displayName.toLowerCase().includes(needle) ||
        (person.sortName ?? '').toLowerCase().includes(needle)
    );
  }, [people, term]);

  async function handleSave() {
    if (!draft || !draft.values.displayName.trim()) return;
    try {
      if (draft.id === null) await createPerson(draft.values);
      else await updatePerson(draft.id, draft.values);
      setDraft(null);
      await reload();
    } catch {
      setError(t.common.saveFailed);
    }
  }

  async function handleDelete(person: LibraryPerson) {
    if (!confirm(t.people.deleteConfirm)) return;
    try {
      await deletePerson(person.id);
      await reload();
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
          <h1 className="lib-page-title">{t.people.title}</h1>
          <p className="lib-page-subtitle">{t.people.subtitle}</p>
        </div>
        <button type="button" className="lib-btn" onClick={() => setDraft({ id: null, values: emptyPerson })}>
          {t.people.add}
        </button>
      </header>

      <div className="lib-filters">
        <input
          className="lib-input lib-search"
          value={term}
          placeholder={t.people.searchPlaceholder}
          onChange={(event) => setTerm(event.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState text={people.length === 0 ? t.people.empty : t.works.emptyFiltered} />
      ) : (
        <ul className="lib-registry-list">
          {filtered.map((person) => (
            <li key={person.id} className="lib-registry-row">
              <div className="lib-registry-main">
                <span className="lib-registry-name">{person.displayName}</span>
                <span className="lib-registry-meta">
                  {[
                    person.sortName,
                    person.birthYear || person.deathYear
                      ? `${person.birthYear ?? '?'}–${person.deathYear ?? ''}`
                      : null,
                    person.nationality
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
              <div className="lib-registry-side">
                <span className="lib-registry-count">
                  {person.workCount} {t.people.worksCount} · {person.editionCount} {t.people.editionsCount}
                </span>
                <button
                  type="button"
                  className="lib-btn lib-btn-ghost lib-btn-sm"
                  onClick={() => navigate(`/library/works?personId=${person.id}`)}
                >
                  {t.people.viewWorks}
                </button>
                <button
                  type="button"
                  className="lib-btn lib-btn-ghost lib-btn-sm"
                  onClick={() =>
                    setDraft({
                      id: person.id,
                      values: {
                        displayName: person.displayName,
                        sortName: person.sortName,
                        birthYear: person.birthYear,
                        deathYear: person.deathYear,
                        nationality: person.nationality,
                        notes: person.notes
                      }
                    })
                  }
                >
                  {t.common.edit}
                </button>
                <button
                  type="button"
                  className="lib-btn lib-btn-danger lib-btn-sm"
                  onClick={() => handleDelete(person)}
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
          title={draft.id === null ? t.people.add : t.people.title}
          onClose={() => setDraft(null)}
          footer={
            <>
              <button type="button" className="lib-btn lib-btn-ghost" onClick={() => setDraft(null)}>
                {t.common.cancel}
              </button>
              <button
                type="button"
                className="lib-btn"
                disabled={!draft.values.displayName.trim()}
                onClick={handleSave}
              >
                {t.common.save}
              </button>
            </>
          }
        >
          <div className="lib-form-grid">
            <Field label={t.people.displayName} hint={t.people.displayNameHint} required>
              <TextInput
                value={draft.values.displayName}
                onChange={(value) => setDraft({ ...draft, values: { ...draft.values, displayName: value } })}
                maxLength={240}
                autoFocus
              />
            </Field>
            <Field label={t.people.sortName} hint={t.people.sortNameHint}>
              <TextInput
                value={draft.values.sortName ?? ''}
                onChange={(value) => setDraft({ ...draft, values: { ...draft.values, sortName: orNull(value) } })}
                maxLength={240}
              />
            </Field>
            <Field label={t.people.birthYear}>
              <NumberInput
                value={draft.values.birthYear}
                onChange={(value) => setDraft({ ...draft, values: { ...draft.values, birthYear: value } })}
                min={-3000}
                max={3000}
              />
            </Field>
            <Field label={t.people.deathYear}>
              <NumberInput
                value={draft.values.deathYear}
                onChange={(value) => setDraft({ ...draft, values: { ...draft.values, deathYear: value } })}
                min={-3000}
                max={3000}
              />
            </Field>
            <Field label={t.people.nationality}>
              <TextInput
                value={draft.values.nationality ?? ''}
                onChange={(value) => setDraft({ ...draft, values: { ...draft.values, nationality: orNull(value) } })}
                maxLength={80}
              />
            </Field>
            <div className="lib-form-wide">
              <Field label={t.people.notes}>
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
