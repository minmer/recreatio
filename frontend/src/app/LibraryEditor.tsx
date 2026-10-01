/**
 * EIN EINTRAG DER BIBLIOTHEK, GANZ (0064) — sein Formular aus seiner Art,
 * beim Text das Schreiben mit Quellen, beim Projekt der Plan, daneben die
 * Veröffentlichung und was auf ihn zeigt.
 *
 * <b>Gespeichert wird von selbst</b>, kurz nachdem das Tippen aufhört — ein
 * Kapitel geht nicht verloren, weil jemand vergass, auf „Zapisz" zu drücken.
 * Veröffentlicht wird NIE von selbst: wer eine veröffentlichte Predigt
 * überarbeitet, sieht „Zmiany nie są jeszcze opublikowane" und entscheidet,
 * wann die neue Fassung hinausgeht.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { count } from './event/kit';
import { JsonPanel, type JsonPreview } from './JsonPanel';
import type { OpenLibrary } from './library';
import { bibliography, originOf, segText, workBehind } from './libraryCite';
import { exportLibrary, libraryDescription, MARKUP_DOC, planLibraryImport } from './libraryJson';
import {
  ids, isKey, kindOf, num, outline, str, TEXT_STATUS, wordCount, type EntryData, type LibEntry, type LibField, type OutlineItem
} from './libraryKinds';
import { citedKeys } from './libraryMarkup';
import { neededBy } from './libraryPublish';
import { entryLine, RefPicker } from './LibraryPick';
import type { Entry, LibraryStore } from './libraryStore';
import { QuoteFigure, Segs, TextArticle } from './LibraryText';
import { newId } from './ids';
import { viewPath } from './routes';
import { WorkspaceError } from './session';

const TAB_OF: Record<string, string> = { text: 'teksty', project: 'projekty', quote: 'cytaty', work: 'zrodla', person: 'osoby', topic: 'tematy' };

type SaveState = 'new' | 'saved' | 'dirty' | 'saving' | 'failed' | 'stale';

function defaults(kind: string, preset: Record<string, unknown>): EntryData {
  const base: EntryData = kind === 'text' ? { textType: 'sermon', status: 'draft' }
    : kind === 'work' ? { workType: 'book' }
    : kind === 'person' ? { personType: 'person' }
    : kind === 'project' ? { projectType: 'book', status: 'writing' }
    : {};
  return { ...base, ...preset };
}

export function LibraryEditor({ store, library, entryId, kind, preset = {} }: {
  store: LibraryStore;
  library: OpenLibrary;
  entryId: string | null;
  kind: string | null;
  preset?: Record<string, unknown>;
}) {
  const existing = entryId === null ? undefined : store.get(entryId);
  if (entryId !== null && existing === undefined) {
    return <p className="wk-empty">Tego wpisu nie ma (albo został usunięty). <a href={viewPath('library', library.libraryId)}>Wróć do biblioteki</a></p>;
  }
  return <Editor key={entryId ?? `new-${kind}`} store={store} library={library} existing={existing} kind={existing?.kind ?? kind!} preset={preset} />;
}

function Editor({ store, library, existing, kind, preset }: {
  store: LibraryStore;
  library: OpenLibrary;
  existing: Entry | undefined;
  kind: string;
  preset: Record<string, unknown>;
}) {
  const def = kindOf(kind)!;
  const [id] = useState(() => existing?.id ?? newId());
  const [data, setData] = useState<EntryData>(() => existing?.data ?? defaults(kind, preset));
  const [key, setKey] = useState(existing?.key ?? '');
  const [state, setState] = useState<SaveState>(existing === undefined ? 'new' : 'saved');
  const [failed, setFailed] = useState<string | null>(null);
  const saved = store.get(id);
  const readOnly = !library.writes;

  const set = useCallback((patch: EntryData) => {
    setData((was) => ({ ...was, ...patch }));
    setState((was) => (was === 'new' ? 'new' : 'dirty'));
  }, []);

  const save = useCallback(async (next: EntryData, nextKey: string) => {
    setState('saving');
    setFailed(null);
    try {
      const done = await store.save({ id, kind, ...(nextKey.trim() === '' ? {} : { key: nextKey.trim() }), data: next });
      setKey(done.key ?? '');
      setState((was) => (was === 'saving' ? 'saved' : was));
      return done;
    } catch (e) {
      const stale = e instanceof WorkspaceError && e.verdict === 'stale';
      setState(stale ? 'stale' : 'failed');
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać.');
      return null;
    }
  }, [id, kind, store]);

  /* Von selbst speichern — gut eine Sekunde nach dem letzten Tastendruck. */
  useEffect(() => {
    if (state !== 'dirty' || readOnly) return undefined;
    const timer = window.setTimeout(() => { void save(data, key); }, 1200);
    return () => window.clearTimeout(timer);
  }, [state, data, key, save, readOnly]);

  /* Wer die Seite verlässt, während noch etwas wartet, verliert es nicht. */
  const pending = useRef<{ data: EntryData; key: string } | null>(null);
  pending.current = state === 'dirty' ? { data, key } : null;
  useEffect(() => () => { if (pending.current !== null) void save(pending.current.data, pending.current.key); }, [save]);

  /* Was ein anderer Tab gespeichert hat, kommt herein — solange hier nichts offen ist. */
  useEffect(() => {
    const fresh = store.get(id);
    if (fresh !== undefined && state === 'saved') { setData(fresh.data); setKey(fresh.key ?? ''); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.revision]);

  const create = async () => {
    const done = await save(data, key);
    if (done !== null) window.location.replace(viewPath('library', library.libraryId, done.id));
  };

  const reloadTheirs = () => {
    const fresh = store.get(id);
    if (fresh !== undefined) { setData(fresh.data); setKey(fresh.key ?? ''); }
    setState('saved');
    setFailed(null);
  };

  const live: LibEntry = { id, kind, ...(key === '' ? {} : { key }), data };
  const title = def.title(data, store);

  const status = state === 'new' ? 'Nowy — zapisz, żeby powstał.'
    : state === 'saving' ? 'Zapisywanie…'
    : state === 'dirty' ? 'Zmiany…'
    : state === 'failed' ? 'Nie zapisano.'
    : state === 'stale' ? 'Ktoś zmienił ten wpis w międzyczasie.'
    : 'Zapisane.';

  return (
    <div className={`lib-editor lib-editor-${kind}`}>
      <header className="lib-editor-head">
        <a className="wk-link" href={viewPath('library', library.libraryId, TAB_OF[kind] ?? '')}>← {def.plural}</a>
        <span className="lib-editor-kind">{def.label}</span>
        <h1 className="wk-h1 lib-editor-title">{kind === 'quote' ? <q>{title}</q> : title}</h1>
        <p className={`lib-state is-${state}`} role="status">{status}</p>
        {state === 'stale' && (
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={reloadTheirs}>Wczytaj nowszą wersję</button>
            <button type="button" className="wk-link-btn" onClick={() => void save(data, key)}>Zachowaj moją (nadpisz)</button>
          </div>
        )}
        {failed !== null && state !== 'stale' && <p className="wk-error">{failed}</p>}
        {readOnly && <p className="wk-note">Tę bibliotekę możesz tylko czytać.</p>}
      </header>

      <div className="lib-editor-grid">
        <div className="lib-editor-main">
          {kind === 'text' ? (
            <TextForm store={store} entry={live} data={data} set={set} readOnly={readOnly} />
          ) : (
            <FieldList store={store} kind={kind} data={data} set={set} readOnly={readOnly} />
          )}
          {kind === 'project' && saved !== undefined && (
            <OutlineEditor store={store} library={library} project={saved} value={outline(data)} readOnly={readOnly} onChange={(next) => set({ outline: next })} />
          )}
          {state === 'new' && !readOnly && (
            <div className="wk-actions"><button type="button" className="wk-btn" onClick={() => void create()}>Zapisz</button></div>
          )}
        </div>

        <aside className="lib-editor-side">
          {def.keyed && (
            <KeyBox store={store} id={id} value={key} readOnly={readOnly} onChange={(next) => { setKey(next); setState((was) => (was === 'new' ? 'new' : 'dirty')); }} />
          )}
          {saved !== undefined && <PublishBox store={store} entry={saved} readOnly={readOnly} />}
          {saved !== undefined && <Relations store={store} library={library} entry={saved} />}
          {kind === 'quote' && str(data, 'text') !== '' && <section className="lib-box"><h2 className="lib-box-h">Podgląd</h2><QuoteFigure entry={live} look={store} /></section>}
          {saved !== undefined && <EntryJson store={store} library={library} entry={saved} />}
          {saved !== undefined && !readOnly && <DeleteBox store={store} library={library} entry={saved} />}
        </aside>
      </div>
    </div>
  );
}

/* -- Felder ---------------------------------------------------------------------------------- */

function FieldList({ store, kind, data, set, readOnly, skip = [] }: {
  store: LibraryStore;
  kind: string;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
  skip?: readonly string[];
}) {
  const def = kindOf(kind)!;
  return (
    <div className="lib-fields">
      {def.fields.filter((f) => !skip.includes(f.key) && f.type !== 'outline' && f.type !== 'markup' && (f.when === undefined || f.when(data))).map((field) => (
        <FieldInput key={field.key} store={store} field={field} data={data} set={set} readOnly={readOnly} />
      ))}
    </div>
  );
}

function FieldInput({ store, field, data, set, readOnly }: {
  store: LibraryStore;
  field: LibField;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
}) {
  const value = str(data, field.key);
  const label = <span>{field.label}{field.private === true && <em className="lib-private" title="Nigdy nie jest publikowane"> · prywatne</em>}</span>;
  const wide = field.type === 'text' || field.type === 'refs' || field.key === 'title';

  if (field.type === 'ref' || field.type === 'refs') {
    return (
      <div className={`wk-field lib-field${wide ? ' is-wide' : ''}`}>
        {label}
        <RefPicker store={store} kinds={field.to ?? []} value={ids(data, field.key)} multiple={field.type === 'refs'} busy={readOnly}
          onChange={(next) => set({ [field.key]: field.type === 'ref' ? (next[0] ?? '') : next })} />
      </div>
    );
  }

  let input: ReactNode;
  if (field.type === 'select') {
    input = (
      <select value={value} disabled={readOnly} onChange={(e) => set({ [field.key]: e.target.value })}>
        <option value="">—</option>
        {(field.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  } else if (field.type === 'text') {
    input = <textarea rows={field.key === 'text' ? 6 : 3} value={value} placeholder={field.hint} disabled={readOnly} onChange={(e) => set({ [field.key]: e.target.value })} />;
  } else {
    input = (
      <input
        type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
        value={field.type === 'number' ? (num(data, field.key) ?? '') : value}
        placeholder={field.hint}
        disabled={readOnly}
        onChange={(e) => set({ [field.key]: field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })}
      />
    );
  }

  return <label className={`wk-field lib-field${wide ? ' is-wide' : ''}`}>{label}{input}</label>;
}

/* -- Der Text: schreiben mit Quellen ------------------------------------------------------------- */

function TextForm({ store, entry, data, set, readOnly }: {
  store: LibraryStore;
  entry: LibEntry;
  data: EntryData;
  set: (patch: EntryData) => void;
  readOnly: boolean;
}) {
  const [view, setView] = useState<'write' | 'preview' | 'both'>(() => (window.matchMedia?.('(min-width: 70rem)').matches === true ? 'both' : 'write'));
  const [part, setPart] = useState<'body' | 'further'>('body');
  const words = wordCount(str(data, 'body'));
  const target = num(data, 'targetWords');
  const missing = citedKeys(str(data, 'body'), str(data, 'further')).filter((k) => store.byKey(k) === undefined);

  return (
    <>
      <label className="wk-field lib-field is-wide">
        <span>Tytuł</span>
        <input className="lib-title-input" value={str(data, 'title')} disabled={readOnly} placeholder="Tytuł tekstu" onChange={(e) => set({ title: e.target.value })} />
      </label>

      <div className="lib-write-bar">
        <div className="wk-seg" role="group" aria-label="Część tekstu">
          {([['body', 'Treść'], ['further', 'Dalsze informacje']] as const).map(([value, label]) => (
            <button key={value} type="button" className={part === value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={part === value} onClick={() => setPart(value)}>{label}</button>
          ))}
        </div>
        <div className="wk-seg" role="group" aria-label="Widok">
          {([['write', 'Pisanie'], ['both', 'Obok siebie'], ['preview', 'Podgląd']] as const).map(([value, label]) => (
            <button key={value} type="button" className={view === value ? 'wk-seg-opt wk-seg-on' : 'wk-seg-opt'} aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>
          ))}
        </div>
        <span className="lib-words">{words} słów{target !== null && target > 0 ? ` z ${target} (${Math.round((words / target) * 100)}%)` : ''}</span>
      </div>

      <div className={`lib-write is-${view}`}>
        {view !== 'preview' && (
          <WritingArea
            key={part}
            store={store}
            value={str(data, part)}
            readOnly={readOnly}
            placeholder={part === 'body' ? 'Treść… Źródło wstawisz przyciskiem „Źródło” albo pisząc [@klucz, s. 12].' : 'Dalsze informacje — lektura, linki, kontekst.'}
            onChange={(next) => set({ [part]: next })}
          />
        )}
        {view !== 'write' && (
          <div className="lib-preview" aria-label="Podgląd">
            <TextArticle entry={entry} look={store} prefix="pv-" hrefOf={(e) => viewPath('library', store.libraryId, e.id)} />
          </div>
        )}
      </div>
      {missing.length > 0 && <p className="wk-warn">Nie ma w bibliotece: {missing.map((k) => `[@${k}]`).join(', ')} — te przypisy będą puste.</p>}

      <details className="wk-fold lib-meta-fold" open={str(data, 'date') === '' && str(data, 'body') === ''}>
        <summary>Dane tekstu — rodzaj, data, czytania, projekt, tematy, nagranie</summary>
        <FieldList store={store} kind="text" data={data} set={set} readOnly={readOnly} skip={['title']} />
      </details>

      <details className="wk-fold">
        <summary>Jak pisać — zapis treści</summary>
        <pre className="wk-json-pre">{MARKUP_DOC}</pre>
      </details>
    </>
  );
}

/** Das Schreibfeld — mit Knöpfen, die an der Schreibmarke einfügen. */
function WritingArea({ store, value, readOnly, placeholder, onChange }: {
  store: LibraryStore;
  value: string;
  readOnly: boolean;
  placeholder: string;
  onChange: (next: string) => void;
}) {
  const area = useRef<HTMLTextAreaElement | null>(null);
  const [picker, setPicker] = useState<'cite' | 'embed' | null>(null);

  /* Das Feld wächst mit dem Text. */
  useEffect(() => {
    const el = area.current;
    if (el === null) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(320, el.scrollHeight + 4)}px`;
  }, [value]);

  const edit = (make: (before: string, chosen: string, after: string) => { text: string; caret: [number, number] }) => {
    const el = area.current;
    const from = el?.selectionStart ?? value.length;
    const to = el?.selectionEnd ?? value.length;
    const done = make(value.slice(0, from), value.slice(from, to), value.slice(to));
    onChange(done.text);
    window.requestAnimationFrame(() => {
      if (el === null) return;
      el.focus();
      el.setSelectionRange(done.caret[0], done.caret[1]);
    });
  };

  const wrap = (mark: string) => edit((b, s, a) => ({ text: `${b}${mark}${s || 'tekst'}${mark}${a}`, caret: [b.length + mark.length, b.length + mark.length + (s || 'tekst').length] }));
  const line = (prefix: string) => edit((b, s, a) => {
    const start = b.lastIndexOf('\n') + 1;
    const text = `${b.slice(0, start)}${prefix}${b.slice(start)}${s}${a}`;
    return { text, caret: [b.length + prefix.length, b.length + prefix.length + s.length] };
  });
  const insert = (text: string, block = false) => edit((b, s, a) => {
    const lead = block && b !== '' && !b.endsWith('\n\n') ? (b.endsWith('\n') ? '\n' : '\n\n') : '';
    const tail = block && !a.startsWith('\n') ? '\n\n' : '';
    const out = `${b}${lead}${text}${tail}${a}`;
    const caret = b.length + lead.length + text.length + tail.length;
    void s;
    return { text: out, caret: [caret, caret] };
  });

  const selection = () => {
    const el = area.current;
    return el === null ? '' : value.slice(el.selectionStart, el.selectionEnd);
  };

  return (
    <div className="lib-writing">
      {!readOnly && (
        <div className="lib-tools" role="toolbar" aria-label="Wstawianie">
          <button type="button" title="Pogrubienie" onClick={() => wrap('**')}><b>B</b></button>
          <button type="button" title="Kursywa" onClick={() => wrap('*')}><i>I</i></button>
          <button type="button" title="Śródtytuł" onClick={() => line('## ')}>Śródtytuł</button>
          <button type="button" title="Wcięty cytat" onClick={() => line('> ')}>„ ”</button>
          <button type="button" title="Lista" onClick={() => line('- ')}>• Lista</button>
          <button type="button" title="Własny przypis" onClick={() => edit((b, s, a) => ({ text: `${b}^[${s}]${a}`, caret: [b.length + 2, b.length + 2 + s.length] }))}>Przypis</button>
          <button type="button" className={picker === 'cite' ? 'is-on' : ''} onClick={() => setPicker(picker === 'cite' ? null : 'cite')}>Źródło…</button>
          <button type="button" className={picker === 'embed' ? 'is-on' : ''} onClick={() => setPicker(picker === 'embed' ? null : 'embed')}>Cytat z biblioteki…</button>
        </div>
      )}
      {picker !== null && (
        <CitePicker
          store={store}
          mode={picker}
          selection={selection()}
          onClose={() => setPicker(null)}
          onCite={(key, locator) => { insert(locator === '' ? `[@${key}]` : `[@${key}, ${locator}]`); setPicker(null); }}
          onEmbed={(key, replaceSelection) => {
            if (replaceSelection) edit((b, _s, a) => ({ text: `${b}![@${key}]${a}`, caret: [b.length + key.length + 4, b.length + key.length + 4] }));
            else insert(`![@${key}]`, true);
            setPicker(null);
          }}
        />
      )}
      <textarea
        ref={area}
        className="lib-textarea"
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        spellCheck
        lang="pl"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); wrap('**'); }
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); wrap('*'); }
        }}
      />
    </div>
  );
}

/** Eine Quelle wählen — oder aus dem markierten Absatz gleich ein Zitat machen. */
function CitePicker({ store, mode, selection, onClose, onCite, onEmbed }: {
  store: LibraryStore;
  mode: 'cite' | 'embed';
  selection: string;
  onClose: () => void;
  onCite: (key: string, locator: string) => void;
  onEmbed: (key: string, replaceSelection: boolean) => void;
}) {
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<Entry | null>(null);
  const [locator, setLocator] = useState('');
  const [making, setMaking] = useState(false);
  const [work, setWork] = useState<string[]>([]);
  const [quoteLocator, setQuoteLocator] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  const kinds = mode === 'cite' ? ['work', 'quote', 'text'] : ['quote'];

  const found = useMemo(() => (query.trim() === ''
    ? store.all().filter((e) => kinds.includes(e.kind)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    : store.search(query, kinds)).slice(0, 10),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [query, store, store.revision, mode]);

  const makeQuote = async () => {
    setFailed(null);
    try {
      const saved = await store.save({ kind: 'quote', data: { text: selection.trim(), work: work[0] ?? '', locator: quoteLocator } });
      onEmbed(saved.key!, true);
    } catch (e) {
      setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się zapisać cytatu.');
    }
  };

  return (
    <div className="lib-cite-picker" role="dialog" aria-label={mode === 'cite' ? 'Wstaw źródło' : 'Wstaw cytat'}>
      <div className="lib-cite-head">
        <strong>{mode === 'cite' ? 'Wstaw odwołanie do źródła' : 'Wstaw cytat z biblioteki'}</strong>
        <button type="button" className="wk-link-btn" onClick={onClose}>Zamknij</button>
      </div>

      {mode === 'embed' && selection.trim().length > 10 && !making && (
        <button type="button" className="wk-link-btn" onClick={() => setMaking(true)}>Zapisz zaznaczony fragment jako nowy cytat…</button>
      )}
      {making ? (
        <div className="lib-cite-make">
          <blockquote className="lib-blockquote">{selection.trim().slice(0, 400)}{selection.trim().length > 400 ? '…' : ''}</blockquote>
          <div className="wk-field"><span>Źródło</span><RefPicker store={store} kinds={['work']} value={work} multiple={false} onChange={setWork} /></div>
          <label className="wk-field"><span>Miejsce</span><input value={quoteLocator} placeholder="s. 23 · J 3,16" onChange={(e) => setQuoteLocator(e.target.value)} /></label>
          {failed !== null && <p className="wk-error">{failed}</p>}
          <div className="wk-actions">
            <button type="button" className="wk-btn" onClick={() => void makeQuote()}>Zapisz cytat i wstaw</button>
            <button type="button" className="wk-link-btn" onClick={() => setMaking(false)}>Anuluj</button>
          </div>
        </div>
      ) : chosen === null ? (
        <>
          <input autoFocus type="search" value={query} placeholder={mode === 'cite' ? 'Szukaj źródła, cytatu, tekstu…' : 'Szukaj cytatu…'} onChange={(e) => setQuery(e.target.value)} />
          <ul className="lib-cite-list">
            {found.map((entry) => (
              <li key={entry.id}>
                <button type="button" onClick={() => {
                  if (entry.key === undefined) return;
                  if (mode === 'embed') onEmbed(entry.key, false);
                  else if (entry.kind === 'work') setChosen(entry);
                  else onCite(entry.key, '');
                }}>
                  <span className="lib-option-kind">{kindOf(entry.kind)?.label}</span> {entry.kind === 'quote' ? `„${store.title(entry)}” — ${originOf(entry, store)}` : entryLine(entry, store)}
                </button>
              </li>
            ))}
            {found.length === 0 && <li className="wk-hint">Nic nie znaleziono — dodaj źródło w zakładce „Źródła”.</li>}
          </ul>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); onCite(chosen.key!, locator.trim()); }}>
          <p>{entryLine(chosen, store)}</p>
          <label className="wk-field"><span>Miejsce (strona, werset, numer) — można pominąć</span>
            <input autoFocus value={locator} placeholder={str(chosen.data, 'workType') === 'bible' ? 'J 3,16' : 's. 23'} onChange={(e) => setLocator(e.target.value)} />
          </label>
          <div className="wk-actions">
            <button type="submit" className="wk-btn">Wstaw [@{chosen.key}{locator.trim() === '' ? '' : `, ${locator.trim()}`}]</button>
            <button type="button" className="wk-link-btn" onClick={() => setChosen(null)}>Inne źródło</button>
          </div>
        </form>
      )}
    </div>
  );
}

/* -- Der Plan eines Projekts ------------------------------------------------------------------- */

function OutlineEditor({ store, library, project, value, readOnly, onChange }: {
  store: LibraryStore;
  library: OpenLibrary;
  project: Entry;
  value: readonly OutlineItem[];
  readOnly: boolean;
  onChange: (next: OutlineItem[]) => void;
}) {
  const texts = store.ofKind('text').filter((t) => ids(t.data, 'project').includes(project.id));
  const listed = new Set(value.filter((i): i is { text: string } => 'text' in i).map((i) => i.text));
  const outside = texts.filter((t) => !listed.has(t.id));
  const items = value.filter((i) => !('text' in i) || store.get(i.text) !== undefined);
  const words = texts.reduce((n, t) => n + wordCount(str(t.data, 'body')), 0);
  const target = num(project.data, 'targetWords');
  const [heading, setHeading] = useState('');

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [one] = next.splice(from, 1);
    next.splice(to, 0, one!);
    onChange(next);
  };

  const works = texts.flatMap((t) => citedKeys(str(t.data, 'body'), str(t.data, 'further')).map((k) => workBehind(store.byKey(k), store)))
    .filter((w): w is Entry => w !== undefined);
  const bib = bibliography(works, store);

  return (
    <section className="lib-outline">
      <h2 className="wk-h2">Plan</h2>
      <p className="lib-progress">
        {count(texts.length, 'tekst', 'teksty', 'tekstów')} · {count(words, 'słowo', 'słowa', 'słów')}{target !== null && target > 0 ? ` z ${target} (${Math.round((words / target) * 100)}%)` : ''}
        {target !== null && target > 0 && <span className="lib-bar"><span style={{ width: `${Math.min(100, Math.round((words / target) * 100))}%` }} /></span>}
      </p>
      <ol className="lib-outline-list">
        {items.map((item, i) => (
          <li key={'text' in item ? item.text : `h${i}`} className={'heading' in item ? 'is-heading' : ''}>
            {'heading' in item ? (
              <input value={item.heading} disabled={readOnly} aria-label="Nagłówek części" onChange={(e) => onChange(items.map((x, j) => (j === i ? { heading: e.target.value } : x)))} />
            ) : (
              <a href={viewPath('library', library.libraryId, item.text)}>
                {store.title(store.get(item.text)!)}
                <span className="lib-row-meta"> · {TEXT_STATUS.find((s) => s.value === str(store.get(item.text)!.data, 'status'))?.label ?? 'Szkic'} · {count(wordCount(str(store.get(item.text)!.data, 'body')), 'słowo', 'słowa', 'słów')}</span>
              </a>
            )}
            {!readOnly && (
              <span className="lib-outline-tools">
                <button type="button" aria-label="Wyżej" disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button>
                <button type="button" aria-label="Niżej" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>↓</button>
                <button type="button" aria-label="Usuń z planu" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
              </span>
            )}
          </li>
        ))}
      </ol>
      {outside.length > 0 && (
        <div className="lib-outside">
          <p className="wk-hint">Teksty tego projektu spoza planu:</p>
          <ul>
            {outside.map((t) => (
              <li key={t.id}>
                <a href={viewPath('library', library.libraryId, t.id)}>{store.title(t)}</a>{' '}
                {!readOnly && <button type="button" className="wk-link-btn" onClick={() => onChange([...items, { text: t.id }])}>dodaj do planu</button>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!readOnly && (
        <div className="wk-actions">
          <input value={heading} placeholder="Nagłówek części, np. Część I" onChange={(e) => setHeading(e.target.value)} aria-label="Nowy nagłówek" />
          <button type="button" className="wk-link-btn" disabled={heading.trim() === ''} onClick={() => { onChange([...items, { heading: heading.trim() }]); setHeading(''); }}>+ Nagłówek</button>
          <a className="wk-btn" href={viewPath('library', library.libraryId, 'nowy', 'text', `project=${project.id}`)}>+ Nowy tekst w projekcie</a>
        </div>
      )}
      {bib.length > 0 && (
        <details className="wk-fold">
          <summary>Bibliografia projektu ({bib.length})</summary>
          <ul className="lib-bib">{bib.map(({ work, segs }) => <li key={work.id}><Segs segs={segs} /></li>)}</ul>
          <button type="button" className="wk-link-btn" onClick={() => void navigator.clipboard.writeText(bib.map(({ segs }) => `${segText(segs)}.`).join('\n'))}>Kopiuj bibliografię</button>
        </details>
      )}
    </section>
  );
}

/* -- Der Schlüssel ------------------------------------------------------------------------------ */

function KeyBox({ store, id, value, readOnly, onChange }: { store: LibraryStore; id: string; value: string; readOnly: boolean; onChange: (next: string) => void }) {
  const taken = value !== '' && store.keyTaken(value, id);
  const wrong = value !== '' && !isKey(value);
  return (
    <section className="lib-box">
      <h2 className="lib-box-h">Klucz cytowania</h2>
      <input value={value} disabled={readOnly} placeholder="zostanie zaproponowany" onChange={(e) => onChange(e.target.value.replace(/\s+/g, ''))} aria-label="Klucz cytowania" />
      {value !== '' && !taken && !wrong && <p className="wk-hint">W tekście: <code>[@{value}]</code> albo <code>[@{value}, s. 12]</code></p>}
      {taken && <p className="wk-warn">Ten klucz ma już inny wpis — zostanie uzupełniony literą.</p>}
      {wrong && <p className="wk-warn">Tylko litery, cyfry i znaki . _ : -</p>}
    </section>
  );
}

/* -- Veröffentlichung ----------------------------------------------------------------------------- */

function PublishBox({ store, entry, readOnly }: { store: LibraryStore; entry: Entry; readOnly: boolean }) {
  const [current, setCurrent] = useState<boolean | null>(null);
  const [asking, setAsking] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (entry.publishedAs === null) { setCurrent(null); return undefined; }
    let alive = true;
    const timer = window.setTimeout(() => { void store.publicIsCurrent(entry.id).then((ok) => { if (alive) setCurrent(ok); }); }, 600);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [store, entry.id, entry.publishedAs, entry.version, store.revision]);

  const run = async (todo: () => Promise<void>) => {
    setBusy(true);
    setFailed(null);
    try { await todo(); setAsking(null); } catch (e) { setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się.'); } finally { setBusy(false); }
  };

  const publish = () => {
    const next = store.planFor({ add: [entry.id] });
    if (next.alsoNew.length > 0 && asking === null) { setAsking([...next.alsoNew]); return; }
    void run(() => store.apply(next));
  };

  const users = entry.publishedAs !== null ? neededBy(entry.id, store.all(), store).map((id) => store.get(id)).filter((e): e is Entry => e !== undefined) : [];

  return (
    <section className="lib-box">
      <h2 className="lib-box-h">Publikacja</h2>
      {entry.publishedAs === null && <p>Prywatny — widzą go tylko osoby z kluczem biblioteki.</p>}
      {entry.publishedAs === 'explicit' && <p><span className="lib-badge is-public">publiczny</span></p>}
      {entry.publishedAs === 'implicit' && (
        <p><span className="lib-badge is-implicit">publiczny jako źródło</span> — przywołuje go: {users.slice(0, 4).map((u) => store.title(u)).join(', ') || 'opublikowany wpis'}.</p>
      )}
      {current === false && <p className="wk-warn">Zmiany nie są jeszcze opublikowane.</p>}

      {asking !== null && (
        <div className="lib-ask">
          <p>Razem z nim staną się publiczne (bez prywatnych notatek):</p>
          <ul>{asking.slice(0, 12).map((id) => <li key={id}>{kindOf(store.get(id)?.kind ?? '')?.label}: {store.title(store.get(id)!)}</li>)}</ul>
          {asking.length > 12 && <p className="wk-hint">i {asking.length - 12} więcej</p>}
        </div>
      )}

      {!readOnly && (
        <div className="wk-actions">
          {entry.publishedAs !== 'explicit' && (
            <button type="button" className="wk-btn" disabled={busy} onClick={publish}>
              {busy ? 'Publikowanie…' : asking !== null ? 'Opublikuj razem z nimi' : entry.publishedAs === 'implicit' ? 'Opublikuj też samodzielnie' : 'Opublikuj'}
            </button>
          )}
          {entry.publishedAs !== null && current === false && (
            <button type="button" className="wk-btn" disabled={busy} onClick={() => void run(() => store.apply(store.planFor({ refresh: [entry.id] })))}>Zaktualizuj publikację</button>
          )}
          {entry.publishedAs === 'explicit' && (
            <button type="button" className="wk-link-btn" disabled={busy} onClick={() => void run(() => store.unpublish([entry.id]))}>Wycofaj publikację</button>
          )}
          {asking !== null && <button type="button" className="wk-link-btn" onClick={() => setAsking(null)}>Anuluj</button>}
        </div>
      )}
      {entry.publishedAs === 'explicit' && entry.kind === 'text' && <p className="wk-hint">Na stronie pokaże go moduł „Tekst z biblioteki” albo „Archiwum tekstów”.</p>}
      {entry.publishedAs === 'explicit' && entry.kind === 'quote' && <p className="wk-hint">Widoczny w module „Zbiór cytatów”.</p>}
      {failed !== null && <p className="wk-error">{failed}</p>}
    </section>
  );
}

/* -- Was auf ihn zeigt --------------------------------------------------------------------------- */

function Relations({ store, library, entry }: { store: LibraryStore; library: OpenLibrary; entry: Entry }) {
  const back = store.backlinks(entry.id);
  const quotes = back.filter((e) => e.kind === 'quote');
  const texts = back.filter((e) => e.kind === 'text');
  const works = back.filter((e) => e.kind === 'work');
  const projects = back.filter((e) => e.kind === 'project');
  const other = back.filter((e) => !['quote', 'text', 'work', 'project'].includes(e.kind));
  const link = (e: Entry) => <a href={viewPath('library', library.libraryId, e.id)}>{e.kind === 'quote' ? `„${store.title(e)}”` : entryLine(e, store)}</a>;

  const cited = entry.kind === 'text' ? citedKeys(str(entry.data, 'body'), str(entry.data, 'further')).map((k) => store.byKey(k)).filter((e): e is Entry => e !== undefined) : [];

  if (back.length === 0 && cited.length === 0 && entry.kind !== 'work') return null;

  return (
    <section className="lib-box">
      <h2 className="lib-box-h">Powiązania</h2>
      {entry.kind === 'work' && (
        <>
          <p className="lib-box-sub">Cytaty z tego źródła ({quotes.length})</p>
          {quotes.length > 0 && <ul className="lib-rel">{quotes.map((q) => <li key={q.id}>{link(q)} <span className="lib-row-meta">{str(q.data, 'locator')}</span></li>)}</ul>}
          {library.writes && <a className="wk-link-btn" href={viewPath('library', library.libraryId, 'nowy', 'quote', `work=${entry.id}`)}>+ Cytat z tego źródła</a>}
        </>
      )}
      {entry.kind !== 'work' && quotes.length > 0 && <><p className="lib-box-sub">Cytaty</p><ul className="lib-rel">{quotes.map((q) => <li key={q.id}>{link(q)}</li>)}</ul></>}
      {works.length > 0 && <><p className="lib-box-sub">Źródła</p><ul className="lib-rel">{works.map((w) => <li key={w.id}>{link(w)}</li>)}</ul></>}
      {texts.length > 0 && <><p className="lib-box-sub">Przywołują go teksty</p><ul className="lib-rel">{texts.map((t) => <li key={t.id}>{link(t)}</li>)}</ul></>}
      {projects.length > 0 && <><p className="lib-box-sub">W projekcie</p><ul className="lib-rel">{projects.map((o) => <li key={o.id}>{link(o)}</li>)}</ul></>}
      {other.length > 0 && <><p className="lib-box-sub">Inne</p><ul className="lib-rel">{other.map((o) => <li key={o.id}>{link(o)}</li>)}</ul></>}
      {cited.length > 0 && <><p className="lib-box-sub">Ten tekst przywołuje</p><ul className="lib-rel">{cited.map((c) => <li key={c.id}>{link(c)}</li>)}</ul></>}
    </section>
  );
}

/* -- JSON und Löschen ------------------------------------------------------------------------------ */

function EntryJson({ store, library, entry }: { store: LibraryStore; library: OpenLibrary; entry: Entry }) {
  const preview = (doc: unknown): JsonPreview | { error: string } => {
    const planned = planLibraryImport(doc, store);
    return 'error' in planned ? planned : { lines: planned.lines, warnings: planned.warnings };
  };
  return (
    <JsonPanel
      summary="JSON tego wpisu"
      lead={<>Ten wpis jako JSON — do poprawienia ręcznie albo przez AI. Import zmienia go w miejscu (pola, których nie podasz, zostają).</>}
      fileName={`wpis-${entry.key ?? entry.id.slice(0, 8)}.json`}
      exportDoc={() => exportLibrary(library.name, [entry])}
      description={libraryDescription}
      preview={preview}
      importLabel="Importuj i zapisz"
      onImport={async (doc) => {
        const planned = planLibraryImport(doc, store);
        if ('error' in planned) throw new WorkspaceError(planned.error);
        for (const draft of planned.drafts) await store.save({ id: draft.id, kind: draft.kind, ...(draft.key === undefined ? {} : { key: draft.key }), data: draft.data });
        return { lines: planned.lines, warnings: planned.warnings };
      }}
    />
  );
}

function DeleteBox({ store, library, entry }: { store: LibraryStore; library: OpenLibrary; entry: Entry }) {
  const [sure, setSure] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const back = store.backlinks(entry.id);
  return (
    <section className="lib-box">
      {!sure ? (
        <button type="button" className="wk-link-btn lib-danger-link" onClick={() => setSure(true)}>Usuń ten wpis…</button>
      ) : (
        <>
          <p>Usunąć „{store.title(entry)}”?{back.length > 0 ? ` Odwołuje się do niego ${back.length} wpisów — te odwołania zostaną puste.` : ''}{entry.publishedAs !== null ? ' Zniknie też z publikacji.' : ''}</p>
          <div className="wk-actions">
            <button type="button" className="wk-btn lib-btn-danger" onClick={() => void store.remove(entry.id).then(
              () => { window.location.hash = viewPath('library', library.libraryId, TAB_OF[entry.kind] ?? ''); },
              (e: unknown) => setFailed(e instanceof WorkspaceError ? e.message : 'Nie udało się usunąć.'))}>Usuń</button>
            <button type="button" className="wk-link-btn" onClick={() => setSure(false)}>Anuluj</button>
          </div>
          {failed !== null && <p className="wk-error">{failed}</p>}
        </>
      )}
    </section>
  );
}
