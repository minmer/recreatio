/**
 * WÄHLEN AUS DER BIBLIOTHEK (0064).
 *
 * <code>
 *   RefPicker          im Editor: ein Werk, Autoren, Themen — suchen, wählen,
 *                      oder gleich neu anlegen („Utwórz: Ratzinger")
 *   PickLibrary        im Seiteneditor: welche Bibliothek (oder 0110: welche
 *                      Baza wiedzy) ein Baustein zeigt
 *   PickLibraryEntry   im Seiteneditor: welcher veröffentlichte Text, welches
 *                      Projekt, welches Thema — nur Veröffentlichtes, denn nur
 *                      das kann eine öffentliche Seite zeigen
 * </code>
 */

import { useEffect, useId, useMemo, useState } from 'react';

import { libraryKindOf, loadLibraries, loadPublished, openLibraries, summaryOf, type LibraryKind, type OpenLibrary, type PublishedItem } from './library';
import { kindOf, str, type LibEntry } from './libraryKinds';
import type { Entry, LibraryStore } from './libraryStore';
import { useMe, useWho } from '../core/me';
import { viewPath } from '../routes';
import { WorkspaceError, type Who } from '../core/session';
import { Loading } from '../ui/Loading';

/** Wie ein Eintrag als Wahl erscheint: Titel und, wo es hilft, etwas dazu. */
export function entryLine(entry: LibEntry, store: LibraryStore): string {
  const title = store.title(entry);
  if (entry.kind === 'person') return [title, str(entry.data, 'years')].filter(Boolean).join(' · ');
  if (entry.kind === 'work') {
    const author = store.get((entry.data.authors as string[] | undefined)?.[0] ?? '');
    return [author === undefined ? '' : store.title(author), title, str(entry.data, 'year')].filter(Boolean).join(' · ');
  }
  return title;
}

/** Das Feld, das beim schnellen Anlegen den getippten Namen bekommt. */
const NAME_FIELD: Record<string, string> = { person: 'name', topic: 'name', work: 'title', project: 'title', text: 'title', quote: 'text' };

export function RefPicker({ store, kinds, value, multiple, busy, onChange, placeholder, only, makeWith }: {
  store: LibraryStore;
  kinds: readonly string[];
  value: readonly string[];
  multiple: boolean;
  busy?: boolean;
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** 2026-10-21 — nur diese zur Wahl (die Werte EINES Aspekts). */
  only?: (entry: Entry) => boolean;
  /** … und was ein neu angelegter dazu bekommt (sein Oberthema: der Aspekt). */
  makeWith?: Readonly<Record<string, unknown>>;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [making, setMaking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const list = useId();

  const chosen = value.map((id) => store.get(id)).filter((e): e is NonNullable<typeof e> => e !== undefined);
  const found = useMemo(() => (query.trim() === ''
    ? store.all().filter((e) => kinds.includes(e.kind)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    : store.search(query, kinds)).filter((e) => !value.includes(e.id) && (only === undefined || only(e))).slice(0, 8),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [query, kinds, value, store, store.revision, only]);

  const pick = (id: string) => {
    onChange(multiple ? [...value, id] : [id]);
    setQuery('');
    setOpen(multiple);
  };

  const make = async () => {
    const kind = kinds[0];
    const name = query.trim();
    if (kind === undefined || name === '') return;
    setMaking(true);
    setFailed(null);
    try {
      const data: Record<string, unknown> = { ...(makeWith ?? {}), [NAME_FIELD[kind] ?? 'title']: name };
      if (kind === 'person') {
        const parts = name.split(/\s+/);
        if (parts.length >= 2 && !/^(św\.|bł\.|ks\.|o\.|s\.)$/i.test(parts[0])) {
          data.surname = parts[parts.length - 1];
          data.givenNames = parts.slice(0, -1).join(' ');
          delete data.name;
        }
      }
      const saved = await store.save({ kind, data });
      pick(saved.id);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się utworzyć.');
    } finally {
      setMaking(false);
    }
  };

  return (
    <div className="lib-picker">
      {chosen.length > 0 && (
        <ul className="lib-picked">
          {chosen.map((entry) => (
            <li key={entry.id} className="lib-chip">
              <a href={viewPath('library', store.libraryId, entry.id)}>{entryLine(entry, store)}</a>
              <button type="button" className="lib-chip-x" aria-label={`Usuń: ${store.title(entry)}`} disabled={busy}
                onClick={() => onChange(value.filter((id) => id !== entry.id))}>×</button>
            </li>
          ))}
        </ul>
      )}
      {(multiple || chosen.length === 0) && (
        <div className="lib-picker-search">
          <input
            value={query}
            disabled={busy || making}
            placeholder={placeholder ?? `Szukaj: ${kinds.map((k) => kindOf(k)?.label.toLowerCase() ?? k).join(', ')}`}
            role="combobox"
            aria-expanded={open}
            aria-controls={list}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); if (found[0] !== undefined) pick(found[0].id); else void make(); }
              if (e.key === 'Escape') setOpen(false);
            }}
          />
          {open && (found.length > 0 || query.trim() !== '') && (
            <ul className="lib-options" id={list} role="listbox">
              {found.map((entry) => (
                <li key={entry.id}>
                  <button type="button" role="option" aria-selected={false} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(entry.id)}>
                    <span className="lib-option-kind">{kindOf(entry.kind)?.label}</span> {entryLine(entry, store)}
                  </button>
                </li>
              ))}
              {query.trim() !== '' && kinds.length > 0 && (
                <li>
                  <button type="button" className="lib-option-new" onMouseDown={(e) => e.preventDefault()} onClick={() => void make()} disabled={making}>
                    + Utwórz {kindOf(kinds[0])?.label.toLowerCase()}: „{query.trim()}”
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </div>
  );
}

/* -- Im Seiteneditor ------------------------------------------------------------------------- */


/** Die Bibliotheken, die ich lesen kann — mit Namen (dafür braucht es die Schlüssel). */
export function useLibraries(given?: Who | null): readonly OpenLibrary[] | null | undefined {
  const who = useWho(given);
  const me = useMe(who);
  const [libraries, setLibraries] = useState<readonly OpenLibrary[] | null | undefined>(undefined);
  useEffect(() => {
    if (me === undefined) return undefined;
    if (me === null) { setLibraries(null); return undefined; }
    let alive = true;
    void loadLibraries().then((r) => openLibraries(me.ring, r.libraries)).then(
      (list) => { if (alive) setLibraries(list); },
      () => { if (alive) setLibraries([]); });
    return () => { alive = false; };
  }, [me]);
  return libraries;
}

/** `kind`: Bibliotheken (Vorgabe) oder 0110 Bazy wiedzy — zwei Strukturen, zwei Listen. */
export function PickLibrary({ value, busy, onPick, kind = 'books' }: { value: string; busy: boolean; onPick: (id: string) => void; kind?: LibraryKind }) {
  const all = useLibraries();
  const knowledge = kind === 'knowledge';
  if (all === undefined) return <p className="wk-hint">{knowledge ? 'Wczytywanie baz wiedzy…' : 'Wczytywanie bibliotek…'}</p>;
  if (all === null) return <input value={value} disabled={busy} placeholder={knowledge ? 'kennung bazy wiedzy' : 'kennung biblioteki'} onChange={(e) => onPick(e.target.value.trim())} />;
  const libraries = all.filter((one) => libraryKindOf(one) === kind);
  return (
    <>
      <select value={value} disabled={busy} onChange={(e) => onPick(e.target.value)}>
        <option value="">{knowledge ? '— wybierz bazę wiedzy —' : '— wybierz bibliotekę —'}</option>
        {libraries.map((one) => <option key={one.libraryId} value={one.libraryId}>{one.name} ({one.published} publicznych)</option>)}
        {value !== '' && !libraries.some((one) => one.libraryId === value) && <option value={value}>{value}</option>}
      </select>
      {libraries.length === 0 && (knowledge
        ? <span className="wk-hint">Nie masz jeszcze bazy wiedzy — <a href={viewPath('learn')}>załóż ją w Nauce</a>.</span>
        : <span className="wk-hint">Nie masz jeszcze biblioteki — <a href={viewPath('library')}>załóż ją</a>.</span>)}
    </>
  );
}

const itemLabel = (item: PublishedItem): string => {
  const s = summaryOf(item);
  const title = String(s.title ?? s.name ?? s.text ?? item.key ?? item.entryId);
  const date = typeof s.date === 'string' && s.date !== '' ? ` · ${s.date}` : '';
  return `${title.slice(0, 80)}${date}`;
};

export function PickLibraryEntry({ library, kinds, value, busy, optional, onPick }: {
  library: string;
  kinds: readonly string[];
  value: string;
  busy: boolean;
  optional?: boolean;
  onPick: (id: string) => void;
}) {
  const [items, setItems] = useState<readonly PublishedItem[] | null>(null);
  useEffect(() => {
    if (library === '') { setItems([]); return undefined; }
    let alive = true;
    void Promise.all(kinds.map((kind) => loadPublished(library, { kind, order: kind === 'text' ? '-sort' : 'sort', take: 200 })))
      .then((all) => { if (alive) setItems(all.flatMap((r) => r.items)); }, () => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [library, kinds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (library === '') return <span className="wk-hint">Najpierw wybierz bibliotekę.</span>;
  if (items === null) return <Loading lines={1} />;
  return (
    <>
      <select value={value} disabled={busy} onChange={(e) => onPick(e.target.value)}>
        <option value="">{optional === true ? '— wszystkie —' : '— wybierz —'}</option>
        {items.map((item) => <option key={item.entryId} value={item.entryId}>{itemLabel(item)}</option>)}
        {value !== '' && !items.some((item) => item.entryId === value) && <option value={value}>(nieopublikowany) {value}</option>}
      </select>
      {items.length === 0 && <span className="wk-hint">Tu są tylko wpisy opublikowane — opublikuj je w <a href={viewPath('library', library)}>Bibliotece</a>.</span>}
    </>
  );
}
