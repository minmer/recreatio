/**
 * WÄHLEN AUS DER BIBLIOTHEK (0064).
 *
 * <code>
 *   RefPicker          im Editor: ein Werk, Autoren, Themen — suchen, wählen,
 *                      oder gleich neu anlegen („Utwórz: Ratzinger")
 *   PickLibrary        im Seiteneditor: welche Bibliothek (oder 0110: welche
 *                      Baza wiedzy) ein Baustein zeigt
 *   PickLibraryEntry   im Seiteneditor: welcher Text, welches Projekt, welches
 *                      Thema — wer ihn auf der Seite sieht, sagt der Bereich der
 *                      Bibliothek (2026-10-22); 2026-10-22 (Schritt 8) ebenso bei
 *                      einer Baza wiedzy: aus ihren Einträgen, nicht mehr aus Bündeln
 * </code>
 */

import { useEffect, useId, useMemo, useState } from 'react';

import { containerPath, libraryKindOf, loadLibraries, openedLibraryKind, openLibraries, type LibraryKind, type OpenLibrary } from './library';
import { usePageLibrary } from './libraryOpen';
import { entrySort, isMusic, kindOf, str, WORK_TYPES, type LibEntry } from './libraryKinds';
import type { Entry, LibraryStore } from './libraryStore';
import { entryLine } from './refLabels';
import { useMe, useWho } from '../core/me';
import { viewPath } from '../routes';
import { WorkspaceError, type Who } from '../core/session';
import { Loading } from '../ui/Loading';
import { t as tApp, useT } from '../core/i18n';

/** Das Feld, das beim schnellen Anlegen den getippten Namen bekommt. */
const NAME_FIELD: Record<string, string> = { person: 'name', work: 'title', project: 'title', text: 'title', quote: 'text' };

/** 2026-10-26 — wie ein Eintrag in der Wahl heisst: ein Werk der Musik nach seinem Rodzaj („Nagranie"), sonst nach seiner Art. */
const kindWord = (entry: LibEntry): string | undefined =>
  (entry.kind === 'work' && isMusic(entry.data) ? WORK_TYPES.find((t) => t.value === entry.data.workType)?.label : undefined) ?? kindOf(entry.kind)?.label;

/** 2026-10-26 — Namen von Ensembles (Wykonawcy eines Nagrania): sie sind Institutionen. */
const ENSEMBLE = /^(?:chór|chor|schola|zespół|zespol|orkiestra|kwartet|kwintet|tercet|duet|kapela|filharmonia|sinfonietta|capella|cappella|ensemble|choir|orchestra|band|quartet|consort)(?=[\s,.]|$)/i; // i18n-ignore — Wörter in Namen

export function RefPicker({ store, kinds, value, multiple, busy, onChange, placeholder, only, makeWith, canMake = true }: {
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
  /** 2026-10-22 — `false`: nur wählen (ein Verweis eines Komentarza kann auf jede Art zeigen). */
  canMake?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [making, setMaking] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const list = useId();
  const t = useT();

  const chosen = value.map((id) => store.get(id)).filter((e): e is NonNullable<typeof e> => e !== undefined);
  const found = useMemo(() => (query.trim() === ''
    ? store.readable().filter((e) => kinds.includes(e.kind)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
      /* 2026-10-26 — ein Chor, eine Schola, ein Orchester ist eine Institution: ganzer Name, nicht Vor- und Nachname. */
      if (kind === 'person' && ENSEMBLE.test(name)) {
        data.personType = 'organization';
      } else if (kind === 'person') {
        const parts = name.split(/\s+/);
        if (parts.length >= 2 && !/^(św\.|bł\.|ks\.|o\.|s\.)$/i.test(parts[0])) { // i18n-ignore — Titel vor Namen
          data.surname = parts[parts.length - 1];
          data.givenNames = parts.slice(0, -1).join(' ');
          delete data.name;
        }
      }
      const saved = await store.save({ kind, data });
      pick(saved.id);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : t('library.pick.createFailed'));
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
              <a href={containerPath((store.homeOf(entry.id) ?? store).libraryId, entry.id)}>{entryLine(entry, store)}</a>
              <button type="button" className="lib-chip-x" aria-label={t('library.pick.removeOne', { title: store.title(entry) })} disabled={busy}
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
            placeholder={placeholder ?? t('library.kindList.search', { what: kinds.map((k) => kindOf(k)?.label.toLowerCase() ?? k).join(', ') })}
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
                    <span className="lib-option-kind">{kindWord(entry)}</span> {entryLine(entry, store)}
                  </button>
                </li>
              ))}
              {canMake && query.trim() !== '' && kinds.length > 0 && (
                <li>
                  <button type="button" className="lib-option-new" onMouseDown={(e) => e.preventDefault()} onClick={() => void make()} disabled={making}>
                    {t('library.pick.create', { kind: (kindWord({ id: '', kind: kinds[0]!, data: makeWith ?? {} }) ?? '').toLowerCase(), name: query.trim() })}
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

/** `kind`: Bibliotheken (Vorgabe), 0110 Bazy wiedzy oder 2026-10-23 Skryptoria — drei Strukturen, drei Listen. */
export function PickLibrary({ value, busy, onPick, kind = 'books' }: { value: string; busy: boolean; onPick: (id: string) => void; kind?: LibraryKind }) {
  const all = useLibraries();
  const knowledge = kind === 'knowledge';
  const t = useT();
  const k = kind === 'knowledge' ? 'knowledge' : kind === 'writing' ? 'writing' : 'books';
  const words = { loading: t(`library.pick.${k}.loading`), id: t(`library.pick.${k}.id`), choose: t(`library.pick.${k}.choose`) };
  if (all === undefined) return <p className="wk-hint">{words.loading}</p>;
  if (all === null) return <input value={value} disabled={busy} placeholder={words.id} onChange={(e) => onPick(e.target.value.trim())} />;
  const libraries = all.filter((one) => libraryKindOf(one) === kind);
  return (
    <>
      <select value={value} disabled={busy} onChange={(e) => onPick(e.target.value)}>
        <option value="">{words.choose}</option>
        {libraries.map((one) => <option key={one.libraryId} value={one.libraryId}>{one.name}{audienceTag(one, knowledge)}</option>)}
        {value !== '' && !libraries.some((one) => one.libraryId === value) && <option value={value}>{all.find((one) => one.libraryId === value)?.name ?? value}</option>}
      </select>
      {libraries.length === 0 && (
        <span className="wk-hint">
          {t(`library.pick.${k}.none`)} <a href={viewPath(knowledge ? 'knowledge' : kind === 'writing' ? 'scriptorium' : 'library')}>{t(`library.pick.${k}.create`)}</a>.
        </span>
      )}
    </>
  );
}

/** Wer liest, was dieser Baustein zeigt — kurz, hinter dem Namen in der Wahl. */
function audienceTag(one: OpenLibrary, knowledge: boolean): string {
  if (one.areaPublic !== true) return tApp('library.pick.tag.members');
  if (one.areaRuleAt == null) return knowledge ? tApp('library.pick.tag.publicBaseClosed') : tApp('library.pick.tag.publicWaiting');
  return knowledge ? tApp('library.pick.tag.publicWhole') : tApp('library.pick.tag.public');
}

interface EntryPickProps {
  library: string;
  kinds: readonly string[];
  value: string;
  busy: boolean;
  optional?: boolean;
  /** 2026-11-02 — was „leer" an dieser Stelle heisst (sonst „wszystkie"). */
  none?: string;
  onPick: (id: string) => void;
}

/**
 * 2026-10-22 — in einer Bibliothek wählt man aus ihren Einträgen (der
 * Bereich sagt, wer sie auf der Seite sieht); (Schritt 8) in einer Baza
 * wiedzy ebenso — Powtórki, Przebiegi, Einträge, wie sie die Baza kennt.
 */
export function PickLibraryEntry(props: EntryPickProps) {
  return openedLibraryKind(props.library) === 'knowledge' ? <PickBaseEntry {...props} /> : <PickBooksEntry {...props} />;
}

/**
 * 2026-11-05 — MEHRERE EINTRÄGE (ein Feld mit `multi`): einer je Zeile, mit „×", darunter „+ Dodaj". Gespeichert mit Komma
 * getrennt, in dieser Reihenfolge (der erste ist der, mit dem ein Baustein beginnt).
 */
export function PickLibraryEntries({ library, kinds, value, busy, onPick }: Omit<EntryPickProps, 'optional' | 'none'>) {
  const ids = value.split(',').map((x) => x.trim()).filter((x) => x !== '');
  const [adding, setAdding] = useState(false);
  const t = useT();
  const set = (next: readonly string[]) => onPick(next.join(','));
  return (
    <div className="lib-pick-many" data-pick-entries={ids.length}>
      {ids.map((id, i) => (
        <div key={`${id}:${i}`} className="cg-row">
          <PickLibraryEntry library={library} kinds={kinds} value={id} busy={busy} onPick={(x) => set(x === '' ? ids.filter((_, j) => j !== i) : ids.map((y, j) => (j === i ? x : y)))} />
          <button type="button" className="wk-link-btn" disabled={busy} aria-label={t('common.remove')} onClick={() => set(ids.filter((_, j) => j !== i))} data-pick-entry-remove={i}>×</button>
        </div>
      ))}
      {adding ? (
        <PickLibraryEntry library={library} kinds={kinds} value="" busy={busy} optional none={t('library.pick.chooseWord')} onPick={(x) => { if (x !== '' && !ids.includes(x)) set([...ids, x]); setAdding(false); }} />
      ) : (
        <button type="button" className="wk-link-btn" disabled={busy || library === ''} onClick={() => setAdding(true)} data-pick-entry-add="">{t('library.pick.add')}</button>
      )}
    </div>
  );
}

function PickBooksEntry({ library, kinds, value, busy, optional, onPick }: EntryPickProps) {
  const { store, revision, state } = usePageLibrary(library === '' ? null : library);
  const t = useT();
  const items = useMemo(() => (store === null ? [] : kinds.flatMap((kind) => store.ofKind(kind))
    .sort((a, b) => (a.kind === 'text' ? -1 : 1) * entrySort(a, store).localeCompare(entrySort(b, store), t.locale))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [store, revision, kinds.join(',')]);
  if (library === '') return <span className="wk-hint">{t('library.pick.books.first')}</span>;
  if (state === 'loading') return <Loading lines={1} />;
  if (store === null) return <span className="wk-hint">{t('library.pick.books.closed')}</span>;
  const label = (e: Entry) => {
    const date = str(e.data, 'date');
    return `${store.title(e).slice(0, 80)}${date === '' ? '' : ` · ${date}`}`;
  };
  return (
    <select value={value} disabled={busy} onChange={(e) => onPick(e.target.value)}>
      <option value="">{optional === true ? t('library.pick.dashed', { word: t('library.pick.all') }) : t('library.pick.dashed', { word: t('library.pick.chooseWord') })}</option>
      {items.map((e) => <option key={e.id} value={e.id}>{label(e)}</option>)}
      {value !== '' && !items.some((e) => e.id === value) && <option value={value}>{store.get(value) === undefined ? t('library.pick.elsewhere') : label(store.get(value)!)}</option>}
    </select>
  );
}

function PickBaseEntry({ library, kinds, value, busy, optional, none, onPick }: EntryPickProps) {
  const [items, setItems] = useState<readonly { id: string; label: string }[] | 'closed' | null>(null);
  const t = useT();
  useEffect(() => {
    if (library === '') { setItems([]); return undefined; }
    let alive = true;
    setItems(null);
    /* Cogita erst hier laden: wer nur Bibliotheken wählt, trägt sie nicht mit. */
    void import('../cogita/pageBase')
      .then(({ openPageBase, baseChoices }) => openPageBase(library).then((lib) => (lib === null ? 'closed' as const : baseChoices(lib, kinds))))
      .then((got) => { if (alive) setItems(got); }, () => { if (alive) setItems('closed'); });
    return () => { alive = false; };
  }, [library, kinds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  if (library === '') return <span className="wk-hint">{t('library.pick.knowledge.first')}</span>;
  if (items === null) return <Loading lines={1} />;
  if (items === 'closed') return <span className="wk-hint">{t('library.pick.knowledge.closed')}</span>;
  return (
    <>
      <select value={value} disabled={busy} onChange={(e) => onPick(e.target.value)}>
        <option value="">{t('library.pick.dashed', { word: optional === true ? none ?? t('library.pick.all') : t('library.pick.chooseWord') })}</option>
        {items.map((item) => <option key={item.id} value={item.id}>{item.label.slice(0, 80)}</option>)}
        {value !== '' && !items.some((item) => item.id === value) && <option value={value}>{t('library.pick.notInBase', { id: value })}</option>}
      </select>
      {items.length === 0 && <span className="wk-hint">{t('library.pick.baseEmpty')}</span>}
    </>
  );
}
